export const EXTENSION_ID = 'twAssetManager';
export const EXTENSION_VERSION = '2026-07-02-fixed-2-ts';

const DB_NAME = 'tw-asset-manager';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

type BlockArgs = Record<string, unknown>;
interface AssetRecord { name: string; url: string; mimeType: string; data: ArrayBuffer; cachedAt: number; }
interface MemoryAsset extends AssetRecord { skinId: number | null; }

export function normalizeName(value: unknown): string {
  return String(value ?? '').trim();
}

export function guessMimeType(value: unknown): string {
  const name = String(value ?? '').toLowerCase().split('?')[0]?.split('#')[0] ?? '';
  const types: Array<[string[], string]> = [
    [['.svg'], 'image/svg+xml'], [['.png'], 'image/png'], [['.jpg', '.jpeg'], 'image/jpeg'],
    [['.webp'], 'image/webp'], [['.gif'], 'image/gif'], [['.mp3'], 'audio/mpeg'],
    [['.wav'], 'audio/wav'], [['.ogg'], 'audio/ogg'], [['.m4a'], 'audio/mp4'], [['.aac'], 'audio/aac']
  ];
  return types.find(([extensions]) => extensions.some((extension) => name.endsWith(extension)))?.[1]
    ?? 'application/octet-stream';
}

