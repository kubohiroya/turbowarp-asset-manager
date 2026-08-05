const CATALOG_DATABASE_NAME = 'tw-kamishibai-cache-catalog-v1';
const CATALOG_DATABASE_VERSION = 2;
const STORY_STORE = 'stories';
const LEASE_STORE = 'leases';
const CATALOG_FORMAT_VERSION = 1;
const STORY_DATABASE_PREFIX = 'tw-kamishibai-assets-v1--';
const MAX_DATABASE_NAME_LENGTH = 160;
const DELETION_MARKER_TTL_MS = 30 * 60 * 1000;

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

type CatalogRecord = Omit<VerifiedRemoteStoryCacheInfo, 'active'> & {
  formatVersion: number;
  key: string;
  updatedAt: number;
  statsRevision?: number;
  deletingToken?: string | null;
  deletingStartedAt?: number | null;
};

type CatalogLeaseRecord = {
  key: string;
  databaseName: string;
  token: string;
  expiresAt: number;
};

function catalogError(code: string, message: string, cause?: unknown): Error {
  const error = new Error(message, cause === undefined ? undefined : {cause});
  Object.defineProperty(error, 'code', {value: code});
  return error;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
  });
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isCatalogRecord(value: unknown): value is CatalogRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<CatalogRecord>;
  return Boolean(
    record.formatVersion === CATALOG_FORMAT_VERSION &&
      typeof record.key === 'string' &&
      record.key === record.databaseName &&
      typeof record.databaseName === 'string' &&
      record.databaseName.length <= MAX_DATABASE_NAME_LENGTH &&
      record.databaseName.startsWith(STORY_DATABASE_PREFIX) &&
      /^[\p{Letter}\p{Number}._-]+$/u.test(record.databaseName) &&
      typeof record.id === 'string' &&
      /^[a-z0-9][a-z0-9_-]{7,63}$/u.test(record.id) &&
      record.databaseName.endsWith(`--${record.id}`) &&
      typeof record.label === 'string' &&
      record.label.length > 0 &&
      record.label.length <= 256 &&
      !/[\u0000-\u001f\u007f]/u.test(record.label) &&
      isNonNegativeSafeInteger(record.entries) &&
      isNonNegativeSafeInteger(record.bytes) &&
      Number.isFinite(record.lastOpenedAt) &&
      Number(record.lastOpenedAt) >= 0 &&
      Number.isFinite(record.lastAccessedAt) &&
      Number(record.lastAccessedAt) >= 0 &&
      (record.lastCleanupAt === null ||
        (Number.isFinite(record.lastCleanupAt) && Number(record.lastCleanupAt) >= 0)) &&
      Number.isFinite(record.updatedAt) &&
      Number(record.updatedAt) >= 0 &&
      (record.statsRevision === undefined || isNonNegativeSafeInteger(record.statsRevision)) &&
      (record.deletingToken === undefined ||
        record.deletingToken === null ||
        (typeof record.deletingToken === 'string' && record.deletingToken.length >= 16)) &&
      (record.deletingStartedAt === undefined ||
        record.deletingStartedAt === null ||
        (Number.isFinite(record.deletingStartedAt) && Number(record.deletingStartedAt) >= 0))
  );
}

function deletionIsStale(record: CatalogRecord, currentTime: number): boolean {
  return Boolean(
    record.deletingToken &&
      (record.deletingStartedAt === undefined ||
        record.deletingStartedAt === null ||
        currentTime - record.deletingStartedAt > DELETION_MARKER_TTL_MS)
  );
}

function isLeaseRecord(value: unknown): value is CatalogLeaseRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<CatalogLeaseRecord>;
  return Boolean(
    typeof record.key === 'string' &&
      typeof record.databaseName === 'string' &&
      record.databaseName.startsWith(STORY_DATABASE_PREFIX) &&
      typeof record.token === 'string' &&
      record.token.length >= 16 &&
      record.key === `${record.databaseName}:${record.token}` &&
      Number.isFinite(record.expiresAt) &&
      Number(record.expiresAt) >= 0
  );
}

