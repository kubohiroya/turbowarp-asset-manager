import { AssetManagerError } from './asset-manager-error.js';
import { type AssetManagerFeatureFlags } from './feature-flags.js';
export declare const EXTENSION_ID = "kubohiroyaassetmanager";
export declare const EXTENSION_VERSION = "0.7.0";
export declare const EXTENSION_DOCS_URI = "https://kubohiroya.github.io/turbowarp-asset-manager/";
type BlockArgs = Record<string, unknown>;
export type AssetKind = 'external' | 'costume' | 'backdrop' | 'sound' | 'text';
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
interface ResolvedSkin {
    skinId: number;
    sourceSize: number | null;
}
export type ParsedResourceIdentifier = {
    kind: 'cache';
} | {
    kind: 'external';
    url: string;
} | {
    kind: 'costume';
    spriteName: string;
    costumeName: string | null;
} | {
    kind: 'backdrop';
    backdropName: string;
} | {
    kind: 'sound';
    spriteName: string;
    soundName: string;
} | {
    kind: 'text';
    runtimeVariableName: string;
};
export type ProjectAssetAddressValidation = {
    ok: true;
    kind: ParsedResourceIdentifier['kind'];
    projectLocal: boolean;
} | {
    ok: false;
    type: string;
    label: string;
    message: string;
};
export declare function normalizeName(value: unknown): string;
export declare function guessMimeType(value: unknown): string;
export declare function normalizeMimeType(mimeType: unknown, urlOrName: unknown): string;
export declare function parseResourceIdentifier(value: unknown, fallbackAssetName?: unknown): ParsedResourceIdentifier;
export declare function validateProjectAssetAddress(runtime: TurboWarpRuntime, assetName: unknown, resourceIdentifier: unknown): ProjectAssetAddressValidation;
export declare class AssetManagerExtension {
    protected readonly runtime: TurboWarpRuntime;
    private readonly renderer;
    private readonly externalAssets;
    private readonly costumeAssets;
    private readonly soundAssets;
    private readonly textAssets;
    private readonly assetRegistry;
    private readonly displayedAssets;
    private readonly playingAudio;
    private readonly registrationVersions;
    private readonly successfulRegistrationVersions;
    private readonly registrationCancellationVersions;
    private readonly registrationCommits;
    private readonly committedCacheRecords;
    protected readonly featureFlags: AssetManagerFeatureFlags;
    private loadingBackdropName;
    private loadingCostumes?;
    private loadingAssetCountValue?;
    private lastAssetErrorType;
    private lastAssetErrorLabel;
    private assetErrorVersion;
    constructor(featureFlags?: AssetManagerFeatureFlags);
    setLoadingBackdrop(args: BlockArgs): void;
    setLoadingCostumes(args: BlockArgs): void;
    prepareLoadingAssets(args: BlockArgs, util: ScratchBlockUtility): void;
    loadingAssetCount(): number;
    loadingBackdrop(): string;
    loadingCostumeAt(args: BlockArgs): string;
    getInfo(): {
        id: string;
        name: string;
        docsURI: string;
        color1: string;
        color2: string;
        color3: string;
        blocks: Record<string, unknown>[];
    };
    validateProjectAssetAddress(args: BlockArgs): string;
    registerAsset(args: BlockArgs): Promise<void>;
    registerEmbeddedAsset(input: EmbeddedAssetBytesInput): Promise<EmbeddedAssetRegistration>;
    assetErrorType(): string;
    assetErrorLabel(): string;
    /** Legacy opcode retained for existing projects. */
    loadAsset(args: BlockArgs): Promise<void>;
    deleteMemoryAsset(args: BlockArgs): void;
    deleteAllMemoryAssets(): void;
    deleteCachedAsset(args: BlockArgs): Promise<void>;
    deleteAllCachedAssets(): Promise<void>;
    isLoaded(args: BlockArgs): boolean;
    setThisSpriteSkin(args: BlockArgs, util: ScratchBlockUtility): Promise<void>;
    setSpriteSkin(args: BlockArgs, util?: ScratchBlockUtility): Promise<void>;
    setStageSkin(args: BlockArgs): Promise<void>;
    playSound(args: BlockArgs): Promise<void>;
    playSoundUntilDone(args: BlockArgs): Promise<void>;
    stopSound(args: BlockArgs): void;
    stopAllSounds(): void;
    getAssetMimeType(args: BlockArgs): string;
    getVersion(): string;
    setTextValue(args: BlockArgs): Promise<void>;
    setTextStyle(args: BlockArgs): void;
    protected assetNotRegistered(operation: string, name: string): AssetManagerError;
    protected assetTypeMismatch(operation: string, name: string, expectedKind: string, actualKind: string): AssetManagerError;
    private toScratchBlock;
    private requireAssetName;
    private requireTextAssetName;
    private clearAssetError;
    private beginRegistration;
    private cancelRegistrations;
    private isRegistrationCancellationCurrent;
    private registerExternalAsset;
    private registerCostumeReference;
    private registerBackdropReference;
    private registerSoundReference;
    private registerTextReference;
    private unregisterAsset;
    private commitPreparedAsset;
    private commitPreparedAssetNow;
    private assertReplacementKind;
    private replaceRegisteredAsset;
    private getRegisteredAsset;
    private installRegisteredAsset;
    private removeRegisteredAsset;
    private disposeRegisteredAsset;
    private externalMediaKind;
    private openDatabase;
    private transaction;
    private cacheGet;
    private cachePut;
    private cacheDelete;
    private cacheClear;
    private restoreCacheIfGeneration;
    private fetchExternalAsset;
    private getStageTarget;
    protected findTargetByName(name: string): TurboWarpTarget | null;
    private resolveReferencedTarget;
    private findCostume;
    private findSound;
    protected resolveSkin(value: unknown): Promise<ResolvedSkin>;
    protected applyAssetToTarget(target: TurboWarpTarget, value: unknown, util?: ScratchBlockUtility): Promise<void>;
    protected setDisplayBinding(target: TurboWarpTarget, name: string, kind: AssetKind, skinId?: number): void;
    private isDisplayBindingCurrent;
    protected applyResolvedSkinToTarget(target: TurboWarpTarget, name: string, skin: ResolvedSkin): void;
    private applyTextToTarget;
    private applyTextReferenceToTarget;
    private requireTemporaryVariables;
    private setRuntimeVariable;
    private requireAnimatedTextOpcode;
    private ensureExternalSkin;
    private ensureExternalAssetSkin;
    private resolveSkinFromAsset;
    private resolveCostumeReference;
    private resolveCostumeAssetReference;
    private resolveSoundReference;
    private deleteOwnedSkinIfExists;
    protected applySkinToTarget(target: TurboWarpTarget, skin: ResolvedSkin): void;
    protected playResolvedSound(value: unknown, waitUntilDone: boolean): Promise<void>;
    private playExternalSound;
    private stopExternalAudio;
    private playProjectSound;
    private playbackError;
    private projectAssetMimeType;
}
export {};
