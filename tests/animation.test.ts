import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {AnimatedAssetManagerExtension} from '../src/animation.js';

interface TestAnimationInternals {
  actorAnimations: Map<string, {target: TurboWarpTarget}>;
}

describe('actor costume animation', () => {
  const updateDrawableSkinId = vi.fn();
  const runtimeOn = vi.fn();
  const runtimeListeners = new Map<string, Array<(target?: TurboWarpTarget) => void>>();
  const sprite: TurboWarpTarget = {
    id: 'fish-id',
    isStage: false,
    isOriginal: true,
    drawableID: 7,
    sprite: {
      name: 'Fish',
      costumes: [
        {name: 'Fish1', assetId: 'fish-1', skinId: 11, dataFormat: 'png'},
        {name: 'Fish2', assetId: 'fish-2', skinId: 12, dataFormat: 'png'},
        {name: 'Fish3', assetId: 'fish-3', skinId: 13, dataFormat: 'png'}
      ],
      sounds: []
    }
  };
  const stage: TurboWarpTarget = {
    id: 'stage-id',
    isStage: true,
    isOriginal: true,
    drawableID: 0,
    sprite: {name: 'Stage', costumes: [], sounds: []}
  };
  const clone: TurboWarpTarget = {
    id: 'fish-clone-id',
    isStage: false,
    isOriginal: false,
    drawableID: 8,
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
    updateDrawableSkinId.mockClear();
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

  it('plays a sequence once and leaves the final skin displayed', async () => {
    const extension = await createExtension();
    expect(extension.startActorSequence({
      ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.25,0.75'
    })).toBeUndefined();
    await flushFrame();
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 11);

    await vi.advanceTimersByTimeAsync(250);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 12);

    await vi.advanceTimersByTimeAsync(750);
    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 12);
    expect(updateDrawableSkinId).toHaveBeenCalledTimes(2);
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
  });

  it('replaces an existing animation for the same actor', async () => {
    const extension = await createExtension();
    extension.startActorLoop({ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.1,0.1'});
    await flushFrame();
    extension.startActorSequence({ACTOR: 'Fish', COSTUMES: 'Fish3', DURATIONS: '0.2'});
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
    })).toThrow('Costume asset is not registered: Missing');
  });

  it('rejects malformed costume and duration lists', async () => {
    const extension = await createExtension();
    expect(() => extension.startActorLoop({
      ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.5'
    })).toThrow('same number of items');
    expect(() => extension.startActorLoop({
      ACTOR: 'Fish', COSTUMES: 'Fish1,,Fish2', DURATIONS: '0.5,0.5,0.5'
    })).toThrow('COSTUMES contains an empty item');
    expect(() => extension.startActorSequence({
      ACTOR: 'Fish', COSTUMES: 'Fish1', DURATIONS: '0'
    })).toThrow('positive number');
    expect(() => extension.startActorSequence({
      ACTOR: 'Fish', COSTUMES: 'Fish1', DURATIONS: 'later'
    })).toThrow('positive number');
    expect(() => extension.startActorSequence({
      ACTOR: 'Fish', COSTUMES: '', DURATIONS: ''
    })).toThrow('COSTUMES is empty');
  });
});
