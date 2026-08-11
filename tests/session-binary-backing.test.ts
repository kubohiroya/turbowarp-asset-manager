import {IDBFactory, IDBObjectStore} from 'fake-indexeddb';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {
  createSessionBinaryBacking,
  type SessionBinaryBackingAssetInput,
  type SessionBinaryBackingSource,
  type SessionBinaryBackingSourceAsset
} from '../src/session-binary-backing.js';

const DATABASE_NAME = 'test-session-binary-v1';
const SESSION_STORE = 'sessions';
const BUNDLE_STORE = 'sessionBinaryBundles';

async function sha256Integrity(bytes: Uint8Array): Promise<string> {
  const owned = Uint8Array.from(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', owned.buffer));
  return `sha256-${[...digest]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

async function fixtureAsset(
  name: string,
  files: ReadonlyArray<Readonly<{path: string; values: number[]}>>
): Promise<{
  descriptor: SessionBinaryBackingAssetInput;
  sourceAsset: SessionBinaryBackingSourceAsset;
}> {
  const sourceFiles = await Promise.all(
    files.map(async ({path, values}) => {
      const bytes = Uint8Array.from(values);
      return {
        path,
        size: bytes.byteLength,
        integrity: await sha256Integrity(bytes),
        bytes
      };
    })
  );
  const integrity = await sha256Integrity(
    new TextEncoder().encode(sourceFiles.map(({path, integrity}) => `${path}:${integrity}`).join('|'))
  );
  return {
    descriptor: {
      namespace: 'story/source-integrity',
      name,
      integrity,
      files: sourceFiles.map(({path, size, integrity}) => ({path, size, integrity}))
    },
    sourceAsset: {
      namespace: 'story/source-integrity',
      name,
      integrity,
      files: sourceFiles
    }
  };
}

function sourceFor(
  assets: ReadonlyArray<Awaited<ReturnType<typeof fixtureAsset>>>,
  overrides: Partial<SessionBinaryBackingSource> = {}
): SessionBinaryBackingSource & {read: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn>} {
  const byName = new Map(assets.map(({sourceAsset}) => [sourceAsset.name, sourceAsset]));
  const read = vi.fn(async (asset: SessionBinaryBackingAssetInput) => {
    const sourceAsset = byName.get(String(asset.name));
    if (!sourceAsset) throw new Error('missing fixture');
    return {
      ...sourceAsset,
      files: sourceAsset.files.map((file) => ({...file, bytes: new Uint8Array(file.bytes)}))
    };
  });
  const release = vi.fn(async () => {});
  return {
    read,
    release,
    ...overrides
  } as SessionBinaryBackingSource & {
    read: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
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

async function storeCounts(indexedDB: IDBFactory): Promise<{sessions: number; bundles: number}> {
  const database = await openDatabase(indexedDB);
  try {
    const transaction = database.transaction([SESSION_STORE, BUNDLE_STORE], 'readonly');
    const sessions = requestResult(transaction.objectStore(SESSION_STORE).count());
    const bundles = requestResult(transaction.objectStore(BUNDLE_STORE).count());
    const result = {sessions: await sessions, bundles: await bundles};
    await transactionComplete(transaction);
    return result;
  } finally {
    database.close();
  }
}

async function storedSessionIds(indexedDB: IDBFactory): Promise<string[]> {
  const database = await openDatabase(indexedDB);
  try {
    const transaction = database.transaction(SESSION_STORE, 'readonly');
    const ids = await requestResult(transaction.objectStore(SESSION_STORE).getAllKeys());
    await transactionComplete(transaction);
    return ids.map(String).sort();
  } finally {
    database.close();
  }
}

async function deleteStoredAsset(
  indexedDB: IDBFactory,
  sessionId: string,
  asset: SessionBinaryBackingAssetInput
): Promise<void> {
  const database = await openDatabase(indexedDB);
  try {
    const transaction = database.transaction(BUNDLE_STORE, 'readwrite');
    transaction
      .objectStore(BUNDLE_STORE)
      .delete([sessionId, String(asset.namespace), String(asset.name)]);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('session binary backing', () => {
  it('keeps disabled policy direct and never opens IndexedDB', async () => {
    const asset = await fixtureAsset('Pose', [{path: 'weights.bin', values: [1, 2, 3]}]);
    const source = sourceFor([asset]);
    const open = vi.fn(() => {
      throw new Error('IndexedDB must remain disabled');
    });
    const backing = await createSessionBinaryBacking(
      {
        policy: 'disabled',
        sessionId: 'direct-session',
        assets: [asset.descriptor],
        source
      },
      {indexedDB: {open} as unknown as IDBFactory}
    );

    expect(backing.mode).toBe('direct');
    expect(backing.warning).toBeUndefined();
    expect(open).not.toHaveBeenCalled();
    await expect(backing.get(asset.descriptor)).resolves.toMatchObject({name: 'Pose'});
    expect(source.read).toHaveBeenCalledTimes(1);
    expect(source.release).not.toHaveBeenCalled();

    await backing.dispose();
    expect(source.release).toHaveBeenCalledTimes(1);
  });

  it('ingests one asset at a time, verifies read-back, then releases its source', async () => {
    const indexedDB = new IDBFactory();
    const first = await fixtureAsset('First', [{path: 'first.bin', values: [1, 2]}]);
    const pose = await fixtureAsset('Pose', [
      {path: 'model.json', values: [3]},
      {path: 'metadata.json', values: [4]},
      {path: 'weights.bin', values: [5, 6]}
    ]);
    let concurrentReads = 0;
    let maximumConcurrentReads = 0;
    const baseSource = sourceFor([first, pose]);
    const originalRead = baseSource.read;
    baseSource.read = vi.fn(async (asset, options) => {
      concurrentReads += 1;
      maximumConcurrentReads = Math.max(maximumConcurrentReads, concurrentReads);
      try {
        return await originalRead(asset, options);
      } finally {
        concurrentReads -= 1;
      }
    });
    baseSource.release = vi.fn(async () => {
      await expect(storeCounts(indexedDB)).resolves.toEqual({sessions: 1, bundles: 2});
    });

    const backing = await createSessionBinaryBacking(
      {
        policy: 'required',
        sessionId: 'stored-session',
        assets: [pose.descriptor, first.descriptor],
        source: baseSource
      },
      {indexedDB, databaseName: DATABASE_NAME, heartbeatIntervalMs: 10_000}
    );

    expect(backing.mode).toBe('session');
    expect(maximumConcurrentReads).toBe(1);
    expect(baseSource.read.mock.calls.map(([asset]) => asset.name)).toEqual(['First', 'Pose']);
    expect(baseSource.release).toHaveBeenCalledTimes(1);
    await expect(backing.get(pose.descriptor)).resolves.toMatchObject({
      name: 'Pose',
      totalBytes: 4
    });
    expect(baseSource.read).toHaveBeenCalledTimes(2);

    await backing.dispose();
    await expect(storeCounts(indexedDB)).resolves.toEqual({sessions: 0, bundles: 0});
  });

  it('cleans a partial session before prefer falls back on quota failure', async () => {
    const indexedDB = new IDBFactory();
    const asset = await fixtureAsset('Pose', [{path: 'weights.bin', values: [1, 2, 3]}]);
    const source = sourceFor([asset]);
    const originalPut = IDBObjectStore.prototype.put;
    let rejected = false;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value,
      key
    ) {
      if (!rejected && this.name === BUNDLE_STORE) {
        rejected = true;
        throw new DOMException('quota reached', 'QuotaExceededError');
      }
      return key === undefined
        ? originalPut.call(this, value)
        : originalPut.call(this, value, key);
    });

    const backing = await createSessionBinaryBacking(
      {
        policy: 'prefer',
        sessionId: 'fallback-session',
        assets: [asset.descriptor],
        source
      },
      {indexedDB, databaseName: DATABASE_NAME}
    );

    expect(backing.mode).toBe('direct');
    expect(backing.warning).toEqual({
      code: 'ASSET_SESSION_BINARY_DIRECT_FALLBACK',
      causeCode: 'ASSET_SESSION_BINARY_QUOTA_EXCEEDED'
    });
    await expect(storeCounts(indexedDB)).resolves.toEqual({sessions: 0, bundles: 0});
    await expect(backing.get(asset.descriptor)).resolves.toMatchObject({name: 'Pose'});
    expect(source.read).toHaveBeenCalledTimes(2);

    await backing.dispose();
    expect(source.release).toHaveBeenCalledTimes(1);
  });

  it('fails required policy and releases the source when IndexedDB is unavailable', async () => {
    const asset = await fixtureAsset('Pose', [{path: 'weights.bin', values: [1]}]);
    const source = sourceFor([asset]);
    const open = vi.fn(() => {
      throw new Error('private mode');
    });

    await expect(
      createSessionBinaryBacking(
        {
          policy: 'required',
          sessionId: 'required-session',
          assets: [asset.descriptor],
          source
        },
        {indexedDB: {open} as unknown as IDBFactory}
      )
    ).rejects.toMatchObject({code: 'ASSET_SESSION_BINARY_INDEXEDDB_UNAVAILABLE'});
    expect(source.read).not.toHaveBeenCalled();
    expect(source.release).toHaveBeenCalledTimes(1);
  });

  it('never falls back from a source integrity failure', async () => {
    const indexedDB = new IDBFactory();
    const asset = await fixtureAsset('Pose', [{path: 'weights.bin', values: [1, 2, 3]}]);
    const source = sourceFor([asset]);
    source.read = vi.fn(async () => ({
      ...asset.sourceAsset,
      files: [{...asset.sourceAsset.files[0]!, bytes: Uint8Array.from([9, 9, 9])}]
    }));

    await expect(
      createSessionBinaryBacking(
        {
          policy: 'prefer',
          sessionId: 'corrupt-source-session',
          assets: [asset.descriptor],
          source
        },
        {indexedDB, databaseName: DATABASE_NAME}
      )
    ).rejects.toMatchObject({
      code: 'ASSET_SESSION_BINARY_SOURCE_INTEGRITY_MISMATCH'
    });
    expect(source.release).toHaveBeenCalledTimes(1);
    await expect(storeCounts(indexedDB)).resolves.toEqual({sessions: 0, bundles: 0});
  });

  it('makes an established missing record fatal without rereading the source', async () => {
    const indexedDB = new IDBFactory();
    const asset = await fixtureAsset('Pose', [{path: 'weights.bin', values: [1, 2, 3]}]);
    const source = sourceFor([asset]);
    const onFatalError = vi.fn();
    const backing = await createSessionBinaryBacking(
      {
        policy: 'prefer',
        sessionId: 'fatal-read-session',
        assets: [asset.descriptor],
        source,
        onFatalError
      },
      {indexedDB, databaseName: DATABASE_NAME}
    );
    await deleteStoredAsset(indexedDB, backing.sessionId, asset.descriptor);

    await expect(backing.get(asset.descriptor)).rejects.toMatchObject({
      code: 'ASSET_SESSION_BINARY_NOT_FOUND'
    });
    await expect(backing.get(asset.descriptor)).rejects.toMatchObject({
      code: 'ASSET_SESSION_BINARY_NOT_FOUND'
    });
    expect(backing.mode).toBe('session');
    expect(source.read).toHaveBeenCalledTimes(1);
    expect(onFatalError).toHaveBeenCalledTimes(1);

    await backing.dispose();
  });

  it('treats an IndexedDB version change as a fatal established-session failure', async () => {
    const indexedDB = new IDBFactory();
    const asset = await fixtureAsset('Pose', [{path: 'weights.bin', values: [1, 2, 3]}]);
    const source = sourceFor([asset]);
    const onFatalError = vi.fn();
    const backing = await createSessionBinaryBacking(
      {
        policy: 'required',
        sessionId: 'version-change-session',
        assets: [asset.descriptor],
        source,
        onFatalError
      },
      {indexedDB, databaseName: DATABASE_NAME}
    );

    const upgraded = await requestResult(indexedDB.open(DATABASE_NAME, 2));
    upgraded.close();

    await expect(backing.get(asset.descriptor)).rejects.toMatchObject({
      code: 'ASSET_SESSION_BINARY_CONNECTION_CLOSED'
    });
    expect(source.read).toHaveBeenCalledTimes(1);
    expect(onFatalError).toHaveBeenCalledTimes(1);
    await expect(backing.dispose()).rejects.toMatchObject({
      code: 'ASSET_SESSION_BINARY_CLEANUP_FAILED'
    });
  });

  it('disposes only its own session and preserves an active sibling tab', async () => {
    const indexedDB = new IDBFactory();
    const asset = await fixtureAsset('Pose', [{path: 'weights.bin', values: [1]}]);
    const first = await createSessionBinaryBacking(
      {
        policy: 'required',
        sessionId: 'first-tab',
        assets: [asset.descriptor],
        source: sourceFor([asset])
      },
      {indexedDB, databaseName: DATABASE_NAME, heartbeatIntervalMs: 10_000}
    );
    const second = await createSessionBinaryBacking(
      {
        policy: 'required',
        sessionId: 'second-tab',
        assets: [asset.descriptor],
        source: sourceFor([asset])
      },
      {indexedDB, databaseName: DATABASE_NAME, heartbeatIntervalMs: 10_000}
    );

    await first.dispose();
    await expect(storedSessionIds(indexedDB)).resolves.toEqual(['second-tab']);
    await expect(second.get(asset.descriptor)).resolves.toMatchObject({name: 'Pose'});
    await second.dispose();
  });

  it('bounds orphan cleanup and skips an unexpired sibling lease', async () => {
    const indexedDB = new IDBFactory();
    const asset = await fixtureAsset('Pose', [{path: 'weights.bin', values: [1]}]);
    let time = 100;
    const options = {
      indexedDB,
      databaseName: DATABASE_NAME,
      now: () => time,
      leaseTtlMs: 20_000,
      heartbeatIntervalMs: 10_000,
      orphanCleanupBatchSize: 1
    };
    const expired = await createSessionBinaryBacking(
      {
        policy: 'required',
        sessionId: 'expired-tab',
        assets: [asset.descriptor],
        source: sourceFor([asset])
      },
      options
    );
    time = 10_000;
    const active = await createSessionBinaryBacking(
      {
        policy: 'required',
        sessionId: 'active-tab',
        assets: [asset.descriptor],
        source: sourceFor([asset])
      },
      options
    );
    time = 20_101;
    const newcomer = await createSessionBinaryBacking(
      {
        policy: 'required',
        sessionId: 'new-tab',
        assets: [asset.descriptor],
        source: sourceFor([asset])
      },
      options
    );

    await expect(storedSessionIds(indexedDB)).resolves.toEqual(['active-tab', 'new-tab']);
    await expect(active.get(asset.descriptor)).resolves.toMatchObject({name: 'Pose'});

    await Promise.all([expired.dispose(), active.dispose(), newcomer.dispose()]);
  });
});
