import { type BinaryStorageBackendPolicy, type OpfsBinaryObjectStoreOptions } from './binary-object-store.js';
export interface BinaryBundleKeyInput {
    readonly namespace: unknown;
    readonly name: unknown;
    readonly integrity: unknown;
}
export interface BinaryBundleFileInput {
    readonly path: unknown;
    readonly size: unknown;
    readonly integrity: unknown;
    readonly bytes: ArrayBuffer | Uint8Array;
}
export interface BinaryBundlePutInput extends BinaryBundleKeyInput {
    readonly files: ReadonlyArray<BinaryBundleFileInput>;
}
export interface BinaryBundleOperationOptions {
    readonly signal?: AbortSignal;
}
export interface BinaryBundleFileRegistration {
    readonly path: string;
    readonly size: number;
    readonly integrity: string;
}
export interface BinaryBundleRegistration {
    readonly namespace: string;
    readonly name: string;
    readonly integrity: string;
    readonly files: ReadonlyArray<BinaryBundleFileRegistration>;
    readonly totalBytes: number;
}
export interface BinaryBundleFileResult extends BinaryBundleFileRegistration {
    readonly bytes: Uint8Array;
}
export interface BinaryBundleResult {
    readonly namespace: string;
    readonly name: string;
    readonly integrity: string;
    readonly files: ReadonlyArray<BinaryBundleFileResult>;
    readonly totalBytes: number;
}
export interface BinaryBundleStoreOptions {
    readonly indexedDB?: IDBFactory;
    readonly subtleCrypto?: SubtleCrypto;
    readonly databaseName?: string;
    readonly now?: () => number;
    readonly maxFilesPerBundle?: number;
    readonly maxBundleBytes?: number;
    readonly maxStoredBundles?: number;
    readonly maxStoreBytes?: number;
    readonly ttlMs?: number;
    readonly backendPolicy?: BinaryStorageBackendPolicy;
    readonly opfs?: OpfsBinaryObjectStoreOptions;
    readonly opfsMetadataDatabaseName?: string;
    readonly recoveryBatchSize?: number;
}
export interface BinaryBundleBackendWarning {
    readonly code: 'ASSET_BINARY_BACKEND_FALLBACK';
    readonly causeCode: string;
}
export interface BinaryBundleBackendStatus {
    readonly policy: BinaryStorageBackendPolicy;
    readonly selected: 'pending' | 'indexeddb' | 'opfs';
    readonly warning?: BinaryBundleBackendWarning;
}
export interface BinaryBundleStoreStats {
    readonly backend: 'indexeddb' | 'opfs';
    readonly bundles: number;
    readonly logicalBytes: number;
    readonly physicalObjectBytes: number;
    readonly stagingBytes: number;
    readonly orphanBytes: number;
    readonly pendingDeletionBytes: number;
}
export interface BinaryBundlePruneResult {
    readonly removedBundles: number;
    readonly removedBytes: number;
}
export interface BinaryBundleStore {
    put(input: BinaryBundlePutInput, options?: BinaryBundleOperationOptions): Promise<BinaryBundleRegistration>;
    get(input: BinaryBundleKeyInput, options?: BinaryBundleOperationOptions): Promise<BinaryBundleResult>;
    delete(input: BinaryBundleKeyInput, options?: BinaryBundleOperationOptions): Promise<void>;
    touch(input: BinaryBundleKeyInput, options?: BinaryBundleOperationOptions): Promise<void>;
    getStats(): Promise<BinaryBundleStoreStats>;
    prune(): Promise<BinaryBundlePruneResult>;
    clear(): Promise<BinaryBundlePruneResult>;
    getBackendStatus(): BinaryBundleBackendStatus;
    release(): Promise<void>;
}
/**
 * Create a binary bundle store whose backend is selected once, before its first operation.
 * IndexedDB remains the default so existing consumers keep the previous behavior.
 */
export declare function createBinaryBundleStore(options?: BinaryBundleStoreOptions): BinaryBundleStore;
