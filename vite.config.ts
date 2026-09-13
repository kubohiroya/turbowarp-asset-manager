import {defineConfig} from 'vite';
import {turboWarpExtension} from '@kubohiroya/vite-plugin-turbowarp-extension';
import {extensionManifestPlugin} from '@kubohiroya/turbowarp-extension-manifest';
import definitions from './src/block-definitions.json' with {type: 'json'};

const EXTENSION_ID = 'kubohiroyaassetmanager';

export default defineConfig({
  plugins: [
    turboWarpExtension({
      id: EXTENSION_ID,
      name: 'Asset Manager',
      description: 'Register, cache, display, and play image, audio, and runtime text assets in TurboWarp.',
      author: 'Hiroya Kubo',
      license: 'MPL-2.0',
      fileName: 'asset-manager.js'
    }),
    extensionManifestPlugin({
      id: EXTENSION_ID,
      definitions
    })
  ]
});
