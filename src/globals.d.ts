interface TurboWarpRenderer {
  createSVGSkin(svg: string): number;
  createBitmapSkin(bitmap: ImageBitmap, resolution: number): number;
  destroySkin(skinId: number): void;
  updateDrawableSkinId(drawableId: number, skinId: number): void;
}
interface TurboWarpCostume {
  name: string;
  assetId?: string;
  skinId?: number;
  dataFormat?: string;
}
interface TurboWarpSound {
  name: string;
  assetId?: string;
  soundId?: string;
  dataFormat?: string;
}
interface TurboWarpSoundBank {
  playSound(target: TurboWarpTarget, soundId: string): Promise<unknown> | unknown;
  stop(target: TurboWarpTarget, soundId: string): void;
  stopAllSounds(target: TurboWarpTarget): void;
}
interface TurboWarpSprite {
  name: string;
  costumes: TurboWarpCostume[];
  sounds: TurboWarpSound[];
  soundBank?: TurboWarpSoundBank;
}
interface TurboWarpTarget {
  id: string;
  isStage: boolean;
  isOriginal?: boolean;
  drawableID?: number | null;
  size: number;
  sprite?: TurboWarpSprite;
  setSize(size: number): void;
  emitVisualChange?(): void;
}
interface TurboWarpRuntime {
  renderer: TurboWarpRenderer;
  targets: TurboWarpTarget[];
  stageWidth?: number;
  ext_lmsTempVars2?: TurboWarpTemporaryVariablesExtension;
  getOpcodeFunction?(opcode: string): TurboWarpOpcodeFunction | undefined;
  requestRedraw?(): void;
  on?(eventName: string, listener: (target?: TurboWarpTarget) => void): void;
}
interface TurboWarpTemporaryVariablesExtension {
  getRuntimeVariable(args: {VAR: unknown}): unknown;
  setRuntimeVariable?(args: {VAR: unknown; STRING: unknown}): void;
}
type TurboWarpOpcodeFunction = (
  args: Record<string, unknown>,
  util: ScratchBlockUtility
) => unknown;
interface ScratchBlockUtility {
  target: TurboWarpTarget;
  runtime?: TurboWarpRuntime;
}
interface ScratchTranslate {
  (text: string): string;
  (message: {default: string; description?: string}, placeholders?: Record<string, string | number>): string;
}
interface ScratchApi {
  extensions: { unsandboxed: boolean; register(extension: unknown): void };
  BlockType: Record<'COMMAND' | 'BOOLEAN' | 'REPORTER', string>;
  ArgumentType: Record<'STRING', string>;
  translate: ScratchTranslate;
  vm: { runtime: TurboWarpRuntime };
}
declare const Scratch: ScratchApi;
