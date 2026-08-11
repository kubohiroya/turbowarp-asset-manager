import { type BinaryBundleFileInput, type BinaryBundleFileRegistration, type BinaryBundleKeyInput, type BinaryBundleOperationOptions, type BinaryBundleResult } from './binary-bundle-store.js';
export type SessionBinaryBackingPolicy = 'prefer' | 'required' | 'disabled';
export type SessionBinaryBackingMode = 'session' | 'direct';
export interface SessionBinaryBackingAssetInput extends BinaryBundleKeyInput {
    readonly files: ReadonlyArray<BinaryBundleFileRegistration>;
}
export interface SessionBinaryBackingSourceAsset extends BinaryBundleKeyInput {
    readonly files: ReadonlyArray<BinaryBundleFileInput>;
}
export interface SessionBinaryBackingSource {
    read(asset: SessionBinaryBackingAssetInput, options?: BinaryBundleOperationOptions): Promise<SessionBinaryBackingSourceAsset>;
    release(): Promise<void> | void;
}
export interface SessionBinaryBackingWarning {
    readonly code: 'ASSET_SESSION_BINARY_DIRECT_FALLBACK';
    readonly causeCode: string;
}
export interface SessionBinaryBackingInput {
    readonly policy: unknown;
    readonly sessionId: unknown;
    readonly assets: ReadonlyArray<SessionBinaryBackingAssetInput>;
    readonly source: SessionBinaryBackingSource;
    readonly onFatalError?: (error: Error) => void;
}
export interface SessionBinaryBackingOptions {
    readonly indexedDB?: IDBFactory;
    readonly subtleCrypto?: SubtleCrypto;
    readonly databaseName?: string;
    readonly now?: () => number;
    readonly maxFilesPerAsset?: number;
    readonly maxAssetBytes?: number;
    readonly maxSessionAssets?: number;
    readonly maxSessionBytes?: number;
    readonly leaseTtlMs?: number;
    readonly heartbeatIntervalMs?: number;
    readonly orphanCleanupBatchSize?: number;
}
export interface SessionBinaryBacking {
    readonly sessionId: string;
    readonly mode: SessionBinaryBackingMode;
    readonly warning?: SessionBinaryBackingWarning;
    get(input: BinaryBundleKeyInput, options?: BinaryBundleOperationOptions): Promise<BinaryBundleResult>;
    renewLease(): Promise<void>;
    dispose(): Promise<void>;
}
/**
 * Establish a fixed direct or IndexedDB-backed binary session without changing persistent caches.
 *
 * The source must remain readable until `release` is called. A `prefer` fallback keeps that same
 * source for direct reads; an established session releases it only after every bundle passes
 * commit and integrity read-back.
 */
export declare function createSessionBinaryBacking(inputValue: SessionBinaryBackingInput, optionValue?: SessionBinaryBackingOptions, operationOptions?: BinaryBundleOperationOptions): Promise<SessionBinaryBacking>;
