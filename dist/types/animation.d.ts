import { AssetManagerExtension } from './extension.js';
import { type AssetManagerFeatureFlags } from './feature-flags.js';
type BlockArgs = Record<string, unknown>;
/**
 * Asset Manager with actor-level background asset animation.
 *
 * ACTOR is resolved from a clone-local actorName variable before falling back
 * to the existing named-sprite behaviour of setSpriteSkin.
 * ASSETS and DURATIONS are comma-separated strings. ASSETS contains registered
 * image or audio asset names. Each duration is the interval before the next
 * action, and a zero groups those adjacent actions. Loop has one interval per
 * action; sequence omits the final interval. COSTUMES remains accepted as a
 * compatibility alias for projects saved with the earlier block.
 */
export declare class AnimatedAssetManagerExtension extends AssetManagerExtension {
    private readonly actorAnimations;
    private animationGeneration;
    constructor(featureFlags?: AssetManagerFeatureFlags);
    setThisSpriteSkin(args: BlockArgs, util: ScratchBlockUtility): Promise<void>;
    setSpriteSkin(args: BlockArgs, util?: ScratchBlockUtility): Promise<void>;
    startActorLoop(args: BlockArgs, util?: ScratchBlockUtility): void;
    startActorSequence(args: BlockArgs, util?: ScratchBlockUtility): void;
    stopActorAnimation(args: BlockArgs, util?: ScratchBlockUtility): void;
    finishAllActorSequences(): Promise<void>;
    deleteAllMemoryAssets(): void;
    private getAnimationAssetsInput;
    private requireActorName;
    private actorNameOf;
    private resolveActorTarget;
    private parseAnimation;
    private startActorAnimation;
    private createAnimationAction;
    private showCurrentStep;
    private getCurrentBatch;
    private advance;
    private isCurrent;
    private stopActor;
    private stopTarget;
    private stopAllActorAnimations;
}
export {};
