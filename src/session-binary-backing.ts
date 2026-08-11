import {
  type BinaryBundleFileInput,
  type BinaryBundleFileRegistration,
  type BinaryBundleKeyInput,
  type BinaryBundleOperationOptions,
  type BinaryBundleResult
} from './binary-bundle-store.js';

const DEFAULT_DATABASE_NAME = 'tw-asset-manager-session-binary-v1';
const DATABASE_VERSION = 1;
const SESSION_STORE = 'sessions';
const BUNDLE_STORE = 'sessionBinaryBundles';
const SESSION_ID_INDEX = 'sessionId';
const EXPIRES_AT_INDEX = 'expiresAt';
const FORMAT_VERSION = 1;

const DEFAULT_MAX_FILES_PER_ASSET = 256;
const DEFAULT_MAX_ASSET_BYTES = 256 * 1024 * 1024;
const DEFAULT_MAX_SESSION_ASSETS = 4096;
const DEFAULT_MAX_SESSION_BYTES = 512 * 1024 * 1024;
const DEFAULT_LEASE_TTL_MS = 60_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 20_000;
const DEFAULT_ORPHAN_CLEANUP_BATCH_SIZE = 8;
const MAX_SESSION_ID_LENGTH = 256;
const MAX_NAMESPACE_LENGTH = 512;
const MAX_NAME_LENGTH = 256;
const MAX_PATH_LENGTH = 1024;
const MAX_DATABASE_NAME_LENGTH = 256;

type OwnedBytes = Uint8Array<ArrayBuffer>;

export type SessionBinaryBackingPolicy = 'prefer' | 'required' | 'disabled';
export type SessionBinaryBackingMode = 'session' | 'direct';

export interface SessionBinaryBackingAssetInput extends BinaryBundleKeyInput {
  readonly files: ReadonlyArray<BinaryBundleFileRegistration>;
}

export interface SessionBinaryBackingSourceAsset extends BinaryBundleKeyInput {
  readonly files: ReadonlyArray<BinaryBundleFileInput>;
}

export interface SessionBinaryBackingSource {
  read(
    asset: SessionBinaryBackingAssetInput,
    options?: BinaryBundleOperationOptions
  ): Promise<SessionBinaryBackingSourceAsset>;
  release(): Promise<void> | void;
}

export interface SessionBinaryBackingWarning {
  readonly code: 'ASSET_SESSION_BINARY_DIRECT_FALLBACK';
  readonly causeCode: string;
}

export interface SessionBinaryBackingInput {
  readonly policy: unknown;
  readonly sessionId: unknown;
  readonly assets: ReadonlyArray<SessionBinaryBackingAssetInput>;
  readonly source: SessionBinaryBackingSource;
  readonly onFatalError?: (error: Error) => void;
}

export interface SessionBinaryBackingOptions {
  readonly indexedDB?: IDBFactory;
  readonly subtleCrypto?: SubtleCrypto;
  readonly databaseName?: string;
  readonly now?: () => number;
  readonly maxFilesPerAsset?: number;
  readonly maxAssetBytes?: number;
  readonly maxSessionAssets?: number;
  readonly maxSessionBytes?: number;
  readonly leaseTtlMs?: number;
  readonly heartbeatIntervalMs?: number;
  readonly orphanCleanupBatchSize?: number;
}

export interface SessionBinaryBacking {
  readonly sessionId: string;
  readonly mode: SessionBinaryBackingMode;
  readonly warning?: SessionBinaryBackingWarning;
  get(
    input: BinaryBundleKeyInput,
    options?: BinaryBundleOperationOptions
  ): Promise<BinaryBundleResult>;
  renewLease(): Promise<void>;
  dispose(): Promise<void>;
}

type NormalizedFileRegistration = {
  path: string;
  size: number;
  integrity: string;
};

type NormalizedAsset = {
  namespace: string;
  name: string;
  integrity: string;
  files: NormalizedFileRegistration[];
  totalBytes: number;
  lookupKey: string;
};

type ValidatedFile = NormalizedFileRegistration & {
  bytes: OwnedBytes;
};

type StoredFile = NormalizedFileRegistration & {
  data: ArrayBuffer;
};

type StoredBundle = {
  formatVersion: number;
  sessionId: string;
  namespace: string;
  name: string;
  integrity: string;
  files: StoredFile[];
  totalBytes: number;
};

type SessionRecord = {
  formatVersion: number;
  sessionId: string;
  state: 'establishing' | 'active';
  expectedAssets: number;
  committedAssets: number;
  committedBytes: number;
  createdAt: number;
  heartbeatAt: number;
  expiresAt: number;
};

type NormalizedInput = {
  policy: SessionBinaryBackingPolicy;
  sessionId: string;
  assets: NormalizedAsset[];
  assetsByKey: Map<string, NormalizedAsset>;
  source: SessionBinaryBackingSource;
  onFatalError?: (error: Error) => void;
};

type NormalizedOptions = {
  indexedDB: IDBFactory | undefined;
  subtleCrypto: SubtleCrypto | undefined;
  databaseName: string;
  now: () => number;
  leaseTtlMs: number;
  heartbeatIntervalMs: number;
  orphanCleanupBatchSize: number;
};

function sessionError(code: string, message: string, cause?: unknown): Error {
  const error = new Error(message, cause === undefined ? undefined : {cause});
  Object.defineProperty(error, 'code', {value: code, enumerable: true});
  return error;
}

function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : '';
}

function abortError(cause?: unknown): Error {
  const error = sessionError(
    'ASSET_SESSION_BINARY_ABORTED',
    'Session binary backing operation was aborted.',
    cause
  );
  error.name = 'AbortError';
  return error;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal.reason);
}

function requireRecord(value: unknown, label: string): Record<PropertyKey, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw sessionError('ASSET_SESSION_BINARY_INPUT_INVALID', `${label} must be an object.`);
  }
  return value as Record<PropertyKey, unknown>;
}

