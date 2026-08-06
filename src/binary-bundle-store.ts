const DEFAULT_DATABASE_NAME = 'tw-asset-manager-binary-bundles-v1';
const DATABASE_VERSION = 1;
const BUNDLE_STORE = 'bundles';
const METADATA_STORE = 'bundleMetadata';
const LAST_ACCESSED_INDEX = 'lastAccessedAt';
const FORMAT_VERSION = 1;

const DEFAULT_MAX_FILES_PER_BUNDLE = 256;
const DEFAULT_MAX_BUNDLE_BYTES = 256 * 1024 * 1024;
const DEFAULT_MAX_STORED_BUNDLES = 1024;
const DEFAULT_MAX_STORE_BYTES = 256 * 1024 * 1024;
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_NAMESPACE_LENGTH = 512;
const MAX_NAME_LENGTH = 256;
const MAX_PATH_LENGTH = 1024;
const MAX_DATABASE_NAME_LENGTH = 256;
const ABSOLUTE_MAX_FILES_PER_BUNDLE = 4096;
const ABSOLUTE_MAX_STORED_BUNDLES = 65_536;

type OwnedBytes = Uint8Array<ArrayBuffer>;

export interface BinaryBundleKeyInput {
  readonly namespace: unknown;
  readonly name: unknown;
  readonly integrity: unknown;
}

export interface BinaryBundleFileInput {
  readonly path: unknown;
  readonly size: unknown;
  readonly integrity: unknown;
  readonly bytes: ArrayBuffer | Uint8Array;
}

export interface BinaryBundlePutInput extends BinaryBundleKeyInput {
  readonly files: ReadonlyArray<BinaryBundleFileInput>;
}

export interface BinaryBundleOperationOptions {
  readonly signal?: AbortSignal;
}

export interface BinaryBundleFileRegistration {
  readonly path: string;
  readonly size: number;
  readonly integrity: string;
}

export interface BinaryBundleRegistration {
  readonly namespace: string;
  readonly name: string;
  readonly integrity: string;
  readonly files: ReadonlyArray<BinaryBundleFileRegistration>;
  readonly totalBytes: number;
}

export interface BinaryBundleFileResult extends BinaryBundleFileRegistration {
  readonly bytes: Uint8Array;
}

export interface BinaryBundleResult {
  readonly namespace: string;
  readonly name: string;
  readonly integrity: string;
  readonly files: ReadonlyArray<BinaryBundleFileResult>;
  readonly totalBytes: number;
}

export interface BinaryBundleStoreOptions {
  readonly indexedDB?: IDBFactory;
  readonly subtleCrypto?: SubtleCrypto;
  readonly databaseName?: string;
  readonly now?: () => number;
  readonly maxFilesPerBundle?: number;
  readonly maxBundleBytes?: number;
  readonly maxStoredBundles?: number;
  readonly maxStoreBytes?: number;
  readonly ttlMs?: number;
}

export interface BinaryBundleStore {
  put(
    input: BinaryBundlePutInput,
    options?: BinaryBundleOperationOptions
  ): Promise<BinaryBundleRegistration>;
  get(
    input: BinaryBundleKeyInput,
    options?: BinaryBundleOperationOptions
  ): Promise<BinaryBundleResult>;
  delete(input: BinaryBundleKeyInput, options?: BinaryBundleOperationOptions): Promise<void>;
  release(): Promise<void>;
}

type NormalizedKey = {
  namespace: string;
  name: string;
  integrity: string;
  key: string;
};

type NormalizedFile = BinaryBundleFileRegistration & {
  bytes: OwnedBytes;
};

type StoredFile = BinaryBundleFileRegistration & {
  data: ArrayBuffer;
};

type BundleRecord = NormalizedKey & {
  formatVersion: number;
  files: StoredFile[];
  totalBytes: number;
  writeToken: string;
};

type BundleMetadata = NormalizedKey & {
  formatVersion: number;
  files: BinaryBundleFileRegistration[];
  totalBytes: number;
  createdAt: number;
  lastAccessedAt: number;
  writeToken: string;
};

type StoreLimits = {
  maxFilesPerBundle: number;
  maxBundleBytes: number;
  maxStoredBundles: number;
  maxStoreBytes: number;
  ttlMs: number;
};

