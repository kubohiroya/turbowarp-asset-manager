export const EXTENSION_ID = 'twAssetManager';
export const EXTENSION_VERSION = '2026-07-02-fixed-2-ts';

const DB_NAME = 'tw-asset-manager';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

interface AssetRecord {
  name: string;
  url: string;
  mimeType: string;
  data: ArrayBuffer;
  cachedAt: number;
}

interface MemoryAsset extends AssetRecord {
  skinId: number | null;
}

type BlockArgs = Record<string, unknown>;

export function normalizeName(value: unknown): string {
  return String(value ?? '').trim();
}

export function guessMimeType(urlOrName: unknown): string {
  const value = String(urlOrName ?? '').toLowerCase().split('?')[0]?.split('#')[0] ?? '';
  if (value.endsWith('.svg')) return 'image/svg+xml';
  if (value.endsWith('.png')) return 'image/png';
  if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'image/jpeg';
  if (value.endsWith('.webp')) return 'image/webp';
  if (value.endsWith('.gif')) return 'image/gif';
  if (value.endsWith('.mp3')) return 'audio/mpeg';
  if (value.endsWith('.wav')) return 'audio/wav';
  if (value.endsWith('.ogg')) return 'audio/ogg';
  if (value.endsWith('.m4a')) return 'audio/mp4';
  if (value.endsWith('.aac')) return 'audio/aac';
  return 'application/octet-stream';
}

export function normalizeMimeType(mimeType: unknown, urlOrName: unknown): string {
  const raw = String(mimeType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!raw || raw === 'application/octet-stream' || raw === 'binary/octet-stream') {
    return guessMimeType(urlOrName);
  }
  return raw;
}

export class AssetManagerExtension {
  private readonly runtime = Scratch.vm.runtime;
  private readonly renderer = this.runtime.renderer;
  private readonly memoryAssets = new Map<string, MemoryAsset>();
  private readonly playingAudio = new Set<HTMLAudioElement>();

  getInfo() {
    const command = Scratch.BlockType.COMMAND;
    const string = Scratch.ArgumentType.STRING;
    return {
      id: EXTENSION_ID,
      name: 'Asset Manager',
      color1: '#5b7cfa',
      color2: '#425ed8',
      color3: '#2f46aa',
      blocks: [
        {opcode: 'loadAsset', blockType: command, text: 'アセットをURL [URL] またはキャッシュから [NAME] として読み込む', arguments: {URL: {type: string, defaultValue: 'https://example.com/asset.png'}, NAME: {type: string, defaultValue: 'asset1'}}},
        {opcode: 'deleteMemoryAsset', blockType: command, text: 'アセット [NAME] をメモリから削除する', arguments: {NAME: {type: string, defaultValue: 'asset1'}}},
        {opcode: 'deleteAllMemoryAssets', blockType: command, text: 'アセットをメモリから全て削除する'},
        {opcode: 'deleteCachedAsset', blockType: command, text: 'アセット [NAME] をキャッシュから削除する', arguments: {NAME: {type: string, defaultValue: 'asset1'}}},
        {opcode: 'deleteAllCachedAssets', blockType: command, text: 'アセットをキャッシュから全て削除する'},
        {opcode: 'isLoaded', blockType: Scratch.BlockType.BOOLEAN, text: 'アセット [NAME] が読み込まれた', arguments: {NAME: {type: string, defaultValue: 'asset1'}}},
        {opcode: 'setThisSpriteSkin', blockType: command, text: 'このスプライトの見た目をアセット [NAME] にする', arguments: {NAME: {type: string, defaultValue: 'asset1'}}},
        {opcode: 'setSpriteSkin', blockType: command, text: '[SPRITE] の見た目をアセット [NAME] にする（互換用）', arguments: {SPRITE: {type: string, defaultValue: 'Sprite1'}, NAME: {type: string, defaultValue: 'asset1'}}},
        {opcode: 'setStageSkin', blockType: command, text: 'ステージの背景をアセット [NAME] にする', arguments: {NAME: {type: string, defaultValue: 'background1'}}},
        {opcode: 'playSound', blockType: command, text: 'サウンドとしてアセット [NAME] を鳴らす', arguments: {NAME: {type: string, defaultValue: 'sound1'}}},
        {opcode: 'playSoundUntilDone', blockType: command, text: 'サウンドとしてアセット [NAME] を終わるまで鳴らす', arguments: {NAME: {type: string, defaultValue: 'sound1'}}},
        {opcode: 'getAssetMimeType', blockType: Scratch.BlockType.REPORTER, text: 'アセット [NAME] のMIMEタイプ', arguments: {NAME: {type: string, defaultValue: 'asset1'}}},
        {opcode: 'getVersion', blockType: Scratch.BlockType.REPORTER, text: 'Asset Manager バージョン'}
      ]
    };
  }

