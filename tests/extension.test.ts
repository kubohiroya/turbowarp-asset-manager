import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  AssetManagerExtension,
  guessMimeType,
  normalizeMimeType,
  parseResourceIdentifier
} from '../src/extension.js';

interface TestExternalAsset {
  kind: 'external';
  name: string;
  url: string;
  mimeType: string;
  data: ArrayBuffer;
  cachedAt: number;
  skinId: number | null;
}

interface TestExtensionInternals {
  externalAssets: Map<string, TestExternalAsset>;
  assetRegistry: Map<string, 'external' | 'costume' | 'sound'>;
  fetchAndCache(url: string, name: string): Promise<TestExternalAsset>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, resolve, reject};
}

describe('guessMimeType', () => {
  it('recognizes image and audio extensions', () => {
    expect(guessMimeType('https://example.com/a.PNG?x=1')).toBe('image/png');
    expect(guessMimeType('sound.mp3')).toBe('audio/mpeg');
  });
});

describe('normalizeMimeType', () => {
  it('removes MIME parameters', () => {
    expect(normalizeMimeType('audio/mpeg; charset=binary', 'sound.mp3')).toBe('audio/mpeg');
  });

  it('uses the file extension for generic binary MIME types', () => {
    expect(normalizeMimeType('application/octet-stream', 'image.svg')).toBe('image/svg+xml');
  });
});

describe('parseResourceIdentifier', () => {
  it('recognizes URLs and an empty cache resource', () => {
    expect(parseResourceIdentifier('https://example.com/a.png')).toEqual({
      kind: 'external',
      url: 'https://example.com/a.png'
    });
    expect(parseResourceIdentifier('')).toEqual({kind: 'cache'});
  });

  it('recognizes project-local resource schemes', () => {
    expect(parseResourceIdentifier('costume:Hero:normal')).toEqual({
      kind: 'costume', spriteName: 'Hero', costumeName: 'normal'
    });
    expect(parseResourceIdentifier('backdrop:forest')).toEqual({
      kind: 'backdrop', backdropName: 'forest'
    });
    expect(parseResourceIdentifier('sound:@stage:opening')).toEqual({
      kind: 'sound', spriteName: '@stage', soundName: 'opening'
    });
  });

  it('allows commas as ordinary characters without quoting or escaping', () => {
    expect(parseResourceIdentifier('costume:人物,主人公:通常,正面')).toEqual({
      kind: 'costume', spriteName: '人物,主人公', costumeName: '通常,正面'
    });
  });

  it('uses a supplied fallback for an omitted costume name', () => {
    expect(parseResourceIdentifier('costume:Hero', 'normal')).toEqual({
      kind: 'costume', spriteName: 'Hero', costumeName: 'normal'
    });
  });

  it('fills omitted local resource parts from the registered asset name', () => {
    expect(parseResourceIdentifier('costume', 'Turtle')).toEqual({
      kind: 'costume', spriteName: 'Turtle', costumeName: null
    });
    expect(parseResourceIdentifier('backdrop', 'Stars')).toEqual({
      kind: 'backdrop', backdropName: 'Stars'
    });
    expect(parseResourceIdentifier('sound:Urashima', 'Rip')).toEqual({
      kind: 'sound', spriteName: 'Urashima', soundName: 'Rip'
    });
    expect(parseResourceIdentifier('sound', 'Guitar Chords2')).toEqual({
      kind: 'sound', spriteName: '@stage', soundName: 'Guitar Chords2'
    });
  });

  it('rejects the old comma separator and ambiguous colon usage', () => {
    expect(() => parseResourceIdentifier('ftp://example.com/a.png')).toThrow('Unsupported resource scheme');
    expect(() => parseResourceIdentifier('costume:Hero,normal')).toThrow('exactly one colon');
    expect(() => parseResourceIdentifier('costume:Hero:', 'normal')).toThrow('asset name is empty');
    expect(() => parseResourceIdentifier('costume:Hero:normal:alternate')).toThrow('exactly one colon');
    expect(() => parseResourceIdentifier('sound:Hero')).toThrow('exactly one colon');
    expect(() => parseResourceIdentifier('backdrop:')).toThrow('Backdrop name is empty');
    expect(() => parseResourceIdentifier('backdrop:forest:night')).toThrow('must not contain a colon');
  });
});

