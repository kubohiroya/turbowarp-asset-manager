export type BinaryStorageBackendPolicy = 'indexeddb' | 'opfs-prefer' | 'opfs-required';
export interface BinaryObjectDescriptor {
    readonly key: string;
    readonly size: number;
    readonly integrity: string;
    readonly contentType?: string;
}
export interface BinaryObjectResult extends BinaryObjectDescriptor {
    readonly bytes: Uint8Array;
}
export interface BinaryObjectOperationOptions {
    readonly signal?: AbortSignal;
}
export interface BinaryObjectStoreStats {
    readonly physicalObjectBytes: number;
    readonly stagingBytes: number;
    readonly orphanBytes: number;
    readonly pendingDeletionBytes: number;
}
export interface BinaryObjectStatsOptions extends BinaryObjectOperationOptions {
    readonly referencedKeys?: ReadonlySet<string>;
    readonly pendingDeletionKeys?: ReadonlySet<string>;
}
export interface BinaryObjectStore {
    readonly kind: 'indexeddb' | 'opfs';
    put(descriptor: BinaryObjectDescriptor, source: ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>, options?: BinaryObjectOperationOptions): Promise<void>;
    get(descriptor: BinaryObjectDescriptor, options?: BinaryObjectOperationOptions): Promise<BinaryObjectResult>;
    delete(key: string, options?: BinaryObjectOperationOptions): Promise<void>;
    listOrphans?(options?: {
        readonly limit?: number;
        readonly signal?: AbortSignal;
    }): AsyncIterable<string>;
    cleanupStaging?(options?: {
        readonly limit?: number;
        readonly createdBefore?: number;
        readonly signal?: AbortSignal;
    }): Promise<number>;
    getStats?(options?: BinaryObjectStatsOptions): Promise<BinaryObjectStoreStats>;
    release(): Promise<void>;
}
export interface OpfsStorageManager {
    getDirectory(): Promise<FileSystemDirectoryHandle>;
}
export interface OpfsBinaryObjectStoreOptions {
    readonly rootDirectory?: FileSystemDirectoryHandle;
    readonly storage?: OpfsStorageManager;
    readonly subtleCrypto?: SubtleCrypto;
}
export interface IndexedDBBinaryObjectStoreOptions {
    readonly indexedDB?: IDBFactory;
    readonly databaseName?: string;
    readonly subtleCrypto?: SubtleCrypto;
}
export declare function createOpfsBinaryObjectStore(options?: OpfsBinaryObjectStoreOptions): BinaryObjectStore;
/** IndexedDB adapter for consumers that want the object contract without OPFS. */
export declare function createIndexedDBBinaryObjectStore(options?: IndexedDBBinaryObjectStoreOptions): BinaryObjectStore;
