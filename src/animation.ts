import {AssetManagerExtension, normalizeName} from './extension.js';

type BlockArgs = Record<string, unknown>;
type AnimationMode = 'loop' | 'sequence';
type AnimationActionKind = 'image' | 'audio';

interface AnimationAction {
  assetName: string;
  kind: AnimationActionKind;
}

interface AnimationDefinition {
  actions: AnimationAction[];
  intervalsMs: number[];
  mode: AnimationMode;
}

interface AnimationState extends AnimationDefinition {
  actor: string;
  target: TurboWarpTarget;
  actionIndex: number;
  deadline: number;
  timer: ReturnType<typeof setTimeout> | null;
  generation: number;
}

interface AnimationBatch {
  actions: AnimationAction[];
  intervalMs: number | null;
  nextActionIndex: number | null;
}

interface AnimationAssetsInput {
  text: string;
  argumentName: 'ASSETS' | 'COSTUMES';
}

/**
 * Asset Manager with actor-level background asset animation.
 *
 * ACTOR is resolved using the existing named-sprite behaviour of setSpriteSkin.
 * ASSETS and DURATIONS are comma-separated strings. ASSETS contains registered
 * image or audio asset names. Each duration is the interval before the next
 * action, and a zero groups those adjacent actions. Loop has one interval per
 * action; sequence omits the final interval. COSTUMES remains accepted as a
 * compatibility alias for projects saved with the earlier block.
 */
export class AnimatedAssetManagerExtension extends AssetManagerExtension {
  private readonly actorAnimations = new Map<string, AnimationState>();
  private animationGeneration = 0;

  constructor() {
    super();
    const stopAll = () => this.stopAllActorAnimations();
    const stopTarget = (target?: TurboWarpTarget) => {
      if (target) this.stopTarget(target);
    };
    Scratch.vm.runtime.on?.('PROJECT_STOP_ALL', stopAll);
    Scratch.vm.runtime.on?.('PROJECT_START', stopAll);
    Scratch.vm.runtime.on?.('STOP_FOR_TARGET', stopTarget);
    Scratch.vm.runtime.on?.('RUNTIME_DISPOSED', stopAll);
  }

  async setThisSpriteSkin(args: BlockArgs, util: ScratchBlockUtility): Promise<void> {
    this.stopTarget(util.target);
    await super.setThisSpriteSkin(args, util);
  }

  async setSpriteSkin(args: BlockArgs, util?: ScratchBlockUtility): Promise<void> {
    const actor = this.requireActorName(args.ACTOR ?? args.SPRITE);
    const target = this.resolveActorTarget(actor, util);
    this.stopActor(actor);
    await this.applyAssetToTarget(target, args.NAME, util);
  }

  startActorLoop(args: BlockArgs, util?: ScratchBlockUtility): void {
    const actor = this.requireActorName(args.ACTOR);
    const target = this.resolveActorTarget(actor, util);
    const assets = this.getAnimationAssetsInput(args);

    // An empty asset list is the DSL-compatible reset form: action=Actor:loop:
    if (!assets.text) {
      if (normalizeName(args.DURATIONS)) {
        throw new Error(`DURATIONS must be empty when ${assets.argumentName} is empty.`);
      }
      this.stopActor(actor);
      return;
    }

    this.startActorAnimation(
      actor,
      target,
      this.parseAnimation(assets.text, args.DURATIONS, assets.argumentName, 'loop')
    );
  }

  startActorSequence(args: BlockArgs, util?: ScratchBlockUtility): void {
    const actor = this.requireActorName(args.ACTOR);
    const target = this.resolveActorTarget(actor, util);
    const assets = this.getAnimationAssetsInput(args);
    if (!assets.text) throw new Error(`${assets.argumentName} is empty.`);
    this.startActorAnimation(
      actor,
      target,
      this.parseAnimation(assets.text, args.DURATIONS, assets.argumentName, 'sequence')
    );
  }

  stopActorAnimation(args: BlockArgs, util?: ScratchBlockUtility): void {
    const actor = this.requireActorName(args.ACTOR);
    this.resolveActorTarget(actor, util);
    this.stopActor(actor);
  }

