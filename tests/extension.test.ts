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
  assetRegistry: Map<string, 'external' | 'costume' | 'sound' | 'text'>;
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
  const destroySkin = vi.fn();
  const playSound = vi.fn(() => Promise.resolve());
  const stopSound = vi.fn();
  const stopAllSounds = vi.fn();
  const setAnimatedText = vi.fn();
  const animateText = vi.fn();
  const setTextFont = vi.fn();
  const setTextColor = vi.fn();
  const setTextWidth = vi.fn();
  const animatedTextOpcodes = new Map<string, ReturnType<typeof vi.fn>>([
    ['text_setText', setAnimatedText],
    ['text_animateText', animateText],
    ['text_setFont', setTextFont],
    ['text_setColor', setTextColor],
    ['text_setWidth', setTextWidth]
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
    destroySkin.mockClear();
    playSound.mockClear();
    stopSound.mockClear();
    stopAllSounds.mockClear();
    setAnimatedText.mockClear();
    animateText.mockClear();
    setTextFont.mockClear();
    setTextColor.mockClear();
    setTextWidth.mockClear();
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
      ArgumentType: {STRING: 'string'},
      translate: (text: string) => text
    });
  });

  it('keeps the legacy opcode hidden and exposes the resource registration opcode', () => {
    const extension = new AssetManagerExtension();
    const blocks = extension.getInfo().blocks;
    expect(blocks.find((block) => block.opcode === 'loadAsset')).toMatchObject({hideFromPalette: true});
    expect(blocks.find((block) => block.opcode === 'registerAsset')).toBeDefined();
    expect(blocks.find((block) => block.opcode === 'assetErrorType')).toBeDefined();
    expect(blocks.find((block) => block.opcode === 'assetErrorLabel')).toBeDefined();
    expect(blocks.find((block) => block.opcode === 'setTextValue')).toBeDefined();
    expect(blocks.find((block) => block.opcode === 'setTextStyle')).toBeDefined();
    expect(blocks.find((block) => block.opcode === 'stopSound')).toBeDefined();
    expect(blocks.find((block) => block.opcode === 'stopAllSounds')).toBeDefined();
  });

  it('reports structured asset registration errors and clears them after success', async () => {
    const extension = new AssetManagerExtension();
    expect(extension.assetErrorType()).toBe('');
    expect(extension.assetErrorLabel()).toBe('');

    await expect(extension.registerAsset({RESOURCE_ID: 'costume:Missing:walk', NAME: 'missing'}))
      .rejects.toThrow('Sprite not found');
    expect(extension.assetErrorType()).toBe('sprite');
    expect(extension.assetErrorLabel()).toBe('Missing');

    await expect(extension.registerAsset({RESOURCE_ID: 'costume:Hero:missing', NAME: 'missing'}))
      .rejects.toThrow('Costume not found');
    expect(extension.assetErrorType()).toBe('costume');
    expect(extension.assetErrorLabel()).toBe('missing');

    await expect(extension.registerAsset({RESOURCE_ID: 'backdrop:missing', NAME: 'missing'}))
      .rejects.toThrow('Backdrop not found');
    expect(extension.assetErrorType()).toBe('backdrop');
    expect(extension.assetErrorLabel()).toBe('missing');

    await expect(extension.registerAsset({RESOURCE_ID: 'sound:Hero:missing', NAME: 'missing'}))
      .rejects.toThrow('Sound not found');
    expect(extension.assetErrorType()).toBe('sound');
    expect(extension.assetErrorLabel()).toBe('missing');

    await expect(extension.registerAsset({RESOURCE_ID: 'text', NAME: 'chapter:title'}))
      .rejects.toThrow('Text asset name must not contain a colon');
    expect(extension.assetErrorType()).toBe('asset-name');
    expect(extension.assetErrorLabel()).toBe('chapter:title');

    await expect(extension.registerAsset({RESOURCE_ID: 'ftp://example.com/a.png', NAME: 'invalid'}))
      .rejects.toThrow('Unsupported resource scheme');
    expect(extension.assetErrorType()).toBe('resource-id');
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
    expect(extension.assetErrorType()).toBe('costume');
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
      {COLOR: '#575e75'},
      expect.objectContaining({target: sprite, runtime: Scratch.vm.runtime})
    );
    expect(setTextWidth).toHaveBeenLastCalledWith(
      {WIDTH: 640, ALIGN: 'center'},
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

    extension.deleteMemoryAsset({NAME: 'Narration'});
    expect(extension.isLoaded({NAME: 'Narration'})).toBe(false);
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
    expect(setTextColor).toHaveBeenLastCalledWith({COLOR: '#575e75'}, expect.any(Object));
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
    expect(() => extension.setTextValue({NAME: 'chapter:title', VALUE: 'invalid'}))
      .toThrow('must not contain a colon');

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

    expect(() => extension.setTextValue({NAME: 'Narration', VALUE: 'text'}))
      .toThrow('Temporary Variables extension is not loaded');
    await expect(extension.setThisSpriteSkin({NAME: 'Narration'}, {target: sprite}))
      .rejects.toThrow('Temporary Variables extension is not loaded');
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

  it('does not let an older registration failure overwrite newer Reporter state', async () => {
    const extension = new AssetManagerExtension();
    const internals = extension as unknown as TestExtensionInternals;
    const pending = deferred<TestExternalAsset>();
    vi.spyOn(internals, 'fetchAndCache').mockReturnValue(pending.promise);

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
    await expect(extension.playSound({NAME: 'forest'})).rejects.toThrow('Asset is not audio');
    expect(() => extension.stopSound({NAME: 'forest'})).toThrow('Asset is not audio');
    expect(() => extension.stopSound({NAME: 'missing'})).toThrow('Asset is not loaded');
  });
});
