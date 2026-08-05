import {AssetManagerExtension, normalizeName} from './extension.js';
import {type AssetManagerFeatureFlags} from './feature-flags.js';
import {
  createVerifiedRemoteBinaryCache,
  type VerifiedRemoteBinaryCache,
  type VerifiedRemoteBinaryCacheOptions,
  type VerifiedRemoteBinaryInput,
  type VerifiedRemoteBinaryResolveOptions,
  type VerifiedRemoteBinaryResult,
  type VerifiedRemoteCacheWarning,
  type VerifiedRemoteCachePruneResult,
  type VerifiedRemoteCacheStats
} from './verified-remote-cache.js';

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
  type VerifiedRemoteCacheStats
} from './verified-remote-cache.js';

export interface EmbeddedAssetBytesInput {
  name: unknown;
  bytes: ArrayBuffer | Uint8Array;
  mimeType: unknown;
  sourceName?: unknown;
}

export interface EmbeddedAssetRegistration {
  readonly name: string;
  readonly mimeType: string;
}

export interface ProjectAssetRegistrationInput {
  name: unknown;
  resourceId: unknown;
}

export interface AssetManagerCompositionTarget {
  readonly id: string;
  readonly isStage: boolean;
}

export interface AssetManagerCompositionOptions {
  readonly verifiedRemoteCache?: VerifiedRemoteBinaryCacheOptions;
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
  const ownedNames = new Set<string>();
  let verifiedRemoteCache: VerifiedRemoteBinaryCache | null = null;

  function remoteCache(): VerifiedRemoteBinaryCache {
    verifiedRemoteCache ??= createVerifiedRemoteBinaryCache(options.verifiedRemoteCache);
    return verifiedRemoteCache;
  }

  function cancelledRegistration(name: string): Error {
    const error = new Error(`Asset registration was cancelled: ${name}`);
    error.name = 'AbortError';
    return error;
  }

  async function trackRegistration(
    name: unknown,
    operation: Promise<EmbeddedAssetRegistration>
  ): Promise<EmbeddedAssetRegistration> {
    const normalizedName = normalizeName(name);
    const previouslyOwned = ownedNames.has(normalizedName);
    ownedNames.add(normalizedName);
    try {
      const result = await operation;
      if (!ownedNames.has(normalizedName) || !extension.isLoaded({NAME: normalizedName})) {
        throw cancelledRegistration(normalizedName);
      }
      return result;
    } catch (error) {
      if (!previouslyOwned && !extension.isLoaded({NAME: normalizedName})) {
        ownedNames.delete(normalizedName);
      }
      throw error;
    }
  }

  function registration(name: unknown): EmbeddedAssetRegistration {
    const normalizedName = normalizeName(name);
    return Object.freeze({
      name: normalizedName,
      mimeType: extension.getAssetMimeType({NAME: normalizedName})
    });
  }

  function releaseAsset(name: unknown): void {
    const normalizedName = normalizeName(name);
    if (!ownedNames.delete(normalizedName)) return;
    let stopError: unknown;
    if (extension.getAssetMimeType({NAME: normalizedName}).startsWith('audio/')) {
      try {
        extension.stopSound({NAME: normalizedName});
      } catch (error) {
        stopError = error;
      }
    }
    extension.deleteMemoryAsset({NAME: normalizedName});
    if (stopError) throw stopError;
  }

  const composition: AssetManagerComposition = {
    async registerProjectAsset(input) {
      const operation = extension
        .registerAsset({NAME: input.name, RESOURCE_ID: input.resourceId})
        .then(() => registration(input.name));
      return trackRegistration(input.name, operation);
    },
    async registerEmbeddedAsset(input) {
      return trackRegistration(input.name, extension.registerEmbeddedAsset(input));
    },
    releaseAsset,
    releaseAll() {
      const errors: unknown[] = [];
      for (const name of [...ownedNames].reverse()) {
        try {
          releaseAsset(name);
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 0) throw new AggregateError(errors, 'Failed to release assets');
    },
    isRegistered(name) {
      return ownedNames.has(normalizeName(name)) && extension.isLoaded({NAME: name});
    },
    getMimeType(name) {
      return ownedNames.has(normalizeName(name)) ? extension.getAssetMimeType({NAME: name}) : '';
    },
    applyToStage(name) {
      return extension.setStageSkin({NAME: name});
    },
    applyToTarget(name, target) {
      return extension.setThisSpriteSkin(
        {NAME: name},
        {target: target as TurboWarpTarget, runtime: Scratch.vm.runtime}
      );
    },
    playSound(name, options = {}) {
      return options.untilDone
        ? extension.playSoundUntilDone({NAME: name})
        : extension.playSound({NAME: name});
    },
    stopSound(name) {
      extension.stopSound({NAME: name});
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
    }
  };
  return Object.freeze(composition);
}
