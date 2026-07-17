import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {AnimatedAssetManagerExtension} from '../src/animation.js';

interface TestAnimationInternals {
  actorAnimations: Map<string, {target: TurboWarpTarget}>;
}

describe('actor costume animation', () => {
  const updateDrawableSkinId = vi.fn();
  const playSound = vi.fn(() => Promise.resolve());
  const setFishSize = vi.fn();
  const setStageSize = vi.fn();
  const setCloneSize = vi.fn();
  const setBirdSize = vi.fn();
  const runtimeOn = vi.fn();
  const runtimeListeners = new Map<string, Array<(target?: TurboWarpTarget) => void>>();
  const sprite: TurboWarpTarget = {
    id: 'fish-id',
    isStage: false,
    isOriginal: true,
    drawableID: 7,
    size: 160,
    setSize: setFishSize,
    sprite: {
      name: 'Fish',
      costumes: [
        {name: 'Fish1', assetId: 'fish-1', skinId: 11, dataFormat: 'png'},
        {name: 'Fish2', assetId: 'fish-2', skinId: 12, dataFormat: 'png'},
        {name: 'Fish3', assetId: 'fish-3', skinId: 13, dataFormat: 'png'}
      ],
      sounds: [
        {name: 'Bell', assetId: 'bell', soundId: 'bell-sound', dataFormat: 'wav'},
        {name: 'Chime', assetId: 'chime', soundId: 'chime-sound', dataFormat: 'mp3'}
      ],
      soundBank: {playSound}
    }
  };
  const stage: TurboWarpTarget = {
    id: 'stage-id',
    isStage: true,
    isOriginal: true,
    drawableID: 0,
    size: 100,
    setSize: setStageSize,
    sprite: {name: 'Stage', costumes: [], sounds: []}
  };
  const clone: TurboWarpTarget = {
    id: 'fish-clone-id',
    isStage: false,
    isOriginal: false,
    drawableID: 8,
    size: 100,
    setSize: setCloneSize,
    sprite: {
      name: 'FishClone',
      costumes: sprite.sprite!.costumes,
      sounds: []
    }
  };
  const bird: TurboWarpTarget = {
    id: 'bird-id',
    isStage: false,
    isOriginal: true,
    drawableID: 9,
    size: 80,
    setSize: setBirdSize,
    sprite: {
      name: 'Bird',
      costumes: [
        {name: 'Bird1', assetId: 'bird-1', skinId: 21, dataFormat: 'png'},
        {name: 'Bird2', assetId: 'bird-2', skinId: 22, dataFormat: 'png'}
      ],
      sounds: []
    }
  };

  beforeEach(() => {
    vi.useFakeTimers();
    sprite.size = 160;
    stage.size = 100;
    clone.size = 100;
    bird.size = 80;
    updateDrawableSkinId.mockClear();
    playSound.mockClear();
    setFishSize.mockClear();
    setStageSize.mockClear();
    setCloneSize.mockClear();
    setBirdSize.mockClear();
    setFishSize.mockImplementation((size: number) => { sprite.size = size; });
    setStageSize.mockImplementation((size: number) => { stage.size = size; });
    setCloneSize.mockImplementation((size: number) => { clone.size = size; });
    setBirdSize.mockImplementation((size: number) => { bird.size = size; });
    runtimeOn.mockClear();
    runtimeListeners.clear();
    runtimeOn.mockImplementation((eventName: string, listener: (target?: TurboWarpTarget) => void) => {
      const listeners = runtimeListeners.get(eventName) ?? [];
      listeners.push(listener);
      runtimeListeners.set(eventName, listeners);
    });
    vi.stubGlobal('Scratch', {
      vm: {
        runtime: {
          renderer: {
            createSVGSkin: vi.fn(() => 1),
            createBitmapSkin: vi.fn(() => 2),
            destroySkin: vi.fn(),
            updateDrawableSkinId
          },
          targets: [stage, sprite, clone, bird],
          requestRedraw: vi.fn(),
          on: runtimeOn
        }
      },
      extensions: {unsandboxed: true, register: vi.fn()},
      BlockType: {COMMAND: 'command', BOOLEAN: 'boolean', REPORTER: 'reporter'},
      ArgumentType: {STRING: 'string'},
      translate: (text: string) => text
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function createExtension(): Promise<AnimatedAssetManagerExtension> {
    const extension = new AnimatedAssetManagerExtension();
    await extension.registerAsset({RESOURCE_ID: 'costume:Fish:Fish1', NAME: 'Fish1'});
    await extension.registerAsset({RESOURCE_ID: 'costume:Fish:Fish2', NAME: 'Fish2'});
    await extension.registerAsset({RESOURCE_ID: 'costume:Fish:Fish3', NAME: 'Fish3'});
    await extension.registerAsset({RESOURCE_ID: 'costume:Bird:Bird1', NAME: 'Bird1'});
    await extension.registerAsset({RESOURCE_ID: 'costume:Bird:Bird2', NAME: 'Bird2'});
    await extension.registerAsset({RESOURCE_ID: 'sound:Fish:Bell', NAME: 'Bell'});
    await extension.registerAsset({RESOURCE_ID: 'sound:Fish:Chime', NAME: 'Chime'});
    return extension;
  }

  async function flushFrame(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  function emitRuntime(eventName: string, target?: TurboWarpTarget): void {
    for (const listener of runtimeListeners.get(eventName) ?? []) listener(target);
  }

  it('exposes loop, sequence, and stop blocks', () => {
    const extension = new AnimatedAssetManagerExtension();
    const opcodes = extension.getInfo().blocks.map((block) => block.opcode);
    expect(opcodes).toContain('startActorLoop');
    expect(opcodes).toContain('startActorSequence');
    expect(opcodes).toContain('stopActorAnimation');
  });

  it('loops comma-separated asset and duration strings in the background', async () => {
    const extension = await createExtension();
    extension.startActorLoop({ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.5,0.5'});
    await flushFrame();
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 11);

    await vi.advanceTimersByTimeAsync(500);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 12);

    await vi.advanceTimersByTimeAsync(500);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 11);
  });

  it('resynchronizes an expired deadline without zero-delay catch-up frames', async () => {
    const extension = await createExtension();
    extension.startActorLoop({ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.1,0.1'});

    // Simulate a background-tab delay while the current frame is being resolved.
    vi.advanceTimersByTime(1000);
    await flushFrame();
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 11);

    await vi.advanceTimersByTimeAsync(0);
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(99);
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 12);
  });

  it('plays a sequence once and leaves the final skin displayed', async () => {
    const extension = await createExtension();
    expect(extension.startActorSequence({
      ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.25'
    })).toBeUndefined();
    await flushFrame();
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 11);

    await vi.advanceTimersByTimeAsync(250);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 12);

    await vi.advanceTimersByTimeAsync(750);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 12);
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(2);
  });

  it('runs zero-duration image and audio assets with the preceding loop step', async () => {
    const extension = await createExtension();
    extension.startActorLoop({
      ACTOR: 'Fish',
      ASSETS: 'Fish1,Bell,Chime,Fish2',
      DURATIONS: '0,0,0.5,0.25'
    });
    await flushFrame();

    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 11);
    expect(playSound).toHaveBeenCalledTimes(2);
    expect(playSound).toHaveBeenCalledWith(sprite, 'bell-sound');
    expect(playSound).toHaveBeenCalledWith(sprite, 'chime-sound');

    await vi.advanceTimersByTimeAsync(499);
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 12);

    await vi.advanceTimersByTimeAsync(250);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 11);
    expect(playSound).toHaveBeenCalledTimes(4);
  });

  it('uses the final loop duration as the interval back to the first asset', async () => {
    const extension = await createExtension();
    extension.startActorLoop({
      ACTOR: 'Fish',
      ASSETS: 'Fish1,Fish2,Bell',
      DURATIONS: '0.1,0.1,0'
    });
    await flushFrame();
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 11);

    await vi.advanceTimersByTimeAsync(100);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 12);

    await vi.advanceTimersByTimeAsync(100);
    expect(playSound).toHaveBeenLastCalledWith(sprite, 'bell-sound');
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 11);
  });

  it('runs a sound-only sequence without waiting for playback to finish', async () => {
    const pendingPlayback = new Promise<void>(() => {});
    playSound.mockReturnValueOnce(pendingPlayback);
    const extension = await createExtension();

    extension.startActorSequence({
      ACTOR: 'Fish',
      ASSETS: 'Bell,Chime',
      DURATIONS: '0.1'
    });
    await flushFrame();
    expect(playSound).toHaveBeenLastCalledWith(sprite, 'bell-sound');

    await vi.advanceTimersByTimeAsync(100);
    expect(playSound).toHaveBeenLastCalledWith(sprite, 'chime-sound');

    await vi.advanceTimersByTimeAsync(200);
    expect(playSound).toHaveBeenCalledTimes(2);
    expect(updateDrawableSkinId).not.toHaveBeenCalled();
  });

  it('uses zero-duration grouping in a one-shot sequence', async () => {
    const extension = await createExtension();
    extension.startActorSequence({
      ACTOR: 'Fish',
      ASSETS: 'Fish1,Bell,Fish2',
      DURATIONS: '0,0.1'
    });
    await flushFrame();

    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 11);
    expect(playSound).toHaveBeenLastCalledWith(sprite, 'bell-sound');

    await vi.advanceTimersByTimeAsync(100);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 12);

    await vi.advanceTimersByTimeAsync(200);
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(2);
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it('allows every sequence interval to be zero', async () => {
    const extension = await createExtension();
    extension.startActorSequence({
      ACTOR: 'Fish',
      ASSETS: 'Fish1,Bell,Chime',
      DURATIONS: '0,0'
    });
    await flushFrame();

    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 11);
    expect(playSound).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledTimes(2);
  });

  it('applies only the last image in a simultaneous group', async () => {
    const extension = await createExtension();
    extension.startActorSequence({
      ACTOR: 'Fish',
      ASSETS: 'Fish1,Bird1,Bell',
      DURATIONS: '0,0'
    });
    await flushFrame();

    expect(updateDrawableSkinId).toHaveBeenCalledTimes(1);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 21);
    expect(setFishSize).toHaveBeenLastCalledWith(80);
    expect(playSound).toHaveBeenLastCalledWith(sprite, 'bell-sound');
  });

  it('applies each animation asset source size to the actor', async () => {
    const extension = await createExtension();
    extension.startActorSequence({
      ACTOR: 'Fish', COSTUMES: 'Fish1,Bird1', DURATIONS: '0.1'
    });
    await flushFrame();
    expect(setFishSize).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 21);
    expect(setFishSize).toHaveBeenLastCalledWith(80);
  });

  it('stops a loop when loop receives empty COSTUMES and DURATIONS', async () => {
    const extension = await createExtension();
    extension.startActorLoop({ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.1,0.1'});
    await flushFrame();
    extension.startActorLoop({ACTOR: 'Fish', COSTUMES: '', DURATIONS: ''});

    await vi.advanceTimersByTimeAsync(1000);
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(1);
  });

  it('stops explicitly without changing the displayed skin', async () => {
    const extension = await createExtension();
    extension.startActorLoop({ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.1,0.1'});
    await flushFrame();
    extension.stopActorAnimation({ACTOR: 'Fish'});

    await vi.advanceTimersByTimeAsync(1000);
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(1);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 11);
  });

  it('setSpriteSkin cancels an existing animation', async () => {
    const extension = await createExtension();
    extension.startActorLoop({ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.1,0.1'});
    await flushFrame();

    await extension.setSpriteSkin({SPRITE: 'Fish', NAME: 'Fish3'});
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 13);
    expect(setFishSize).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 13);
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(2);
  });

  it('setThisSpriteSkin cancels animation for the invoking clone only', async () => {
    const extension = await createExtension();
    extension.startActorLoop(
      {ACTOR: 'FishClone', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.1,0.1'},
      {target: clone}
    );
    await flushFrame();

    await extension.setThisSpriteSkin({NAME: 'Fish3'}, {target: clone});
    await vi.advanceTimersByTimeAsync(1000);
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(2);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(8, 13);
    expect(setCloneSize).toHaveBeenLastCalledWith(160);
    expect(setCloneSize).toHaveBeenCalledTimes(1);
  });

  it('replaces an existing animation for the same actor', async () => {
    const extension = await createExtension();
    extension.startActorLoop({ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.1,0.1'});
    await flushFrame();
    extension.startActorSequence({ACTOR: 'Fish', COSTUMES: 'Fish3', DURATIONS: ''});
    await flushFrame();

    await vi.advanceTimersByTimeAsync(1000);
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(2);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 13);
  });

  it('animates different actors independently', async () => {
    const extension = await createExtension();
    extension.startActorLoop({ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.1,0.1'});
    extension.startActorLoop({ACTOR: 'Bird', COSTUMES: 'Bird1,Bird2', DURATIONS: '0.2,0.2'});
    await flushFrame();
    expect(updateDrawableSkinId).toHaveBeenCalledWith(7, 11);
    expect(updateDrawableSkinId).toHaveBeenCalledWith(9, 21);

    await vi.advanceTimersByTimeAsync(200);
    expect(updateDrawableSkinId).toHaveBeenCalledWith(7, 12);
    expect(updateDrawableSkinId).toHaveBeenCalledWith(9, 22);
  });

  it('keys animation state by unique actor name and cleans up its deleted target', async () => {
    const extension = await createExtension();
    extension.startActorLoop(
      {ACTOR: 'FishClone', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.1,0.1'},
      {target: clone}
    );
    await flushFrame();
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(8, 11);
    const internals = extension as unknown as TestAnimationInternals;
    expect(internals.actorAnimations.get('FishClone')?.target).toBe(clone);

    emitRuntime('STOP_FOR_TARGET', clone);
    await vi.advanceTimersByTimeAsync(1000);
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(1);
    expect(internals.actorAnimations.has('FishClone')).toBe(false);
  });

  it('rejects duplicate ACTOR names as a project invariant violation', async () => {
    const extension = await createExtension();
    const duplicate: TurboWarpTarget = {
      ...clone,
      id: 'duplicate-fish-id',
      sprite: {...clone.sprite!, name: 'Fish'}
    };
    Scratch.vm.runtime.targets.push(duplicate);

    expect(() => extension.startActorLoop({
      ACTOR: 'Fish', COSTUMES: 'Fish1', DURATIONS: '0.1'
    })).toThrow('Actor name is not unique: Fish');
  });

  it('cleans up animations on green flag and project stop', async () => {
    const extension = await createExtension();
    extension.startActorLoop({ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.1,0.1'});
    await flushFrame();
    emitRuntime('PROJECT_START');
    await vi.advanceTimersByTimeAsync(1000);
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(1);

    extension.startActorLoop({ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.1,0.1'});
    await flushFrame();
    emitRuntime('PROJECT_STOP_ALL');
    await vi.advanceTimersByTimeAsync(1000);
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(2);
  });

  it('rejects missing actors and unregistered costume assets before starting', async () => {
    const extension = await createExtension();
    expect(() => extension.startActorLoop({
      ACTOR: 'Missing', COSTUMES: 'Fish1', DURATIONS: '0.5'
    })).toThrow('Actor not found: Missing');
    expect(() => extension.startActorLoop({
      ACTOR: 'Fish', COSTUMES: 'Missing', DURATIONS: '0.5'
    })).toThrow('Asset is not registered: Missing');
  });

  it('rejects malformed costume and duration lists', async () => {
    const extension = await createExtension();
    expect(() => extension.startActorLoop({
      ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.5'
    })).toThrow('loop requires 2 DURATIONS items');
    expect(() => extension.startActorLoop({
      ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.5,0.5,0.5'
    })).toThrow('loop requires 2 DURATIONS items');
    expect(() => extension.startActorLoop({
      ACTOR: 'Fish', COSTUMES: 'Fish1,,Fish2', DURATIONS: '0.5,0.5,0.5'
    })).toThrow('COSTUMES contains an empty item');
    expect(() => extension.startActorSequence({
      ACTOR: 'Fish', COSTUMES: 'Fish1', DURATIONS: '0'
    })).toThrow('requires 0 DURATIONS items');
    expect(() => extension.startActorSequence({
      ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2,Fish3', DURATIONS: '0.5'
    })).toThrow('requires 2 DURATIONS items');
    expect(() => extension.startActorSequence({
      ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '-1'
    })).toThrow('non-negative number');
    expect(() => extension.startActorSequence({
      ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: 'later'
    })).toThrow('non-negative number');
    expect(() => extension.startActorLoop({
      ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0,0'
    })).toThrow('at least one positive number');
    expect(() => extension.startActorSequence({
      ACTOR: 'Fish', COSTUMES: '', DURATIONS: ''
    })).toThrow('COSTUMES is empty');
  });
});
