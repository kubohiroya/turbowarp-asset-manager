# TurboWarp Asset Manager

An IndexedDB-backed image, audio, and runtime-text asset manager for TurboWarp projects. It can also register costumes, stage backdrops, sounds, and Temporary Variables runtime-variable references used by the current `.sb3` project.

## Installation

Download [`dist/asset-manager.js`](dist/asset-manager.js), then open TurboWarp Desktop and load it as a local custom extension. Enable **Run extension without sandbox** when prompted.

The built JavaScript file is committed to this repository so that users do not need to install Node.js or run the build process.

The versioned npm package contains the same reviewed build:

```bash
pnpm add --save-exact @kubohiroya/turbowarp-asset-manager@0.5.0
```

Load `node_modules/@kubohiroya/turbowarp-asset-manager/dist/asset-manager.js`, or use the
version-pinned CDN URL:

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-asset-manager@0.5.0/dist/asset-manager.js
```

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

## Extension ID compatibility

This migration release uses the standards-compliant ID `kubohiroyaassetmanager`. Existing projects
that store `twAssetManager` opcodes must apply a schema-aware project migration at the same time;
replacing the JavaScript artifact alone would break their existing blocks.

## Features

- register external image and audio URLs;
- cache external binary data in IndexedDB;
- refresh the cache whenever an HTTP or HTTPS URL is explicitly supplied;
- register sprite costumes and stage backdrops without copying their renderer skins;
- register sprite and stage sounds without copying their audio data;
- register Temporary Variables runtime variables as live text assets;
- apply image assets to the current sprite, a named sprite, or the stage;
- display text assets on sprites through the Animated Text extension;
- animate named actors with background loops or one-shot asset sequences;
- play audio assets with or without waiting for completion;
- normalize missing or generic MIME types from file extensions;
- preserve the last-started valid external download in both memory and IndexedDB;
- optionally live-replace managed image and text displays after a same-kind registration;
- optionally reject same-name public-kind changes, including external image/audio changes;
- release only renderer skins owned by Asset Manager when registrations are removed.

The current-sprite block works with clones. A stage drawable ID of `0` is treated as valid. Project-local assets remain owned by the Scratch VM and are not written to IndexedDB. Text assets store only a runtime-variable name; they never copy or cache its value.

External URL downloads are prepared before they are persisted. A per-name registration generation is checked before the IndexedDB write and again before the in-memory commit. If same-name requests finish out of order, an older completion cannot replace the cache or registration selected by the most recently started valid request.

## Resource identifiers

The `register resource [RESOURCE_ID] as asset [NAME]` block accepts the following forms:

```text
https://example.com/asset.png
costume:Sprite1:costume1
costume:Sprite1
costume
backdrop:backdrop1
backdrop
sound:Sprite1:sound1
sound:Sprite1
sound:@stage:stage-sound1
sound
text:Narration
text
```

An empty `RESOURCE_ID` reloads the external asset named by `NAME` from IndexedDB. Project-local identifiers support these shorthands:

- `costume:Sprite1` uses `NAME` as the costume name.
- `costume` uses `NAME` as the sprite name. It selects a costume with the same name, or the sprite's only costume. It fails when multiple costumes exist and none has that name.
- `backdrop` uses `NAME` as the stage backdrop name.
- `sound:Sprite1` uses `NAME` as the sprite sound name.
- `sound` uses `NAME` as the stage sound name.
- `text` uses `NAME` as the logical text name and reads its value from the internal `text:<NAME>` runtime-variable namespace.

Fully specified `costume:` and `sound:` identifiers use exactly one colon between the source target name and the costume or sound name. A `text:` identifier contains one logical text name after the colon and maps it to the same internal `text:` namespace. Colons cannot be used inside local sprite, costume, backdrop, sound, or logical text names. Commas are ordinary name characters. Double quotes and backslashes have no quoting or escaping role and are not interpreted specially.

## Runtime text assets

Runtime text rendering requires both TurboWarp extensions below to be loaded unsandboxed:

- [Temporary Variables](https://extensions.turbowarp.org/Lily/TempVariables2.js), extension ID `lmsTempVars2`;
- [Animated Text](https://extensions.turbowarp.org/lab/text.js), extension ID `text`.

Registering a text asset does not require the runtime variable to exist yet. The `set text asset [NAME] to [VALUE]` block stores the value in the internal `text:<NAME>` namespace. Each time the asset is shown, Asset Manager reads the latest value and style through `lmsTempVars2`, reapplies the complete style, and invokes Animated Text for the destination sprite or clone. Updating a text value also refreshes every sprite or clone currently displaying that asset. A missing runtime variable therefore displays an empty string. Missing extension dependencies are reported when a text value or style is set, or when the text asset is shown, rather than when it is registered.

The `set text asset [NAME] style [PROPERTY] to [VALUE]` block changes one style property at a time. An empty value resets that property to its default.

| Property | Accepted values | Default |
|---|---|---|
| `animation` | `none`, `type`, `typing`, `rainbow`, `zoom`, `shake` | `none` |
| `font` | Any non-empty font name accepted by Animated Text | `Handwriting` |
| `color` | `#rgb` or `#rrggbb` | `#ffffff` |
| `width` | Positive number | Current stage width |
| `align` | `left`, `center`, `right` | `center` |

