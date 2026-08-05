import { type AssetManagerFeatureFlags } from './feature-flags.js';
export interface EmbeddedAssetBytesInput {
    name: unknown;
    bytes: ArrayBuffer | Uint8Array;
    mimeType: unknown;
    sourceName?: unknown;
}
export interface EmbeddedAssetRegistration {
    readonly name: string;
    readonly mimeType: string;
}
export interface ProjectAssetRegistrationInput {
    name: unknown;
    resourceId: unknown;
}
export interface AssetManagerCompositionTarget {
    readonly id: string;
    readonly isStage: boolean;
}
export interface AssetManagerComposition {
    registerProjectAsset(input: ProjectAssetRegistrationInput): Promise<EmbeddedAssetRegistration>;
    registerEmbeddedAsset(input: EmbeddedAssetBytesInput): Promise<EmbeddedAssetRegistration>;
    releaseAsset(name: unknown): void;
    releaseAll(): void;
    isRegistered(name: unknown): boolean;
    getMimeType(name: unknown): string;
    applyToStage(name: unknown): Promise<void>;
    applyToTarget(name: unknown, target: AssetManagerCompositionTarget): Promise<void>;
    playSound(name: unknown, options?: Readonly<{
        untilDone?: boolean;
    }>): Promise<void>;
    stopSound(name: unknown): void;
    stopAllSounds(): void;
}
export declare function createAssetManagerComposition(featureFlags?: AssetManagerFeatureFlags): AssetManagerComposition;