function bundleError(code: string, message: string, cause?: unknown): Error {
  const error = new Error(message, cause === undefined ? undefined : {cause});
  Object.defineProperty(error, 'code', {value: code, enumerable: true});
  return error;
}

function abortError(): Error {
  const error = bundleError('ASSET_BINARY_BUNDLE_ABORTED', 'Binary bundle operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function releasedError(): Error {
  return bundleError(
    'ASSET_BINARY_BUNDLE_RELEASED',
    'The binary bundle store has been released.'
  );
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function operationSignal(options: BinaryBundleOperationOptions): AbortSignal | undefined {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw bundleError(
      'ASSET_BINARY_BUNDLE_INPUT_INVALID',
      'Binary bundle operation options must be an object.'
    );
  }
  const signal = options.signal;
  if (signal === undefined) return undefined;
  if (
    !signal ||
    typeof signal !== 'object' ||
    typeof signal.aborted !== 'boolean' ||
    typeof signal.addEventListener !== 'function' ||
    typeof signal.removeEventListener !== 'function'
  ) {
    throw bundleError(
      'ASSET_BINARY_BUNDLE_INPUT_INVALID',
      'Binary bundle AbortSignal is invalid.'
    );
  }
  return signal;
}

function requireString(value: unknown, label: string, maxLength: number): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength ||
    value.includes('\0')
  ) {
    throw bundleError(
      'ASSET_BINARY_BUNDLE_INPUT_INVALID',
      `${label} must be a non-empty string of at most ${maxLength} code units.`
    );
  }
  return value;
}

function requireLimit(
  value: number | undefined,
  fallback: number,
  label: string,
  maximum = Number.MAX_SAFE_INTEGER
): number {
  const normalized = value ?? fallback;
  if (!Number.isSafeInteger(normalized) || normalized <= 0 || normalized > maximum) {
    throw new TypeError(`${label} must be a positive safe integer no greater than ${maximum}.`);
  }
  return normalized;
}

function normalizeIntegrity(value: unknown, label: string): string {
  const integrity = requireString(value, label, 96);
  if (!integrityIsCanonical(integrity)) {
    throw bundleError(
      'ASSET_BINARY_BUNDLE_INPUT_INVALID',
      `${label} must contain canonical SHA-256 hex or base64.`
    );
  }
  return integrity;
}

function integrityIsCanonical(value: string): boolean {
  if (!value.startsWith('sha256-')) return false;
  const payload = value.slice('sha256-'.length);
  return /^[0-9a-f]{64}$/u.test(payload) || /^[A-Za-z0-9+/]{43}=$/u.test(payload);
}

function safePath(value: unknown): string {
  const path = requireString(value, 'binary bundle file path', MAX_PATH_LENGTH);
  if (!pathIsSafe(path)) {
    throw bundleError(
      'ASSET_BINARY_BUNDLE_INPUT_INVALID',
      'Binary bundle file path must be a safe relative path.'
    );
  }
  return path;
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

function normalizeKey(input: BinaryBundleKeyInput): NormalizedKey {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw bundleError('ASSET_BINARY_BUNDLE_INPUT_INVALID', 'Binary bundle key must be an object.');
  }
  const namespace = requireString(input.namespace, 'binary bundle namespace', MAX_NAMESPACE_LENGTH);
  const name = requireString(input.name, 'binary bundle name', MAX_NAME_LENGTH);
  const integrity = normalizeIntegrity(input.integrity, 'binary bundle integrity');
  return {
    namespace,
    name,
    integrity,
    key: JSON.stringify([FORMAT_VERSION, namespace, name, integrity])
  };
}

function ownBytes(value: ArrayBuffer | Uint8Array): OwnedBytes {
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  throw bundleError(
    'ASSET_BINARY_BUNDLE_INPUT_INVALID',
    'Binary bundle file bytes must be an ArrayBuffer or Uint8Array.'
  );
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}

async function verifyIntegrity(
  bytes: OwnedBytes,
  integrity: string,
  subtleCrypto: SubtleCrypto
): Promise<void> {
  const digest = new Uint8Array(await subtleCrypto.digest('SHA-256', bytes));
  const payload = integrity.slice('sha256-'.length);
  const actual = /^[0-9a-f]{64}$/u.test(payload) ? toHex(digest) : toBase64(digest);
  if (actual !== payload) {
    throw bundleError(
      'ASSET_BINARY_BUNDLE_INTEGRITY_MISMATCH',
      'Binary bundle file integrity does not match its bytes.'
    );
  }
}

