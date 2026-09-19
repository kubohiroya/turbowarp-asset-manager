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

export interface BinaryObjectStore {
  readonly kind: 'indexeddb' | 'opfs';
  put(
    descriptor: BinaryObjectDescriptor,
    source: ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>,
    options?: BinaryObjectOperationOptions
  ): Promise<void>;
  get(
    descriptor: BinaryObjectDescriptor,
    options?: BinaryObjectOperationOptions
  ): Promise<BinaryObjectResult>;
  delete(key: string, options?: BinaryObjectOperationOptions): Promise<void>;
  listOrphans?(options?: {readonly limit?: number; readonly signal?: AbortSignal}): AsyncIterable<string>;
  cleanupStaging?(options?: {
    readonly limit?: number;
    readonly createdBefore?: number;
    readonly signal?: AbortSignal;
  }): Promise<number>;
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

type OwnedBytes = Uint8Array<ArrayBuffer>;

function objectError(code: string, message: string, cause?: unknown): Error {
  const error = new Error(message, cause === undefined ? undefined : {cause});
  Object.defineProperty(error, 'code', {value: code, enumerable: true});
  return error;
}

function abortError(cause?: unknown): Error {
  const error = objectError('ASSET_BINARY_ABORTED', 'Binary object operation was aborted.', cause);
  error.name = 'AbortError';
  return error;
}

function assertActive(released: boolean, signal?: AbortSignal): void {
  if (released) throw objectError('ASSET_BINARY_STORE_RELEASED', 'Binary object store was released.');
  if (signal?.aborted) throw abortError(signal.reason);
}

function validateDescriptor(value: BinaryObjectDescriptor): BinaryObjectDescriptor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Binary object descriptor must be an object.');
  }
  if (!/^[a-z0-9][a-z0-9._:-]{0,511}$/u.test(value.key)) {
    throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Binary object key is invalid.');
  }
  if (!Number.isSafeInteger(value.size) || value.size < 0) {
    throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Binary object size is invalid.');
  }
  if (!/^sha256-(?:[0-9a-f]{64}|[A-Za-z0-9+/]{43}=)$/u.test(value.integrity)) {
    throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Binary object integrity is invalid.');
  }
  if (value.contentType !== undefined &&
      (typeof value.contentType !== 'string' || value.contentType.length === 0 || value.contentType.length > 256)) {
    throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Binary object content type is invalid.');
  }
  return value;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function integrityHex(integrity: string): string {
  const payload = integrity.slice('sha256-'.length);
  if (/^[0-9a-f]{64}$/u.test(payload)) return payload;
  try {
    const decoded = Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
    if (decoded.byteLength === 32) return toHex(decoded);
  } catch {
    // Report one stable public validation error below.
  }
  throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Binary object integrity is invalid.');
}

async function sourceBytes(
  source: ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>,
  signal?: AbortSignal
): Promise<OwnedBytes> {
  if (source instanceof ArrayBuffer) return new Uint8Array(source.slice(0));
  if (source instanceof Uint8Array) return Uint8Array.from(source);
  if (!source || typeof source !== 'object' || typeof source.getReader !== 'function') {
    throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Binary object source is invalid.');
  }
  const reader = source.getReader();
  const cancel = () => void reader.cancel(signal?.reason).catch(() => {});
  signal?.addEventListener('abort', cancel, {once: true});
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      if (signal?.aborted) throw abortError(signal.reason);
      const result = await reader.read();
      if (signal?.aborted) throw abortError(signal.reason);
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) {
        throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Binary object stream emitted invalid bytes.');
      }
      chunks.push(Uint8Array.from(result.value));
      length += result.value.byteLength;
      if (!Number.isSafeInteger(length)) {
        throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Binary object source is too large.');
      }
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function readFileBytes(file: File, signal?: AbortSignal): Promise<OwnedBytes> {
  if (signal?.aborted) throw abortError(signal.reason);
  let rejectAbort: ((reason?: unknown) => void) | null = null;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = () => reject(abortError(signal?.reason));
    signal?.addEventListener('abort', rejectAbort, {once: true});
  });
  try {
    const buffer = await Promise.race([file.arrayBuffer(), aborted]);
    return new Uint8Array(buffer);
  } finally {
    if (rejectAbort) signal?.removeEventListener('abort', rejectAbort);
  }
}

