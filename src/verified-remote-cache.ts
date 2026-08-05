import {
  StoryCacheCatalog,
  type VerifiedRemoteStoryCacheDeleteResult,
  type VerifiedRemoteStoryCacheInfo,
  type VerifiedRemoteStoryCachePruneResult
} from './verified-cache-catalog.js';

export type {
  VerifiedRemoteStoryCacheDeleteResult,
  VerifiedRemoteStoryCacheInfo,
  VerifiedRemoteStoryCachePruneResult
} from './verified-cache-catalog.js';

const DATABASE_NAME = 'tw-asset-manager-verified-binary-v1';
const DATABASE_VERSION = 2;
const ENTRY_STORE = 'entries';
const METADATA_STORE = 'metadata';
const INFO_STORE = 'info';
const CACHE_FORMAT_VERSION = 1;
const STORY_DATABASE_PREFIX = 'tw-kamishibai-assets-v1--';
const MAX_DATABASE_NAME_LENGTH = 160;

const DEFAULT_MAX_CACHE_BYTES = 256 * 1024 * 1024;
const DEFAULT_QUOTA_FRACTION = 0.2;
const DEFAULT_LOW_WATER_RATIO = 0.8;
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_TOUCH_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_CLEANUP_BATCH_SIZE = 64;
const DEFAULT_LEASE_TTL_MS = 5 * 60 * 1000;

type OwnedBytes = Uint8Array<ArrayBuffer>;

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
  readonly load: (
    input: NormalizedVerifiedRemoteBinaryInput,
    context: Readonly<{signal?: AbortSignal}>
  ) => Promise<VerifiedRemoteBinaryLoadResult>;
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
  readonly estimateStorage?: () => Promise<Readonly<{quota?: number; usage?: number}>>;
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
  resolve(
    input: VerifiedRemoteBinaryInput,
    options: VerifiedRemoteBinaryResolveOptions
  ): Promise<VerifiedRemoteBinaryResult>;
  getStats(): Promise<VerifiedRemoteCacheStats>;
  prune(): Promise<VerifiedRemoteCachePruneResult>;
  clear(): Promise<VerifiedRemoteCachePruneResult>;
  listStoryCaches(): Promise<ReadonlyArray<VerifiedRemoteStoryCacheInfo>>;
  pruneStoryCaches(): Promise<VerifiedRemoteStoryCachePruneResult>;
  deleteStoryCache(databaseName: unknown): Promise<VerifiedRemoteStoryCacheDeleteResult>;
  renewStoryCacheLease(): Promise<void>;
  releaseStoryCacheLease(): Promise<void>;
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
  key: IDBValidKey;
  entry: unknown;
  metadata: unknown;
};

type CacheScanRecord = {
  key: IDBValidKey;
  entryPresent: boolean;
  metadata: unknown;
};

type ScanBatch = {
  records: CacheScanRecord[];
  nextKey: IDBValidKey | null;
  done: boolean;
};

type DeleteCandidate = {
  key: IDBValidKey;
  expectedWriteToken: string | null;
  expectedSize: number;
  deleteIfMetadataInvalid: boolean;
  deleteIfMetadataMissing: boolean;
};

type Removed = {
  entries: number;
  bytes: number;
};

type CacheInfoRecord = {
  key: 'identity';
  formatVersion: number;
  id: string;
  label: string;
  databaseName: string;
  lastOpenedAt: number;
};

type CacheCleanupRecord = {
  key: 'cleanup';
  lastCleanupAt: number;
  removedEntries: number;
  removedBytes: number;
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

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
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

function diagnosticCode(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    if ('code' in error && typeof error.code === 'string' && error.code) return error.code;
    if ('name' in error && error.name === 'QuotaExceededError') {
      return 'ASSET_CACHE_QUOTA_EXCEEDED';
    }
    if ('name' in error && error.name === 'AbortError') return 'ASSET_CACHE_ABORTED';
  }
  return fallback;
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
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash) {
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
  if (!contentType || !/^[a-z0-9!#$%&'*+.^_`|~-]+\/[a-z0-9!#$%&'*+.^_`|~-]+$/u.test(contentType)) {
    throw cacheError('ASSET_CACHE_INPUT_INVALID', 'Remote binary Content-Type is invalid.');
  }
  return Object.freeze({
    url: url.href,
    integrity: input.integrity,
    size: positiveSafeInteger(input.size, 'Remote binary size'),
    contentType
  });
}

function normalizeCacheIdentityId(value: unknown): string {
  if (typeof value !== 'string') {
    throw cacheError('ASSET_CACHE_IDENTITY_INVALID', 'Cache identity id must be a string.');
  }
  const id = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{7,63}$/u.test(id)) {
    throw cacheError(
      'ASSET_CACHE_IDENTITY_INVALID',
      'Cache identity id must contain 8 to 64 lowercase ASCII letters, digits, underscores, or hyphens.'
    );
  }
  return id;
}

function normalizeCacheIdentityLabel(value: unknown): string {
  if (typeof value !== 'string') {
    throw cacheError('ASSET_CACHE_IDENTITY_INVALID', 'Cache identity label must be a string.');
  }
  const basename = value.normalize('NFKC').replaceAll('\\', '/').split('/').at(-1)!.trim();
  if (!basename || basename.length > 256 || /[\u0000-\u001f\u007f]/u.test(basename)) {
    throw cacheError('ASSET_CACHE_IDENTITY_INVALID', 'Cache identity label is invalid.');
  }
  return basename;
}

function truncateUtf16(value: string, maxCodeUnits: number, maxCodePoints: number): string {
  let result = '';
  let codePoints = 0;
  for (const character of value) {
    if (codePoints >= maxCodePoints || result.length + character.length > maxCodeUnits) break;
    result += character;
    codePoints += 1;
  }
  return result;
}

