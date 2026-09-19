import {IDBFactory} from 'fake-indexeddb';
import {describe, expect, it, vi} from 'vitest';

import {createBinaryBundleStore} from '../src/binary-bundle-store.js';
import {
  createIndexedDBBinaryObjectStore,
  createOpfsBinaryObjectStore,
  type BinaryObjectDescriptor,
  type BinaryObjectStore
} from '../src/binary-object-store.js';
import {createOpfsBinaryBundleStore} from '../src/opfs-binary-bundle-store.js';
import {createSessionBinaryBacking} from '../src/session-binary-backing.js';

class MemoryFile {
  bytes = new Uint8Array();
}

class MemoryWritable {
  private pending = new Uint8Array();

  constructor(private readonly file: MemoryFile) {}

  async write(data: FileSystemWriteChunkType): Promise<void> {
    if (!(data instanceof Uint8Array) && !(data instanceof ArrayBuffer)) throw new Error('unexpected write');
    const chunk = data instanceof Uint8Array ? Uint8Array.from(data) : new Uint8Array(data.slice(0));
    const combined = new Uint8Array(this.pending.byteLength + chunk.byteLength);
    combined.set(this.pending);
    combined.set(chunk, this.pending.byteLength);
    this.pending = combined;
  }

  async close(): Promise<void> {
    this.file.bytes = this.pending;
  }

  async abort(): Promise<void> {}
}

class MemoryFileHandle {
  readonly kind = 'file';

  constructor(readonly name: string, private readonly file: MemoryFile) {}

  async createWritable(): Promise<FileSystemWritableFileStream> {
    return new MemoryWritable(this.file) as unknown as FileSystemWritableFileStream;
  }

  async getFile(): Promise<File> {
    return new File([this.file.bytes], this.name);
  }
}

class MemoryDirectory {
  readonly kind = 'directory';
  readonly entries = new Map<string, MemoryDirectory | MemoryFileHandle>();
  failValues = false;

  constructor(readonly name: string) {}

  async getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions) {
    const existing = this.entries.get(name);
    if (existing instanceof MemoryDirectory) return existing as unknown as FileSystemDirectoryHandle;
    if (existing || !options?.create) throw new DOMException('missing', 'NotFoundError');
    const directory = new MemoryDirectory(name);
    this.entries.set(name, directory);
    return directory as unknown as FileSystemDirectoryHandle;
  }

  async getFileHandle(name: string, options?: FileSystemGetFileOptions) {
    const existing = this.entries.get(name);
    if (existing instanceof MemoryFileHandle) return existing as unknown as FileSystemFileHandle;
    if (existing || !options?.create) throw new DOMException('missing', 'NotFoundError');
    const handle = new MemoryFileHandle(name, new MemoryFile());
    this.entries.set(name, handle);
    return handle as unknown as FileSystemFileHandle;
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.entries.delete(name)) throw new DOMException('missing', 'NotFoundError');
  }

  async *values(): AsyncIterableIterator<FileSystemHandle> {
    if (this.failValues) throw new Error('directory scan failed');
    yield* this.entries.values() as Iterable<FileSystemHandle>;
  }
}

