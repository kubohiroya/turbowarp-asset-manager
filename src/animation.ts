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
  private readonly actorAnimations = new Map<string, AnimationState>();
  private animationGeneration = 0;

  constructor() {
    super();
    const stopAll = () => this.stopAllActorAnimations();
    Scratch.vm.runtime.on?.('PROJECT_STOP_ALL', stopAll);
    Scratch.vm.runtime.on?.('RUNTIME_DISPOSED', stopAll);
  }

  async setSpriteSkin(args: BlockArgs): Promise<void> {
    const actor = this.requireActorName(args.ACTOR ?? args.SPRITE);
    this.stopActor(actor);
    await super.setSpriteSkin({SPRITE: actor, NAME: args.NAME});
  }

  startActorLoop(args: BlockArgs): void {
    const actor = this.requireActorName(args.ACTOR);
    const costumesText = normalizeName(args.COSTUMES);

    // An empty costume list is the DSL-compatible reset form: action=Actor:loop:
    if (!costumesText) {
      if (normalizeName(args.DURATIONS)) {
        throw new Error('DURATIONS must be empty when COSTUMES is empty.');
      }
      this.stopActor(actor);
      return;
    }

    this.startActorAnimation(actor, this.parseAnimation(costumesText, args.DURATIONS), 'loop');
  }

  startActorSequence(args: BlockArgs): void {
    const actor = this.requireActorName(args.ACTOR);
    const costumesText = normalizeName(args.COSTUMES);
    if (!costumesText) throw new Error('COSTUMES is empty.');
    this.startActorAnimation(actor, this.parseAnimation(costumesText, args.DURATIONS), 'sequence');
  }

  stopActorAnimation(args: BlockArgs): void {
    this.stopActor(this.requireActorName(args.ACTOR));
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
    actor: string,
    definition: AnimationDefinition,
    mode: AnimationMode
  ): void {
    this.stopActor(actor);
    const state: AnimationState = {
      ...definition,
      mode,
      frameIndex: 0,
      deadline: performance.now(),
      timer: null,
      generation: ++this.animationGeneration
    };
    this.actorAnimations.set(actor, state);
    void this.showCurrentFrame(actor, state);
  }

  private async showCurrentFrame(actor: string, state: AnimationState): Promise<void> {
    if (!this.isCurrent(actor, state)) return;

    const assetName = state.assetNames[state.frameIndex];
    const durationMs = state.durationsMs[state.frameIndex];
    if (assetName === undefined || durationMs === undefined) {
      this.stopActor(actor);
      return;
    }

    try {
      // Call the base implementation directly so animation frame changes do not
      // cancel their own animation through the public setSpriteSkin override.
      await super.setSpriteSkin({SPRITE: actor, NAME: assetName});
    } catch (error) {
      this.stopActor(actor);
      console.error(`Failed to animate actor "${actor}" with asset "${assetName}".`, error);
      return;
    }

    if (!this.isCurrent(actor, state)) return;
    state.deadline += durationMs;
    const delay = Math.max(0, state.deadline - performance.now());
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

  private stopAllActorAnimations(): void {
    for (const actor of [...this.actorAnimations.keys()]) this.stopActor(actor);
  }
}
