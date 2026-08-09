import {AssetManagerExtension, normalizeName} from './extension.js';
import {type AssetManagerFeatureFlags} from './feature-flags.js';
import {
  createBinaryBundleStore,
  type BinaryBundleKeyInput,
  type BinaryBundleOperationOptions,
  type BinaryBundlePutInput,
  type BinaryBundleRegistration,
  type BinaryBundleResult,
  type BinaryBundleStore,
  type BinaryBundleStoreOptions
} from './binary-bundle-store.js';
import {
  createVerifiedRemoteBinaryCache,
  type VerifiedRemoteBinaryCache,
  type VerifiedRemoteBinaryCacheOptions,
  type VerifiedRemoteBinaryInput,
  type VerifiedRemoteBinaryResolveOptions,
  type VerifiedRemoteBinaryResult,
  type VerifiedRemoteCacheWarning,
  type VerifiedRemoteCachePruneResult,
  type VerifiedRemoteCacheStats,
  type VerifiedRemoteStoryCacheDeleteResult,
  type VerifiedRemoteStoryCacheInfo,
  type VerifiedRemoteStoryCachePruneResult
} from './verified-remote-cache.js';

export {
  createBinaryBundleStore,
  type BinaryBundleFileInput,
  type BinaryBundleFileRegistration,
  type BinaryBundleFileResult,
  type BinaryBundleKeyInput,
  type BinaryBundleOperationOptions,
  type BinaryBundlePutInput,
  type BinaryBundleRegistration,
  type BinaryBundleResult,
  type BinaryBundleStore,
  type BinaryBundleStoreOptions
} from './binary-bundle-store.js';

export {
  createVerifiedRemoteBinaryCache,
  createVerifiedRemoteCacheDatabaseName,
  type NormalizedVerifiedRemoteBinaryInput,
  type VerifiedRemoteBinaryCache,
  type VerifiedRemoteBinaryCacheOptions,
  type VerifiedRemoteBinaryInput,
  type VerifiedRemoteBinaryLoadResult,
  type VerifiedRemoteBinaryResolveOptions,
  type VerifiedRemoteBinaryResult,
  type VerifiedRemoteCacheWarning,
  type VerifiedRemoteCacheIdentity,
  type VerifiedRemoteCacheIdentityInput,
  type VerifiedRemoteCachePruneResult,
  type VerifiedRemoteCacheStats,
  type VerifiedRemoteStoryCacheDeleteResult,
  type VerifiedRemoteStoryCacheInfo,
  type VerifiedRemoteStoryCachePruneResult
} from './verified-remote-cache.js';

export interface EmbeddedAssetBytesInput {
  name: unknown;
  nameMode?: AssetNameMode;
  bytes: ArrayBuffer | Uint8Array;
  mimeType: unknown;
  sourceName?: unknown;
  bitmapResolution?: 1 | 2;
}

export interface EmbeddedAssetRegistration {
  readonly name: string;
  readonly mimeType: string;
}

export type AssetNameMode = 'trimmed' | 'literal';

export type ProjectAssetLocator =
  | Readonly<{kind: 'backdrop'; name: string}>
  | Readonly<{kind: 'costume'; target: string; name: string}>
  | Readonly<{kind: 'sound'; name: string; target?: string}>;

export type ProjectAssetRegistrationInput =
  | Readonly<{
      name: unknown;
      nameMode?: AssetNameMode;
      resourceId: unknown;
      locator?: never;
    }>
  | Readonly<{
      name: unknown;
      nameMode?: AssetNameMode;
      locator: ProjectAssetLocator;
      resourceId?: never;
    }>;

export interface AssetManagerCompositionTarget {
  readonly id: string;
  readonly isStage: boolean;
}

export interface AssetManagerCompositionOptions {
  readonly verifiedRemoteCache?: VerifiedRemoteBinaryCacheOptions;
  readonly binaryBundleStore?: BinaryBundleStoreOptions;
}

