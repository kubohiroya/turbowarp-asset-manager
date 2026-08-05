const CATALOG_DATABASE_NAME = 'tw-kamishibai-cache-catalog-v1';
const CATALOG_DATABASE_VERSION = 2;
const STORY_STORE = 'stories';
const LEASE_STORE = 'leases';
const CATALOG_FORMAT_VERSION = 1;
const STORY_DATABASE_PREFIX = 'tw-kamishibai-assets-v1--';
const MAX_DATABASE_NAME_LENGTH = 160;

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
}

type CatalogRecord = Omit<VerifiedRemoteStoryCacheInfo, 'active'> & {
  formatVersion: number;
  key: string;
  updatedAt: number;
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
      Number(record.updatedAt) >= 0
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

  async upsert(
    identity: StoryCacheCatalogIdentity,
    stats: StoryCacheCatalogStats,
    accessedAt: number
  ): Promise<void> {
    const database = await this.#open();
    try {
      const transaction = database.transaction(STORY_STORE, 'readwrite');
      const store = transaction.objectStore(STORY_STORE);
      const request = store.get(identity.databaseName) as IDBRequest<unknown>;
      request.onsuccess = () => {
        const previous = isCatalogRecord(request.result) ? request.result : null;
        const currentTime = this.#now();
        const record: CatalogRecord = {
          key: identity.databaseName,
          formatVersion: CATALOG_FORMAT_VERSION,
          databaseName: identity.databaseName,
          id: identity.id,
          label: identity.label,
          entries: stats.entries,
          bytes: stats.bytes,
          lastOpenedAt: Math.max(previous?.lastOpenedAt ?? 0, currentTime),
          lastAccessedAt: Math.max(previous?.lastAccessedAt ?? 0, accessedAt),
          lastCleanupAt: stats.lastCleanupAt,
          updatedAt: currentTime
        };
        store.put(record);
      };
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }

  async touch(identity: StoryCacheCatalogIdentity, accessedAt: number): Promise<void> {
    const database = await this.#open();
    try {
      const transaction = database.transaction(STORY_STORE, 'readwrite');
      const store = transaction.objectStore(STORY_STORE);
      const request = store.get(identity.databaseName) as IDBRequest<unknown>;
      request.onsuccess = () => {
        if (!isCatalogRecord(request.result)) return;
        store.put({
          ...request.result,
          id: identity.id,
          label: identity.label,
          lastOpenedAt: Math.max(request.result.lastOpenedAt, this.#now()),
          lastAccessedAt: Math.max(request.result.lastAccessedAt, accessedAt),
          updatedAt: this.#now()
        });
      };
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
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

  async #removeRecord(databaseName: string): Promise<void> {
    const database = await this.#open();
    try {
      const transaction = database.transaction([STORY_STORE, LEASE_STORE], 'readwrite');
      transaction.objectStore(STORY_STORE).delete(databaseName);
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

  async delete(databaseName: string): Promise<VerifiedRemoteStoryCacheDeleteResult> {
    const record = (await this.list()).find((entry) => entry.databaseName === databaseName);
    if (!record) {
      return Object.freeze({databaseName, deleted: false, removedEntries: 0, removedBytes: 0});
    }
    if (record.active) {
      throw catalogError(
        'ASSET_CACHE_DATABASE_ACTIVE',
        'Story cache database has an active runtime lease.'
      );
    }
    if (!this.#indexedDB || typeof this.#indexedDB.deleteDatabase !== 'function') {
      throw catalogError('ASSET_CACHE_CATALOG_UNAVAILABLE', 'IndexedDB deletion is unavailable.');
    }
    let request: IDBOpenDBRequest;
    try {
      request = this.#indexedDB.deleteDatabase(databaseName);
    } catch (error) {
      throw catalogError(
        'ASSET_CACHE_DATABASE_DELETE_FAILED',
        'Story cache database could not be deleted.',
        error
      );
    }
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      request.onsuccess = () => {
        void this.#removeRecord(databaseName).then(
          () => {
            if (settled) return;
            settled = true;
            resolve();
          },
          (error) => {
            if (settled) return;
            settled = true;
            reject(error);
          }
        );
      };
      request.onerror = () => {
        if (settled) return;
        settled = true;
        reject(
          catalogError(
            'ASSET_CACHE_DATABASE_DELETE_FAILED',
            'Story cache database deletion failed.',
            request.error
          )
        );
      };
      request.onblocked = () => {
        if (settled) return;
        settled = true;
        reject(
          catalogError(
            'ASSET_CACHE_DATABASE_DELETE_BLOCKED',
            'Story cache database deletion was blocked.'
          )
        );
      };
    });
    return Object.freeze({
      databaseName,
      deleted: true,
      removedEntries: record.entries,
      removedBytes: record.bytes
    });
  }

  async renewLease(databaseName: string, token: string, expiresAt: number): Promise<void> {
    const database = await this.#open();
    try {
      const transaction = database.transaction(LEASE_STORE, 'readwrite');
      const record: CatalogLeaseRecord = {
        key: `${databaseName}:${token}`,
        databaseName,
        token,
        expiresAt
      };
      transaction.objectStore(LEASE_STORE).put(record);
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
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
  }): Promise<VerifiedRemoteStoryCachePruneResult> {
    const warnings: string[] = [];
    let records = [...(await this.list())];
    let removedDatabases = 0;
    let removedEntries = 0;
    let removedBytes = 0;
    const remove = async (record: VerifiedRemoteStoryCacheInfo) => {
      try {
        const result = await this.delete(record.databaseName);
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
