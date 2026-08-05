import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  AssetManagerExtension,
  EXTENSION_DOCS_URI,
  EXTENSION_VERSION,
  guessMimeType,
  normalizeMimeType,
  parseResourceIdentifier,
  validateProjectAssetAddress
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

type TestCacheRecord = Omit<TestExternalAsset, 'kind' | 'skinId'> & {generation?: number};

interface TestExtensionInternals {
  externalAssets: Map<string, TestExternalAsset>;
  textAssets: Map<string, {kind: 'text'; name: string; runtimeVariableName: string}>;
  assetRegistry: Map<string, 'external' | 'costume' | 'backdrop' | 'sound' | 'text'>;
  displayedAssets: Map<string, {assetName: string; assetKind: string; skinId: number | null}>;
  playingAudio: Map<HTMLAudioElement, string>;
  fetchExternalAsset(url: string, name: string): Promise<TestExternalAsset>;
  cacheGet(name: string): Promise<TestCacheRecord | null>;
  cachePut(record: TestCacheRecord): Promise<void>;
  restoreCacheIfGeneration(
    name: string,
    generation: number,
    previous: TestCacheRecord | null
  ): Promise<void>;
}

const ALL_FEATURES = {
  ENABLE_LIVE_ASSET_REPLACEMENT: true,
  ENABLE_STRICT_ASSET_KIND_REPLACEMENT: true
} as const;

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
    expect(parseResourceIdentifier('text:Narration')).toEqual({
      kind: 'text', runtimeVariableName: 'text:Narration'
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
    expect(parseResourceIdentifier('text', 'Narration')).toEqual({
      kind: 'text', runtimeVariableName: 'text:Narration'
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
    expect(() => parseResourceIdentifier('text:')).toThrow('Text variable name is empty');
    expect(() => parseResourceIdentifier('text:chapter:title')).toThrow('must not contain a colon');
    expect(() => parseResourceIdentifier('text', 'chapter:title')).toThrow('must not contain a colon');
  });
});