export interface AssetManagerComposition {
  registerProjectAsset(input: ProjectAssetRegistrationInput): Promise<EmbeddedAssetRegistration>;
  registerEmbeddedAsset(input: EmbeddedAssetBytesInput): Promise<EmbeddedAssetRegistration>;
  releaseAsset(name: unknown): void;
  releaseAll(): void;
  isRegistered(name: unknown): boolean;
  getMimeType(name: unknown): string;
  applyToStage(name: unknown): Promise<void>;
  applyToTarget(name: unknown, target: AssetManagerCompositionTarget): Promise<void>;
  playSound(name: unknown, options?: Readonly<{untilDone?: boolean}>): Promise<void>;
  stopSound(name: unknown): void;
  stopAllSounds(): void;
  resolveVerifiedRemoteBinary(
    input: VerifiedRemoteBinaryInput,
    options: VerifiedRemoteBinaryResolveOptions
  ): Promise<VerifiedRemoteBinaryResult>;
  getVerifiedRemoteCacheStats(): Promise<VerifiedRemoteCacheStats>;
  pruneVerifiedRemoteCache(): Promise<VerifiedRemoteCachePruneResult>;
  clearVerifiedRemoteCache(): Promise<VerifiedRemoteCachePruneResult>;
  listVerifiedRemoteStoryCaches(): Promise<ReadonlyArray<VerifiedRemoteStoryCacheInfo>>;
  pruneVerifiedRemoteStoryCaches(): Promise<VerifiedRemoteStoryCachePruneResult>;
  deleteVerifiedRemoteStoryCache(
    databaseName: unknown
  ): Promise<VerifiedRemoteStoryCacheDeleteResult>;
  renewVerifiedRemoteStoryCacheLease(): Promise<void>;
  releaseVerifiedRemoteStoryCacheLease(): Promise<void>;
  putBinaryBundle(
    input: BinaryBundlePutInput,
    options?: BinaryBundleOperationOptions
  ): Promise<BinaryBundleRegistration>;
  getBinaryBundle(
    input: BinaryBundleKeyInput,
    options?: BinaryBundleOperationOptions
  ): Promise<BinaryBundleResult>;
  deleteBinaryBundle(
    input: BinaryBundleKeyInput,
    options?: BinaryBundleOperationOptions
  ): Promise<void>;
  releaseBinaryStore(): Promise<void>;
}

