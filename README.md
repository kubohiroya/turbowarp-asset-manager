# TurboWarp Asset Manager

An IndexedDB-backed image and audio asset manager for TurboWarp projects. It can also register costumes, stage backdrops, and sounds already stored in the current `.sb3` project.

## Installation

Download [`dist/asset-manager.js`](dist/asset-manager.js), then open TurboWarp Desktop and load it as a local custom extension. Enable **Run extension without sandbox** when prompted.

The built JavaScript file is committed to this repository so that users do not need to install Node.js or run the build process.

## Features

- register external image and audio URLs;
- cache external binary data in IndexedDB;
- refresh the cache whenever an HTTP or HTTPS URL is explicitly supplied;
- register sprite costumes and stage backdrops without copying their renderer skins;
- register sprite and stage sounds without copying their audio data;
- apply image assets to the current sprite, a named sprite, or the stage;
- animate named actors with background loops or one-shot asset sequences;
- play audio assets with or without waiting for completion;
- normalize missing or generic MIME types from file extensions;
- release only renderer skins owned by Asset Manager when registrations are removed.

The current-sprite block works with clones. A stage drawable ID of `0` is treated as valid. Project-local assets remain owned by the Scratch VM and are not written to IndexedDB.

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
```

An empty `RESOURCE_ID` reloads the external asset named by `NAME` from IndexedDB. Project-local identifiers support these shorthands:

- `costume:Sprite1` uses `NAME` as the costume name.
- `costume` uses `NAME` as the sprite name. It selects a costume with the same name, or the sprite's only costume. It fails when multiple costumes exist and none has that name.
- `backdrop` uses `NAME` as the stage backdrop name.
- `sound:Sprite1` uses `NAME` as the sprite sound name.
- `sound` uses `NAME` as the stage sound name.

Fully specified `costume:` and `sound:` identifiers use exactly one colon between the source target name and the costume or sound name. Colons cannot be used inside local sprite, costume, backdrop, or sound names. Commas are ordinary name characters. Double quotes and backslashes have no quoting or escaping role and are not interpreted specially.

## Registration errors

The `asset registration error type` and `asset registration error label` Reporter blocks expose the latest `register resource` failure to other scripts and variable monitors. Registration still reports its original error to TurboWarp. Starting a new registration clears both values; a failure then sets them again. Concurrent registrations use the most recently started registration for these Reporter values.

The type Reporter returns these stable tokens:

| Type | Label |
|---|---|
| `sprite` | Missing sprite name |
| `costume` | Missing or ambiguous costume name |
| `backdrop` | Missing backdrop name |
| `sound` | Missing sound name |
| `asset-name` | Invalid registration asset name |
| `resource-id` | Invalid resource identifier |
| `cache` | Asset name missing from the cache |
| `external` | External resource URL that failed |

Both Reporters return an empty string after a successful registration.

The old `load asset from URL [URL] or cache as [NAME]` opcode remains available to existing projects, but it is hidden from the block palette.

## Actor animation input

The actor animation blocks receive two ordinary string arguments:

```text
ASSETS = Fish1,Fish2,Fish3
DURATIONS = 0.5,0.5,1.0
```

`ASSETS` is a comma-separated string of registered image asset names. `DURATIONS` is a comma-separated string of positive display durations in seconds. The two strings must contain the same number of items.

Starting a new loop or sequence replaces the actor's existing animation. A sequence runs once in the background and leaves its final skin displayed. Setting the actor skin or explicitly stopping the animation cancels the active loop or sequence.

Projects saved with the earlier animation blocks may still provide the legacy `COSTUMES` argument internally. It is accepted as a compatibility alias, but new blocks and documentation use `ASSETS` because the values are registered image asset names rather than raw TurboWarp costume names.

### DSL mapping

The animation blocks map directly to the paper-theater DSL:

```text
action=Fish:loop:Fish1,Fish2:0.5,0.5
```

calls the loop block with `ACTOR=Fish`, `ASSETS=Fish1,Fish2`, and `DURATIONS=0.5,0.5`.

```text
action=Fish:loop:
```

maps to the stop block, or to the loop block with empty `ASSETS` and `DURATIONS`. The currently displayed skin remains unchanged.

```text
action=Urashima:sequence:Urashima-open1,Urashima-open2,Urashima-open3:1,2,3
```

starts a one-shot background sequence and returns immediately. After the final duration expires, the last skin remains displayed.

```text
action=Fish:setSkin:Fish3
```

stops the animation for `Fish` before applying `Fish3`.

Animation state is keyed by the unique ACTOR name. In tmpose-kamishibai, each Actor sprite clone receives its own ACTOR name, so an ACTOR name maps to exactly one VM target; duplicate ACTOR names are rejected as a project invariant violation. The resolved target is retained in the state only as the drawing destination and for deletion cleanup. Starting a new animation replaces that ACTOR's previous animation. ACTOR deletion, green flag, project stop, runtime disposal, and deleting all in-memory assets cancel the relevant timers.

## Blocks

<!-- BEGIN GENERATED BLOCKS -->

### `register resource [RESOURCE_ID] as asset [NAME]`

Registers an external URL, cached asset, sprite costume, stage backdrop, or project sound under one asset name.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `registerAsset` |
| `RESOURCE_ID` | String, default: `https://example.com/asset.png` |
| `NAME` | String, default: `asset1` |