function requireSourceRecord(value: unknown, label: string): Record<PropertyKey, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw sessionError('ASSET_SESSION_BINARY_SOURCE_INVALID', `${label} must be an object.`);
  }
  return value as Record<PropertyKey, unknown>;
}

function requireString(value: unknown, label: string, maxLength: number): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength ||
    value.includes('\0')
  ) {
    throw sessionError(
      'ASSET_SESSION_BINARY_INPUT_INVALID',
      `${label} must be a non-empty string of at most ${maxLength} code units.`
    );
  }
  return value;
}

function requireLimit(value: number | undefined, fallback: number, label: string): number {
  const normalized = value ?? fallback;
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`);
  }
  return normalized;
}

function currentTime(now: () => number): number {
  const value = now();
  if (!Number.isSafeInteger(value) || value < 0) {
    throw sessionError(
      'ASSET_SESSION_BINARY_CLOCK_INVALID',
      'Session binary backing clock must return a non-negative safe integer.'
    );
  }
  return value;
}

function isLowerHexSha256(value: string): boolean {
  if (value.length !== 64) return false;
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (!((code >= 48 && code <= 57) || (code >= 97 && code <= 102))) return false;
  }
  return true;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}

function integrityIsCanonical(value: string): boolean {
  if (!value.startsWith('sha256-')) return false;
  const payload = value.slice('sha256-'.length);
  if (isLowerHexSha256(payload)) return true;
  try {
    const decoded = Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
    return decoded.byteLength === 32 && toBase64(decoded) === payload;
  } catch {
    return false;
  }
}

function normalizeIntegrity(value: unknown, label: string): string {
  const integrity = requireString(value, label, 96);
  if (!integrityIsCanonical(integrity)) {
    throw sessionError(
      'ASSET_SESSION_BINARY_INPUT_INVALID',
      `${label} must contain canonical SHA-256 hex or base64.`
    );
  }
  return integrity;
}

function pathIsSafe(path: string): boolean {
  return Boolean(
    path.length > 0 &&
      path.length <= MAX_PATH_LENGTH &&
      !path.startsWith('/') &&
      !path.startsWith('\\') &&
      !path.includes('\\') &&
      !path.split('/').some((part) => part.length === 0 || part === '.' || part === '..')
  );
}

function normalizePath(value: unknown): string {
  const path = requireString(value, 'session binary file path', MAX_PATH_LENGTH);
  if (!pathIsSafe(path)) {
    throw sessionError(
      'ASSET_SESSION_BINARY_INPUT_INVALID',
      'Session binary file path must be a safe relative path.'
    );
  }
  return path;
}

function lookupKey(namespace: string, name: string, integrity: string): string {
  return JSON.stringify([namespace, name, integrity]);
}

function normalizeKey(input: BinaryBundleKeyInput): {
  namespace: string;
  name: string;
  integrity: string;
  lookupKey: string;
} {
  requireRecord(input, 'session binary asset key');
  const namespace = requireString(
    input.namespace,
    'session binary asset namespace',
    MAX_NAMESPACE_LENGTH
  );
  const name = requireString(input.name, 'session binary asset name', MAX_NAME_LENGTH);
  const integrity = normalizeIntegrity(input.integrity, 'session binary asset integrity');
  return {namespace, name, integrity, lookupKey: lookupKey(namespace, name, integrity)};
}

function normalizeFileRegistration(value: unknown): NormalizedFileRegistration {
  const file = requireRecord(value, 'session binary file descriptor');
  const path = normalizePath(file.path);
  if (!Number.isSafeInteger(file.size) || Number(file.size) < 0) {
    throw sessionError(
      'ASSET_SESSION_BINARY_INPUT_INVALID',
      `Session binary file size is invalid: ${path}`
    );
  }
  return {
    path,
    size: Number(file.size),
    integrity: normalizeIntegrity(file.integrity, `session binary file integrity for ${path}`)
  };
}

function ownBytes(value: unknown): OwnedBytes {
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  throw sessionError(
    'ASSET_SESSION_BINARY_SOURCE_INVALID',
    'Session binary source bytes must be an ArrayBuffer or Uint8Array.'
  );
}

function normalizeOptions(options: SessionBinaryBackingOptions): NormalizedOptions & {
  maxFilesPerAsset: number;
  maxAssetBytes: number;
  maxSessionAssets: number;
  maxSessionBytes: number;
} {
  requireRecord(options, 'session binary backing options');
  const databaseName = requireString(
    options.databaseName ?? DEFAULT_DATABASE_NAME,
    'session binary database name',
    MAX_DATABASE_NAME_LENGTH
  );
  const leaseTtlMs = requireLimit(options.leaseTtlMs, DEFAULT_LEASE_TTL_MS, 'leaseTtlMs');
  const heartbeatIntervalMs = requireLimit(
    options.heartbeatIntervalMs,
    DEFAULT_HEARTBEAT_INTERVAL_MS,
    'heartbeatIntervalMs'
  );
  if (heartbeatIntervalMs >= leaseTtlMs) {
    throw new TypeError('heartbeatIntervalMs must be less than leaseTtlMs.');
  }
  return {
    indexedDB: options.indexedDB ?? globalThis.indexedDB,
    subtleCrypto: options.subtleCrypto ?? globalThis.crypto?.subtle,
    databaseName,
    now: options.now ?? Date.now,
    maxFilesPerAsset: requireLimit(
      options.maxFilesPerAsset,
      DEFAULT_MAX_FILES_PER_ASSET,
      'maxFilesPerAsset'
    ),
    maxAssetBytes: requireLimit(
      options.maxAssetBytes,
      DEFAULT_MAX_ASSET_BYTES,
      'maxAssetBytes'
    ),
    maxSessionAssets: requireLimit(
      options.maxSessionAssets,
      DEFAULT_MAX_SESSION_ASSETS,
      'maxSessionAssets'
    ),
    maxSessionBytes: requireLimit(
      options.maxSessionBytes,
      DEFAULT_MAX_SESSION_BYTES,
      'maxSessionBytes'
    ),
    leaseTtlMs,
    heartbeatIntervalMs,
    orphanCleanupBatchSize: requireLimit(
      options.orphanCleanupBatchSize,
      DEFAULT_ORPHAN_CLEANUP_BATCH_SIZE,
      'orphanCleanupBatchSize'
    )
  };
}

function normalizeInput(
  input: SessionBinaryBackingInput,
  limits: ReturnType<typeof normalizeOptions>
): NormalizedInput {
  requireRecord(input, 'session binary backing input');
  if (input.policy !== 'prefer' && input.policy !== 'required' && input.policy !== 'disabled') {
    throw sessionError(
      'ASSET_SESSION_BINARY_INPUT_INVALID',
      'Session binary backing policy must be prefer, required, or disabled.'
    );
  }
  const sessionId = requireString(
    input.sessionId,
    'session binary session ID',
    MAX_SESSION_ID_LENGTH
  );
  if (!Array.isArray(input.assets) || input.assets.length === 0) {
    throw sessionError(
      'ASSET_SESSION_BINARY_INPUT_INVALID',
      'Session binary backing assets must be a non-empty array.'
    );
  }
  if (input.assets.length > limits.maxSessionAssets) {
    throw sessionError(
      'ASSET_SESSION_BINARY_LIMIT_EXCEEDED',
      'Session binary backing exceeds maxSessionAssets.'
    );
  }
  if (
    !input.source ||
    typeof input.source !== 'object' ||
    typeof input.source.read !== 'function' ||
    typeof input.source.release !== 'function'
  ) {
    throw sessionError(
      'ASSET_SESSION_BINARY_INPUT_INVALID',
      'Session binary backing source must provide read and release.'
    );
  }
  if (input.onFatalError !== undefined && typeof input.onFatalError !== 'function') {
    throw sessionError(
      'ASSET_SESSION_BINARY_INPUT_INVALID',
      'Session binary onFatalError must be a function.'
    );
  }
  const assets: NormalizedAsset[] = [];
  const assetsByKey = new Map<string, NormalizedAsset>();
  let sessionBytes = 0;
  for (const inputAsset of input.assets) {
    const key = normalizeKey(inputAsset);
    if (!Array.isArray(inputAsset.files) || inputAsset.files.length === 0) {
      throw sessionError(
        'ASSET_SESSION_BINARY_INPUT_INVALID',
        `Session binary asset must contain files: ${key.name}`
      );
    }
    if (inputAsset.files.length > limits.maxFilesPerAsset) {
      throw sessionError(
        'ASSET_SESSION_BINARY_LIMIT_EXCEEDED',
        `Session binary asset exceeds maxFilesPerAsset: ${key.name}`
      );
    }
    const paths = new Set<string>();
    const files: NormalizedFileRegistration[] = inputAsset.files.map((file: unknown) => {
      const normalized = normalizeFileRegistration(file);
      if (paths.has(normalized.path)) {
        throw sessionError(
          'ASSET_SESSION_BINARY_INPUT_INVALID',
          `Session binary asset contains a duplicate path: ${normalized.path}`
        );
      }
      paths.add(normalized.path);
      return normalized;
    });
    files.sort((left: NormalizedFileRegistration, right: NormalizedFileRegistration) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0
    );
    const totalBytes = files.reduce(
      (sum: number, file: NormalizedFileRegistration) => sum + file.size,
      0
    );
    if (!Number.isSafeInteger(totalBytes) || totalBytes > limits.maxAssetBytes) {
      throw sessionError(
        'ASSET_SESSION_BINARY_LIMIT_EXCEEDED',
        `Session binary asset exceeds maxAssetBytes: ${key.name}`
      );
    }
    sessionBytes += totalBytes;
    if (!Number.isSafeInteger(sessionBytes) || sessionBytes > limits.maxSessionBytes) {
      throw sessionError(
        'ASSET_SESSION_BINARY_LIMIT_EXCEEDED',
        'Session binary backing exceeds maxSessionBytes.'
      );
    }
    if (assetsByKey.has(key.lookupKey)) {
      throw sessionError(
        'ASSET_SESSION_BINARY_INPUT_INVALID',
        `Session binary backing contains a duplicate asset: ${key.name}`
      );
    }
    const asset = {...key, files, totalBytes};
    assets.push(asset);
    assetsByKey.set(key.lookupKey, asset);
  }
  assets.sort((left, right) =>
    left.lookupKey < right.lookupKey ? -1 : left.lookupKey > right.lookupKey ? 1 : 0
  );
  return {
    policy: input.policy,
    sessionId,
    assets,
    assetsByKey,
    source: input.source,
    ...(input.onFatalError === undefined ? {} : {onFatalError: input.onFatalError})
  };
}

function operationSignal(options: BinaryBundleOperationOptions): AbortSignal | undefined {
  requireRecord(options, 'session binary operation options');
  if (options.signal === undefined) return undefined;
  const signal = options.signal;
  if (
    !signal ||
    typeof signal !== 'object' ||
    typeof signal.aborted !== 'boolean' ||
    typeof signal.addEventListener !== 'function' ||
    typeof signal.removeEventListener !== 'function'
  ) {
    throw sessionError(
      'ASSET_SESSION_BINARY_INPUT_INVALID',
      'Session binary operation signal must be an AbortSignal.'
    );
  }
  return signal;
}

function linkSignals(external: AbortSignal | undefined, internal: AbortSignal): {
  signal: AbortSignal;
  release: () => void;
} {
  if (!external) return {signal: internal, release() {}};
  const controller = new AbortController();
  const abort = () => controller.abort();
  external.addEventListener('abort', abort, {once: true});
  internal.addEventListener('abort', abort, {once: true});
  if (external.aborted || internal.aborted) abort();
  return {
    signal: controller.signal,
    release() {
      external.removeEventListener('abort', abort);
      internal.removeEventListener('abort', abort);
    }
  };
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function verifyIntegrity(
  bytes: OwnedBytes,
  integrity: string,
  subtleCrypto: SubtleCrypto | undefined,
  code: 'ASSET_SESSION_BINARY_SOURCE_INTEGRITY_MISMATCH' | 'ASSET_SESSION_BINARY_INTEGRITY_MISMATCH'
): Promise<void> {
  if (!subtleCrypto || typeof subtleCrypto.digest !== 'function') {
    throw sessionError(
      'ASSET_SESSION_BINARY_CRYPTO_UNAVAILABLE',
      'SHA-256 is not available for session binary verification.'
    );
  }
  const digest = new Uint8Array(await subtleCrypto.digest('SHA-256', bytes));
  const expected = integrity.slice('sha256-'.length);
  const actual = isLowerHexSha256(expected) ? toHex(digest) : toBase64(digest);
  if (actual !== expected) {
    throw sessionError(code, 'Session binary file integrity does not match its bytes.');
  }
}

async function readSourceAsset(
  source: SessionBinaryBackingSource,
  asset: NormalizedAsset,
  subtleCrypto: SubtleCrypto | undefined,
  signal: AbortSignal
): Promise<ValidatedFile[]> {
  assertNotAborted(signal);
  const publicAsset = Object.freeze({
    namespace: asset.namespace,
    name: asset.name,
    integrity: asset.integrity,
    files: Object.freeze(asset.files.map((file) => Object.freeze({...file})))
  });
  let loaded: SessionBinaryBackingSourceAsset;
  try {
    loaded = await source.read(publicAsset, {signal});
  } catch (error) {
    if (signal.aborted) throw abortError(error);
    if (errorCode(error).startsWith('ASSET_SESSION_BINARY_SOURCE_')) throw error;
    throw sessionError(
      'ASSET_SESSION_BINARY_SOURCE_READ_FAILED',
      `Session binary source could not read asset: ${asset.name}`,
      error
    );
  }
  const loadedRecord = requireSourceRecord(loaded, 'session binary source asset');
  if (
    loadedRecord.namespace !== asset.namespace ||
    loadedRecord.name !== asset.name ||
    loadedRecord.integrity !== asset.integrity ||
    !Array.isArray(loadedRecord.files) ||
    loadedRecord.files.length !== asset.files.length
  ) {
    throw sessionError(
      'ASSET_SESSION_BINARY_SOURCE_INVALID',
      `Session binary source metadata does not match: ${asset.name}`
    );
  }
  const expectedByPath = new Map(asset.files.map((file) => [file.path, file]));
  const seen = new Set<string>();
  const files: ValidatedFile[] = [];
  for (const loadedFile of loadedRecord.files) {
    const record = requireSourceRecord(loadedFile, 'session binary source file');
    const path = typeof record.path === 'string' ? record.path : '';
    const expected = expectedByPath.get(path);
    if (
      !expected ||
      seen.has(path) ||
      record.size !== expected.size ||
      record.integrity !== expected.integrity
    ) {
      throw sessionError(
        'ASSET_SESSION_BINARY_SOURCE_INVALID',
        `Session binary source file metadata does not match: ${asset.name}`
      );
    }
    seen.add(path);
    const bytes = ownBytes(record.bytes);
    if (bytes.byteLength !== expected.size) {
      throw sessionError(
        'ASSET_SESSION_BINARY_SOURCE_INVALID',
        `Session binary source file size does not match: ${asset.name}/${path}`
      );
    }
    await verifyIntegrity(
      bytes,
      expected.integrity,
      subtleCrypto,
      'ASSET_SESSION_BINARY_SOURCE_INTEGRITY_MISMATCH'
    );
    files.push({...expected, bytes});
  }
  files.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  assertNotAborted(signal);
  return files;
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

function isDomException(error: unknown, name: string): boolean {
  return error instanceof DOMException && error.name === name;
}

function mapStorageError(error: unknown, operation: string, signal?: AbortSignal): Error {
  if (signal?.aborted || isDomException(error, 'AbortError')) return abortError(error);
  if (errorCode(error).startsWith('ASSET_SESSION_BINARY_')) return error as Error;
  if (isDomException(error, 'QuotaExceededError')) {
    return sessionError(
      'ASSET_SESSION_BINARY_QUOTA_EXCEEDED',
      `Session binary ${operation} exceeded IndexedDB quota.`,
      error
    );
  }
  if (isDomException(error, 'InvalidStateError')) {
    return sessionError(
      'ASSET_SESSION_BINARY_CONNECTION_CLOSED',
      `Session binary ${operation} used a closed IndexedDB connection.`,
      error
    );
  }
  return sessionError(
    'ASSET_SESSION_BINARY_TRANSACTION_FAILED',
    `Session binary ${operation} transaction failed.`,
    error
  );
}

async function openDatabase(
  options: NormalizedOptions,
  signal?: AbortSignal
): Promise<IDBDatabase> {
  assertNotAborted(signal);
  const indexedDB = options.indexedDB;
  if (!indexedDB || typeof indexedDB.open !== 'function') {
    throw sessionError(
      'ASSET_SESSION_BINARY_INDEXEDDB_UNAVAILABLE',
      'IndexedDB is not available for session binary backing.'
    );
  }
  let request: IDBOpenDBRequest;
  try {
    request = indexedDB.open(options.databaseName, DATABASE_VERSION);
  } catch (error) {
    throw sessionError(
      'ASSET_SESSION_BINARY_INDEXEDDB_UNAVAILABLE',
      'The session binary IndexedDB database could not be opened.',
      error
    );
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => rejectOnce(abortError(signal?.reason));
    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      reject(error);
    };
    signal?.addEventListener('abort', abort, {once: true});
    if (signal?.aborted) abort();
    request.onupgradeneeded = () => {
      const database = request.result;
      let sessions: IDBObjectStore;
      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        sessions = database.createObjectStore(SESSION_STORE, {keyPath: 'sessionId'});
      } else {
        sessions = request.transaction!.objectStore(SESSION_STORE);
      }
      if (!sessions.indexNames.contains(EXPIRES_AT_INDEX)) {
        sessions.createIndex(EXPIRES_AT_INDEX, 'expiresAt');
      }
      let bundles: IDBObjectStore;
      if (!database.objectStoreNames.contains(BUNDLE_STORE)) {
        bundles = database.createObjectStore(BUNDLE_STORE, {
          keyPath: ['sessionId', 'namespace', 'name']
        });
      } else {
        bundles = request.transaction!.objectStore(BUNDLE_STORE);
      }
      if (!bundles.indexNames.contains(SESSION_ID_INDEX)) {
        bundles.createIndex(SESSION_ID_INDEX, 'sessionId');
      }
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      signal?.removeEventListener('abort', abort);
      resolve(request.result);
    };
    request.onerror = () =>
      rejectOnce(
        sessionError(
          'ASSET_SESSION_BINARY_INDEXEDDB_UNAVAILABLE',
          'The session binary IndexedDB open request failed.',
          request.error
        )
      );
    request.onblocked = () =>
      rejectOnce(
        sessionError(
          'ASSET_SESSION_BINARY_INDEXEDDB_BLOCKED',
          'The session binary IndexedDB open request was blocked.'
        )
      );
  });
}

function sessionRecordIsValid(value: unknown, sessionId?: string): value is SessionRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<SessionRecord>;
  return Boolean(
    record.formatVersion === FORMAT_VERSION &&
      typeof record.sessionId === 'string' &&
      (sessionId === undefined || record.sessionId === sessionId) &&
      (record.state === 'establishing' || record.state === 'active') &&
      Number.isSafeInteger(record.expectedAssets) &&
      Number(record.expectedAssets) > 0 &&
      Number.isSafeInteger(record.committedAssets) &&
      Number(record.committedAssets) >= 0 &&
      Number(record.committedAssets) <= Number(record.expectedAssets) &&
      Number.isSafeInteger(record.committedBytes) &&
      Number(record.committedBytes) >= 0 &&
      Number.isSafeInteger(record.createdAt) &&
      Number(record.createdAt) >= 0 &&
      Number.isSafeInteger(record.heartbeatAt) &&
      Number(record.heartbeatAt) >= Number(record.createdAt) &&
      Number.isSafeInteger(record.expiresAt) &&
      Number(record.expiresAt) > Number(record.heartbeatAt)
  );
}

function storedBundleIsValid(
  value: unknown,
  sessionId: string,
  asset: NormalizedAsset
): value is StoredBundle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<StoredBundle>;
  if (
    record.formatVersion !== FORMAT_VERSION ||
    record.sessionId !== sessionId ||
    record.namespace !== asset.namespace ||
    record.name !== asset.name ||
    record.integrity !== asset.integrity ||
    record.totalBytes !== asset.totalBytes ||
    !Array.isArray(record.files) ||
    record.files.length !== asset.files.length
  ) {
    return false;
  }
  return record.files.every((file, index) => {
    const expected = asset.files[index];
    return Boolean(
      expected &&
        file &&
        typeof file === 'object' &&
        file.path === expected.path &&
        file.size === expected.size &&
        file.integrity === expected.integrity &&
        file.data instanceof ArrayBuffer &&
        file.data.byteLength === expected.size
    );
  });
}

function createSessionRecord(
  sessionId: string,
  expectedAssets: number,
  timestamp: number,
  leaseTtlMs: number
): SessionRecord {
  return {
    formatVersion: FORMAT_VERSION,
    sessionId,
    state: 'establishing',
    expectedAssets,
    committedAssets: 0,
    committedBytes: 0,
    createdAt: timestamp,
    heartbeatAt: timestamp,
    expiresAt: timestamp + leaseTtlMs
  };
}

async function addSession(
  database: IDBDatabase,
  record: SessionRecord,
  signal: AbortSignal
): Promise<void> {
  assertNotAborted(signal);
  try {
    const transaction = database.transaction(SESSION_STORE, 'readwrite');
    const abort = () => transaction.abort();
    signal.addEventListener('abort', abort, {once: true});
    transaction.objectStore(SESSION_STORE).add(record);
    try {
      await transactionComplete(transaction);
    } finally {
      signal.removeEventListener('abort', abort);
    }
  } catch (error) {
    if (isDomException(error, 'ConstraintError')) {
      throw sessionError(
        'ASSET_SESSION_BINARY_SESSION_CONFLICT',
        `Session binary session already exists: ${record.sessionId}`,
        error
      );
    }
    throw mapStorageError(error, 'session creation', signal);
  }
}

async function putBundle(
  database: IDBDatabase,
  sessionId: string,
  asset: NormalizedAsset,
  files: ValidatedFile[],
  signal: AbortSignal
): Promise<void> {
  assertNotAborted(signal);
  let semanticError: unknown;
  let transaction: IDBTransaction;
  try {
    transaction = database.transaction([SESSION_STORE, BUNDLE_STORE], 'readwrite');
  } catch (error) {
    throw mapStorageError(error, 'asset write', signal);
  }
  const abort = () => transaction.abort();
  signal.addEventListener('abort', abort, {once: true});
  const sessions = transaction.objectStore(SESSION_STORE);
  const request = sessions.get(sessionId) as IDBRequest<unknown>;
  request.onsuccess = () => {
    try {
      if (!sessionRecordIsValid(request.result, sessionId) || request.result.state !== 'establishing') {
        throw sessionError(
          'ASSET_SESSION_BINARY_CORRUPT',
          'Session binary metadata is missing or corrupt during establishment.'
        );
      }
      const record: StoredBundle = {
        formatVersion: FORMAT_VERSION,
        sessionId,
        namespace: asset.namespace,
        name: asset.name,
        integrity: asset.integrity,
        files: files.map(({path, size, integrity, bytes}) => ({
          path,
          size,
          integrity,
          data: bytes.buffer
        })),
        totalBytes: asset.totalBytes
      };
      transaction.objectStore(BUNDLE_STORE).put(record);
      sessions.put({
        ...request.result,
        committedAssets: request.result.committedAssets + 1,
        committedBytes: request.result.committedBytes + asset.totalBytes
      });
    } catch (error) {
      semanticError = error;
      try {
        transaction.abort();
      } catch {
        // The transaction already failed.
      }
    }
  };
  try {
    await transactionComplete(transaction);
  } catch (error) {
    throw mapStorageError(semanticError ?? error, 'asset write', signal);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

async function readBundle(
  database: IDBDatabase,
  sessionId: string,
  asset: NormalizedAsset,
  subtleCrypto: SubtleCrypto | undefined,
  signal: AbortSignal
): Promise<BinaryBundleResult> {
  assertNotAborted(signal);
  let record: unknown;
  let transaction: IDBTransaction;
  try {
    transaction = database.transaction(BUNDLE_STORE, 'readonly');
    const abort = () => transaction.abort();
    signal.addEventListener('abort', abort, {once: true});
    try {
      record = await requestResult(
        transaction.objectStore(BUNDLE_STORE).get([sessionId, asset.namespace, asset.name])
      );
      await transactionComplete(transaction);
    } finally {
      signal.removeEventListener('abort', abort);
    }
  } catch (error) {
    throw mapStorageError(error, 'asset read', signal);
  }
  if (record === undefined) {
    throw sessionError(
      'ASSET_SESSION_BINARY_NOT_FOUND',
      `Session binary asset was not found: ${asset.name}`
    );
  }
  if (!storedBundleIsValid(record, sessionId, asset)) {
    throw sessionError(
      'ASSET_SESSION_BINARY_CORRUPT',
      `Session binary asset is incomplete or corrupt: ${asset.name}`
    );
  }
  const files = [];
  for (const file of record.files) {
    assertNotAborted(signal);
    const bytes = new Uint8Array(file.data);
    await verifyIntegrity(
      bytes,
      file.integrity,
      subtleCrypto,
      'ASSET_SESSION_BINARY_INTEGRITY_MISMATCH'
    );
    files.push(Object.freeze({
      path: file.path,
      size: file.size,
      integrity: file.integrity,
      bytes
    }));
  }
  return Object.freeze({
    namespace: asset.namespace,
    name: asset.name,
    integrity: asset.integrity,
    files: Object.freeze(files),
    totalBytes: asset.totalBytes
  });
}

async function activateSession(
  database: IDBDatabase,
  sessionId: string,
  expectedAssets: number,
  expectedBytes: number,
  timestamp: number,
  leaseTtlMs: number,
  signal: AbortSignal
): Promise<void> {
  assertNotAborted(signal);
  let semanticError: unknown;
  let transaction: IDBTransaction;
  try {
    transaction = database.transaction(SESSION_STORE, 'readwrite');
  } catch (error) {
    throw mapStorageError(error, 'session activation', signal);
  }
  const abort = () => transaction.abort();
  signal.addEventListener('abort', abort, {once: true});
  const store = transaction.objectStore(SESSION_STORE);
  const request = store.get(sessionId) as IDBRequest<unknown>;
  request.onsuccess = () => {
    try {
      if (
        !sessionRecordIsValid(request.result, sessionId) ||
        request.result.state !== 'establishing' ||
        request.result.committedAssets !== expectedAssets ||
        request.result.committedBytes !== expectedBytes
      ) {
        throw sessionError(
          'ASSET_SESSION_BINARY_CORRUPT',
          'Session binary establishment metadata did not pass read-back verification.'
        );
      }
      store.put({
        ...request.result,
        state: 'active',
        heartbeatAt: timestamp,
        expiresAt: timestamp + leaseTtlMs
      });
    } catch (error) {
      semanticError = error;
      try {
        transaction.abort();
      } catch {
        // The transaction already failed.
      }
    }
  };
  try {
    await transactionComplete(transaction);
  } catch (error) {
    throw mapStorageError(semanticError ?? error, 'session activation', signal);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

async function renewSession(
  database: IDBDatabase,
  sessionId: string,
  timestamp: number,
  leaseTtlMs: number,
  signal?: AbortSignal
): Promise<void> {
  assertNotAborted(signal);
  let semanticError: unknown;
  let transaction: IDBTransaction;
  try {
    transaction = database.transaction(SESSION_STORE, 'readwrite');
  } catch (error) {
    throw mapStorageError(error, 'lease renewal', signal);
  }
  const store = transaction.objectStore(SESSION_STORE);
  const request = store.get(sessionId) as IDBRequest<unknown>;
  request.onsuccess = () => {
    try {
      if (!sessionRecordIsValid(request.result, sessionId) || request.result.state !== 'active') {
        throw sessionError(
          'ASSET_SESSION_BINARY_NOT_FOUND',
          'Active session binary lease metadata is missing or corrupt.'
        );
      }
      store.put({
        ...request.result,
        heartbeatAt: timestamp,
        expiresAt: timestamp + leaseTtlMs
      });
    } catch (error) {
      semanticError = error;
      try {
        transaction.abort();
      } catch {
        // The transaction already failed.
      }
    }
  };
  try {
    await transactionComplete(transaction);
  } catch (error) {
    throw mapStorageError(semanticError ?? error, 'lease renewal', signal);
  }
}

async function deleteSessionRecords(
  database: IDBDatabase,
  sessionId: string,
  expiredAtOrBefore?: number
): Promise<void> {
  let transaction: IDBTransaction;
  try {
    transaction = database.transaction([SESSION_STORE, BUNDLE_STORE], 'readwrite');
  } catch (error) {
    throw mapStorageError(error, 'session cleanup');
  }
  const sessions = transaction.objectStore(SESSION_STORE);
  const bundles = transaction.objectStore(BUNDLE_STORE);
  const removeBundles = () => {
    const cursorRequest = bundles.index(SESSION_ID_INDEX).openCursor(sessionId);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    sessions.delete(sessionId);
  };
  if (expiredAtOrBefore === undefined) {
    removeBundles();
  } else {
    const request = sessions.get(sessionId) as IDBRequest<unknown>;
    request.onsuccess = () => {
      if (
        sessionRecordIsValid(request.result, sessionId) &&
        request.result.expiresAt <= expiredAtOrBefore
      ) {
        removeBundles();
      }
    };
  }
  try {
    await transactionComplete(transaction);
  } catch (error) {
    throw mapStorageError(error, 'session cleanup');
  }
}

async function expiredSessionIds(
  database: IDBDatabase,
  timestamp: number,
  limit: number
): Promise<string[]> {
  const ids: string[] = [];
  let transaction: IDBTransaction;
  try {
    transaction = database.transaction(SESSION_STORE, 'readonly');
  } catch (error) {
    throw mapStorageError(error, 'orphan scan');
  }
  const request = transaction.objectStore(SESSION_STORE).index(EXPIRES_AT_INDEX).openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor || ids.length >= limit || Number(cursor.key) > timestamp) return;
    if (sessionRecordIsValid(cursor.value) && cursor.value.expiresAt <= timestamp) {
      ids.push(cursor.value.sessionId);
    }
    cursor.continue();
  };
  try {
    await transactionComplete(transaction);
  } catch (error) {
    throw mapStorageError(error, 'orphan scan');
  }
  return ids;
}

async function cleanupOrphans(
  database: IDBDatabase,
  timestamp: number,
  limit: number
): Promise<void> {
  const ids = await expiredSessionIds(database, timestamp, limit);
  for (const sessionId of ids) {
    await deleteSessionRecords(database, sessionId, timestamp);
  }
}

function fallbackEligible(error: unknown): boolean {
  return new Set([
    'ASSET_SESSION_BINARY_INDEXEDDB_UNAVAILABLE',
    'ASSET_SESSION_BINARY_INDEXEDDB_BLOCKED',
    'ASSET_SESSION_BINARY_QUOTA_EXCEEDED',
    'ASSET_SESSION_BINARY_ABORTED'
  ]).has(errorCode(error));
}

async function releaseSource(source: SessionBinaryBackingSource): Promise<void> {
  try {
    await source.release();
  } catch (error) {
    throw sessionError(
      'ASSET_SESSION_BINARY_SOURCE_RELEASE_FAILED',
      'Session binary source could not be released.',
      error
    );
  }
}

function closeDatabase(database: IDBDatabase | null): void {
  database?.close();
}

function publicDirectResult(asset: NormalizedAsset, files: ValidatedFile[]): BinaryBundleResult {
  return Object.freeze({
    namespace: asset.namespace,
    name: asset.name,
    integrity: asset.integrity,
    files: Object.freeze(
      files.map(({path, size, integrity, bytes}) =>
        Object.freeze({path, size, integrity, bytes})
      )
    ),
    totalBytes: asset.totalBytes
  });
}

function createEstablishedBacking({
  input,
  options,
  mode,
  database,
  source,
  warning
}: {
  input: NormalizedInput;
  options: NormalizedOptions;
  mode: SessionBinaryBackingMode;
  database: IDBDatabase | null;
  source: SessionBinaryBackingSource | null;
  warning?: SessionBinaryBackingWarning;
}): SessionBinaryBacking {
  const controller = new AbortController();
  const activeOperations = new Set<Promise<unknown>>();
  let disposed = false;
  let disposePromise: Promise<void> | null = null;
  let fatalError: Error | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closingDatabase = false;

  const notifyFatal = (error: Error): Error => {
    if (!fatalError) {
      fatalError = error;
      controller.abort();
      if (heartbeat !== null) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      try {
        input.onFatalError?.(error);
      } catch {
        // A diagnostic callback cannot replace the authoritative failure.
      }
    }
    return fatalError;
  };

  const ensureUsable = () => {
    if (disposed) {
      throw sessionError(
        'ASSET_SESSION_BINARY_RELEASED',
        'Session binary backing has been disposed.'
      );
    }
    if (fatalError) throw fatalError;
  };

  if (database) {
    const closeFailure = () => {
      if (closingDatabase || disposed) return;
      notifyFatal(
        sessionError(
          'ASSET_SESSION_BINARY_CONNECTION_CLOSED',
          'The session binary IndexedDB connection closed unexpectedly.'
        )
      );
    };
    database.addEventListener('versionchange', () => {
      closeFailure();
      closingDatabase = true;
      database.close();
    });
    database.addEventListener('close', closeFailure);
  }

  const track = <T>(operation: Promise<T>): Promise<T> => {
    activeOperations.add(operation);
    void operation.then(
      () => activeOperations.delete(operation),
      () => activeOperations.delete(operation)
    );
    return operation;
  };

  const assetFor = (value: BinaryBundleKeyInput): NormalizedAsset => {
    const key = normalizeKey(value);
    const asset = input.assetsByKey.get(key.lookupKey);
    if (!asset) {
      throw sessionError(
        'ASSET_SESSION_BINARY_NOT_FOUND',
        `Unknown session binary asset: ${key.name}`
      );
    }
    return asset;
  };

  const renew = async (): Promise<void> => {
    ensureUsable();
    if (mode === 'direct') return;
    try {
      await renewSession(
        database!,
        input.sessionId,
        currentTime(options.now),
        options.leaseTtlMs,
        controller.signal
      );
    } catch (error) {
      throw notifyFatal(error instanceof Error ? error : mapStorageError(error, 'lease renewal'));
    }
  };

  if (mode === 'session') {
    heartbeat = setInterval(() => {
      void track(renew()).catch(() => {});
    }, options.heartbeatIntervalMs);
  }

  const backing: SessionBinaryBacking = {
    sessionId: input.sessionId,
    mode,
    ...(warning === undefined ? {} : {warning}),
    get(value, operationOptions = {}) {
      const operation = (async () => {
        ensureUsable();
        const asset = assetFor(value);
        const externalSignal = operationSignal(operationOptions);
        const linked = linkSignals(externalSignal, controller.signal);
        try {
          if (mode === 'direct') {
            const files = await readSourceAsset(source!, asset, options.subtleCrypto, linked.signal);
            return publicDirectResult(asset, files);
          }
          return await readBundle(
            database!,
            input.sessionId,
            asset,
            options.subtleCrypto,
            linked.signal
          );
        } catch (error) {
          const normalized =
            error instanceof Error ? error : sessionError('ASSET_SESSION_BINARY_READ_FAILED', 'Session binary read failed.', error);
          if (disposed) throw normalized;
          throw notifyFatal(normalized);
        } finally {
          linked.release();
        }
      })();
      return track(operation);
    },
    renewLease() {
      return track(renew());
    },
    dispose() {
      if (disposePromise) return disposePromise;
      disposed = true;
      controller.abort();
      if (heartbeat !== null) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      disposePromise = (async () => {
        await Promise.allSettled([...activeOperations]);
        const errors: unknown[] = [];
        if (mode === 'session' && database) {
          try {
            await deleteSessionRecords(database, input.sessionId);
          } catch (error) {
            errors.push(error);
          }
          closingDatabase = true;
          database.close();
        }
        if (source) {
          try {
            await releaseSource(source);
          } catch (error) {
            errors.push(error);
          }
        }
        if (errors.length > 0) {
          throw sessionError(
            'ASSET_SESSION_BINARY_CLEANUP_FAILED',
            'Session binary backing disposal failed.',
            new AggregateError(errors)
          );
        }
      })();
      return disposePromise;
    }
  };
  return Object.freeze(backing);
}

/**
 * Establish a fixed direct or IndexedDB-backed binary session without changing persistent caches.
 *
 * The source must remain readable until `release` is called. A `prefer` fallback keeps that same
 * source for direct reads; an established session releases it only after every bundle passes
 * commit and integrity read-back.
 */
export async function createSessionBinaryBacking(
  inputValue: SessionBinaryBackingInput,
  optionValue: SessionBinaryBackingOptions = {},
  operationOptions: BinaryBundleOperationOptions = {}
): Promise<SessionBinaryBacking> {
  const options = normalizeOptions(optionValue);
  const input = normalizeInput(inputValue, options);
  const externalSignal = operationSignal(operationOptions);
  const establishmentController = new AbortController();
  const linked = linkSignals(externalSignal, establishmentController.signal);
  const signal = linked.signal;
  let database: IDBDatabase | null = null;
  let sourceReleased = false;
  let createdSession = false;
  try {
    assertNotAborted(signal);
    if (input.policy === 'disabled') {
      return createEstablishedBacking({
        input,
        options,
        mode: 'direct',
        database: null,
        source: input.source
      });
    }
    try {
      database = await openDatabase(options, signal);
      const timestamp = currentTime(options.now);
      await cleanupOrphans(database, timestamp, options.orphanCleanupBatchSize);
      await addSession(
        database,
        createSessionRecord(input.sessionId, input.assets.length, timestamp, options.leaseTtlMs),
        signal
      );
      createdSession = true;
      let expectedBytes = 0;
      for (const asset of input.assets) {
        const files = await readSourceAsset(input.source, asset, options.subtleCrypto, signal);
        await putBundle(database, input.sessionId, asset, files, signal);
        await readBundle(database, input.sessionId, asset, options.subtleCrypto, signal);
        expectedBytes += asset.totalBytes;
      }
      await activateSession(
        database,
        input.sessionId,
        input.assets.length,
        expectedBytes,
        currentTime(options.now),
        options.leaseTtlMs,
        signal
      );
      await releaseSource(input.source);
      sourceReleased = true;
      return createEstablishedBacking({
        input,
        options,
        mode: 'session',
        database,
        source: null
      });
    } catch (error) {
      let cleanupError: unknown;
      if (database && createdSession) {
        try {
          await deleteSessionRecords(database, input.sessionId);
        } catch (candidate) {
          cleanupError = candidate;
        }
      }
      if (input.policy === 'prefer' && fallbackEligible(error) && cleanupError === undefined) {
        if (database) database.close();
        database = null;
        return createEstablishedBacking({
          input,
          options,
          mode: 'direct',
          database: null,
          source: input.source,
          warning: Object.freeze({
            code: 'ASSET_SESSION_BINARY_DIRECT_FALLBACK',
            causeCode: errorCode(error)
          })
        });
      }
      if (cleanupError !== undefined) {
        throw sessionError(
          'ASSET_SESSION_BINARY_CLEANUP_FAILED',
          'Partial session binary records could not be removed.',
          new AggregateError([error, cleanupError])
        );
      }
      throw error;
    }
  } catch (error) {
    if (!sourceReleased) {
      try {
        await releaseSource(input.source);
        sourceReleased = true;
      } catch (releaseError) {
        throw sessionError(
          'ASSET_SESSION_BINARY_SOURCE_RELEASE_FAILED',
          'Session binary startup failed and its source could not be released.',
          new AggregateError([error, releaseError])
        );
      }
    }
    closeDatabase(database);
    throw error;
  } finally {
    linked.release();
  }
}
