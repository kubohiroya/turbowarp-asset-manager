# TurboWarp Asset Manager

An IndexedDB-backed image and audio asset manager for TurboWarp projects.

## Features

- load external image and audio assets;
- cache binary data in IndexedDB;
- refresh the cache whenever a URL is explicitly supplied;
- apply image assets to the current sprite, a named sprite, or the stage;
- play audio assets with or without waiting for completion;
- normalize missing or generic MIME types from file extensions;
- release renderer skins when in-memory assets are removed.

The current-sprite block works with clones. A stage drawable ID of `0` is treated as valid.

## Blocks

<!-- BEGIN GENERATED BLOCKS -->

### `load asset from URL [URL] or cache as [NAME]`

Loads an image or audio asset from the supplied URL, or from IndexedDB when the URL is empty.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `loadAsset` |
| `URL` | String, default: `https://example.com/asset.png` |
| `NAME` | String, default: `asset1` |

### `delete asset [NAME] from memory`

Removes one loaded asset from memory and releases any associated renderer skin.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `deleteMemoryAsset` |
| `NAME` | String, default: `asset1` |

### `delete all assets from memory`

Removes all loaded assets from memory and stops tracked audio playback.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `deleteAllMemoryAssets` |

### `delete asset [NAME] from cache`

Deletes one named asset from the IndexedDB cache.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `deleteCachedAsset` |
| `NAME` | String, default: `asset1` |

### `delete all assets from cache`

Clears all assets from the IndexedDB cache.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `deleteAllCachedAssets` |

### `asset [NAME] is loaded`

Returns whether the named asset is currently loaded in memory.

| Property | Value |
|---|---|
| Type | Boolean |
| Opcode | `isLoaded` |
| `NAME` | String, default: `asset1` |

### `set this sprite skin to asset [NAME]`

Applies a loaded image asset to the current sprite or clone.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setThisSpriteSkin` |
| `NAME` | String, default: `asset1` |

### `set [SPRITE] skin to asset [NAME] (compatibility)`

Applies a loaded image asset to a named sprite. This block is retained for compatibility.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setSpriteSkin` |
| `SPRITE` | String, default: `Sprite1` |
| `NAME` | String, default: `asset1` |

### `set stage backdrop to asset [NAME]`

Applies a loaded image asset to the stage drawable.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setStageSkin` |
| `NAME` | String, default: `background1` |

### `play asset [NAME] as sound`

Starts playback of a loaded audio asset without waiting for completion.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `playSound` |
| `NAME` | String, default: `sound1` |

### `play asset [NAME] as sound until done`

Plays a loaded audio asset and waits until playback ends or fails.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `playSoundUntilDone` |
| `NAME` | String, default: `sound1` |

### `MIME type of asset [NAME]`

Returns the normalized MIME type of a loaded asset.

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

The build produces `dist/asset-manager.js`.

This extension accesses TurboWarp VM and renderer internals and must be loaded unsandboxed.

## License

MPL-2.0
