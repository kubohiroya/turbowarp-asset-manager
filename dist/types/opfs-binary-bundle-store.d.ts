import type { BinaryBundleStore } from './binary-bundle-store.js';
import type { BinaryObjectStore } from './binary-object-store.js';
export interface OpfsBinaryBundleStoreOptions {
    readonly objectStore: BinaryObjectStore;
    readonly indexedDB?: IDBFactory;
    readonly databaseName: string;
    readonly subtleCrypto?: SubtleCrypto;
    readonly now?: () => number;
    readonly maxFilesPerBundle?: number;
    readonly maxBundleBytes?: number;
    readonly maxStoredBundles?: number;
    readonly maxStoreBytes?: number;
    readonly ttlMs?: number;
    readonly recoveryBatchSize?: number;
}
export interface EstablishedOpfsBinaryBundleStore extends BinaryBundleStore {
    establish(): Promise<void>;
}
export declare function createOpfsBinaryBundleStore(options: OpfsBinaryBundleStoreOptions): EstablishedOpfsBinaryBundleStore;
