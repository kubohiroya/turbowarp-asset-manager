import definitions from './block-definitions.json' with {type: 'json'};

export const EXTENSION_ID = 'twAssetManager';
export const EXTENSION_VERSION = '2026-07-13-local-resource-shorthands';

const DB_NAME = 'tw-asset-manager';
const DB_VERSION = 1;
const STORE_NAME = 'assets';
const STAGE_RESOURCE_NAME = '@stage';

type BlockArgs = Record<string, unknown>;
type BlockTypeName = 'COMMAND' | 'BOOLEAN' | 'REPORTER';
type AssetKind = 'external' | 'costume' | 'sound';

interface DefinitionArgument {
  type: 'STRING';
  defaultValue: string;
}

interface DefinitionBlock {
  opcode: string;
  blockType: BlockTypeName;
  text: string;
  description: string;
  arguments: Record<string, DefinitionArgument>;
  hideFromPalette?: boolean;
}

interface AssetRecord {
  name: string;
  url: string;
  mimeType: string;
  data: ArrayBuffer;
  cachedAt: number;
}

interface ExternalMemoryAsset extends AssetRecord {
  kind: 'external';
  skinId: number | null;
}

interface CostumeAssetReference {
  kind: 'costume';
  name: string;
  targetId: string;
  targetName: string;
  isStage: boolean;
  costumeName: string;
  assetId: string | null;
}

interface SoundAssetReference {
  kind: 'sound';
  name: string;
  targetId: string;
  targetName: string;
  isStage: boolean;
  soundName: string;
  assetId: string | null;
}

export type ParsedResourceIdentifier =
  | {kind: 'cache'}
  | {kind: 'external'; url: string}
  | {kind: 'costume'; spriteName: string; costumeName: string | null}
  | {kind: 'backdrop'; backdropName: string}
  | {kind: 'sound'; spriteName: string; soundName: string};

const blockDefinitions = definitions.blocks as readonly DefinitionBlock[];

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

