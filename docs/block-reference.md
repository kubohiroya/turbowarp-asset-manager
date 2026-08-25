# Block Reference

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