### `asset registration error type`

Returns the stable type token for the most recent asset registration error, or an empty string when the latest registration succeeded.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `assetErrorType` |

### `asset registration error label`

Returns the missing or invalid name associated with the most recent asset registration error, or an empty string when the latest registration succeeded.

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

Unregisters one asset. Owned external renderer skins are released; project costumes and sounds are left unchanged.

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

Returns whether the named external or project-local asset is currently registered.

| Property | Value |
|---|---|
| Type | Boolean |
| Opcode | `isLoaded` |
| `NAME` | String, default: `asset1` |

### `set this sprite skin to asset [NAME]`

Applies a registered external image, sprite costume, or stage backdrop to the current sprite or clone.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setThisSpriteSkin` |
| `NAME` | String, default: `asset1` |

### `set [SPRITE] skin to asset [NAME] (compatibility)`

Stops any actor animation and applies a registered external image, sprite costume, or stage backdrop to a named sprite. This block is retained for compatibility.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setSpriteSkin` |
| `SPRITE` | String, default: `Sprite1` |
| `NAME` | String, default: `asset1` |

### `loop actor [ACTOR] through assets [ASSETS] for seconds [DURATIONS]`

Starts or replaces a background loop. ASSETS is a comma-separated string of registered image asset names, and DURATIONS is a comma-separated string of display durations. Empty ASSETS and DURATIONS stop the actor animation.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `startActorLoop` |
| `ACTOR` | String, default: `Sprite1` |
| `ASSETS` | String, default: `asset1,asset2` |
| `DURATIONS` | String, default: `0.5,0.5` |

### `play actor [ACTOR] through assets [ASSETS] for seconds [DURATIONS] once in background`

Starts or replaces a one-shot background sequence and returns immediately. ASSETS is a comma-separated string of registered image asset names, and DURATIONS is a comma-separated string of display durations.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `startActorSequence` |
| `ACTOR` | String, default: `Sprite1` |
| `ASSETS` | String, default: `asset1,asset2` |
| `DURATIONS` | String, default: `0.5,0.5` |

### `stop animation of actor [ACTOR]`

Stops the actor's current loop or sequence and leaves the currently displayed skin unchanged.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `stopActorAnimation` |
| `ACTOR` | String, default: `Sprite1` |

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

### `MIME type of asset [NAME]`

Returns the normalized MIME type of a registered external or project-local asset.

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