export function normalizeMimeType(mimeType: unknown, urlOrName: unknown): string {
  const raw = String(mimeType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  return !raw || raw === 'application/octet-stream' || raw === 'binary/octet-stream'
    ? guessMimeType(urlOrName)
    : raw;
}

export class AssetManagerExtension {
  private readonly runtime = Scratch.vm.runtime;
  private readonly renderer = this.runtime.renderer;
  private readonly memoryAssets = new Map<string, MemoryAsset>();
  private readonly playingAudio = new Set<HTMLAudioElement>();

  getInfo() {
    const t = Scratch.translate;
    const command = Scratch.BlockType.COMMAND;
    const string = Scratch.ArgumentType.STRING;
    return {
      id: EXTENSION_ID,
      name: t('Asset Manager'),
      color1: '#5b7cfa', color2: '#425ed8', color3: '#2f46aa',
      blocks: [
        {opcode: 'loadAsset', blockType: command, text: t('load asset from URL [URL] or cache as [NAME]'), arguments: {URL: {type: string, defaultValue: 'https://example.com/asset.png'}, NAME: {type: string, defaultValue: 'asset1'}}},
        {opcode: 'deleteMemoryAsset', blockType: command, text: t('delete asset [NAME] from memory'), arguments: {NAME: {type: string, defaultValue: 'asset1'}}},
        {opcode: 'deleteAllMemoryAssets', blockType: command, text: t('delete all assets from memory')},
        {opcode: 'deleteCachedAsset', blockType: command, text: t('delete asset [NAME] from cache'), arguments: {NAME: {type: string, defaultValue: 'asset1'}}},
        {opcode: 'deleteAllCachedAssets', blockType: command, text: t('delete all assets from cache')},
        {opcode: 'isLoaded', blockType: Scratch.BlockType.BOOLEAN, text: t('asset [NAME] is loaded'), arguments: {NAME: {type: string, defaultValue: 'asset1'}}},
        {opcode: 'setThisSpriteSkin', blockType: command, text: t('set this sprite skin to asset [NAME]'), arguments: {NAME: {type: string, defaultValue: 'asset1'}}},
        {opcode: 'setSpriteSkin', blockType: command, text: t('set [SPRITE] skin to asset [NAME] (compatibility)'), arguments: {SPRITE: {type: string, defaultValue: 'Sprite1'}, NAME: {type: string, defaultValue: 'asset1'}}},
        {opcode: 'setStageSkin', blockType: command, text: t('set stage backdrop to asset [NAME]'), arguments: {NAME: {type: string, defaultValue: 'background1'}}},
        {opcode: 'playSound', blockType: command, text: t('play asset [NAME] as sound'), arguments: {NAME: {type: string, defaultValue: 'sound1'}}},
        {opcode: 'playSoundUntilDone', blockType: command, text: t('play asset [NAME] as sound until done'), arguments: {NAME: {type: string, defaultValue: 'sound1'}}},
        {opcode: 'getAssetMimeType', blockType: Scratch.BlockType.REPORTER, text: t('MIME type of asset [NAME]'), arguments: {NAME: {type: string, defaultValue: 'asset1'}}},
        {opcode: 'getVersion', blockType: Scratch.BlockType.REPORTER, text: t('Asset Manager version')}
      ]
    };
  }

  async loadAsset(args: BlockArgs): Promise<void> {
    const name = normalizeName(args.NAME);
    const url = normalizeName(args.URL);
    if (!name) throw new Error('Asset name is empty.');
    const record = url
      ? await this.fetchAndCache(url, name)
      : await this.cacheGet(name);
    if (!record) throw new Error(`Asset is not cached and URL is empty: ${name}`);
    this.deleteSkinIfExists(this.memoryAssets.get(name));
    this.memoryAssets.set(name, {...record, mimeType: normalizeMimeType(record.mimeType, record.url || name), skinId: null});
  }

  deleteMemoryAsset(args: BlockArgs): void {
    const name = normalizeName(args.NAME);
    this.deleteSkinIfExists(this.memoryAssets.get(name));
    this.memoryAssets.delete(name);
  }

  deleteAllMemoryAssets(): void {
    for (const asset of this.memoryAssets.values()) this.deleteSkinIfExists(asset);
    this.memoryAssets.clear();
    for (const audio of this.playingAudio) {
      try { audio.pause(); audio.currentTime = 0; } catch { /* ignored */ }
    }
    this.playingAudio.clear();
  }

  async deleteCachedAsset(args: BlockArgs): Promise<void> { await this.cacheDelete(normalizeName(args.NAME)); }
  async deleteAllCachedAssets(): Promise<void> { await this.cacheClear(); }
  isLoaded(args: BlockArgs): boolean { return this.memoryAssets.has(normalizeName(args.NAME)); }

  async setThisSpriteSkin(args: BlockArgs, util: ScratchBlockUtility): Promise<void> {
    if (!util.target || util.target.isStage) throw new Error('This block must be used on a sprite or its clone.');
    this.applySkinToTarget(util.target, await this.ensureSkin(args.NAME));
  }

  async setSpriteSkin(args: BlockArgs): Promise<void> {
    const name = normalizeName(args.SPRITE);
    const target = this.findTargetByName(name);
    if (!target) throw new Error(`Sprite not found: ${name}`);
    this.applySkinToTarget(target, await this.ensureSkin(args.NAME));
  }

  async setStageSkin(args: BlockArgs): Promise<void> {
    const stage = this.runtime.targets.find((target) => target.isStage);
    if (!stage) throw new Error('Stage not found.');
    this.applySkinToTarget(stage, await this.ensureSkin(args.NAME));
  }

  async playSound(args: BlockArgs): Promise<void> { await this.playSoundAsset(args.NAME, false); }
  async playSoundUntilDone(args: BlockArgs): Promise<void> { await this.playSoundAsset(args.NAME, true); }
  getAssetMimeType(args: BlockArgs): string {
    const name = normalizeName(args.NAME);
    const asset = this.memoryAssets.get(name);
    return asset ? normalizeMimeType(asset.mimeType, asset.url || name) : '';
  }
  getVersion(): string { return EXTENSION_VERSION; }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, {keyPath: 'name'});
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const request = action(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async cacheGet(name: string): Promise<AssetRecord | null> {
    return (await this.transaction<AssetRecord | undefined>('readonly', (store) => store.get(name))) ?? null;
  }
  private async cachePut(record: AssetRecord): Promise<void> { await this.transaction('readwrite', (store) => store.put(record)); }
  private async cacheDelete(name: string): Promise<void> { await this.transaction('readwrite', (store) => store.delete(name)); }
  private async cacheClear(): Promise<void> { await this.transaction('readwrite', (store) => store.clear()); }

  private async fetchAndCache(url: string, name: string): Promise<AssetRecord> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch asset "${name}": ${response.status} ${response.statusText}`);
    const blob = await response.blob();
    const record = {name, url, mimeType: normalizeMimeType(blob.type || response.headers.get('Content-Type'), url), data: await blob.arrayBuffer(), cachedAt: Date.now()};
    await this.cachePut(record);
    return record;
  }

  private findTargetByName(name: string): TurboWarpTarget | null {
    const targets = this.runtime.targets;
    return targets.find((target) => !target.isStage && target.isOriginal && target.sprite?.name === name)
      ?? targets.find((target) => !target.isStage && target.sprite?.name === name)
      ?? null;
  }

  private async ensureSkin(value: unknown): Promise<number> {
    const name = normalizeName(value);
    const asset = this.memoryAssets.get(name);
    if (!asset) throw new Error(`Asset is not loaded: ${name}`);
    asset.mimeType = normalizeMimeType(asset.mimeType, asset.url || name);
    if (!asset.mimeType.startsWith('image/')) throw new Error(`Asset is not an image: ${name} (${asset.mimeType})`);
    if (asset.skinId !== null) return asset.skinId;
    const blob = new Blob([asset.data], {type: asset.mimeType});
    asset.skinId = asset.mimeType === 'image/svg+xml'
      ? this.renderer.createSVGSkin(await blob.text())
      : this.renderer.createBitmapSkin(await createImageBitmap(blob), 1);
    return asset.skinId;
  }

  private deleteSkinIfExists(asset: MemoryAsset | undefined): void {
    if (!asset || asset.skinId === null) return;
    try { this.renderer.destroySkin(asset.skinId); } catch (error) { console.warn('Failed to destroy skin', error); }
    asset.skinId = null;
  }

  private applySkinToTarget(target: TurboWarpTarget, skinId: number): void {
    if (target.drawableID === undefined || target.drawableID === null) throw new Error(`Target drawable not found: ${target.sprite?.name ?? 'unknown'}`);
    this.renderer.updateDrawableSkinId(target.drawableID, skinId);
    target.emitVisualChange?.();
    this.runtime.requestRedraw?.();
  }

  private async playSoundAsset(value: unknown, waitUntilDone: boolean): Promise<void> {
    const name = normalizeName(value);
    const asset = this.memoryAssets.get(name);
    if (!asset) throw new Error(`Asset is not loaded: ${name}`);
    asset.mimeType = normalizeMimeType(asset.mimeType, asset.url || name);
    if (!asset.mimeType.startsWith('audio/')) throw new Error(`Asset is not audio: ${name} (${asset.mimeType})`);
    const objectUrl = URL.createObjectURL(new Blob([asset.data], {type: asset.mimeType}));
    const audio = new Audio(objectUrl);
    this.playingAudio.add(audio);
    const cleanup = () => { this.playingAudio.delete(audio); URL.revokeObjectURL(objectUrl); };
    audio.addEventListener('ended', cleanup, {once: true});
    audio.addEventListener('error', cleanup, {once: true});
    const playPromise = audio.play();
    if (!waitUntilDone) { void playPromise.catch((error) => console.warn(`Failed to play audio asset "${name}"`, error)); return; }
    await playPromise;
    await new Promise<void>((resolve) => {
      audio.addEventListener('ended', () => resolve(), {once: true});
      audio.addEventListener('error', () => resolve(), {once: true});
    });
  }
}
