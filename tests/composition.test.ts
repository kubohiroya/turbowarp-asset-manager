import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {createAssetManagerComposition} from '../src/composition.js';

describe('Asset Manager composition API', () => {
  const createSVGSkin = vi.fn(() => 41);
  const createBitmapSkin = vi.fn(() => 42);
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
      costumes: [{name: 'Beach', assetId: 'beach', skinId: 10, dataFormat: 'svg'}],
      sounds: [{name: 'Opening', assetId: 'opening', soundId: 'opening-sound', dataFormat: 'wav'}],
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
    sprite: {name: 'Actor', costumes: [], sounds: []}
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
});
