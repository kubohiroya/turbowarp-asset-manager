import {IDBFactory, IDBObjectStore} from 'fake-indexeddb';
import {describe, expect, it, vi} from 'vitest';

import {
  createVerifiedRemoteBinaryCache,
  type VerifiedRemoteBinaryInput
} from '../src/verified-remote-cache.js';

const DATABASE_NAME = 'tw-asset-manager-verified-binary-v1';
const CONTENT_TYPE = 'application/octet-stream';

async function sha256Integrity(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(
    await globalThis.crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)
  );
  return `sha256-${[...digest]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

async function inputFor(bytes: Uint8Array, suffix = 'model.bin'): Promise<VerifiedRemoteBinaryInput> {
  return {
    url: `https://example.com/${suffix}`,
    integrity: await sha256Integrity(bytes),
    size: bytes.byteLength,
    contentType: CONTENT_TYPE
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

async function openDatabase(indexedDB: IDBFactory, name: string): Promise<IDBDatabase> {
  return requestResult(indexedDB.open(name));
}

async function tamperCachedBytes(
  indexedDB: IDBFactory,
  integrity: string,
  bytes: Uint8Array
): Promise<void> {
  const database = await openDatabase(indexedDB, DATABASE_NAME);
  try {
    const transaction = database.transaction('entries', 'readwrite');
    transaction.objectStore('entries').put({
      key: `1:${integrity}`,
      data: Uint8Array.from(bytes).buffer
    });
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

async function getCacheMetadata(
  indexedDB: IDBFactory,
  integrity: string
): Promise<Record<string, unknown> | undefined> {
  const database = await openDatabase(indexedDB, DATABASE_NAME);
  try {
    const transaction = database.transaction('metadata', 'readonly');
    const result = await requestResult(
      transaction.objectStore('metadata').get(`1:${integrity}`)
    );
    await transactionComplete(transaction);
    return result as Record<string, unknown> | undefined;
  } finally {
    database.close();
  }
}

async function putUnknownFormatRecord(indexedDB: IDBFactory): Promise<void> {
  const database = await openDatabase(indexedDB, DATABASE_NAME);
  try {
    const transaction = database.transaction(['entries', 'metadata'], 'readwrite');
    transaction.objectStore('entries').put({
      key: '0:legacy',
      data: new Uint8Array([1, 2]).buffer
    });
    transaction.objectStore('metadata').put({
      formatVersion: 0,
      key: '0:legacy',
      size: 2,
      lastAccessedAt: 0
    });
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

async function putOrphanRecords(indexedDB: IDBFactory): Promise<void> {
  const database = await openDatabase(indexedDB, DATABASE_NAME);
  try {
    const transaction = database.transaction(['entries', 'metadata'], 'readwrite');
    transaction.objectStore('entries').put({
      key: '1:orphan-entry',
      data: new Uint8Array([9, 9]).buffer
    });
    const integrity = `sha256-${'0'.repeat(64)}`;
    transaction.objectStore('metadata').put({
      formatVersion: 1,
      key: `1:${integrity}`,
      integrity,
      size: 2,
      contentType: CONTENT_TYPE,
      createdAt: 1,
      lastAccessedAt: 1,
      lastValidatedAt: 1,
      writeToken: 'orphan-metadata'
    });
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

async function cacheStoreCounts(
  indexedDB: IDBFactory
): Promise<Readonly<{entries: number; metadata: number}>> {
  const database = await openDatabase(indexedDB, DATABASE_NAME);
  try {
    const transaction = database.transaction(['entries', 'metadata'], 'readonly');
    const entries = requestResult(transaction.objectStore('entries').count());
    const metadata = requestResult(transaction.objectStore('metadata').count());
    const result = {entries: await entries, metadata: await metadata};
    await transactionComplete(transaction);
    return result;
  } finally {
    database.close();
  }
}

async function putLegacyRecord(indexedDB: IDBFactory): Promise<void> {
  const request = indexedDB.open('tw-asset-manager', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('assets', {keyPath: 'name'});
  const database = await requestResult(request);
  try {
    const transaction = database.transaction('assets', 'readwrite');
    transaction.objectStore('assets').put({name: 'legacy', data: new Uint8Array([9]).buffer});
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

async function getLegacyRecord(indexedDB: IDBFactory): Promise<unknown> {
  const database = await openDatabase(indexedDB, 'tw-asset-manager');
  try {
    const transaction = database.transaction('assets', 'readonly');
    const result = await requestResult(transaction.objectStore('assets').get('legacy'));
    await transactionComplete(transaction);
    return result;
  } finally {
    database.close();
  }
}

describe('verified remote binary cache', () => {
  it('stores verified network bytes by integrity and returns defensive cache copies', async () => {
    const indexedDB = new IDBFactory();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const input = await inputFor(bytes);
    const load = vi.fn(async () => ({bytes, contentType: `${CONTENT_TYPE}; charset=binary`}));
    const cache = createVerifiedRemoteBinaryCache({
      indexedDB,
      estimateStorage: async () => ({quota: 1_000_000})
    });

    const first = await cache.resolve(input, {load});
    expect(first).toMatchObject({
      source: 'network',
      cacheRead: 'miss',
      cacheWrite: 'stored'
    });
    first.bytes.fill(0);

    const second = await cache.resolve(input, {load});
    expect(second).toMatchObject({
      source: 'indexeddb',
      cacheRead: 'hit',
      cacheWrite: 'not-needed'
    });
    expect([...second.bytes]).toEqual([1, 2, 3, 4]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('deletes a corrupt cache hit and replaces it with verified network bytes', async () => {
    const indexedDB = new IDBFactory();
    const bytes = new Uint8Array([10, 20, 30]);
    const input = await inputFor(bytes);
    const load = vi.fn(async () => ({bytes, contentType: CONTENT_TYPE}));
    const cache = createVerifiedRemoteBinaryCache({indexedDB});

    await cache.resolve(input, {load});
    await tamperCachedBytes(indexedDB, String(input.integrity), new Uint8Array([30, 20, 10]));

    const repaired = await cache.resolve(input, {load});
    expect(repaired).toMatchObject({
      source: 'network',
      cacheRead: 'invalid',
      cacheWrite: 'stored'
    });
    expect([...repaired.bytes]).toEqual([...bytes]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('continues with verified network bytes when IndexedDB is unavailable', async () => {
    const bytes = new Uint8Array([4, 5, 6]);
    const input = await inputFor(bytes);
    const unavailable = {
      open() {
        throw new Error('storage unavailable');
      }
    } as unknown as IDBFactory;
    const cache = createVerifiedRemoteBinaryCache({indexedDB: unavailable});

    await expect(
      cache.resolve(input, {
        load: async () => ({bytes, contentType: CONTENT_TYPE})
      })
    ).resolves.toMatchObject({
      source: 'network',
      cacheRead: 'failed',
      cacheWrite: 'failed'
    });
  });

  it('uses the network in memory-only mode when IndexedDB does not exist', async () => {
    const bytes = new Uint8Array([4, 4, 2]);
    const input = await inputFor(bytes);
    vi.stubGlobal('indexedDB', undefined);
    try {
      const cache = createVerifiedRemoteBinaryCache();
      await expect(
        cache.resolve(input, {
          load: async () => ({bytes, contentType: CONTENT_TYPE})
        })
      ).resolves.toMatchObject({
        source: 'network',
        cacheRead: 'failed',
        cacheWrite: 'failed'
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('cleans up and retries one time after a quota error', async () => {
    const indexedDB = new IDBFactory();
    const bytes = new Uint8Array([8, 6, 7, 5]);
    const input = await inputFor(bytes);
    const originalPut = IDBObjectStore.prototype.put;
    const put = vi
      .spyOn(IDBObjectStore.prototype, 'put')
      .mockImplementationOnce(function (...args: Parameters<IDBObjectStore['put']>) {
        throw new DOMException('quota reached', 'QuotaExceededError');
      })
      .mockImplementation(function (
        this: IDBObjectStore,
        ...args: Parameters<IDBObjectStore['put']>
      ) {
        return Reflect.apply(originalPut, this, args) as IDBRequest<IDBValidKey>;
      });
    try {
      const cache = createVerifiedRemoteBinaryCache({indexedDB});
      await expect(
        cache.resolve(input, {
          load: async () => ({bytes, contentType: CONTENT_TYPE})
        })
      ).resolves.toMatchObject({cacheWrite: 'stored'});
      expect(put).toHaveBeenCalled();
      await expect(cache.getStats()).resolves.toMatchObject({entries: 1, bytes: 4});
    } finally {
      put.mockRestore();
    }
  });

  it('returns verified bytes without retrying indefinitely when quota writes keep failing', async () => {
    const indexedDB = new IDBFactory();
    const bytes = new Uint8Array([2, 4, 6, 8]);
    const input = await inputFor(bytes);
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('quota reached', 'QuotaExceededError');
    });
    try {
      const cache = createVerifiedRemoteBinaryCache({indexedDB});
      const result = await cache.resolve(input, {
        load: async () => ({bytes, contentType: CONTENT_TYPE})
      });
      expect(result).toMatchObject({source: 'network', cacheWrite: 'failed'});
      expect([...result.bytes]).toEqual([...bytes]);
      expect(put).toHaveBeenCalledTimes(2);
    } finally {
      put.mockRestore();
    }
  });

  it('evicts least-recently-used entries to the low-water mark and expires TTL entries', async () => {
    const indexedDB = new IDBFactory();
    let currentTime = 100;
    const networkLoads = new Map<string, number>();
    const cache = createVerifiedRemoteBinaryCache({
      indexedDB,
      now: () => currentTime,
      maxCacheBytes: 6,
      quotaFraction: 1,
      lowWaterRatio: 0.5,
      ttlMs: 100,
      touchIntervalMs: 1,
      estimateStorage: async () => ({quota: 1_000})
    });
    const values = [
      new Uint8Array([1, 1, 1]),
      new Uint8Array([2, 2, 2]),
      new Uint8Array([3, 3, 3])
    ];
    const inputs = await Promise.all(values.map((bytes, index) => inputFor(bytes, `${index}.bin`)));
    const resolveAt = async (index: number) => {
      const input = inputs[index]!;
      return cache.resolve(input, {
        load: async () => {
          networkLoads.set(String(input.integrity), (networkLoads.get(String(input.integrity)) ?? 0) + 1);
          return {bytes: values[index]!, contentType: CONTENT_TYPE};
        }
      });
    };

    await resolveAt(0);
    currentTime += 1;
    await resolveAt(1);
    currentTime += 1;
    await resolveAt(2);
    await expect(cache.getStats()).resolves.toMatchObject({entries: 2, bytes: 6});

    currentTime += 1;
    await expect(resolveAt(0)).resolves.toMatchObject({source: 'network'});
    expect(networkLoads.get(String(inputs[0]!.integrity))).toBe(2);

    currentTime += 101;
    const pruned = await cache.prune();
    expect(pruned).toMatchObject({remainingEntries: 0, remainingBytes: 0});
  });

  it('does not retain bytes when resolution is cancelled', async () => {
    const indexedDB = new IDBFactory();
    const bytes = new Uint8Array([7, 8, 9]);
    const input = await inputFor(bytes);
    const controller = new AbortController();
    let releaseLoad!: () => void;
    const loadStarted = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    let finishLoad!: () => void;
    const waitForLoad = new Promise<void>((resolve) => {
      finishLoad = resolve;
    });
    const cache = createVerifiedRemoteBinaryCache({indexedDB});
    const resolution = cache.resolve(input, {
      signal: controller.signal,
      load: async () => {
        releaseLoad();
        await waitForLoad;
        return {bytes, contentType: CONTENT_TYPE};
      }
    });
    await loadStarted;
    controller.abort();
    finishLoad();

    await expect(resolution).rejects.toMatchObject({name: 'AbortError'});
    await expect(cache.getStats()).resolves.toMatchObject({entries: 0, bytes: 0});
  });

  it('throttles access timestamp writes and removes unknown-format records', async () => {
    const indexedDB = new IDBFactory();
    let currentTime = 1_000;
    const bytes = new Uint8Array([3, 1, 4]);
    const input = await inputFor(bytes);
    const integrity = String(input.integrity);
    const cache = createVerifiedRemoteBinaryCache({
      indexedDB,
      now: () => currentTime,
      ttlMs: 1_000,
      touchIntervalMs: 10
    });
    const load = vi.fn(async () => ({bytes, contentType: CONTENT_TYPE}));
    await cache.resolve(input, {load});

    currentTime = 1_005;
    await cache.resolve(input, {load});
    expect((await getCacheMetadata(indexedDB, integrity))?.lastAccessedAt).toBe(1_000);

    currentTime = 1_011;
    await cache.resolve(input, {load});
    expect((await getCacheMetadata(indexedDB, integrity))?.lastAccessedAt).toBe(1_011);

    await putUnknownFormatRecord(indexedDB);
    await expect(cache.prune()).resolves.toMatchObject({removedEntries: 1});
    await expect(cache.getStats()).resolves.toMatchObject({entries: 1, bytes: 3});
  });

  it('removes binary and metadata orphans during pruning', async () => {
    const indexedDB = new IDBFactory();
    const bytes = new Uint8Array([5, 8, 13]);
    const input = await inputFor(bytes);
    const cache = createVerifiedRemoteBinaryCache({indexedDB});
    await cache.resolve(input, {
      load: async () => ({bytes, contentType: CONTENT_TYPE})
    });
    await putOrphanRecords(indexedDB);
    await expect(cacheStoreCounts(indexedDB)).resolves.toEqual({entries: 2, metadata: 2});

    await expect(cache.prune()).resolves.toMatchObject({removedEntries: 2});
    await expect(cacheStoreCounts(indexedDB)).resolves.toEqual({entries: 1, metadata: 1});
  });

  it('converges concurrent same-integrity writes on one content-addressed record', async () => {
    const indexedDB = new IDBFactory();
    const bytes = new Uint8Array([1, 2, 1, 2]);
    const input = await inputFor(bytes);
    const cache = createVerifiedRemoteBinaryCache({indexedDB});

    await Promise.all(
      Array.from({length: 8}, () =>
        cache.resolve(input, {
          load: async () => ({bytes, contentType: CONTENT_TYPE})
        })
      )
    );
    await expect(cache.getStats()).resolves.toMatchObject({entries: 1, bytes: 4});
  });

  it('clears only the verified remote cache and leaves the legacy asset database intact', async () => {
    const indexedDB = new IDBFactory();
    await putLegacyRecord(indexedDB);
    const bytes = new Uint8Array([1, 3, 5]);
    const input = await inputFor(bytes);
    const cache = createVerifiedRemoteBinaryCache({indexedDB});
    await cache.resolve(input, {
      load: async () => ({bytes, contentType: CONTENT_TYPE})
    });

    await expect(cache.clear()).resolves.toMatchObject({
      removedEntries: 1,
      removedBytes: 3,
      remainingEntries: 0,
      remainingBytes: 0
    });
    await expect(getLegacyRecord(indexedDB)).resolves.toMatchObject({name: 'legacy'});
  });

  it('rejects unverified network bytes without caching them', async () => {
    const indexedDB = new IDBFactory();
    const expected = new Uint8Array([1, 2, 3]);
    const input = await inputFor(expected);
    const cache = createVerifiedRemoteBinaryCache({indexedDB});

    await expect(
      cache.resolve(input, {
        load: async () => ({bytes: new Uint8Array([3, 2, 1]), contentType: CONTENT_TYPE})
      })
    ).rejects.toMatchObject({code: 'ASSET_CACHE_INTEGRITY_MISMATCH'});
    await expect(cache.getStats()).resolves.toMatchObject({entries: 0, bytes: 0});
  });
});
