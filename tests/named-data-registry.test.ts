import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  getNamedDataRegistry,
  type NamedDataReference
} from '@kubohiroya/turbowarp-named-data/composition';
import {AssetManagerExtension} from '../src/extension.js';

describe('canonical named-data registry integration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('registers the existing asset registry persistently and clears only open session bodies', async () => {
    const listeners = new Map<string, Set<() => void>>();
    const runtime = {
      renderer: {},
      targets: [],
      on(event: string, listener: () => void) {
        const entries = listeners.get(event) ?? new Set<() => void>();
        entries.add(listener);
        listeners.set(event, entries);
      },
      off(event: string, listener: () => void) {
        listeners.get(event)?.delete(listener);
      }
    };
    vi.stubGlobal('Scratch', {
      vm: {runtime},
      extensions: {unsandboxed: true, register: vi.fn()},
      BlockType: {COMMAND: 'command', BOOLEAN: 'boolean', REPORTER: 'reporter'},
      ArgumentType: {STRING: 'string', NUMBER: 'number'},
      translate: (text: string) => text
    });

    const extension = new AssetManagerExtension({
      ENABLE_LIVE_ASSET_REPLACEMENT: false,
      ENABLE_STRICT_ASSET_KIND_REPLACEMENT: false,
      NAMED_ASSET_BODY_PROVIDER: true
    });
    await extension.registerEmbeddedAsset({
      name: 'payload',
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png'
    });
    const registry = getNamedDataRegistry(runtime);
    const reference: NamedDataReference = {
      namespace: 'asset',
      name: 'payload',
      kind: 'asset',
      scope: 'project'
    };
    const project = {};

    expect(extension.getNamedDataProvider()).toBe(extension.getNamedBodyProvider());
    expect(registry?.canResolve(reference, 'raw')).toBe(true);
    await expect(registry?.stat(reference, 'raw', {project})).resolves.toMatchObject({
      reference,
      nativeRepresentation: 'raw',
      representation: 'raw',
      mediaType: 'image/png',
      byteLength: 3,
      digest: 'sha256-039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
      revision: '1',
      replayable: true
    });
    const opened = await registry?.openBody(reference, 'raw', {project});
    expect(opened?.body).toEqual(new Uint8Array([1, 2, 3]));

    for (const listener of listeners.get('PROJECT_STOP_ALL') ?? []) listener();
    await opened?.release('complete');
    expect(registry?.canResolve(reference, 'raw')).toBe(true);
    await expect(registry?.stat(reference, 'raw', {project})).resolves.toMatchObject({byteLength: 3});
  });
});
