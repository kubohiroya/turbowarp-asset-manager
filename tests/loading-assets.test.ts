import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {AssetManagerExtension} from '../src/extension.js';

describe('loading assets', () => {
  const assetList = {
    value: [
      'scene,https://example.com/scene.png',
      'loading2,https://example.com/loading2.png',
      'voice,https://example.com/voice.mp3',
      'loading1,https://example.com/loading1.png',
      'loadingBackdrop,https://example.com/loading-backdrop.png'
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
      'loading1,https://example.com/loading1.png',
      'loadingBackdrop,https://example.com/loading-backdrop.png'
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
    extension.setLoadingBackdrop({NAME: ' loadingBackdrop '});
    extension.setLoadingCostumes({NAMES: ' loading1, loading2, loading1, '});

    extension.prepareLoadingAssets({LIST: 'assetList'}, {target});

    expect(assetList.value).toEqual([
      'loadingBackdrop,https://example.com/loading-backdrop.png',
      'loading2,https://example.com/loading2.png',
      'loading1,https://example.com/loading1.png',
      'scene,https://example.com/scene.png',
      'voice,https://example.com/voice.mp3'
    ]);
    expect(extension.loadingAssetCount()).toBe(3);
    expect(extension.loadingBackdrop()).toBe('loadingBackdrop');
    expect(extension.loadingCostumeAt({INDEX: 1})).toBe('loading1');
    expect(extension.loadingCostumeAt({INDEX: 2})).toBe('loading2');
    expect(extension.loadingCostumeAt({INDEX: 3})).toBe('loading1');
    expect(extension.loadingCostumeAt({INDEX: 0})).toBe('loading1');
  });

  it('rejects missing list variables and undeclared loading assets', () => {
    const extension = new AssetManagerExtension();
    extension.setLoadingBackdrop({NAME: 'missingBackdrop'});
    extension.setLoadingCostumes({NAMES: 'missingCostume'});

    expect(() => extension.prepareLoadingAssets({LIST: 'assetList'}, {target}))
      .toThrow('Loading asset is not declared: missingBackdrop, missingCostume');
    expect(() => extension.prepareLoadingAssets({LIST: 'unknown'}, {target}))
      .toThrow('Loading asset list not found: unknown');
  });

  it('deduplicates a shared backdrop and costume name and resets an empty backdrop', () => {
    const extension = new AssetManagerExtension();
    extension.setLoadingBackdrop({NAME: 'loading1'});
    extension.setLoadingCostumes({NAMES: 'loading1, loading2'});

    extension.prepareLoadingAssets({LIST: 'assetList'}, {target});

    expect(assetList.value.slice(0, 2)).toEqual([
      'loading1,https://example.com/loading1.png',
      'loading2,https://example.com/loading2.png'
    ]);
    expect(extension.loadingAssetCount()).toBe(2);

    extension.setLoadingBackdrop({NAME: '   '});
    expect(extension.loadingBackdrop()).toBe('');
    expect(extension.loadingAssetCount()).toBe(0);
  });

  it('exposes loading compatibility blocks as hidden blocks', () => {
    const extension = new AssetManagerExtension();
    const blocks = extension.getInfo().blocks;

    expect(blocks.find((block) => block.opcode === 'setLoadingBackdrop'))
      .toMatchObject({
        hideFromPalette: true,
        arguments: {NAME: {type: 'string', defaultValue: 'loadingBackdrop'}}
      });
    expect(blocks.find((block) => block.opcode === 'setLoadingCostumes'))
      .toMatchObject({hideFromPalette: true});
    expect(blocks.find((block) => block.opcode === 'prepareLoadingAssets'))
      .toMatchObject({hideFromPalette: true});
    expect(blocks.find((block) => block.opcode === 'loadingAssetCount'))
      .toMatchObject({hideFromPalette: true});
    expect(blocks.find((block) => block.opcode === 'loadingBackdrop'))
      .toMatchObject({hideFromPalette: true});
    expect(blocks.find((block) => block.opcode === 'loadingCostumeAt'))
      .toMatchObject({
        hideFromPalette: true,
        arguments: {INDEX: {type: 'number', defaultValue: '1'}}
      });
  });
});
