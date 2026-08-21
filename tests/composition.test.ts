import {
  DOMParser as XMLDOMParser,
  XMLSerializer as XMLDOMSerializer
} from '@xmldom/xmldom';
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
  const runtimeListeners = new Map<string, Array<(target?: TurboWarpTarget) => void>>();
  const runtimeOn = vi.fn((eventName: string, listener: (target?: TurboWarpTarget) => void) => {
    const listeners = runtimeListeners.get(eventName) ?? [];
    listeners.push(listener);
    runtimeListeners.set(eventName, listeners);
  });
  const runtimeOff = vi.fn((eventName: string, listener: (target?: TurboWarpTarget) => void) => {
    const listeners = runtimeListeners.get(eventName) ?? [];
    runtimeListeners.set(eventName, listeners.filter((candidate) => candidate !== listener));
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
    runtimeListeners.clear();
    runtimeOn.mockClear();
    runtimeOff.mockClear();
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
          on: runtimeOn,
          off: runtimeOff
        }
      },
      extensions: {unsandboxed: true, register: registerExtension},
      BlockType: {COMMAND: 'command', BOOLEAN: 'boolean', REPORTER: 'reporter'},
      ArgumentType: {STRING: 'string', NUMBER: 'number'},
      translate: (text: string) => text
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('controls independent embedded audio voices by instance gain and stop', async () => {
    const instances: TestAudio[] = [];
    const createObjectURL = vi.spyOn(URL, 'createObjectURL')
      .mockImplementation(() => `blob:voice-${instances.length + 1}`);
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    class TestAudio extends EventTarget {
      currentTime = 12;
      volume = 1;
      pause = vi.fn();
      play = vi.fn(() => Promise.resolve());
      constructor(readonly src: string) {
        super();
        instances.push(this);
      }
    }
    vi.stubGlobal('Audio', TestAudio);
    const assets = createAssetManagerComposition();
    await assets.registerEmbeddedAsset({
      name: 'Music',
      sourceName: 'music.mp3',
      mimeType: 'audio/mpeg',
      bytes: new Uint8Array([1, 2, 3])
    });

    const first = await assets.createAudioVoice('Music', {gain: 0});
    const second = await assets.createAudioVoice('Music', {gain: 0.25});

    expect(Object.isFrozen(first)).toBe(true);
    expect(instances).toHaveLength(2);
    expect(instances[0]?.volume).toBe(0);
    expect(instances[1]?.volume).toBe(0.25);
    first.setGain(0.75);
    expect(instances[0]?.volume).toBe(0.75);
    expect(instances[1]?.volume).toBe(0.25);

    first.stop();
    first.stop();
    await first.ended;
    expect(instances[0]?.pause).toHaveBeenCalledOnce();
    expect(instances[0]?.currentTime).toBe(0);
    expect(instances[1]?.pause).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    instances[1]?.dispatchEvent(new Event('ended'));
    await second.ended;
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(() => second.setGain(Number.NaN)).toThrow(/finite number from 0 to 1/u);
    assets.releaseAll();
  });

  it('creates a gain-controlled voice from reloadable project sound bytes', async () => {
    const audioInstances: Array<{volume: number; play: ReturnType<typeof vi.fn>}> = [];
    const soundType = {runtimeFormat: 'wav'};
    const load = vi.fn(async () => ({data: new Uint8Array([4, 5, 6])}));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:project-voice');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.stubGlobal('Audio', class extends EventTarget {
      currentTime = 0;
      volume = 1;
      pause = vi.fn();
      play = vi.fn(() => Promise.resolve());
      constructor(_src: string) {
        super();
        audioInstances.push(this);
      }
    });
    Scratch.vm.runtime.storage = {
      AssetType: {
        ImageVector: {runtimeFormat: 'svg'},
        ImageBitmap: {runtimeFormat: 'png'},
        Sound: soundType
      },
      get: vi.fn(() => null),
      load
    };
    const assets = createAssetManagerComposition();
    await assets.registerProjectAsset({name: 'Opening', resourceId: 'sound:@stage:Opening'});

    const voice = await assets.createAudioVoice('Opening', {gain: 0.4});

    expect(load).toHaveBeenCalledWith(soundType, 'opening', 'wav');
    expect(audioInstances[0]?.volume).toBe(0.4);
    expect(playProjectSound).not.toHaveBeenCalled();
    voice.stop();
    await voice.ended;
    assets.releaseAll();
  });

  it('stops every managed voice through asset and composition lifecycle methods', async () => {
    const instances: TestAudio[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:lifecycle-${instances.length}`);
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    class TestAudio extends EventTarget {
      currentTime = 1;
      volume = 1;
      pause = vi.fn();
      play = vi.fn(() => Promise.resolve());
      constructor(_src: string) {
        super();
        instances.push(this);
      }
    }
    vi.stubGlobal('Audio', TestAudio);
    const assets = createAssetManagerComposition();
    for (const name of ['A', 'B', 'C']) {
      await assets.registerEmbeddedAsset({
        name,
        sourceName: `${name}.wav`,
        mimeType: 'audio/wav',
        bytes: new Uint8Array([1])
      });
    }
    const a1 = await assets.createAudioVoice('A');
    const a2 = await assets.createAudioVoice('A');
    const b = await assets.createAudioVoice('B');
    const c = await assets.createAudioVoice('C');

    assets.stopSound('A');
    await Promise.all([a1.ended, a2.ended]);
    expect(instances[0]?.pause).toHaveBeenCalledOnce();
    expect(instances[1]?.pause).toHaveBeenCalledOnce();
    expect(instances[2]?.pause).not.toHaveBeenCalled();
    expect(instances[3]?.pause).not.toHaveBeenCalled();

    assets.stopAllSounds();
    await Promise.all([b.ended, c.ended]);
    expect(instances[2]?.pause).toHaveBeenCalledOnce();
    expect(instances[3]?.pause).toHaveBeenCalledOnce();

    const replacementB = await assets.createAudioVoice('B');
    assets.releaseAsset('B');
    await replacementB.ended;
    expect(instances[4]?.pause).toHaveBeenCalledOnce();

    const replacementC = await assets.createAudioVoice('C');
    assets.releaseAll();
    await replacementC.ended;
    expect(instances[5]?.pause).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledTimes(6);
  });

  it('rejects invalid voice options and releases failed playback resources once', async () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:failed-voice');
    vi.stubGlobal('Audio', class extends EventTarget {
      currentTime = 0;
      volume = 1;
      pause = vi.fn();
      play = vi.fn(() => Promise.reject(new Error('play blocked')));
      constructor(_src: string) {
        super();
      }
    });
    const assets = createAssetManagerComposition();
    await assets.registerEmbeddedAsset({
      name: 'Music',
      sourceName: 'music.ogg',
      mimeType: 'audio/ogg',
      bytes: new Uint8Array([1])
    });

    await expect(assets.createAudioVoice('Music', {gain: 2})).rejects
      .toThrow(/finite number from 0 to 1/u);
    await expect(assets.createAudioVoice('Music', {unknown: true} as never)).rejects
      .toThrow(/unknown property/u);
    await expect(assets.createAudioVoice('Music')).rejects.toMatchObject({
      code: 'PLAYBACK_FAILED',
      operation: 'createAudioVoice',
      assetName: 'Music'
    });
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    assets.releaseAll();
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

  it('resolves project image bytes into a releasable DOM resource without renderer skins', async () => {
    vi.stubGlobal('DOMParser', XMLDOMParser);
    vi.stubGlobal('XMLSerializer', XMLDOMSerializer);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:beach');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const vectorType = {runtimeFormat: 'svg'};
    const load = vi.fn(async () => ({
      data: new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"/>'
      )
    }));
    Scratch.vm.runtime.storage = {
      AssetType: {ImageVector: vectorType, ImageBitmap: {runtimeFormat: 'png'}},
      get: vi.fn(() => null),
      load
    };
    const assets = createAssetManagerComposition();
    await assets.registerProjectAsset({name: 'Beach', resourceId: 'backdrop:Beach'});

    const resource = await assets.resolveDOMImageResource('Beach');

    expect(resource).toMatchObject({
      url: 'blob:beach',
      mimeType: 'image/svg+xml',
      width: 480,
      height: 360,
      released: false
    });
    expect(load).toHaveBeenCalledWith(vectorType, 'beach', 'svg');
    expect(createSVGSkin).not.toHaveBeenCalled();
    expect(createBitmapSkin).not.toHaveBeenCalled();
    expect(updateDrawableSkinId).not.toHaveBeenCalled();

    resource.release();
    resource.release();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
  });

  it('shares verified DOM image backing while leases overlap and detaches lifecycle listeners', async () => {
    let objectURLSequence = 0;
    const createObjectURL = vi.spyOn(URL, 'createObjectURL')
      .mockImplementation(() => `blob:shared-${++objectURLSequence}`);
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const close = vi.fn();
    const createImageBitmap = vi.fn(async () => ({width: 10, height: 20, close}));
    vi.stubGlobal('createImageBitmap', createImageBitmap);
    const assets = createAssetManagerComposition();
    await assets.registerEmbeddedAsset({
      name: 'Shared',
      sourceName: 'shared.png',
      mimeType: 'image/png',
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    });

    const first = await assets.resolveDOMImageResource('Shared');
    const second = await assets.resolveDOMImageResource('Shared');

    expect(first).not.toBe(second);
    expect(first.url).toBe('blob:shared-1');
    expect(second.url).toBe(first.url);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(createImageBitmap).toHaveBeenCalledOnce();
    expect(runtimeListeners.get('PROJECT_STOP_ALL')).toHaveLength(1);

    first.release();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    second.release();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(runtimeListeners.get('PROJECT_STOP_ALL')).toHaveLength(0);
    expect(runtimeListeners.get('PROJECT_LOADED')).toHaveLength(0);
    expect(runtimeListeners.get('RUNTIME_DISPOSED')).toHaveLength(0);

    const attributes = new Map<string, string>();
    const image = {
      namespaceURI: 'http://www.w3.org/2000/svg',
      localName: 'image',
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => {
        attributes.delete(name);
      }
    };
    const third = await assets.applyDOMImageResource('Shared', image);
    const fourth = await assets.applyDOMImageResource('Shared', image);
    expect(third.released).toBe(true);
    expect(fourth.url).toBe('blob:shared-2');
    expect(attributes.get('href')).toBe('blob:shared-2');
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(createImageBitmap).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    fourth.release();
    expect(attributes.has('href')).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('releases DOM bindings on reapply, stop, reload, owner destruction, and replacement', async () => {
    vi.stubGlobal('DOMParser', XMLDOMParser);
    vi.stubGlobal('XMLSerializer', XMLDOMSerializer);
    let objectURLSequence = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:image-${++objectURLSequence}`);
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const attributes = new Map<string, string>();
    const image = {
      namespaceURI: 'http://www.w3.org/2000/svg',
      localName: 'image',
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => {
        attributes.delete(name);
      }
    };
    const assets = createAssetManagerComposition();
    const svg = (width: number) => new TextEncoder().encode(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="10"/>`
    );
    await assets.registerEmbeddedAsset({
      name: 'First', sourceName: 'first.svg', mimeType: 'image/svg+xml', bytes: svg(10)
    });
    await assets.registerEmbeddedAsset({
      name: 'Second', sourceName: 'second.svg', mimeType: 'image/svg+xml', bytes: svg(20)
    });

    const first = await assets.applyDOMImageResource('First', image, {owner: actor});
    const second = await assets.applyDOMImageResource('Second', image, {owner: actor});
    expect(first.released).toBe(true);
    expect(second.released).toBe(false);
    expect(attributes.get('href')).toBe('blob:image-2');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:image-1');

    for (const listener of runtimeListeners.get('PROJECT_STOP_ALL') ?? []) listener();
    expect(second.released).toBe(true);
    expect(attributes.has('href')).toBe(false);
    expect(assets.isRegistered('Second')).toBe(true);

    const afterStop = await assets.applyDOMImageResource('First', image, {owner: actor});
    for (const listener of runtimeListeners.get('PROJECT_LOADED') ?? []) listener();
    expect(afterStop.released).toBe(true);

    const afterReload = await assets.applyDOMImageResource('First', image, {owner: actor});
    Scratch.vm.runtime.targets.splice(Scratch.vm.runtime.targets.indexOf(actor), 1);
    for (const listener of runtimeListeners.get('STOP_FOR_TARGET') ?? []) listener(actor);
    expect(afterReload.released).toBe(true);

    const beforeReplacement = await assets.applyDOMImageResource('First', image);
    await assets.registerEmbeddedAsset({
      name: 'First', sourceName: 'new.svg', mimeType: 'image/svg+xml', bytes: svg(30)
    });
    expect(beforeReplacement.released).toBe(true);
    expect(attributes.has('href')).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledTimes(5);
    expect(createSVGSkin).not.toHaveBeenCalled();
    expect(createBitmapSkin).not.toHaveBeenCalled();
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
