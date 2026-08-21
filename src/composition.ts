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
import {
  createSessionBinaryBacking as createSessionBinaryBackingStore,
  type SessionBinaryBacking,
  type SessionBinaryBackingInput,
  type SessionBinaryBackingOptions
} from './session-binary-backing.js';
import {
  createDOMImageResourceBacking,
  type DOMImageResource,
  type DOMImageResourceBacking
} from './dom-image-resource.js';

export {
  type AssetManagerAudioVoice,
  type AssetManagerAudioVoiceOptions
} from './audio-voice.js';
import {
  type AssetManagerAudioVoice,
  type AssetManagerAudioVoiceOptions
} from './audio-voice.js';

export {type DOMImageResource} from './dom-image-resource.js';

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

export {
  createSessionBinaryBacking,
  type SessionBinaryBacking,
  type SessionBinaryBackingAssetInput,
  type SessionBinaryBackingInput,
  type SessionBinaryBackingMode,
  type SessionBinaryBackingOptions,
  type SessionBinaryBackingPolicy,
  type SessionBinaryBackingSource,
  type SessionBinaryBackingSourceAsset,
  type SessionBinaryBackingWarning
} from './session-binary-backing.js';

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

export interface DOMImageResourceTarget {
  readonly namespaceURI?: string | null;
  readonly localName?: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export interface DOMImageResourceBindingOptions {
  readonly attribute?: 'href' | 'src';
  readonly owner?: AssetManagerCompositionTarget;
}

export interface AssetManagerCompositionOptions {
  readonly verifiedRemoteCache?: VerifiedRemoteBinaryCacheOptions;
  readonly binaryBundleStore?: BinaryBundleStoreOptions;
  readonly sessionBinaryBacking?: SessionBinaryBackingOptions;
}

export interface AssetManagerComposition {
  registerProjectAsset(input: ProjectAssetRegistrationInput): Promise<EmbeddedAssetRegistration>;
  registerEmbeddedAsset(input: EmbeddedAssetBytesInput): Promise<EmbeddedAssetRegistration>;
  releaseAsset(name: unknown): void;
  releaseAll(): void;
  isRegistered(name: unknown): boolean;
  getMimeType(name: unknown): string;
  resolveDOMImageResource(name: unknown): Promise<DOMImageResource>;
  applyDOMImageResource(
    name: unknown,
    target: DOMImageResourceTarget,
    options?: DOMImageResourceBindingOptions
  ): Promise<DOMImageResource>;
  releaseDOMImageResource(target: DOMImageResourceTarget): void;
  releaseAllDOMImageResources(): void;
  applyToStage(name: unknown): Promise<void>;
  applyToTarget(name: unknown, target: AssetManagerCompositionTarget): Promise<void>;
  playSound(name: unknown, options?: Readonly<{untilDone?: boolean}>): Promise<void>;
  createAudioVoice(
    name: unknown,
    options?: AssetManagerAudioVoiceOptions
  ): Promise<AssetManagerAudioVoice>;
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
  createSessionBinaryBacking(
    input: SessionBinaryBackingInput,
    options?: BinaryBundleOperationOptions
  ): Promise<SessionBinaryBacking>;
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
  const domImageResourceVersions = new Map<string, number>();
  const domImageResourceBackings = new Map<string, DOMImageResourceBackingEntry>();
  const activeDOMImageResources = new Set<ActiveDOMImageResource>();
  const activeDOMImageResourcesByName = new Map<string, Set<ActiveDOMImageResource>>();
  const domImageResourceControllers = new WeakMap<DOMImageResource, ActiveDOMImageResource>();
  const boundDOMImageResources = new WeakMap<DOMImageResourceTarget, ActiveDOMImageResource>();
  const ownerDOMImageResources = new Map<string, Set<ActiveDOMImageResource>>();

  interface ActiveDOMImageResource {
    readonly name: string;
    readonly resource: DOMImageResource;
    binding?: {
      readonly target: DOMImageResourceTarget;
      readonly attribute: 'href' | 'src';
      readonly ownerId?: string;
    };
  }

  interface DOMImageResourceBackingEntry {
    readonly version: number;
    readonly promise: Promise<DOMImageResourceBacking>;
    backing?: DOMImageResourceBacking;
  }

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