async function writeSource(
  writable: FileSystemWritableFileStream,
  source: ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>,
  expectedSize: number,
  signal?: AbortSignal
): Promise<void> {
  if (source instanceof ArrayBuffer || source instanceof Uint8Array) {
    const bytes = source instanceof ArrayBuffer
      ? new Uint8Array(source.slice(0))
      : Uint8Array.from(source);
    if (bytes.byteLength !== expectedSize) {
      throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Binary object size does not match its source.');
    }
    assertActive(false, signal);
    let rejectAbort: (() => void) | null = null;
    const aborted = new Promise<never>((_resolve, reject) => {
      rejectAbort = () => {
        void writable.abort(signal?.reason).catch(() => {});
        reject(abortError(signal?.reason));
      };
      signal?.addEventListener('abort', rejectAbort, {once: true});
    });
    try {
      await Promise.race([writable.write(bytes), aborted]);
    } finally {
      if (rejectAbort) signal?.removeEventListener('abort', rejectAbort);
    }
    return;
  }
  if (!source || typeof source !== 'object' || typeof source.getReader !== 'function') {
    throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Binary object source is invalid.');
  }
  const reader = source.getReader();
  let size = 0;
  const cancel = () => {
    void reader.cancel(signal?.reason).catch(() => {});
    void writable.abort(signal?.reason).catch(() => {});
  };
  signal?.addEventListener('abort', cancel, {once: true});
  try {
    for (;;) {
      if (signal?.aborted) throw abortError(signal.reason);
      const result = await reader.read();
      if (signal?.aborted) throw abortError(signal.reason);
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) {
        throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Binary object stream emitted invalid bytes.');
      }
      size += result.value.byteLength;
      if (!Number.isSafeInteger(size) || size > expectedSize) {
        throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Binary object stream exceeded its declared size.');
      }
      await writable.write(Uint8Array.from(result.value));
    }
    if (size !== expectedSize) {
      throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Binary object stream size does not match its descriptor.');
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

async function closeWritable(
  writable: FileSystemWritableFileStream,
  signal?: AbortSignal
): Promise<void> {
  let rejectAbort: (() => void) | null = null;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = () => {
      void writable.abort(signal?.reason).catch(() => {});
      reject(abortError(signal?.reason));
    };
    signal?.addEventListener('abort', rejectAbort, {once: true});
  });
  try {
    await Promise.race([writable.close(), aborted]);
  } finally {
    if (rejectAbort) signal?.removeEventListener('abort', rejectAbort);
  }
}

async function copyFileToWritable(
  file: File,
  writable: FileSystemWritableFileStream,
  signal?: AbortSignal
): Promise<void> {
  const reader = file.stream().getReader();
  const cancel = () => {
    void reader.cancel(signal?.reason).catch(() => {});
    void writable.abort(signal?.reason).catch(() => {});
  };
  signal?.addEventListener('abort', cancel, {once: true});
  try {
    for (;;) {
      if (signal?.aborted) throw abortError(signal.reason);
      const result = await reader.read();
      if (result.done) break;
      await writable.write(Uint8Array.from(result.value));
    }
    await writable.close();
  } finally {
    signal?.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

async function verify(
  bytes: OwnedBytes,
  descriptor: BinaryObjectDescriptor,
  subtleCrypto: SubtleCrypto
): Promise<void> {
  if (bytes.byteLength !== descriptor.size) {
    throw objectError('ASSET_BINARY_OPFS_CORRUPT', 'Binary object size does not match its descriptor.');
  }
  const digest = new Uint8Array(await subtleCrypto.digest('SHA-256', bytes));
  if (toHex(digest) !== integrityHex(descriptor.integrity)) {
    throw objectError('ASSET_BINARY_OPFS_CORRUPT', 'Binary object integrity does not match its descriptor.');
  }
}

function mappedOpfsError(error: unknown, operation: 'open' | 'write' | 'read' | 'delete'): Error {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') return error;
  if (error instanceof DOMException && error.name === 'AbortError') return abortError(error);
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return objectError('ASSET_BINARY_OPFS_QUOTA', 'OPFS quota was exceeded.', error);
  }
  if (error instanceof DOMException && error.name === 'NotFoundError' && operation === 'read') {
    return objectError('ASSET_BINARY_OPFS_NOT_FOUND', 'OPFS binary object was not found.', error);
  }
  const code = operation === 'open'
    ? 'ASSET_BINARY_OPFS_OPEN_FAILED'
    : operation === 'write'
      ? 'ASSET_BINARY_OPFS_WRITE_FAILED'
      : operation === 'read'
        ? 'ASSET_BINARY_OPFS_READ_FAILED'
        : 'ASSET_BINARY_OPFS_RECOVERY_FAILED';
  return objectError(code, `OPFS binary object ${operation} failed.`, error);
}

async function childDirectory(
  parent: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, {create: true});
}

