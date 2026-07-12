import {defineConfig} from 'vite';
import {turboWarpExtension} from '@kubohiroya/vite-plugin-turbowarp-extension';

export default defineConfig({
  plugins: [
    turboWarpExtension({
      id: 'twAssetManager',
      name: 'Asset Manager',
      description: 'Register, cache, display, and play external or project-local image and audio assets in TurboWarp.',
      author: 'Hiroya Kubo',
      license: 'MPL-2.0',
      fileName: 'asset-manager.js'
    })
  ]
});