export function createAssetManagerComposition(
  featureFlags?: AssetManagerFeatureFlags,
  options: AssetManagerCompositionOptions = {}
): AssetManagerComposition {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Asset Manager composition options must be an object.');
  }
  const extension = featureFlags
    ? new AssetManagerExtension(featureFlags)
    : new AssetManagerExtension();
  const ownedNames = new Map<string, string>();
  let literalNameSequence = 0;
  let verifiedRemoteCache: VerifiedRemoteBinaryCache | null = null;
  let binaryBundleStore: BinaryBundleStore | null = null;

  function remoteCache(): VerifiedRemoteBinaryCache {
    verifiedRemoteCache ??= createVerifiedRemoteBinaryCache(options.verifiedRemoteCache);
    return verifiedRemoteCache;
  }

  function bundleStore(): BinaryBundleStore {
    binaryBundleStore ??= createBinaryBundleStore(options.binaryBundleStore);
    return binaryBundleStore;
  }

  function cancelledRegistration(name: string): Error {
    const error = new Error(`Asset registration was cancelled: ${JSON.stringify(name)}`);
    error.name = 'AbortError';
    return error;
  }

  function externalName(value: unknown, mode: AssetNameMode): string {
    if (mode === 'trimmed') return normalizeName(value);
    if (mode !== 'literal') throw new TypeError('Asset nameMode must be trimmed or literal.');
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError('A literal asset name must be a non-empty string.');
    }
    return value;
  }

  function claimName(value: unknown, mode: AssetNameMode) {
    const external = externalName(value, mode);
    const existing = ownedNames.get(external);
    if (existing !== undefined) {
      return {external, internal: existing, previouslyOwned: true};
    }
    const internal = mode === 'literal'
      ? `\u0000asset-manager-composition:${++literalNameSequence}`
      : external;
    ownedNames.set(external, internal);
    return {external, internal, previouslyOwned: false};
  }

  function ownedName(value: unknown): {external: string; internal: string} | null {
    if (typeof value === 'string') {
      const exact = ownedNames.get(value);
      if (exact !== undefined) return {external: value, internal: exact};
    }
    const normalized = normalizeName(value);
    const legacy = ownedNames.get(normalized);
    return legacy === undefined ? null : {external: normalized, internal: legacy};
  }

  async function trackRegistration(
    claimed: ReturnType<typeof claimName>,
    operation: Promise<unknown>
  ): Promise<EmbeddedAssetRegistration> {
    try {
      await operation;
      if (
        ownedNames.get(claimed.external) !== claimed.internal ||
        !extension.isLoaded({NAME: claimed.internal})
      ) {
        throw cancelledRegistration(claimed.external);
      }
      return registration(claimed.external, claimed.internal);
    } catch (error) {
      if (!claimed.previouslyOwned && !extension.isLoaded({NAME: claimed.internal})) {
        ownedNames.delete(claimed.external);
      }
      throw error;
    }
  }

  function registration(external: string, internal: string): EmbeddedAssetRegistration {
    return Object.freeze({
      name: external,
      mimeType: extension.getAssetMimeType({NAME: internal})
    });
  }

  function releaseAsset(name: unknown): void {
    const owned = ownedName(name);
    if (!owned) return;
    ownedNames.delete(owned.external);
    let stopError: unknown;
    if (extension.getAssetMimeType({NAME: owned.internal}).startsWith('audio/')) {
      try {
        extension.stopSound({NAME: owned.internal});
      } catch (error) {
        stopError = error;
      }
    }
    extension.deleteMemoryAsset({NAME: owned.internal});
    if (stopError) throw stopError;
  }

  const composition: AssetManagerComposition = {
    async registerProjectAsset(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('Project asset registration input must be an object.');
      }
      const hasLocator = Object.hasOwn(input, 'locator');
      if (hasLocator === Object.hasOwn(input, 'resourceId')) {
        throw new TypeError('Provide exactly one project asset locator or resourceId.');
      }
      const claimed = claimName(input.name, input.nameMode ?? (hasLocator ? 'literal' : 'trimmed'));
      const operation = hasLocator
        ? extension.registerProjectAssetLiteral(claimed.internal, input.locator)
        : extension.registerAsset({NAME: claimed.internal, RESOURCE_ID: input.resourceId});
      return trackRegistration(claimed, operation);
    },
    async registerEmbeddedAsset(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('Embedded asset registration input must be an object.');
      }
      const claimed = claimName(input.name, input.nameMode ?? 'trimmed');
      return trackRegistration(
        claimed,
        extension.registerEmbeddedAsset({
          name: claimed.internal,
          bytes: input.bytes,
          mimeType: input.mimeType,
          ...(input.sourceName === undefined ? {} : {sourceName: input.sourceName}),
          ...(input.bitmapResolution === undefined
            ? {}
            : {bitmapResolution: input.bitmapResolution})
        })
      );
    },
    releaseAsset,
    releaseAll() {
      const errors: unknown[] = [];
      for (const name of [...ownedNames.keys()].reverse()) {
        try {
          releaseAsset(name);
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 0) throw new AggregateError(errors, 'Failed to release assets');
    },
    isRegistered(name) {
      const owned = ownedName(name);
      return owned !== null && extension.isLoaded({NAME: owned.internal});
    },
    getMimeType(name) {
      const owned = ownedName(name);
      return owned ? extension.getAssetMimeType({NAME: owned.internal}) : '';
    },
    applyToStage(name) {
      return extension.setStageSkin({NAME: ownedName(name)?.internal ?? name});
    },
    applyToTarget(name, target) {
      return extension.setThisSpriteSkin(
        {NAME: ownedName(name)?.internal ?? name},
        {target: target as TurboWarpTarget, runtime: Scratch.vm.runtime}
      );
    },
    playSound(name, options = {}) {
      return options.untilDone
        ? extension.playSoundUntilDone({NAME: ownedName(name)?.internal ?? name})
        : extension.playSound({NAME: ownedName(name)?.internal ?? name});
    },
    stopSound(name) {
      extension.stopSound({NAME: ownedName(name)?.internal ?? name});
    },
    stopAllSounds() {
      extension.stopAllSounds();
    },
    resolveVerifiedRemoteBinary(input, resolveOptions) {
      return remoteCache().resolve(input, resolveOptions);
    },
    getVerifiedRemoteCacheStats() {
      return remoteCache().getStats();
    },
    pruneVerifiedRemoteCache() {
      return remoteCache().prune();
    },
    clearVerifiedRemoteCache() {
      return remoteCache().clear();
    },
    listVerifiedRemoteStoryCaches() {
      return remoteCache().listStoryCaches();
    },
    pruneVerifiedRemoteStoryCaches() {
      return remoteCache().pruneStoryCaches();
    },
    deleteVerifiedRemoteStoryCache(databaseName) {
      return remoteCache().deleteStoryCache(databaseName);
    },
    renewVerifiedRemoteStoryCacheLease() {
      return remoteCache().renewStoryCacheLease();
    },
    releaseVerifiedRemoteStoryCacheLease() {
      return remoteCache().releaseStoryCacheLease();
    },
    putBinaryBundle(input, operationOptions) {
      return bundleStore().put(input, operationOptions);
    },
    getBinaryBundle(input, operationOptions) {
      return bundleStore().get(input, operationOptions);
    },
    deleteBinaryBundle(input, operationOptions) {
      return bundleStore().delete(input, operationOptions);
    },
    releaseBinaryStore() {
      return bundleStore().release();
    }
  };
  return Object.freeze(composition);
}