function cacheLabelSlug(label: string, maxCodeUnits: number): string {
  const withoutExtension = label.replace(/(?:\.kamishibai)?\.ya?ml$/iu, '');
  const slug = withoutExtension
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, '-')
    .replace(/^[._-]+|[._-]+$/gu, '');
  return truncateUtf16(slug || 'story', maxCodeUnits, 48);
}

export function createVerifiedRemoteCacheDatabaseName(input: {
  readonly id: unknown;
  readonly label: unknown;
}): string {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw cacheError('ASSET_CACHE_IDENTITY_INVALID', 'Cache identity must be an object.');
  }
  const id = normalizeCacheIdentityId(input.id);
  const label = normalizeCacheIdentityLabel(input.label);
  const slugBudget = MAX_DATABASE_NAME_LENGTH - STORY_DATABASE_PREFIX.length - 2 - id.length;
  return `${STORY_DATABASE_PREFIX}${cacheLabelSlug(label, slugBudget)}--${id}`;
}

function normalizeCacheIdentity(
  input: VerifiedRemoteCacheIdentityInput | undefined
): VerifiedRemoteCacheIdentity | null {
  if (input === undefined) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw cacheError('ASSET_CACHE_IDENTITY_INVALID', 'Cache identity must be an object.');
  }
  const id = normalizeCacheIdentityId(input.id);
  const label = normalizeCacheIdentityLabel(input.label);
  const generated = createVerifiedRemoteCacheDatabaseName({id, label});
  if (input.databaseName === undefined) {
    return Object.freeze({id, label, databaseName: generated});
  }
  if (typeof input.databaseName !== 'string') {
    throw cacheError('ASSET_CACHE_IDENTITY_INVALID', 'Cache database name must be a string.');
  }
  const databaseName = input.databaseName.normalize('NFKC');
  if (
    databaseName.length > MAX_DATABASE_NAME_LENGTH ||
    !databaseName.startsWith(STORY_DATABASE_PREFIX) ||
    !databaseName.endsWith(`--${id}`) ||
    !/^[\p{Letter}\p{Number}._-]+$/u.test(databaseName)
  ) {
    throw cacheError(
      'ASSET_CACHE_IDENTITY_INVALID',
      'Cache database name must be a generated Kamishibai story database name for the same id.'
    );
  }
  return Object.freeze({id, label, databaseName});
}

function normalizeStoryDatabaseName(value: unknown): string {
  if (typeof value !== 'string') {
    throw cacheError('ASSET_CACHE_IDENTITY_INVALID', 'Story cache database name must be a string.');
  }
  const databaseName = value.normalize('NFKC');
  if (
    databaseName.length > MAX_DATABASE_NAME_LENGTH ||
    !databaseName.startsWith(STORY_DATABASE_PREFIX) ||
    !/^[\p{Letter}\p{Number}._-]+$/u.test(databaseName)
  ) {
    throw cacheError('ASSET_CACHE_IDENTITY_INVALID', 'Story cache database name is invalid.');
  }
  return databaseName;
}

function takeBytes(value: unknown, transferOwnership: boolean): OwnedBytes {
  if (value instanceof ArrayBuffer) {
    return transferOwnership ? new Uint8Array(value) : Uint8Array.from(new Uint8Array(value));
  }
  if (value instanceof Uint8Array) {
    if (
      transferOwnership &&
      value.buffer instanceof ArrayBuffer &&
      value.byteOffset === 0 &&
      value.byteLength === value.buffer.byteLength
    ) {
      return value as OwnedBytes;
    }
    return Uint8Array.from(value);
  }
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
    Number(candidate.createdAt) >= 0 &&
    Number.isFinite(candidate.lastAccessedAt) &&
    Number(candidate.lastAccessedAt) >= Number(candidate.createdAt) &&
    Number.isFinite(candidate.lastValidatedAt) &&
    Number(candidate.lastValidatedAt) >= Number(candidate.createdAt) &&
    typeof candidate.writeToken === 'string' &&
    candidate.writeToken.length >= 16
  );
}

function entryBytes(entry: unknown, key: IDBValidKey): OwnedBytes | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const candidate = entry as Partial<CacheEntry>;
  if (candidate.key !== key || !(candidate.data instanceof ArrayBuffer)) return null;
  return new Uint8Array(candidate.data);
}

function recordIsUsable(
  record: CacheRecord,
  currentTime: number,
  ttlMs: number
): record is CacheRecord & {metadata: CacheMetadata} {
  if (!metadataIsStructurallyValid(record.metadata)) return false;
  const bytes = entryBytes(record.entry, record.key);
  return Boolean(
    bytes &&
      bytes.byteLength === record.metadata.size &&
      currentTime >= record.metadata.createdAt &&
      currentTime >= record.metadata.lastAccessedAt &&
      currentTime - record.metadata.lastAccessedAt <= ttlMs
  );
}

function scanRecordIsUsable(
  record: CacheScanRecord,
  currentTime: number,
  ttlMs: number
): record is CacheScanRecord & {metadata: CacheMetadata} {
  if (!record.entryPresent || !metadataIsStructurallyValid(record.metadata)) return false;
  return Boolean(
    currentTime >= record.metadata.createdAt &&
      currentTime >= record.metadata.lastAccessedAt &&
      currentTime - record.metadata.lastAccessedAt <= ttlMs
  );
}

function candidateFor(record: CacheRecord | CacheScanRecord): DeleteCandidate {
  if (metadataIsStructurallyValid(record.metadata)) {
    return {
      key: record.key,
      expectedWriteToken: record.metadata.writeToken,
      expectedSize: record.metadata.size,
      deleteIfMetadataInvalid: false,
      deleteIfMetadataMissing: false
    };
  }
  return {
    key: record.key,
    expectedWriteToken: null,
    expectedSize: 0,
    deleteIfMetadataInvalid: record.metadata !== undefined,
    deleteIfMetadataMissing: record.metadata === undefined
  };
}