export function createOpfsBinaryObjectStore(
  options: OpfsBinaryObjectStoreOptions = {}
): BinaryObjectStore {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('OPFS binary object store options must be an object.');
  }
  const subtleCrypto = options.subtleCrypto ?? globalThis.crypto?.subtle;
  if (!subtleCrypto || typeof subtleCrypto.digest !== 'function') {
    throw objectError('ASSET_BINARY_CRYPTO_UNAVAILABLE', 'SHA-256 is unavailable.');
  }
  let released = false;
  let token = 0;
  const activeWritables = new Set<FileSystemWritableFileStream>();
  let rootPromise: Promise<{
    objects: FileSystemDirectoryHandle;
    staging: FileSystemDirectoryHandle;
  }> | null = null;
  const roots = () => rootPromise ??= (async () => {
    try {
      const originRoot = options.rootDirectory ?? await (
        options.storage ?? (globalThis.navigator?.storage as OpfsStorageManager | undefined)
      )?.getDirectory();
      if (!originRoot) {
        throw objectError('ASSET_BINARY_OPFS_UNSUPPORTED', 'OPFS is unavailable.');
      }
      const product = await childDirectory(originRoot, 'tw-asset-manager');
      const root = await childDirectory(product, 'opfs-v1');
      const objects = await childDirectory(root, 'objects');
      const staging = await childDirectory(root, 'staging');
      return {objects, staging};
    } catch (error) {
      throw mappedOpfsError(error, 'open');
    }
  })();

  async function objectLocation(key: string): Promise<{
    directory: FileSystemDirectoryHandle;
    name: string;
  }> {
    const hash = toHex(new Uint8Array(
      await subtleCrypto.digest('SHA-256', new TextEncoder().encode(key))
    ));
    const {objects} = await roots();
    return {directory: await childDirectory(objects, hash.slice(0, 2)), name: hash};
  }

  const store: BinaryObjectStore = {
    kind: 'opfs',
    async put(descriptorValue, source, operationOptions = {}) {
      const descriptor = validateDescriptor(descriptorValue);
      assertActive(released, operationOptions.signal);
      const rootHandles = await roots();
      assertActive(released, operationOptions.signal);
      const stageName = `${Date.now().toString(36)}-${(++token).toString(36)}-${crypto.randomUUID?.() ?? 'write'}`;
      let writable: FileSystemWritableFileStream | null = null;
      try {
        const stageHandle = await rootHandles.staging.getFileHandle(stageName, {create: true});
        writable = await stageHandle.createWritable();
        activeWritables.add(writable);
        await writeSource(writable, source, descriptor.size, operationOptions.signal);
        await closeWritable(writable, operationOptions.signal);
        activeWritables.delete(writable);
        writable = null;
        assertActive(released, operationOptions.signal);
        const stagedFile = await stageHandle.getFile();
        {
          const staged = await readFileBytes(stagedFile, operationOptions.signal);
          await verify(staged, descriptor, subtleCrypto);
        }
        assertActive(released, operationOptions.signal);
        const location = await objectLocation(descriptor.key);
        assertActive(released, operationOptions.signal);
        const finalHandle = await location.directory.getFileHandle(location.name, {create: true});
        writable = await finalHandle.createWritable();
        activeWritables.add(writable);
        await copyFileToWritable(stagedFile, writable, operationOptions.signal);
        activeWritables.delete(writable);
        writable = null;
        {
          const committed = await readFileBytes(await finalHandle.getFile(), operationOptions.signal);
          await verify(committed, descriptor, subtleCrypto);
        }
        assertActive(released, operationOptions.signal);
        await rootHandles.staging.removeEntry(stageName);
      } catch (error) {
        if (writable) {
          activeWritables.delete(writable);
          await writable.abort(error).catch(() => {});
        }
        await rootHandles.staging.removeEntry(stageName).catch(() => {});
        throw mappedOpfsError(error, 'write');
      }
    },
    async get(descriptorValue, operationOptions = {}) {
      const descriptor = validateDescriptor(descriptorValue);
      assertActive(released, operationOptions.signal);
      try {
        const location = await objectLocation(descriptor.key);
        const handle = await location.directory.getFileHandle(location.name);
        const bytes = await readFileBytes(await handle.getFile(), operationOptions.signal);
        assertActive(released, operationOptions.signal);
        await verify(bytes, descriptor, subtleCrypto);
        assertActive(released, operationOptions.signal);
        return Object.freeze({...descriptor, bytes});
      } catch (error) {
        throw mappedOpfsError(error, 'read');
      }
    },
    async delete(key, operationOptions = {}) {
      assertActive(released, operationOptions.signal);
      try {
        const location = await objectLocation(key);
        await location.directory.removeEntry(location.name).catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
        });
      } catch (error) {
        throw mappedOpfsError(error, 'delete');
      }
    },
    async cleanupStaging(operationOptions = {}) {
      const limit = operationOptions.limit ?? 64;
      if (!Number.isSafeInteger(limit) || limit <= 0) {
        throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Staging cleanup limit is invalid.');
      }
      assertActive(released, operationOptions.signal);
      const {staging} = await roots();
      const createdBefore = operationOptions.createdBefore ?? Date.now() - 60 * 60 * 1000;
      let removed = 0;
      for await (const entry of staging.values()) {
        assertActive(released, operationOptions.signal);
        if (entry.kind !== 'file') continue;
        const file = await (entry as FileSystemFileHandle).getFile();
        if (file.lastModified > createdBefore) continue;
        await staging.removeEntry(entry.name);
        removed += 1;
        if (removed >= limit) break;
      }
      return removed;
    },
    async release() {
      if (released) return;
      released = true;
      await Promise.allSettled([...activeWritables].map((writable) => writable.abort()));
      activeWritables.clear();
    }
  };
  return Object.freeze(store);
}