`typing` is a DSL-friendly alias for Animated Text's `type` value. The full style is reapplied before every display so that a previous text asset or sprite cannot leak its style into the next one. When the installed Animated Text version supports outline controls, Asset Manager also applies a two-pixel black outline. Animated display starts in the background; the `show` action can immediately continue to its existing position and size steps without waiting for the animation to finish.

The existing paper-theater `show` action can use text assets, so it retains the same position and size arguments without adding another DSL action:

```text
asset=Narration,text
actor=Prompt,Narration
text=Narration:むかし　むかし、あるところに...
textStyle=Narration:animation:typing
textStyle=Narration:font:Sans Serif
textStyle=Narration:color:#ffffff
textStyle=Narration:width:200
textStyle=Narration:align:left
action=Prompt:show:Narration:0,0,100
```

The actor name in `actor=` and the target name in `action=` must match (`Prompt` in this example). The second `actor=` item, each `text=` / `textStyle=` item, and the `show` asset item all name the registered text asset (`Narration`). The tmpose-kamishibai integration should map `text=` and `textStyle=` to Asset Manager's two setter blocks; Asset Manager itself does not parse the DSL.

## Safe same-name replacement

Two startup-fixed feature flags control the rollout. Both default to `false`. A host can enable them by defining the configuration object before loading `dist/asset-manager.js`:

```js
globalThis.__TW_ASSET_MANAGER_FEATURE_FLAGS__ = {
  ENABLE_LIVE_ASSET_REPLACEMENT: true,
  ENABLE_STRICT_ASSET_KIND_REPLACEMENT: true
};
```

With `ENABLE_LIVE_ASSET_REPLACEMENT`, registering the same public kind under an existing name prepares the new resource, commits the registry, reapplies only targets that Asset Manager still tracks as displaying that name, and then releases the old owned resource. Images and text refresh immediately. Text reads its latest body and complete style again, and a configured animation starts again from the beginning. Audio already playing is not interrupted; its next playback uses the new registration. Same-name commits run serially: a commit that has started finishes atomically, and the last-started successful registration remains afterward. A newer attempt that fails validation does not cancel an earlier valid one. If preparation, registry commit, or display reapply fails, Asset Manager restores the old registration and managed display.

Display bindings retain the target ID, asset name, public kind, and applied renderer skin ID for images. Before live replacement, Asset Manager verifies that an image target still uses that skin. A costume change or another extension's renderer update releases the stale binding, so replacement does not overwrite that newer display. A later Asset Manager display replaces the binding, and removing a target or asset removes stale bindings.

With `ENABLE_STRICT_ASSET_KIND_REPLACEMENT`, a name keeps its public DSL kind: `external`, `costume`, `backdrop`, `sound`, or `text`. Replacing it with another kind throws `ASSET_TYPE_CHANGE`; an external image also cannot become external audio or vice versa. Explicitly delete the registration before intentionally reusing its name for another kind.

To roll back either behavior, set its flag to `false` and reload the extension. The default flag-off path retains the earlier registration behavior. Cache-generation and diagnostic fixes are unconditional and can be reverted independently from the two flagged features.