function metadataIsValid(value: unknown, key: string): value is BundleMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<BundleMetadata>;
  if (!(
    candidate.formatVersion === FORMAT_VERSION &&
      candidate.key === key &&
      typeof candidate.namespace === 'string' &&
      candidate.namespace.length > 0 &&
      candidate.namespace.length <= MAX_NAMESPACE_LENGTH &&
      typeof candidate.name === 'string' &&
      candidate.name.length > 0 &&
      candidate.name.length <= MAX_NAME_LENGTH &&
      typeof candidate.integrity === 'string' &&
      integrityIsCanonical(candidate.integrity) &&
      JSON.stringify([
        FORMAT_VERSION,
        candidate.namespace,
        candidate.name,
        candidate.integrity
      ]) === key &&
      Array.isArray(candidate.files) &&
      Number.isSafeInteger(candidate.totalBytes) &&
      Number(candidate.totalBytes) >= 0 &&
      Number.isFinite(candidate.createdAt) &&
      Number(candidate.createdAt) >= 0 &&
      Number.isFinite(candidate.lastAccessedAt) &&
      Number(candidate.lastAccessedAt) >= Number(candidate.createdAt) &&
      typeof candidate.writeToken === 'string' &&
      candidate.writeToken.length > 0
  )) {
    return false;
  }
  let totalBytes = 0;
  let previousPath: string | null = null;
  for (const file of candidate.files) {
    if (
      !file ||
      typeof file !== 'object' ||
      typeof file.path !== 'string' ||
      !pathIsSafe(file.path) ||
      (previousPath !== null && file.path <= previousPath) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0 ||
      typeof file.integrity !== 'string' ||
      !integrityIsCanonical(file.integrity)
    ) {
      return false;
    }
    totalBytes += file.size;
    if (!Number.isSafeInteger(totalBytes)) return false;
    previousPath = file.path;
  }
  return candidate.files.length > 0 && totalBytes === candidate.totalBytes;
}

function storedRecordIsValid(
  value: unknown,
  metadata: BundleMetadata,
  key: string
): value is BundleRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<BundleRecord>;
  if (
    candidate.formatVersion !== FORMAT_VERSION ||
    candidate.key !== key ||
    candidate.namespace !== metadata.namespace ||
    candidate.name !== metadata.name ||
    candidate.integrity !== metadata.integrity ||
    candidate.totalBytes !== metadata.totalBytes ||
    candidate.writeToken !== metadata.writeToken ||
    !Array.isArray(candidate.files) ||
    candidate.files.length !== metadata.files.length
  ) {
    return false;
  }
  return candidate.files.every((file, index) => {
    const expected = metadata.files[index];
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

function mappedStoreError(error: unknown, operation: string, signal?: AbortSignal): Error {
  if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
    return abortError();
  }
  if (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('ASSET_BINARY_BUNDLE_')
  ) {
    return error;
  }
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return bundleError(
      'ASSET_BINARY_BUNDLE_QUOTA_EXCEEDED',
      `Binary bundle ${operation} exceeded IndexedDB quota.`,
      error
    );
  }
  return bundleError(
    'ASSET_BINARY_BUNDLE_TRANSACTION_FAILED',
    `Binary bundle ${operation} transaction failed.`,
    error
  );
}

function publicRegistration(
  key: NormalizedKey,
  files: ReadonlyArray<BinaryBundleFileRegistration>,
  totalBytes: number
): BinaryBundleRegistration {
  return Object.freeze({
    namespace: key.namespace,
    name: key.name,
    integrity: key.integrity,
    files: Object.freeze(files.map((file) => Object.freeze({...file}))),
    totalBytes
  });
}

/**
 * Create a block-free, versioned IndexedDB store for atomic binary bundles.
 *
 * The store owns no long-lived application reference to input bytes. IndexedDB receives one
 * structured-cloned bundle record, and success is published only after the containing transaction
 * completes.
 */
