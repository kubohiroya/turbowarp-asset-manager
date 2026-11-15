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

describe('project reload', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the provider, the registry binding and DOM image lifecycle for the next project', async () => {
    const listeners = new Map<string, Set<() => void>>();
    const emit = (event: string): void => {
      for (const listener of [...(listeners.get(event) ?? [])]) listener();
    };
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
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({width: 1, height: 1, close: vi.fn()})));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:payload');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const extension = new AssetManagerExtension({
      ENABLE_LIVE_ASSET_REPLACEMENT: false,
      ENABLE_STRICT_ASSET_KIND_REPLACEMENT: false,
      NAMED_ASSET_BODY_PROVIDER: true
    });
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const capability = extension.getDOMImageCapability();
    const registry = getNamedDataRegistry(runtime)!;
    const reference: NamedDataReference = {
      namespace: 'asset',
      name: 'payload',
      kind: 'asset',
      scope: 'project'
    };

    emit('RUNTIME_DISPOSED');
    emit('PROJECT_LOADED');

    await extension.registerEmbeddedAsset({
      name: 'payload',
      bytes: png,
      mimeType: 'image/png'
    });
    expect(registry.canResolve(reference, 'raw')).toBe(true);
    const opened = await registry.openBody(reference, 'raw', {project: {}});
    expect(opened.body).toEqual(png);

    const sessionProvider = {
      namespace: 'reload-probe',
      kind: 'asset',
      canResolve: () => true,
      stat: vi.fn(),
      openBody: vi.fn(),
      release: vi.fn()
    };
    registry.registerProvider(sessionProvider as never);
    const probe = {namespace: 'reload-probe', name: 'x', kind: 'asset', scope: 'project'};
    expect(registry.canResolve(probe as NamedDataReference, 'raw')).toBe(true);

    const resource = await capability.resolveDOMImageResource('payload');
    emit('PROJECT_STOP_ALL');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(registry.canResolve(probe as NamedDataReference, 'raw')).toBe(false);
    expect(resource.released).toBe(true);
  });
});