## Diagnostic errors

User-facing failures are `AssetManagerError` instances. They retain a stable `code`, operation, relevant asset/resource/actor names, a correction hint, candidate names, and the original `cause`. Messages begin with `[Asset Manager][CODE]`. Candidate lookup searches the relevant registered assets, actors, costumes, or sounds, prioritizes a case-insensitive exact match, and then returns up to three names by edit distance.

The `asset registration error type` and `asset registration error label` Reporter blocks expose the latest `register resource` failure to scripts and monitors. The type Reporter returns the stable code; the label Reporter returns the most relevant asset name, resource ID, or actor name. Starting a registration clears both values, and concurrent registrations allow only the most recently started operation to update them. Both Reporters are empty after a successful latest registration.

When upgrading from `0.3.0`, update scripts that compare `asset registration error type` against the previous lowercase type tokens. Version `0.4.0` returns the uppercase diagnostic codes below, such as `SOURCE_ASSET_NOT_FOUND` and `RESOURCE_ID_INVALID`.

Stable codes are:

| Code | Meaning |
|---|---|
| `INVALID_ASSET_NAME` | The registration name is empty or invalid. |
| `ASSET_NOT_REGISTERED` | No registered or cached asset has the requested name. |
| `ASSET_TYPE_MISMATCH` | An operation requires a different registered kind. |
| `ASSET_TYPE_CHANGE` | Strict replacement rejected a public-kind or external media-kind change. |
| `SPRITE_NOT_FOUND` | A sprite, stage, target, or drawable is missing. |
| `SPRITE_NAME_AMBIGUOUS` | More than one actor target has the requested name. |
| `SOURCE_ASSET_NOT_FOUND` | A referenced costume, backdrop, or sound is missing or ambiguous. |
| `RESOURCE_ID_INVALID` | The resource identifier has an unsupported or invalid form. |
| `DEPENDENCY_MISSING` | A required TurboWarp extension or runtime service is unavailable. |
| `STYLE_PROPERTY_INVALID` | A text style property name is unsupported. |
| `STYLE_VALUE_INVALID` | A text style value is invalid. |
| `PLAYBACK_FAILED` | Audio playback failed. |
| `ANIMATION_FAILED` | Background actor or text animation failed. |
| `REPLACEMENT_FAILED` | Preparing or applying a replacement failed. |

Synchronous operations throw without also logging the same exception. Background audio and animation failures cannot be returned to a block, so they are wrapped with context and sent to `console.error` exactly once.

The old `load asset from URL [URL] or cache as [NAME]` opcode remains available to existing projects, but it is hidden from the block palette.

## Actor animation input

The actor animation blocks receive two ordinary string arguments:

```text
ASSETS = Clock1,Bell,Clock2
DURATIONS = 0,0.5,1.0
```

`ASSETS` is a comma-separated string of registered image or audio asset names. Each asset keeps its registered type: image assets change the actor skin, while audio assets start playing without waiting for playback to finish. `DURATIONS` is a comma-separated string of non-negative intervals in seconds.

Each duration is the interval after the asset in the same position and before the next asset. A duration of `0` therefore makes the next asset start together with the preceding asset. Multiple consecutive zeroes form one simultaneous group. If that group contains multiple image assets, only the last image in the group is applied; every audio asset in the group is started.

For `loop`, `ASSETS` and `DURATIONS` must have the same number of items; the final duration is the interval from the final asset back to the first asset. At least one loop duration must be positive. For `sequence`, `DURATIONS` must have exactly one fewer item than `ASSETS`, because no interval follows the final asset. Too many or too few items is an error.

Starting a new loop or sequence replaces the actor's existing animation. A sequence runs once in the background and leaves its final skin displayed. Setting the actor skin or explicitly stopping the animation cancels the active loop or sequence. Audio playback that has already started is not stopped by cancelling the animation.

Projects saved with the earlier animation blocks may still provide the legacy `COSTUMES` argument internally. It is accepted as a compatibility alias, but new blocks and documentation use `ASSETS` because the values are registered typed assets rather than raw TurboWarp costume names.

### DSL mapping

The animation blocks map directly to the paper-theater DSL:

