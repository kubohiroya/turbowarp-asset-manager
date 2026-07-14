import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {AnimatedAssetManagerExtension} from '../src/animation.js';

describe('actor costume animation', () => {
  const updateDrawableSkinId = vi.fn();
  const runtimeOn = vi.fn();
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

  beforeEach(() => {
    vi.useFakeTimers();
    updateDrawableSkinId.mockClear();
    runtimeOn.mockClear();
    vi.stubGlobal('Scratch', {
      vm: {
        runtime: {
          renderer: {
            createSVGSkin: vi.fn(() => 1),
            createBitmapSkin: vi.fn(() => 2),
            destroySkin: vi.fn(),
            updateDrawableSkinId
          },
          targets: [stage, sprite],
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
    return extension;
  }

  async function flushFrame(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
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
    extension.startActorSequence({ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.25,0.75'});
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

  it('rejects mismatched lists and non-positive durations', async () => {
    const extension = await createExtension();
    expect(() => extension.startActorLoop({
      ACTOR: 'Fish', COSTUMES: 'Fish1,Fish2', DURATIONS: '0.5'
    })).toThrow('same number of items');
    expect(() => extension.startActorSequence({
      ACTOR: 'Fish', COSTUMES: 'Fish1', DURATIONS: '0'
    })).toThrow('positive number');
  });
});