describe('project-local assets', () => {
  const updateDrawableSkinId = vi.fn();
  const destroySkin = vi.fn();
  const playSound = vi.fn(() => Promise.resolve());

  const soundBank = {playSound};
  const sprite: TurboWarpTarget = {
    id: 'sprite-id',
    isStage: false,
    isOriginal: true,
    drawableID: 7,
    sprite: {
      name: 'Hero',
      costumes: [{name: 'normal', assetId: 'costume-asset', skinId: 42, dataFormat: 'png'}],
      sounds: [{name: 'hello', assetId: 'sound-asset', soundId: 'sound-id', dataFormat: 'wav'}],
      soundBank
    }
  };
  const turtle: TurboWarpTarget = {
    id: 'turtle-id',
    isStage: false,
    isOriginal: true,
    drawableID: 8,
    sprite: {
      name: 'Turtle',
      costumes: [{name: 'walk', assetId: 'turtle-costume', skinId: 43, dataFormat: 'svg'}],
      sounds: [],
      soundBank
    }
  };
  const twin: TurboWarpTarget = {
    id: 'twin-id',
    isStage: false,
    isOriginal: true,
    drawableID: 9,
    sprite: {
      name: 'Twin',
      costumes: [
        {name: 'idle', assetId: 'twin-idle', skinId: 44, dataFormat: 'png'},
        {name: 'Twin', assetId: 'twin-named', skinId: 45, dataFormat: 'png'}
      ],
      sounds: [],
      soundBank
    }
  };
  const ambiguous: TurboWarpTarget = {
    id: 'ambiguous-id',
    isStage: false,
    isOriginal: true,
    drawableID: 10,
    sprite: {
      name: 'Ambiguous',
      costumes: [
        {name: 'one', assetId: 'ambiguous-one', skinId: 46, dataFormat: 'png'},
        {name: 'two', assetId: 'ambiguous-two', skinId: 47, dataFormat: 'png'}
      ],
      sounds: [],
      soundBank
    }
  };
  const stage: TurboWarpTarget = {
    id: 'stage-id',
    isStage: true,
    isOriginal: true,
    drawableID: 0,
    sprite: {
      name: 'Stage',
      costumes: [
        {name: 'forest', assetId: 'background-asset', skinId: 99, dataFormat: 'svg'},
        {name: 'Stars', assetId: 'stars-asset', skinId: 100, dataFormat: 'svg'}
      ],
      sounds: [
        {name: 'opening', assetId: 'stage-sound-asset', soundId: 'stage-sound-id', dataFormat: 'mp3'},
        {name: 'Guitar Chords2', assetId: 'guitar-asset', soundId: 'guitar-sound-id', dataFormat: 'wav'}
      ],
      soundBank
    }
  };
  const urashima: TurboWarpTarget = {
    id: 'urashima-id',
    isStage: false,
    isOriginal: true,
    drawableID: 11,
    sprite: {
      name: 'Urashima',
      costumes: [],
      sounds: [{name: 'Rip', assetId: 'rip-asset', soundId: 'rip-sound-id', dataFormat: 'wav'}],
      soundBank
    }
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    updateDrawableSkinId.mockClear();
    destroySkin.mockClear();
    playSound.mockClear();

    vi.stubGlobal('Scratch', {
      vm: {
        runtime: {
          renderer: {
            createSVGSkin: vi.fn(() => 1),
            createBitmapSkin: vi.fn(() => 2),
            destroySkin,
            updateDrawableSkinId
          },
          targets: [stage, sprite, turtle, twin, ambiguous, urashima],
          requestRedraw: vi.fn()
        }
      },
      extensions: {unsandboxed: true, register: vi.fn()},
      BlockType: {COMMAND: 'command', BOOLEAN: 'boolean', REPORTER: 'reporter'},
      ArgumentType: {STRING: 'string'},
      translate: (text: string) => text
    });
  });

  it('keeps the legacy opcode hidden and exposes the resource registration opcode', () => {
    const extension = new AssetManagerExtension();
    const blocks = extension.getInfo().blocks;
    expect(blocks.find((block) => block.opcode === 'loadAsset')).toMatchObject({hideFromPalette: true});
    expect(blocks.find((block) => block.opcode === 'registerAsset')).toBeDefined();
  });

  it('allows project images to register before renderer skins are initialized', async () => {
    const extension = new AssetManagerExtension();
    const heroCostume = sprite.sprite?.costumes[0];
    const forestBackdrop = stage.sprite?.costumes[0];
    if (!heroCostume || !forestBackdrop) throw new Error('Test costumes are missing.');

    delete heroCostume.skinId;
    await extension.registerAsset({RESOURCE_ID: 'costume:Hero:normal', NAME: 'hero-lazy'});
    heroCostume.skinId = 42;
    await extension.setStageSkin({NAME: 'hero-lazy'});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(0, 42);

    delete forestBackdrop.skinId;
    await extension.registerAsset({RESOURCE_ID: 'backdrop:forest', NAME: 'forest-lazy'});
    forestBackdrop.skinId = 99;
    await extension.setThisSpriteSkin({NAME: 'forest-lazy'}, {target: sprite});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 99);
  });

  it('borrows costume and backdrop skins without destroying them', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'costume:Hero:normal', NAME: 'hero'});
    await extension.setStageSkin({NAME: 'hero'});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(0, 42);

    extension.deleteMemoryAsset({NAME: 'hero'});
    expect(destroySkin).not.toHaveBeenCalled();

    await extension.registerAsset({RESOURCE_ID: 'backdrop:forest', NAME: 'forest'});
    await extension.setThisSpriteSkin({NAME: 'forest'}, {target: sprite});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 99);
    expect(extension.getAssetMimeType({NAME: 'forest'})).toBe('image/svg+xml');
  });

  it('uses the registered asset name when the costume name is omitted', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'costume:Hero', NAME: 'normal'});
    await extension.setStageSkin({NAME: 'normal'});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(0, 42);

    await expect(extension.registerAsset({RESOURCE_ID: 'costume:', NAME: 'normal'}))
      .rejects.toThrow('costume source name is empty');
  });

  it('resolves bare costume resources only when the choice is unambiguous', async () => {
    const extension = new AssetManagerExtension();

    await extension.registerAsset({RESOURCE_ID: 'costume', NAME: 'Turtle'});
    await extension.setStageSkin({NAME: 'Turtle'});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(0, 43);

    await extension.registerAsset({RESOURCE_ID: 'costume', NAME: 'Twin'});
    await extension.setStageSkin({NAME: 'Twin'});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(0, 45);

    await expect(extension.registerAsset({RESOURCE_ID: 'costume', NAME: 'Ambiguous'}))
      .rejects.toThrow('Costume shorthand is ambiguous');
  });

  it('resolves bare backdrop resources from the registered asset name', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'backdrop', NAME: 'Stars'});
    await extension.setThisSpriteSkin({NAME: 'Stars'}, {target: sprite});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 100);
  });

  it('plays sprite and stage sounds through the owning sound bank', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'sound:Hero:hello', NAME: 'voice'});
    await extension.playSoundUntilDone({NAME: 'voice'});
    expect(playSound).toHaveBeenLastCalledWith(sprite, 'sound-id');
    expect(extension.getAssetMimeType({NAME: 'voice'})).toBe('audio/wav');

    await extension.registerAsset({RESOURCE_ID: 'sound:@stage:opening', NAME: 'opening'});
    await extension.playSoundUntilDone({NAME: 'opening'});
    expect(playSound).toHaveBeenLastCalledWith(stage, 'stage-sound-id');
  });

  it('resolves omitted sprite and stage sound names from the registered asset name', async () => {
    const extension = new AssetManagerExtension();

    await extension.registerAsset({RESOURCE_ID: 'sound:Urashima', NAME: 'Rip'});
    await extension.playSoundUntilDone({NAME: 'Rip'});
    expect(playSound).toHaveBeenLastCalledWith(urashima, 'rip-sound-id');

    await extension.registerAsset({RESOURCE_ID: 'sound', NAME: 'Guitar Chords2'});
    await extension.playSoundUntilDone({NAME: 'Guitar Chords2'});
    expect(playSound).toHaveBeenLastCalledWith(stage, 'guitar-sound-id');
  });

  it('keeps the newest external registration when requests finish out of order', async () => {
    const extension = new AssetManagerExtension();
    const internals = extension as unknown as TestExtensionInternals;
    const slow = deferred<TestExternalAsset>();
    const fast = deferred<TestExternalAsset>();
    vi.spyOn(internals, 'fetchAndCache').mockImplementation((url) =>
      url.includes('slow') ? slow.promise : fast.promise
    );

    const slowRegistration = extension.registerAsset({
      RESOURCE_ID: 'https://example.com/slow.png', NAME: 'shared'
    });
    const fastRegistration = extension.registerAsset({
      RESOURCE_ID: 'https://example.com/fast.png', NAME: 'shared'
    });

    fast.resolve({
      kind: 'external', name: 'shared', url: 'https://example.com/fast.png',
      mimeType: 'image/png', data: new ArrayBuffer(0), cachedAt: 2, skinId: null
    });
    await fastRegistration;
    slow.resolve({
      kind: 'external', name: 'shared', url: 'https://example.com/slow.png',
      mimeType: 'image/png', data: new ArrayBuffer(0), cachedAt: 1, skinId: null
    });
    await slowRegistration;

    expect(internals.externalAssets.get('shared')?.url).toBe('https://example.com/fast.png');
  });

  it('invalidates a pending external registration when the name is unregistered', async () => {
    const extension = new AssetManagerExtension();
    const internals = extension as unknown as TestExtensionInternals;
    const pending = deferred<TestExternalAsset>();
    vi.spyOn(internals, 'fetchAndCache').mockReturnValue(pending.promise);

    const registration = extension.registerAsset({
      RESOURCE_ID: 'https://example.com/pending.png', NAME: 'pending'
    });
    extension.deleteMemoryAsset({NAME: 'pending'});
    pending.resolve({
      kind: 'external', name: 'pending', url: 'https://example.com/pending.png',
      mimeType: 'image/png', data: new ArrayBuffer(0), cachedAt: 1, skinId: null
    });
    await registration;

    expect(extension.isLoaded({NAME: 'pending'})).toBe(false);
  });

  it('cleans up external audio when play rejects', async () => {
    const extension = new AssetManagerExtension();
    const internals = extension as unknown as TestExtensionInternals;
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test-audio'),
      revokeObjectURL
    });
    vi.stubGlobal('Audio', class {
      currentTime = 0;
      addEventListener = vi.fn();
      pause = vi.fn();
      play = vi.fn(() => Promise.reject(new Error('play blocked')));
      constructor(_url: string) {}
    });
    internals.externalAssets.set('audio', {
      kind: 'external', name: 'audio', url: 'https://example.com/audio.mp3',
      mimeType: 'audio/mpeg', data: new ArrayBuffer(0), cachedAt: 1, skinId: null
    });
    internals.assetRegistry.set('audio', 'external');

    await expect(extension.playSoundUntilDone({NAME: 'audio'})).rejects.toThrow('play blocked');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-audio');

    revokeObjectURL.mockClear();
    await extension.playSound({NAME: 'audio'});
    await Promise.resolve();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-audio');
  });

  it('reports explicit type mismatches', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'backdrop:forest', NAME: 'forest'});
    await expect(extension.playSound({NAME: 'forest'})).rejects.toThrow('Asset is not audio');
  });
});
