import { type AssetManagerFeatureFlags } from './feature-flags.js';
import { type BinaryBundleKeyInput, type BinaryBundleOperationOptions, type BinaryBundlePutInput, type BinaryBundleRegistration, type BinaryBundleResult, type BinaryBundleStoreOptions } from './binary-bundle-store.js';
import { type VerifiedRemoteBinaryCacheOptions, type VerifiedRemoteBinaryInput, type VerifiedRemoteBinaryResolveOptions, type VerifiedRemoteBinaryResult, type VerifiedRemoteCachePruneResult, type VerifiedRemoteCacheStats, type VerifiedRemoteStoryCacheDeleteResult, type VerifiedRemoteStoryCacheInfo, type VerifiedRemoteStoryCachePruneResult } from './verified-remote-cache.js';
import { type SessionBinaryBacking, type SessionBinaryBackingInput, type SessionBinaryBackingOptions } from './session-binary-backing.js';
import { type DOMImageResource } from './dom-image-resource.js';
export { type AssetManagerAudioVoice, type AssetManagerAudioVoiceOptions } from './audio-voice.js';
import { type AssetManagerAudioVoice, type AssetManagerAudioVoiceOptions } from './audio-voice.js';
export { type DOMImageResource } from './dom-image-resource.js';
export { createBinaryBundleStore, type BinaryBundleFileInput, type BinaryBundleFileRegistration, type BinaryBundleFileResult, type BinaryBundleKeyInput, type BinaryBundleOperationOptions, type BinaryBundlePutInput, type BinaryBundleRegistration, type BinaryBundleResult, type BinaryBundleStore, type BinaryBundleStoreOptions } from './binary-bundle-store.js';
export { createVerifiedRemoteBinaryCache, createVerifiedRemoteCacheDatabaseName, type NormalizedVerifiedRemoteBinaryInput, type VerifiedRemoteBinaryCache, type VerifiedRemoteBinaryCacheOptions, type VerifiedRemoteBinaryInput, type VerifiedRemoteBinaryLoadResult, type VerifiedRemoteBinaryResolveOptions, type VerifiedRemoteBinaryResult, type VerifiedRemoteCacheWarning, type VerifiedRemoteCacheIdentity, type VerifiedRemoteCacheIdentityInput, type VerifiedRemoteCachePruneResult, type VerifiedRemoteCacheStats, type VerifiedRemoteStoryCacheDeleteResult, type VerifiedRemoteStoryCacheInfo, type VerifiedRemoteStoryCachePruneResult } from './verified-remote-cache.js';
export { createSessionBinaryBacking, type SessionBinaryBacking, type SessionBinaryBackingAssetInput, type SessionBinaryBackingInput, type SessionBinaryBackingMode, type SessionBinaryBackingOptions, type SessionBinaryBackingPolicy, type SessionBinaryBackingSource, type SessionBinaryBackingSourceAsset, type SessionBinaryBackingWarning } from './session-binary-backing.js';
export interface EmbeddedAssetBytesInput {
    name: unknown;
    nameMode?: AssetNameMode;
    bytes: ArrayBuffer | Uint8Array;
    mimeType: unknown;
    sourceName?: unknown;
    bitmapResolution?: 1 | 2;
}
export interface EmbeddedAssetRegistration {
    readonly name: string;
    readonly mimeType: string;
}
export type AssetNameMode = 'trimmed' | 'literal';
export type ProjectAssetLocator = Readonly<{
    kind: 'backdrop';
    name: string;
}> | Readonly<{
    kind: 'costume';
    target: string;
    name: string;
}> | Readonly<{
    kind: 'sound';
    name: string;
    target?: string;
}>;
export type ProjectAssetRegistrationInput = Readonly<{
    name: unknown;
    nameMode?: AssetNameMode;
    resourceId: unknown;
    locator?: never;
}> | Readonly<{
    name: unknown;
    nameMode?: AssetNameMode;
    locator: ProjectAssetLocator;
    resourceId?: never;
}>;
export interface AssetManagerCompositionTarget {
    readonly id: string;
    readonly isStage: boolean;
}
export interface DOMImageResourceTarget {
    readonly namespaceURI?: string | null;
    readonly localName?: string;
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
}
export interface DOMImageResourceBindingOptions {
    readonly attribute?: 'href' | 'src';
    readonly owner?: AssetManagerCompositionTarget;
}
export interface AssetManagerCompositionOptions {
    readonly verifiedRemoteCache?: VerifiedRemoteBinaryCacheOptions;
    readonly binaryBundleStore?: BinaryBundleStoreOptions;
    readonly sessionBinaryBacking?: SessionBinaryBackingOptions;
}
export interface AssetManagerComposition {
    registerProjectAsset(input: ProjectAssetRegistrationInput): Promise<EmbeddedAssetRegistration>;
    registerEmbeddedAsset(input: EmbeddedAssetBytesInput): Promise<EmbeddedAssetRegistration>;
    releaseAsset(name: unknown): void;
    releaseAll(): void;
    isRegistered(name: unknown): boolean;
    getMimeType(name: unknown): string;
    resolveDOMImageResource(name: unknown): Promise<DOMImageResource>;
    applyDOMImageResource(name: unknown, target: DOMImageResourceTarget, options?: DOMImageResourceBindingOptions): Promise<DOMImageResource>;
    releaseDOMImageResource(target: DOMImageResourceTarget): void;
    releaseAllDOMImageResources(): void;
    applyToStage(name: unknown): Promise<void>;
    applyToTarget(name: unknown, target: AssetManagerCompositionTarget): Promise<void>;
    playSound(name: unknown, options?: Readonly<{
        untilDone?: boolean;
    }>): Promise<void>;
    createAudioVoice(name: unknown, options?: AssetManagerAudioVoiceOptions): Promise<AssetManagerAudioVoice>;
    stopSound(name: unknown): void;
    stopAllSounds(): void;
    resolveVerifiedRemoteBinary(input: VerifiedRemoteBinaryInput, options: VerifiedRemoteBinaryResolveOptions): Promise<VerifiedRemoteBinaryResult>;
    getVerifiedRemoteCacheStats(): Promise<VerifiedRemoteCacheStats>;
    pruneVerifiedRemoteCache(): Promise<VerifiedRemoteCachePruneResult>;
    clearVerifiedRemoteCache(): Promise<VerifiedRemoteCachePruneResult>;
    listVerifiedRemoteStoryCaches(): Promise<ReadonlyArray<VerifiedRemoteStoryCacheInfo>>;
    pruneVerifiedRemoteStoryCaches(): Promise<VerifiedRemoteStoryCachePruneResult>;
    deleteVerifiedRemoteStoryCache(databaseName: unknown): Promise<VerifiedRemoteStoryCacheDeleteResult>;
    renewVerifiedRemoteStoryCacheLease(): Promise<void>;
    releaseVerifiedRemoteStoryCacheLease(): Promise<void>;
    putBinaryBundle(input: BinaryBundlePutInput, options?: BinaryBundleOperationOptions): Promise<BinaryBundleRegistration>;
    getBinaryBundle(input: BinaryBundleKeyInput, options?: BinaryBundleOperationOptions): Promise<BinaryBundleResult>;
    deleteBinaryBundle(input: BinaryBundleKeyInput, options?: BinaryBundleOperationOptions): Promise<void>;
    releaseBinaryStore(): Promise<void>;
    createSessionBinaryBacking(input: SessionBinaryBackingInput, options?: BinaryBundleOperationOptions): Promise<SessionBinaryBacking>;
}
export declare function createAssetManagerComposition(featureFlags?: AssetManagerFeatureFlags, options?: AssetManagerCompositionOptions): AssetManagerComposition;