async function integrity(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)));
  return `sha256-${[...digest].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, resolve, reject};
}

async function metadataRecords<T>(
  indexedDB: IDBFactory,
  databaseName: string,
  storeName: string
): Promise<T[]> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    const transaction = database.transaction(storeName, 'readonly');
    const values = await new Promise<T[]>((resolve, reject) => {
      const request = transaction.objectStore(storeName).getAll() as IDBRequest<T[]>;
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return values;
  } finally {
    database.close();
  }
}

async function clearMetadataStore(
  indexedDB: IDBFactory,
  databaseName: string,
  storeName: string
): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).clear();
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

async function putMetadataRecord(
  indexedDB: IDBFactory,
  databaseName: string,
  storeName: string,
  value: unknown
): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

function memoryObjectStore(options: {
  readonly beforeGet?: () => Promise<void>;
  readonly beforeDelete?: (key: string) => Promise<void>;
  readonly deleteError?: Error;
} = {}): BinaryObjectStore {
  const values = new Map<string, {descriptor: BinaryObjectDescriptor; bytes: Uint8Array}>();
  return {
    kind: 'opfs',
    async put(descriptor, source) {
      if (!(source instanceof Uint8Array) && !(source instanceof ArrayBuffer)) {
        throw new Error('unexpected source');
      }
      values.set(descriptor.key, {
        descriptor,
        bytes: source instanceof Uint8Array ? Uint8Array.from(source) : new Uint8Array(source.slice(0))
      });
    },
    async get(descriptor) {
      await options.beforeGet?.();
      const value = values.get(descriptor.key);
      if (!value) throw new Error('missing object');
      return {...value.descriptor, bytes: Uint8Array.from(value.bytes)};
    },
    async delete(key) {
      await options.beforeDelete?.(key);
      if (options.deleteError) throw options.deleteError;
      values.delete(key);
    },
    async release() {}
  };
}

async function corruptOpfsManifestTotal(
  indexedDB: IDBFactory,
  databaseName: string
): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`${databaseName}-opfs-metadata`);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    const transaction = database.transaction('activeManifests', 'readwrite');
    const store = transaction.objectStore('activeManifests');
    const records = await new Promise<unknown[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    store.put({...records[0] as object, totalBytes: 999});
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

describe('OPFS binary object store', () => {
  it('provides an API-compatible IndexedDB adapter', async () => {
    const bytes = Uint8Array.from([9, 8, 7]);
    const digest = await integrity(bytes);
    const descriptor = {key: digest.slice(7), size: bytes.byteLength, integrity: digest};
    const store = createIndexedDBBinaryObjectStore({
      indexedDB: new IDBFactory(),
      databaseName: 'indexeddb-object-adapter-test'
    });

    await store.put(descriptor, bytes);
    await expect(store.get(descriptor)).resolves.toMatchObject({bytes});
    await store.delete(descriptor.key);
    await expect(store.get(descriptor)).rejects.toMatchObject({
      code: 'ASSET_BINARY_OBJECT_NOT_FOUND'
    });
  });

  it('uses only version and hash-derived path segments and verifies round trips', async () => {
    const root = new MemoryDirectory('root');
    const bytes = Uint8Array.from([1, 2, 3]);
    const digest = await integrity(bytes);
    const key = 'object:logical-key';
    const store = createOpfsBinaryObjectStore({
      rootDirectory: root as unknown as FileSystemDirectoryHandle
    });
    const descriptor = {key, size: bytes.byteLength, integrity: digest};
    const pathDigest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
    );
    const objectName = [...pathDigest]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');

    await store.put(descriptor, bytes);
    await expect(store.get(descriptor)).resolves.toMatchObject({key, bytes});

    const product = root.entries.get('tw-asset-manager') as MemoryDirectory;
    const version = product.entries.get('opfs-v1') as MemoryDirectory;
    const objects = version.entries.get('objects') as MemoryDirectory;
    expect([...objects.entries.keys()]).toEqual([objectName.slice(0, 2)]);
    const prefix = objects.entries.get(objectName.slice(0, 2)) as MemoryDirectory;
    expect([...prefix.entries.keys()]).toEqual([objectName]);
  });

  it('writes a multi-chunk ReadableStream without requiring a hash-shaped key', async () => {
    const root = new MemoryDirectory('root');
    const bytes = Uint8Array.from([1, 2, 3, 4]);
    const descriptor = {
      key: 'stream:asset',
      size: bytes.byteLength,
      integrity: await integrity(bytes)
    };
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 2));
        controller.enqueue(bytes.slice(2));
        controller.close();
      }
    });
    const store = createOpfsBinaryObjectStore({
      rootDirectory: root as unknown as FileSystemDirectoryHandle
    });

    await store.put(descriptor, stream);
    await expect(store.get(descriptor)).resolves.toMatchObject({bytes});
  });

  it('reports physical, staging, pending-deletion, and orphan OPFS bytes', async () => {
    const root = new MemoryDirectory('root');
    const referencedBytes = Uint8Array.from([1, 2]);
    const pendingBytes = Uint8Array.from([3, 4, 5]);
    const referenced = {
      key: 'stats:referenced',
      size: referencedBytes.byteLength,
      integrity: await integrity(referencedBytes)
    };
    const pending = {
      key: 'stats:pending',
      size: pendingBytes.byteLength,
      integrity: await integrity(pendingBytes)
    };
    const store = createOpfsBinaryObjectStore({
      rootDirectory: root as unknown as FileSystemDirectoryHandle
    });
    await store.put(referenced, referencedBytes);
    await store.put(pending, pendingBytes);
    const product = root.entries.get('tw-asset-manager') as MemoryDirectory;
    const version = product.entries.get('opfs-v1') as MemoryDirectory;
    const staging = version.entries.get('staging') as MemoryDirectory;
    const stage = await staging.getFileHandle('pending-stage', {create: true});
    const writable = await stage.createWritable();
    await writable.write(Uint8Array.from([8, 9, 10, 11]));
    await writable.close();

    await expect(store.getStats?.({
      referencedKeys: new Set([referenced.key]),
      pendingDeletionKeys: new Set([pending.key])
    })).resolves.toEqual({
      physicalObjectBytes: 5,
      stagingBytes: 4,
      orphanBytes: 0,
      pendingDeletionBytes: 3
    });
    await expect(store.getStats?.({
      referencedKeys: new Set([referenced.key])
    })).resolves.toMatchObject({orphanBytes: 3, pendingDeletionBytes: 0});
  });

  it('does not create a final object when release happens during staged verification', async () => {
    const root = new MemoryDirectory('root');
    const bytes = Uint8Array.from([5, 4, 3]);
    const descriptor = {key: 'release:during-digest', size: 3, integrity: await integrity(bytes)};
    const digestStarted = deferred();
    const continueDigest = deferred();
    let digestCalls = 0;
    const subtleCrypto = {
      async digest(algorithm: AlgorithmIdentifier, data: BufferSource) {
        digestCalls += 1;
        if (digestCalls === 1) {
          digestStarted.resolve();
          await continueDigest.promise;
        }
        return crypto.subtle.digest(algorithm, data);
      }
    } as SubtleCrypto;
    const store = createOpfsBinaryObjectStore({
      rootDirectory: root as unknown as FileSystemDirectoryHandle,
      subtleCrypto
    });

    const put = store.put(descriptor, bytes);
    await digestStarted.promise;
    await store.release();
    continueDigest.resolve();

    await expect(put).rejects.toMatchObject({code: 'ASSET_BINARY_STORE_RELEASED'});
    const product = root.entries.get('tw-asset-manager') as MemoryDirectory;
    const version = product.entries.get('opfs-v1') as MemoryDirectory;
    const objects = version.entries.get('objects') as MemoryDirectory;
    expect(objects.entries.size).toBe(0);
  });

  it('selects OPFS once and preserves all-or-nothing bundle visibility', async () => {
    const root = new MemoryDirectory('root');
    const indexedDB = new IDBFactory();
    const bytes = Uint8Array.from([4, 5, 6]);
    const fileIntegrity = await integrity(bytes);
    const input = {
      namespace: 'story/private-name',
      name: '../not-an-opfs-path',
      integrity: `sha256-${'1'.repeat(64)}`,
      files: [{path: 'assets/model.bin', size: 3, integrity: fileIntegrity, bytes}]
    };
    const store = createBinaryBundleStore({
      backendPolicy: 'opfs-required',
      indexedDB,
      databaseName: 'opfs-bundle-test',
      opfs: {rootDirectory: root as unknown as FileSystemDirectoryHandle}
    });

    expect(store.getBackendStatus()).toMatchObject({selected: 'pending'});
    await store.put(input);
    expect(store.getBackendStatus()).toMatchObject({selected: 'opfs'});
    await expect(store.getStats()).resolves.toEqual({
      backend: 'opfs',
      bundles: 1,
      logicalBytes: 3,
      physicalObjectBytes: 3,
      stagingBytes: 0,
      orphanBytes: 0,
      pendingDeletionBytes: 0
    });
    await expect(store.get(input)).resolves.toMatchObject({name: input.name, totalBytes: 3});
    await store.delete(input);
    await expect(store.get(input)).rejects.toMatchObject({code: 'ASSET_BINARY_BUNDLE_NOT_FOUND'});
  });

  it('falls back only during OPFS establishment when preferred', async () => {
    const indexedDB = new IDBFactory();
    const getDirectory = vi.fn(async () => {
      throw new DOMException('private mode', 'InvalidStateError');
    });
    const bytes = Uint8Array.from([7]);
    const fileIntegrity = await integrity(bytes);
    const input = {
      namespace: 'story',
      name: 'asset',
      integrity: `sha256-${'2'.repeat(64)}`,
      files: [{path: 'asset.bin', size: 1, integrity: fileIntegrity, bytes}]
    };
    const store = createBinaryBundleStore({
      backendPolicy: 'opfs-prefer',
      indexedDB,
      databaseName: 'opfs-fallback-test',
      opfs: {storage: {getDirectory}}
    });

    await store.put(input);
    expect(store.getBackendStatus()).toEqual({
      policy: 'opfs-prefer',
      selected: 'indexeddb',
      warning: {
        code: 'ASSET_BINARY_BACKEND_FALLBACK',
        causeCode: 'ASSET_BINARY_OPFS_OPEN_FAILED'
      }
    });
    await expect(store.get(input)).resolves.toMatchObject({totalBytes: 1});
    expect(getDirectory).toHaveBeenCalledTimes(1);
  });

  it('does not fallback when OPFS recovery itself fails', async () => {
    const root = new MemoryDirectory('root');
    const product = new MemoryDirectory('tw-asset-manager');
    const version = new MemoryDirectory('opfs-v1');
    const objects = new MemoryDirectory('objects');
    const staging = new MemoryDirectory('staging');
    staging.failValues = true;
    root.entries.set('tw-asset-manager', product);
    product.entries.set('opfs-v1', version);
    version.entries.set('objects', objects);
    version.entries.set('staging', staging);
    const store = createBinaryBundleStore({
      backendPolicy: 'opfs-prefer',
      indexedDB: new IDBFactory(),
      databaseName: 'opfs-recovery-failure-test',
      opfs: {rootDirectory: root as unknown as FileSystemDirectoryHandle}
    });

    await expect(store.getStats()).rejects.toMatchObject({
      code: 'ASSET_BINARY_OPFS_RECOVERY_FAILED'
    });
    expect(store.getBackendStatus()).toMatchObject({selected: 'pending'});
  });

  it('does not delete an object referenced by a concurrent writer in another store', async () => {
    const root = new MemoryDirectory('root');
    const indexedDB = new IDBFactory();
    const bytes = Uint8Array.from([8, 6, 4, 2]);
    const fileIntegrity = await integrity(bytes);
    const common = {
      backendPolicy: 'opfs-required' as const,
      indexedDB,
      databaseName: 'opfs-concurrent-delete-test',
      opfs: {rootDirectory: root as unknown as FileSystemDirectoryHandle}
    };
    const firstStore = createBinaryBundleStore(common);
    const secondStore = createBinaryBundleStore(common);
    const first = {
      namespace: 'story',
      name: 'first',
      integrity: `sha256-${'4'.repeat(64)}`,
      files: [{path: 'shared.bin', size: bytes.byteLength, integrity: fileIntegrity, bytes}]
    };
    const second = {...first, name: 'second', integrity: `sha256-${'5'.repeat(64)}`};
    await firstStore.put(first);

    await Promise.all([secondStore.put(second), firstStore.delete(first)]);
    await expect(secondStore.get(second)).resolves.toMatchObject({totalBytes: bytes.byteLength});
  });

  it('lets only one cleanup owner delete a tombstoned object', async () => {
    const indexedDB = new IDBFactory();
    const databaseName = 'opfs-cleanup-owner-test';
    const deleteStarted = deferred();
    const continueDelete = deferred();
    let deleteCalls = 0;
    const objectStore = memoryObjectStore({
      async beforeDelete() {
        deleteCalls += 1;
        if (deleteCalls === 1) {
          deleteStarted.resolve();
          await continueDelete.promise;
        }
      }
    });
    const common = {objectStore, indexedDB, databaseName};
    const firstStore = createOpfsBinaryBundleStore(common);
    const secondStore = createOpfsBinaryBundleStore(common);
    await Promise.all([firstStore.establish(), secondStore.establish()]);
    const bytes = Uint8Array.from([4, 4]);
    const fileIntegrity = await integrity(bytes);
    const first = {
      namespace: 'story',
      name: 'cleanup-first',
      integrity: `sha256-${'b'.repeat(64)}`,
      files: [{path: 'shared.bin', size: 2, integrity: fileIntegrity, bytes}]
    };
    const second = {...first, name: 'cleanup-second', integrity: `sha256-${'c'.repeat(64)}`};
    await firstStore.put(first);

    const deletion = firstStore.delete(first);
    await deleteStarted.promise;
    const replacement = secondStore.put(second);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(deleteCalls).toBe(1);
    continueDelete.resolve();
    await Promise.all([deletion, replacement]);
    await expect(secondStore.get(second)).resolves.toMatchObject({totalBytes: 2});
  });

  it('removes a stale intent atomically before deleting its objects', async () => {
    const indexedDB = new IDBFactory();
    const databaseName = 'opfs-stale-intent-atomic-test';
    const deleteStarted = deferred();
    const continueDelete = deferred();
    const objectStore = memoryObjectStore({
      async beforeDelete() {
        deleteStarted.resolve();
        await continueDelete.promise;
      }
    });
    const seedStore = createOpfsBinaryBundleStore({objectStore, indexedDB, databaseName});
    await seedStore.establish();
    const bytes = Uint8Array.from([7, 7]);
    const descriptor = {
      key: 'stale:intent-object',
      size: 2,
      integrity: await integrity(bytes)
    };
    await objectStore.put(descriptor, bytes);
    await putMetadataRecord(indexedDB, databaseName, 'pendingIntents', {
      token: 'stale-token',
      key: 'stale-key',
      createdAt: 0,
      heartbeatAt: 0,
      generation: 1,
      epoch: 0,
      objects: [descriptor]
    });
    const recoveryStore = createOpfsBinaryBundleStore({
      objectStore,
      indexedDB,
      databaseName,
      now: () => 10_000,
      ttlMs: 1_000
    });

    const recovery = recoveryStore.establish();
    await deleteStarted.promise;
    await expect(metadataRecords(indexedDB, databaseName, 'pendingIntents')).resolves.toHaveLength(0);
    await expect(metadataRecords(indexedDB, databaseName, 'pendingObjectDeletions')).resolves.toHaveLength(1);
    continueDelete.resolve();
    await recovery;
  });

  it('does not delete a manifest refreshed after an expired read', async () => {
    const indexedDB = new IDBFactory();
    const databaseName = 'opfs-expired-read-race-test';
    const objectStore = memoryObjectStore();
    let timestamp = 0;
    let refreshOnClockRead = false;
    let controlDatabase: IDBDatabase | null = null;
    const common = {
      objectStore,
      indexedDB,
      databaseName,
      now: () => {
        if (refreshOnClockRead && controlDatabase) {
          refreshOnClockRead = false;
          const transaction = controlDatabase.transaction('activeManifests', 'readwrite');
          const manifests = transaction.objectStore('activeManifests');
          const request = manifests.getAll();
          request.onsuccess = () => {
            for (const manifest of request.result) {
              manifests.put({...manifest, lastAccessedAt: timestamp});
            }
          };
        }
        return timestamp;
      },
      ttlMs: 100
    };
    const firstStore = createOpfsBinaryBundleStore(common);
    const secondStore = createOpfsBinaryBundleStore(common);
    const bytes = Uint8Array.from([9]);
    const input = {
      namespace: 'story',
      name: 'refresh-race',
      integrity: `sha256-${'d'.repeat(64)}`,
      files: [{path: 'file.bin', size: 1, integrity: await integrity(bytes), bytes}]
    };
    await firstStore.put(input);
    await secondStore.establish();
    controlDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    timestamp = 1_000;
    refreshOnClockRead = true;
    await expect(firstStore.get(input)).rejects.toMatchObject({
      code: 'ASSET_BINARY_BUNDLE_NOT_FOUND'
    });
    controlDatabase.close();
    await expect(secondStore.get(input)).resolves.toMatchObject({totalBytes: 1});
  });

  it('requires its pending intent to still exist when publishing a manifest', async () => {
    const indexedDB = new IDBFactory();
    const databaseName = 'opfs-intent-commit-test';
    const verifyStarted = deferred();
    const continueVerify = deferred();
    const objectStore = memoryObjectStore({
      async beforeGet() {
        verifyStarted.resolve();
        await continueVerify.promise;
      }
    });
    const bytes = Uint8Array.from([1, 3, 5]);
    const input = {
      namespace: 'story',
      name: 'intent',
      integrity: `sha256-${'7'.repeat(64)}`,
      files: [{path: 'file.bin', size: 3, integrity: await integrity(bytes), bytes}]
    };
    const store = createOpfsBinaryBundleStore({objectStore, indexedDB, databaseName});

    const put = store.put(input);
    await verifyStarted.promise;
    await clearMetadataStore(indexedDB, databaseName, 'pendingIntents');
    continueVerify.resolve();

    await expect(put).rejects.toMatchObject({code: 'ASSET_BINARY_BUNDLE_ABORTED'});
    await expect(metadataRecords(indexedDB, databaseName, 'activeManifests')).resolves.toHaveLength(0);
  });

  it('serializes concurrent eviction decisions in the manifest commit transaction', async () => {
    const indexedDB = new IDBFactory();
    const databaseName = 'opfs-atomic-eviction-test';
    const bothVerifying = deferred();
    const continueVerification = deferred();
    let verifying = 0;
    const objectStore = memoryObjectStore({
      async beforeGet() {
        verifying += 1;
        if (verifying === 2) bothVerifying.resolve();
        await continueVerification.promise;
      }
    });
    const common = {
      objectStore,
      indexedDB,
      databaseName,
      maxStoredBundles: 1
    };
    const firstStore = createOpfsBinaryBundleStore(common);
    const secondStore = createOpfsBinaryBundleStore(common);
    const firstBytes = Uint8Array.from([2]);
    const secondBytes = Uint8Array.from([4]);
    const first = {
      namespace: 'story',
      name: 'first',
      integrity: `sha256-${'8'.repeat(64)}`,
      files: [{path: 'first.bin', size: 1, integrity: await integrity(firstBytes), bytes: firstBytes}]
    };
    const second = {
      namespace: 'story',
      name: 'second',
      integrity: `sha256-${'9'.repeat(64)}`,
      files: [{path: 'second.bin', size: 1, integrity: await integrity(secondBytes), bytes: secondBytes}]
    };

    const puts = Promise.all([firstStore.put(first), secondStore.put(second)]);
    await bothVerifying.promise;
    continueVerification.resolve();
    await puts;

    await expect(metadataRecords(indexedDB, databaseName, 'activeManifests')).resolves.toHaveLength(1);
  });

  it('persists replacement deletion work in the same transaction as the new manifest', async () => {
    const indexedDB = new IDBFactory();
    const databaseName = 'opfs-replacement-tombstone-test';
    const objectStore = memoryObjectStore({deleteError: new Error('simulated crash')});
    const store = createOpfsBinaryBundleStore({objectStore, indexedDB, databaseName});
    const oldBytes = Uint8Array.from([6]);
    const newBytes = Uint8Array.from([7]);
    const key = {
      namespace: 'story',
      name: 'replace',
      integrity: `sha256-${'a'.repeat(64)}`
    };
    await store.put({
      ...key,
      files: [{path: 'file.bin', size: 1, integrity: await integrity(oldBytes), bytes: oldBytes}]
    });

    await expect(store.put({
      ...key,
      files: [{path: 'file.bin', size: 1, integrity: await integrity(newBytes), bytes: newBytes}]
    })).rejects.toThrow('simulated crash');

    await expect(metadataRecords(indexedDB, databaseName, 'activeManifests')).resolves.toHaveLength(1);
    await expect(metadataRecords(indexedDB, databaseName, 'pendingObjectDeletions')).resolves.toHaveLength(1);
  });

  it('rejects an active manifest whose aggregate metadata is corrupt', async () => {
    const root = new MemoryDirectory('root');
    const indexedDB = new IDBFactory();
    const databaseName = 'opfs-corrupt-manifest-test';
    const bytes = Uint8Array.from([2, 4]);
    const input = {
      namespace: 'story',
      name: 'corrupt',
      integrity: `sha256-${'6'.repeat(64)}`,
      files: [{path: 'file.bin', size: 2, integrity: await integrity(bytes), bytes}]
    };
    const store = createBinaryBundleStore({
      backendPolicy: 'opfs-required',
      indexedDB,
      databaseName,
      opfs: {rootDirectory: root as unknown as FileSystemDirectoryHandle}
    });
    await store.put(input);
    await corruptOpfsManifestTotal(indexedDB, databaseName);

    await expect(store.get(input)).rejects.toMatchObject({
      code: 'ASSET_BINARY_BUNDLE_CORRUPT'
    });
  });

  it('uses the OPFS object contract for an explicitly selected session backing', async () => {
    const root = new MemoryDirectory('root');
    const bytes = Uint8Array.from([3, 2, 1]);
    const fileIntegrity = await integrity(bytes);
    const release = vi.fn();
    const onFatalError = vi.fn();
    const asset = {
      namespace: 'story/source',
      name: 'session-model',
      integrity: `sha256-${'3'.repeat(64)}`,
      files: [{path: 'model.bin', size: 3, integrity: fileIntegrity}]
    };
    const backing = await createSessionBinaryBacking({
      policy: 'required',
      sessionId: 'session-opfs-test',
      onFatalError,
      assets: [asset],
      source: {
        async read() {
          return {
            namespace: asset.namespace,
            name: asset.name,
            integrity: asset.integrity,
            files: [{path: 'model.bin', size: 3, integrity: fileIntegrity, bytes}]
          };
        },
        release
      }
    }, {
      backendPolicy: 'opfs-required',
      indexedDB: new IDBFactory(),
      databaseName: 'opfs-session-test',
      opfs: {rootDirectory: root as unknown as FileSystemDirectoryHandle}
    });

    expect(backing.backend).toBe('opfs');
    expect(release).toHaveBeenCalledTimes(1);
    await expect(backing.get(asset)).resolves.toMatchObject({totalBytes: 3});
    const renewal = backing.renewLease();
    const disposal = backing.dispose();
    await Promise.allSettled([renewal]);
    await disposal;
    expect(onFatalError).not.toHaveBeenCalled();
    await expect(backing.get(asset)).rejects.toMatchObject({
      code: 'ASSET_SESSION_BINARY_RELEASED'
    });
  });
});