export function parseResourceIdentifier(
  value: unknown,
  fallbackAssetName?: unknown
): ParsedResourceIdentifier {
  const resourceId = normalizeName(value);
  if (!resourceId) return {kind: 'cache'};
  if (/^https?:\/\//i.test(resourceId)) return {kind: 'external', url: resourceId};

  const separatorIndex = resourceId.indexOf(':');
  if (separatorIndex < 0) {
    const fallbackName = normalizeName(fallbackAssetName);
    const bareScheme = resourceId.toLowerCase();
    if (bareScheme === 'costume' && fallbackName) {
      return {kind: 'costume', spriteName: fallbackName, costumeName: null};
    }
    if (bareScheme === 'backdrop' && fallbackName) {
      return {kind: 'backdrop', backdropName: fallbackName};
    }
    if (bareScheme === 'sound' && fallbackName) {
      return {kind: 'sound', spriteName: STAGE_RESOURCE_NAME, soundName: fallbackName};
    }
    throw new Error(`Unsupported resource identifier: ${resourceId}`);
  }

  const scheme = resourceId.slice(0, separatorIndex).trim().toLowerCase();
  const payload = resourceId.slice(separatorIndex + 1).trim();

  switch (scheme) {
    case 'costume': {
      const [spriteName, costumeName] = splitLocalResourcePair(payload, 'costume', fallbackAssetName);
      return {kind: 'costume', spriteName, costumeName};
    }
    case 'backdrop': {
      return {kind: 'backdrop', backdropName: parseLocalResourceName(payload, 'Backdrop')};
    }
    case 'sound': {
      const [spriteName, soundName] = splitLocalResourcePair(payload, 'sound', fallbackAssetName);
      return {kind: 'sound', spriteName, soundName};
    }
    default:
      throw new Error(`Unsupported resource scheme: ${scheme}`);
  }
}

function splitLocalResourcePair(
  payload: string,
  scheme: string,
  fallbackAssetName?: unknown
): [string, string] {
  if (!payload.includes(':') && fallbackAssetName !== undefined) {
    const spriteName = payload.trim();
    const assetName = normalizeName(fallbackAssetName);
    if (!spriteName) throw new Error(`${scheme} source name is empty.`);
    if (!assetName) throw new Error(`${scheme} asset name is empty.`);
    return [spriteName, assetName];
  }
  const parts = payload.split(':');
  if (parts.length !== 2) {
    throw new Error(`${scheme} resource must specify a source and asset name separated by exactly one colon.`);
  }
  const sourceName = parts[0]?.trim() ?? '';
  const assetName = parts[1]?.trim() ?? '';
  if (!sourceName) throw new Error(`${scheme} source name is empty.`);
  if (!assetName) throw new Error(`${scheme} asset name is empty.`);
  return [sourceName, assetName];
}

function parseLocalResourceName(payload: string, label: string): string {
  const name = payload.trim();
  if (!name) throw new Error(`${label} name is empty.`);
  if (name.includes(':')) throw new Error(`${label} name must not contain a colon.`);
  return name;
}

export class AssetManagerExtension {
  private readonly runtime = Scratch.vm.runtime;
  private readonly renderer = this.runtime.renderer;
  private readonly externalAssets = new Map<string, ExternalMemoryAsset>();
  private readonly costumeAssets = new Map<string, CostumeAssetReference>();
  private readonly soundAssets = new Map<string, SoundAssetReference>();
  private readonly assetRegistry = new Map<string, AssetKind>();
  private readonly playingAudio = new Set<HTMLAudioElement>();
  private readonly registrationVersions = new Map<string, number>();

  getInfo() {
    return {
      id: EXTENSION_ID,
      name: Scratch.translate(definitions.extensionName),
      color1: '#5b7cfa', color2: '#425ed8', color3: '#2f46aa',
      blocks: blockDefinitions.map((block) => this.toScratchBlock(block))
    };
  }

  async registerAsset(args: BlockArgs): Promise<void> {
    const name = this.requireAssetName(args.NAME);
    const resource = parseResourceIdentifier(args.RESOURCE_ID, name);
    switch (resource.kind) {
      case 'cache':
        await this.registerExternalAsset('', name);
        return;
      case 'external':
        await this.registerExternalAsset(resource.url, name);
        return;
      case 'costume':
        this.registerCostumeReference(name, resource.spriteName, resource.costumeName);
        return;
      case 'backdrop':
        this.registerBackdropReference(name, resource.backdropName);
        return;
      case 'sound':
        this.registerSoundReference(name, resource.spriteName, resource.soundName);
    }
  }

  /** Legacy opcode retained for existing projects. */
  async loadAsset(args: BlockArgs): Promise<void> {
    const name = this.requireAssetName(args.NAME);
    await this.registerExternalAsset(normalizeName(args.URL), name);
  }

  deleteMemoryAsset(args: BlockArgs): void {
    this.unregisterAsset(normalizeName(args.NAME));
  }

  deleteAllMemoryAssets(): void {
    for (const name of this.registrationVersions.keys()) {
      this.registrationVersions.set(name, (this.registrationVersions.get(name) ?? 0) + 1);
    }
    for (const asset of this.externalAssets.values()) this.deleteOwnedSkinIfExists(asset);
    this.externalAssets.clear();
    this.costumeAssets.clear();
    this.soundAssets.clear();
    this.assetRegistry.clear();
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
    return this.assetRegistry.has(normalizeName(args.NAME));
  }

  async setThisSpriteSkin(args: BlockArgs, util: ScratchBlockUtility): Promise<void> {
    if (!util.target || util.target.isStage) throw new Error('This block must be used on a sprite or its clone.');
    this.applySkinToTarget(util.target, await this.resolveSkin(args.NAME));
  }

  async setSpriteSkin(args: BlockArgs): Promise<void> {
    const name = normalizeName(args.SPRITE);
    const target = this.findTargetByName(name);
    if (!target) throw new Error(`Sprite not found: ${name}`);
    this.applySkinToTarget(target, await this.resolveSkin(args.NAME));
  }

  async setStageSkin(args: BlockArgs): Promise<void> {
    const stage = this.getStageTarget();
    this.applySkinToTarget(stage, await this.resolveSkin(args.NAME));
  }

  async playSound(args: BlockArgs): Promise<void> {
    await this.playResolvedSound(args.NAME, false);
  }

  async playSoundUntilDone(args: BlockArgs): Promise<void> {
    await this.playResolvedSound(args.NAME, true);
  }

  getAssetMimeType(args: BlockArgs): string {
    const name = normalizeName(args.NAME);
    const kind = this.assetRegistry.get(name);
    if (!kind) return '';
    switch (kind) {
      case 'external': {
        const asset = this.externalAssets.get(name);
        return asset ? normalizeMimeType(asset.mimeType, asset.url || name) : '';
      }
      case 'costume': {
        const {costume} = this.resolveCostumeReference(name);
        return this.projectAssetMimeType(costume.dataFormat, 'image');
      }
      case 'sound': {
        const {sound} = this.resolveSoundReference(name);
        return this.projectAssetMimeType(sound.dataFormat, 'audio');
      }
    }
  }

  getVersion(): string {
    return EXTENSION_VERSION;
  }

  private toScratchBlock(block: DefinitionBlock): Record<string, unknown> {
    return {
      opcode: block.opcode,
      blockType: Scratch.BlockType[block.blockType],
      text: Scratch.translate(block.text),
      ...(block.hideFromPalette ? {hideFromPalette: true} : {}),
      ...(Object.keys(block.arguments).length > 0
        ? {
            arguments: Object.fromEntries(
              Object.entries(block.arguments).map(([name, argument]) => [
                name,
                {
                  type: Scratch.ArgumentType[argument.type],
                  defaultValue: argument.defaultValue
                }
              ])
            )
          }
        : {})
    };
  }

  private requireAssetName(value: unknown): string {
    const name = normalizeName(value);
    if (!name) throw new Error('Asset name is empty.');
    return name;
  }

  private nextRegistrationVersion(name: string): number {
    const version = (this.registrationVersions.get(name) ?? 0) + 1;
    this.registrationVersions.set(name, version);
    return version;
  }

  private async registerExternalAsset(url: string, name: string): Promise<void> {
    const version = this.nextRegistrationVersion(name);
    const record = url
      ? await this.fetchAndCache(url, name)
      : await this.cacheGet(name);
    if (this.registrationVersions.get(name) !== version) return;
    if (!record) throw new Error(`Asset is not cached and URL is empty: ${name}`);
    this.unregisterAsset(name);
    this.externalAssets.set(name, {
      ...record,
      kind: 'external',
      mimeType: normalizeMimeType(record.mimeType, record.url || name),
      skinId: null
    });
    this.assetRegistry.set(name, 'external');
  }

  private registerCostumeReference(
    name: string,
    spriteName: string,
    costumeName: string | null
  ): void {
    const target = this.findTargetByName(spriteName);
    if (!target) throw new Error(`Sprite not found: ${spriteName}`);
    const costumes = target.sprite?.costumes ?? [];
    const costume = costumeName === null
      ? costumes.find((candidate) => candidate.name === name) ?? (costumes.length === 1 ? costumes[0] : null)
      : this.findCostume(target, costumeName, null);
    if (!costume && costumeName === null && costumes.length > 1) {
      throw new Error(`Costume shorthand is ambiguous: ${spriteName} has multiple costumes and none is named ${name}.`);
    }
    const resolvedCostumeName = costume?.name ?? costumeName ?? name;
    if (!costume) throw new Error(`Costume not found: ${spriteName}/${resolvedCostumeName}`);
    this.unregisterAsset(name);
    this.costumeAssets.set(name, {
      kind: 'costume',
      name,
      targetId: target.id,
      targetName: spriteName,
      isStage: false,
      costumeName: resolvedCostumeName,
      assetId: costume.assetId ?? null
    });
    this.assetRegistry.set(name, 'costume');
  }

  private registerBackdropReference(name: string, backdropName: string): void {
    const stage = this.getStageTarget();
    const costume = this.findCostume(stage, backdropName, null);
    if (!costume) throw new Error(`Backdrop not found: ${backdropName}`);
    this.unregisterAsset(name);
    this.costumeAssets.set(name, {
      kind: 'costume',
      name,
      targetId: stage.id,
      targetName: STAGE_RESOURCE_NAME,
      isStage: true,
      costumeName: backdropName,
      assetId: costume.assetId ?? null
    });
    this.assetRegistry.set(name, 'costume');
  }

  private registerSoundReference(name: string, spriteName: string, soundName: string): void {
    const isStage = spriteName.toLowerCase() === STAGE_RESOURCE_NAME;
    const target = isStage ? this.getStageTarget() : this.findTargetByName(spriteName);
    if (!target) throw new Error(`Sound source not found: ${spriteName}`);
    const sound = this.findSound(target, soundName, null);
    if (!sound) throw new Error(`Sound not found: ${spriteName}/${soundName}`);
    this.unregisterAsset(name);
    this.soundAssets.set(name, {
      kind: 'sound',
      name,
      targetId: target.id,
      targetName: isStage ? STAGE_RESOURCE_NAME : spriteName,
      isStage,
      soundName,
      assetId: sound.assetId ?? null
    });
    this.assetRegistry.set(name, 'sound');
  }

  private unregisterAsset(name: string): void {
    this.nextRegistrationVersion(name);
    const kind = this.assetRegistry.get(name);
    if (!kind) return;
    if (kind === 'external') {
      this.deleteOwnedSkinIfExists(this.externalAssets.get(name));
      this.externalAssets.delete(name);
    } else if (kind === 'costume') {
      this.costumeAssets.delete(name);
    } else {
      this.soundAssets.delete(name);
    }
    this.assetRegistry.delete(name);
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

  private async transaction<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
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

  private async cachePut(record: AssetRecord): Promise<void> {
    await this.transaction('readwrite', (store) => store.put(record));
  }

  private async cacheDelete(name: string): Promise<void> {
    await this.transaction('readwrite', (store) => store.delete(name));
  }

  private async cacheClear(): Promise<void> {
    await this.transaction('readwrite', (store) => store.clear());
  }

  private async fetchAndCache(url: string, name: string): Promise<AssetRecord> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch asset "${name}": ${response.status} ${response.statusText}`);
    const blob = await response.blob();
    const record = {
      name,
      url,
      mimeType: normalizeMimeType(blob.type || response.headers.get('Content-Type'), url),
      data: await blob.arrayBuffer(),
      cachedAt: Date.now()
    };
    await this.cachePut(record);
    return record;
  }

  private getStageTarget(): TurboWarpTarget {
    const stage = this.runtime.targets.find((target) => target.isStage);
    if (!stage) throw new Error('Stage not found.');
    return stage;
  }

  private findTargetByName(name: string): TurboWarpTarget | null {
    const targets = this.runtime.targets;
    return targets.find((target) => !target.isStage && target.isOriginal && target.sprite?.name === name)
      ?? targets.find((target) => !target.isStage && target.sprite?.name === name)
      ?? null;
  }

  private resolveReferencedTarget(
    targetId: string,
    targetName: string,
    isStage: boolean
  ): TurboWarpTarget {
    const byId = this.runtime.targets.find((target) => target.id === targetId);
    if (byId) return byId;
    if (isStage) return this.getStageTarget();
    const byName = this.findTargetByName(targetName);
    if (!byName) throw new Error(`Asset source target no longer exists: ${targetName}`);
    return byName;
  }

  private findCostume(
    target: TurboWarpTarget,
    costumeName: string,
    assetId: string | null
  ): TurboWarpCostume | null {
    const costumes = target.sprite?.costumes ?? [];
    return (assetId ? costumes.find((costume) => costume.assetId === assetId) : undefined)
      ?? costumes.find((costume) => costume.name === costumeName)
      ?? null;
  }

  private findSound(
    target: TurboWarpTarget,
    soundName: string,
    assetId: string | null
  ): TurboWarpSound | null {
    const sounds = target.sprite?.sounds ?? [];
    return (assetId ? sounds.find((sound) => sound.assetId === assetId) : undefined)
      ?? sounds.find((sound) => sound.name === soundName)
      ?? null;
  }

  private async resolveSkin(value: unknown): Promise<number> {
    const name = normalizeName(value);
    const kind = this.assetRegistry.get(name);
    if (!kind) throw new Error(`Asset is not loaded: ${name}`);
    if (kind === 'external') return this.ensureExternalSkin(name);
    if (kind === 'costume') return this.resolveCostumeReference(name).costume.skinId as number;
    throw new Error(`Asset is not an image: ${name}`);
  }

  private async ensureExternalSkin(name: string): Promise<number> {
    const asset = this.externalAssets.get(name);
    if (!asset) throw new Error(`External asset is not loaded: ${name}`);
    asset.mimeType = normalizeMimeType(asset.mimeType, asset.url || name);
    if (!asset.mimeType.startsWith('image/')) throw new Error(`Asset is not an image: ${name} (${asset.mimeType})`);
    if (asset.skinId !== null) return asset.skinId;
    const blob = new Blob([asset.data], {type: asset.mimeType});
    asset.skinId = asset.mimeType === 'image/svg+xml'
      ? this.renderer.createSVGSkin(await blob.text())
      : this.renderer.createBitmapSkin(await createImageBitmap(blob), 1);
    return asset.skinId;
  }

  private resolveCostumeReference(name: string): {
    target: TurboWarpTarget;
    costume: TurboWarpCostume;
  } {
    const reference = this.costumeAssets.get(name);
    if (!reference) throw new Error(`Costume asset is not registered: ${name}`);
    const target = this.resolveReferencedTarget(reference.targetId, reference.targetName, reference.isStage);
    const costume = this.findCostume(target, reference.costumeName, reference.assetId);
    if (!costume) throw new Error(`Costume no longer exists: ${reference.targetName}/${reference.costumeName}`);
    if (typeof costume.skinId !== 'number') {
      throw new Error(`Costume skin is not available: ${reference.targetName}/${reference.costumeName}`);
    }
    return {target, costume};
  }

  private resolveSoundReference(name: string): {
    target: TurboWarpTarget;
    sound: TurboWarpSound;
  } {
    const reference = this.soundAssets.get(name);
    if (!reference) throw new Error(`Sound asset is not registered: ${name}`);
    const target = this.resolveReferencedTarget(reference.targetId, reference.targetName, reference.isStage);
    const sound = this.findSound(target, reference.soundName, reference.assetId);
    if (!sound) throw new Error(`Sound no longer exists: ${reference.targetName}/${reference.soundName}`);
    if (!sound.soundId) throw new Error(`Sound ID is not available: ${reference.targetName}/${reference.soundName}`);
    if (!target.sprite?.soundBank) throw new Error(`Sound bank is not available: ${reference.targetName}`);
    return {target, sound};
  }

  private deleteOwnedSkinIfExists(asset: ExternalMemoryAsset | undefined): void {
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

  private async playResolvedSound(value: unknown, waitUntilDone: boolean): Promise<void> {
    const name = normalizeName(value);
    const kind = this.assetRegistry.get(name);
    if (!kind) throw new Error(`Asset is not loaded: ${name}`);
    if (kind === 'external') {
      await this.playExternalSound(name, waitUntilDone);
      return;
    }
    if (kind === 'sound') {
      await this.playProjectSound(name, waitUntilDone);
      return;
    }
    throw new Error(`Asset is not audio: ${name}`);
  }

  private async playExternalSound(name: string, waitUntilDone: boolean): Promise<void> {
    const asset = this.externalAssets.get(name);
    if (!asset) throw new Error(`External asset is not loaded: ${name}`);
    asset.mimeType = normalizeMimeType(asset.mimeType, asset.url || name);
    if (!asset.mimeType.startsWith('audio/')) throw new Error(`Asset is not audio: ${name} (${asset.mimeType})`);
    const objectUrl = URL.createObjectURL(new Blob([asset.data], {type: asset.mimeType}));
    const audio = new Audio(objectUrl);
    this.playingAudio.add(audio);
    const cleanup = () => {
      this.playingAudio.delete(audio);
      URL.revokeObjectURL(objectUrl);
    };
    audio.addEventListener('ended', cleanup, {once: true});
    audio.addEventListener('error', cleanup, {once: true});
    const playPromise = audio.play();
    if (!waitUntilDone) {
      void playPromise.catch((error) => {
        console.warn(`Failed to play audio asset "${name}"`, error);
        cleanup();
      });
      return;
    }
    try {
      await playPromise;
    } catch (error) {
      cleanup();
      throw error;
    }
    await new Promise<void>((resolve) => {
      audio.addEventListener('ended', () => resolve(), {once: true});
      audio.addEventListener('error', () => resolve(), {once: true});
    });
  }

  private async playProjectSound(name: string, waitUntilDone: boolean): Promise<void> {
    const {target, sound} = this.resolveSoundReference(name);
    const playResult = target.sprite?.soundBank?.playSound(target, sound.soundId as string);
    const playPromise = Promise.resolve(playResult);
    if (!waitUntilDone) {
      void playPromise.catch((error) => console.warn(`Failed to play project sound asset "${name}"`, error));
      return;
    }
    await playPromise;
  }

  private projectAssetMimeType(dataFormat: string | undefined, kind: 'image' | 'audio'): string {
    if (dataFormat) {
      const guessed = guessMimeType(`asset.${dataFormat}`);
      if (guessed !== 'application/octet-stream') return guessed;
    }
    return kind === 'image' ? 'image/x-scratch-costume' : 'audio/x-scratch-sound';
  }
}
