# TurboWarp Asset Manager

An IndexedDB-backed image, audio, and runtime-text asset manager for TurboWarp projects. It can also register costumes, stage backdrops, sounds, and Temporary Variables runtime-variable references used by the current `.sb3` project.

## Installation

Download [`dist/asset-manager.js`](dist/asset-manager.js), then open TurboWarp Desktop and load it as a local custom extension. Enable **Run extension without sandbox** when prompted.

The built JavaScript file is committed to this repository so that users do not need to install Node.js or run the build process.

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
- release only renderer skins owned by Asset Manager when registrations are removed.

The current-sprite block works with clones. A stage drawable ID of `0` is treated as valid. Project-local assets remain owned by the Scratch VM and are not written to IndexedDB. Text assets store only a runtime-variable name; they never copy or cache its value.

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

Registering a text asset does not require the runtime variable to exist yet. The `set text asset [NAME] to [VALUE]` block stores the value in the internal `text:<NAME>` namespace. Each time the asset is shown, Asset Manager reads the latest value and style through `lmsTempVars2`, reapplies the complete style, and invokes Animated Text for the destination sprite or clone. A missing runtime variable therefore displays an empty string. Missing extension dependencies are reported when a text value or style is set, or when the text asset is shown, rather than when it is registered.

The `set text asset [NAME] style [PROPERTY] to [VALUE]` block changes one style property at a time. An empty value resets that property to its default.

| Property | Accepted values | Default |
|---|---|---|
| `animation` | `none`, `type`, `typing`, `rainbow`, `zoom`, `shake` | `none` |
| `font` | Any non-empty font name accepted by Animated Text | `Handwriting` |
| `color` | `#rgb` or `#rrggbb` | `#575e75` |
| `width` | Positive number | Current stage width |
| `align` | `left`, `center`, `right` | `center` |

`typing` is a DSL-friendly alias for Animated Text's `type` value. The full style is reapplied before every display so that a previous text asset or sprite cannot leak its style into the next one. Animated display starts in the background; the `show` action can immediately continue to its existing position and size steps without waiting for the animation to finish.

The existing paper-theater `show` action can use text assets, so it retains the same position and size arguments without adding another DSL action:

```text
asset=Narration,text
actor=Prompt,Narration
text=Narration:むかし　むかし、あるところに...
textStyle=Narration:animation:typing
textStyle=Narration:font:Sans Serif
textStyle=Narration:color:#575e75
textStyle=Narration:width:200
textStyle=Narration:align:left
action=Prompt:show:Narration:0,0,100
```

The actor name in `actor=` and the target name in `action=` must match (`Prompt` in this example). The second `actor=` item, each `text=` / `textStyle=` item, and the `show` asset item all name the registered text asset (`Narration`). The tmpose-kamishibai integration should map `text=` and `textStyle=` to Asset Manager's two setter blocks; Asset Manager itself does not parse the DSL.

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

Animation state is keyed by the unique ACTOR name. In tmpose-kamishibai, each Actor sprite clone receives its own ACTOR name, so an ACTOR name maps to exactly one VM target; duplicate ACTOR names are rejected as a project invariant violation. The resolved target is retained in the state only as the drawing destination and for deletion cleanup. Starting a new animation replaces that ACTOR's previous animation. ACTOR deletion, green flag, project stop, runtime disposal, and deleting all in-memory assets cancel the relevant timers.

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