```text
action=Fish:loop:Fish1,Fish2:0.5,0.5
```

calls the loop block with `ACTOR=Fish`, `ASSETS=Fish1,Fish2`, and `DURATIONS=0.5,0.5`.

```text
action=Clock:loop:NoonSkin,Bell,NextSkin:0,1,2
```

starts `NoonSkin` and `Bell` together, waits one second, then changes to `NextSkin`, and waits two seconds before looping. The same mixed image/audio and zero-duration grouping rules apply to `sequence`, but a sequence omits the final duration.

```text
action=Fish:loop:
```

maps to the stop block, or to the loop block with empty `ASSETS` and `DURATIONS`. The currently displayed skin remains unchanged.

```text
action=Urashima:sequence:Urashima-open1,Urashima-open2,Urashima-open3:1,2
```

starts a one-shot background sequence and returns immediately. After the final duration expires, the last skin remains displayed.

```text
action=Fish:setSkin:Fish3
```

stops the animation for `Fish` before applying `Fish3`.

Animation state is keyed by the unique ACTOR name. A sprite or clone may define that identity in a local `actorName` variable. The invoking target is preferred when its `actorName` or sprite name matches; otherwise Asset Manager searches `actorName` values before falling back to sprite names. Duplicate matches without an invoking target are rejected as a project invariant violation. Applying a project costume preserves a clone's current size while original sprites still adopt the source sprite size. The resolved target is retained in the state only as the drawing destination and for deletion cleanup. Starting a new animation replaces that ACTOR's previous animation. ACTOR deletion, green flag, project stop, runtime disposal, and deleting all in-memory assets cancel the relevant timers.

## Loading indicator compatibility

Six hidden compatibility opcodes support projects that show a loading animation while assets are prepared. `setLoadingBackdrop` configures one image asset to display behind the loading indicator, and `loadingBackdrop` reports its normalized name. `setLoadingCostumes` configures an ordered, de-duplicated list of loading image assets. `prepareLoadingAssets` validates those names against a project list, moves the backdrop first, then moves the costume definitions to the front while preserving their relative order. `loadingAssetCount` reports how many prioritized entries were found, and `loadingCostumeAt` cycles through the configured costume names using a one-based index.

## Blocks

<!-- BEGIN GENERATED BLOCKS -->

### `register resource [RESOURCE_ID] as asset [NAME]`

Registers an external URL, cached asset, sprite costume, stage backdrop, project sound, or runtime text variable under one asset name.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `registerAsset` |
| `RESOURCE_ID` | String, default: `https://example.com/asset.png` |
| `NAME` | String, default: `asset1` |

### `asset registration error type`

Returns the stable error code for the most recent asset registration failure, or an empty string when the latest registration succeeded.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `assetErrorType` |

### `asset registration error label`

Returns the relevant asset, resource, or actor name for the most recent registration failure, or an empty string when the latest registration succeeded.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `assetErrorLabel` |

### `load asset from URL [URL] or cache as [NAME]`

Legacy compatibility block. Loads an external image or audio asset from the supplied URL, or from IndexedDB when the URL is empty.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `loadAsset` |
| Palette | Hidden (legacy compatibility) |
| `URL` | String, default: `https://example.com/asset.png` |
| `NAME` | String, default: `asset1` |

### `delete asset [NAME] from memory`

Unregisters one asset. Owned external renderer skins are released; project costumes, sounds, and runtime variables are left unchanged.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `deleteMemoryAsset` |
| `NAME` | String, default: `asset1` |

### `delete all assets from memory`

Unregisters all assets, releases owned external renderer skins, stops actor animations, and stops tracked external audio playback.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `deleteAllMemoryAssets` |

### `delete asset [NAME] from cache`

Deletes one named external asset from the IndexedDB cache.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `deleteCachedAsset` |
| `NAME` | String, default: `asset1` |

### `delete all assets from cache`

Clears all external assets from the IndexedDB cache.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `deleteAllCachedAssets` |

### `asset [NAME] is loaded`

Returns whether the named external, project-local, or runtime text asset is currently registered.

| Property | Value |
|---|---|
| Type | Boolean |
| Opcode | `isLoaded` |
| `NAME` | String, default: `asset1` |

