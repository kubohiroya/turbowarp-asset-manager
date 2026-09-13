# TurboWarp-Asset-Manager

An IndexedDB-backed image, audio, and runtime-text asset manager for TurboWarp projects. It registers external files, project-local costumes/backdrops/sounds, and Temporary Variables text references for use from TurboWarp blocks or composition hosts.

## User Guide

For setup, safety notes, recipes, and the illustrated block guide, see the [English user guide](https://kubohiroya.github.io/turbowarp-asset-manager/) or [Japanese user guide](https://kubohiroya.github.io/turbowarp-asset-manager/ja/).

## What It Does

- registers image, audio, project asset, and runtime text resources by logical asset name;
- applies registered images or text to sprites, clones, or the stage;
- plays registered audio and supports actor animation sequences;
- offers a block-free Composition API for host extensions;
- validates SVG and remote binary inputs before use or cache writes;
- keeps story-scoped IndexedDB cache controls available for application shells.

## Choose an Integration

Use the Standalone extension when a TurboWarp project should load `dist/asset-manager.js` directly and expose Asset Manager blocks in the palette.

Use the Composition API when another unsandboxed extension or application shell should import `@kubohiroya/turbowarp-asset-manager/composition`, keep its registry private, and avoid adding Asset Manager blocks to the palette.

## Requirements and Safety

Standalone use requires TurboWarp Desktop or another TurboWarp environment that can load unsandboxed custom extensions. Runtime text rendering additionally requires Temporary Variables (`lmsTempVars2`) and Animated Text (`text`).

SVG input is reject-by-default, remote binary cache entries are size/content-type/SHA-256 verified before storage, and IndexedDB is treated as an auxiliary cache rather than a secrecy boundary.

Maintainers use Node.js 22 or later with pnpm through Corepack. The package version in `package.json` is the source of truth for install examples and CDN URLs.

## Installation

Download [`dist/asset-manager.js`](dist/asset-manager.js), then open TurboWarp Desktop and load it as a local custom extension. Enable **Run extension without sandbox** when prompted.

The built JavaScript file is committed to this repository so users do not need to install Node.js or run the build process.

The versioned npm package contains the same reviewed build:

```bash
pnpm add --save-exact @kubohiroya/turbowarp-asset-manager@0.15.0
```

Load `node_modules/@kubohiroya/turbowarp-asset-manager/dist/asset-manager.js`, or use the version-pinned CDN URL:

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-asset-manager@0.15.0/dist/asset-manager.js
```

## Quick Start

1. Load `dist/asset-manager.js` as an unsandboxed TurboWarp extension.
2. Register a resource with `register resource [RESOURCE_ID] as asset [NAME]`.
3. Use `show asset [NAME] on this sprite`, `set stage backdrop to asset [NAME]`, or the audio blocks to consume the asset.
4. Use the cache and deletion blocks when project lifecycle or storage policy requires explicit cleanup.

## Composition Example

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

## Integration Overview

- Standalone projects should read [Runtime and Standalone Contracts](docs/runtime-contracts.md) for resource identifiers, runtime text, diagnostics, actor animation, loading compatibility, and extension ID migration notes.
- Composition hosts should read [Composition API](docs/composition-api.md) for embedded assets, structured locators, audio voices, DOM image resources, SVG validation, story-scoped caches, verified remote binaries, binary bundles, and session-only binary backing.
- Block users and documentation maintainers should read [Block Reference](docs/block-reference.md) for the generated block table.

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

`src/block-definitions.json` is the canonical block API source. Regenerate block documentation after changing it:

```bash
pnpm run docs
```

The build produces `dist/asset-manager.js`, `dist/extension-manifest.json`, `dist/composition.js`, and `dist/types/composition.d.ts`. The deterministic manifest records the extension ID, every opcode and block type, and each argument ID, type, and menu reference for compatibility checks by tools such as `sb3-toolchain`. Commit rebuilt artifacts whenever extension, block metadata, or Composition source changes.

## Release

Run the local release checks before publishing:

```bash
pnpm run pack:check
pnpm run release:check
```

The npm package archive must include README, LICENSE, the Standalone bundle, the extension API manifest, the Composition bundle, and Composition type declarations.

## License

SPDX-License-Identifier: MPL-2.0