/** IndexedDB adapter for consumers that want the object contract without OPFS. */
export function createIndexedDBBinaryObjectStore(
  options: IndexedDBBinaryObjectStoreOptions = {}
): BinaryObjectStore {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('IndexedDB binary object store options must be an object.');
  }
  const indexedDB = options.indexedDB ?? globalThis.indexedDB;
  const subtleCrypto = options.subtleCrypto ?? globalThis.crypto?.subtle;
  const databaseName = options.databaseName ?? 'tw-asset-manager-binary-objects-v1';
  if (typeof databaseName !== 'string' || databaseName.length === 0 || databaseName.length > 512 ||
      databaseName.includes('\0')) {
    throw new TypeError('databaseName must be a non-empty string of at most 512 code units.');
  }
  if (!subtleCrypto?.digest) {
    throw objectError('ASSET_BINARY_CRYPTO_UNAVAILABLE', 'SHA-256 is unavailable.');
  }
  let released = false;

  const open = (): Promise<IDBDatabase> => {
    assertActive(released);
    if (!indexedDB?.open) {
      throw objectError('ASSET_BINARY_OBJECT_INDEXEDDB_UNAVAILABLE', 'IndexedDB is unavailable.');
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(databaseName, 1);
    } catch (error) {
      throw objectError('ASSET_BINARY_OBJECT_INDEXEDDB_UNAVAILABLE', 'IndexedDB open failed.', error);
    }
    return new Promise((resolve, reject) => {
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('objects')) {
          request.result.createObjectStore('objects', {keyPath: 'key'});
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(objectError(
        'ASSET_BINARY_OBJECT_INDEXEDDB_UNAVAILABLE',
        'IndexedDB open failed.',
        request.error
      ));
      request.onblocked = () => reject(objectError(
        'ASSET_BINARY_OBJECT_INDEXEDDB_UNAVAILABLE',
        'IndexedDB open was blocked.'
      ));
    });
  };

  const complete = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });

  const result = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });

  const store: BinaryObjectStore = {
    kind: 'indexeddb',
    async put(descriptorValue, source, operationOptions = {}) {
      const descriptor = validateDescriptor(descriptorValue);
      assertActive(released, operationOptions.signal);
      const bytes = await sourceBytes(source, operationOptions.signal);
      await verify(bytes, descriptor, subtleCrypto);
      const database = await open();
      try {
        const transaction = database.transaction('objects', 'readwrite');
        const abort = () => transaction.abort();
        operationOptions.signal?.addEventListener('abort', abort, {once: true});
        transaction.objectStore('objects').put({
          key: descriptor.key,
          descriptor: {...descriptor},
          data: bytes.buffer
        });
        try {
          await complete(transaction);
        } finally {
          operationOptions.signal?.removeEventListener('abort', abort);
        }
      } catch (error) {
        if (operationOptions.signal?.aborted) throw abortError(operationOptions.signal.reason);
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          throw objectError('ASSET_BINARY_OBJECT_INDEXEDDB_QUOTA', 'IndexedDB quota was exceeded.', error);
        }
        throw objectError('ASSET_BINARY_OBJECT_INDEXEDDB_WRITE_FAILED', 'IndexedDB write failed.', error);
      } finally {
        database.close();
      }
    },
    async get(descriptorValue, operationOptions = {}) {
      const descriptor = validateDescriptor(descriptorValue);
      assertActive(released, operationOptions.signal);
      const database = await open();
      try {
        const transaction = database.transaction('objects', 'readonly');
        const record = await result(transaction.objectStore('objects').get(descriptor.key) as IDBRequest<unknown>);
        await complete(transaction);
        if (!record || typeof record !== 'object' ||
            !((record as {data?: unknown}).data instanceof ArrayBuffer)) {
          throw objectError('ASSET_BINARY_OBJECT_NOT_FOUND', 'IndexedDB binary object was not found.');
        }
        const bytes = new Uint8Array((record as {data: ArrayBuffer}).data);
        await verify(bytes, descriptor, subtleCrypto);
        return Object.freeze({...descriptor, bytes});
      } finally {
        database.close();
      }
    },
    async delete(key, operationOptions = {}) {
      assertActive(released, operationOptions.signal);
      validateDescriptor({key, size: 0, integrity: `sha256-${'0'.repeat(64)}`});
      const database = await open();
      try {
        const transaction = database.transaction('objects', 'readwrite');
        transaction.objectStore('objects').delete(key);
        await complete(transaction);
      } finally {
        database.close();
      }
    },
    async *listOrphans(operationOptions = {}) {
      const limit = operationOptions.limit ?? 64;
      if (!Number.isSafeInteger(limit) || limit <= 0) {
        throw objectError('ASSET_BINARY_OBJECT_INPUT_INVALID', 'Orphan scan limit is invalid.');
      }
      assertActive(released, operationOptions.signal);
      const database = await open();
      try {
        const transaction = database.transaction('objects', 'readonly');
        const keys = await result(transaction.objectStore('objects').getAllKeys());
        await complete(transaction);
        for (const key of keys.slice(0, limit)) {
          assertActive(released, operationOptions.signal);
          yield String(key);
        }
      } finally {
        database.close();
      }
    },
    async release() {
      released = true;
    }
  };
  return Object.freeze(store);
}
