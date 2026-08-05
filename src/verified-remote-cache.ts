const DATABASE_NAME = 'tw-asset-manager-verified-binary-v1';
const DATABASE_VERSION = 1;
const ENTRY_STORE = 'entries';
const METADATA_STORE = 'metadata';
const CACHE_FORMAT_VERSION = 1;

const DEFAULT_MAX_CACHE_BYTES = 256 * 1024 * 1024;
const DEFAULT_QUOTA_FRACTION = 0.2;
const DEFAULT_LOW_WATER_RATIO = 0.8;
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_TOUCH_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_CLEANUP_BATCH_SIZE = 64;

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
  readonly load: (
    input: NormalizedVerifiedRemoteBinaryInput,
    context: Readonly<{signal?: AbortSignal}>
  ) => Promise<VerifiedRemoteBinaryLoadResult>;
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
  readonly estimateStorage?: () => Promise<Readonly<{quota?: number; usage?: number}>>;
  readonly now?: () => number;
  readonly maxCacheBytes?: number;
  readonly quotaFraction?: number;
  readonly lowWaterRatio?: number;
  readonly ttlMs?: number;
  readonly touchIntervalMs?: number;
  readonly cleanupBatchSize?: number;
}

export interface VerifiedRemoteBinaryCache {
  resolve(
    input: VerifiedRemoteBinaryInput,
    options: VerifiedRemoteBinaryResolveOptions
  ): Promise<VerifiedRemoteBinaryResult>;
  getStats(): Promise<VerifiedRemoteCacheStats>;
  prune(): Promise<VerifiedRemoteCachePruneResult>;
  clear(): Promise<VerifiedRemoteCachePruneResult>;
}

type CacheEntry = {
  key: string;
  data: ArrayBuffer;
};

type CacheMetadata = {
  formatVersion: number;
  key: string;
  integrity: string;
  size: number;
  contentType: string;
  createdAt: number;
  lastAccessedAt: number;
  lastValidatedAt: number;
  writeToken: string;
};

type CacheRecord = {
  entry: CacheEntry;
  metadata: CacheMetadata;
};

type DeleteCandidate = {
  key: string;
  lastAccessedAt: number | null;
  writeToken: string | null;
  deleteOrphanEntry: boolean;
};

function cacheError(code: string, message: string, cause?: unknown): Error {
  const error = new Error(message, cause === undefined ? undefined : {cause});
  Object.defineProperty(error, 'code', {value: code});
  return error;
}

function abortError(): Error {
  const error = new Error('Verified remote binary resolution was cancelled.');
  error.name = 'AbortError';
  return error;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function positiveSafeInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw cacheError('ASSET_CACHE_INPUT_INVALID', `${name} must be a positive safe integer.`);
  }
  return Number(value);
}

function finiteRatio(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1) {
    throw new TypeError(`${name} must be greater than 0 and at most 1.`);
  }
  return value;
}

function normalizeContentType(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.split(';', 1)[0]!.trim().toLowerCase();
}

function normalizeInput(input: VerifiedRemoteBinaryInput): NormalizedVerifiedRemoteBinaryInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw cacheError('ASSET_CACHE_INPUT_INVALID', 'Remote binary input must be an object.');
  }
  if (typeof input.url !== 'string') {
    throw cacheError('ASSET_CACHE_INPUT_INVALID', 'Remote binary URL must be a string.');
  }
  let url: URL;
  try {
    url = new URL(input.url);
  } catch (error) {
    throw cacheError('ASSET_CACHE_INPUT_INVALID', 'Remote binary URL is invalid.', error);
  }
  if (
    url.protocol !== 'https:' ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw cacheError(
      'ASSET_CACHE_INPUT_INVALID',
      'Remote binary URL must be an absolute HTTPS URL without credentials or a fragment.'
    );
  }
  if (typeof input.integrity !== 'string' || !/^sha256-[0-9a-f]{64}$/u.test(input.integrity)) {
    throw cacheError(
      'ASSET_CACHE_INPUT_INVALID',
      'Remote binary integrity must be sha256- followed by 64 lowercase hexadecimal digits.'
    );
  }
  const contentType = normalizeContentType(input.contentType);
  if (!contentType || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/u.test(contentType)) {
    throw cacheError('ASSET_CACHE_INPUT_INVALID', 'Remote binary Content-Type is invalid.');
  }
  return Object.freeze({
    url: url.href,
    integrity: input.integrity,
    size: positiveSafeInteger(input.size, 'Remote binary size'),
    contentType
  });
}