### `set text asset [NAME] to [VALUE]`

Sets the runtime text value for a text asset using Asset Manager's internal namespace.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setTextValue` |
| `NAME` | String, default: `Narration` |
| `VALUE` | String, default: `Once upon a time...` |

### `set text asset [NAME] style [PROPERTY] to [VALUE]`

Sets one runtime style property for a text asset. Supported properties are animation, font, color, width, and align. An empty value restores the default.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setTextStyle` |
| `NAME` | String, default: `Narration` |
| `PROPERTY` | String, default: `font` |
| `VALUE` | String, default: `Sans Serif` |

### `show asset [NAME] on this sprite`

Applies a registered image asset or displays a registered runtime text asset on the current sprite or clone.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setThisSpriteSkin` |
| `NAME` | String, default: `asset1` |

### `show asset [NAME] on [SPRITE] (compatibility)`

Stops any actor animation and applies a registered image asset or displays a registered runtime text asset on a named sprite. This block is retained for compatibility.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setSpriteSkin` |
| `SPRITE` | String, default: `Sprite1` |
| `NAME` | String, default: `asset1` |

### `loop actor [ACTOR] through assets [ASSETS] for seconds [DURATIONS]`

Starts or replaces a background loop. ASSETS contains registered image or audio asset names. DURATIONS must have the same number of items; each item is the interval before the next asset, including the last-to-first interval. A zero makes the next asset start together with the preceding asset. If a simultaneous group has multiple image assets, only its last image is applied. Empty ASSETS and DURATIONS stop the actor animation.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `startActorLoop` |
| `ACTOR` | String, default: `Sprite1` |
| `ASSETS` | String, default: `asset1,asset2` |
| `DURATIONS` | String, default: `0.5,0.5` |

### `play actor [ACTOR] through assets [ASSETS] for seconds [DURATIONS] once in background`

Starts or replaces a one-shot background sequence and returns immediately. ASSETS contains registered image or audio asset names. DURATIONS must have exactly one fewer item; each item is the interval before the next asset. A zero makes the next asset start together with the preceding asset. If a simultaneous group has multiple image assets, only its last image is applied.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `startActorSequence` |
| `ACTOR` | String, default: `Sprite1` |
| `ASSETS` | String, default: `asset1,asset2` |
| `DURATIONS` | String, default: `0.5` |

### `stop animation of actor [ACTOR]`

Stops the actor's current loop or sequence and leaves the currently displayed skin unchanged.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `stopActorAnimation` |
| `ACTOR` | String, default: `Sprite1` |

### `finish all actor sequences`

Finishes every one-shot actor sequence on its final image without stopping loops.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `finishAllActorSequences` |

### `set stage backdrop to asset [NAME]`

Applies a registered external image, sprite costume, or stage backdrop to the stage drawable.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setStageSkin` |
| `NAME` | String, default: `backdrop1` |

### `play asset [NAME] as sound`

Starts playback of a registered external audio asset or project sound without waiting for completion.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `playSound` |
| `NAME` | String, default: `sound1` |

### `play asset [NAME] as sound until done`

Plays a registered external audio asset or project sound and waits until playback ends or fails.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `playSoundUntilDone` |
| `NAME` | String, default: `sound1` |

### `stop asset sound [NAME]`

Stops every active playback of one registered external or project sound asset without stopping other sounds.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `stopSound` |
| `NAME` | String, default: `sound1` |

### `stop all asset sounds`

Stops all external and project sounds currently tracked by Asset Manager.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `stopAllSounds` |

### `MIME type of asset [NAME]`

Returns the normalized MIME type of a registered external, project-local, or runtime text asset.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `getAssetMimeType` |
| `NAME` | String, default: `asset1` |

### `Asset Manager version`

Returns the Asset Manager implementation version.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `getVersion` |

<!-- END GENERATED BLOCKS -->

## Development

```bash
npm install
npm run check
```

Regenerate block documentation after changing `src/block-definitions.json`:

```bash
npm run docs
```

The build produces `dist/asset-manager.js`. Commit the rebuilt file whenever the extension source changes.

This extension accesses TurboWarp VM and renderer internals and must be loaded unsandboxed.

## License

MPL-2.0
