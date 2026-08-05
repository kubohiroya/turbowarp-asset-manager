import { type VerifiedRemoteStoryCacheDeleteResult, type VerifiedRemoteStoryCacheInfo, type VerifiedRemoteStoryCachePruneResult } from './verified-cache-catalog.js';
export type { VerifiedRemoteStoryCacheDeleteResult, VerifiedRemoteStoryCacheInfo, VerifiedRemoteStoryCachePruneResult } from './verified-cache-catalog.js';
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
    readonly transferOwnership?: boolean;
}
export interface VerifiedRemoteBinaryResolveOptions {
    readonly load: (input: NormalizedVerifiedRemoteBinaryInput, context: Readonly<{
        signal?: AbortSignal;
    }>) => Promise<VerifiedRemoteBinaryLoadResult>;
    readonly signal?: AbortSignal;
}
export interface VerifiedRemoteCacheWarning {
    readonly operation: 'read' | 'write' | 'cleanup';
    readonly code: string;
}
export interface VerifiedRemoteCacheIdentityInput {
    readonly id: unknown;
    readonly label: unknown;
    readonly databaseName?: unknown;
}
export interface VerifiedRemoteCacheIdentity {
    readonly id: string;
    readonly label: string;
    readonly databaseName: string;
}
export interface VerifiedRemoteBinaryResult {
    readonly bytes: Uint8Array;
    readonly contentType: string;
    readonly integrity: string;
    readonly source: 'indexeddb' | 'network';
    readonly cacheRead: 'hit' | 'miss' | 'invalid' | 'failed';
    readonly cacheWrite: 'not-needed' | 'stored' | 'skipped' | 'failed';
    readonly cacheWarnings: ReadonlyArray<VerifiedRemoteCacheWarning>;
}
export interface VerifiedRemoteCacheStats {
    readonly databaseName: string;
    readonly cacheIdentity: VerifiedRemoteCacheIdentity | null;
    readonly entries: number;
    readonly bytes: number;
    readonly oldestAccessedAt: number | null;
    readonly newestAccessedAt: number | null;
    readonly highWaterBytes: number;
    readonly lowWaterBytes: number;
    readonly lastCleanupAt: number | null;
    readonly lastCleanupRemovedEntries: number;
    readonly lastCleanupRemovedBytes: number;
}
export interface VerifiedRemoteCachePruneResult {
    readonly databaseName: string;
    readonly cacheIdentity: VerifiedRemoteCacheIdentity | null;
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
    readonly leaseTtlMs?: number;
    readonly cacheIdentity?: VerifiedRemoteCacheIdentityInput;
}
export interface VerifiedRemoteBinaryCache {
    resolve(input: VerifiedRemoteBinaryInput, options: VerifiedRemoteBinaryResolveOptions): Promise<VerifiedRemoteBinaryResult>;
    getStats(): Promise<VerifiedRemoteCacheStats>;
    prune(): Promise<VerifiedRemoteCachePruneResult>;
    clear(): Promise<VerifiedRemoteCachePruneResult>;
    listStoryCaches(): Promise<ReadonlyArray<VerifiedRemoteStoryCacheInfo>>;
    pruneStoryCaches(): Promise<VerifiedRemoteStoryCachePruneResult>;
    deleteStoryCache(databaseName: unknown): Promise<VerifiedRemoteStoryCacheDeleteResult>;
    renewStoryCacheLease(): Promise<void>;
    releaseStoryCacheLease(): Promise<void>;
}
export declare function createVerifiedRemoteCacheDatabaseName(input: {
    readonly id: unknown;
    readonly label: unknown;
}): string;
export declare function createVerifiedRemoteBinaryCache(options?: VerifiedRemoteBinaryCacheOptions): VerifiedRemoteBinaryCache;
