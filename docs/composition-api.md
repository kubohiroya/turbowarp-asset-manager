## Composition API

Composite extensions can import the block-free API and keep its registry private to one runtime
component:

```js
import {createAssetManagerComposition} from '@kubohiroya/turbowarp-asset-manager/composition';

const assets = createAssetManagerComposition();
await assets.registerEmbeddedAsset({
  name: 'Opening',
  sourceName: 'opening.svg',
  mimeType: 'image/svg+xml',
  bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')
});
await assets.applyToStage('Opening');
assets.releaseAll();
```

Embedded bytes are copied into memory and are not fetched or persisted in IndexedDB. Only image
and audio MIME types are accepted. Project-local costume, backdrop, and sound identifiers can be
registered with `registerProjectAsset`. Importing the module does not register a Standalone
extension or add blocks to a palette.

Raster images may set `bitmapResolution: 2` to preserve the logical size of a Scratch high-density
costume; omitting it keeps the existing resolution-1 behavior. SVG and audio registrations must not
specify `bitmapResolution`.

Composition hosts that already have structured project metadata should pass a `locator` instead
of joining names into a colon-delimited `resourceId`. Locator fields use exact Scratch names, so
spaces, `.`, `/`, `:`, and control characters are preserved. A structured locator also makes the
logical registration name literal by default; embedded assets can opt into the same behavior with
`nameMode: 'literal'`.

```js
await assets.registerProjectAsset({
  name: 'Costume.1 / presentation',
  locator: {
    kind: 'costume',
    target: 'Actor / presenter',
    name: 'Costume.1 / source'
  }
});
```

Omitting `target` from a sound locator selects the Stage. The existing string `resourceId` grammar
and its trimmed logical names remain available for saved projects and block-based callers.

### Audio voices

Composition consumers can start a registered external or project-local sound as an independently
owned audio voice. `createAudioVoice` resolves after browser playback starts and returns a frozen
handle with instance-local gain, an idempotent `stop()` method, and an `ended` promise. Gain values
are finite linear amplitudes from `0` to `1`.

```js
const outgoing = await assets.createAudioVoice('OpeningMusic');
const incoming = await assets.createAudioVoice('BattleMusic', {gain: 0});

outgoing.setGain(0.5);
incoming.setGain(0.5);

outgoing.stop();
await outgoing.ended;
incoming.setGain(1);
```

Voices created from the same asset remain independent: changing or stopping one voice does not
change another voice or a sound started through `playSound`. Natural completion and explicit stop
resolve `ended`; playback failure rejects it. `stopSound` stops all managed voices for that logical
asset as well as legacy playback, while `stopAllSounds`, `releaseAsset`, and `releaseAll` also clean
up matching voices. Each voice releases its browser audio resource and object URL exactly once.

Project-local voices load the registered Scratch sound bytes directly and therefore do not reuse
Scratch Audio's sound-ID-wide player. This is intended for composition-owned channels such as BGM;
the existing `playSound` path remains the compatibility API for Scratch target sound effects.

### DOM image resources

Composition consumers can resolve a registered image without creating a scratch-render skin or
drawable. `resolveDOMImageResource` returns a frozen resource containing a `blob:` URL, normalized
and verified MIME type, intrinsic width and height, and an idempotent `release()` method. Raster
PNG, JPEG, GIF, WebP, BMP, and AVIF resources must have matching file signatures and must decode to
positive dimensions. SVG resources must be well-formed UTF-8 SVG and must declare positive
absolute `width`/`height`, a positive `viewBox`, or enough of those values to derive both
dimensions. The returned raster dimensions are encoded pixel dimensions; SVG absolute units are
converted to CSS pixels at 96 dpi and missing dimensions are derived from the `viewBox` ratio.

Bind a resource to an SVG `<image>` or HTML image through `applyDOMImageResource`. Reapplying the
same element installs the new URL before releasing the previous resource, so a failed resolution
keeps the current image intact. Overlapping resources for the same registered asset are separate
leases over one verified backing and object URL. The final lease revokes the URL; resolving it again
afterwards creates and verifies a new backing.