  function cancelledDOMImageResolution(name: string): Error {
    const error = new Error(`DOM image resource resolution was cancelled: ${JSON.stringify(name)}`);
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
      const registered = registration(claimed.external, claimed.internal);
      invalidateDOMImageResources(claimed.external);
      return registered;
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
    invalidateDOMImageResources(owned.external);
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

  function invalidateDOMImageResources(name: string): void {
    domImageResourceVersions.set(name, (domImageResourceVersions.get(name) ?? 0) + 1);
    for (const controller of [...(activeDOMImageResourcesByName.get(name) ?? [])]) {
      controller.resource.release();
    }
  }

  function releaseActiveDOMImageResource(controller: ActiveDOMImageResource): void {
    activeDOMImageResources.delete(controller);
    const named = activeDOMImageResourcesByName.get(controller.name);
    named?.delete(controller);
    if (named?.size === 0) activeDOMImageResourcesByName.delete(controller.name);
    const binding = controller.binding;
    if (!binding) {
      stopListeningForDOMImageLifecycleIfIdle();
      return;
    }
    const ownsTargetBinding = boundDOMImageResources.get(binding.target) === controller;
    if (ownsTargetBinding) {
      boundDOMImageResources.delete(binding.target);
      try {
        if (binding.target.getAttribute(binding.attribute) === controller.resource.url) {
          binding.target.removeAttribute(binding.attribute);
        }
      } catch {
        // The target may already be detached or disposed.
      }
    }
    if (binding.ownerId !== undefined) {
      const owned = ownerDOMImageResources.get(binding.ownerId);
      owned?.delete(controller);
      if (owned?.size === 0) ownerDOMImageResources.delete(binding.ownerId);
    }
    delete controller.binding;
    stopListeningForDOMImageLifecycleIfIdle();
  }

  function releaseAllDOMImageResources(): void {
    for (const name of ownedNames.keys()) {
      domImageResourceVersions.set(name, (domImageResourceVersions.get(name) ?? 0) + 1);
    }
    for (const controller of [...activeDOMImageResources]) controller.resource.release();
  }

  function releaseDOMImageResourcesForOwner(ownerId: string): void {
    for (const controller of [...(ownerDOMImageResources.get(ownerId) ?? [])]) {
      controller.resource.release();
    }
  }

  async function resolveDOMImageResourceBacking(
    external: string,
    internal: unknown,
    version: number
  ): Promise<DOMImageResourceBacking> {
    const cached = domImageResourceBackings.get(external);
    if (cached?.version === version) return cached.promise;

    let entry!: DOMImageResourceBackingEntry;
    const promise = (async () => {
      const resolved = await extension.resolveImageAssetBytes({NAME: internal});
      const backing = await createDOMImageResourceBacking(
        {name: external, bytes: resolved.bytes, mimeType: resolved.mimeType},
        (idleBacking) => {
          if (
            domImageResourceBackings.get(external) === entry &&
            entry.backing === idleBacking
          ) {
            domImageResourceBackings.delete(external);
          }
        }
      );
      entry.backing = backing;
      return backing;
    })();
    entry = {version, promise};
    domImageResourceBackings.set(external, entry);
    try {
      return await promise;
    } catch (error) {
      if (domImageResourceBackings.get(external) === entry) {
        domImageResourceBackings.delete(external);
      }
      throw error;
    }
  }

  async function acquireDOMImageResource(
    external: string,
    internal: unknown,
    version: number,
    onRelease: (resource: DOMImageResource) => void
  ): Promise<DOMImageResource> {
    const backing = await resolveDOMImageResourceBacking(external, internal, version);
    return backing.acquire(onRelease);
  }

  async function resolveDOMImageResource(name: unknown): Promise<DOMImageResource> {
    const owned = ownedName(name);
    const internal = owned?.internal ?? name;
    const external = owned?.external ?? normalizeName(name);
    const version = domImageResourceVersions.get(external) ?? 0;
    let controller: ActiveDOMImageResource | undefined;
    const resource = await acquireDOMImageResource(external, internal, version, () => {
      if (controller) releaseActiveDOMImageResource(controller);
    });
    if (
      !owned ||
      ownedNames.get(external) !== owned.internal ||
      (domImageResourceVersions.get(external) ?? 0) !== version
    ) {
      resource.release();
      throw cancelledDOMImageResolution(external);
    }
    controller = {name: external, resource};
    activeDOMImageResources.add(controller);
    const named = activeDOMImageResourcesByName.get(external) ?? new Set();
    named.add(controller);
    activeDOMImageResourcesByName.set(external, named);
    domImageResourceControllers.set(resource, controller);
    startListeningForDOMImageLifecycle();
    return resource;
  }

  async function applyDOMImageResource(
    name: unknown,
    target: DOMImageResourceTarget,
    bindingOptions: DOMImageResourceBindingOptions = {}
  ): Promise<DOMImageResource> {
    if (
      !target ||
      typeof target !== 'object' ||
      typeof target.getAttribute !== 'function' ||
      typeof target.setAttribute !== 'function' ||
      typeof target.removeAttribute !== 'function'
    ) {
      throw new TypeError('DOM image resource target must support DOM attributes.');
    }
    if (!bindingOptions || typeof bindingOptions !== 'object' || Array.isArray(bindingOptions)) {
      throw new TypeError('DOM image resource binding options must be an object.');
    }
    const attribute = bindingOptions.attribute ?? (
      target.namespaceURI === 'http://www.w3.org/2000/svg' ||
      target.localName?.toLowerCase() === 'image'
        ? 'href'
        : 'src'
    );
    if (attribute !== 'href' && attribute !== 'src') {
      throw new TypeError('DOM image resource attribute must be href or src.');
    }
    const resource = await resolveDOMImageResource(name);
    const controller = domImageResourceControllers.get(resource)!;
    const previous = boundDOMImageResources.get(target);
    try {
      target.setAttribute(attribute, resource.url);
    } catch (error) {
      resource.release();
      throw error;
    }
    const ownerId = bindingOptions.owner?.id;
    controller.binding = {
      target,
      attribute,
      ...(ownerId === undefined ? {} : {ownerId})
    };
    boundDOMImageResources.set(target, controller);
    if (ownerId !== undefined) {
      const ownerResources = ownerDOMImageResources.get(ownerId) ?? new Set();
      ownerResources.add(controller);
      ownerDOMImageResources.set(ownerId, ownerResources);
    }
    previous?.resource.release();
    return resource;
  }

  const runtime = Scratch.vm.runtime;
  let listeningForDOMImageLifecycle = false;
  const releaseStoppedTargetDOMImageResources = (target?: TurboWarpTarget): void => {
    if (target && !runtime.targets.includes(target)) releaseDOMImageResourcesForOwner(target.id);
  };

  function startListeningForDOMImageLifecycle(): void {
    if (listeningForDOMImageLifecycle || !runtime.on) return;
    listeningForDOMImageLifecycle = true;
    runtime.on('PROJECT_STOP_ALL', releaseAllDOMImageResources);
    runtime.on('PROJECT_LOADED', releaseAllDOMImageResources);
    runtime.on('RUNTIME_DISPOSED', releaseAllDOMImageResources);
    runtime.on('STOP_FOR_TARGET', releaseStoppedTargetDOMImageResources);
  }

  function stopListeningForDOMImageLifecycleIfIdle(): void {
    if (
      !listeningForDOMImageLifecycle ||
      activeDOMImageResources.size > 0 ||
      !runtime.off
    ) return;
    listeningForDOMImageLifecycle = false;
    runtime.off('PROJECT_STOP_ALL', releaseAllDOMImageResources);
    runtime.off('PROJECT_LOADED', releaseAllDOMImageResources);
    runtime.off('RUNTIME_DISPOSED', releaseAllDOMImageResources);
    runtime.off('STOP_FOR_TARGET', releaseStoppedTargetDOMImageResources);
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
      releaseAllDOMImageResources();
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
    resolveDOMImageResource,
    applyDOMImageResource,
    releaseDOMImageResource(target) {
      boundDOMImageResources.get(target)?.resource.release();
    },
    releaseAllDOMImageResources,
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
    createAudioVoice(name, options) {
      return extension.createAudioVoice(ownedName(name)?.internal ?? name, options);
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
    },
    createSessionBinaryBacking(input, operationOptions) {
      return createSessionBinaryBackingStore(
        input,
        options.sessionBinaryBacking,
        operationOptions
      );
    }
  };
  return Object.freeze(composition);
}