function copyBytes(value: unknown): Uint8Array {
  if (value instanceof ArrayBuffer) return Uint8Array.from(new Uint8Array(value));
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  throw cacheError(
    'ASSET_CACHE_LOAD_INVALID',
    'Remote binary loader must return an ArrayBuffer or Uint8Array.'
  );
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

class IndexedDBVerifiedRemoteStore {
  readonly #indexedDB: IDBFactory | undefined;

  constructor(indexedDB: IDBFactory | undefined) {
    this.#indexedDB = indexedDB;
  }

  async #open(): Promise<IDBDatabase> {
    if (!this.#indexedDB || typeof this.#indexedDB.open !== 'function') {
      throw cacheError('ASSET_CACHE_INDEXEDDB_UNAVAILABLE', 'IndexedDB is not available.');
    }
    let request: IDBOpenDBRequest;
    try {
      request = this.#indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      throw cacheError('ASSET_CACHE_INDEXEDDB_UNAVAILABLE', 'IndexedDB could not be opened.', error);
    }
    return new Promise((resolve, reject) => {
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(ENTRY_STORE)) {
          database.createObjectStore(ENTRY_STORE, {keyPath: 'key'});
        }
        if (!database.objectStoreNames.contains(METADATA_STORE)) {
          const metadata = database.createObjectStore(METADATA_STORE, {keyPath: 'key'});
          metadata.createIndex('lastAccessedAt', 'lastAccessedAt');
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () =>
        reject(
          cacheError(
            'ASSET_CACHE_INDEXEDDB_UNAVAILABLE',
            'IndexedDB open request failed.',
            request.error
          )
        );
      request.onblocked = () =>
        reject(cacheError('ASSET_CACHE_INDEXEDDB_BLOCKED', 'IndexedDB upgrade was blocked.'));
    });
  }

  async get(key: string): Promise<CacheRecord | null> {
    const database = await this.#open();
    try {
      const transaction = database.transaction([ENTRY_STORE, METADATA_STORE], 'readonly');
      const entryRequest = transaction.objectStore(ENTRY_STORE).get(key) as IDBRequest<
        CacheEntry | undefined
      >;
      const metadataRequest = transaction.objectStore(METADATA_STORE).get(key) as IDBRequest<
        CacheMetadata | undefined
      >;
      const completion = transactionComplete(transaction);
      const [entry, metadata] = await Promise.all([
        requestResult(entryRequest),
        requestResult(metadataRequest)
      ]);
      await completion;
      return entry && metadata ? {entry, metadata} : null;
    } finally {
      database.close();
    }
  }

  async put(record: CacheRecord, signal?: AbortSignal): Promise<void> {
    assertNotAborted(signal);
    const database = await this.#open();
    let transaction: IDBTransaction | null = null;
    let completed = false;
    const abortTransaction = () => {
      if (completed || !transaction) return;
      try {
        transaction.abort();
      } catch {
        // A transaction which just completed no longer needs cancellation.
      }
    };
    try {
      assertNotAborted(signal);
      transaction = database.transaction([ENTRY_STORE, METADATA_STORE], 'readwrite');
      signal?.addEventListener('abort', abortTransaction, {once: true});
      transaction.objectStore(ENTRY_STORE).put(record.entry);
      transaction.objectStore(METADATA_STORE).put(record.metadata);
      try {
        await transactionComplete(transaction);
        completed = true;
      } catch (error) {
        if (signal?.aborted) throw abortError();
        throw error;
      }
    } finally {
      signal?.removeEventListener('abort', abortTransaction);
      database.close();
    }
  }

  async deleteIfWriteToken(key: string, writeToken: string): Promise<void> {
    const database = await this.#open();
    try {
      const transaction = database.transaction([ENTRY_STORE, METADATA_STORE], 'readwrite');
      const entries = transaction.objectStore(ENTRY_STORE);
      const metadata = transaction.objectStore(METADATA_STORE);
      const request = metadata.get(key) as IDBRequest<CacheMetadata | undefined>;
      request.onsuccess = () => {
        if (request.result?.writeToken !== writeToken) return;
        entries.delete(key);
        metadata.delete(key);
      };
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }

  async touch(key: string, accessedAt: number, validatedAt: number): Promise<void> {
    const database = await this.#open();
    try {
      const transaction = database.transaction(METADATA_STORE, 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(key) as IDBRequest<CacheMetadata | undefined>;
      request.onsuccess = () => {
        const current = request.result;
        if (!current) return;
        store.put({...current, lastAccessedAt: accessedAt, lastValidatedAt: validatedAt});
      };
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }

  async delete(key: string): Promise<void> {
    const database = await this.#open();
    try {
      const transaction = database.transaction([ENTRY_STORE, METADATA_STORE], 'readwrite');
      transaction.objectStore(ENTRY_STORE).delete(key);
      transaction.objectStore(METADATA_STORE).delete(key);
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }

  async metadata(): Promise<unknown[]> {
    const database = await this.#open();
    try {
      const transaction = database.transaction(METADATA_STORE, 'readonly');
      const request = transaction.objectStore(METADATA_STORE).getAll() as IDBRequest<unknown[]>;
      const completion = transactionComplete(transaction);
      const result = await requestResult(request);
      await completion;
      return result;
    } finally {
      database.close();
    }
  }

  async entryKeys(): Promise<IDBValidKey[]> {
    const database = await this.#open();
    try {
      const transaction = database.transaction(ENTRY_STORE, 'readonly');
      const request = transaction.objectStore(ENTRY_STORE).getAllKeys();
      const completion = transactionComplete(transaction);
      const result = await requestResult(request);
      await completion;
      return result;
    } finally {
      database.close();
    }
  }

  async deleteBatch(candidates: ReadonlyArray<DeleteCandidate>): Promise<{
    entries: number;
    bytes: number;
  }> {
    if (candidates.length === 0) return {entries: 0, bytes: 0};
    const database = await this.#open();
    let removedEntries = 0;
    let removedBytes = 0;
    try {
      const transaction = database.transaction([ENTRY_STORE, METADATA_STORE], 'readwrite');
      const entries = transaction.objectStore(ENTRY_STORE);
      const metadata = transaction.objectStore(METADATA_STORE);
      for (const candidate of candidates) {
        const metadataRequest = metadata.get(candidate.key) as IDBRequest<unknown>;
        const entryRequest = entries.get(candidate.key) as IDBRequest<unknown>;
        let metadataDone = false;
        let entryDone = false;
        const deleteIfStillCandidate = () => {
          if (!metadataDone || !entryDone) return;
          const current = metadataRequest.result;
          const currentEntry = entryRequest.result;
          if (!current) {
            if (!candidate.deleteOrphanEntry || !currentEntry) return;
            entries.delete(candidate.key);
            removedEntries += 1;
            if (
              typeof currentEntry === 'object' &&
              !Array.isArray(currentEntry) &&
              (currentEntry as Partial<CacheEntry>).data instanceof ArrayBuffer
            ) {
              removedBytes += (currentEntry as CacheEntry).data.byteLength;
            }
            return;
          }
          if (typeof current !== 'object' || Array.isArray(current)) return;
          const currentMetadata = current as Partial<CacheMetadata>;
          const candidateStillMatches =
            candidate.writeToken === null
              ? !metadataIsStructurallyValid(current)
              : currentMetadata.writeToken === candidate.writeToken &&
                currentMetadata.lastAccessedAt === candidate.lastAccessedAt;
          if (!candidateStillMatches) return;
          entries.delete(candidate.key);
          metadata.delete(candidate.key);
          removedEntries += 1;
          removedBytes += Number.isSafeInteger(currentMetadata.size)
            ? Number(currentMetadata.size)
            : 0;
        };
        metadataRequest.onsuccess = () => {
          metadataDone = true;
          deleteIfStillCandidate();
        };
        entryRequest.onsuccess = () => {
          entryDone = true;
          deleteIfStillCandidate();
        };
      }
      await transactionComplete(transaction);
      return {entries: removedEntries, bytes: removedBytes};
    } finally {
      database.close();
    }
  }

  async clear(): Promise<void> {
    const database = await this.#open();
    try {
      const transaction = database.transaction([ENTRY_STORE, METADATA_STORE], 'readwrite');
      transaction.objectStore(ENTRY_STORE).clear();
      transaction.objectStore(METADATA_STORE).clear();
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }
}

function isQuotaExceeded(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'QuotaExceededError'
    : Boolean(
        error &&
          typeof error === 'object' &&
          'name' in error &&
          error.name === 'QuotaExceededError'
      );
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
}

function metadataIsStructurallyValid(metadata: unknown): metadata is CacheMetadata {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  const candidate = metadata as Partial<CacheMetadata>;
  return (
    candidate.formatVersion === CACHE_FORMAT_VERSION &&
    typeof candidate.key === 'string' &&
    typeof candidate.integrity === 'string' &&
    candidate.key === `${CACHE_FORMAT_VERSION}:${candidate.integrity}` &&
    /^sha256-[0-9a-f]{64}$/u.test(candidate.integrity) &&
    Number.isSafeInteger(candidate.size) &&
    Number(candidate.size) > 0 &&
    typeof candidate.contentType === 'string' &&
    normalizeContentType(candidate.contentType) === candidate.contentType &&
    Number.isFinite(candidate.createdAt) &&
    Number.isFinite(candidate.lastAccessedAt) &&
    Number.isFinite(candidate.lastValidatedAt) &&
    typeof candidate.writeToken === 'string' &&
    candidate.writeToken.length > 0
  );
}

async function sha256Hex(bytes: Uint8Array, subtleCrypto: SubtleCrypto): Promise<string> {
  const digest = new Uint8Array(
    await subtleCrypto.digest('SHA-256', Uint8Array.from(bytes).buffer)
  );
  return [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export function createVerifiedRemoteBinaryCache(
  options: VerifiedRemoteBinaryCacheOptions = {}
): VerifiedRemoteBinaryCache {
  const indexedDB = options.indexedDB ?? globalThis.indexedDB;
  const subtleCrypto = options.subtleCrypto ?? globalThis.crypto?.subtle;
  if (!subtleCrypto || typeof subtleCrypto.digest !== 'function') {
    throw cacheError('ASSET_CACHE_CRYPTO_UNAVAILABLE', 'Web Crypto SHA-256 is not available.');
  }
  const now = options.now ?? Date.now;
  if (typeof now !== 'function') throw new TypeError('now must be a function.');
  const maxCacheBytes = positiveSafeInteger(
    options.maxCacheBytes ?? DEFAULT_MAX_CACHE_BYTES,
    'maxCacheBytes'
  );
  const quotaFraction = finiteRatio(
    options.quotaFraction ?? DEFAULT_QUOTA_FRACTION,
    'quotaFraction'
  );
  const lowWaterRatio = finiteRatio(
    options.lowWaterRatio ?? DEFAULT_LOW_WATER_RATIO,
    'lowWaterRatio'
  );
  const ttlMs = positiveSafeInteger(options.ttlMs ?? DEFAULT_TTL_MS, 'ttlMs');
  const touchIntervalMs = positiveSafeInteger(
    options.touchIntervalMs ?? DEFAULT_TOUCH_INTERVAL_MS,
    'touchIntervalMs'
  );
  const cleanupBatchSize = positiveSafeInteger(
    options.cleanupBatchSize ?? DEFAULT_CLEANUP_BATCH_SIZE,
    'cleanupBatchSize'
  );
  const estimateStorage: () => Promise<Readonly<{quota?: number; usage?: number}>> =
    options.estimateStorage ??
    (typeof globalThis.navigator?.storage?.estimate === 'function'
      ? () => globalThis.navigator.storage.estimate()
      : async () => ({}));
  if (typeof estimateStorage !== 'function') {
    throw new TypeError('estimateStorage must be a function.');
  }
  const store = new IndexedDBVerifiedRemoteStore(indexedDB);
  let initialPrune: Promise<VerifiedRemoteCachePruneResult> | null = null;
  let writeSequence = 0;

  async function waterMarks(): Promise<{high: number; low: number}> {
    let quotaBudget = maxCacheBytes;
    try {
      const estimate = await estimateStorage();
      if (Number.isFinite(estimate.quota) && Number(estimate.quota) > 0) {
        quotaBudget = Math.max(1, Math.floor(Number(estimate.quota) * quotaFraction));
      }
    } catch {
      // Cache budgeting remains available with the configured cap when estimation is unavailable.
    }
    const high = Math.min(maxCacheBytes, quotaBudget);
    return {high, low: Math.max(0, Math.floor(high * lowWaterRatio))};
  }

  async function statsFrom(metadata: unknown[]): Promise<VerifiedRemoteCacheStats> {
    const valid = metadata.filter(metadataIsStructurallyValid);
    const accessed = valid.map(({lastAccessedAt}) => lastAccessedAt);
    const {high, low} = await waterMarks();
    return Object.freeze({
      entries: valid.length,
      bytes: valid.reduce((total, entry) => total + entry.size, 0),
      oldestAccessedAt: accessed.length > 0 ? Math.min(...accessed) : null,
      newestAccessedAt: accessed.length > 0 ? Math.max(...accessed) : null,
      highWaterBytes: high,
      lowWaterBytes: low
    });
  }

  async function pruneFor(
    incomingBytes = 0,
    pinnedKey: string | null = null,
    force = false
  ): Promise<VerifiedRemoteCachePruneResult> {
    const currentTime = now();
    const metadata = await store.metadata();
    const entryKeys = new Set(
      (await store.entryKeys()).filter((key): key is string => typeof key === 'string')
    );
    const metadataKeys = new Set(
      metadata.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const key = (entry as Partial<CacheMetadata>).key;
        return typeof key === 'string' ? [key] : [];
      })
    );
    const {high, low} = await waterMarks();
    const valid = metadata.filter(
      (entry): entry is CacheMetadata =>
        metadataIsStructurallyValid(entry) &&
        entryKeys.has(entry.key) &&
        currentTime - entry.lastAccessedAt <= ttlMs
    );
    const invalid = metadata.filter(
      (entry) =>
        !metadataIsStructurallyValid(entry) ||
        !entryKeys.has(entry.key) ||
        currentTime - entry.lastAccessedAt > ttlMs
    );
    let remainingBytes = valid.reduce((total, entry) => total + entry.size, 0);
    const candidates = new Map<string, DeleteCandidate>();
    for (const entry of invalid) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const candidate = entry as Partial<CacheMetadata>;
      if (typeof candidate.key !== 'string' || candidate.key === pinnedKey) continue;
      candidates.set(
        candidate.key,
        metadataIsStructurallyValid(entry)
          ? {
              key: entry.key,
              lastAccessedAt: entry.lastAccessedAt,
              writeToken: entry.writeToken,
              deleteOrphanEntry: false
            }
          : {
              key: candidate.key,
              lastAccessedAt: null,
              writeToken: null,
              deleteOrphanEntry: false
            }
      );
    }
    for (const key of entryKeys) {
      if (key === pinnedKey || metadataKeys.has(key)) continue;
      candidates.set(key, {
        key,
        lastAccessedAt: null,
        writeToken: null,
        deleteOrphanEntry: true
      });
    }
    const target = Math.max(0, Math.min(low, high - incomingBytes));
    if (force || remainingBytes + incomingBytes > high) {
      for (const entry of [...valid].sort(
        (left, right) => left.lastAccessedAt - right.lastAccessedAt || left.key.localeCompare(right.key)
      )) {
        if (remainingBytes <= target) break;
        if (entry.key === pinnedKey) continue;
        candidates.set(entry.key, {
          key: entry.key,
          lastAccessedAt: entry.lastAccessedAt,
          writeToken: entry.writeToken,
          deleteOrphanEntry: false
        });
        remainingBytes -= entry.size;
      }
    }
    let removedEntries = 0;
    let removedBytes = 0;
    const selected = [...candidates.values()];
    for (let index = 0; index < selected.length; index += cleanupBatchSize) {
      const removed = await store.deleteBatch(selected.slice(index, index + cleanupBatchSize));
      removedEntries += removed.entries;
      removedBytes += removed.bytes;
      await Promise.resolve();
    }
    const after = await statsFrom(await store.metadata());
    return Object.freeze({
      removedEntries,
      removedBytes,
      remainingEntries: after.entries,
      remainingBytes: after.bytes,
      highWaterBytes: after.highWaterBytes,
      lowWaterBytes: after.lowWaterBytes
    });
  }

  function ensureInitialPrune(): Promise<VerifiedRemoteCachePruneResult> {
    initialPrune ??= pruneFor().catch((error) => {
      initialPrune = null;
      throw error;
    });
    return initialPrune;
  }

  async function verifyBytes(
    bytes: Uint8Array,
    input: NormalizedVerifiedRemoteBinaryInput,
    actualContentType: unknown
  ): Promise<void> {
    if (bytes.byteLength !== input.size) {
      throw cacheError(
        'ASSET_CACHE_SIZE_MISMATCH',
        `Remote binary size mismatch: expected ${input.size}, received ${bytes.byteLength}.`
      );
    }
    if (normalizeContentType(actualContentType) !== input.contentType) {
      throw cacheError(
        'ASSET_CACHE_CONTENT_TYPE_MISMATCH',
        `Remote binary Content-Type mismatch: expected ${input.contentType}.`
      );
    }
    const actualIntegrity = `sha256-${await sha256Hex(bytes, subtleCrypto)}`;
    if (actualIntegrity !== input.integrity) {
      throw cacheError('ASSET_CACHE_INTEGRITY_MISMATCH', 'Remote binary integrity mismatch.');
    }
  }

  async function readCached(
    input: NormalizedVerifiedRemoteBinaryInput
  ): Promise<{status: 'hit' | 'miss' | 'invalid'; bytes?: Uint8Array}> {
    const key = `${CACHE_FORMAT_VERSION}:${input.integrity}`;
    const record = await store.get(key);
    if (!record) return {status: 'miss'};
    const currentTime = now();
    const {entry, metadata} = record;
    const entryIsValid =
      entry &&
      typeof entry === 'object' &&
      entry.key === key &&
      entry.data instanceof ArrayBuffer;
    if (!entryIsValid) {
      await store.delete(key);
      return {status: 'invalid'};
    }
    const bytes = new Uint8Array(entry.data);
    const metadataMatches =
      metadataIsStructurallyValid(metadata) &&
      metadata.integrity === input.integrity &&
      metadata.size === input.size &&
      metadata.contentType === input.contentType &&
      currentTime - metadata.lastAccessedAt <= ttlMs &&
      entry.key === key;
    if (!metadataMatches) {
      await store.delete(key);
      return {status: 'invalid'};
    }
    try {
      await verifyBytes(bytes, input, metadata.contentType);
    } catch {
      await store.delete(key);
      return {status: 'invalid'};
    }
    if (currentTime - metadata.lastAccessedAt >= touchIntervalMs) {
      await store.touch(key, currentTime, currentTime).catch(() => {});
    }
    return {status: 'hit', bytes: Uint8Array.from(bytes)};
  }

  async function writeCached(
    input: NormalizedVerifiedRemoteBinaryInput,
    bytes: Uint8Array,
    signal?: AbortSignal
  ): Promise<
    | Readonly<{status: 'stored'; key: string; writeToken: string}>
    | Readonly<{status: 'skipped' | 'failed'}>
  > {
    const key = `${CACHE_FORMAT_VERSION}:${input.integrity}`;
    const {high} = await waterMarks();
    if (bytes.byteLength > high) return {status: 'skipped'};
    const writeToken = `${now()}:${++writeSequence}`;
    const write = async () => {
      assertNotAborted(signal);
      const timestamp = now();
      await store.put(
        {
          entry: {key, data: Uint8Array.from(bytes).buffer},
          metadata: {
            formatVersion: CACHE_FORMAT_VERSION,
            key,
            integrity: input.integrity,
            size: input.size,
            contentType: input.contentType,
            createdAt: timestamp,
            lastAccessedAt: timestamp,
            lastValidatedAt: timestamp,
            writeToken
          }
        },
        signal
      );
      if (signal?.aborted) {
        await store.deleteIfWriteToken(key, writeToken).catch(() => {});
        throw abortError();
      }
    };
    try {
      await pruneFor(bytes.byteLength, key);
      await write();
      await pruneFor(0, key).catch(() => {});
      return Object.freeze({status: 'stored' as const, key, writeToken});
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (!isQuotaExceeded(error)) return {status: 'failed'};
      try {
        await pruneFor(bytes.byteLength, key, true);
        await write();
        await pruneFor(0, key).catch(() => {});
        return Object.freeze({status: 'stored' as const, key, writeToken});
      } catch (retryError) {
        if (isAbortError(retryError)) throw retryError;
        return {status: 'failed'};
      }
    }
  }

  const cache: VerifiedRemoteBinaryCache = {
    async resolve(
      input: VerifiedRemoteBinaryInput,
      resolveOptions: VerifiedRemoteBinaryResolveOptions
    ) {
      if (!resolveOptions || typeof resolveOptions !== 'object' || Array.isArray(resolveOptions)) {
        throw new TypeError('Verified remote binary resolve options must be an object.');
      }
      if (typeof resolveOptions.load !== 'function') {
        throw new TypeError('Verified remote binary resolve options must provide load.');
      }
      const normalized = normalizeInput(input);
      assertNotAborted(resolveOptions.signal);
      let cacheRead: VerifiedRemoteBinaryResult['cacheRead'] = 'miss';
      try {
        await ensureInitialPrune();
        const cached = await readCached(normalized);
        cacheRead = cached.status;
        if (cached.status === 'hit' && cached.bytes) {
          return Object.freeze({
            bytes: cached.bytes,
            contentType: normalized.contentType,
            integrity: normalized.integrity,
            source: 'indexeddb' as const,
            cacheRead,
            cacheWrite: 'not-needed' as const
          });
        }
      } catch {
        cacheRead = 'failed';
      }
      assertNotAborted(resolveOptions.signal);
      const loaded = await resolveOptions.load(
        normalized,
        Object.freeze(
          resolveOptions.signal === undefined ? {} : {signal: resolveOptions.signal}
        )
      );
      assertNotAborted(resolveOptions.signal);
      if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
        throw cacheError('ASSET_CACHE_LOAD_INVALID', 'Remote binary loader returned no result.');
      }
      const bytes = copyBytes(loaded.bytes);
      await verifyBytes(bytes, normalized, loaded.contentType);
      assertNotAborted(resolveOptions.signal);
      const writeResult = await writeCached(normalized, bytes, resolveOptions.signal);
      if (resolveOptions.signal?.aborted) {
        if (writeResult.status === 'stored') {
          await store.deleteIfWriteToken(writeResult.key, writeResult.writeToken).catch(() => {});
        }
        throw abortError();
      }
      return Object.freeze({
        bytes: Uint8Array.from(bytes),
        contentType: normalized.contentType,
        integrity: normalized.integrity,
        source: 'network' as const,
        cacheRead,
        cacheWrite: writeResult.status
      });
    },

    async getStats() {
      return statsFrom(await store.metadata());
    },

    prune() {
      return pruneFor();
    },

    async clear() {
      const before = await statsFrom(await store.metadata());
      await store.clear();
      const {high, low} = await waterMarks();
      return Object.freeze({
        removedEntries: before.entries,
        removedBytes: before.bytes,
        remainingEntries: 0,
        remainingBytes: 0,
        highWaterBytes: high,
        lowWaterBytes: low
      });
    }
  };
  return Object.freeze(cache);
}
