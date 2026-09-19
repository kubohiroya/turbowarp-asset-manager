import {defineConfig} from 'vite';
import {normalizeBundleIndentation} from './vite-indent-plugin.js';

export default defineConfig({
  plugins: [normalizeBundleIndentation()],
  build: {
    target: 'es2022',
    minify: false,
    sourcemap: false,
    emptyOutDir: false,
    lib: {
      entry: 'src/composition.ts',
      formats: ['es'],
      fileName: () => 'composition.js'
    }
  }
});