```js
const portraitImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');

await assets.registerProjectAsset({
  name: 'Portrait',
  locator: {kind: 'costume', target: 'Actor', name: 'Portrait'}
});

const portrait = await assets.applyDOMImageResource('Portrait', portraitImage, {
  owner: actorTarget
});
console.log(portrait.mimeType, portrait.width, portrait.height);

// Target cleanup:
assets.releaseDOMImageResource(portraitImage);

// Consumer disposal:
assets.releaseAllDOMImageResources();
assets.releaseAll();
```

Bubble's default SVG overlay in
[turbowarp-bubble#59](https://github.com/kubohiroya/turbowarp-bubble/issues/59) consumes this generic
resource through a Bubble-owned adapter. Asset Manager does not import Bubble types or attach
Bubble-specific security metadata; see Bubble's SVG overlay example for the integration point.

Separately loaded unsandboxed extensions can share the stock Asset Manager registry without
reading private fields. Call `getDOMImageCapability()` on the registered Asset Manager extension
and pass the returned frozen capability to the consumer-owned adapter. The capability exposes only
generic registration lookup, MIME lookup, and verified DOM resource resolution:

```js
const assetManager = Scratch.vm.runtime.ext_kubohiroyaassetmanager;
const imageCapability = assetManager.getDOMImageCapability();

if (imageCapability.isRegistered('Portrait')) {
  const portrait = await imageCapability.resolveDOMImageResource('Portrait');
  imageElement.setAttribute('href', portrait.url);
  const releasePortrait = () => {
    imageElement.removeAttribute('href');
    portrait.release();
  };
  // Call releasePortrait() when the consumer replaces or removes the image.
}
```

The capability shares the exact registry populated by the stock Asset Manager blocks. Successful
replacement or deletion invalidates its active leases. Project stop, project reload, and runtime
disposal release every remaining lease. Target- or clone-specific consumers retain ownership of
their resource and must call its idempotent `release()` during their own target lifecycle cleanup.

Successful asset replacement and `releaseAsset` release every outstanding resource for that
logical name. `releaseAllDOMImageResources` releases URLs without unregistering assets, while
`releaseAll` does both. Active URLs are also released on `PROJECT_STOP_ALL`, `PROJECT_LOADED`, and
`RUNTIME_DISPOSED`. Passing the owning TurboWarp target to `applyDOMImageResource` additionally
releases its URL when a removed target or clone emits `STOP_FOR_TARGET`. Once released, the URL is
revoked, a bound matching `href`/`src` is removed, and Asset Manager retains no Blob or byte
reference. Callers must not keep using a released URL and must reapply resources after stop or
project reload.

SVG security is reject-by-default. The validator rejects malformed XML, DOCTYPE/entity and
stylesheet processing instructions, non-SVG element namespaces, `script`, `foreignObject`,
`iframe`, `object`, `embed`, and SMIL mutation elements, all `on*` event attributes, `xml:base`,
imported or executable CSS, and URL-bearing attributes or CSS that refer outside the document.
Local fragment references and base64 data URLs for the supported raster image formats are allowed;
nested SVG data URLs are not.
Validation occurs before creating the object URL, and accepted SVG is reserialized from the parsed
DOM. These checks are a resource boundary for `<img>`/SVG `<image>` use, not permission to inject
the returned content as live HTML or a top-level SVG document.

The DOM resource contract is additive and was introduced in package release 0.12.0. The stock
extension capability handoff is added in 0.12.1. Bubble should pin the required released version
exactly, as it does for other composition dependencies;
breaking method or field changes require a new major version. Rollback requires only disabling the
Bubble SVG-overlay backend and returning to its scratch-render path. Existing skin application,
sound, registration, persistence, and cache behavior does not call this API and is unchanged.

Kamishibai hosts should scope the persistent cache to one story. Generate the database name when
the story manifest is first built, persist both the stable ID and generated name in that manifest,
and keep the database name when only the source filename changes:

```js
import {
  createAssetManagerComposition,
  createVerifiedRemoteCacheDatabaseName
} from '@kubohiroya/turbowarp-asset-manager/composition';

const cacheIdentity = {
  id: storyManifest.cacheId,
  label: storySourceFile.name,
  databaseName: storyManifest.cacheDatabaseName ??
    createVerifiedRemoteCacheDatabaseName({
      id: storyManifest.cacheId,
      label: storySourceFile.name
    })
};
const assets = createAssetManagerComposition(undefined, {
  verifiedRemoteCache: {cacheIdentity}
});
```

Generated names use the form
`tw-kamishibai-assets-v1--<readable-script-name>--<stable-story-id>`. Only the basename is used;
local directory paths are not retained. Unicode letters and digits are preserved, while spaces and
other punctuation become hyphens. The stable ID prevents same-filename stories from sharing data.
Persisting the generated name prevents a normal rename from abandoning the old database. The
database also contains a small `info/identity` record with the current display label, stable ID,
format version, and last-open time. Stats return the same identity so an app shell can display and
clear caches per story. The unscoped default database remains available for generic composition
consumers, but DSL 4.0 runtime integration must always provide `cacheIdentity`.

Story databases are indexed by the small shared `tw-kamishibai-cache-catalog-v1` database. The
catalog stores only database names, story IDs, display labels, logical byte and entry counts,
last-used timestamps, and short-lived runtime leases; it never stores asset binary data or enables
cross-story asset lookup. This lets an app shell enumerate understandable per-story caches,
enforce one origin-wide budget, and delete a database for a story that is no longer installed.
`listVerifiedRemoteStoryCaches`,
`pruneVerifiedRemoteStoryCaches`, and `deleteVerifiedRemoteStoryCache` expose those controls.
`clearVerifiedRemoteCache` keeps the current story database and its identity while removing its
entries; explicit story deletion removes the complete database and its catalog record.
Each running story renews its own lease with `renewVerifiedRemoteStoryCacheLease` and releases it
with `releaseVerifiedRemoteStoryCacheLease` at story stop or session disposal. Cleanup and explicit
deletion skip a database while any tab still has an unexpired lease; an expired lease is removed
automatically after a crashed or closed tab can no longer renew it. Lease acquisition and the story
catalog update share one transaction. Deletion first installs an exclusive catalog marker, so a new
runtime cannot acquire a lease between the active check and `deleteDatabase`. The current runtime's
lease is not released implicitly: the host must stop or dispose the story, release its lease, and
only then request complete database deletion.

### Verified remote binary cache

Composition hosts can opt into a cache-first remote-binary path without adding blocks to the
Asset Manager palette. The host remains responsible for network policy and supplies the loader;
Asset Manager validates the declared size, normalized Content-Type, and SHA-256 before it stores or
returns network bytes.

```js
const model = {
  url: 'https://cdn.example/model.bin',
  integrity: 'sha256-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  size: 123456,
  contentType: 'application/octet-stream'
};

const result = await assets.resolveVerifiedRemoteBinary(model, {
  signal: abortController.signal,
  load: async ({url}, {signal}) => {
    const response = await fetch(url, {signal});
    return {
      bytes: await response.arrayBuffer(),
      contentType: response.headers.get('content-type'),
      transferOwnership: true
    };
  }
});
```

A valid content-addressed IndexedDB hit is revalidated and returned without calling the loader, so
previously verified content remains available offline. A read failure falls back to the loader. If
verification succeeds but the cache write fails, the result is still returned for memory-only use;
`cacheRead` and `cacheWrite` report the cache outcome, while `cacheWarnings` contains sanitized
machine-readable codes for blocked, unavailable, quota, cleanup, and write failures. Cancellation
prevents that resolution's write from remaining in the cache.

The unscoped verified cache uses the isolated `tw-asset-manager-verified-binary-v1` database; a
story-scoped host uses the readable database name described above. Neither mode alters the legacy
name-keyed `tw-asset-manager` database. Records contain the integrity, size,
Content-Type, timestamps, and bytes; source URLs and credentials are not persisted. The default
high-water mark is the smaller of 256 MiB and 20% of the browser-reported origin quota. Before a
write exceeds that mark, old unpinned and inactive story databases are removed first and the
current story's least-recently-used records are then removed to the 80% low-water mark. A story
database that has not been opened for the TTL can be deleted from the catalog without opening and materializing its
assets. Individual records unused for 30 days, corrupt metadata, and unknown formats are pruned;
access timestamp writes are throttled to once per hour. A record larger than the current budget is
used in memory but not cached. Bytes held by other active story databases reduce the current story's
effective allowance. If those pinned bytes leave too little room, verified network bytes are used in
memory without an IndexedDB write and `ASSET_CACHE_ORIGIN_BUDGET_PINNED` is reported.
`QuotaExceededError` triggers cleanup and one write retry.

Hosts can override `maxCacheBytes`, `quotaFraction`, `lowWaterRatio`, `ttlMs`,
`touchIntervalMs`, `cleanupBatchSize`, and the runtime `leaseTtlMs` through the second argument to
`createAssetManagerComposition`. They can expose storage controls using
`getVerifiedRemoteCacheStats`, `pruneVerifiedRemoteCache`, and
`clearVerifiedRemoteCache`. Cleanup walks primary-key cursors and the `lastAccessedAt` LRU index in
bounded batches; it never materializes the complete key or metadata set in one JavaScript array.
Maintenance uses key cursors and lightweight metadata lookups and does not read cached
`ArrayBuffer` values merely to calculate stats, TTL, LRU, or clear results. Orphaned binary records
without metadata are deleted, but their unknown byte length is not added to diagnostic byte totals.
Stats reconcile TTL and entry/metadata pairing before they are returned. Cleanup and conditional
deletion compare the observed write generation again inside the deletion transaction, so a stale
reader cannot remove a newer record from another tab. Binary and metadata records are deleted
together;
story DB mutations also advance a monotonic statistics revision. The catalog ignores an older
snapshot from another tab, preventing stale entry and byte counts from replacing a newer clear or
write. Local prune, clear, and stats results expose machine-readable `warnings` when catalog
reconciliation fails while leaving the verified local cache operation usable;
clearing this cache does not delete legacy Standalone assets. IndexedDB is an auxiliary cache, not
a secrecy boundary: deployed applications should avoid remote assets containing credentials or
private material and should offer users a cache-clear control where appropriate.

Persistent cache lifetime and materialized memory lifetime are separate. When the loader sets
`transferOwnership: true`, it must not read or mutate the supplied `ArrayBuffer` after returning;
Asset Manager verifies, stores, and returns that owned buffer without an additional full-size
JavaScript copy. Without that flag, Asset Manager makes one defensive input copy. IndexedDB still
performs its browser-managed structured clone. After resolution, the caller owns the returned
buffer and Asset Manager retains no application-level heap copy. Registering those bytes as an image or sound creates a separate in-memory
resource, which the composition host releases with `releaseAsset` or `releaseAll`. A scene-based
DSL can therefore implement the following policy without deleting the offline cache:

```yaml
loading: lazy
retention: scene # release the materialized resource after the last adjacent scene that needs it
```

With `retention: story`, the host keeps the materialized resource until story stop, restart, or
session disposal. These values are host-level lifecycle policy; Asset Manager neither parses the
YAML nor treats them as IndexedDB TTL. Releasing an in-memory registration does not delete verified
bytes from IndexedDB, and clearing IndexedDB does not invalidate a resource that is already
materialized in memory. JavaScript references are dropped so bytes and platform resources can be
garbage-collected, but immediate physical memory erasure is not guaranteed.

### Transactional binary bundles

Version 0.7.0 lets composition hosts persist a self-contained multi-file asset without adding a
block or treating the files as external image/audio cache entries. Configure a story-specific
database name and bind every operation to the story/source namespace, asset name, and manifest
bundle integrity:

```js
const assets = createAssetManagerComposition(undefined, {
  binaryBundleStore: {
    databaseName: `${storyManifest.cacheDatabaseName}--bundles-v1`
  }
});

await assets.putBinaryBundle({
  namespace: `${storyManifest.id}/${storySource.integrity}`,
  name: 'RescuePose',
  integrity: poseAsset.bundleIntegrity,
  files: [
    {path: 'model.json', size: model.size, integrity: model.integrity, bytes: model.bytes},
    {path: 'metadata.json', size: metadata.size, integrity: metadata.integrity, bytes: metadata.bytes},
    {path: 'weights.bin', size: weights.size, integrity: weights.integrity, bytes: weights.bytes}
  ]
});

const stored = await assets.getBinaryBundle({
  namespace: `${storyManifest.id}/${storySource.integrity}`,
  name: 'RescuePose',
  integrity: poseAsset.bundleIntegrity
});
```

`putBinaryBundle` copies and verifies each file before writing one bundle record and lightweight
metadata in the same IndexedDB transaction. It resolves only after `IDBTransaction.oncomplete`, so
the host keeps its one-shot source provider reachable until the promise fulfills. The bundle
integrity is the caller-validated manifest identity and forms part of the scoped key; the store
independently verifies every declared file size and SHA-256 on put and again on get. Canonical
lowercase hexadecimal and standard padded base64 SHA-256 forms are accepted. A partial, expired,
or corrupt record is never returned.

The store is separate from the Standalone `assets` database and the verified remote binary cache.
Its default limits are 256 files and 256 MiB per bundle, 1024 bundles and 256 MiB per database, and
a 30-day last-use TTL. A put removes expired and least-recently-used bundles in the same transaction
before committing the replacement. Hosts can lower these limits through `binaryBundleStore`.
`deleteBinaryBundle` removes both the bundle and metadata atomically. `releaseBinaryStore` aborts
pending operations and prevents later use of that instance without deleting persistent records.
Missing, unavailable, blocked, aborted, quota, corrupt, and integrity-failure paths expose stable
`ASSET_BINARY_BUNDLE_*` error codes without including payload bytes in diagnostics.

### Session-only binary backing

Composition hosts that embed large binaries in their current application package can use a
separate session-only contract. It does not reuse the persistent binary bundle store above and
does not modify the verified remote cache:

```js
const assets = createAssetManagerComposition(undefined, {
  sessionBinaryBacking: {
    maxSessionBytes: 512 * 1024 * 1024
  }
});

const backing = await assets.createSessionBinaryBacking({
  policy: 'prefer',
  sessionId: crypto.randomUUID(),
  assets: [{
    namespace: `${story.id}/${story.sourceIntegrity}`,
    name: 'RescuePose',
    integrity: poseAsset.bundleIntegrity,
    files: poseAsset.files.map(({path, size, integrity}) => ({path, size, integrity}))
  }],
  source: {
    async read(asset, {signal} = {}) {
      return readValidatedEmbeddedAsset(asset, {signal});
    },
    async release() {
      releaseEmbeddedPackageReader();
    }
  },
  onFatalError(error) {
    stopRuntimeAndShowDiagnostic(error);
  }
});

const poseFiles = await backing.get({
  namespace: `${story.id}/${story.sourceIntegrity}`,
  name: 'RescuePose',
  integrity: poseAsset.bundleIntegrity
});

await backing.dispose();
```

The startup policy is fixed for the returned backing. `disabled` never opens IndexedDB and keeps
the supplied source for direct reads. `required` fails startup when session storage cannot be
established. `prefer` falls back to direct reads only for IndexedDB unavailable, blocked, quota, or
transaction-abort failures that happen before establishment; it reports
`ASSET_SESSION_BINARY_DIRECT_FALLBACK` and its `causeCode`. Source metadata, size, or SHA-256
failures never select that fallback.

Session mode uses one versioned origin-wide database and includes the caller's session ID in each
bundle compound key. It reads and commits one asset at a time, verifies every file again from the
committed record, activates the session only after all read-backs succeed, and then releases the
source. Once activated, a missing, corrupt, integrity-failing, aborted, or closed-connection read is
fatal: the backing never rereads the source, rewrites IndexedDB, or changes to direct mode.
`onFatalError` lets the host stop its runtime while preserving the authoritative error code.
Renderer, audio decoder, or model-loader failures after `get` returns are materialization errors;
Asset Manager does not relabel them as storage or source failures.

Each active backing renews a short lease. New sessions clean only a bounded number of expired
session records and leave unexpired sibling-tab sessions intact. Normal `dispose` removes only its
own session records. The database name, per-asset and per-session byte/file limits, lease TTL,
heartbeat interval, and cleanup batch size are configurable through `sessionBinaryBacking`; byte
limits may be raised to any positive safe integer after the host applies its own resource policy.
The source must remain readable until Asset Manager calls `release`, including when `prefer`
selects direct mode.
