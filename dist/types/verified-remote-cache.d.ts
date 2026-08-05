export interface VerifiedRemoteBinaryInput {
    readonly url: unknown;
    readonly integrity: unknown;
    readonly size: unknown;
    readonly contentType: unknown;
}
export interface NormalizedVerifiedRemoteBinaryInput {
    readonly url: string;
    readonly integrity: string;
    readonly size: number;
    readonly contentType: string;
}
export interface VerifiedRemoteBinaryLoadResult {
    readonly bytes: ArrayBuffer | Uint8Array;
    readonly contentType: unknown;
}
export interface VerifiedRemoteBinaryResolveOptions {
    readonly load: (input: NormalizedVerifiedRemoteBinaryInput, context: Readonly<{
        signal?: AbortSignal;
    }>) => Promise<VerifiedRemoteBinaryLoadResult>;
    readonly signal?: AbortSignal;
}
export interface VerifiedRemoteBinaryResult {
    readonly bytes: Uint8Array;
    readonly contentType: string;
    readonly integrity: string;
    readonly source: 'indexeddb' | 'network';
    readonly cacheRead: 'hit' | 'miss' | 'invalid' | 'failed';
    readonly cacheWrite: 'not-needed' | 'stored' | 'skipped' | 'failed';
}
export interface VerifiedRemoteCacheStats {
    readonly entries: number;
    readonly bytes: number;
    readonly oldestAccessedAt: number | null;
    readonly newestAccessedAt: number | null;
    readonly highWaterBytes: number;
    readonly lowWaterBytes: number;
}
export interface VerifiedRemoteCachePruneResult {
    readonly removedEntries: number;
    readonly removedBytes: number;
    readonly remainingEntries: number;
    readonly remainingBytes: number;
    readonly highWaterBytes: number;
    readonly lowWaterBytes: number;
}
export interface VerifiedRemoteBinaryCacheOptions {
    readonly indexedDB?: IDBFactory;
    readonly subtleCrypto?: SubtleCrypto;
    readonly estimateStorage?: () => Promise<Readonly<{
        quota?: number;
        usage?: number;
    }>>;
    readonly now?: () => number;
    readonly maxCacheBytes?: number;
    readonly quotaFraction?: number;
    readonly lowWaterRatio?: number;
    readonly ttlMs?: number;
    readonly touchIntervalMs?: number;
    readonly cleanupBatchSize?: number;
}
export interface VerifiedRemoteBinaryCache {
    resolve(input: VerifiedRemoteBinaryInput, options: VerifiedRemoteBinaryResolveOptions): Promise<VerifiedRemoteBinaryResult>;
    getStats(): Promise<VerifiedRemoteCacheStats>;
    prune(): Promise<VerifiedRemoteCachePruneResult>;
    clear(): Promise<VerifiedRemoteCachePruneResult>;
}
export declare function createVerifiedRemoteBinaryCache(options?: VerifiedRemoteBinaryCacheOptions): VerifiedRemoteBinaryCache;
