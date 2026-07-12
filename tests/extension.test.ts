import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  AssetManagerExtension,
  guessMimeType,
  normalizeMimeType,
  parseResourceIdentifier
} from '../src/extension.js';

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
    expect(parseResourceIdentifier('costume:Hero,normal')).toEqual({
      kind: 'costume', spriteName: 'Hero', costumeName: 'normal'
    });
    expect(parseResourceIdentifier('background:forest')).toEqual({
      kind: 'background', backgroundName: 'forest'
    });
    expect(parseResourceIdentifier('sound:@stage,opening')).toEqual({
      kind: 'sound', spriteName: '@stage', soundName: 'opening'
    });
  });

  it('rejects unknown schemes and incomplete identifiers', () => {
    expect(() => parseResourceIdentifier('ftp://example.com/a.png')).toThrow('Unsupported resource scheme');
    expect(() => parseResourceIdentifier('costume:Hero')).toThrow('separated by a comma');
    expect(() => parseResourceIdentifier('background:')).toThrow('Background name is empty');
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
  const stage: TurboWarpTarget = {
    id: 'stage-id',
    isStage: true,
    isOriginal: true,
    drawableID: 0,
    sprite: {
      name: 'Stage',
      costumes: [{name: 'forest', assetId: 'background-asset', skinId: 99, dataFormat: 'svg'}],
      sounds: [{name: 'opening', assetId: 'stage-sound-asset', soundId: 'stage-sound-id', dataFormat: 'mp3'}],
      soundBank
    }
  };

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
          targets: [stage, sprite],
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

  it('borrows costume and backdrop skins without destroying them', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'costume:Hero,normal', NAME: 'hero'});
    await extension.setStageSkin({NAME: 'hero'});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(0, 42);

    extension.deleteMemoryAsset({NAME: 'hero'});
    expect(destroySkin).not.toHaveBeenCalled();

    await extension.registerAsset({RESOURCE_ID: 'background:forest', NAME: 'forest'});
    await extension.setThisSpriteSkin({NAME: 'forest'}, {target: sprite});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 99);
    expect(extension.getAssetMimeType({NAME: 'forest'})).toBe('image/svg+xml');
  });

  it('plays sprite and stage sounds through the owning sound bank', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'sound:Hero,hello', NAME: 'voice'});
    await extension.playSoundUntilDone({NAME: 'voice'});
    expect(playSound).toHaveBeenLastCalledWith(sprite, 'sound-id');
    expect(extension.getAssetMimeType({NAME: 'voice'})).toBe('audio/wav');

    await extension.registerAsset({RESOURCE_ID: 'sound:@stage,opening', NAME: 'opening'});
    await extension.playSoundUntilDone({NAME: 'opening'});
    expect(playSound).toHaveBeenLastCalledWith(stage, 'stage-sound-id');
  });

  it('reports explicit type mismatches', async () => {
    const extension = new AssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'background:forest', NAME: 'forest'});
    await expect(extension.playSound({NAME: 'forest'})).rejects.toThrow('Asset is not audio');
  });
});