  async finishAllActorSequences(): Promise<void> {
    const pending: Array<Promise<void>> = [];
    for (const [actor, state] of [...this.actorAnimations]) {
      if (state.mode !== 'sequence') continue;
      const finalImage = [...state.actions].reverse().find((action) => action.kind === 'image');
      this.stopActor(actor);
      if (!finalImage || !this.runtime.targets.includes(state.target)) continue;
      pending.push(this.resolveSkin(finalImage.assetName).then((skin) => {
        if (this.runtime.targets.includes(state.target)) this.applySkinToTarget(state.target, skin);
      }));
    }
    await Promise.all(pending);
  }

  deleteAllMemoryAssets(): void {
    this.stopAllActorAnimations();
    super.deleteAllMemoryAssets();
  }

  private getAnimationAssetsInput(args: BlockArgs): AnimationAssetsInput {
    if (args.ASSETS !== undefined) {
      return {text: normalizeName(args.ASSETS), argumentName: 'ASSETS'};
    }
    return {text: normalizeName(args.COSTUMES), argumentName: 'COSTUMES'};
  }

  private requireActorName(value: unknown): string {
    const actor = normalizeName(value);
    if (!actor) throw new Error('Actor name is empty.');
    return actor;
  }

  private resolveActorTarget(actor: string, util?: ScratchBlockUtility): TurboWarpTarget {
    const matches = this.runtime.targets.filter(
      (target) => !target.isStage && target.sprite?.name === actor
    );
    if (matches.length > 1) {
      throw new Error(`Actor name is not unique: ${actor}`);
    }
    const invokingTarget = util?.target;
    if (invokingTarget && !invokingTarget.isStage && invokingTarget.sprite?.name === actor) {
      return invokingTarget;
    }
    const target = matches[0] ?? this.findTargetByName(actor);
    if (!target) throw new Error(`Actor not found: ${actor}`);
    return target;
  }

  private parseAnimation(
    assetsValue: unknown,
    durationsValue: unknown,
    argumentName: 'ASSETS' | 'COSTUMES',
    mode: AnimationMode
  ): AnimationDefinition {
    const assetNames = String(assetsValue ?? '').split(',').map((value) => value.trim());
    const durationsText = normalizeName(durationsValue);
    const durationTexts = durationsText
      ? durationsText.split(',').map((value) => value.trim())
      : [];

    if (assetNames.some((name) => !name)) {
      throw new Error(`${argumentName} contains an empty item.`);
    }
    if (durationTexts.some((duration) => !duration)) {
      throw new Error('DURATIONS contains an empty item.');
    }
    const expectedDurationCount = mode === 'loop' ? assetNames.length : assetNames.length - 1;
    if (durationTexts.length !== expectedDurationCount) {
      throw new Error(
        `${mode} requires ${expectedDurationCount} DURATIONS items for ${assetNames.length} ` +
        `${argumentName} items, but received ${durationTexts.length}.`
      );
    }

    const intervalsMs = durationTexts.map((duration, index) => {
      const seconds = Number(duration);
      if (!Number.isFinite(seconds) || seconds < 0) {
        throw new Error(`DURATIONS item ${index + 1} must be a non-negative number: ${duration}`);
      }
      return seconds * 1000;
    });
    if (mode === 'loop' && !intervalsMs.some((durationMs) => durationMs > 0)) {
      throw new Error('DURATIONS for loop must contain at least one positive number.');
    }

    return {
      actions: assetNames.map((assetName) => this.createAnimationAction(assetName)),
      intervalsMs,
      mode
    };
  }

  private startActorAnimation(
    actor: string,
    target: TurboWarpTarget,
    definition: AnimationDefinition
  ): void {
    this.stopActor(actor);
    const state: AnimationState = {
      ...definition,
      actor,
      target,
      actionIndex: 0,
      deadline: performance.now(),
      timer: null,
      generation: ++this.animationGeneration
    };
    this.actorAnimations.set(actor, state);
    void this.showCurrentStep(actor, state);
  }