function publicInfo(record: CatalogRecord, active: boolean): VerifiedRemoteStoryCacheInfo {
  return Object.freeze({
    databaseName: record.databaseName,
    id: record.id,
    label: record.label,
    entries: record.entries,
    bytes: record.bytes,
    lastOpenedAt: record.lastOpenedAt,
    lastAccessedAt: record.lastAccessedAt,
    lastCleanupAt: record.lastCleanupAt,
    active
  });
}

export class StoryCacheCatalog {
  readonly #indexedDB: IDBFactory | undefined;
  readonly #now: () => number;

  constructor(indexedDB: IDBFactory | undefined, now: () => number) {
    this.#indexedDB = indexedDB;
    this.#now = now;
  }

  async #open(): Promise<IDBDatabase> {
    if (!this.#indexedDB || typeof this.#indexedDB.open !== 'function') {
      throw catalogError('ASSET_CACHE_CATALOG_UNAVAILABLE', 'Story cache catalog is unavailable.');
    }
    let request: IDBOpenDBRequest;
    try {
      request = this.#indexedDB.open(CATALOG_DATABASE_NAME, CATALOG_DATABASE_VERSION);
    } catch (error) {
      throw catalogError(
        'ASSET_CACHE_CATALOG_UNAVAILABLE',
        'Story cache catalog could not be opened.',
        error
      );
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORY_STORE)) {
          const store = database.createObjectStore(STORY_STORE, {keyPath: 'key'});
          store.createIndex('lastAccessedAt', 'lastAccessedAt');
        }
        if (!database.objectStoreNames.contains(LEASE_STORE)) {
          const leases = database.createObjectStore(LEASE_STORE, {keyPath: 'key'});
          leases.createIndex('databaseName', 'databaseName');
          leases.createIndex('expiresAt', 'expiresAt');
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (settled) {
          database.close();
          return;
        }
        settled = true;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => {
        if (settled) return;
        settled = true;
        reject(
          catalogError(
            'ASSET_CACHE_CATALOG_UNAVAILABLE',
            'Story cache catalog open request failed.',
            request.error
          )
        );
      };
      request.onblocked = () => {
        if (settled) return;
        settled = true;
        reject(catalogError('ASSET_CACHE_CATALOG_BLOCKED', 'Story cache catalog open was blocked.'));
      };
    });
  }

  async #writeLease(
    identity: StoryCacheCatalogIdentity,
    stats: StoryCacheCatalogStats | null,
    accessedAt: number,
    token: string,
    expiresAt: number
  ): Promise<void> {
    const database = await this.#open();
    let semanticError: Error | null = null;
    try {
      const transaction = database.transaction([STORY_STORE, LEASE_STORE], 'readwrite');
      const store = transaction.objectStore(STORY_STORE);
      const request = store.get(identity.databaseName) as IDBRequest<unknown>;
      request.onsuccess = () => {
        const previous = isCatalogRecord(request.result) ? request.result : null;
        if (previous?.deletingToken) {
          const stale = deletionIsStale(previous, this.#now());
          semanticError = catalogError(
            stale ? 'ASSET_CACHE_DATABASE_DELETION_STALE' : 'ASSET_CACHE_DATABASE_DELETING',
            stale
              ? 'Story cache database has an abandoned deletion marker.'
              : 'Story cache database deletion is in progress.'
          );
          transaction.abort();
          return;
        }
        const currentTime = this.#now();
        const previousRevision = previous?.statsRevision ?? 0;
        const acceptStats = stats !== null && (!previous || stats.revision >= previousRevision);
        const record: CatalogRecord = {
          key: identity.databaseName,
          formatVersion: CATALOG_FORMAT_VERSION,
          databaseName: identity.databaseName,
          id: identity.id,
          label: identity.label,
          entries: acceptStats ? stats.entries : (previous?.entries ?? 0),
          bytes: acceptStats ? stats.bytes : (previous?.bytes ?? 0),
          lastOpenedAt: Math.max(previous?.lastOpenedAt ?? 0, currentTime),
          lastAccessedAt: Math.max(previous?.lastAccessedAt ?? 0, accessedAt),
          lastCleanupAt: acceptStats ? stats.lastCleanupAt : (previous?.lastCleanupAt ?? null),
          updatedAt: currentTime,
          statsRevision: acceptStats ? stats.revision : previousRevision,
          deletingToken: null,
          deletingStartedAt: null
        };
        store.put(record);
        const lease: CatalogLeaseRecord = {
          key: `${identity.databaseName}:${token}`,
          databaseName: identity.databaseName,
          token,
          expiresAt
        };
        transaction.objectStore(LEASE_STORE).put(lease);
      };
      try {
        await transactionComplete(transaction);
      } catch (error) {
        throw semanticError ?? error;
      }
    } finally {
      database.close();
    }
  }

  acquireLease(
    identity: StoryCacheCatalogIdentity,
    accessedAt: number,
    token: string,
    expiresAt: number
  ): Promise<void> {
    return this.#writeLease(identity, null, accessedAt, token, expiresAt);
  }

  upsertAndRenewLease(
    identity: StoryCacheCatalogIdentity,
    stats: StoryCacheCatalogStats,
    accessedAt: number,
    token: string,
    expiresAt: number
  ): Promise<void> {
    return this.#writeLease(identity, stats, accessedAt, token, expiresAt);
  }

  touchAndRenewLease(
    identity: StoryCacheCatalogIdentity,
    accessedAt: number,
    token: string,
    expiresAt: number
  ): Promise<void> {
    return this.#writeLease(identity, null, accessedAt, token, expiresAt);
  }

  async list(): Promise<ReadonlyArray<VerifiedRemoteStoryCacheInfo>> {
    const database = await this.#open();
    try {
      const transaction = database.transaction([STORY_STORE, LEASE_STORE], 'readwrite');
      const store = transaction.objectStore(STORY_STORE);
      const leases = transaction.objectStore(LEASE_STORE);
      const records: CatalogRecord[] = [];
      const activeDatabases = new Set<string>();
      const request = store.openCursor();
      const cursorComplete = new Promise<void>((resolve, reject) => {
        request.onerror = () => reject(request.error ?? new Error('Catalog cursor failed.'));
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve();
            return;
          }
          if (isCatalogRecord(cursor.value)) records.push(cursor.value);
          else cursor.delete();
          cursor.continue();
        };
      });
      const leaseRequest = leases.openCursor();
      const leasesComplete = new Promise<void>((resolve, reject) => {
        leaseRequest.onerror = () =>
          reject(leaseRequest.error ?? new Error('Catalog lease cursor failed.'));
        leaseRequest.onsuccess = () => {
          const cursor = leaseRequest.result;
          if (!cursor) {
            resolve();
            return;
          }
          if (!isLeaseRecord(cursor.value) || cursor.value.expiresAt <= this.#now()) {
            cursor.delete();
          } else {
            activeDatabases.add(cursor.value.databaseName);
          }
          cursor.continue();
        };
      });
      await Promise.all([cursorComplete, leasesComplete, transactionComplete(transaction)]);
      records.sort(
        (left, right) =>
          left.lastAccessedAt - right.lastAccessedAt ||
          left.databaseName.localeCompare(right.databaseName, 'en-US')
      );
      return Object.freeze(
        records.map((record) => publicInfo(record, activeDatabases.has(record.databaseName)))
      );
    } finally {
      database.close();
    }
  }

  async #removeRecord(databaseName: string, deletionToken: string): Promise<void> {
    const database = await this.#open();
    try {
      const transaction = database.transaction([STORY_STORE, LEASE_STORE], 'readwrite');
      const stories = transaction.objectStore(STORY_STORE);
      const storyRequest = stories.get(databaseName) as IDBRequest<unknown>;
      storyRequest.onsuccess = () => {
        if (
          isCatalogRecord(storyRequest.result) &&
          storyRequest.result.deletingToken === deletionToken
        ) {
          stories.delete(databaseName);
        }
      };
      const leases = transaction.objectStore(LEASE_STORE);
      const request = leases.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (isLeaseRecord(cursor.value) && cursor.value.databaseName === databaseName) {
          cursor.delete();
        }
        cursor.continue();
      };
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }

  async #beginDelete(databaseName: string, deletionToken: string): Promise<CatalogRecord | null> {
    const database = await this.#open();
    let record: CatalogRecord | null = null;
    let storyComplete = false;
    let leasesComplete = false;
    let active = false;
    let semanticError: Error | null = null;
    try {
      const transaction = database.transaction([STORY_STORE, LEASE_STORE], 'readwrite');
      const stories = transaction.objectStore(STORY_STORE);
      const storyRequest = stories.get(databaseName) as IDBRequest<unknown>;
      const decide = () => {
        if (!storyComplete || !leasesComplete || semanticError || !record) return;
        if (
          record.deletingToken &&
          record.deletingToken !== deletionToken &&
          !deletionIsStale(record, this.#now())
        ) {
          semanticError = catalogError(
            'ASSET_CACHE_DATABASE_DELETING',
            'Story cache database deletion is already in progress.'
          );
          transaction.abort();
          return;
        }
        if (active) {
          semanticError = catalogError(
            'ASSET_CACHE_DATABASE_ACTIVE',
            'Story cache database has an active runtime lease.'
          );
          transaction.abort();
          return;
        }
        const currentTime = this.#now();
        stories.put({
          ...record,
          deletingToken: deletionToken,
          deletingStartedAt: currentTime,
          updatedAt: currentTime
        });
      };
      storyRequest.onsuccess = () => {
        if (isCatalogRecord(storyRequest.result)) record = storyRequest.result;
        else if (storyRequest.result !== undefined) stories.delete(databaseName);
        storyComplete = true;
        decide();
      };
      const leaseRequest = transaction.objectStore(LEASE_STORE).openCursor();
      leaseRequest.onsuccess = () => {
        const cursor = leaseRequest.result;
        if (!cursor) {
          leasesComplete = true;
          decide();
          return;
        }
        if (!isLeaseRecord(cursor.value) || cursor.value.expiresAt <= this.#now()) {
          cursor.delete();
        } else if (cursor.value.databaseName === databaseName) {
          active = true;
        }
        cursor.continue();
      };
      try {
        await transactionComplete(transaction);
      } catch (error) {
        throw semanticError ?? error;
      }
      return record;
    } finally {
      database.close();
    }
  }

  async #cancelDelete(databaseName: string, deletionToken: string): Promise<void> {
    const database = await this.#open();
    try {
      const transaction = database.transaction(STORY_STORE, 'readwrite');
      const store = transaction.objectStore(STORY_STORE);
      const request = store.get(databaseName) as IDBRequest<unknown>;
      request.onsuccess = () => {
        if (isCatalogRecord(request.result) && request.result.deletingToken === deletionToken) {
          store.put({
            ...request.result,
            deletingToken: null,
            deletingStartedAt: null,
            updatedAt: this.#now()
          });
        }
      };
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }

  async delete(
    databaseName: string,
    deletionToken: string
  ): Promise<VerifiedRemoteStoryCacheDeleteResult> {
    const record = await this.#beginDelete(databaseName, deletionToken);
    if (!record) {
      return Object.freeze({databaseName, deleted: false, removedEntries: 0, removedBytes: 0});
    }
    if (!this.#indexedDB || typeof this.#indexedDB.deleteDatabase !== 'function') {
      await this.#cancelDelete(databaseName, deletionToken).catch(() => {});
      throw catalogError('ASSET_CACHE_CATALOG_UNAVAILABLE', 'IndexedDB deletion is unavailable.');
    }
    let request: IDBOpenDBRequest;
    try {
      request = this.#indexedDB.deleteDatabase(databaseName);
    } catch (error) {
      await this.#cancelDelete(databaseName, deletionToken).catch(() => {});
      throw catalogError(
        'ASSET_CACHE_DATABASE_DELETE_FAILED',
        'Story cache database could not be deleted.',
        error
      );
    }
    try {
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () =>
          reject(
            catalogError(
              'ASSET_CACHE_DATABASE_DELETE_FAILED',
              'Story cache database deletion failed.',
              request.error
            )
          );
        request.onblocked = () => {
          // A blocked delete request is still live. Keep the deletion marker until it settles so
          // a new runtime cannot acquire a lease while the browser may still delete the database.
        };
      });
      await this.#removeRecord(databaseName, deletionToken);
    } catch (error) {
      await this.#cancelDelete(databaseName, deletionToken).catch(() => {});
      throw error;
    }
    return Object.freeze({
      databaseName,
      deleted: true,
      removedEntries: record.entries,
      removedBytes: record.bytes
    });
  }

  async releaseLease(databaseName: string, token: string): Promise<void> {
    const database = await this.#open();
    try {
      const transaction = database.transaction(LEASE_STORE, 'readwrite');
      transaction.objectStore(LEASE_STORE).delete(`${databaseName}:${token}`);
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }

  async prune(options: {
    readonly highWaterBytes: number;
    readonly lowWaterBytes: number;
    readonly ttlMs: number;
    readonly incomingBytes?: number;
    readonly pinnedDatabaseName?: string | null;
    readonly force?: boolean;
    readonly createDeletionToken: () => string;
  }): Promise<VerifiedRemoteStoryCachePruneResult> {
    const warnings: string[] = [];
    let records = [...(await this.list())];
    let removedDatabases = 0;
    let removedEntries = 0;
    let removedBytes = 0;
    const remove = async (record: VerifiedRemoteStoryCacheInfo) => {
      try {
        const result = await this.delete(record.databaseName, options.createDeletionToken());
        if (!result.deleted) return false;
        removedDatabases += 1;
        removedEntries += result.removedEntries;
        removedBytes += result.removedBytes;
        return true;
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
            ? error.code
            : 'ASSET_CACHE_DATABASE_DELETE_FAILED';
        if (!warnings.includes(code)) warnings.push(code);
        return false;
      }
    };

    const currentTime = this.#now();
    for (const record of records) {
      if (record.databaseName === options.pinnedDatabaseName) continue;
      if (record.active) continue;
      if (currentTime - record.lastAccessedAt <= options.ttlMs) continue;
      await remove(record);
    }
    records = [...(await this.list())];
    let totalBytes = records.reduce((sum, record) => sum + record.bytes, 0);
    const incomingBytes = Math.max(0, options.incomingBytes ?? 0);
    const target = options.force
      ? Math.max(0, Math.min(options.lowWaterBytes, totalBytes - incomingBytes))
      : Math.max(0, Math.min(options.lowWaterBytes, options.highWaterBytes - incomingBytes));
    if (options.force || totalBytes + incomingBytes > options.highWaterBytes) {
      for (const record of records) {
        if (record.databaseName === options.pinnedDatabaseName) continue;
        if (record.active) continue;
        if (!(await remove(record))) continue;
        totalBytes -= record.bytes;
        if (totalBytes <= target) break;
      }
    }
    const remaining = await this.list();
    return Object.freeze({
      removedDatabases,
      removedEntries,
      removedBytes,
      remainingDatabases: remaining.length,
      remainingBytes: remaining.reduce((sum, record) => sum + record.bytes, 0),
      highWaterBytes: options.highWaterBytes,
      lowWaterBytes: options.lowWaterBytes,
      warnings: Object.freeze(warnings)
    });
  }
}
