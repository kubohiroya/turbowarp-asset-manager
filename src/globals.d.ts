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
  sprite?: TurboWarpSprite;
  emitVisualChange?(): void;
}
interface TurboWarpRuntime {
  renderer: TurboWarpRenderer;
  targets: TurboWarpTarget[];
  requestRedraw?(): void;
  on?(eventName: string, listener: () => void): void;
}
interface ScratchBlockUtility { target: TurboWarpTarget; }
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
