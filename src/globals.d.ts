interface TurboWarpRenderer {
  createSVGSkin(svg: string): number;
  createBitmapSkin(bitmap: ImageBitmap, resolution: number): number;
  destroySkin(skinId: number): void;
  updateDrawableSkinId(drawableId: number, skinId: number): void;
}
interface TurboWarpSprite { name: string; }
interface TurboWarpTarget {
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
}
interface ScratchBlockUtility { target: TurboWarpTarget; }
interface ScratchApi {
  extensions: { unsandboxed: boolean; register(extension: unknown): void };
  BlockType: Record<'COMMAND' | 'BOOLEAN' | 'REPORTER', string>;
  ArgumentType: Record<'STRING', string>;
  vm: { runtime: TurboWarpRuntime };
}
declare const Scratch: ScratchApi;
