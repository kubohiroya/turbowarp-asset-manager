import {IDBFactory, IDBObjectStore} from 'fake-indexeddb';
import {describe, expect, it, vi} from 'vitest';

import {
  createBinaryBundleStore,
  type BinaryBundleFileInput,
  type BinaryBundlePutInput
} from '../src/binary-bundle-store.js';

const DATABASE_NAME = 'test-binary-bundles';

async function sha256Integrity(bytes: Uint8Array, encoding: 'hex' | 'base64' = 'hex') {
  const owned = Uint8Array.from(bytes);
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', owned.buffer));
  if (encoding === 'base64') {
    let binary = '';
    for (const value of digest) binary += String.fromCharCode(value);
    return `sha256-${btoa(binary)}`;
  }
  return `sha256-${[...digest]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

async function file(path: string, values: number[], encoding: 'hex' | 'base64' = 'hex') {
  const bytes = Uint8Array.from(values);
  return {
    path,
    size: bytes.byteLength,
    integrity: await sha256Integrity(bytes, encoding),
    bytes
  } satisfies BinaryBundleFileInput;
}

async function poseBundle(
  namespace = 'story-001/source-integrity',
  name = 'RescuePose',
  suffix = 0
): Promise<BinaryBundlePutInput> {
  return {
    namespace,
    name,
    integrity: `sha256-${String(suffix).padStart(64, '0')}`,
    files: [
      await file('metadata.json', [1, 2, suffix]),
      await file('model.json', [3, 4, suffix], 'base64'),
      await file('weights.bin', [5, 6, suffix])
    ]
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function openDatabase(indexedDB: IDBFactory): Promise<IDBDatabase> {
  return requestResult(indexedDB.open(DATABASE_NAME));
}

function keyFor(input: BinaryBundlePutInput): string {
  return JSON.stringify([1, input.namespace, input.name, input.integrity]);
}

async function tamperFile(indexedDB: IDBFactory, input: BinaryBundlePutInput): Promise<void> {
  const database = await openDatabase(indexedDB);
  try {
    const transaction = database.transaction('bundles', 'readwrite');
    const store = transaction.objectStore('bundles');
    const request = store.get(keyFor(input));
    request.onsuccess = () => {
      const record = request.result;
      record.files[0].data = Uint8Array.from([9, 9, 9]).buffer;
      store.put(record);
    };
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

async function storeCounts(indexedDB: IDBFactory) {
  const database = await openDatabase(indexedDB);
  try {
    const transaction = database.transaction(['bundles', 'bundleMetadata'], 'readonly');
    const bundles = requestResult(transaction.objectStore('bundles').count());
    const metadata = requestResult(transaction.objectStore('bundleMetadata').count());
    const result = {bundles: await bundles, metadata: await metadata};
    await transactionComplete(transaction);
    return result;
  } finally {
    database.close();
  }
}

async function putOrphanRecords(
  indexedDB: IDBFactory,
  metadataInput: BinaryBundlePutInput
): Promise<void> {
  const database = await openDatabase(indexedDB);
  try {
    const transaction = database.transaction(['bundles', 'bundleMetadata'], 'readwrite');
    transaction.objectStore('bundles').put({key: 'orphan-bundle', data: new ArrayBuffer(1)});
    const files = metadataInput.files
      .map(({path, size, integrity}) => ({path: String(path), size: Number(size), integrity: String(integrity)}))
      .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
    transaction.objectStore('bundleMetadata').put({
      formatVersion: 1,
      key: keyFor(metadataInput),
      namespace: metadataInput.namespace,
      name: metadataInput.name,
      integrity: metadataInput.integrity,
      files,
      totalBytes: files.reduce((sum, candidate) => sum + candidate.size, 0),
      createdAt: 1,
      lastAccessedAt: 1,
      writeToken: 'orphan-metadata'
    });
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return {promise, resolve};
}

function delayedOpenFactory(
  indexedDB: IDBFactory,
  opened: ReturnType<typeof deferred<void>>,
  gate: ReturnType<typeof deferred<void>>
): IDBFactory {
  return {
    open(name: string, version?: number) {
      const actual = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
      let success: ((this: IDBOpenDBRequest, event: Event) => unknown) | null = null;
      const wrapper = {
        get result() {
          return actual.result;
        },
        get error() {
          return actual.error;
        },
        set onupgradeneeded(
          handler: ((this: IDBOpenDBRequest, event: IDBVersionChangeEvent) => unknown) | null
        ) {
          actual.onupgradeneeded = handler
            ? (event) => handler.call(wrapper as unknown as IDBOpenDBRequest, event)
            : null;
        },
        set onsuccess(handler: ((this: IDBOpenDBRequest, event: Event) => unknown) | null) {
          success = handler;
        },
        set onerror(handler: ((this: IDBOpenDBRequest, event: Event) => unknown) | null) {
          actual.onerror = handler
            ? (event) => handler.call(wrapper as unknown as IDBOpenDBRequest, event)
            : null;
        },
        set onblocked(handler: ((this: IDBOpenDBRequest, event: Event) => unknown) | null) {
          actual.onblocked = handler
            ? (event) => handler.call(wrapper as unknown as IDBOpenDBRequest, event)
            : null;
        }
      };
      actual.onsuccess = (event) => {
        opened.resolve();
        void gate.promise.then(() => success?.call(wrapper as unknown as IDBOpenDBRequest, event));
      };
      return wrapper as unknown as IDBOpenDBRequest;
    }
  } as IDBFactory;
}

describe('binary bundle store', () => {
  it('commits and returns a complete sorted bundle without retaining caller bytes', async () => {
    const indexedDB = new IDBFactory();
    const store = createBinaryBundleStore({indexedDB, databaseName: DATABASE_NAME});
    const input = await poseBundle();
    const source = input.files[0]!.bytes as Uint8Array;

    await expect(store.put(input)).resolves.toMatchObject({
      namespace: input.namespace,
      name: input.name,
      totalBytes: 9
    });
    source.fill(0);

    const result = await store.get(input);
    expect(result.files.map(({path}) => path)).toEqual([
      'metadata.json',
      'model.json',
      'weights.bin'
    ]);
    expect([...result.files[0]!.bytes]).toEqual([1, 2, 0]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.files)).toBe(true);
    await expect(storeCounts(indexedDB)).resolves.toEqual({bundles: 1, metadata: 1});

    await store.delete(input);
    await store.delete(input);
    await expect(store.get(input)).rejects.toMatchObject({
      code: 'ASSET_BINARY_BUNDLE_NOT_FOUND'
    });
    await expect(storeCounts(indexedDB)).resolves.toEqual({bundles: 0, metadata: 0});
  });

  it('isolates identical asset names and bundle integrities by namespace', async () => {
    const indexedDB = new IDBFactory();
    const store = createBinaryBundleStore({indexedDB, databaseName: DATABASE_NAME});
    const first = await poseBundle('story-001/source-a');
    const second = await poseBundle('story-002/source-a');
    await store.put(first);
    await store.put(second);
    await store.delete(first);

    await expect(store.get(first)).rejects.toMatchObject({
      code: 'ASSET_BINARY_BUNDLE_NOT_FOUND'
    });
    await expect(store.get(second)).resolves.toMatchObject({namespace: 'story-002/source-a'});
  });

  it('rejects malformed input and file integrity before opening IndexedDB', async () => {
    const open = vi.fn(() => {
      throw new Error('must not open');
    });
    const store = createBinaryBundleStore({
      indexedDB: {open} as unknown as IDBFactory,
      databaseName: DATABASE_NAME,
      maxFilesPerBundle: 3,
      maxBundleBytes: 16
    });
    const valid = await poseBundle();
    const invalid = [
      {...valid, namespace: ''},
      {...valid, name: ''},
      {...valid, integrity: 'not-sha256'},
      {...valid, files: []},
      {...valid, files: [...valid.files, await file('extra.bin', [1])]},
      {...valid, files: [valid.files[0], valid.files[0], valid.files[2]]},
      {...valid, files: [{...valid.files[0], path: '../metadata.json'}, ...valid.files.slice(1)]},
      {...valid, files: [{...valid.files[0], size: 99}, ...valid.files.slice(1)]},
      {
        ...valid,
        files: [{...valid.files[0], bytes: Uint8Array.from([9, 9, 9])}, ...valid.files.slice(1)]
      }
    ];
    for (const input of invalid) await expect(store.put(input as never)).rejects.toHaveProperty('code');
    expect(open).not.toHaveBeenCalled();
  });

  it('fails closed and removes a bundle whose stored bytes no longer match integrity', async () => {
    const indexedDB = new IDBFactory();
    const store = createBinaryBundleStore({indexedDB, databaseName: DATABASE_NAME});
    const input = await poseBundle();
    await store.put(input);
    await tamperFile(indexedDB, input);

    await expect(store.get(input)).rejects.toMatchObject({
      code: 'ASSET_BINARY_BUNDLE_INTEGRITY_MISMATCH'
    });
    await expect(storeCounts(indexedDB)).resolves.toEqual({bundles: 0, metadata: 0});
  });

  it('bounds persistent bytes and evicts the least-recently-used bundle', async () => {
    const indexedDB = new IDBFactory();
    let time = 1;
    const store = createBinaryBundleStore({
      indexedDB,
      databaseName: DATABASE_NAME,
      now: () => time,
      maxStoreBytes: 9,
      maxBundleBytes: 9
    });
    const first = await poseBundle('story-001', 'First', 1);
    const second = await poseBundle('story-001', 'Second', 2);
    await store.put(first);
    time += 1;
    await store.put(second);

    await expect(store.get(first)).rejects.toMatchObject({
      code: 'ASSET_BINARY_BUNDLE_NOT_FOUND'
    });
    await expect(store.get(second)).resolves.toMatchObject({name: 'Second'});
    await expect(storeCounts(indexedDB)).resolves.toEqual({bundles: 1, metadata: 1});
  });

  it('touches successful reads and removes orphaned bundle and metadata records', async () => {
    const indexedDB = new IDBFactory();
    let time = 1;
    const store = createBinaryBundleStore({
      indexedDB,
      databaseName: DATABASE_NAME,
      now: () => time,
      maxStoreBytes: 18,
      maxBundleBytes: 9
    });
    const first = await poseBundle('story-001', 'First', 1);
    const second = await poseBundle('story-001', 'Second', 2);
    const third = await poseBundle('story-001', 'Third', 3);
    const orphan = await poseBundle('story-orphan', 'Missing', 4);
    await store.put(first);
    time += 1;
    await store.put(second);
    await putOrphanRecords(indexedDB, orphan);
    time += 1;
    await store.get(first);
    time += 1;
    await store.put(third);

    await expect(store.get(first)).resolves.toMatchObject({name: 'First'});
    await expect(store.get(second)).rejects.toMatchObject({
      code: 'ASSET_BINARY_BUNDLE_NOT_FOUND'
    });
    await expect(store.get(third)).resolves.toMatchObject({name: 'Third'});
    await expect(store.get(orphan)).rejects.toMatchObject({
      code: 'ASSET_BINARY_BUNDLE_NOT_FOUND'
    });
    await expect(storeCounts(indexedDB)).resolves.toEqual({bundles: 2, metadata: 2});
  });

  it('cancels a stale slower replacement and keeps the most recent bundle', async () => {
    const indexedDB = new IDBFactory();
    const firstDigest = deferred<ArrayBuffer>();
    let calls = 0;
    const subtleCrypto = {
      digest(algorithm: AlgorithmIdentifier, data: BufferSource) {
        calls += 1;
        if (calls === 1) return firstDigest.promise;
        return globalThis.crypto.subtle.digest(algorithm, data);
      }
    } as SubtleCrypto;
    const store = createBinaryBundleStore({indexedDB, databaseName: DATABASE_NAME, subtleCrypto});
    const first = await poseBundle('story-001', 'RescuePose', 1);
    const secondInput = await poseBundle('story-001', 'RescuePose', 2);
    const second = {...secondInput, integrity: first.integrity};

    const stale = store.put(first);
    await Promise.resolve();
    await store.put(second);
    firstDigest.resolve(
      await globalThis.crypto.subtle.digest(
        'SHA-256',
        Uint8Array.from(first.files[0]!.bytes as Uint8Array).buffer
      )
    );
    await expect(stale).rejects.toMatchObject({name: 'AbortError'});

    const result = await store.get(first);
    expect([...result.files[0]!.bytes]).toEqual([1, 2, 2]);
  });

  it('aborts pending work on release and rejects later operations', async () => {
    const indexedDB = new IDBFactory();
    const digest = deferred<ArrayBuffer>();
    let calls = 0;
    const subtleCrypto = {
      digest(algorithm: AlgorithmIdentifier, data: BufferSource) {
        calls += 1;
        return calls === 1 ? digest.promise : globalThis.crypto.subtle.digest(algorithm, data);
      }
    } as SubtleCrypto;
    const store = createBinaryBundleStore({indexedDB, databaseName: DATABASE_NAME, subtleCrypto});
    const input = await poseBundle();
    const pending = store.put(input);
    await Promise.resolve();
    await store.release();

    await expect(pending).rejects.toMatchObject({code: 'ASSET_BINARY_BUNDLE_RELEASED'});
    digest.resolve(
      await globalThis.crypto.subtle.digest(
        'SHA-256',
        Uint8Array.from(input.files[0]!.bytes as Uint8Array).buffer
      )
    );
    await expect(store.get(input)).rejects.toMatchObject({code: 'ASSET_BINARY_BUNDLE_RELEASED'});
    await expect(store.release()).resolves.toBeUndefined();
  });

  it('observes an AbortSignal while SHA-256 verification is pending', async () => {
    const indexedDB = new IDBFactory();
    const digest = deferred<ArrayBuffer>();
    const store = createBinaryBundleStore({
      indexedDB,
      databaseName: DATABASE_NAME,
      subtleCrypto: {digest: () => digest.promise} as unknown as SubtleCrypto
    });
    const input = await poseBundle();
    const controller = new AbortController();
    const pending = store.put(input, {signal: controller.signal});
    await Promise.resolve();
    controller.abort('superseded');

    await expect(pending).rejects.toMatchObject({
      name: 'AbortError',
      code: 'ASSET_BINARY_BUNDLE_ABORTED'
    });
    await expect(indexedDB.databases()).resolves.toEqual([]);
  });

  it('rechecks AbortSignal after a pending IndexedDB open completes', async () => {
    const indexedDB = new IDBFactory();
    const opened = deferred<void>();
    const gate = deferred<void>();
    const store = createBinaryBundleStore({
      indexedDB: delayedOpenFactory(indexedDB, opened, gate),
      databaseName: DATABASE_NAME
    });
    const input = await poseBundle();
    const controller = new AbortController();
    const pending = store.put(input, {signal: controller.signal});
    await opened.promise;
    controller.abort('superseded-during-open');
    gate.resolve();

    await expect(pending).rejects.toMatchObject({
      name: 'AbortError',
      code: 'ASSET_BINARY_BUNDLE_ABORTED'
    });
    await expect(storeCounts(indexedDB)).resolves.toEqual({bundles: 0, metadata: 0});
  });

  it('reports unavailable storage and quota failures with stable codes', async () => {
    const input = await poseBundle();
    const unavailable = createBinaryBundleStore({
      indexedDB: {open: () => {
        throw new Error('private mode');
      }} as unknown as IDBFactory,
      databaseName: DATABASE_NAME
    });
    await expect(unavailable.put(input)).rejects.toMatchObject({
      code: 'ASSET_BINARY_BUNDLE_INDEXEDDB_UNAVAILABLE'
    });

    const indexedDB = new IDBFactory();
    const originalPut = IDBObjectStore.prototype.put;
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function () {
      throw new DOMException('quota reached', 'QuotaExceededError');
    });
    try {
      const store = createBinaryBundleStore({indexedDB, databaseName: DATABASE_NAME});
      await expect(store.put(input)).rejects.toMatchObject({
        code: 'ASSET_BINARY_BUNDLE_QUOTA_EXCEEDED'
      });
    } finally {
      put.mockImplementation(originalPut).mockRestore();
    }
  });
});
