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
}
export interface BinaryBundleStore {
    put(input: BinaryBundlePutInput, options?: BinaryBundleOperationOptions): Promise<BinaryBundleRegistration>;
    get(input: BinaryBundleKeyInput, options?: BinaryBundleOperationOptions): Promise<BinaryBundleResult>;
    delete(input: BinaryBundleKeyInput, options?: BinaryBundleOperationOptions): Promise<void>;
    release(): Promise<void>;
}
/**
 * Create a block-free, versioned IndexedDB store for atomic binary bundles.
 *
 * The store owns no long-lived application reference to input bytes. IndexedDB receives one
 * structured-cloned bundle record, and success is published only after the containing transaction
 * completes.
 */
export declare function createBinaryBundleStore(options?: BinaryBundleStoreOptions): BinaryBundleStore;
