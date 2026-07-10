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

## Development

```bash
npm install
npm run check
```

The build produces `dist/asset-manager.js`.

This extension accesses TurboWarp VM and renderer internals and must be loaded unsandboxed.

## License

MPL-2.0
