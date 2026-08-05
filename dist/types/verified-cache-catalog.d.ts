export interface VerifiedRemoteStoryCacheInfo {
    readonly databaseName: string;
    readonly id: string;
    readonly label: string;
    readonly entries: number;
    readonly bytes: number;
    readonly lastOpenedAt: number;
    readonly lastAccessedAt: number;
    readonly lastCleanupAt: number | null;
    readonly active: boolean;
}
export interface VerifiedRemoteStoryCachePruneResult {
    readonly removedDatabases: number;
    readonly removedEntries: number;
    readonly removedBytes: number;
    readonly remainingDatabases: number;
    readonly remainingBytes: number;
    readonly highWaterBytes: number;
    readonly lowWaterBytes: number;
    readonly warnings: ReadonlyArray<string>;
}
export interface VerifiedRemoteStoryCacheDeleteResult {
    readonly databaseName: string;
    readonly deleted: boolean;
    readonly removedEntries: number;
    readonly removedBytes: number;
}
export interface StoryCacheCatalogIdentity {
    readonly databaseName: string;
    readonly id: string;
    readonly label: string;
}
export interface StoryCacheCatalogStats {
    readonly entries: number;
    readonly bytes: number;
    readonly lastCleanupAt: number | null;
    readonly revision: number;
}
export declare class StoryCacheCatalog {
    #private;
    constructor(indexedDB: IDBFactory | undefined, now: () => number);
    acquireLease(identity: StoryCacheCatalogIdentity, accessedAt: number, token: string, expiresAt: number): Promise<void>;
    upsertAndRenewLease(identity: StoryCacheCatalogIdentity, stats: StoryCacheCatalogStats, accessedAt: number, token: string, expiresAt: number): Promise<void>;
    touchAndRenewLease(identity: StoryCacheCatalogIdentity, accessedAt: number, token: string, expiresAt: number): Promise<void>;
    list(): Promise<ReadonlyArray<VerifiedRemoteStoryCacheInfo>>;
    delete(databaseName: string, deletionToken: string): Promise<VerifiedRemoteStoryCacheDeleteResult>;
    releaseLease(databaseName: string, token: string): Promise<void>;
    prune(options: {
        readonly highWaterBytes: number;
        readonly lowWaterBytes: number;
        readonly ttlMs: number;
        readonly incomingBytes?: number;
        readonly pinnedDatabaseName?: string | null;
        readonly force?: boolean;
        readonly createDeletionToken: () => string;
    }): Promise<VerifiedRemoteStoryCachePruneResult>;
}
