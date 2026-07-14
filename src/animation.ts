import {AssetManagerExtension, normalizeName} from './extension.js';

type BlockArgs = Record<string, unknown>;
type AnimationMode = 'loop' | 'sequence';

interface AnimationDefinition {
  assetNames: string[];
  durationsMs: number[];
}

interface AnimationState extends AnimationDefinition {
  mode: AnimationMode;
  frameIndex: number;
  deadline: number;
  timer: ReturnType<typeof setTimeout> | null;
  generation: number;
}

/**
 * Asset Manager with actor-level background costume animation.
 *
 * ACTOR is resolved using the existing named-sprite behaviour of setSpriteSkin.
 * COSTUMES and DURATIONS are comma-separated strings. COSTUMES contains
 * registered image asset names and DURATIONS contains positive seconds.
 */
export class AnimatedAssetManagerExtension extends AssetManagerExtension {
  private readonly actorAnimations = new Map<TurboWarpTarget, AnimationState>();
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
    this.stopTarget(target);
    this.applySkinToTarget(target, await this.resolveSkin(args.NAME));
  }

  startActorLoop(args: BlockArgs, util?: ScratchBlockUtility): void {
    const actor = this.requireActorName(args.ACTOR);
    const target = this.resolveActorTarget(actor, util);
    const costumesText = normalizeName(args.COSTUMES);

    // An empty costume list is the DSL-compatible reset form: action=Actor:loop:
    if (!costumesText) {
      if (normalizeName(args.DURATIONS)) {
        throw new Error('DURATIONS must be empty when COSTUMES is empty.');
      }
      this.stopTarget(target);
      return;
    }

    this.startActorAnimation(target, this.parseAnimation(costumesText, args.DURATIONS), 'loop');
  }

  startActorSequence(args: BlockArgs, util?: ScratchBlockUtility): void {
    const actor = this.requireActorName(args.ACTOR);
    const target = this.resolveActorTarget(actor, util);
    const costumesText = normalizeName(args.COSTUMES);
    if (!costumesText) throw new Error('COSTUMES is empty.');
    this.startActorAnimation(target, this.parseAnimation(costumesText, args.DURATIONS), 'sequence');
  }

  stopActorAnimation(args: BlockArgs, util?: ScratchBlockUtility): void {
    const actor = this.requireActorName(args.ACTOR);
    this.stopTarget(this.resolveActorTarget(actor, util));
  }

  deleteAllMemoryAssets(): void {
    this.stopAllActorAnimations();
    super.deleteAllMemoryAssets();
  }

  private requireActorName(value: unknown): string {
    const actor = normalizeName(value);
    if (!actor) throw new Error('Actor name is empty.');
    return actor;
  }

  private resolveActorTarget(actor: string, util?: ScratchBlockUtility): TurboWarpTarget {
    const invokingTarget = util?.target;
    if (invokingTarget && !invokingTarget.isStage && invokingTarget.sprite?.name === actor) {
      return invokingTarget;
    }
    const target = this.findTargetByName(actor);
    if (!target) throw new Error(`Actor not found: ${actor}`);
    return target;
  }

  private parseAnimation(costumesValue: unknown, durationsValue: unknown): AnimationDefinition {
    const assetNames = String(costumesValue ?? '').split(',').map((value) => value.trim());
    const durationTexts = String(durationsValue ?? '').split(',').map((value) => value.trim());

    if (assetNames.some((name) => !name)) {
      throw new Error('COSTUMES contains an empty item.');
    }
    if (durationTexts.some((duration) => !duration)) {
      throw new Error('DURATIONS contains an empty item.');
    }
    if (assetNames.length !== durationTexts.length) {
      throw new Error(
        `COSTUMES and DURATIONS must contain the same number of items ` +
        `(${assetNames.length} costumes, ${durationTexts.length} durations).`
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
    target: TurboWarpTarget,
    definition: AnimationDefinition,
    mode: AnimationMode
  ): void {
    this.validateAnimationAssets(definition);
    this.stopTarget(target);
    const state: AnimationState = {
      ...definition,
      mode,
      frameIndex: 0,
      deadline: performance.now(),
      timer: null,
      generation: ++this.animationGeneration
    };
    this.actorAnimations.set(target, state);
    void this.showCurrentFrame(target, state);
  }

  private validateAnimationAssets(definition: AnimationDefinition): void {
    for (const assetName of definition.assetNames) {
      if (!this.isLoaded({NAME: assetName})) {
        throw new Error(`Costume asset is not registered: ${assetName}`);
      }
      const mimeType = this.getAssetMimeType({NAME: assetName});
      if (!mimeType.startsWith('image/')) {
        throw new Error(`Asset is not an image: ${assetName}`);
      }
    }
  }

  private async showCurrentFrame(target: TurboWarpTarget, state: AnimationState): Promise<void> {
    if (!this.isCurrent(target, state)) return;
    if (!this.runtime.targets.includes(target)) {
      this.stopTarget(target);
      return;
    }

    const assetName = state.assetNames[state.frameIndex];
    const durationMs = state.durationsMs[state.frameIndex];
    if (assetName === undefined || durationMs === undefined) {
      this.stopTarget(target);
      return;
    }

    try {
      this.applySkinToTarget(target, await this.resolveSkin(assetName));
    } catch (error) {
      this.stopTarget(target);
      console.error(`Failed to animate actor "${target.sprite?.name ?? target.id}" with asset "${assetName}".`, error);
      return;
    }

    if (!this.isCurrent(target, state)) return;
    state.deadline += durationMs;
    const delay = Math.max(0, state.deadline - performance.now());
    state.timer = setTimeout(() => this.advance(target, state), delay);
  }

  private advance(target: TurboWarpTarget, state: AnimationState): void {
    if (!this.isCurrent(target, state)) return;
    state.timer = null;
    state.frameIndex += 1;

    if (state.frameIndex >= state.assetNames.length) {
      if (state.mode === 'loop') {
        state.frameIndex = 0;
      } else {
        this.actorAnimations.delete(target);
        return;
      }
    }

    void this.showCurrentFrame(target, state);
  }

  private isCurrent(target: TurboWarpTarget, state: AnimationState): boolean {
    return this.actorAnimations.get(target)?.generation === state.generation;
  }

  private stopTarget(target: TurboWarpTarget): void {
    const state = this.actorAnimations.get(target);
    if (!state) return;
    this.actorAnimations.delete(target);
    if (state.timer !== null) clearTimeout(state.timer);
  }

  private stopAllActorAnimations(): void {
    for (const target of [...this.actorAnimations.keys()]) this.stopTarget(target);
  }
}