  private createAnimationAction(assetName: string): AnimationAction {
    if (!this.isLoaded({NAME: assetName})) {
      throw new Error(`Asset is not registered: ${assetName}`);
    }
    const mimeType = this.getAssetMimeType({NAME: assetName});
    if (mimeType.startsWith('image/')) return {assetName, kind: 'image'};
    if (mimeType.startsWith('audio/')) return {assetName, kind: 'audio'};
    throw new Error(`Asset is neither image nor audio: ${assetName} (${mimeType || 'unknown MIME type'})`);
  }

  private async showCurrentStep(actor: string, state: AnimationState): Promise<void> {
    if (!this.isCurrent(actor, state)) return;
    const target = state.target;
    if (!this.runtime.targets.includes(target)) {
      this.stopActor(actor);
      return;
    }

    const batch = this.getCurrentBatch(state);
    if (!batch) {
      this.stopActor(actor);
      return;
    }

    try {
      let selectedImageIndex = -1;
      for (let index = 0; index < batch.actions.length; index += 1) {
        if (batch.actions[index]?.kind === 'image') {
          selectedImageIndex = index;
        }
      }
      const selectedImage = batch.actions[selectedImageIndex];
      const selectedSkin = await (
        selectedImage ? this.resolveSkin(selectedImage.assetName) : Promise.resolve(null)
      );
      if (!this.isCurrent(actor, state)) return;
      if (!this.runtime.targets.includes(target)) {
        this.stopActor(actor);
        return;
      }

      const soundStarts: Promise<void>[] = [];
      for (let index = 0; index < batch.actions.length; index += 1) {
        const action = batch.actions[index];
        if (!action) continue;
        if (action.kind === 'audio') {
          soundStarts.push(this.playResolvedSound(action.assetName, false));
        } else if (index === selectedImageIndex && selectedSkin) {
          this.applySkinToTarget(target, selectedSkin);
        }
      }
      await Promise.all(soundStarts);
    } catch (error) {
      this.stopActor(actor);
      const assetNames = batch.actions.map((action) => action.assetName).join(', ');
      console.error(
        `Failed to run actor "${target.sprite?.name ?? target.id}" actions "${assetNames}".`,
        error
      );
      return;
    }

    if (!this.isCurrent(actor, state)) return;
    const intervalMs = batch.intervalMs;
    const nextActionIndex = batch.nextActionIndex;
    if (intervalMs === null || nextActionIndex === null) {
      this.actorAnimations.delete(actor);
      return;
    }
    state.deadline += intervalMs;
    const now = performance.now();
    if (state.deadline <= now) {
      state.deadline = now + intervalMs;
    }
    const delay = state.deadline - now;
    state.timer = setTimeout(() => this.advance(actor, state, nextActionIndex), delay);
  }

  private getCurrentBatch(state: AnimationState): AnimationBatch | null {
    if (!state.actions[state.actionIndex]) return null;
    const actions: AnimationAction[] = [];
    let actionIndex = state.actionIndex;

    for (let count = 0; count < state.actions.length; count += 1) {
      const action = state.actions[actionIndex];
      if (!action) return null;
      actions.push(action);

      const intervalMs = state.intervalsMs[actionIndex];
      if (intervalMs === undefined) {
        return {actions, intervalMs: null, nextActionIndex: null};
      }
      const nextActionIndex = (actionIndex + 1) % state.actions.length;
      if (intervalMs > 0) {
        return {actions, intervalMs, nextActionIndex};
      }
      actionIndex = nextActionIndex;
    }
    return null;
  }

  private advance(actor: string, state: AnimationState, nextActionIndex: number): void {
    if (!this.isCurrent(actor, state)) return;
    state.timer = null;
    state.actionIndex = nextActionIndex;
    void this.showCurrentStep(actor, state);
  }

  private isCurrent(actor: string, state: AnimationState): boolean {
    return this.actorAnimations.get(actor)?.generation === state.generation;
  }

  private stopActor(actor: string): void {
    const state = this.actorAnimations.get(actor);
    if (!state) return;
    this.actorAnimations.delete(actor);
    if (state.timer !== null) clearTimeout(state.timer);
  }

  private stopTarget(target: TurboWarpTarget): void {
    for (const [actor, state] of this.actorAnimations) {
      if (state.target === target) this.stopActor(actor);
    }
  }

  private stopAllActorAnimations(): void {
    for (const actor of [...this.actorAnimations.keys()]) this.stopActor(actor);
  }
}
