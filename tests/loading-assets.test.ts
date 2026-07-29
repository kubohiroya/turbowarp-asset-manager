import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {AssetManagerExtension} from '../src/extension.js';

describe('loading assets', () => {
  const assetList = {
    value: [
      'scene,https://example.com/scene.png',
      'loading2,https://example.com/loading2.png',
      'voice,https://example.com/voice.mp3',
      'loading1,https://example.com/loading1.png'
    ] as unknown[]
  };
  const target: TurboWarpTarget = {
    id: 'stage-id',
    isStage: true,
    size: 100,
    setSize: vi.fn(),
    lookupVariableByNameAndType: vi.fn((name, type) =>
      name === 'assetList' && type === 'list' ? assetList : null
    )
  };

  beforeEach(() => {
    assetList.value = [
      'scene,https://example.com/scene.png',
      'loading2,https://example.com/loading2.png',
      'voice,https://example.com/voice.mp3',
      'loading1,https://example.com/loading1.png'
    ];
    vi.stubGlobal('Scratch', {
      vm: {runtime: {renderer: {}, targets: [target]}},
      extensions: {unsandboxed: true, register: vi.fn()},
      BlockType: {COMMAND: 'command', BOOLEAN: 'boolean', REPORTER: 'reporter'},
      ArgumentType: {STRING: 'string', NUMBER: 'number'},
      translate: (text: string) => text
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prioritizes configured loading assets and reports their count', () => {
    const extension = new AssetManagerExtension();
    extension.setLoadingCostumes({NAMES: ' loading1, loading2, loading1, '});

    extension.prepareLoadingAssets({LIST: 'assetList'}, {target});

    expect(assetList.value).toEqual([
      'loading2,https://example.com/loading2.png',
      'loading1,https://example.com/loading1.png',
      'scene,https://example.com/scene.png',
      'voice,https://example.com/voice.mp3'
    ]);
    expect(extension.loadingAssetCount()).toBe(2);
    expect(extension.loadingCostumeAt({INDEX: 1})).toBe('loading1');
    expect(extension.loadingCostumeAt({INDEX: 2})).toBe('loading2');
    expect(extension.loadingCostumeAt({INDEX: 3})).toBe('loading1');
    expect(extension.loadingCostumeAt({INDEX: 0})).toBe('loading1');
  });

  it('rejects missing list variables and undeclared loading assets', () => {
    const extension = new AssetManagerExtension();
    extension.setLoadingCostumes({NAMES: 'missing'});

    expect(() => extension.prepareLoadingAssets({LIST: 'assetList'}, {target}))
      .toThrow('Loading asset is not declared: missing');
    expect(() => extension.prepareLoadingAssets({LIST: 'unknown'}, {target}))
      .toThrow('Loading asset list not found: unknown');
  });

  it('exposes loading compatibility blocks as hidden blocks', () => {
    const extension = new AssetManagerExtension();
    const blocks = extension.getInfo().blocks;

    expect(blocks.find((block) => block.opcode === 'setLoadingCostumes'))
      .toMatchObject({hideFromPalette: true});
    expect(blocks.find((block) => block.opcode === 'prepareLoadingAssets'))
      .toMatchObject({hideFromPalette: true});
    expect(blocks.find((block) => block.opcode === 'loadingAssetCount'))
      .toMatchObject({hideFromPalette: true});
    expect(blocks.find((block) => block.opcode === 'loadingCostumeAt'))
      .toMatchObject({
        hideFromPalette: true,
        arguments: {INDEX: {type: 'number', defaultValue: '1'}}
      });
  });
});