function createInstanceToken(now: () => number): string {
  const random = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(random);
    return [...random].map((value) => value.toString(16).padStart(2, '0')).join('');
  }
  throw cacheError(
    'ASSET_CACHE_CRYPTO_UNAVAILABLE',
    `Secure random values are not available at ${now()}.`
  );
}

async function sha256Hex(bytes: OwnedBytes, subtleCrypto: SubtleCrypto): Promise<string> {
  const digest = new Uint8Array(await subtleCrypto.digest('SHA-256', bytes));
  return [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
}

class IndexedDBVerifiedRemoteStore {
  readonly #indexedDB: IDBFactory | undefined;
  readonly #databaseName: string;
  readonly #cacheIdentity: VerifiedRemoteCacheIdentity | null;
  readonly #now: () => number;
  #identityStored = false;

  constructor(
    indexedDB: IDBFactory | undefined,
    databaseName: string,
    cacheIdentity: VerifiedRemoteCacheIdentity | null,
    now: () => number
  ) {
    this.#indexedDB = indexedDB;
    this.#databaseName = databaseName;
    this.#cacheIdentity = cacheIdentity;
    this.#now = now;
  }

  resetIdentityState(): void {
    this.#identityStored = false;
  }

  async #open(): Promise<IDBDatabase> {
    if (!this.#indexedDB || typeof this.#indexedDB.open !== 'function') {
      throw cacheError('ASSET_CACHE_INDEXEDDB_UNAVAILABLE', 'IndexedDB is not available.');
    }
    let request: IDBOpenDBRequest;
    try {
      request = this.#indexedDB.open(this.#databaseName, DATABASE_VERSION);
    } catch (error) {
      throw cacheError('ASSET_CACHE_INDEXEDDB_UNAVAILABLE', 'IndexedDB could not be opened.', error);
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const rejectOnce = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(ENTRY_STORE)) {
          database.createObjectStore(ENTRY_STORE, {keyPath: 'key'});
        }
        let metadata: IDBObjectStore;
        if (!database.objectStoreNames.contains(METADATA_STORE)) {
          metadata = database.createObjectStore(METADATA_STORE, {keyPath: 'key'});
        } else {
          metadata = request.transaction!.objectStore(METADATA_STORE);
        }
        if (!metadata.indexNames.contains('lastAccessedAt')) {
          metadata.createIndex('lastAccessedAt', 'lastAccessedAt');
        }
        if (!database.objectStoreNames.contains(INFO_STORE)) {
          database.createObjectStore(INFO_STORE, {keyPath: 'key'});
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
        if (!this.#cacheIdentity || this.#identityStored) {
          resolve(database);
          return;
        }
        let transaction: IDBTransaction;
        try {
          transaction = database.transaction(INFO_STORE, 'readwrite');
          const record: CacheInfoRecord = {
            key: 'identity',
            formatVersion: CACHE_FORMAT_VERSION,
            id: this.#cacheIdentity.id,
            label: this.#cacheIdentity.label,
            databaseName: this.#cacheIdentity.databaseName,
            lastOpenedAt: this.#now()
          };
          transaction.objectStore(INFO_STORE).put(record);
        } catch (error) {
          database.close();
          reject(
            cacheError(
              'ASSET_CACHE_IDENTITY_WRITE_FAILED',
              'Cache identity metadata could not be written.',
              error
            )
          );
          return;
        }
        transactionComplete(transaction).then(
          () => {
            this.#identityStored = true;
            resolve(database);
          },
          (error) => {
            database.close();
            reject(error);
          }
        );
      };
      request.onerror = () =>
        rejectOnce(
          cacheError(
            'ASSET_CACHE_INDEXEDDB_UNAVAILABLE',
            'IndexedDB open request failed.',
            request.error
          )
        );
      request.onblocked = () =>
        rejectOnce(cacheError('ASSET_CACHE_INDEXEDDB_BLOCKED', 'IndexedDB upgrade was blocked.'));
    });
  }

  async get(key: string): Promise<CacheRecord | null> {
    const database = await this.#open();
    try {
      const transaction = database.transaction([ENTRY_STORE, METADATA_STORE], 'readonly');
      const entryRequest = transaction.objectStore(ENTRY_STORE).get(key) as IDBRequest<unknown>;
      const metadataRequest = transaction.objectStore(METADATA_STORE).get(key) as IDBRequest<unknown>;
      const [entry, metadata] = await Promise.all([
        requestResult(entryRequest),
        requestResult(metadataRequest),
        transactionComplete(transaction)
      ]);
      return entry === undefined && metadata === undefined ? null : {key, entry, metadata};
    } finally {
      database.close();
    }
  }

  async getScanRecord(key: string): Promise<CacheScanRecord | null> {
    const database = await this.#open();
    try {
      const transaction = database.transaction([ENTRY_STORE, METADATA_STORE], 'readonly');
      const entryKeyRequest = transaction.objectStore(ENTRY_STORE).getKey(key) as IDBRequest<
        IDBValidKey | undefined
      >;
      const metadataRequest = transaction.objectStore(METADATA_STORE).get(key) as IDBRequest<unknown>;
      const [entryKey, metadata] = await Promise.all([
        requestResult(entryKeyRequest),
        requestResult(metadataRequest),
        transactionComplete(transaction)
      ]);
      if (entryKey === undefined && metadata === undefined) return null;
      return {key, entryPresent: entryKey !== undefined, metadata};
    } finally {
      database.close();
    }
  }

  async putIfAbsentValid(record: {entry: CacheEntry; metadata: CacheMetadata}, signal?: AbortSignal) {
    assertNotAborted(signal);
    const database = await this.#open();
    let transaction: IDBTransaction | null = null;
    let completed = false;
    let written = false;
    let synchronousError: unknown;
    const abortTransaction = () => {
      if (completed || !transaction) return;
      try {
        transaction.abort();
      } catch {
        // The transaction completed between the signal and this callback.
      }
    };
    try {
      assertNotAborted(signal);
      transaction = database.transaction([ENTRY_STORE, METADATA_STORE], 'readwrite');
      signal?.addEventListener('abort', abortTransaction, {once: true});
      const entries = transaction.objectStore(ENTRY_STORE);
      const metadata = transaction.objectStore(METADATA_STORE);
      const entryRequest = entries.get(record.entry.key) as IDBRequest<unknown>;
      const metadataRequest = metadata.get(record.metadata.key) as IDBRequest<unknown>;
      let entryDone = false;
      let metadataDone = false;
      const decide = () => {
        if (!entryDone || !metadataDone || synchronousError) return;
        if (signal?.aborted) {
          abortTransaction();
          return;
        }
        const existingBytes = entryBytes(entryRequest.result, record.entry.key);
        const existingMetadata = metadataRequest.result;
        const existingIsValidSameContent =
          metadataIsStructurallyValid(existingMetadata) &&
          existingMetadata.integrity === record.metadata.integrity &&
          existingMetadata.size === record.metadata.size &&
          existingMetadata.contentType === record.metadata.contentType &&
          existingBytes?.byteLength === record.metadata.size;
        if (existingIsValidSameContent) return;
        try {
          entries.put(record.entry);
          metadata.put(record.metadata);
          written = true;
        } catch (error) {
          synchronousError = error;
          abortTransaction();
        }
      };
      entryRequest.onsuccess = () => {
        entryDone = true;
        decide();
      };
      metadataRequest.onsuccess = () => {
        metadataDone = true;
        decide();
      };
      try {
        await transactionComplete(transaction);
        completed = true;
      } catch (error) {
        if (signal?.aborted) throw abortError();
        throw synchronousError ?? error;
      }
      if (synchronousError) throw synchronousError;
      return written;
    } finally {
      signal?.removeEventListener('abort', abortTransaction);
      database.close();
    }
  }

  async touch(key: string, accessedAt: number, validatedAt: number): Promise<void> {
    const database = await this.#open();
    try {
      const transaction = database.transaction(METADATA_STORE, 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(key) as IDBRequest<unknown>;
      request.onsuccess = () => {
        if (!metadataIsStructurallyValid(request.result)) return;
        store.put({...request.result, lastAccessedAt: accessedAt, lastValidatedAt: validatedAt});
      };
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }

  async #scanBatch(
    primaryStore: typeof ENTRY_STORE | typeof METADATA_STORE,
    afterKey: IDBValidKey | null,
    limit: number
  ): Promise<ScanBatch> {
    const database = await this.#open();
    try {
      const transaction = database.transaction([ENTRY_STORE, METADATA_STORE], 'readonly');
      const entries = transaction.objectStore(ENTRY_STORE);
      const metadata = transaction.objectStore(METADATA_STORE);
      const primary = primaryStore === ENTRY_STORE ? entries : metadata;
      const records: CacheScanRecord[] = [];
      let nextKey: IDBValidKey | null = null;
      let done = true;
      const cursorRequest =
        primaryStore === ENTRY_STORE ? primary.openKeyCursor() : primary.openCursor();
      const cursorFinished = new Promise<void>((resolve, reject) => {
        cursorRequest.onerror = () =>
          reject(cursorRequest.error ?? new Error('IndexedDB cursor failed.'));
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) {
            done = true;
            resolve();
            return;
          }
          if (afterKey !== null) {
            const comparison = this.#indexedDB!.cmp(cursor.primaryKey, afterKey);
            if (comparison < 0) {
              cursor.continue(afterKey);
              return;
            }
            if (comparison === 0) {
              cursor.continue();
              return;
            }
          }
          const record: CacheScanRecord = {
            key: cursor.primaryKey,
            entryPresent: primaryStore === ENTRY_STORE,
            metadata:
              primaryStore === METADATA_STORE
                ? (cursor as IDBCursorWithValue).value
                : undefined
          };
          records.push(record);
          const counterpartRequest =
            primaryStore === ENTRY_STORE
              ? (metadata.get(cursor.primaryKey) as IDBRequest<unknown>)
              : (entries.getKey(cursor.primaryKey) as IDBRequest<IDBValidKey | undefined>);
          counterpartRequest.onsuccess = () => {
            if (primaryStore === ENTRY_STORE) record.metadata = counterpartRequest.result;
            else record.entryPresent = counterpartRequest.result !== undefined;
          };
          nextKey = cursor.primaryKey;
          if (records.length >= limit) {
            done = false;
            resolve();
            return;
          }
          cursor.continue();
        };
      });
      await Promise.all([cursorFinished, transactionComplete(transaction)]);
      return {records, nextKey, done};
    } finally {
      database.close();
    }
  }

  scanMetadataBatch(afterKey: IDBValidKey | null, limit: number): Promise<ScanBatch> {
    return this.#scanBatch(METADATA_STORE, afterKey, limit);
  }

  scanEntryBatch(afterKey: IDBValidKey | null, limit: number): Promise<ScanBatch> {
    return this.#scanBatch(ENTRY_STORE, afterKey, limit);
  }

  async oldestBatch(limit: number): Promise<CacheScanRecord[]> {
    const database = await this.#open();
    try {
      const transaction = database.transaction([ENTRY_STORE, METADATA_STORE], 'readonly');
      const entries = transaction.objectStore(ENTRY_STORE);
      const metadata = transaction.objectStore(METADATA_STORE);
      const records: CacheScanRecord[] = [];
      const cursorRequest = metadata.index('lastAccessedAt').openCursor();
      const cursorFinished = new Promise<void>((resolve, reject) => {
        cursorRequest.onerror = () =>
          reject(cursorRequest.error ?? new Error('IndexedDB LRU cursor failed.'));
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor || records.length >= limit) {
            resolve();
            return;
          }
          const record: CacheScanRecord = {
            key: cursor.primaryKey,
            entryPresent: false,
            metadata: cursor.value
          };
          records.push(record);
          const entryRequest = entries.getKey(cursor.primaryKey) as IDBRequest<
            IDBValidKey | undefined
          >;
          entryRequest.onsuccess = () => {
            record.entryPresent = entryRequest.result !== undefined;
          };
          cursor.continue();
        };
      });
      await Promise.all([cursorFinished, transactionComplete(transaction)]);
      return records;
    } finally {
      database.close();
    }
  }

  async deleteBatch(candidates: ReadonlyArray<DeleteCandidate>): Promise<Removed> {
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
        const entryRequest = entries.getKey(candidate.key) as IDBRequest<
          IDBValidKey | undefined
        >;
        let metadataDone = false;
        let entryDone = false;
        const deleteIfStillCandidate = () => {
          if (!metadataDone || !entryDone) return;
          const currentMetadata = metadataRequest.result;
          const currentEntryPresent = entryRequest.result !== undefined;
          const currentWriteToken =
            currentMetadata && typeof currentMetadata === 'object' && !Array.isArray(currentMetadata)
              ? (currentMetadata as Partial<CacheMetadata>).writeToken
              : undefined;
          const candidateStillMatches =
            (candidate.expectedWriteToken !== null &&
              currentWriteToken === candidate.expectedWriteToken) ||
            (candidate.deleteIfMetadataInvalid &&
              currentMetadata !== undefined &&
              !metadataIsStructurallyValid(currentMetadata)) ||
            (candidate.deleteIfMetadataMissing && currentMetadata === undefined);
          if (!candidateStillMatches) return;
          entries.delete(candidate.key);
          metadata.delete(candidate.key);
          if (currentEntryPresent || currentMetadata !== undefined) removedEntries += 1;
          removedBytes += candidate.expectedSize;
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

  async cleanupInfo(): Promise<CacheCleanupRecord | null> {
    const database = await this.#open();
    try {
      const transaction = database.transaction(INFO_STORE, 'readonly');
      const request = transaction.objectStore(INFO_STORE).get('cleanup') as IDBRequest<unknown>;
      const [result] = await Promise.all([
        requestResult(request),
        transactionComplete(transaction)
      ]);
      if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
      const candidate = result as Partial<CacheCleanupRecord>;
      if (
        candidate.key !== 'cleanup' ||
        !Number.isFinite(candidate.lastCleanupAt) ||
        !Number.isSafeInteger(candidate.removedEntries) ||
        Number(candidate.removedEntries) < 0 ||
        !Number.isSafeInteger(candidate.removedBytes) ||
        Number(candidate.removedBytes) < 0
      ) {
        return null;
      }
      return candidate as CacheCleanupRecord;
    } finally {
      database.close();
    }
  }

  async recordCleanup(record: CacheCleanupRecord): Promise<void> {
    const database = await this.#open();
    try {
      const transaction = database.transaction(INFO_STORE, 'readwrite');
      transaction.objectStore(INFO_STORE).put(record);
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }
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
  const leaseTtlMs = positiveSafeInteger(
    options.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS,
    'leaseTtlMs'
  );
  const catalogHeartbeatIntervalMs = Math.max(1, Math.floor(leaseTtlMs / 2));
  const estimateStorage: () => Promise<Readonly<{quota?: number; usage?: number}>> =
    options.estimateStorage ??
    (typeof globalThis.navigator?.storage?.estimate === 'function'
      ? () => globalThis.navigator.storage.estimate()
      : async () => ({}));
  if (typeof estimateStorage !== 'function') {
    throw new TypeError('estimateStorage must be a function.');
  }

  const cacheIdentity = normalizeCacheIdentity(options.cacheIdentity);
  const databaseName = cacheIdentity?.databaseName ?? DATABASE_NAME;
  const store = new IndexedDBVerifiedRemoteStore(indexedDB, databaseName, cacheIdentity, now);
  const catalog = new StoryCacheCatalog(indexedDB, now);
  const instanceToken = createInstanceToken(now);
  let writeSequence = 0;
  let initialSweep: Promise<Removed> | null = null;
  let catalogInitialized: Promise<void> | null = null;
  let lastCatalogTouchAt = Number.NEGATIVE_INFINITY;
  let leaseHeld = false;

  async function waterMarks(): Promise<{high: number; low: number}> {
    let quotaBudget = maxCacheBytes;
    try {
      const estimate = await estimateStorage();
      if (Number.isFinite(estimate.quota) && Number(estimate.quota) > 0) {
        quotaBudget = Math.max(1, Math.floor(Number(estimate.quota) * quotaFraction));
      }
    } catch {
      // Use the configured cap when browser quota estimation is unavailable.
    }
    const high = Math.min(maxCacheBytes, quotaBudget);
    return {high, low: Math.max(0, Math.floor(high * lowWaterRatio))};
  }

  async function forEachMetadataBatch(
    visitor: (records: ReadonlyArray<CacheScanRecord>) => Promise<void> | void,
    onlyFirst = false
  ): Promise<void> {
    let afterKey: IDBValidKey | null = null;
    while (true) {
      const batch = await store.scanMetadataBatch(afterKey, cleanupBatchSize);
      await visitor(batch.records);
      if (onlyFirst || batch.done || batch.nextKey === null) return;
      afterKey = batch.nextKey;
    }
  }

  async function forEachEntryBatch(
    visitor: (records: ReadonlyArray<CacheScanRecord>) => Promise<void> | void,
    onlyFirst = false
  ): Promise<void> {
    let afterKey: IDBValidKey | null = null;
    while (true) {
      const batch = await store.scanEntryBatch(afterKey, cleanupBatchSize);
      await visitor(batch.records);
      if (onlyFirst || batch.done || batch.nextKey === null) return;
      afterKey = batch.nextKey;
    }
  }

  async function cleanupInvalid(onlyFirst = false): Promise<Removed> {
    const currentTime = now();
    let removedEntries = 0;
    let removedBytes = 0;
    await forEachMetadataBatch(async (records) => {
      const candidates = records
        .filter((record) => !scanRecordIsUsable(record, currentTime, ttlMs))
        .map(candidateFor);
      const removed = await store.deleteBatch(candidates);
      removedEntries += removed.entries;
      removedBytes += removed.bytes;
    }, onlyFirst);
    await forEachEntryBatch(async (records) => {
      const candidates = records
        .filter((record) => record.metadata === undefined)
        .map(candidateFor);
      const removed = await store.deleteBatch(candidates);
      removedEntries += removed.entries;
      removedBytes += removed.bytes;
    }, onlyFirst);
    return {entries: removedEntries, bytes: removedBytes};
  }

  function ensureInitialSweep(): Promise<Removed> {
    initialSweep ??= cleanupInvalid(true).catch((error) => {
      initialSweep = null;
      throw error;
    });
    return initialSweep;
  }

  async function computeStats(): Promise<VerifiedRemoteCacheStats> {
    const currentTime = now();
    let entries = 0;
    let bytes = 0;
    let oldestAccessedAt: number | null = null;
    let newestAccessedAt: number | null = null;
    await forEachMetadataBatch((records) => {
      for (const record of records) {
        if (!scanRecordIsUsable(record, currentTime, ttlMs)) continue;
        entries += 1;
        bytes += record.metadata.size;
        oldestAccessedAt =
          oldestAccessedAt === null
            ? record.metadata.lastAccessedAt
            : Math.min(oldestAccessedAt, record.metadata.lastAccessedAt);
        newestAccessedAt =
          newestAccessedAt === null
            ? record.metadata.lastAccessedAt
            : Math.max(newestAccessedAt, record.metadata.lastAccessedAt);
      }
    });
    const [{high, low}, cleanup] = await Promise.all([waterMarks(), store.cleanupInfo()]);
    return Object.freeze({
      databaseName,
      cacheIdentity,
      entries,
      bytes,
      oldestAccessedAt,
      newestAccessedAt,
      highWaterBytes: high,
      lowWaterBytes: low,
      lastCleanupAt: cleanup?.lastCleanupAt ?? null,
      lastCleanupRemovedEntries: cleanup?.removedEntries ?? 0,
      lastCleanupRemovedBytes: cleanup?.removedBytes ?? 0
    });
  }

  async function updateCatalog(
    stats: Pick<VerifiedRemoteCacheStats, 'entries' | 'bytes' | 'lastCleanupAt'>,
    accessedAt = now()
  ): Promise<void> {
    if (!cacheIdentity) return;
    await catalog.upsert(cacheIdentity, stats, accessedAt);
    await catalog.renewLease(databaseName, instanceToken, accessedAt + leaseTtlMs);
    leaseHeld = true;
    lastCatalogTouchAt = Math.max(lastCatalogTouchAt, accessedAt);
  }

  async function touchCatalog(accessedAt: number): Promise<void> {
    if (!cacheIdentity) return;
    if (leaseHeld && accessedAt - lastCatalogTouchAt < catalogHeartbeatIntervalMs) return;
    await catalog.touch(cacheIdentity, accessedAt);
    await catalog.renewLease(databaseName, instanceToken, accessedAt + leaseTtlMs);
    leaseHeld = true;
    lastCatalogTouchAt = accessedAt;
  }

  function ensureCatalog(): Promise<void> {
    if (!cacheIdentity) return Promise.resolve();
    catalogInitialized ??= computeStats()
      .then((stats) => updateCatalog(stats))
      .catch((error) => {
        catalogInitialized = null;
        throw error;
      });
    return catalogInitialized;
  }

  async function pruneCatalog(
    incomingBytes = 0,
    force = false
  ): Promise<VerifiedRemoteStoryCachePruneResult> {
    const {high, low} = await waterMarks();
    return catalog.prune({
      highWaterBytes: high,
      lowWaterBytes: low,
      ttlMs,
      incomingBytes,
      pinnedDatabaseName: cacheIdentity?.databaseName ?? null,
      force
    });
  }

  async function physicalEntryStats(): Promise<{entries: number; bytes: number}> {
    let entries = 0;
    let bytes = 0;
    await forEachEntryBatch((records) => {
      for (const record of records) {
        entries += 1;
        if (record.entryPresent && metadataIsStructurallyValid(record.metadata)) {
          bytes += record.metadata.size;
        }
      }
    });
    return {entries, bytes};
  }

  async function pruneFor(
    incomingBytes = 0,
    pinnedKey: string | null = null,
    force = false
  ): Promise<VerifiedRemoteCachePruneResult> {
    const invalidRemoved = await cleanupInvalid();
    let stats = await computeStats();
    let removedEntries = invalidRemoved.entries;
    let removedBytes = invalidRemoved.bytes;
    let replacedBytes = 0;
    if (pinnedKey) {
      const existing = await store.getScanRecord(pinnedKey);
      if (existing && scanRecordIsUsable(existing, now(), ttlMs)) {
        replacedBytes = existing.metadata.size;
      }
    }
    const effectiveIncomingBytes = Math.max(0, incomingBytes - replacedBytes);
    const target = Math.max(
      0,
      Math.min(stats.lowWaterBytes, stats.highWaterBytes - effectiveIncomingBytes)
    );
    if (force || stats.bytes + effectiveIncomingBytes > stats.highWaterBytes) {
      while (stats.bytes > target) {
        const oldest = await store.oldestBatch(cleanupBatchSize + 1);
        const candidates: DeleteCandidate[] = [];
        let selectedBytes = 0;
        for (const record of oldest) {
          if (record.key === pinnedKey || !scanRecordIsUsable(record, now(), ttlMs)) continue;
          candidates.push(candidateFor(record));
          selectedBytes += record.metadata.size;
          if (stats.bytes - selectedBytes <= target || candidates.length >= cleanupBatchSize) break;
        }
        if (candidates.length === 0) break;
        const removed = await store.deleteBatch(candidates);
        removedEntries += removed.entries;
        removedBytes += removed.bytes;
        if (removed.entries === 0) break;
        stats = await computeStats();
      }
    }
    const after = await computeStats();
    const cleanupAt = now();
    await store.recordCleanup({
      key: 'cleanup',
      lastCleanupAt: cleanupAt,
      removedEntries,
      removedBytes
    });
    await updateCatalog({...after, lastCleanupAt: cleanupAt}).catch(() => {});
    return Object.freeze({
      databaseName,
      cacheIdentity,
      removedEntries,
      removedBytes,
      remainingEntries: after.entries,
      remainingBytes: after.bytes,
      highWaterBytes: after.highWaterBytes,
      lowWaterBytes: after.lowWaterBytes
    });
  }

  async function verifyBytes(
    bytes: OwnedBytes,
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
  ): Promise<{status: 'hit' | 'miss' | 'invalid'; bytes?: OwnedBytes}> {
    const key = `${CACHE_FORMAT_VERSION}:${input.integrity}`;
    const record = await store.get(key);
    if (!record) return {status: 'miss'};
    const currentTime = now();
    const bytes = entryBytes(record.entry, key);
    const metadataMatches =
      recordIsUsable(record, currentTime, ttlMs) &&
      record.metadata.integrity === input.integrity &&
      record.metadata.size === input.size &&
      record.metadata.contentType === input.contentType &&
      bytes?.byteLength === input.size;
    if (!metadataMatches || !bytes) {
      await store.deleteBatch([candidateFor(record)]);
      return {status: 'invalid'};
    }
    try {
      await verifyBytes(bytes, input, record.metadata.contentType);
    } catch {
      await store.deleteBatch([candidateFor(record)]);
      return {status: 'invalid'};
    }
    if (currentTime - record.metadata.lastAccessedAt >= touchIntervalMs) {
      await store.touch(key, currentTime, currentTime).catch(() => {});
    }
    return {status: 'hit', bytes};
  }

  async function writeCached(
    input: NormalizedVerifiedRemoteBinaryInput,
    bytes: OwnedBytes,
    signal?: AbortSignal
  ): Promise<{
    status: 'stored' | 'skipped' | 'failed';
    writeToken: string | null;
    warnings: VerifiedRemoteCacheWarning[];
  }> {
    const key = `${CACHE_FORMAT_VERSION}:${input.integrity}`;
    const {high} = await waterMarks();
    if (bytes.byteLength > high) {
      return {
        status: 'skipped',
        writeToken: null,
        warnings: [{operation: 'write', code: 'ASSET_CACHE_ENTRY_OVER_BUDGET'}]
      };
    }
    const writeToken = `${instanceToken}:${++writeSequence}`;
    const write = async () => {
      assertNotAborted(signal);
      const timestamp = now();
      const written = await store.putIfAbsentValid(
        {
          entry: {key, data: bytes.buffer},
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
      return written;
    };
    const catalogWarnings: VerifiedRemoteCacheWarning[] = [];
    if (cacheIdentity) {
      try {
        const catalogPrune = await pruneCatalog(bytes.byteLength);
        for (const code of catalogPrune.warnings) {
          catalogWarnings.push({operation: 'cleanup', code});
        }
      } catch (error) {
        catalogWarnings.push({
          operation: 'cleanup',
          code: diagnosticCode(error, 'ASSET_CACHE_CATALOG_FAILED')
        });
      }
    }
    try {
      await pruneFor(bytes.byteLength, key);
      const written = await write();
      if (signal?.aborted) {
        if (written) {
          await store
            .deleteBatch([
              {
                key,
                expectedWriteToken: writeToken,
                expectedSize: input.size,
                deleteIfMetadataInvalid: false,
                deleteIfMetadataMissing: false
              }
            ])
            .catch(() => {});
        }
        throw abortError();
      }
      const warnings: VerifiedRemoteCacheWarning[] = [...catalogWarnings];
      await pruneFor(0, key).catch((error) => {
        warnings.push({
          operation: 'cleanup',
          code: diagnosticCode(error, 'ASSET_CACHE_CLEANUP_FAILED')
        });
      });
      if (cacheIdentity) {
        try {
          const catalogPrune = await pruneCatalog();
          for (const code of catalogPrune.warnings) {
            warnings.push({operation: 'cleanup', code});
          }
        } catch (error) {
          warnings.push({
            operation: 'cleanup',
            code: diagnosticCode(error, 'ASSET_CACHE_CATALOG_FAILED')
          });
        }
      }
      return {status: 'stored', writeToken: written ? writeToken : null, warnings};
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (!isQuotaExceeded(error)) {
        return {
          status: 'failed',
          writeToken: null,
          warnings: [
            ...catalogWarnings,
            {operation: 'write', code: diagnosticCode(error, 'ASSET_CACHE_WRITE_FAILED')}
          ]
        };
      }
      try {
        if (cacheIdentity) {
          try {
            const catalogPrune = await pruneCatalog(bytes.byteLength, true);
            for (const code of catalogPrune.warnings) {
              catalogWarnings.push({operation: 'cleanup', code});
            }
          } catch (catalogError) {
            catalogWarnings.push({
              operation: 'cleanup',
              code: diagnosticCode(catalogError, 'ASSET_CACHE_CATALOG_FAILED')
            });
          }
        }
        await pruneFor(bytes.byteLength, key, true);
        const written = await write();
        const warnings = [...catalogWarnings];
        await pruneFor(0, key).catch((error) => {
          warnings.push({
            operation: 'cleanup',
            code: diagnosticCode(error, 'ASSET_CACHE_CLEANUP_FAILED')
          });
        });
        if (cacheIdentity) {
          try {
            const catalogPrune = await pruneCatalog();
            for (const code of catalogPrune.warnings) {
              warnings.push({operation: 'cleanup', code});
            }
          } catch (error) {
            warnings.push({
              operation: 'cleanup',
              code: diagnosticCode(error, 'ASSET_CACHE_CATALOG_FAILED')
            });
          }
        }
        return {
          status: 'stored',
          writeToken: written ? writeToken : null,
          warnings
        };
      } catch (retryError) {
        if (isAbortError(retryError)) throw retryError;
        return {
          status: 'failed',
          writeToken: null,
          warnings: [
            ...catalogWarnings,
            {operation: 'write', code: diagnosticCode(retryError, 'ASSET_CACHE_QUOTA_EXCEEDED')}
          ]
        };
      }
    }
  }

  function addWarning(
    warnings: VerifiedRemoteCacheWarning[],
    operation: VerifiedRemoteCacheWarning['operation'],
    code: string
  ): void {
    if (warnings.some((warning) => warning.operation === operation && warning.code === code)) return;
    warnings.push(Object.freeze({operation, code}));
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
      const warnings: VerifiedRemoteCacheWarning[] = [];
      assertNotAborted(resolveOptions.signal);
      try {
        await ensureInitialSweep();
      } catch (error) {
        if (isAbortError(error)) throw error;
        addWarning(warnings, 'cleanup', diagnosticCode(error, 'ASSET_CACHE_CLEANUP_FAILED'));
      }
      if (cacheIdentity) {
        try {
          await ensureCatalog();
        } catch (error) {
          addWarning(warnings, 'cleanup', diagnosticCode(error, 'ASSET_CACHE_CATALOG_FAILED'));
        }
      }
      let cacheRead: VerifiedRemoteBinaryResult['cacheRead'] = 'miss';
      try {
        const cached = await readCached(normalized);
        cacheRead = cached.status;
        if (cached.status === 'hit' && cached.bytes) {
          if (cacheIdentity) {
            await touchCatalog(now()).catch((error) => {
              addWarning(
                warnings,
                'cleanup',
                diagnosticCode(error, 'ASSET_CACHE_CATALOG_FAILED')
              );
            });
          }
          assertNotAborted(resolveOptions.signal);
          return Object.freeze({
            bytes: cached.bytes,
            contentType: normalized.contentType,
            integrity: normalized.integrity,
            source: 'indexeddb' as const,
            cacheRead,
            cacheWrite: 'not-needed' as const,
            cacheWarnings: Object.freeze([...warnings])
          });
        }
      } catch (error) {
        if (isAbortError(error)) throw error;
        cacheRead = 'failed';
        addWarning(warnings, 'read', diagnosticCode(error, 'ASSET_CACHE_READ_FAILED'));
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
      const bytes = takeBytes(loaded.bytes, loaded.transferOwnership === true);
      await verifyBytes(bytes, normalized, loaded.contentType);
      assertNotAborted(resolveOptions.signal);
      const writeResult = await writeCached(normalized, bytes, resolveOptions.signal);
      for (const warning of writeResult.warnings) {
        addWarning(warnings, warning.operation, warning.code);
      }
      if (resolveOptions.signal?.aborted) {
        if (writeResult.writeToken) {
          await store
            .deleteBatch([
              {
                key: `${CACHE_FORMAT_VERSION}:${normalized.integrity}`,
                expectedWriteToken: writeResult.writeToken,
                expectedSize: normalized.size,
                deleteIfMetadataInvalid: false,
                deleteIfMetadataMissing: false
              }
            ])
            .catch(() => {});
        }
        throw abortError();
      }
      return Object.freeze({
        bytes,
        contentType: normalized.contentType,
        integrity: normalized.integrity,
        source: 'network' as const,
        cacheRead,
        cacheWrite: writeResult.status,
        cacheWarnings: Object.freeze([...warnings])
      });
    },

    async getStats() {
      await pruneFor();
      return computeStats();
    },

    prune() {
      return pruneFor();
    },

    async clear() {
      const before = await physicalEntryStats();
      await store.clear();
      const cleanupAt = now();
      await store.recordCleanup({
        key: 'cleanup',
        lastCleanupAt: cleanupAt,
        removedEntries: before.entries,
        removedBytes: before.bytes
      });
      await updateCatalog({entries: 0, bytes: 0, lastCleanupAt: cleanupAt}).catch(() => {});
      const {high, low} = await waterMarks();
      return Object.freeze({
        databaseName,
        cacheIdentity,
        removedEntries: before.entries,
        removedBytes: before.bytes,
        remainingEntries: 0,
        remainingBytes: 0,
        highWaterBytes: high,
        lowWaterBytes: low
      });
    },

    listStoryCaches() {
      return catalog.list();
    },

    pruneStoryCaches() {
      return pruneCatalog();
    },

    async deleteStoryCache(value: unknown) {
      const target = normalizeStoryDatabaseName(value);
      let releasedOwnLease = false;
      if (cacheIdentity && target === databaseName && leaseHeld) {
        await catalog.releaseLease(databaseName, instanceToken);
        releasedOwnLease = true;
        leaseHeld = false;
      }
      let result: VerifiedRemoteStoryCacheDeleteResult;
      try {
        result = await catalog.delete(target);
      } catch (error) {
        if (releasedOwnLease) {
          await catalog
            .renewLease(databaseName, instanceToken, now() + leaseTtlMs)
            .then(
              () => {
                leaseHeld = true;
              },
              () => {}
            );
        }
        throw error;
      }
      if (result.deleted && target === databaseName) {
        store.resetIdentityState();
        initialSweep = null;
        catalogInitialized = null;
        lastCatalogTouchAt = Number.NEGATIVE_INFINITY;
        leaseHeld = false;
      }
      return result;
    },

    renewStoryCacheLease() {
      return touchCatalog(now());
    },

    async releaseStoryCacheLease() {
      if (!cacheIdentity || !leaseHeld) return;
      await catalog.releaseLease(databaseName, instanceToken);
      leaseHeld = false;
    }
  };
  return Object.freeze(cache);
}
