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
- play audio assets with or without waiting for completion;
- normalize missing or generic MIME types from file extensions;
- release only renderer skins owned by Asset Manager when registrations are removed.

The current-sprite block works with clones. A stage drawable ID of `0` is treated as valid. Project-local assets remain owned by the Scratch VM and are not written to IndexedDB.

## Resource identifiers

The `register resource [RESOURCE_ID] as asset [NAME]` block accepts the following forms:

```text
https://example.com/asset.png
costume:Sprite1:costume1
backdrop:backdrop1
sound:Sprite1:sound1
sound:@stage:stage-sound1
```

An empty `RESOURCE_ID` reloads the external asset named by `NAME` from IndexedDB. In `costume:` and `sound:` identifiers, exactly one colon separates the source target name from the costume or sound name. Colons cannot be used inside local sprite, costume, backdrop, or sound names. Commas are ordinary name characters. Double quotes and backslashes have no quoting or escaping role and are not interpreted specially.

The old `load asset from URL [URL] or cache as [NAME]` opcode remains available to existing projects, but it is hidden from the block palette.

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

Unregisters all assets, releases owned external renderer skins, and stops tracked external audio playback.

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

Applies a registered external image, sprite costume, or stage backdrop to a named sprite. This block is retained for compatibility.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setSpriteSkin` |
| `SPRITE` | String, default: `Sprite1` |
| `NAME` | String, default: `asset1` |

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
