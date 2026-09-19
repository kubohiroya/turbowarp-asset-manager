import type {Plugin} from 'vite';

/** Keep generated bundles free of mixed space/tab indentation rejected by git diff --check. */
export function normalizeBundleIndentation(): Plugin {
  return {
    name: 'normalize-bundle-indentation',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        output.code = output.code.replace(
          /^( +)(\t+)/gmu,
          (_match, spaces: string, tabs: string) => `${spaces}${'  '.repeat(tabs.length)}`
        );
      }
    }
  };
}