export function createBinaryBundleStore(options: BinaryBundleStoreOptions = {}): BinaryBundleStore {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Binary bundle store options must be an object.');
  }
  const indexedDB = options.indexedDB ?? globalThis.indexedDB;
  const subtleCrypto = options.subtleCrypto ?? globalThis.crypto?.subtle;
  const databaseName = requireString(
    options.databaseName ?? DEFAULT_DATABASE_NAME,
    'binary bundle databaseName',
    MAX_DATABASE_NAME_LENGTH
  );
  const now = options.now ?? Date.now;
  if (typeof now !== 'function') throw new TypeError('now must be a function.');
  const limits: StoreLimits = {
    maxFilesPerBundle: requireLimit(
      options.maxFilesPerBundle,
      DEFAULT_MAX_FILES_PER_BUNDLE,
      'maxFilesPerBundle',
      ABSOLUTE_MAX_FILES_PER_BUNDLE
    ),
    maxBundleBytes: requireLimit(
      options.maxBundleBytes,
      DEFAULT_MAX_BUNDLE_BYTES,
      'maxBundleBytes'
    ),
    maxStoredBundles: requireLimit(
      options.maxStoredBundles,
      DEFAULT_MAX_STORED_BUNDLES,
      'maxStoredBundles',
      ABSOLUTE_MAX_STORED_BUNDLES
    ),
    maxStoreBytes: requireLimit(
      options.maxStoreBytes,
      DEFAULT_MAX_STORE_BYTES,
      'maxStoreBytes'
    ),
    ttlMs: requireLimit(options.ttlMs, DEFAULT_TTL_MS, 'ttlMs')
  };
  let released = false;
  let releasePromise: Promise<void> | null = null;
  let tokenCounter = 0;
  const releaseController = new AbortController();
  const generations = new Map<string, number>();
  const activeTransactions = new Set<IDBTransaction>();
  const activeByKey = new Map<string, Set<IDBTransaction>>();
  const activeOperations = new Set<Promise<unknown>>();

  function ensureActive(): void {
    if (released) throw releasedError();
  }

  function currentGeneration(key: string): number {
    return generations.get(key) ?? 0;
  }

  function advanceGeneration(key: string): number {
    const next = currentGeneration(key) + 1;
    generations.set(key, next);
    for (const transaction of activeByKey.get(key) ?? []) {
      try {
        transaction.abort();
      } catch {
        // The transaction completed before the replacement could abort it.
      }
    }
    return next;
  }

  function ensureGeneration(key: string, generation: number): void {
    ensureActive();
    if (currentGeneration(key) !== generation) throw abortError();
  }

  function nextWriteToken(generation: number): string {
    tokenCounter += 1;
    return `${now()}:${generation}:${tokenCounter}`;
  }

  function trackOperation<T>(operation: Promise<T>): Promise<T> {
    activeOperations.add(operation);
    void operation.then(
      () => activeOperations.delete(operation),
      () => activeOperations.delete(operation)
    );
    return operation;
  }

  async function verifyWithCancellation(
    bytes: OwnedBytes,
    integrity: string,
    signal?: AbortSignal
  ): Promise<void> {
    assertNotAborted(signal);
    ensureActive();
    let rejectExternal: (() => void) | null = null;
    let rejectRelease: (() => void) | null = null;
    const cancellation = new Promise<never>((_resolve, reject) => {
      rejectExternal = () => reject(abortError());
      rejectRelease = () => reject(releasedError());
      signal?.addEventListener('abort', rejectExternal, {once: true});
      releaseController.signal.addEventListener('abort', rejectRelease, {once: true});
    });
    try {
      await Promise.race([verifyIntegrity(bytes, integrity, subtleCrypto!), cancellation]);
    } finally {
      if (rejectExternal) signal?.removeEventListener('abort', rejectExternal);
      if (rejectRelease) releaseController.signal.removeEventListener('abort', rejectRelease);
    }
  }

  async function openDatabase(): Promise<IDBDatabase> {
    ensureActive();
    if (!indexedDB || typeof indexedDB.open !== 'function') {
      throw bundleError(
        'ASSET_BINARY_BUNDLE_INDEXEDDB_UNAVAILABLE',
        'IndexedDB is not available for the binary bundle store.'
      );
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(databaseName, DATABASE_VERSION);
    } catch (error) {
      throw bundleError(
        'ASSET_BINARY_BUNDLE_INDEXEDDB_UNAVAILABLE',
        'The binary bundle IndexedDB database could not be opened.',
        error
      );
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
        if (!database.objectStoreNames.contains(BUNDLE_STORE)) {
          database.createObjectStore(BUNDLE_STORE, {keyPath: 'key'});
        }
        let metadata: IDBObjectStore;
        if (!database.objectStoreNames.contains(METADATA_STORE)) {
          metadata = database.createObjectStore(METADATA_STORE, {keyPath: 'key'});
        } else {
          metadata = request.transaction!.objectStore(METADATA_STORE);
        }
        if (!metadata.indexNames.contains(LAST_ACCESSED_INDEX)) {
          metadata.createIndex(LAST_ACCESSED_INDEX, 'lastAccessedAt');
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (settled || released) {
          database.close();
          rejectOnce(releasedError());
          return;
        }
        settled = true;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () =>
        rejectOnce(
          bundleError(
            'ASSET_BINARY_BUNDLE_INDEXEDDB_UNAVAILABLE',
            'The binary bundle IndexedDB open request failed.',
            request.error
          )
        );
      request.onblocked = () =>
        rejectOnce(
          bundleError(
            'ASSET_BINARY_BUNDLE_INDEXEDDB_BLOCKED',
            'The binary bundle IndexedDB open request was blocked.'
          )
        );
    });
  }

  function trackTransaction(key: string, transaction: IDBTransaction): () => void {
    activeTransactions.add(transaction);
    let transactions = activeByKey.get(key);
    if (!transactions) {
      transactions = new Set();
      activeByKey.set(key, transactions);
    }
    transactions.add(transaction);
    return () => {
      activeTransactions.delete(transaction);
      transactions!.delete(transaction);
      if (transactions!.size === 0) activeByKey.delete(key);
    };
  }

  function abortWithSignal(transaction: IDBTransaction, signal?: AbortSignal): () => void {
    const abort = () => {
      try {
        transaction.abort();
      } catch {
        // The transaction already completed.
      }
    };
    signal?.addEventListener('abort', abort, {once: true});
    return () => signal?.removeEventListener('abort', abort);
  }

  async function normalizeFiles(
    input: BinaryBundlePutInput,
    signal?: AbortSignal
  ): Promise<{key: NormalizedKey; files: NormalizedFile[]; totalBytes: number}> {
    const key = normalizeKey(input);
    if (!Array.isArray(input.files) || input.files.length === 0) {
      throw bundleError(
        'ASSET_BINARY_BUNDLE_INPUT_INVALID',
        'Binary bundle files must be a non-empty array.'
      );
    }
    if (input.files.length > limits.maxFilesPerBundle) {
      throw bundleError(
        'ASSET_BINARY_BUNDLE_LIMIT_EXCEEDED',
        'Binary bundle exceeds maxFilesPerBundle.'
      );
    }
    const paths = new Set<string>();
    const files: NormalizedFile[] = [];
    let totalBytes = 0;
    for (const inputFile of input.files) {
      assertNotAborted(signal);
      if (!inputFile || typeof inputFile !== 'object' || Array.isArray(inputFile)) {
        throw bundleError(
          'ASSET_BINARY_BUNDLE_INPUT_INVALID',
          'Each binary bundle file must be an object.'
        );
      }
      const path = safePath(inputFile.path);
      if (paths.has(path)) {
        throw bundleError(
          'ASSET_BINARY_BUNDLE_INPUT_INVALID',
          `Binary bundle contains a duplicate path: ${path}`
        );
      }
      paths.add(path);
      const bytes = ownBytes(inputFile.bytes);
      if (!Number.isSafeInteger(inputFile.size) || Number(inputFile.size) !== bytes.byteLength) {
        throw bundleError(
          'ASSET_BINARY_BUNDLE_INPUT_INVALID',
          `Binary bundle file size does not match: ${path}`
        );
      }
      const integrity = normalizeIntegrity(inputFile.integrity, `integrity for ${path}`);
      totalBytes += bytes.byteLength;
      if (!Number.isSafeInteger(totalBytes) || totalBytes > limits.maxBundleBytes) {
        throw bundleError(
          'ASSET_BINARY_BUNDLE_LIMIT_EXCEEDED',
          'Binary bundle exceeds maxBundleBytes.'
        );
      }
      files.push({path, size: bytes.byteLength, integrity, bytes});
    }
    if (totalBytes > limits.maxStoreBytes) {
      throw bundleError(
        'ASSET_BINARY_BUNDLE_LIMIT_EXCEEDED',
        'Binary bundle exceeds maxStoreBytes.'
      );
    }
    if (!subtleCrypto || typeof subtleCrypto.digest !== 'function') {
      throw bundleError(
        'ASSET_BINARY_BUNDLE_CRYPTO_UNAVAILABLE',
        'SHA-256 is not available for binary bundle verification.'
      );
    }
    for (const file of files) {
      assertNotAborted(signal);
      await verifyWithCancellation(file.bytes, file.integrity, signal);
    }
    files.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
    return {key, files, totalBytes};
  }

  async function put(
    input: BinaryBundlePutInput,
    operationOptions: BinaryBundleOperationOptions = {}
  ): Promise<BinaryBundleRegistration> {
    ensureActive();
    const signal = operationSignal(operationOptions);
    assertNotAborted(signal);
    const normalizedKey = normalizeKey(input);
    const generation = advanceGeneration(normalizedKey.key);
    const normalized = await normalizeFiles(input, signal);
    ensureGeneration(normalized.key.key, generation);
    const database = await openDatabase();
    let transaction: IDBTransaction | null = null;
    let untrack = () => {};
    let removeAbort = () => {};
    try {
      ensureGeneration(normalized.key.key, generation);
      transaction = database.transaction([BUNDLE_STORE, METADATA_STORE], 'readwrite');
      untrack = trackTransaction(normalized.key.key, transaction);
      removeAbort = abortWithSignal(transaction, signal);
      const bundles = transaction.objectStore(BUNDLE_STORE);
      const metadataStore = transaction.objectStore(METADATA_STORE);
      const metadataRequest = metadataStore.openCursor();
      const bundleKeyRequest = bundles.openKeyCursor();
      const metadataRecords: BundleMetadata[] = [];
      const bundleKeys = new Set<string>();
      const scanCapacity = limits.maxStoredBundles * 2;
      let metadataDone = false;
      let bundleKeysDone = false;
      let finalized = false;
      let operationError: unknown;
      const writeToken = nextWriteToken(generation);
      const createdAt = now();
      const publicFiles = normalized.files.map(({path, size, integrity}) => ({
        path,
        size,
        integrity
      }));
      const record: BundleRecord = {
        ...normalized.key,
        formatVersion: FORMAT_VERSION,
        files: normalized.files.map(({path, size, integrity, bytes}) => ({
          path,
          size,
          integrity,
          data: bytes.buffer
        })),
        totalBytes: normalized.totalBytes,
        writeToken
      };
      const metadata: BundleMetadata = {
        ...normalized.key,
        formatVersion: FORMAT_VERSION,
        files: publicFiles,
        totalBytes: normalized.totalBytes,
        createdAt,
        lastAccessedAt: createdAt,
        writeToken
      };
      const failTransaction = (error: unknown) => {
        operationError = error;
        try {
          transaction?.abort();
        } catch {
          // The transaction already failed.
        }
      };
      const finalize = () => {
        if (finalized || !metadataDone || !bundleKeysDone) return;
        finalized = true;
        try {
          if (signal?.aborted || currentGeneration(normalized.key.key) !== generation || released) {
            failTransaction(abortError());
            return;
          }
          const currentTime = now();
          const metadataKeys = new Set(metadataRecords.map(({key}) => key));
          for (const bundleKey of bundleKeys) {
            if (!metadataKeys.has(bundleKey)) bundles.delete(bundleKey);
          }
          const retained = metadataRecords
            .filter((candidate) => {
              if (candidate.key === normalized.key.key) return false;
              if (bundleKeys.has(candidate.key)) return true;
              metadataStore.delete(candidate.key);
              return false;
            })
            .sort((left, right) =>
              left.lastAccessedAt === right.lastAccessedAt
                ? left.key < right.key
                  ? -1
                  : 1
                : left.lastAccessedAt - right.lastAccessedAt
            );
          let retainedBytes = retained.reduce((sum, candidate) => sum + candidate.totalBytes, 0);
          let retainedCount = retained.length;
          for (const candidate of retained) {
            const expired =
              currentTime < candidate.lastAccessedAt ||
              currentTime - candidate.lastAccessedAt > limits.ttlMs;
            const overBudget = retainedBytes + normalized.totalBytes > limits.maxStoreBytes;
            const overCount = retainedCount + 1 > limits.maxStoredBundles;
            if (!expired && !overBudget && !overCount) continue;
            bundles.delete(candidate.key);
            metadataStore.delete(candidate.key);
            retainedBytes -= candidate.totalBytes;
            retainedCount -= 1;
          }
          bundles.put(record);
          metadataStore.put(metadata);
        } catch (error) {
          failTransaction(error);
        }
      };
      metadataRequest.onsuccess = () => {
        try {
          const cursor = metadataRequest.result;
          if (cursor) {
            if (metadataRecords.length >= scanCapacity) {
              bundles.delete(cursor.primaryKey);
              cursor.delete();
            } else if (metadataIsValid(cursor.value, String(cursor.primaryKey))) {
              metadataRecords.push(cursor.value);
            } else {
              bundles.delete(cursor.primaryKey);
              cursor.delete();
            }
            cursor.continue();
            return;
          }
          metadataDone = true;
          finalize();
        } catch (error) {
          failTransaction(error);
        }
      };
      bundleKeyRequest.onsuccess = () => {
        try {
          const cursor = bundleKeyRequest.result;
          if (cursor) {
            const bundleKey = String(cursor.primaryKey);
            if (bundleKeys.size >= scanCapacity) {
              cursor.delete();
              metadataStore.delete(cursor.primaryKey);
            } else {
              bundleKeys.add(bundleKey);
            }
            cursor.continue();
            return;
          }
          bundleKeysDone = true;
          finalize();
        } catch (error) {
          failTransaction(error);
        }
      };
      try {
        await transactionComplete(transaction);
      } catch (error) {
        throw mappedStoreError(operationError ?? error, 'put', signal);
      }
      ensureGeneration(normalized.key.key, generation);
      return publicRegistration(normalized.key, publicFiles, normalized.totalBytes);
    } finally {
      removeAbort();
      untrack();
      database.close();
    }
  }

  async function deleteIfToken(key: string, writeToken: string): Promise<void> {
    if (released) return;
    const database = await openDatabase();
    let untrack = () => {};
    try {
      const transaction = database.transaction([BUNDLE_STORE, METADATA_STORE], 'readwrite');
      untrack = trackTransaction(key, transaction);
      const metadataStore = transaction.objectStore(METADATA_STORE);
      const request = metadataStore.get(key) as IDBRequest<unknown>;
      request.onsuccess = () => {
        if (!metadataIsValid(request.result, key) || request.result.writeToken !== writeToken) return;
        transaction.objectStore(BUNDLE_STORE).delete(key);
        metadataStore.delete(key);
      };
      try {
        await transactionComplete(transaction);
      } catch (error) {
        throw mappedStoreError(error, 'conditional delete');
      }
    } finally {
      untrack();
      database.close();
    }
  }

  async function touch(key: string, writeToken: string): Promise<void> {
    if (released) return;
    const database = await openDatabase();
    let untrack = () => {};
    try {
      const transaction = database.transaction(METADATA_STORE, 'readwrite');
      untrack = trackTransaction(key, transaction);
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(key) as IDBRequest<unknown>;
      request.onsuccess = () => {
        if (!metadataIsValid(request.result, key) || request.result.writeToken !== writeToken) return;
        store.put({...request.result, lastAccessedAt: now()});
      };
      try {
        await transactionComplete(transaction);
      } catch (error) {
        throw mappedStoreError(error, 'touch');
      }
    } finally {
      untrack();
      database.close();
    }
  }

  async function get(
    input: BinaryBundleKeyInput,
    operationOptions: BinaryBundleOperationOptions = {}
  ): Promise<BinaryBundleResult> {
    ensureActive();
    const signal = operationSignal(operationOptions);
    assertNotAborted(signal);
    const key = normalizeKey(input);
    const generation = currentGeneration(key.key);
    const database = await openDatabase();
    let untrack = () => {};
    let removeAbort = () => {};
    let bundle: unknown;
    let metadata: unknown;
    try {
      const transaction = database.transaction([BUNDLE_STORE, METADATA_STORE], 'readonly');
      untrack = trackTransaction(key.key, transaction);
      removeAbort = abortWithSignal(transaction, signal);
      const bundleRequest = transaction.objectStore(BUNDLE_STORE).get(key.key) as IDBRequest<unknown>;
      const metadataRequest = transaction.objectStore(METADATA_STORE).get(key.key) as IDBRequest<unknown>;
      try {
        [bundle, metadata] = await Promise.all([
          requestResult(bundleRequest),
          requestResult(metadataRequest),
          transactionComplete(transaction)
        ]);
      } catch (error) {
        throw mappedStoreError(error, 'get', signal);
      }
    } finally {
      removeAbort();
      untrack();
      database.close();
    }
    ensureGeneration(key.key, generation);
    if (bundle === undefined && metadata === undefined) {
      throw bundleError('ASSET_BINARY_BUNDLE_NOT_FOUND', 'Binary bundle was not found.');
    }
    if (!metadataIsValid(metadata, key.key) || !storedRecordIsValid(bundle, metadata, key.key)) {
      if (metadataIsValid(metadata, key.key)) await deleteIfToken(key.key, metadata.writeToken);
      throw bundleError('ASSET_BINARY_BUNDLE_CORRUPT', 'Binary bundle record is incomplete or corrupt.');
    }
    const currentTime = now();
    if (
      currentTime < metadata.lastAccessedAt ||
      currentTime - metadata.lastAccessedAt > limits.ttlMs
    ) {
      await deleteIfToken(key.key, metadata.writeToken);
      throw bundleError('ASSET_BINARY_BUNDLE_NOT_FOUND', 'Binary bundle has expired.');
    }
    if (!subtleCrypto || typeof subtleCrypto.digest !== 'function') {
      throw bundleError(
        'ASSET_BINARY_BUNDLE_CRYPTO_UNAVAILABLE',
        'SHA-256 is not available for binary bundle verification.'
      );
    }
    const files: BinaryBundleFileResult[] = [];
    try {
      for (const file of bundle.files) {
        assertNotAborted(signal);
        ensureGeneration(key.key, generation);
        const bytes = new Uint8Array(file.data);
        await verifyWithCancellation(bytes, file.integrity, signal);
        files.push(Object.freeze({path: file.path, size: file.size, integrity: file.integrity, bytes}));
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ASSET_BINARY_BUNDLE_INTEGRITY_MISMATCH') {
        await deleteIfToken(key.key, metadata.writeToken);
      }
      throw error;
    }
    ensureGeneration(key.key, generation);
    await touch(key.key, metadata.writeToken);
    ensureGeneration(key.key, generation);
    return Object.freeze({
      namespace: key.namespace,
      name: key.name,
      integrity: key.integrity,
      files: Object.freeze(files),
      totalBytes: metadata.totalBytes
    });
  }

  async function deleteBundle(
    input: BinaryBundleKeyInput,
    operationOptions: BinaryBundleOperationOptions = {}
  ): Promise<void> {
    ensureActive();
    const signal = operationSignal(operationOptions);
    assertNotAborted(signal);
    const key = normalizeKey(input);
    const generation = advanceGeneration(key.key);
    const database = await openDatabase();
    let untrack = () => {};
    let removeAbort = () => {};
    try {
      ensureGeneration(key.key, generation);
      const transaction = database.transaction([BUNDLE_STORE, METADATA_STORE], 'readwrite');
      untrack = trackTransaction(key.key, transaction);
      removeAbort = abortWithSignal(transaction, signal);
      transaction.objectStore(BUNDLE_STORE).delete(key.key);
      transaction.objectStore(METADATA_STORE).delete(key.key);
      try {
        await transactionComplete(transaction);
      } catch (error) {
        throw mappedStoreError(error, 'delete', signal);
      }
      ensureGeneration(key.key, generation);
    } finally {
      removeAbort();
      untrack();
      database.close();
    }
  }

  const store: BinaryBundleStore = {
    put(input, operationOptions) {
      return trackOperation(put(input, operationOptions));
    },
    get(input, operationOptions) {
      return trackOperation(get(input, operationOptions));
    },
    delete(input, operationOptions) {
      return trackOperation(deleteBundle(input, operationOptions));
    },
    release() {
      if (releasePromise) return releasePromise;
      released = true;
      releaseController.abort();
      for (const transaction of activeTransactions) {
        try {
          transaction.abort();
        } catch {
          // The transaction already completed.
        }
      }
      activeTransactions.clear();
      activeByKey.clear();
      generations.clear();
      const pending = [...activeOperations];
      releasePromise = Promise.allSettled(pending).then(() => {});
      return releasePromise;
    }
  };
  return Object.freeze(store);
}
