import {AssetManagerExtension, normalizeName} from './extension.js';

type BlockArgs = Record<string, unknown>;
type AnimationMode = 'loop' | 'sequence';

interface AnimationDefinition {
  assetNames: string[];
  durationsMs: number[];
}

interface AnimationState extends AnimationDefinition {
  actor: string;
  target: TurboWarpTarget;
  mode: AnimationMode;
  frameIndex: number;
  deadline: number;
  timer: ReturnType<typeof setTimeout> | null;
  generation: number;
}

/**
 * Asset Manager with actor-level background asset animation.
 *
 * ACTOR is resolved using the existing named-sprite behaviour of setSpriteSkin.
 * ASSETS and DURATIONS are comma-separated strings. ASSETS contains registered
 * image asset names and DURATIONS contains positive seconds. COSTUMES remains
 * accepted as a compatibility alias for projects saved with the earlier block.
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
    this.applySkinToTarget(target, await this.resolveSkin(args.NAME));
  }

  startActorLoop(args: BlockArgs, util?: ScratchBlockUtility): void {
    const actor = this.requireActorName(args.ACTOR);
    const target = this.resolveActorTarget(actor, util);
    const assetsText = this.getAnimationAssetsText(args);

    // An empty asset list is the DSL-compatible reset form: action=Actor:loop:
    if (!assetsText) {
      if (normalizeName(args.DURATIONS)) {
        throw new Error('DURATIONS must be empty when ASSETS is empty.');
      }
      this.stopActor(actor);
      return;
    }

    this.startActorAnimation(actor, target, this.parseAnimation(assetsText, args.DURATIONS), 'loop');
  }

  startActorSequence(args: BlockArgs, util?: ScratchBlockUtility): void {
    const actor = this.requireActorName(args.ACTOR);
    const target = this.resolveActorTarget(actor, util);
    const assetsText = this.getAnimationAssetsText(args);
    if (!assetsText) throw new Error('ASSETS is empty.');
    this.startActorAnimation(actor, target, this.parseAnimation(assetsText, args.DURATIONS), 'sequence');
  }

  stopActorAnimation(args: BlockArgs, util?: ScratchBlockUtility): void {
    const actor = this.requireActorName(args.ACTOR);
    this.resolveActorTarget(actor, util);
    this.stopActor(actor);
  }

  deleteAllMemoryAssets(): void {
    this.stopAllActorAnimations();
    super.deleteAllMemoryAssets();
  }

  private getAnimationAssetsText(args: BlockArgs): string {
    return normalizeName(args.ASSETS ?? args.COSTUMES);
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

  private parseAnimation(assetsValue: unknown, durationsValue: unknown): AnimationDefinition {
    const assetNames = String(assetsValue ?? '').split(',').map((value) => value.trim());
    const durationTexts = String(durationsValue ?? '').split(',').map((value) => value.trim());

    if (assetNames.some((name) => !name)) {
      throw new Error('ASSETS contains an empty item.');
    }
    if (durationTexts.some((duration) => !duration)) {
      throw new Error('DURATIONS contains an empty item.');
    }
    if (assetNames.length !== durationTexts.length) {
      throw new Error(
        `ASSETS and DURATIONS must contain the same number of items ` +
        `(${assetNames.length} assets, ${durationTexts.length} durations).`
      );
    }

    const durationsMs = durationTexts.map((duration, index) => {
      const seconds = Number(duration);
      if (!Number.isFinite(seconds) || seconds <= 0) {
        throw new Error(`DURATIONS item ${index + 1} must be a positive number: ${duration}`);
      }
      return seconds * 1000;
    });

    return {assetNames, durationsMs};
  }

  private startActorAnimation(
    actor: string,
    target: TurboWarpTarget,
    definition: AnimationDefinition,
    mode: AnimationMode
  ): void {
    this.validateAnimationAssets(definition);
    this.stopActor(actor);
    const state: AnimationState = {
      ...definition,
      actor,
      target,
      mode,
      frameIndex: 0,
      deadline: performance.now(),
      timer: null,
      generation: ++this.animationGeneration
    };
    this.actorAnimations.set(actor, state);
    void this.showCurrentFrame(actor, state);
  }

  private validateAnimationAssets(definition: AnimationDefinition): void {
    for (const assetName of definition.assetNames) {
      if (!this.isLoaded({NAME: assetName})) {
        throw new Error(`Image asset is not registered: ${assetName}`);
      }
      const mimeType = this.getAssetMimeType({NAME: assetName});
      if (!mimeType.startsWith('image/')) {
        throw new Error(`Asset is not an image: ${assetName}`);
      }
    }
  }

  private async showCurrentFrame(actor: string, state: AnimationState): Promise<void> {
    if (!this.isCurrent(actor, state)) return;
    const target = state.target;
    if (!this.runtime.targets.includes(target)) {
      this.stopActor(actor);
      return;
    }

    const assetName = state.assetNames[state.frameIndex];
    const durationMs = state.durationsMs[state.frameIndex];
    if (assetName === undefined || durationMs === undefined) {
      this.stopActor(actor);
      return;
    }

    try {
      this.applySkinToTarget(target, await this.resolveSkin(assetName));
    } catch (error) {
      this.stopActor(actor);
      console.error(`Failed to animate actor "${target.sprite?.name ?? target.id}" with asset "${assetName}".`, error);
      return;
    }

    if (!this.isCurrent(actor, state)) return;
    state.deadline += durationMs;
    const now = performance.now();
    if (state.deadline <= now) {
      state.deadline = now + durationMs;
    }
    const delay = state.deadline - now;
    state.timer = setTimeout(() => this.advance(actor, state), delay);
  }

  private advance(actor: string, state: AnimationState): void {
    if (!this.isCurrent(actor, state)) return;
    state.timer = null;
    state.frameIndex += 1;

    if (state.frameIndex >= state.assetNames.length) {
      if (state.mode === 'loop') {
        state.frameIndex = 0;
      } else {
        this.actorAnimations.delete(actor);
        return;
      }
    }

    void this.showCurrentFrame(actor, state);
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