describe('project-local assets', () => {
  const updateDrawableSkinId = vi.fn();
  const rendererDrawables: Array<{skin: {id: number}} | undefined> = [];
  const destroySkin = vi.fn();
  const playSound = vi.fn(() => Promise.resolve());
  const stopSound = vi.fn();
  const stopAllSounds = vi.fn();
  const setAnimatedText = vi.fn();
  const animateText = vi.fn();
  const setTextFont = vi.fn();
  const setTextColor = vi.fn();
  const setTextWidth = vi.fn();
  const setTextOutlineWidth = vi.fn();
  const setTextOutlineColor = vi.fn();
  const animatedTextOpcodes = new Map<string, ReturnType<typeof vi.fn>>([
    ['text_setText', setAnimatedText],
    ['text_animateText', animateText],
    ['text_setFont', setTextFont],
    ['text_setColor', setTextColor],
    ['text_setWidth', setTextWidth],
    ['text_setOutlineWidth', setTextOutlineWidth],
    ['text_setOutlineColor', setTextOutlineColor]
  ]);
  const getOpcodeFunction = vi.fn((opcode: string) => animatedTextOpcodes.get(opcode));
  const runtimeVariables = new Map<string, unknown>();
  const getRuntimeVariable = vi.fn(({VAR}: {VAR: unknown}) => runtimeVariables.get(String(VAR)) ?? '');
  const setRuntimeVariable = vi.fn(({VAR, STRING}: {VAR: unknown; STRING: unknown}) => {
    runtimeVariables.set(String(VAR), STRING);
  });
  const setSpriteSize = vi.fn();
  const setTurtleSize = vi.fn();
  const setTwinSize = vi.fn();
  const setAmbiguousSize = vi.fn();
  const setStageSize = vi.fn();
  const setUrashimaSize = vi.fn();

  const soundBank = {playSound, stop: stopSound, stopAllSounds};
  const sprite: TurboWarpTarget = {
    id: 'sprite-id',
    isStage: false,
    isOriginal: true,
    drawableID: 7,
    size: 250,
    setSize: setSpriteSize,
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
    size: 175,
    setSize: setTurtleSize,
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
    size: 100,
    setSize: setTwinSize,
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
    size: 100,
    setSize: setAmbiguousSize,
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
    size: 100,
    setSize: setStageSize,
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
    size: 100,
    setSize: setUrashimaSize,
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
    sprite.size = 250;
    turtle.size = 175;
    twin.size = 100;
    ambiguous.size = 100;
    stage.size = 100;
    urashima.size = 100;
    updateDrawableSkinId.mockClear();
    rendererDrawables.length = 0;
    updateDrawableSkinId.mockImplementation((drawableId: number, skinId: number) => {
      rendererDrawables[drawableId] = {skin: {id: skinId}};
    });
    destroySkin.mockClear();
    playSound.mockClear();
    stopSound.mockClear();
    stopAllSounds.mockClear();
    setAnimatedText.mockClear();
    animateText.mockClear();
    setTextFont.mockClear();
    setTextColor.mockClear();
    setTextWidth.mockClear();
    setTextOutlineWidth.mockClear();
    setTextOutlineColor.mockClear();
    getOpcodeFunction.mockClear();
    getOpcodeFunction.mockImplementation((opcode: string) => animatedTextOpcodes.get(opcode));
    getRuntimeVariable.mockClear();
    setRuntimeVariable.mockClear();
    runtimeVariables.clear();
    setSpriteSize.mockClear();
    setTurtleSize.mockClear();
    setTwinSize.mockClear();
    setAmbiguousSize.mockClear();
    setStageSize.mockClear();
    setUrashimaSize.mockClear();
    setSpriteSize.mockImplementation((size: number) => { sprite.size = size; });
    setTurtleSize.mockImplementation((size: number) => { turtle.size = size; });
    setTwinSize.mockImplementation((size: number) => { twin.size = size; });
    setAmbiguousSize.mockImplementation((size: number) => { ambiguous.size = size; });
    setStageSize.mockImplementation((size: number) => { stage.size = size; });
    setUrashimaSize.mockImplementation((size: number) => { urashima.size = size; });

    vi.stubGlobal('Scratch', {
      vm: {
        runtime: {
          renderer: {
            _allDrawables: rendererDrawables,
            createSVGSkin: vi.fn(() => 1),
            createBitmapSkin: vi.fn(() => 2),
            destroySkin,
            updateDrawableSkinId
          },
          targets: [stage, sprite, turtle, twin, ambiguous, urashima],
          stageWidth: 640,
          ext_lmsTempVars2: {getRuntimeVariable, setRuntimeVariable},
          getOpcodeFunction,
          requestRedraw: vi.fn()
        }
      },
      extensions: {unsandboxed: true, register: vi.fn()},
      BlockType: {COMMAND: 'command', BOOLEAN: 'boolean', REPORTER: 'reporter'},
      ArgumentType: {STRING: 'string', NUMBER: 'number'},
      translate: (text: string) => text
    });
  });

  it('keeps the legacy opcode hidden and exposes the resource registration opcode', () => {
    const extension = new AssetManagerExtension();
    const blocks = extension.getInfo().blocks;
    expect(blocks.find((block) => block.opcode === 'loadAsset')).toMatchObject({hideFromPalette: true});
    expect(blocks.find((block) => block.opcode === 'validateProjectAssetAddress'))
      .toMatchObject({hideFromPalette: true});
    expect(blocks.find((block) => block.opcode === 'registerAsset')).toBeDefined();
    expect(blocks.find((block) => block.opcode === 'assetErrorType')).toBeDefined();
    expect(blocks.find((block) => block.opcode === 'assetErrorLabel')).toBeDefined();
    expect(blocks.find((block) => block.opcode === 'setTextValue')).toBeDefined();
    expect(blocks.find((block) => block.opcode === 'setTextStyle')).toBeDefined();
    expect(blocks.find((block) => block.opcode === 'stopSound')).toBeDefined();
    expect(blocks.find((block) => block.opcode === 'stopAllSounds')).toBeDefined();
  });

  it('links the default English user guide from the extension palette', () => {
    const extension = new AssetManagerExtension();

    expect(extension.getInfo().docsURI).toBe(EXTENSION_DOCS_URI);
    expect(EXTENSION_DOCS_URI).toBe('https://kubohiroya.github.io/turbowarp-asset-manager/');
    expect(extension.getVersion()).toBe(EXTENSION_VERSION);
    expect(EXTENSION_VERSION).toBe('0.5.0');
  });

  it('validates project asset addresses without registration side effects', () => {
    const extension = new AssetManagerExtension();

    expect(JSON.parse(extension.validateProjectAssetAddress({
      RESOURCE_ID: 'costume:Hero:normal',
      NAME: 'hero'
    }))).toEqual({ok: true, kind: 'costume', projectLocal: true});
    expect(validateProjectAssetAddress(
      Scratch.vm.runtime,
      'opening',
      'sound:@stage:opening'
    )).toEqual({ok: true, kind: 'sound', projectLocal: true});
    expect(validateProjectAssetAddress(
      Scratch.vm.runtime,
      'forest',
      'backdrop:forest'
    )).toEqual({ok: true, kind: 'backdrop', projectLocal: true});
    expect(validateProjectAssetAddress(
      Scratch.vm.runtime,
      'Narration',
      'text'
    )).toEqual({ok: true, kind: 'text', projectLocal: true});
    expect(JSON.parse(extension.validateProjectAssetAddress({
      RESOURCE_ID: 'https://example.com/image.png',
      NAME: 'remote'
    }))).toEqual({ok: true, kind: 'external', projectLocal: false});
    for (const [resourceId, name, type, label] of [
      ['costume:Missing:walk', 'missing', 'SPRITE_NOT_FOUND', 'Missing'],
      ['costume:Hero:missing', 'missing', 'SOURCE_ASSET_NOT_FOUND', 'missing'],
      ['backdrop:missing', 'missing', 'SOURCE_ASSET_NOT_FOUND', 'missing'],
      ['sound:Hero:missing', 'missing', 'SOURCE_ASSET_NOT_FOUND', 'missing'],
      ['costume', 'Ambiguous', 'SOURCE_ASSET_NOT_FOUND', 'Ambiguous'],
      ['text', 'chapter:title', 'INVALID_ASSET_NAME', 'chapter:title']
    ]) {
      expect(JSON.parse(extension.validateProjectAssetAddress({
        RESOURCE_ID: resourceId,
        NAME: name
      }))).toMatchObject({ok: false, type, label});
    }

    expect(extension.isLoaded({NAME: 'hero'})).toBe(false);
    expect(extension.isLoaded({NAME: 'opening'})).toBe(false);
    expect(extension.assetErrorType()).toBe('');
    expect(extension.assetErrorLabel()).toBe('');
    expect(updateDrawableSkinId).not.toHaveBeenCalled();
    expect(destroySkin).not.toHaveBeenCalled();
  });

  it('reports structured asset registration errors and clears them after success', async () => {
    const extension = new AssetManagerExtension();
    expect(extension.assetErrorType()).toBe('');
    expect(extension.assetErrorLabel()).toBe('');

    await expect(extension.registerAsset({RESOURCE_ID: 'costume:Missing:walk', NAME: 'missing'}))
      .rejects.toThrow('Sprite not found');
    expect(extension.assetErrorType()).toBe('SPRITE_NOT_FOUND');
    expect(extension.assetErrorLabel()).toBe('Missing');

    await expect(extension.registerAsset({RESOURCE_ID: 'costume:Hero:missing', NAME: 'missing'}))
      .rejects.toThrow('Costume not found');
    expect(extension.assetErrorType()).toBe('SOURCE_ASSET_NOT_FOUND');
    expect(extension.assetErrorLabel()).toBe('missing');

    await expect(extension.registerAsset({RESOURCE_ID: 'backdrop:missing', NAME: 'missing'}))
      .rejects.toThrow('Backdrop not found');
    expect(extension.assetErrorType()).toBe('SOURCE_ASSET_NOT_FOUND');
    expect(extension.assetErrorLabel()).toBe('missing');

    await expect(extension.registerAsset({RESOURCE_ID: 'sound:Hero:missing', NAME: 'missing'}))
      .rejects.toThrow('Sound not found');
    expect(extension.assetErrorType()).toBe('SOURCE_ASSET_NOT_FOUND');
    expect(extension.assetErrorLabel()).toBe('missing');

    await expect(extension.registerAsset({RESOURCE_ID: 'text', NAME: 'chapter:title'}))
      .rejects.toThrow('[INVALID_ASSET_NAME]');
    expect(extension.assetErrorType()).toBe('INVALID_ASSET_NAME');
    expect(extension.assetErrorLabel()).toBe('chapter:title');

    await expect(extension.registerAsset({RESOURCE_ID: 'ftp://example.com/a.png', NAME: 'invalid'}))
      .rejects.toThrow('Unsupported resource scheme');
    expect(extension.assetErrorType()).toBe('RESOURCE_ID_INVALID');
    expect(extension.assetErrorLabel()).toBe('ftp://example.com/a.png');

    await extension.registerAsset({RESOURCE_ID: 'costume:Hero:normal', NAME: 'hero'});
    expect(extension.assetErrorType()).toBe('');
    expect(extension.assetErrorLabel()).toBe('');
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
    expect(setStageSize).not.toHaveBeenCalled();

    extension.deleteMemoryAsset({NAME: 'hero'});
    expect(destroySkin).not.toHaveBeenCalled();

    await extension.registerAsset({RESOURCE_ID: 'backdrop:forest', NAME: 'forest'});
    await extension.setThisSpriteSkin({NAME: 'forest'}, {target: sprite});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 99);
    expect(setSpriteSize).not.toHaveBeenCalled();
    expect(extension.getAssetMimeType({NAME: 'forest'})).toBe('image/svg+xml');
  });

  it('applies the source sprite size to named sprites and invoking targets', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'costume:Hero:normal', NAME: 'hero'});
    await extension.registerAsset({RESOURCE_ID: 'costume:Turtle:walk', NAME: 'turtle'});

    await extension.setThisSpriteSkin({NAME: 'hero'}, {target: twin});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(9, 42);
    expect(setTwinSize).toHaveBeenLastCalledWith(250);

    await extension.setSpriteSkin({SPRITE: 'Hero', NAME: 'turtle'});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 43);
    expect(setSpriteSize).toHaveBeenLastCalledWith(175);
  });

  it('keeps a clone size when applying a project costume', async () => {
    const extension = new AssetManagerExtension();
    const setCloneSize = vi.fn();
    const clone: TurboWarpTarget = {
      ...sprite,
      id: 'hero-clone-id',
      isOriginal: false,
      drawableID: 12,
      size: 45,
      setSize: setCloneSize
    };
    Scratch.vm.runtime.targets.push(clone);
    await extension.registerAsset({RESOURCE_ID: 'costume:Hero:normal', NAME: 'hero'});

    await extension.setThisSpriteSkin({NAME: 'hero'}, {target: clone});

    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(12, 42);
    expect(setCloneSize).not.toHaveBeenCalled();
    expect(clone.size).toBe(45);
  });

  it('leaves the target size unchanged for external images', async () => {
    const extension = new AssetManagerExtension();
    const internals = extension as unknown as TestExtensionInternals;
    internals.externalAssets.set('external-image', {
      kind: 'external', name: 'external-image', url: 'https://example.com/image.png',
      mimeType: 'image/png', data: new ArrayBuffer(0), cachedAt: 1, skinId: 501
    });
    internals.assetRegistry.set('external-image', 'external');

    await extension.setThisSpriteSkin({NAME: 'external-image'}, {target: sprite});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 501);
    expect(setSpriteSize).not.toHaveBeenCalled();
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
    expect(extension.assetErrorType()).toBe('SOURCE_ASSET_NOT_FOUND');
    expect(extension.assetErrorLabel()).toBe('Ambiguous');
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

  it('stops only the selected project sound', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'sound:Hero:hello', NAME: 'voice'});
    await extension.registerAsset({RESOURCE_ID: 'sound:@stage:opening', NAME: 'music'});

    extension.stopSound({NAME: 'voice'});

    expect(stopSound).toHaveBeenCalledTimes(1);
    expect(stopSound).toHaveBeenCalledWith(sprite, 'sound-id');
    expect(stopAllSounds).not.toHaveBeenCalled();
  });

  it('shows the latest runtime variable value through Animated Text for bare text assets', async () => {
    const extension = new AssetManagerExtension();

    await extension.registerAsset({RESOURCE_ID: 'text', NAME: 'Narration'});
    expect(extension.isLoaded({NAME: 'Narration'})).toBe(true);
    expect(extension.getAssetMimeType({NAME: 'Narration'})).toBe('text/plain');

    runtimeVariables.set('text:Narration', 'むかし　むかし、あるところに...');
    await extension.setThisSpriteSkin({NAME: 'Narration'}, {target: sprite});
    expect(getRuntimeVariable).toHaveBeenLastCalledWith({VAR: 'text:Narration'});
    expect(getOpcodeFunction).toHaveBeenLastCalledWith('text_setText');
    expect(setTextFont).toHaveBeenLastCalledWith(
      {FONT: 'Handwriting'},
      expect.objectContaining({target: sprite, runtime: Scratch.vm.runtime})
    );
    expect(setTextColor).toHaveBeenLastCalledWith(
      {COLOR: '#ffffff'},
      expect.objectContaining({target: sprite, runtime: Scratch.vm.runtime})
    );
    expect(setTextWidth).toHaveBeenLastCalledWith(
      {WIDTH: 640, ALIGN: 'center'},
      expect.objectContaining({target: sprite, runtime: Scratch.vm.runtime})
    );
    expect(setTextOutlineWidth).toHaveBeenLastCalledWith(
      {WIDTH: 2},
      expect.objectContaining({target: sprite, runtime: Scratch.vm.runtime})
    );
    expect(setTextOutlineColor).toHaveBeenLastCalledWith(
      {COLOR: '#000000'},
      expect.objectContaining({target: sprite, runtime: Scratch.vm.runtime})
    );
    expect(setAnimatedText).toHaveBeenLastCalledWith(
      {TEXT: 'むかし　むかし、あるところに...'},
      expect.objectContaining({target: sprite, runtime: Scratch.vm.runtime})
    );
    expect(updateDrawableSkinId).not.toHaveBeenCalled();
    expect(setSpriteSize).not.toHaveBeenCalled();

    runtimeVariables.set('text:Narration', '値は表示時に更新される');
    await extension.setSpriteSkin({SPRITE: 'Turtle', NAME: 'Narration'});
    expect(setAnimatedText).toHaveBeenLastCalledWith(
      {TEXT: '値は表示時に更新される'},
      expect.objectContaining({target: turtle, runtime: Scratch.vm.runtime})
    );

    setAnimatedText.mockClear();
    await extension.setTextValue({NAME: 'Narration', VALUE: '表示中に更新される'});
    expect(setAnimatedText).toHaveBeenCalledTimes(2);
    expect(setAnimatedText).toHaveBeenCalledWith(
      {TEXT: '表示中に更新される'},
      expect.objectContaining({target: sprite})
    );
    expect(setAnimatedText).toHaveBeenCalledWith(
      {TEXT: '表示中に更新される'},
      expect.objectContaining({target: turtle})
    );

    extension.deleteMemoryAsset({NAME: 'Narration'});
    expect(extension.isLoaded({NAME: 'Narration'})).toBe(false);
    setAnimatedText.mockClear();
    await extension.setTextValue({NAME: 'Narration', VALUE: 'unregistered'});
    expect(setAnimatedText).not.toHaveBeenCalled();
  });

  it('stores namespaced text and style values and applies a typing animation', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'text', NAME: 'Narration'});

    extension.setTextValue({NAME: 'Narration', VALUE: 'さぁ、行こう！'});
    extension.setTextStyle({NAME: 'Narration', PROPERTY: 'animation', VALUE: 'typing'});
    extension.setTextStyle({NAME: 'Narration', PROPERTY: 'font', VALUE: 'Sans Serif'});
    extension.setTextStyle({NAME: 'Narration', PROPERTY: 'color', VALUE: '#F80'});
    extension.setTextStyle({NAME: 'Narration', PROPERTY: 'width', VALUE: '200'});
    extension.setTextStyle({NAME: 'Narration', PROPERTY: 'align', VALUE: 'left'});

    expect(runtimeVariables).toEqual(new Map([
      ['text:Narration', 'さぁ、行こう！'],
      ['textStyle:Narration:animation', 'type'],
      ['textStyle:Narration:font', 'Sans Serif'],
      ['textStyle:Narration:color', '#ff8800'],
      ['textStyle:Narration:width', '200'],
      ['textStyle:Narration:align', 'left']
    ]));

    await extension.setThisSpriteSkin({NAME: 'Narration'}, {target: sprite});
    expect(setTextFont).toHaveBeenLastCalledWith(
      {FONT: 'Sans Serif'},
      expect.objectContaining({target: sprite})
    );
    expect(setTextColor).toHaveBeenLastCalledWith(
      {COLOR: '#ff8800'},
      expect.objectContaining({target: sprite})
    );
    expect(setTextWidth).toHaveBeenLastCalledWith(
      {WIDTH: 200, ALIGN: 'left'},
      expect.objectContaining({target: sprite})
    );
    expect(animateText).toHaveBeenLastCalledWith(
      {ANIMATE: 'type', TEXT: 'さぁ、行こう！'},
      expect.objectContaining({target: sprite, runtime: Scratch.vm.runtime})
    );
    expect(setAnimatedText).not.toHaveBeenCalled();

    runtimeVariables.set('text:Narration', '表示時に更新');
    runtimeVariables.set('textStyle:Narration:color', '#123456');
    await extension.setThisSpriteSkin({NAME: 'Narration'}, {target: turtle});
    expect(setTextColor).toHaveBeenLastCalledWith(
      {COLOR: '#123456'},
      expect.objectContaining({target: turtle})
    );
    expect(animateText).toHaveBeenLastCalledWith(
      {ANIMATE: 'type', TEXT: '表示時に更新'},
      expect.objectContaining({target: turtle})
    );
  });

  it('starts text animation without delaying following show-position blocks', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'text', NAME: 'Narration'});
    extension.setTextValue({NAME: 'Narration', VALUE: 'typing'});
    extension.setTextStyle({NAME: 'Narration', PROPERTY: 'animation', VALUE: 'typing'});
    animateText.mockReturnValueOnce(new Promise<void>(() => {}));

    await expect(extension.setThisSpriteSkin({NAME: 'Narration'}, {target: sprite}))
      .resolves.toBeUndefined();
    expect(animateText).toHaveBeenCalledTimes(1);
  });

  it('reapplies defaults so styles do not leak between text assets', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'text', NAME: 'Styled'});
    await extension.registerAsset({RESOURCE_ID: 'text', NAME: 'Plain'});
    extension.setTextValue({NAME: 'Styled', VALUE: 'styled'});
    extension.setTextValue({NAME: 'Plain', VALUE: 'plain'});
    extension.setTextStyle({NAME: 'Styled', PROPERTY: 'font', VALUE: 'Pixel'});
    extension.setTextStyle({NAME: 'Styled', PROPERTY: 'color', VALUE: '#abcdef'});
    extension.setTextStyle({NAME: 'Styled', PROPERTY: 'width', VALUE: '200'});
    extension.setTextStyle({NAME: 'Styled', PROPERTY: 'align', VALUE: 'right'});

    await extension.setThisSpriteSkin({NAME: 'Styled'}, {target: sprite});
    await extension.setThisSpriteSkin({NAME: 'Plain'}, {target: sprite});

    expect(setTextFont).toHaveBeenLastCalledWith({FONT: 'Handwriting'}, expect.any(Object));
    expect(setTextColor).toHaveBeenLastCalledWith({COLOR: '#ffffff'}, expect.any(Object));
    expect(setTextWidth).toHaveBeenLastCalledWith(
      {WIDTH: 640, ALIGN: 'center'},
      expect.any(Object)
    );
    expect(setAnimatedText).toHaveBeenLastCalledWith({TEXT: 'plain'}, expect.any(Object));
  });

  it('rejects unknown or invalid text style values', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'text', NAME: 'Narration'});

    expect(() => extension.setTextStyle({NAME: 'Narration', PROPERTY: 'spacing', VALUE: '1'}))
      .toThrow('Unknown text style property');
    expect(() => extension.setTextStyle({NAME: 'Narration', PROPERTY: 'animation', VALUE: 'blink'}))
      .toThrow('Invalid text animation');
    expect(() => extension.setTextStyle({NAME: 'Narration', PROPERTY: 'color', VALUE: 'red'}))
      .toThrow('Invalid text color');
    expect(() => extension.setTextStyle({NAME: 'Narration', PROPERTY: 'width', VALUE: '0'}))
      .toThrow('positive number');
    expect(() => extension.setTextStyle({NAME: 'Narration', PROPERTY: 'align', VALUE: 'justify'}))
      .toThrow('Invalid text alignment');
    await expect(extension.setTextValue({NAME: 'chapter:title', VALUE: 'invalid'}))
      .rejects.toThrow('must not contain a colon');

    runtimeVariables.set('textStyle:Narration:width', 'broken');
    await expect(extension.setThisSpriteSkin({NAME: 'Narration'}, {target: sprite}))
      .rejects.toThrow('positive number');
    expect(setTextFont).not.toHaveBeenCalled();
  });

  it('reports missing text dependencies only when a text asset is shown', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'text:Narration', NAME: 'script'});
    getOpcodeFunction.mockImplementation(() => undefined);

    await expect(extension.setThisSpriteSkin({NAME: 'script'}, {target: sprite}))
      .rejects.toThrow('Animated Text extension is not loaded or does not provide text_setFont');
  });

  it('reports a missing Temporary Variables dependency when setting or showing text', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'text', NAME: 'Narration'});
    delete Scratch.vm.runtime.ext_lmsTempVars2;

    await expect(extension.setTextValue({NAME: 'Narration', VALUE: 'text'}))
      .rejects.toThrow('Temporary Variables extension is not loaded');
    await expect(extension.setThisSpriteSkin({NAME: 'Narration'}, {target: sprite}))
      .rejects.toThrow('Temporary Variables extension is not loaded');
  });

  it('suggests the closest registered asset for a misspelled name', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'text', NAME: 'Narration'});

    await expect(extension.setThisSpriteSkin({NAME: 'Naration'}, {target: sprite}))
      .rejects.toThrow(
        '[Asset Manager][ASSET_NOT_REGISTERED] Cannot show asset "Naration": ' +
        'no registered asset has that name. Did you mean "Narration"?'
      );
  });

  it('keeps legacy replacement behavior while the live flag is off', async () => {
    const extension = new AssetManagerExtension();
    const internals = extension as unknown as TestExtensionInternals;
    await extension.registerAsset({RESOURCE_ID: 'costume:Hero:normal', NAME: 'shared'});
    await extension.setThisSpriteSkin({NAME: 'shared'}, {target: sprite});
    updateDrawableSkinId.mockClear();

    await extension.registerAsset({RESOURCE_ID: 'costume:Turtle:walk', NAME: 'shared'});

    expect(updateDrawableSkinId).not.toHaveBeenCalled();
    expect(internals.displayedAssets.has(sprite.id)).toBe(false);
    await extension.setThisSpriteSkin({NAME: 'shared'}, {target: sprite});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 43);
  });

  it('reapplies a same-kind image replacement to every managed display', async () => {
    const extension = new AssetManagerExtension(ALL_FEATURES);
    const internals = extension as unknown as TestExtensionInternals;
    await extension.registerAsset({RESOURCE_ID: 'costume:Hero:normal', NAME: 'shared'});
    await extension.setThisSpriteSkin({NAME: 'shared'}, {target: sprite});
    await extension.setStageSkin({NAME: 'shared'});
    updateDrawableSkinId.mockClear();

    await extension.registerAsset({RESOURCE_ID: 'costume:Turtle:walk', NAME: 'shared'});

    expect(updateDrawableSkinId).toHaveBeenCalledTimes(2);
    expect(updateDrawableSkinId).toHaveBeenCalledWith(7, 43);
    expect(updateDrawableSkinId).toHaveBeenCalledWith(0, 43);
    expect(internals.displayedAssets.get(sprite.id)).toEqual({
      assetName: 'shared',
      assetKind: 'costume',
      skinId: 43
    });
    expect(internals.displayedAssets.get(stage.id)).toEqual({
      assetName: 'shared',
      assetKind: 'costume',
      skinId: 43
    });
  });

  it('leaves a display alone after another feature changes its skin', async () => {
    const extension = new AssetManagerExtension(ALL_FEATURES);
    const internals = extension as unknown as TestExtensionInternals;
    await extension.registerAsset({RESOURCE_ID: 'costume:Hero:normal', NAME: 'shared'});
    await extension.setThisSpriteSkin({NAME: 'shared'}, {target: sprite});
    Scratch.vm.runtime.renderer.updateDrawableSkinId(7, 999);
    updateDrawableSkinId.mockClear();

    await extension.registerAsset({RESOURCE_ID: 'costume:Turtle:walk', NAME: 'shared'});

    expect(updateDrawableSkinId).not.toHaveBeenCalled();
    expect(rendererDrawables[7]?.skin.id).toBe(999);
    expect(internals.displayedAssets.has(sprite.id)).toBe(false);
  });

  it('creates one shared external skin for every managed display', async () => {
    const extension = new AssetManagerExtension(ALL_FEATURES);
    const internals = extension as unknown as TestExtensionInternals;
    internals.externalAssets.set('shared', {
      kind: 'external', name: 'shared', url: 'https://example.com/old.png',
      mimeType: 'image/png', data: new ArrayBuffer(0), cachedAt: 1, skinId: 501
    });
    internals.assetRegistry.set('shared', 'external');
    await extension.setThisSpriteSkin({NAME: 'shared'}, {target: sprite});
    await extension.setStageSkin({NAME: 'shared'});
    vi.spyOn(internals, 'cacheGet').mockResolvedValue(null);
    vi.spyOn(internals, 'cachePut').mockResolvedValue();
    vi.spyOn(internals, 'restoreCacheIfGeneration').mockResolvedValue();
    vi.spyOn(internals, 'fetchExternalAsset').mockResolvedValue({
      kind: 'external', name: 'shared', url: 'https://example.com/new.png',
      mimeType: 'image/png', data: new ArrayBuffer(0), cachedAt: 2, skinId: null
    });
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({} as ImageBitmap)));
    const createBitmapSkin = vi.mocked(Scratch.vm.runtime.renderer.createBitmapSkin);
    createBitmapSkin.mockClear();
    createBitmapSkin.mockReturnValue(601);
    updateDrawableSkinId.mockClear();

    await extension.registerAsset({
      RESOURCE_ID: 'https://example.com/new.png',
      NAME: 'shared'
    });

    expect(createBitmapSkin).toHaveBeenCalledOnce();
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(2);
    expect(updateDrawableSkinId).toHaveBeenCalledWith(7, 601);
    expect(updateDrawableSkinId).toHaveBeenCalledWith(0, 601);
    expect(internals.externalAssets.get('shared')?.skinId).toBe(601);
  });

  it('restores the old registration and display when reapply fails', async () => {
    const extension = new AssetManagerExtension(ALL_FEATURES);
    await extension.registerAsset({RESOURCE_ID: 'costume:Hero:normal', NAME: 'shared'});
    await extension.setThisSpriteSkin({NAME: 'shared'}, {target: sprite});
    updateDrawableSkinId.mockClear();
    updateDrawableSkinId.mockImplementationOnce(() => {
      throw new Error('renderer rejected replacement');
    });

    await expect(extension.registerAsset({
      RESOURCE_ID: 'costume:Turtle:walk',
      NAME: 'shared'
    })).rejects.toThrow('[REPLACEMENT_FAILED]');

    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 42);
    await extension.setStageSkin({NAME: 'shared'});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(0, 42);
  });

  it('restarts a displayed text asset from the latest body and style', async () => {
    const extension = new AssetManagerExtension(ALL_FEATURES);
    await extension.registerAsset({RESOURCE_ID: 'text:Narration', NAME: 'script'});
    runtimeVariables.set('text:Narration', 'old body');
    await extension.setThisSpriteSkin({NAME: 'script'}, {target: sprite});
    setAnimatedText.mockClear();
    animateText.mockClear();
    runtimeVariables.set('text:Replacement', 'new body');
    runtimeVariables.set('textStyle:script:animation', 'type');

    await extension.registerAsset({RESOURCE_ID: 'text:Replacement', NAME: 'script'});

    expect(animateText).toHaveBeenLastCalledWith(
      {ANIMATE: 'type', TEXT: 'new body'},
      expect.objectContaining({target: sprite})
    );
    expect(setAnimatedText).not.toHaveBeenCalled();
  });

  it('serializes same-name text replacements and keeps the last-started result', async () => {
    const extension = new AssetManagerExtension(ALL_FEATURES);
    await extension.registerAsset({RESOURCE_ID: 'text:Initial', NAME: 'script'});
    runtimeVariables.set('text:Initial', 'initial');
    runtimeVariables.set('text:First', 'first');
    runtimeVariables.set('text:Second', 'second');
    await extension.setThisSpriteSkin({NAME: 'script'}, {target: sprite});
    setAnimatedText.mockClear();

    const first = extension.registerAsset({RESOURCE_ID: 'text:First', NAME: 'script'});
    const second = extension.registerAsset({RESOURCE_ID: 'text:Second', NAME: 'script'});
    await Promise.all([first, second]);

    expect(setAnimatedText).toHaveBeenCalledTimes(2);
    expect(setAnimatedText).toHaveBeenLastCalledWith(
      {TEXT: 'second'},
      expect.objectContaining({target: sprite})
    );
  });

  it('finishes an active valid replacement when a newer registration is invalid', async () => {
    const extension = new AssetManagerExtension(ALL_FEATURES);
    const internals = extension as unknown as TestExtensionInternals;
    await extension.registerAsset({RESOURCE_ID: 'text:Initial', NAME: 'script'});
    runtimeVariables.set('text:Initial', 'initial');
    runtimeVariables.set('text:Replacement', 'replacement');
    await extension.setThisSpriteSkin({NAME: 'script'}, {target: sprite});
    await extension.setThisSpriteSkin({NAME: 'script'}, {target: turtle});
    setAnimatedText.mockClear();
    const firstDisplay = deferred<void>();
    setAnimatedText.mockReturnValueOnce(firstDisplay.promise);

    const replacement = extension.registerAsset({
      RESOURCE_ID: 'text:Replacement',
      NAME: 'script'
    });
    await vi.waitFor(() => expect(setAnimatedText).toHaveBeenCalledOnce());
    await expect(extension.registerAsset({
      RESOURCE_ID: 'costume:Missing:walk',
      NAME: 'script'
    })).rejects.toThrow('[SPRITE_NOT_FOUND]');
    firstDisplay.resolve();
    await replacement;

    expect(setAnimatedText).toHaveBeenCalledTimes(2);
    expect(setAnimatedText).toHaveBeenCalledWith(
      {TEXT: 'replacement'},
      expect.objectContaining({target: sprite})
    );
    expect(setAnimatedText).toHaveBeenCalledWith(
      {TEXT: 'replacement'},
      expect.objectContaining({target: turtle})
    );
    expect(internals.textAssets.get('script')?.runtimeVariableName).toBe('text:Replacement');
  });

  it('rejects public kind changes and allows them after explicit deletion', async () => {
    const extension = new AssetManagerExtension(ALL_FEATURES);
    const internals = extension as unknown as TestExtensionInternals;
    await extension.registerAsset({RESOURCE_ID: 'costume:Hero:normal', NAME: 'shared'});

    await expect(extension.registerAsset({RESOURCE_ID: 'backdrop:forest', NAME: 'shared'}))
      .rejects.toThrow('[ASSET_TYPE_CHANGE]');
    expect(internals.assetRegistry.get('shared')).toBe('costume');

    extension.deleteMemoryAsset({NAME: 'shared'});
    await extension.registerAsset({RESOURCE_ID: 'backdrop:forest', NAME: 'shared'});
    expect(internals.assetRegistry.get('shared')).toBe('backdrop');
  });

  it('rejects image-to-audio external replacement without interrupting old state', async () => {
    const extension = new AssetManagerExtension(ALL_FEATURES);
    const internals = extension as unknown as TestExtensionInternals;
    const previousCache: TestCacheRecord = {
      name: 'shared',
      url: 'https://example.com/old.png',
      mimeType: 'image/png',
      data: new ArrayBuffer(0),
      cachedAt: 1
    };
    internals.externalAssets.set('shared', {
      ...previousCache,
      kind: 'external',
      skinId: null
    });
    internals.assetRegistry.set('shared', 'external');
    vi.spyOn(internals, 'cacheGet').mockResolvedValue(previousCache);
    const cachePut = vi.spyOn(internals, 'cachePut').mockResolvedValue();
    const restore = vi.spyOn(internals, 'restoreCacheIfGeneration').mockResolvedValue();
    vi.spyOn(internals, 'fetchExternalAsset').mockResolvedValue({
      kind: 'external', name: 'shared', url: 'https://example.com/new.mp3',
      mimeType: 'audio/mpeg', data: new ArrayBuffer(0), cachedAt: 2, skinId: null
    });

    await expect(extension.registerAsset({
      RESOURCE_ID: 'https://example.com/new.mp3',
      NAME: 'shared'
    })).rejects.toThrow('[ASSET_TYPE_CHANGE]');

    expect(internals.externalAssets.get('shared')?.url).toBe('https://example.com/old.png');
    expect(cachePut).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
  });

  it('keeps active external audio running while replacing future playback data', async () => {
    const extension = new AssetManagerExtension(ALL_FEATURES);
    const internals = extension as unknown as TestExtensionInternals;
    const pause = vi.fn();
    const activeAudio = {pause} as unknown as HTMLAudioElement;
    internals.externalAssets.set('voice', {
      kind: 'external', name: 'voice', url: 'https://example.com/old.mp3',
      mimeType: 'audio/mpeg', data: new ArrayBuffer(0), cachedAt: 1, skinId: null
    });
    internals.assetRegistry.set('voice', 'external');
    internals.playingAudio.set(activeAudio, 'voice');
    vi.spyOn(internals, 'cacheGet').mockResolvedValue(null);
    vi.spyOn(internals, 'cachePut').mockResolvedValue();
    vi.spyOn(internals, 'restoreCacheIfGeneration').mockResolvedValue();
    vi.spyOn(internals, 'fetchExternalAsset').mockResolvedValue({
      kind: 'external', name: 'voice', url: 'https://example.com/new.mp3',
      mimeType: 'audio/mpeg', data: new ArrayBuffer(0), cachedAt: 2, skinId: null
    });

    await extension.registerAsset({
      RESOURCE_ID: 'https://example.com/new.mp3',
      NAME: 'voice'
    });

    expect(pause).not.toHaveBeenCalled();
    expect(internals.playingAudio.get(activeAudio)).toBe('voice');
    expect(internals.externalAssets.get('voice')?.url).toBe('https://example.com/new.mp3');
  });

  it('keeps the newest external registration when requests finish out of order', async () => {
    const extension = new AssetManagerExtension();
    const internals = extension as unknown as TestExtensionInternals;
    const slow = deferred<TestExternalAsset>();
    const fast = deferred<TestExternalAsset>();
    vi.spyOn(internals, 'cacheGet').mockResolvedValue(null);
    const cachePut = vi.spyOn(internals, 'cachePut').mockResolvedValue();
    vi.spyOn(internals, 'restoreCacheIfGeneration').mockResolvedValue();
    vi.spyOn(internals, 'fetchExternalAsset').mockImplementation((url) =>
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
    expect(cachePut).toHaveBeenCalledOnce();
    expect(cachePut).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://example.com/fast.png',
      generation: 2
    }));
  });

  it('commits an older valid external registration after a newer attempt is invalid', async () => {
    const extension = new AssetManagerExtension();
    const internals = extension as unknown as TestExtensionInternals;
    const pending = deferred<TestExternalAsset>();
    vi.spyOn(internals, 'cacheGet').mockResolvedValue(null);
    vi.spyOn(internals, 'cachePut').mockResolvedValue();
    vi.spyOn(internals, 'restoreCacheIfGeneration').mockResolvedValue();
    vi.spyOn(internals, 'fetchExternalAsset').mockReturnValue(pending.promise);

    const validRegistration = extension.registerAsset({
      RESOURCE_ID: 'https://example.com/valid.png',
      NAME: 'shared'
    });
    await expect(extension.registerAsset({
      RESOURCE_ID: 'costume:Missing:walk',
      NAME: 'shared'
    })).rejects.toThrow('[SPRITE_NOT_FOUND]');
    pending.resolve({
      kind: 'external', name: 'shared', url: 'https://example.com/valid.png',
      mimeType: 'image/png', data: new ArrayBuffer(0), cachedAt: 1, skinId: null
    });
    await validRegistration;

    expect(internals.externalAssets.get('shared')?.url).toBe('https://example.com/valid.png');
  });

  it('does not let an older registration failure overwrite newer Reporter state', async () => {
    const extension = new AssetManagerExtension();
    const internals = extension as unknown as TestExtensionInternals;
    const pending = deferred<TestExternalAsset>();
    vi.spyOn(internals, 'cacheGet').mockResolvedValue(null);
    vi.spyOn(internals, 'cachePut').mockResolvedValue();
    vi.spyOn(internals, 'restoreCacheIfGeneration').mockResolvedValue();
    vi.spyOn(internals, 'fetchExternalAsset').mockReturnValue(pending.promise);

    const olderRegistration = extension.registerAsset({
      RESOURCE_ID: 'https://example.com/older.png', NAME: 'older'
    });
    await extension.registerAsset({RESOURCE_ID: 'costume:Hero:normal', NAME: 'newer'});
    pending.reject(new Error('older request failed'));
    await expect(olderRegistration).rejects.toThrow('older request failed');

    expect(extension.assetErrorType()).toBe('');
    expect(extension.assetErrorLabel()).toBe('');
  });

  it('invalidates a pending external registration when the name is unregistered', async () => {
    const extension = new AssetManagerExtension();
    const internals = extension as unknown as TestExtensionInternals;
    const pending = deferred<TestExternalAsset>();
    vi.spyOn(internals, 'cacheGet').mockResolvedValue(null);
    vi.spyOn(internals, 'cachePut').mockResolvedValue();
    vi.spyOn(internals, 'restoreCacheIfGeneration').mockResolvedValue();
    vi.spyOn(internals, 'fetchExternalAsset').mockReturnValue(pending.promise);

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
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
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
    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(expect.objectContaining({
      code: 'PLAYBACK_FAILED',
      operation: 'playSound',
      assetName: 'audio'
    }));
    consoleError.mockRestore();
  });

  it('stops every playback of one external asset without stopping another', async () => {
    const extension = new AssetManagerExtension();
    const internals = extension as unknown as TestExtensionInternals;
    const audioInstances: TestAudio[] = [];
    let objectUrlIndex = 0;
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:test-audio-${++objectUrlIndex}`),
      revokeObjectURL: vi.fn()
    });
    class TestAudio extends EventTarget {
      currentTime = 12;
      pause = vi.fn();
      play = vi.fn(() => Promise.resolve());
      constructor(_url: string) {
        super();
        audioInstances.push(this);
      }
    }
    vi.stubGlobal('Audio', TestAudio);
    for (const name of ['effect', 'music']) {
      internals.externalAssets.set(name, {
        kind: 'external', name, url: `https://example.com/${name}.mp3`,
        mimeType: 'audio/mpeg', data: new ArrayBuffer(0), cachedAt: 1, skinId: null
      });
      internals.assetRegistry.set(name, 'external');
    }

    await extension.playSound({NAME: 'effect'});
    await extension.playSound({NAME: 'effect'});
    await extension.playSound({NAME: 'music'});
    const [effect1, effect2, music] = audioInstances;

    extension.stopSound({NAME: 'effect'});

    expect(effect1?.pause).toHaveBeenCalledOnce();
    expect(effect2?.pause).toHaveBeenCalledOnce();
    expect(effect1?.currentTime).toBe(0);
    expect(effect2?.currentTime).toBe(0);
    expect(music?.pause).not.toHaveBeenCalled();
    expect(music?.currentTime).toBe(12);

    extension.stopAllSounds();
    expect(music?.pause).toHaveBeenCalledOnce();
    expect(stopAllSounds).toHaveBeenCalledWith(stage);
    expect(stopAllSounds).toHaveBeenCalledWith(sprite);
  });

  it('releases sound-until-done when its external playback is stopped', async () => {
    const extension = new AssetManagerExtension();
    const internals = extension as unknown as TestExtensionInternals;
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:wait-audio'),
      revokeObjectURL: vi.fn()
    });
    vi.stubGlobal('Audio', class extends EventTarget {
      currentTime = 0;
      pause = vi.fn();
      play = vi.fn(() => Promise.resolve());
      constructor(_url: string) { super(); }
    });
    internals.externalAssets.set('voice', {
      kind: 'external', name: 'voice', url: 'https://example.com/voice.mp3',
      mimeType: 'audio/mpeg', data: new ArrayBuffer(0), cachedAt: 1, skinId: null
    });
    internals.assetRegistry.set('voice', 'external');

    const playback = extension.playSoundUntilDone({NAME: 'voice'});
    await Promise.resolve();
    extension.stopSound({NAME: 'voice'});

    await expect(playback).resolves.toBeUndefined();
  });

  it('reports explicit type mismatches', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'backdrop:forest', NAME: 'forest'});
    await expect(extension.playSound({NAME: 'forest'}))
      .rejects.toThrow('[ASSET_TYPE_MISMATCH]');
    expect(() => extension.stopSound({NAME: 'forest'})).toThrow('[ASSET_TYPE_MISMATCH]');
    expect(() => extension.stopSound({NAME: 'missing'})).toThrow('[ASSET_NOT_REGISTERED]');
  });
});