  async loadAsset(args: BlockArgs): Promise<void> {
    const name = normalizeName(args.NAME);
    const url = normalizeName(args.URL);
    if (!name) throw new Error('Asset name is empty.');

    let record: AssetRecord | null;
    if (url) {
      const fetched = await this.fetchAsset(url, name);
      record = {name, url, mimeType: fetched.mimeType, data: fetched.data, cachedAt: Date.now()};
      await this.cachePut(record);
    } else {
      record = await this.cacheGet(name);
      if (!record) throw new Error(`Asset is not cached and URL is empty: ${name}`);
    }

    const oldAsset = this.memoryAssets.get(name);
    this.deleteSkinIfExists(oldAsset);
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

  async deleteCachedAsset(args: BlockArgs): Promise<void> {
    await this.cacheDelete(normalizeName(args.NAME));
  }

  async deleteAllCachedAssets(): Promise<void> {
    await this.cacheClear();
  }

  isLoaded(args: BlockArgs): boolean {
    return this.memoryAssets.has(normalizeName(args.NAME));
  }

  async setThisSpriteSkin(args: BlockArgs, util: ScratchBlockUtility): Promise<void> {
    if (!util.target || util.target.isStage) throw new Error('This block must be used on a sprite or its clone.');
    this.applySkinToTarget(util.target, await this.ensureSkin(args.NAME));
  }

  async setSpriteSkin(args: BlockArgs): Promise<void> {
    const spriteName = normalizeName(args.SPRITE);
    const target = this.findTargetByName(spriteName);
    if (!target) throw new Error(`Sprite not found: ${spriteName}`);
    this.applySkinToTarget(target, await this.ensureSkin(args.NAME));
  }

  async setStageSkin(args: BlockArgs): Promise<void> {
    const stage = this.runtime.targets.find((target) => target.isStage);
    if (!stage) throw new Error('Stage not found.');
    this.applySkinToTarget(stage, await this.ensureSkin(args.NAME));
  }

  async playSound(args: BlockArgs): Promise<void> {
    await this.playSoundAsset(args.NAME, false);
  }

  async playSoundUntilDone(args: BlockArgs): Promise<void> {
    await this.playSoundAsset(args.NAME, true);
  }

  getAssetMimeType(args: BlockArgs): string {
    const name = normalizeName(args.NAME);
    const asset = this.memoryAssets.get(name);
    return asset ? normalizeMimeType(asset.mimeType, asset.url || name) : '';
  }

  getVersion(): string {
    return EXTENSION_VERSION;
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, {keyPath: 'name'});
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async cacheGet(name: string): Promise<AssetRecord | null> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(name);
      request.onsuccess = () => resolve((request.result as AssetRecord | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  private async cachePut(record: AssetRecord): Promise<void> {
    const database = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async cacheDelete(name: string): Promise<void> {
    const database = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async cacheClear(): Promise<void> {
    const database = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async fetchAsset(url: string, name: string): Promise<{mimeType: string; data: ArrayBuffer}> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch asset "${name}": ${response.status} ${response.statusText}`);
    const blob = await response.blob();
    return {mimeType: normalizeMimeType(blob.type || response.headers.get('Content-Type'), url), data: await blob.arrayBuffer()};
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
    if (target.drawableID === undefined || target.drawableID === null) {
      throw new Error(`Target drawable not found: ${target.sprite?.name ?? 'unknown'}`);
    }
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
