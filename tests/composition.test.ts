import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {createAssetManagerComposition} from '../src/composition.js';

describe('Asset Manager composition API', () => {
  const createSVGSkin = vi.fn(() => 41);
  const createBitmapSkin = vi.fn((_bitmap: ImageBitmap, _resolution: number) => 42);
  const destroySkin = vi.fn();
  const updateDrawableSkinId = vi.fn();
  const playProjectSound = vi.fn(() => Promise.resolve());
  const stopProjectSound = vi.fn();
  const stopAllProjectSounds = vi.fn();
  const registerExtension = vi.fn();
  const fetchAsset = vi.fn(() => Promise.reject(new Error('network must not be used')));
  const openDatabase = vi.fn(() => {
    throw new Error('IndexedDB must not be used');
  });
  const stage: TurboWarpTarget = {
    id: 'stage',
    isStage: true,
    isOriginal: true,
    drawableID: 0,
    size: 100,
    setSize: vi.fn(),
    sprite: {
      name: 'Stage',
      costumes: [
        {name: 'Beach', assetId: 'beach', skinId: 10, dataFormat: 'svg'},
        {name: ' Back.drop/\u0001: ', assetId: 'literal-backdrop', skinId: 11, dataFormat: 'svg'}
      ],
      sounds: [
        {name: 'Opening', assetId: 'opening', soundId: 'opening-sound', dataFormat: 'wav'},
        {name: ' Sound/\n: ', assetId: 'literal-sound', soundId: 'literal-sound', dataFormat: 'wav'}
      ],
      soundBank: {
        playSound: playProjectSound,
        stop: stopProjectSound,
        stopAllSounds: stopAllProjectSounds
      }
    }
  };
  const actor: TurboWarpTarget = {
    id: 'actor',
    isStage: false,
    isOriginal: false,
    drawableID: 7,
    size: 100,
    setSize: vi.fn(),
    sprite: {
      name: ' Actor/\u0001: ',
      costumes: [
        {name: ' Cost.ume/\u0001: ', assetId: 'literal-costume', skinId: 12, dataFormat: 'svg'}
      ],
      sounds: []
    }
  };

  beforeEach(() => {
    createSVGSkin.mockClear();
    createBitmapSkin.mockClear();
    destroySkin.mockClear();
    updateDrawableSkinId.mockClear();
    playProjectSound.mockClear();
    stopProjectSound.mockClear();
    stopAllProjectSounds.mockClear();
    registerExtension.mockClear();
    fetchAsset.mockClear();
    openDatabase.mockClear();
    vi.stubGlobal('fetch', fetchAsset);
    vi.stubGlobal('indexedDB', {open: openDatabase});
    vi.stubGlobal('createImageBitmap', vi.fn());
    vi.stubGlobal('Scratch', {
      vm: {
        runtime: {
          renderer: {
            createSVGSkin,
            createBitmapSkin,
            destroySkin,
            updateDrawableSkinId
          },
          targets: [stage, actor],
          requestRedraw: vi.fn(),
          on: vi.fn()
        }
      },
      extensions: {unsandboxed: true, register: registerExtension},
      BlockType: {COMMAND: 'command', BOOLEAN: 'boolean', REPORTER: 'reporter'},
      ArgumentType: {STRING: 'string', NUMBER: 'number'},
      translate: (text: string) => text
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates frozen private registries without registering a Standalone extension', async () => {
    const first = createAssetManagerComposition();
    const second = createAssetManagerComposition();
    expect(Object.isFrozen(first)).toBe(true);
    expect(registerExtension).not.toHaveBeenCalled();

    await first.registerProjectAsset({name: 'Beach', resourceId: 'backdrop:Beach'});
    await second.registerProjectAsset({name: 'Beach', resourceId: 'backdrop:Beach'});
    first.releaseAsset('Beach');
    expect(first.isRegistered('Beach')).toBe(false);
    expect(second.isRegistered('Beach')).toBe(true);
  });

  it('uses existing project backdrop and sound semantics', async () => {
    const assets = createAssetManagerComposition();
    expect(await assets.registerProjectAsset({name: 'Beach', resourceId: 'backdrop:Beach'}))
      .toEqual({name: 'Beach', mimeType: 'image/svg+xml'});
    await assets.applyToStage('Beach');
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(0, 10);

    await assets.registerProjectAsset({name: 'Opening', resourceId: 'sound:@stage:Opening'});
    await assets.playSound('Opening', {untilDone: true});
    expect(playProjectSound).toHaveBeenLastCalledWith(stage, 'opening-sound');
    assets.stopSound('Opening');
    expect(stopProjectSound).toHaveBeenLastCalledWith(stage, 'opening-sound');
    stopProjectSound.mockClear();
    assets.releaseAll();
    expect(stopProjectSound).toHaveBeenCalledWith(stage, 'opening-sound');
    expect(stopAllProjectSounds).not.toHaveBeenCalled();
    expect(assets.isRegistered('Opening')).toBe(false);
  });

  it('keeps literal logical names and structured project locators byte-for-byte', async () => {
    const assets = createAssetManagerComposition();
    const backdropId = ' Backdrop ID/\u0001: ';
    const costumeId = ' Costume ID/\n: ';
    const soundId = ' Sound ID/\u007f: ';

    await expect(assets.registerProjectAsset({
      name: backdropId,
      locator: {kind: 'backdrop', name: ' Back.drop/\u0001: '}
    })).resolves.toEqual({name: backdropId, mimeType: 'image/svg+xml'});
    await assets.applyToStage(backdropId);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(0, 11);

    await expect(assets.registerProjectAsset({
      name: costumeId,
      locator: {
        kind: 'costume',
        target: ' Actor/\u0001: ',
        name: ' Cost.ume/\u0001: '
      }
    })).resolves.toEqual({name: costumeId, mimeType: 'image/svg+xml'});
    await assets.applyToTarget(costumeId, actor);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 12);

    await expect(assets.registerProjectAsset({
      name: soundId,
      locator: {kind: 'sound', name: ' Sound/\n: '}
    })).resolves.toEqual({name: soundId, mimeType: 'audio/wav'});
    await assets.playSound(soundId, {untilDone: true});
    expect(playProjectSound).toHaveBeenLastCalledWith(stage, 'literal-sound');

    expect(assets.isRegistered(backdropId)).toBe(true);
    expect(assets.isRegistered(backdropId.trim())).toBe(false);
    assets.releaseAll();
    expect(assets.isRegistered(backdropId)).toBe(false);
  });

  it('supports literal embedded asset IDs without changing the trimmed default', async () => {
    const assets = createAssetManagerComposition();
    const literalId = ' Embedded/\u0001: ';
    await expect(assets.registerEmbeddedAsset({
      name: literalId,
      nameMode: 'literal',
      sourceName: 'literal.svg',
      mimeType: 'image/svg+xml',
      bytes: new TextEncoder().encode('<svg/>')
    })).resolves.toEqual({name: literalId, mimeType: 'image/svg+xml'});
    expect(assets.isRegistered(literalId)).toBe(true);
    expect(assets.isRegistered(literalId.trim())).toBe(false);
    assets.releaseAsset(literalId);
    expect(assets.isRegistered(literalId)).toBe(false);
  });

  it('rejects malformed structured locators before publishing a registration', async () => {
    const assets = createAssetManagerComposition();
    for (const input of [
      {name: 'Missing', locator: {kind: 'costume', name: 'Costume'}},
      {name: 'Unknown', locator: {kind: 'image', name: 'Image'}},
      {name: 'Extra', locator: {kind: 'backdrop', name: 'Beach', target: 'Stage'}},
      {name: 'Both', locator: {kind: 'backdrop', name: 'Beach'}, resourceId: 'backdrop:Beach'}
    ]) {
      await expect(assets.registerProjectAsset(input as never)).rejects.toThrow();
      expect(assets.isRegistered(input.name)).toBe(false);
    }
  });

  it('copies embedded SVG bytes without fetch or IndexedDB and releases its owned skin once', async () => {
    const assets = createAssetManagerComposition();
    const source = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" id="original"/>');
    expect(await assets.registerEmbeddedAsset({
      name: 'OpeningImage',
      sourceName: 'opening.svg',
      mimeType: 'application/octet-stream',
      bytes: source
    })).toEqual({name: 'OpeningImage', mimeType: 'image/svg+xml'});
    source.fill(0);

    await assets.applyToTarget('OpeningImage', actor);
    expect(createSVGSkin).toHaveBeenCalledWith(
      '<svg xmlns="http://www.w3.org/2000/svg" id="original"/>'
    );
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 41);
    expect(fetchAsset).not.toHaveBeenCalled();
    expect(openDatabase).not.toHaveBeenCalled();

    assets.releaseAsset('OpeningImage');
    assets.releaseAsset('OpeningImage');
    expect(destroySkin).toHaveBeenCalledTimes(1);
    expect(destroySkin).toHaveBeenCalledWith(41);
  });

  it('preserves explicit embedded bitmap resolution and defaults it to one', async () => {
    const assets = createAssetManagerComposition();
    await assets.registerEmbeddedAsset({
      name: 'RetinaCostume',
      sourceName: 'retina.png',
      mimeType: 'image/png',
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      bitmapResolution: 2
    });
    await assets.applyToTarget('RetinaCostume', actor);
    expect(createBitmapSkin.mock.calls.at(-1)?.[1]).toBe(2);

    await assets.registerEmbeddedAsset({
      name: 'DefaultCostume',
      sourceName: 'default.png',
      mimeType: 'image/png',
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    });
    await assets.applyToTarget('DefaultCostume', actor);
    expect(createBitmapSkin.mock.calls.at(-1)?.[1]).toBe(1);
  });

  it('rejects invalid or non-bitmap resolution without replacing an existing asset', async () => {
    const assets = createAssetManagerComposition();
    await assets.registerEmbeddedAsset({
      name: 'Kept',
      sourceName: 'kept.svg',
      mimeType: 'image/svg+xml',
      bytes: new TextEncoder().encode('<svg/>')
    });

    for (const input of [
      {name: 'Zero', sourceName: 'zero.png', mimeType: 'image/png', bitmapResolution: 0},
      {name: 'Three', sourceName: 'three.png', mimeType: 'image/png', bitmapResolution: 3},
      {name: 'Fraction', sourceName: 'fraction.png', mimeType: 'image/png', bitmapResolution: 1.5},
      {name: 'String', sourceName: 'string.png', mimeType: 'image/png', bitmapResolution: '2'},
      {name: 'Vector', sourceName: 'vector.svg', mimeType: 'image/svg+xml', bitmapResolution: 2},
      {name: 'Audio', sourceName: 'audio.wav', mimeType: 'audio/wav', bitmapResolution: 2},
      {name: 'Kept', sourceName: 'kept.png', mimeType: 'image/png', bitmapResolution: 3}
    ]) {
      await expect(assets.registerEmbeddedAsset({
        ...input,
        bytes: new Uint8Array([1])
      } as never)).rejects.toMatchObject({
        code: input.name === 'Vector' || input.name === 'Audio'
          ? 'ASSET_TYPE_MISMATCH'
          : 'RESOURCE_ID_INVALID'
      });
    }

    for (const name of ['Zero', 'Three', 'Fraction', 'String', 'Vector', 'Audio']) {
      expect(assets.isRegistered(name)).toBe(false);
    }
    expect(assets.getMimeType('Kept')).toBe('image/svg+xml');
  });

  it('registers embedded audio in memory and rejects invalid input without registration', async () => {
    const assets = createAssetManagerComposition();
    await expect(assets.registerEmbeddedAsset({
      name: 'OpeningSound',
      sourceName: 'opening.wav',
      mimeType: '',
      bytes: new Uint8Array([82, 73, 70, 70])
    })).resolves.toEqual({name: 'OpeningSound', mimeType: 'audio/wav'});
    expect(assets.getMimeType('OpeningSound')).toBe('audio/wav');

    for (const input of [
      {name: '', mimeType: 'image/png', bytes: new Uint8Array([1])},
      {name: 'Empty', mimeType: 'image/png', bytes: new Uint8Array()},
      {name: 'Text', mimeType: 'text/plain', bytes: new Uint8Array([1])},
      {name: 'Wrong', mimeType: 'image/png', bytes: 'not bytes'}
    ]) {
      await expect(assets.registerEmbeddedAsset(input as never)).rejects.toThrow();
    }
    for (const name of ['', 'Empty', 'Text', 'Wrong']) {
      expect(assets.isRegistered(name)).toBe(false);
    }
    expect(fetchAsset).not.toHaveBeenCalled();
    expect(openDatabase).not.toHaveBeenCalled();
  });

  it('cancels a pending registration when its owner releases it', async () => {
    const assets = createAssetManagerComposition();
    const pending = assets.registerEmbeddedAsset({
      name: 'Late',
      sourceName: 'late.svg',
      mimeType: 'image/svg+xml',
      bytes: new TextEncoder().encode('<svg/>')
    });
    assets.releaseAsset('Late');
    await expect(pending).rejects.toMatchObject({name: 'AbortError'});
    expect(assets.isRegistered('Late')).toBe(false);
    expect(createSVGSkin).not.toHaveBeenCalled();
  });

  it('keeps the binary bundle store lazy and releases it explicitly', async () => {
    const assets = createAssetManagerComposition(undefined, {
      binaryBundleStore: {indexedDB: {open: openDatabase} as unknown as IDBFactory}
    });
    await assets.releaseBinaryStore();
    expect(openDatabase).not.toHaveBeenCalled();

    await expect(
      assets.getBinaryBundle({
        namespace: 'story-001/source-integrity',
        name: 'RescuePose',
        integrity: `sha256-${'0'.repeat(64)}`
      })
    ).rejects.toMatchObject({code: 'ASSET_BINARY_BUNDLE_RELEASED'});
    expect(registerExtension).not.toHaveBeenCalled();
  });

  it('creates an explicitly disabled session backing without opening IndexedDB', async () => {
    const open = vi.fn(() => {
      throw new Error('IndexedDB must remain disabled');
    });
    const release = vi.fn();
    const assets = createAssetManagerComposition(undefined, {
      sessionBinaryBacking: {indexedDB: {open} as unknown as IDBFactory}
    });
    const backing = await assets.createSessionBinaryBacking({
      policy: 'disabled',
      sessionId: 'direct-session',
      assets: [
        {
          namespace: 'story/source-integrity',
          name: 'Pose',
          integrity: `sha256-${'0'.repeat(64)}`,
          files: [
            {
              path: 'weights.bin',
              size: 1,
              integrity: `sha256-${'1'.repeat(64)}`
            }
          ]
        }
      ],
      source: {
        async read() {
          throw new Error('not materialized in this test');
        },
        release
      }
    });

    expect(backing.mode).toBe('direct');
    expect(open).not.toHaveBeenCalled();
    await backing.dispose();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
