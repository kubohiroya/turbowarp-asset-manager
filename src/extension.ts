import definitions from './block-definitions.json' with {type: 'json'};
import {
  AssetManagerError,
  errorMessage,
  suggestNames,
  suggestionHint
} from './asset-manager-error.js';
import {
  FEATURE_FLAGS,
  type AssetManagerFeatureFlags
} from './feature-flags.js';
import {
  createDOMImageResourceBacking,
  type DOMImageResource,
  type DOMImageResourceBacking
} from './dom-image-resource.js';
import {
  normalizeAudioVoiceGain,
  type AssetManagerAudioVoice,
  type AssetManagerAudioVoiceOptions
} from './audio-voice.js';
import {
  DEFAULT_OUTLINE_COLOR,
  DEFAULT_OUTLINE_WIDTH,
  normalizeTextStyleProperty,
  normalizeTextStyleValue,
  resolveTextStyle,
  textRuntimeVariableName,
  textStyleRuntimeVariableName
} from './text-style.js';

export const EXTENSION_ID = 'kubohiroyaassetmanager';
export const EXTENSION_VERSION = '0.12.1';
export const EXTENSION_DOCS_URI = 'https://kubohiroya.github.io/turbowarp-asset-manager/';
export const BLOCK_ICON_URI = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#fff" d="M19 47 29 17h7l10 30h-7l-2-7H27l-2 7h-6Zm10-13h6l-3-10-3 10Z"/></svg>'
)}`;

const DB_NAME = 'tw-asset-manager';
const DB_VERSION = 1;
const STORE_NAME = 'assets';
const STAGE_RESOURCE_NAME = '@stage';

type BlockArgs = Record<string, unknown>;
type BlockTypeName = 'COMMAND' | 'BOOLEAN' | 'REPORTER';
export type AssetKind = 'external' | 'costume' | 'backdrop' | 'sound' | 'text';
type ExternalMediaKind = 'image' | 'audio' | 'unknown';

interface DefinitionArgument {
  type: 'STRING' | 'NUMBER';
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
  generation?: number;
}

export interface EmbeddedAssetBytesInput {
  name: unknown;
  bytes: ArrayBuffer | Uint8Array;
  mimeType: unknown;
  sourceName?: unknown;
  bitmapResolution?: 1 | 2;
}

export interface EmbeddedAssetRegistration {
  readonly name: string;
  readonly mimeType: string;
}

export interface ResolvedImageAssetBytes {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}

export interface AssetManagerDOMImageCapability {
  isRegistered(name: unknown): boolean;
  getMimeType(name: unknown): string;
  resolveDOMImageResource(name: unknown): Promise<DOMImageResource>;
}

interface ExtensionDOMImageResourceController {
  readonly name: string;
  readonly resource: DOMImageResource;
}

interface ExtensionDOMImageResourceBackingEntry {
  readonly version: number;
  readonly promise: Promise<DOMImageResourceBacking>;
  backing?: DOMImageResourceBacking;
}

interface ExternalMemoryAsset extends AssetRecord {
  kind: 'external';
  skinId: number | null;
  bitmapResolution?: 1 | 2;
}

interface CostumeAssetReference {
  kind: 'costume' | 'backdrop';
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

interface TextAssetReference {
  kind: 'text';
  name: string;
  runtimeVariableName: string;
}

interface ResolvedSkin {
  skinId: number;
  sourceSize: number | null;
}

type RegisteredAsset =
  | ExternalMemoryAsset
  | CostumeAssetReference
  | SoundAssetReference
  | TextAssetReference;

interface DisplayBinding {
  assetName: string;
  assetKind: 'external' | 'costume' | 'backdrop' | 'text';
  skinId: number | null;
}

interface RegistrationToken {
  version: number;
  cancellationVersion: number;
}

const blockDefinitions = definitions.blocks as DefinitionBlock[];

blockDefinitions.unshift(
  {
    opcode: 'validateProjectAssetAddress',
    blockType: 'REPORTER',
    text: 'validate project asset address [RESOURCE_ID] for [NAME]',
    description: 'Returns a JSON validation result without fetching, caching, registering, or rendering the asset.',
    arguments: {
      RESOURCE_ID: {
        type: 'STRING',
        defaultValue: 'costume:Sprite1:costume1'
      },
      NAME: {
        type: 'STRING',
        defaultValue: 'asset1'
      }
    },
    hideFromPalette: true
  },
  {
    opcode: 'setLoadingBackdrop',
    blockType: 'COMMAND',
    text: 'set loading backdrop asset to [NAME]',
    description: 'Configures the image asset shown behind the loading indicator.',
    arguments: {
      NAME: {
        type: 'STRING',
        defaultValue: 'loadingBackdrop'
      }
    },
    hideFromPalette: true
  },
  {
    opcode: 'setLoadingCostumes',
    blockType: 'COMMAND',
    text: 'set loading costume assets to [NAMES]',
    description: 'Configures the comma-separated image assets used by the loading indicator.',
    arguments: {
      NAMES: {
        type: 'STRING',
        defaultValue: 'loading1,loading2'
      }
    },
    hideFromPalette: true
  },
  {
    opcode: 'prepareLoadingAssets',
    blockType: 'COMMAND',
    text: 'prioritize loading assets in list [LIST]',
    description: 'Moves configured loading assets to the front of the named asset definition list.',
    arguments: {
      LIST: {
        type: 'STRING',
        defaultValue: 'assetList'
      }
    },
    hideFromPalette: true
  },
  {
    opcode: 'loadingAssetCount',
    blockType: 'REPORTER',
    text: 'loading asset count',
    description: 'Returns the number of configured loading assets present in the prepared asset list.',
    arguments: {},
    hideFromPalette: true
  },
  {
    opcode: 'loadingBackdrop',
    blockType: 'REPORTER',
    text: 'loading backdrop asset',
    description: 'Returns the configured loading backdrop asset name.',
    arguments: {},
    hideFromPalette: true
  },
  {
    opcode: 'loadingCostumeAt',
    blockType: 'REPORTER',
    text: 'loading costume for asset number [INDEX]',
    description: 'Returns the configured loading costume asset for a one-based regular asset number.',
    arguments: {
      INDEX: {
        type: 'NUMBER',
        defaultValue: '1'
      }
    },
    hideFromPalette: true
  }
);

export type ParsedResourceIdentifier =
  | {kind: 'cache'}
  | {kind: 'external'; url: string}
  | {kind: 'costume'; spriteName: string; costumeName: string | null}
  | {kind: 'backdrop'; backdropName: string}
  | {kind: 'sound'; spriteName: string; soundName: string}
  | {kind: 'text'; runtimeVariableName: string};

export type ProjectAssetLocator =
  | Readonly<{kind: 'backdrop'; name: string}>
  | Readonly<{kind: 'costume'; target: string; name: string}>
  | Readonly<{kind: 'sound'; name: string; target?: string}>;

export type ProjectAssetAddressValidation =
  | {
      ok: true;
      kind: ParsedResourceIdentifier['kind'];
      projectLocal: boolean;
    }
  | {
      ok: false;
      type: string;
      label: string;
      message: string;
    };

export function normalizeName(value: unknown): string {
  return String(value ?? '').trim();
}

function literalProjectName(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty literal string.`);
  }
  return value;
}

export function parseProjectAssetLocator(value: unknown): ProjectAssetLocator {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Project asset locator must be an object.');
  }
  const input = value as Record<string, unknown>;
  const kind = input.kind;
  const allowed = kind === 'costume'
    ? new Set(['kind', 'name', 'target'])
    : kind === 'sound'
      ? new Set(['kind', 'name', 'target'])
      : new Set(['kind', 'name']);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new Error('Project asset locator contains an unknown field.');
  }
  const name = literalProjectName(input.name, 'Project asset source name');
  if (kind === 'backdrop') {
    if (Object.hasOwn(input, 'target')) {
      throw new Error('Backdrop locator must not provide target.');
    }
    return Object.freeze({kind, name});
  }
  if (kind === 'costume') {
    return Object.freeze({
      kind,
      name,
      target: literalProjectName(input.target, 'Costume target name')
    });
  }
  if (kind === 'sound') {
    return Object.freeze({
      kind,
      name,
      ...(Object.hasOwn(input, 'target')
        ? {target: literalProjectName(input.target, 'Sound target name')}
        : {})
    });
  }
  throw new Error('Project asset locator kind must be backdrop, costume, or sound.');
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
    if (bareScheme === 'text' && fallbackName) {
      const name = parseLocalResourceName(fallbackName, 'Text variable');
      return {kind: 'text', runtimeVariableName: textRuntimeVariableName(name)};
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
    case 'text': {
      const name = parseLocalResourceName(payload, 'Text variable');
      return {kind: 'text', runtimeVariableName: textRuntimeVariableName(name)};
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

function requireAssetNameValue(value: unknown, operation = 'registerAsset'): string {
  const name = normalizeName(value);
  if (!name) {
    throw new AssetManagerError('INVALID_ASSET_NAME', 'Asset name is empty.', {
      operation,
      assetName: name,
      hint: 'Provide a non-empty asset name.'
    });
  }
  return name;
}

function requireTextAssetNameValue(value: unknown, operation = 'registerAsset'): string {
  const name = requireAssetNameValue(value, operation);
  if (name.includes(':')) {
    throw new AssetManagerError(
      'INVALID_ASSET_NAME',
      `Text asset name "${name}" must not contain a colon.`,
      {operation, assetName: name, hint: 'Use a logical name without a colon.'}
    );
  }
  return name;
}

function copyEmbeddedBytes(value: unknown, assetName: string): ArrayBuffer {
  let bytes: Uint8Array;
  if (value instanceof ArrayBuffer) {
    bytes = new Uint8Array(value);
  } else if (value instanceof Uint8Array) {
    bytes = value;
  } else {
    throw new AssetManagerError(
      'RESOURCE_ID_INVALID',
      `Embedded asset "${assetName}" must provide an ArrayBuffer or Uint8Array.`,
      {
        operation: 'registerEmbeddedAsset',
        assetName,
        hint: 'Pass validated binary image or audio bytes.'
      }
    );
  }
  if (bytes.byteLength === 0) {
    throw new AssetManagerError(
      'RESOURCE_ID_INVALID',
      `Embedded asset "${assetName}" is empty.`,
      {
        operation: 'registerEmbeddedAsset',
        assetName,
        hint: 'Pass at least one byte.'
      }
    );
  }
  return Uint8Array.from(bytes).buffer;
}

function embeddedBitmapResolution(
  value: unknown,
  mimeType: string,
  assetName: string
): 1 | 2 {
  if (value === undefined) return 1;
  if (!mimeType.startsWith('image/') || mimeType === 'image/svg+xml') {
    throw new AssetManagerError(
      'ASSET_TYPE_MISMATCH',
      `Embedded asset "${assetName}" can specify bitmapResolution only for bitmap images.`,
      {
        operation: 'registerEmbeddedAsset',
        assetName,
        expectedKind: 'bitmap image',
        actualKind: mimeType,
        hint: 'Remove bitmapResolution or use a bitmap image MIME type.'
      }
    );
  }
  if (value !== 1 && value !== 2) {
    throw new AssetManagerError(
      'RESOURCE_ID_INVALID',
      `Embedded bitmap asset "${assetName}" must use bitmapResolution 1 or 2.`,
      {
        operation: 'registerEmbeddedAsset',
        assetName,
        hint: 'Use Scratch bitmap resolution 1 or 2.'
      }
    );
  }
  return value;
}

function findStageTarget(runtime: TurboWarpRuntime): TurboWarpTarget {
  const stage = runtime.targets.find((target) => target.isStage);
  if (!stage) {
    throw new AssetManagerError('SPRITE_NOT_FOUND', 'Stage target was not found.', {
      operation: 'resolveStage',
      actorName: STAGE_RESOURCE_NAME,
      hint: 'Load a project with a valid stage target.'
    });
  }
  return stage;
}

function findProjectTargetByName(
  runtime: TurboWarpRuntime,
  name: string
): TurboWarpTarget | null {
  return runtime.targets.find(
    (target) => !target.isStage && target.isOriginal && target.sprite?.name === name
  ) ?? runtime.targets.find(
    (target) => !target.isStage && target.sprite?.name === name
  ) ?? null;
}

function findProjectCostume(
  target: TurboWarpTarget,
  costumeName: string,
  assetId: string | null
): TurboWarpCostume | null {
  const costumes = target.sprite?.costumes ?? [];
  return (assetId
    ? costumes.find((costume) => costume.assetId === assetId)
    : undefined) ?? costumes.find((costume) => costume.name === costumeName) ?? null;
}

function findProjectSound(
  target: TurboWarpTarget,
  soundName: string,
  assetId: string | null
): TurboWarpSound | null {
  const sounds = target.sprite?.sounds ?? [];
  return (assetId
    ? sounds.find((sound) => sound.assetId === assetId)
    : undefined) ?? sounds.find((sound) => sound.name === soundName) ?? null;
}

function resolveCostumeAddress(
  runtime: TurboWarpRuntime,
  name: string,
  spriteName: string,
  costumeName: string | null
): {target: TurboWarpTarget; costume: TurboWarpCostume; costumeName: string} {
  const target = findProjectTargetByName(runtime, spriteName);
  if (!target) {
    const candidates = suggestNames(
      spriteName,
      runtime.targets.flatMap((candidate) =>
        !candidate.isStage && candidate.sprite?.name ? [candidate.sprite.name] : []
      )
    );
    throw new AssetManagerError('SPRITE_NOT_FOUND', `Sprite not found: ${spriteName}.`, {
      operation: 'registerAsset',
      assetName: name,
      actorName: spriteName,
      candidates,
      hint: suggestionHint(candidates)
    });
  }
  const costumes = target.sprite?.costumes ?? [];
  const costume = costumeName === null
    ? costumes.find((candidate) => candidate.name === name)
      ?? (costumes.length === 1 ? costumes[0] : null)
    : findProjectCostume(target, costumeName, null);
  if (!costume && costumeName === null && costumes.length > 1) {
    const candidates = suggestNames(name, costumes.map((candidate) => candidate.name));
    throw new AssetManagerError(
      'SOURCE_ASSET_NOT_FOUND',
      `Costume shorthand is ambiguous: ${spriteName} has multiple costumes and none is named ${name}.`,
      {
        operation: 'registerAsset',
        assetName: name,
        actorName: spriteName,
        candidates,
        hint: suggestionHint(candidates) ?? 'Specify the costume name explicitly.'
      }
    );
  }
  const resolvedCostumeName = costume?.name ?? costumeName ?? name;
  if (!costume) {
    const candidates = suggestNames(
      resolvedCostumeName,
      costumes.map((candidate) => candidate.name)
    );
    throw new AssetManagerError(
      'SOURCE_ASSET_NOT_FOUND',
      `Costume not found: ${spriteName}/${resolvedCostumeName}.`,
      {
        operation: 'registerAsset',
        assetName: name,
        actorName: spriteName,
        candidates,
        hint: suggestionHint(candidates)
      }
    );
  }
  return {target, costume, costumeName: resolvedCostumeName};
}

function resolveBackdropAddress(
  runtime: TurboWarpRuntime,
  backdropName: string
): {target: TurboWarpTarget; costume: TurboWarpCostume} {
  const target = findStageTarget(runtime);
  const costume = findProjectCostume(target, backdropName, null);
  if (!costume) {
    const candidates = suggestNames(
      backdropName,
      (target.sprite?.costumes ?? []).map((candidate) => candidate.name)
    );
    throw new AssetManagerError('SOURCE_ASSET_NOT_FOUND', `Backdrop not found: ${backdropName}.`, {
      operation: 'registerAsset',
      assetName: backdropName,
      actorName: STAGE_RESOURCE_NAME,
      candidates,
      hint: suggestionHint(candidates)
    });
  }
  return {target, costume};
}

function resolveSoundAddress(
  runtime: TurboWarpRuntime,
  spriteName: string,
  soundName: string,
  assetName = soundName
): {target: TurboWarpTarget; sound: TurboWarpSound; isStage: boolean} {
  const isStage = spriteName.toLowerCase() === STAGE_RESOURCE_NAME;
  const target = isStage
    ? findStageTarget(runtime)
    : findProjectTargetByName(runtime, spriteName);
  if (!target) {
    const candidates = suggestNames(
      spriteName,
      runtime.targets.flatMap((candidate) => candidate.sprite?.name ? [candidate.sprite.name] : [])
    );
    throw new AssetManagerError('SPRITE_NOT_FOUND', `Sound source not found: ${spriteName}.`, {
      operation: 'registerAsset',
      assetName,
      actorName: spriteName,
      candidates,
      hint: suggestionHint(candidates)
    });
  }
  const sound = findProjectSound(target, soundName, null);
  if (!sound) {
    const candidates = suggestNames(
      soundName,
      (target.sprite?.sounds ?? []).map((candidate) => candidate.name)
    );
    throw new AssetManagerError('SOURCE_ASSET_NOT_FOUND', `Sound not found: ${spriteName}/${soundName}.`, {
      operation: 'registerAsset',
      assetName,
      actorName: spriteName,
      candidates,
      hint: suggestionHint(candidates)
    });
  }
  return {target, sound, isStage};
}

function resolveLiteralSoundAddress(
  runtime: TurboWarpRuntime,
  targetName: string | undefined,
  soundName: string,
  assetName: string
): {target: TurboWarpTarget; sound: TurboWarpSound; isStage: boolean; targetName: string} {
  const isStage = targetName === undefined;
  const target = isStage
    ? findStageTarget(runtime)
    : findProjectTargetByName(runtime, targetName);
  if (!target) {
    const candidates = suggestNames(
      targetName ?? STAGE_RESOURCE_NAME,
      runtime.targets.flatMap((candidate) =>
        !candidate.isStage && candidate.sprite?.name ? [candidate.sprite.name] : []
      )
    );
    throw new AssetManagerError('SPRITE_NOT_FOUND', 'Structured sound target was not found.', {
      operation: 'registerProjectAsset',
      assetName,
      actorName: targetName,
      candidates,
      hint: suggestionHint(candidates)
    });
  }
  const sound = findProjectSound(target, soundName, null);
  if (!sound) {
    const candidates = suggestNames(
      soundName,
      (target.sprite?.sounds ?? []).map((candidate) => candidate.name)
    );
    throw new AssetManagerError(
      'SOURCE_ASSET_NOT_FOUND',
      'Structured project sound was not found.',
      {
        operation: 'registerProjectAsset',
        assetName,
        actorName: targetName,
        candidates,
        hint: suggestionHint(candidates)
      }
    );
  }
  return {target, sound, isStage, targetName: targetName ?? STAGE_RESOURCE_NAME};
}

export function validateProjectAssetAddress(
  runtime: TurboWarpRuntime,
  assetName: unknown,
  resourceIdentifier: unknown
): ProjectAssetAddressValidation {
  let fallbackType = 'asset-name';
  let fallbackLabel = normalizeName(assetName);
  try {
    const name = requireAssetNameValue(assetName);
    const resourceId = normalizeName(resourceIdentifier);
    if (resourceId === 'text' || resourceId.startsWith('text:')) {
      requireTextAssetNameValue(name);
    }
    fallbackType = 'resource-id';
    fallbackLabel = resourceId;
    const resource = parseResourceIdentifier(resourceIdentifier, name);
    switch (resource.kind) {
      case 'costume':
        resolveCostumeAddress(runtime, name, resource.spriteName, resource.costumeName);
        break;
      case 'backdrop':
        resolveBackdropAddress(runtime, resource.backdropName);
        break;
      case 'sound':
        resolveSoundAddress(runtime, resource.spriteName, resource.soundName, name);
        break;
      case 'text':
        requireTextAssetNameValue(name);
        break;
    }
    return {
      ok: true,
      kind: resource.kind,
      projectLocal: resource.kind !== 'cache' && resource.kind !== 'external'
    };
  } catch (error) {
    return {
      ok: false,
      type: error instanceof AssetManagerError
        ? error.code
        : fallbackType === 'asset-name' ? 'INVALID_ASSET_NAME' : 'RESOURCE_ID_INVALID',
      label: error instanceof AssetManagerError
        ? error.code === 'SPRITE_NOT_FOUND'
          ? error.actorName ?? error.assetName ?? fallbackLabel
          : error.code === 'RESOURCE_ID_INVALID'
            ? error.resourceId ?? error.assetName ?? fallbackLabel
            : error.assetName ?? error.actorName ?? error.resourceId ?? fallbackLabel
        : fallbackLabel,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

export class AssetManagerExtension {
  protected readonly runtime = Scratch.vm.runtime;
  private readonly renderer = this.runtime.renderer;
  private readonly externalAssets = new Map<string, ExternalMemoryAsset>();
  private readonly costumeAssets = new Map<string, CostumeAssetReference>();
  private readonly soundAssets = new Map<string, SoundAssetReference>();
  private readonly textAssets = new Map<string, TextAssetReference>();
  private readonly assetRegistry = new Map<string, AssetKind>();
  private readonly displayedAssets = new Map<string, DisplayBinding>();
  private readonly playingAudio = new Map<HTMLAudioElement, string>();
  private readonly audioVoiceStops = new WeakMap<HTMLAudioElement, () => void>();
  private readonly registrationVersions = new Map<string, number>();
  private readonly successfulRegistrationVersions = new Map<string, number>();
  private readonly registrationCancellationVersions = new Map<string, number>();
  private readonly registrationCommits = new Map<string, Promise<void>>();
  private readonly committedCacheRecords = new Map<string, AssetRecord | null>();
  protected readonly featureFlags: AssetManagerFeatureFlags;
  private loadingBackdropName = '';
  declare private loadingCostumes?: string[];
  declare private loadingAssetCountValue?: number;
  private lastAssetErrorType = '';
  private lastAssetErrorLabel = '';
  private assetErrorVersion = 0;
  private readonly domImageResourceVersions = new Map<string, number>();
  private readonly domImageResourceBackings =
    new Map<string, ExtensionDOMImageResourceBackingEntry>();
  private readonly activeDOMImageResources =
    new Set<ExtensionDOMImageResourceController>();
  private readonly activeDOMImageResourcesByName =
    new Map<string, Set<ExtensionDOMImageResourceController>>();
  private domImageCapabilityValue?: AssetManagerDOMImageCapability;
  private listeningForDOMImageLifecycle = false;
  private readonly releaseAllDOMImageResourcesForLifecycle = (): void => {
    this.releaseAllDOMImageResources();
  };
  private readonly releaseDOMImageResourcesForRuntimeDispose = (): void => {
    this.releaseAllDOMImageResources();
    this.stopListeningForDOMImageLifecycle();
  };

  constructor(featureFlags: AssetManagerFeatureFlags = FEATURE_FLAGS) {
    this.featureFlags = Object.freeze({...featureFlags});
    this.runtime.on?.('STOP_FOR_TARGET', (target?: TurboWarpTarget) => {
      if (target && !this.runtime.targets.includes(target)) {
        this.displayedAssets.delete(target.id);
      }
    });
  }

  setLoadingBackdrop(args: BlockArgs): void {
    this.loadingBackdropName = normalizeName(args.NAME);
    this.loadingAssetCountValue = 0;
  }

  setLoadingCostumes(args: BlockArgs): void {
    const seen = new Set<string>();
    this.loadingCostumes = String(args.NAMES ?? '')
      .split(',')
      .map((name) => normalizeName(name))
      .filter((name) => {
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      });
    this.loadingAssetCountValue = 0;
  }

  prepareLoadingAssets(args: BlockArgs, util: ScratchBlockUtility): void {
    const listName = normalizeName(args.LIST);
    const list = util.target?.lookupVariableByNameAndType?.(listName, 'list');
    if (!list || !Array.isArray(list.value)) {
      throw new Error(`Loading asset list not found: ${listName || '(empty)'}`);
    }
    const loadingBackdrop = this.loadingBackdropName;
    const loadingCostumes = this.loadingCostumes ?? [];
    const loadingCostumeNames = new Set(loadingCostumes);
    const loadingNames = new Set(
      [loadingBackdrop, ...loadingCostumes].filter((name) => name.length > 0)
    );
    const entries = list.value.map((entry) => String(entry));
    const declaredNames = new Set(entries.map((entry) => {
      const separatorIndex = entry.indexOf(',');
      return normalizeName(separatorIndex < 0 ? entry : entry.slice(0, separatorIndex));
    }));
    const missingNames = [...loadingNames].filter((name) => !declaredNames.has(name));
    if (missingNames.length > 0) {
      throw new Error(`Loading asset is not declared: ${missingNames.join(', ')}`);
    }
    const backdropEntries: string[] = [];
    const prioritized: string[] = [];
    const regular: string[] = [];
    for (const entry of entries) {
      const separatorIndex = entry.indexOf(',');
      const assetName = normalizeName(separatorIndex < 0 ? entry : entry.slice(0, separatorIndex));
      if (loadingBackdrop && assetName === loadingBackdrop) {
        backdropEntries.push(entry);
      } else {
        (loadingCostumeNames.has(assetName) ? prioritized : regular).push(entry);
      }
    }
    list.value.splice(0, list.value.length, ...backdropEntries, ...prioritized, ...regular);
    this.loadingAssetCountValue = backdropEntries.length + prioritized.length;
  }

  loadingAssetCount(): number {
    return this.loadingAssetCountValue ?? 0;
  }

  loadingBackdrop(): string {
    return this.loadingBackdropName;
  }

  loadingCostumeAt(args: BlockArgs): string {
    const loadingCostumes = this.loadingCostumes ?? [];
    if (loadingCostumes.length === 0) return '';
    const numericIndex = Number(args.INDEX);
    const index = Number.isFinite(numericIndex) ? Math.max(1, Math.trunc(numericIndex)) : 1;
    return loadingCostumes[(index - 1) % loadingCostumes.length]!;
  }

  getInfo() {
    return {
      id: EXTENSION_ID,
      name: Scratch.translate(definitions.extensionName),
      docsURI: EXTENSION_DOCS_URI,
      blockIconURI: BLOCK_ICON_URI,
      color1: '#5b7cfa', color2: '#425ed8', color3: '#2f46aa',
      blocks: blockDefinitions.map((block) => this.toScratchBlock(block))
    };
  }

  /**
   * Exposes the stock extension registry through a host-neutral DOM image
   * resource contract for other unsandboxed extensions.
   */
  getDOMImageCapability(): AssetManagerDOMImageCapability {
    this.startListeningForDOMImageLifecycle();
    this.domImageCapabilityValue ??= Object.freeze({
      isRegistered: (name: unknown): boolean =>
        this.assetRegistry.has(normalizeName(name)),
      getMimeType: (name: unknown): string =>
        this.getAssetMimeType({NAME: name}),
      resolveDOMImageResource: (name: unknown): Promise<DOMImageResource> =>
        this.resolveExtensionDOMImageResource(name)
    });
    return this.domImageCapabilityValue;
  }

  validateProjectAssetAddress(args: BlockArgs): string {
    return JSON.stringify(
      validateProjectAssetAddress(this.runtime, args.NAME, args.RESOURCE_ID)
    );
  }

  async registerProjectAssetLiteral(assetName: unknown, locatorInput: unknown): Promise<void> {
    const name = requireAssetNameValue(assetName, 'registerProjectAsset');
    let locator: ProjectAssetLocator;
    try {
      locator = parseProjectAssetLocator(locatorInput);
    } catch (error) {
      throw new AssetManagerError('RESOURCE_ID_INVALID', errorMessage(error), {
        operation: 'registerProjectAsset',
        assetName: name,
        hint: 'Pass a structured backdrop, costume, or sound locator.',
        cause: error
      });
    }
    switch (locator.kind) {
      case 'backdrop':
        await this.registerBackdropReference(name, locator.name);
        return;
      case 'costume':
        await this.registerCostumeReference(name, locator.target, locator.name);
        return;
      case 'sound':
        await this.registerLiteralSoundReference(name, locator.target, locator.name);
        return;
    }
  }

  async registerAsset(args: BlockArgs): Promise<void> {
    const errorVersion = ++this.assetErrorVersion;
    this.clearAssetError();
    let fallbackType = 'asset-name';
    let fallbackLabel = normalizeName(args.NAME);
    try {
      const name = this.requireAssetName(args.NAME);
      const resourceId = normalizeName(args.RESOURCE_ID);
      if (resourceId === 'text' || resourceId.startsWith('text:')) {
        this.requireTextAssetName(name);
      }
      fallbackType = 'resource-id';
      fallbackLabel = resourceId;
      let resource: ParsedResourceIdentifier;
      try {
        resource = parseResourceIdentifier(args.RESOURCE_ID, name);
      } catch (error) {
        throw new AssetManagerError('RESOURCE_ID_INVALID', errorMessage(error), {
          operation: 'registerAsset',
          assetName: name,
          resourceId,
          hint: 'Use an HTTP(S) URL or a supported costume, backdrop, sound, or text resource ID.',
          cause: error
        });
      }
      switch (resource.kind) {
        case 'cache':
          fallbackType = 'cache';
          fallbackLabel = name;
          await this.registerExternalAsset('', name);
          return;
        case 'external':
          fallbackType = 'external';
          fallbackLabel = resource.url;
          await this.registerExternalAsset(resource.url, name);
          return;
        case 'costume':
          fallbackType = 'costume';
          fallbackLabel = resource.costumeName ?? name;
          await this.registerCostumeReference(name, resource.spriteName, resource.costumeName);
          return;
        case 'backdrop':
          fallbackType = 'backdrop';
          fallbackLabel = resource.backdropName;
          await this.registerBackdropReference(name, resource.backdropName);
          return;
        case 'sound':
          fallbackType = 'sound';
          fallbackLabel = resource.soundName;
          await this.registerSoundReference(name, resource.spriteName, resource.soundName);
          return;
        case 'text':
          fallbackType = 'text';
          fallbackLabel = resource.runtimeVariableName;
          await this.registerTextReference(name, resource.runtimeVariableName);
          return;
      }
    } catch (error) {
      const diagnostic = error instanceof AssetManagerError
        ? error
        : new AssetManagerError('REPLACEMENT_FAILED', errorMessage(error), {
            operation: 'registerAsset',
            assetName: fallbackType === 'asset-name'
              ? fallbackLabel
              : normalizeName(args.NAME),
            resourceId: normalizeName(args.RESOURCE_ID),
            hint: 'The previous registration and display were kept. Check the resource and try again.',
            cause: error
          });
      if (this.assetErrorVersion === errorVersion) {
        if (diagnostic instanceof AssetManagerError) {
          this.lastAssetErrorType = diagnostic.code;
          this.lastAssetErrorLabel =
            diagnostic.code === 'SPRITE_NOT_FOUND'
              ? diagnostic.actorName ?? diagnostic.assetName ?? fallbackLabel
              : diagnostic.code === 'RESOURCE_ID_INVALID'
                ? diagnostic.resourceId ?? diagnostic.assetName ?? fallbackLabel
                : diagnostic.assetName ?? diagnostic.actorName ?? diagnostic.resourceId ?? fallbackLabel;
        }
      }
      throw diagnostic;
    }
  }

  async registerEmbeddedAsset(
    input: EmbeddedAssetBytesInput
  ): Promise<EmbeddedAssetRegistration> {
    const name = this.requireAssetName(input.name, 'registerEmbeddedAsset');
    const sourceName = normalizeName(input.sourceName) || name;
    const mimeType = normalizeMimeType(input.mimeType, sourceName);
    const mediaKind = mimeType.startsWith('image/')
      ? 'image'
      : mimeType.startsWith('audio/')
        ? 'audio'
        : 'unknown';
    if (mediaKind === 'unknown') {
      throw new AssetManagerError(
        'ASSET_TYPE_MISMATCH',
        `Embedded asset "${name}" has unsupported MIME type ${mimeType}.`,
        {
          operation: 'registerEmbeddedAsset',
          assetName: name,
          expectedKind: 'image or audio',
          actualKind: mimeType,
          hint: 'Use an image/* or audio/* MIME type.'
        }
      );
    }
    const bitmapResolution = embeddedBitmapResolution(input.bitmapResolution, mimeType, name);
    const data = copyEmbeddedBytes(input.bytes, name);
    const token = this.beginRegistration(name);
    const prepared: ExternalMemoryAsset = {
      kind: 'external',
      name,
      url: sourceName,
      mimeType,
      data,
      cachedAt: Date.now(),
      skinId: null,
      ...(mediaKind === 'image' && mimeType !== 'image/svg+xml' ? {bitmapResolution} : {})
    };
    await this.commitPreparedAsset(name, 'external', prepared, token);
    return Object.freeze({name, mimeType});
  }

  assetErrorType(): string {
    return this.lastAssetErrorType;
  }

  assetErrorLabel(): string {
    return this.lastAssetErrorLabel;
  }

  /** Legacy opcode retained for existing projects. */
  async loadAsset(args: BlockArgs): Promise<void> {
    const name = this.requireAssetName(args.NAME, 'loadAsset');
    const resourceId = normalizeName(args.URL);
    try {
      await this.registerExternalAsset(resourceId, name);
    } catch (error) {
      if (error instanceof AssetManagerError) throw error;
      throw new AssetManagerError('REPLACEMENT_FAILED', errorMessage(error), {
        operation: 'loadAsset',
        assetName: name,
        resourceId,
        hint: 'The previous registration and display were kept. Check the URL or cache.',
        cause: error
      });
    }
  }

  deleteMemoryAsset(args: BlockArgs): void {
    this.unregisterAsset(normalizeName(args.NAME));
  }

  deleteAllMemoryAssets(): void {
    this.releaseAllDOMImageResources();
    for (const name of this.registrationVersions.keys()) {
      this.cancelRegistrations(name);
    }
    for (const asset of this.externalAssets.values()) this.deleteOwnedSkinIfExists(asset);
    this.externalAssets.clear();
    this.costumeAssets.clear();
    this.soundAssets.clear();
    this.textAssets.clear();
    this.assetRegistry.clear();
    this.displayedAssets.clear();
    for (const audio of [...this.playingAudio.keys()]) this.stopExternalAudio(audio);
    this.playingAudio.clear();
  }

  async deleteCachedAsset(args: BlockArgs): Promise<void> {
    const name = normalizeName(args.NAME);
    await this.cacheDelete(name);
    this.committedCacheRecords.set(name, null);
  }

  async deleteAllCachedAssets(): Promise<void> {
    await this.cacheClear();
    this.committedCacheRecords.clear();
  }

  isLoaded(args: BlockArgs): boolean {
    return this.assetRegistry.has(normalizeName(args.NAME));
  }

  async setThisSpriteSkin(args: BlockArgs, util: ScratchBlockUtility): Promise<void> {
    if (!util.target || util.target.isStage) {
      throw new AssetManagerError(
        'SPRITE_NOT_FOUND',
        'This block must be used on a sprite or its clone.',
        {operation: 'setThisSpriteSkin', hint: 'Run this block from a sprite target.'}
      );
    }
    await this.applyAssetToTarget(util.target, args.NAME, util);
  }

  async setSpriteSkin(args: BlockArgs, util?: ScratchBlockUtility): Promise<void> {
    const name = normalizeName(args.SPRITE);
    const target = this.findTargetByName(name);
    if (!target) {
      const candidates = suggestNames(
        name,
        this.runtime.targets.flatMap((candidate) =>
          !candidate.isStage && candidate.sprite?.name ? [candidate.sprite.name] : []
        )
      );
      throw new AssetManagerError('SPRITE_NOT_FOUND', `Sprite not found: ${name}.`, {
        operation: 'setSpriteSkin',
        actorName: name,
        candidates,
        hint: suggestionHint(candidates)
      });
    }
    await this.applyAssetToTarget(target, args.NAME, util);
  }

  async setStageSkin(args: BlockArgs): Promise<void> {
    await this.applyAssetToTarget(this.getStageTarget(), args.NAME);
  }

  async playSound(args: BlockArgs): Promise<void> {
    await this.playResolvedSound(args.NAME, false);
  }

  async playSoundUntilDone(args: BlockArgs): Promise<void> {
    await this.playResolvedSound(args.NAME, true);
  }

  async createAudioVoice(
    value: unknown,
    options: AssetManagerAudioVoiceOptions = {}
  ): Promise<AssetManagerAudioVoice> {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new TypeError('Audio voice options must be an object.');
    }
    if (Object.keys(options).some((key) => key !== 'gain')) {
      throw new TypeError('Audio voice options contain an unknown property.');
    }
    const gain = normalizeAudioVoiceGain(options.gain, 'Audio voice initial gain');
    const name = normalizeName(value);
    const resource = await this.resolveAudioBytes(name);
    const playback = this.startBrowserAudioVoice(
      name,
      resource.bytes,
      resource.mimeType,
      gain,
      'createAudioVoice'
    );
    await playback.started;
    return playback.voice;
  }

  stopSound(args: BlockArgs): void {
    const name = normalizeName(args.NAME);
    const kind = this.assetRegistry.get(name);
    if (!kind) throw this.assetNotRegistered('stopSound', name);
    if (kind === 'external') {
      const asset = this.externalAssets.get(name);
      if (!asset) throw this.assetNotRegistered('stopSound', name);
      asset.mimeType = normalizeMimeType(asset.mimeType, asset.url || name);
      if (!asset.mimeType.startsWith('audio/')) {
        throw this.assetTypeMismatch('stopSound', name, 'audio', `external/${this.externalMediaKind(asset)}`);
      }
      for (const [audio, assetName] of [...this.playingAudio]) {
        if (assetName === name) this.stopExternalAudio(audio);
      }
      return;
    }
    if (kind === 'sound') {
      const {target, sound, soundBank} = this.resolveSoundReference(name);
      for (const [audio, assetName] of [...this.playingAudio]) {
        if (assetName === name) this.stopExternalAudio(audio);
      }
      soundBank.stop(target, sound.soundId as string);
      return;
    }
    throw this.assetTypeMismatch('stopSound', name, 'audio', kind);
  }

  stopAllSounds(): void {
    for (const audio of [...this.playingAudio.keys()]) this.stopExternalAudio(audio);
    this.playingAudio.clear();
    for (const target of this.runtime.targets) {
      target.sprite?.soundBank?.stopAllSounds(target);
    }
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
      case 'costume':
      case 'backdrop': {
        const {costume} = this.resolveCostumeReference(name);
        return this.projectAssetMimeType(costume.dataFormat, 'image');
      }
      case 'sound': {
        const {sound} = this.resolveSoundReference(name);
        return this.projectAssetMimeType(sound.dataFormat, 'audio');
      }
      case 'text': {
        return 'text/plain';
      }
    }
  }

  async resolveImageAssetBytes(args: BlockArgs): Promise<ResolvedImageAssetBytes> {
    const name = normalizeName(args.NAME);
    const kind = this.assetRegistry.get(name);
    if (!kind) throw this.assetNotRegistered('resolveDOMImageResource', name);
    if (kind === 'external') {
      const asset = this.externalAssets.get(name);
      if (!asset) throw this.assetNotRegistered('resolveDOMImageResource', name);
      const mimeType = normalizeMimeType(asset.mimeType, asset.url || name);
      if (!mimeType.startsWith('image/')) {
        throw this.assetTypeMismatch(
          'resolveDOMImageResource',
          name,
          'image',
          `external/${this.externalMediaKind(asset)}`
        );
      }
      return Object.freeze({bytes: new Uint8Array(asset.data.slice(0)), mimeType});
    }
    if (kind === 'costume' || kind === 'backdrop') {
      const {costume} = this.resolveCostumeReference(name);
      const mimeType = this.projectAssetMimeType(costume.dataFormat, 'image');
      const asset = await this.resolveProjectImageStorageAsset(name, costume);
      const source = asset.data instanceof Uint8Array
        ? asset.data
        : new Uint8Array(asset.data);
      return Object.freeze({bytes: Uint8Array.from(source), mimeType});
    }
    throw this.assetTypeMismatch('resolveDOMImageResource', name, 'image', kind);
  }

  getVersion(): string {
    return EXTENSION_VERSION;
  }

  async setTextValue(args: BlockArgs): Promise<void> {
    const name = this.requireTextAssetName(args.NAME, 'setTextValue');
    const kind = this.assetRegistry.get(name);
    if (kind !== undefined && kind !== 'text') {
      throw this.assetTypeMismatch('setTextValue', name, 'text', kind);
    }
    const reference = this.textAssets.get(name);
    this.setRuntimeVariable(
      reference?.runtimeVariableName ?? textRuntimeVariableName(name),
      String(args.VALUE ?? '')
    );
    const targets = this.runtime.targets.filter(
      (target) => this.displayedAssets.get(target.id)?.assetName === name
    );
    await Promise.all(
      targets.map(async (target) => {
        await this.applyTextToTarget(target, name, {runtime: this.runtime, target});
        this.setDisplayBinding(target, name, 'text');
      })
    );
  }

  setTextStyle(args: BlockArgs): void {
    const name = this.requireTextAssetName(args.NAME, 'setTextStyle');
    const kind = this.assetRegistry.get(name);
    if (kind !== undefined && kind !== 'text') {
      throw this.assetTypeMismatch('setTextStyle', name, 'text', kind);
    }
    let property;
    try {
      property = normalizeTextStyleProperty(args.PROPERTY);
    } catch (error) {
      throw new AssetManagerError('STYLE_PROPERTY_INVALID', errorMessage(error), {
        operation: 'setTextStyle',
        assetName: name,
        hint: 'Use animation, font, color, width, or align.',
        cause: error
      });
    }
    let value;
    try {
      value = normalizeTextStyleValue(property, args.VALUE);
    } catch (error) {
      throw new AssetManagerError('STYLE_VALUE_INVALID', errorMessage(error), {
        operation: 'setTextStyle',
        assetName: name,
        hint: `Provide a valid ${property} value.`,
        cause: error
      });
    }
    this.setRuntimeVariable(textStyleRuntimeVariableName(name, property), value);
  }

  protected assetNotRegistered(operation: string, name: string): AssetManagerError {
    const candidates = suggestNames(name, this.assetRegistry.keys());
    return new AssetManagerError(
      'ASSET_NOT_REGISTERED',
      `Cannot ${operation} asset "${name}": no registered asset has that name.`,
      {
        operation,
        assetName: name,
        candidates,
        hint: suggestionHint(candidates) ?? 'Register the asset before using it.'
      }
    );
  }

  protected assetTypeMismatch(
    operation: string,
    name: string,
    expectedKind: string,
    actualKind: string
  ): AssetManagerError {
    return new AssetManagerError(
      'ASSET_TYPE_MISMATCH',
      `Cannot ${operation} asset "${name}": expected ${expectedKind}, but it is ${actualKind}.`,
      {
        operation,
        assetName: name,
        expectedKind,
        actualKind,
        hint: `Use an asset registered as ${expectedKind}.`
      }
    );
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

  private requireAssetName(value: unknown, operation = 'registerAsset'): string {
    return requireAssetNameValue(value, operation);
  }

  private requireTextAssetName(value: unknown, operation = 'registerAsset'): string {
    return requireTextAssetNameValue(value, operation);
  }

  private clearAssetError(): void {
    this.lastAssetErrorType = '';
    this.lastAssetErrorLabel = '';
  }

  private beginRegistration(name: string): RegistrationToken {
    const version = (this.registrationVersions.get(name) ?? 0) + 1;
    this.registrationVersions.set(name, version);
    return {
      version,
      cancellationVersion: this.registrationCancellationVersions.get(name) ?? 0
    };
  }

  private cancelRegistrations(name: string): void {
    const cancellationVersion = (this.registrationCancellationVersions.get(name) ?? 0) + 1;
    this.registrationCancellationVersions.set(name, cancellationVersion);
  }

  private isRegistrationCancellationCurrent(
    name: string,
    token: RegistrationToken
  ): boolean {
    return (this.registrationCancellationVersions.get(name) ?? 0) === token.cancellationVersion;
  }

  private async registerExternalAsset(url: string, name: string): Promise<void> {
    const token = this.beginRegistration(name);
    const record = url
      ? await this.fetchExternalAsset(url, name)
      : this.committedCacheRecords.has(name)
      ? this.committedCacheRecords.get(name) ?? null
      : await this.cacheGet(name);
    if (!this.isRegistrationCancellationCurrent(name, token)) return;
    if (!record) {
      const candidates = suggestNames(name, this.assetRegistry.keys());
      throw new AssetManagerError(
        'ASSET_NOT_REGISTERED',
        `Asset "${name}" is not cached and no URL was provided.`,
        {
          operation: 'registerAsset',
          assetName: name,
          candidates,
          hint: suggestionHint(candidates) ?? 'Register an HTTP(S) URL before loading from cache.'
        }
      );
    }
    const prepared: ExternalMemoryAsset = {
      ...record,
      kind: 'external',
      mimeType: normalizeMimeType(record.mimeType, record.url || name),
      skinId: null
    };
    await this.commitPreparedAsset(name, 'external', prepared, token, url ? record : undefined);
  }

  private async registerCostumeReference(
    name: string,
    spriteName: string,
    costumeName: string | null
  ): Promise<void> {
    const token = this.beginRegistration(name);
    const {target, costume, costumeName: resolvedCostumeName} =
      resolveCostumeAddress(this.runtime, name, spriteName, costumeName);
    if (!this.isRegistrationCancellationCurrent(name, token)) return;
    await this.commitPreparedAsset(name, 'costume', {
      kind: 'costume',
      name,
      targetId: target.id,
      targetName: spriteName,
      isStage: false,
      costumeName: resolvedCostumeName,
      assetId: costume.assetId ?? null
    }, token);
  }

  private async registerBackdropReference(name: string, backdropName: string): Promise<void> {
    const token = this.beginRegistration(name);
    const {target: stage, costume} = resolveBackdropAddress(this.runtime, backdropName);
    if (!this.isRegistrationCancellationCurrent(name, token)) return;
    await this.commitPreparedAsset(name, 'backdrop', {
      kind: 'backdrop',
      name,
      targetId: stage.id,
      targetName: STAGE_RESOURCE_NAME,
      isStage: true,
      costumeName: backdropName,
      assetId: costume.assetId ?? null
    }, token);
  }

  private async registerSoundReference(
    name: string,
    spriteName: string,
    soundName: string
  ): Promise<void> {
    const token = this.beginRegistration(name);
    const {target, sound, isStage} = resolveSoundAddress(
      this.runtime,
      spriteName,
      soundName,
      name
    );
    if (!this.isRegistrationCancellationCurrent(name, token)) return;
    await this.commitPreparedAsset(name, 'sound', {
      kind: 'sound',
      name,
      targetId: target.id,
      targetName: isStage ? STAGE_RESOURCE_NAME : spriteName,
      isStage,
      soundName,
      assetId: sound.assetId ?? null
    }, token);
  }

  private async registerLiteralSoundReference(
    name: string,
    targetName: string | undefined,
    soundName: string
  ): Promise<void> {
    const token = this.beginRegistration(name);
    const resolved = resolveLiteralSoundAddress(this.runtime, targetName, soundName, name);
    if (!this.isRegistrationCancellationCurrent(name, token)) return;
    await this.commitPreparedAsset(name, 'sound', {
      kind: 'sound',
      name,
      targetId: resolved.target.id,
      targetName: resolved.targetName,
      isStage: resolved.isStage,
      soundName,
      assetId: resolved.sound.assetId ?? null
    }, token);
  }

  private async registerTextReference(name: string, runtimeVariableName: string): Promise<void> {
    const token = this.beginRegistration(name);
    this.requireTextAssetName(name);
    if (!this.isRegistrationCancellationCurrent(name, token)) return;
    await this.commitPreparedAsset(name, 'text', {
      kind: 'text',
      name,
      runtimeVariableName
    }, token);
  }

  private unregisterAsset(name: string): void {
    this.cancelRegistrations(name);
    this.invalidateDOMImageResources(name);
    const kind = this.assetRegistry.get(name);
    if (!kind) return;
    const asset = this.getRegisteredAsset(name, kind);
    this.removeRegisteredAsset(name, kind);
    this.disposeRegisteredAsset(asset);
    this.assetRegistry.delete(name);
    for (const [targetId, binding] of this.displayedAssets) {
      if (binding.assetName === name) this.displayedAssets.delete(targetId);
    }
  }

  private async commitPreparedAsset(
    name: string,
    kind: AssetKind,
    prepared: RegisteredAsset,
    token: RegistrationToken,
    cacheRecord?: AssetRecord
  ): Promise<void> {
    const previousCommit = this.registrationCommits.get(name) ?? Promise.resolve();
    const commit = previousCommit.catch(() => undefined).then(async () => {
      if (!this.isRegistrationCancellationCurrent(name, token) ||
          token.version < (this.successfulRegistrationVersions.get(name) ?? 0)) {
        this.disposeRegisteredAsset(prepared);
        return;
      }

      const currentKind = this.assetRegistry.get(name);
      const current = currentKind ? this.getRegisteredAsset(name, currentKind) : undefined;
      this.assertReplacementKind(name, currentKind, current, kind, prepared);

      let previousCached: AssetRecord | null | undefined;
      let nextCached: AssetRecord | undefined;
      if (cacheRecord) {
        previousCached = this.committedCacheRecords.has(name)
          ? this.committedCacheRecords.get(name) ?? null
          : await this.cacheGet(name);
        if (!this.isRegistrationCancellationCurrent(name, token)) {
          this.disposeRegisteredAsset(prepared);
          return;
        }
        nextCached = {...cacheRecord, generation: token.version};
        await this.cachePut(nextCached);
        if (!this.isRegistrationCancellationCurrent(name, token)) {
          await this.restoreCacheIfGeneration(name, token.version, previousCached);
          this.disposeRegisteredAsset(prepared);
          return;
        }
      }

      try {
        await this.commitPreparedAssetNow(name, kind, prepared, token);
      } catch (error) {
        if (cacheRecord) {
          await this.restoreCacheIfGeneration(name, token.version, previousCached ?? null);
        }
        throw error;
      }
      this.invalidateDOMImageResources(name);
      if (!this.isRegistrationCancellationCurrent(name, token)) {
        if (cacheRecord) {
          await this.restoreCacheIfGeneration(name, token.version, previousCached ?? null);
        }
        return;
      }
      this.successfulRegistrationVersions.set(name, token.version);
      if (nextCached) this.committedCacheRecords.set(name, nextCached);
    });
    this.registrationCommits.set(name, commit);
    try {
      await commit;
    } finally {
      if (this.registrationCommits.get(name) === commit) this.registrationCommits.delete(name);
    }
  }

  private async commitPreparedAssetNow(
    name: string,
    kind: AssetKind,
    prepared: RegisteredAsset,
    token: RegistrationToken
  ): Promise<void> {
    const currentKind = this.assetRegistry.get(name);
    const current = currentKind ? this.getRegisteredAsset(name, currentKind) : undefined;
    this.assertReplacementKind(name, currentKind, current, kind, prepared);

    if (currentKind === kind && current &&
        this.featureFlags.ENABLE_LIVE_ASSET_REPLACEMENT) {
      await this.replaceRegisteredAsset(name, kind, current, prepared, token);
      return;
    }

    if (currentKind) this.removeRegisteredAsset(name, currentKind);
    this.installRegisteredAsset(name, kind, prepared);
    this.disposeRegisteredAsset(current);
    for (const [targetId, binding] of this.displayedAssets) {
      if (binding.assetName === name) this.displayedAssets.delete(targetId);
    }
  }

  private assertReplacementKind(
    name: string,
    currentKind: AssetKind | undefined,
    current: RegisteredAsset | undefined,
    nextKind: AssetKind,
    next: RegisteredAsset
  ): void {
    if (!currentKind || !this.featureFlags.ENABLE_STRICT_ASSET_KIND_REPLACEMENT) return;
    let expectedKind: string = currentKind;
    let actualKind: string = nextKind;
    if (currentKind === 'external' && nextKind === 'external' &&
        current?.kind === 'external' && next.kind === 'external') {
      const currentMedia = this.externalMediaKind(current);
      const nextMedia = this.externalMediaKind(next);
      if (currentMedia === nextMedia || currentMedia === 'unknown' || nextMedia === 'unknown') return;
      expectedKind = `external/${currentMedia}`;
      actualKind = `external/${nextMedia}`;
    } else if (currentKind === nextKind) {
      return;
    }
    throw new AssetManagerError(
      'ASSET_TYPE_CHANGE',
      `Cannot replace asset "${name}": it is currently registered as ${expectedKind}, ` +
        `but the new resource is ${actualKind}.`,
      {
        operation: 'registerAsset',
        assetName: name,
        expectedKind,
        actualKind,
        hint: 'Delete the existing asset first if this type change is intentional.'
      }
    );
  }

  private async replaceRegisteredAsset(
    name: string,
    kind: AssetKind,
    current: RegisteredAsset,
    prepared: RegisteredAsset,
    token: RegistrationToken
  ): Promise<void> {
    const managedDisplays = [...this.displayedAssets]
      .filter(([, binding]) =>
        binding.assetName === name && binding.assetKind === kind
      )
      .flatMap(([targetId, binding]) => {
        const target = this.runtime.targets.find((candidate) => candidate.id === targetId);
        if (target && this.isDisplayBindingCurrent(target, binding)) {
          return [{target, binding}];
        }
        this.displayedAssets.delete(targetId);
        return [];
      });
    let preparedDisplays: Array<{
      target: TurboWarpTarget;
      binding: DisplayBinding;
      skin: ResolvedSkin | null;
    }>;
    try {
      const skin = kind === 'text' || managedDisplays.length === 0
        ? null
        : await this.resolveSkinFromAsset(name, kind, prepared);
      preparedDisplays = managedDisplays.map(({target, binding}) => ({target, binding, skin}));
    } catch (error) {
      this.disposeRegisteredAsset(prepared);
      throw new AssetManagerError(
        'REPLACEMENT_FAILED',
        `Cannot prepare replacement asset "${name}": ${errorMessage(error)}`,
        {
          operation: 'registerAsset',
          assetName: name,
          hint: 'The old registration and display were kept.',
          cause: error
        }
      );
    }

    if (!this.isRegistrationCancellationCurrent(name, token)) {
      this.disposeRegisteredAsset(prepared);
      return;
    }

    this.installRegisteredAsset(name, kind, prepared);
    const attemptedTargets: TurboWarpTarget[] = [];
    try {
      for (const display of preparedDisplays) {
        if (!this.isRegistrationCancellationCurrent(name, token)) break;
        if (!this.runtime.targets.includes(display.target)) {
          this.displayedAssets.delete(display.target.id);
          continue;
        }
        if (this.displayedAssets.get(display.target.id) !== display.binding) continue;
        if (!this.isDisplayBindingCurrent(display.target, display.binding)) {
          this.displayedAssets.delete(display.target.id);
          continue;
        }
        attemptedTargets.push(display.target);
        if (kind === 'text') {
          await this.applyTextReferenceToTarget(
            display.target,
            name,
            prepared as TextAssetReference,
            {runtime: this.runtime, target: display.target}
          );
        } else if (display.skin) {
          this.applySkinToTarget(display.target, display.skin);
        }
        if (this.isRegistrationCancellationCurrent(name, token)) {
          this.setDisplayBinding(display.target, name, kind, display.skin?.skinId);
        }
      }
    } catch (error) {
      if (!this.isRegistrationCancellationCurrent(name, token)) {
        this.disposeRegisteredAsset(current);
        return;
      }
      this.installRegisteredAsset(name, kind, current);
      let rollbackError: unknown;
      for (const target of attemptedTargets) {
        if (!this.runtime.targets.includes(target)) continue;
        try {
          if (kind === 'text') {
            await this.applyTextReferenceToTarget(
              target,
              name,
              current as TextAssetReference,
              {runtime: this.runtime, target}
            );
          } else {
            const currentSkin = await this.resolveSkinFromAsset(name, kind, current);
            this.applySkinToTarget(target, currentSkin);
            this.setDisplayBinding(target, name, kind, currentSkin.skinId);
            continue;
          }
          this.setDisplayBinding(target, name, kind);
        } catch (rollbackFailure) {
          rollbackError ??= rollbackFailure;
        }
      }
      this.disposeRegisteredAsset(prepared);
      throw new AssetManagerError(
        'REPLACEMENT_FAILED',
        `Cannot replace asset "${name}": ${errorMessage(error)}`,
        {
          operation: 'registerAsset',
          assetName: name,
          hint: rollbackError
            ? `The old registration was restored, but its display could not be reapplied: ${errorMessage(rollbackError)}`
            : 'The old registration and display were restored.',
          cause: error
        }
      );
    }
    this.disposeRegisteredAsset(current);
  }

  private getRegisteredAsset(name: string, kind: AssetKind): RegisteredAsset | undefined {
    if (kind === 'external') return this.externalAssets.get(name);
    if (kind === 'costume' || kind === 'backdrop') return this.costumeAssets.get(name);
    if (kind === 'sound') return this.soundAssets.get(name);
    return this.textAssets.get(name);
  }

  private installRegisteredAsset(name: string, kind: AssetKind, asset: RegisteredAsset): void {
    if (kind === 'external') this.externalAssets.set(name, asset as ExternalMemoryAsset);
    else if (kind === 'costume' || kind === 'backdrop') {
      this.costumeAssets.set(name, asset as CostumeAssetReference);
    } else if (kind === 'sound') this.soundAssets.set(name, asset as SoundAssetReference);
    else this.textAssets.set(name, asset as TextAssetReference);
    this.assetRegistry.set(name, kind);
  }

  private removeRegisteredAsset(name: string, kind: AssetKind): void {
    if (kind === 'external') this.externalAssets.delete(name);
    else if (kind === 'costume' || kind === 'backdrop') this.costumeAssets.delete(name);
    else if (kind === 'sound') this.soundAssets.delete(name);
    else this.textAssets.delete(name);
  }

  private disposeRegisteredAsset(asset: RegisteredAsset | undefined): void {
    if (asset?.kind === 'external') this.deleteOwnedSkinIfExists(asset);
  }

  private externalMediaKind(asset: ExternalMemoryAsset): ExternalMediaKind {
    const mimeType = normalizeMimeType(asset.mimeType, asset.url || asset.name);
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'unknown';
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

  private async restoreCacheIfGeneration(
    name: string,
    generation: number,
    previous: AssetRecord | null
  ): Promise<void> {
    const database = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(name);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const current = request.result as AssetRecord | undefined;
        if (current?.generation !== generation) return;
        if (previous) store.put(previous);
        else store.delete(name);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  private async fetchExternalAsset(url: string, name: string): Promise<AssetRecord> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch asset "${name}": ${response.status} ${response.statusText}`);
    const blob = await response.blob();
    return {
      name,
      url,
      mimeType: normalizeMimeType(blob.type || response.headers.get('Content-Type'), url),
      data: await blob.arrayBuffer(),
      cachedAt: Date.now()
    };
  }

  private getStageTarget(): TurboWarpTarget {
    return findStageTarget(this.runtime);
  }

  protected findTargetByName(name: string): TurboWarpTarget | null {
    return findProjectTargetByName(this.runtime, name);
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
    if (!byName) {
      const candidates = suggestNames(
        targetName,
        this.runtime.targets.flatMap((target) => target.sprite?.name ? [target.sprite.name] : [])
      );
      throw new AssetManagerError(
        'SPRITE_NOT_FOUND',
        `Asset source target no longer exists: ${targetName}.`,
        {
          operation: 'resolveAsset',
          actorName: targetName,
          candidates,
          hint: suggestionHint(candidates)
        }
      );
    }
    return byName;
  }

  private findCostume(
    target: TurboWarpTarget,
    costumeName: string,
    assetId: string | null
  ): TurboWarpCostume | null {
    return findProjectCostume(target, costumeName, assetId);
  }

  private findSound(
    target: TurboWarpTarget,
    soundName: string,
    assetId: string | null
  ): TurboWarpSound | null {
    return findProjectSound(target, soundName, assetId);
  }

  protected async resolveSkin(value: unknown): Promise<ResolvedSkin> {
    const name = normalizeName(value);
    const kind = this.assetRegistry.get(name);
    if (!kind) throw this.assetNotRegistered('show', name);
    const asset = this.getRegisteredAsset(name, kind);
    if (!asset) throw this.assetNotRegistered('show', name);
    return this.resolveSkinFromAsset(name, kind, asset);
  }

  protected async applyAssetToTarget(
    target: TurboWarpTarget,
    value: unknown,
    util?: ScratchBlockUtility
  ): Promise<void> {
    const name = normalizeName(value);
    const kind = this.assetRegistry.get(name);
    let skinId: number | undefined;
    if (!kind) throw this.assetNotRegistered('show', name);
    if (!this.runtime.targets.includes(target)) return;
    if (kind === 'text') {
      await this.applyTextToTarget(target, name, util);
    } else if (kind === 'external' || kind === 'costume' || kind === 'backdrop') {
      const skin = await this.resolveSkin(name);
      if (!this.runtime.targets.includes(target)) return;
      this.applySkinToTarget(target, skin);
      skinId = skin.skinId;
    } else {
      throw this.assetTypeMismatch('show', name, 'image or text', kind);
    }
    if (!this.runtime.targets.includes(target)) return;
    this.setDisplayBinding(target, name, kind, skinId);
  }

  protected setDisplayBinding(
    target: TurboWarpTarget,
    name: string,
    kind: AssetKind,
    skinId?: number
  ): void {
    if (kind === 'sound') {
      this.displayedAssets.delete(target.id);
      return;
    }
    this.displayedAssets.set(target.id, {
      assetName: name,
      assetKind: kind,
      skinId: skinId ?? null
    });
  }

  private isDisplayBindingCurrent(target: TurboWarpTarget, binding: DisplayBinding): boolean {
    if (binding.assetKind === 'text') return true;
    if (binding.skinId === null || target.drawableID === undefined || target.drawableID === null) {
      return false;
    }
    return this.renderer._allDrawables?.[target.drawableID]?.skin?.id === binding.skinId;
  }

  protected applyResolvedSkinToTarget(
    target: TurboWarpTarget,
    name: string,
    skin: ResolvedSkin
  ): void {
    const kind = this.assetRegistry.get(name);
    if (!kind) throw this.assetNotRegistered('show', name);
    if (kind !== 'external' && kind !== 'costume' && kind !== 'backdrop') {
      throw this.assetTypeMismatch('show', name, 'image', kind);
    }
    this.applySkinToTarget(target, skin);
    this.setDisplayBinding(target, name, kind, skin.skinId);
  }

  private async applyTextToTarget(
    target: TurboWarpTarget,
    name: string,
    util?: ScratchBlockUtility
  ): Promise<void> {
    if (target.isStage) throw this.assetTypeMismatch('show on stage', name, 'image', 'text');
    const reference = this.textAssets.get(name);
    if (!reference) throw this.assetNotRegistered('show', name);
    await this.applyTextReferenceToTarget(target, name, reference, util);
  }

  private async applyTextReferenceToTarget(
    target: TurboWarpTarget,
    name: string,
    reference: TextAssetReference,
    util?: ScratchBlockUtility
  ): Promise<void> {
    if (target.isStage) throw this.assetTypeMismatch('show on stage', name, 'image', 'text');

    const temporaryVariables = this.requireTemporaryVariables('show', name);
    const getRuntimeVariable = (variableName: string): unknown =>
      temporaryVariables.getRuntimeVariable({VAR: variableName});
    let style;
    try {
      style = resolveTextStyle(name, this.runtime.stageWidth, getRuntimeVariable);
    } catch (error) {
      throw new AssetManagerError('STYLE_VALUE_INVALID', errorMessage(error), {
        operation: 'show',
        assetName: name,
        hint: 'Correct the stored text style value before showing this asset.',
        cause: error
      });
    }
    const setFont = this.requireAnimatedTextOpcode('text_setFont', name);
    const setColor = this.requireAnimatedTextOpcode('text_setColor', name);
    const setWidth = this.requireAnimatedTextOpcode('text_setWidth', name);
    const setOutlineWidth = this.runtime.getOpcodeFunction?.('text_setOutlineWidth');
    const setOutlineColor = this.runtime.getOpcodeFunction?.('text_setOutlineColor');
    const displayText = this.requireAnimatedTextOpcode(
      style.animation === 'none' ? 'text_setText' : 'text_animateText',
      name
    );
    const blockUtility = {...util, target, runtime: util?.runtime ?? this.runtime};
    const text = getRuntimeVariable(reference.runtimeVariableName);

    await Promise.resolve(setFont({FONT: style.font}, blockUtility));
    await Promise.resolve(setColor({COLOR: style.color}, blockUtility));
    await Promise.resolve(setWidth({WIDTH: style.width, ALIGN: style.align}, blockUtility));
    if (setOutlineWidth) {
      await Promise.resolve(setOutlineWidth({WIDTH: DEFAULT_OUTLINE_WIDTH}, blockUtility));
    }
    if (setOutlineColor) {
      await Promise.resolve(setOutlineColor({COLOR: DEFAULT_OUTLINE_COLOR}, blockUtility));
    }
    const displayResult = displayText(
      style.animation === 'none'
        ? {TEXT: String(text ?? '')}
        : {ANIMATE: style.animation, TEXT: String(text ?? '')},
      blockUtility
    );
    if (style.animation === 'none') {
      await Promise.resolve(displayResult);
    } else {
      void Promise.resolve(displayResult).catch((error) => {
        console.error(new AssetManagerError(
          'ANIMATION_FAILED',
          `Animated Text failed for asset "${name}": ${errorMessage(error)}`,
          {
            operation: 'animateText',
            assetName: name,
            hint: 'Check the Animated Text extension and animation value.',
            cause: error
          }
        ));
      });
    }
  }

  private requireTemporaryVariables(
    operation = 'setTextValue',
    assetName?: string
  ): TurboWarpTemporaryVariablesExtension {
    const temporaryVariables = this.runtime.ext_lmsTempVars2;
    if (!temporaryVariables?.getRuntimeVariable) {
      throw new AssetManagerError(
        'DEPENDENCY_MISSING',
        'Temporary Variables extension is not loaded.',
        {
          operation,
          assetName,
          hint: 'Load the lmsTempVars2 extension before using runtime text assets.'
        }
      );
    }
    return temporaryVariables;
  }

  private setRuntimeVariable(name: string, value: string): void {
    const assetName = name.split(':')[1];
    const temporaryVariables = this.requireTemporaryVariables('setRuntimeVariable', assetName);
    if (!temporaryVariables.setRuntimeVariable) {
      throw new AssetManagerError(
        'DEPENDENCY_MISSING',
        'Temporary Variables extension does not support setting runtime variables.',
        {
          operation: 'setRuntimeVariable',
          assetName,
          hint: 'Load a Temporary Variables version that provides setRuntimeVariable.'
        }
      );
    }
    temporaryVariables.setRuntimeVariable({VAR: name, STRING: value});
  }

  private requireAnimatedTextOpcode(opcode: string, assetName: string): TurboWarpOpcodeFunction {
    const implementation = this.runtime.getOpcodeFunction?.(opcode);
    if (!implementation) {
      throw new AssetManagerError(
        'DEPENDENCY_MISSING',
        `Animated Text extension is not loaded or does not provide ${opcode}.`,
        {
          operation: 'show',
          assetName,
          hint: 'Load a compatible Animated Text extension before showing text assets.'
        }
      );
    }
    return implementation;
  }

  private async ensureExternalSkin(name: string): Promise<number> {
    const asset = this.externalAssets.get(name);
    if (!asset) throw this.assetNotRegistered('show', name);
    return this.ensureExternalAssetSkin(asset, name);
  }

  private async resolveProjectImageStorageAsset(
    name: string,
    costume: TurboWarpCostume
  ): Promise<TurboWarpStorageAsset> {
    if (costume.asset?.data) return costume.asset;
    const assetId = costume.assetId;
    const dataFormat = costume.dataFormat?.toLowerCase();
    const storage = this.runtime.storage;
    if (!assetId || !dataFormat || !storage) {
      throw new AssetManagerError(
        'SOURCE_ASSET_NOT_FOUND',
        `Project image bytes are unavailable for asset "${name}".`,
        {
          operation: 'resolveDOMImageResource',
          assetName: name,
          hint: 'Resolve the resource while its project costume and VM storage are available.'
        }
      );
    }
    const cached = storage.get?.(assetId);
    if (cached?.data) return cached;
    const assetType = dataFormat === 'svg'
      ? storage.AssetType.ImageVector
      : storage.AssetType.ImageBitmap;
    const loaded = await storage.load?.(assetType, assetId, dataFormat);
    if (!loaded?.data) {
      throw new AssetManagerError(
        'SOURCE_ASSET_NOT_FOUND',
        `Project image bytes are unavailable for asset "${name}".`,
        {
          operation: 'resolveDOMImageResource',
          assetName: name,
          hint: 'Keep the project asset available in VM storage until the resource is resolved.'
        }
      );
    }
    return loaded;
  }

  private cancelledDOMImageResolution(name: string): Error {
    const error = new Error(`DOM image resource resolution was cancelled: ${JSON.stringify(name)}`);
    error.name = 'AbortError';
    return error;
  }

  private async resolveExtensionDOMImageResource(
    nameInput: unknown
  ): Promise<DOMImageResource> {
    const name = normalizeName(nameInput);
    const version = this.domImageResourceVersions.get(name) ?? 0;
    let entry = this.domImageResourceBackings.get(name);
    if (entry?.version !== version) {
      let nextEntry!: ExtensionDOMImageResourceBackingEntry;
      const promise = (async () => {
        const resolved = await this.resolveImageAssetBytes({NAME: name});
        const backing = await createDOMImageResourceBacking(
          {name, bytes: resolved.bytes, mimeType: resolved.mimeType},
          (idleBacking) => {
            if (
              this.domImageResourceBackings.get(name) === nextEntry &&
              nextEntry.backing === idleBacking
            ) {
              this.domImageResourceBackings.delete(name);
            }
          }
        );
        nextEntry.backing = backing;
        return backing;
      })();
      nextEntry = {version, promise};
      entry = nextEntry;
      this.domImageResourceBackings.set(name, entry);
      try {
        await promise;
      } catch (error) {
        if (this.domImageResourceBackings.get(name) === entry) {
          this.domImageResourceBackings.delete(name);
        }
        throw error;
      }
    }
    const backing = await entry.promise;
    let controller: ExtensionDOMImageResourceController | undefined;
    const resource = backing.acquire(() => {
      if (controller) this.releaseActiveDOMImageResource(controller);
    });
    if (
      (this.domImageResourceVersions.get(name) ?? 0) !== version ||
      !this.assetRegistry.has(name)
    ) {
      resource.release();
      throw this.cancelledDOMImageResolution(name);
    }
    controller = {name, resource};
    this.activeDOMImageResources.add(controller);
    const named = this.activeDOMImageResourcesByName.get(name) ?? new Set();
    named.add(controller);
    this.activeDOMImageResourcesByName.set(name, named);
    return resource;
  }

  private releaseActiveDOMImageResource(
    controller: ExtensionDOMImageResourceController
  ): void {
    this.activeDOMImageResources.delete(controller);
    const named = this.activeDOMImageResourcesByName.get(controller.name);
    named?.delete(controller);
    if (named?.size === 0) this.activeDOMImageResourcesByName.delete(controller.name);
  }

  private invalidateDOMImageResources(name: string): void {
    this.domImageResourceVersions.set(
      name,
      (this.domImageResourceVersions.get(name) ?? 0) + 1
    );
    this.domImageResourceBackings.delete(name);
    for (const controller of [...(this.activeDOMImageResourcesByName.get(name) ?? [])]) {
      controller.resource.release();
    }
  }

  private releaseAllDOMImageResources(): void {
    const names = new Set([
      ...this.domImageResourceBackings.keys(),
      ...this.activeDOMImageResourcesByName.keys()
    ]);
    for (const name of names) {
      this.domImageResourceVersions.set(
        name,
        (this.domImageResourceVersions.get(name) ?? 0) + 1
      );
    }
    this.domImageResourceBackings.clear();
    for (const controller of [...this.activeDOMImageResources]) {
      controller.resource.release();
    }
  }

  private startListeningForDOMImageLifecycle(): void {
    if (this.listeningForDOMImageLifecycle || !this.runtime.on) return;
    this.listeningForDOMImageLifecycle = true;
    this.runtime.on('PROJECT_STOP_ALL', this.releaseAllDOMImageResourcesForLifecycle);
    this.runtime.on('PROJECT_LOADED', this.releaseAllDOMImageResourcesForLifecycle);
    this.runtime.on('RUNTIME_DISPOSED', this.releaseDOMImageResourcesForRuntimeDispose);
  }

  private stopListeningForDOMImageLifecycle(): void {
    if (!this.listeningForDOMImageLifecycle || !this.runtime.off) return;
    this.listeningForDOMImageLifecycle = false;
    this.runtime.off('PROJECT_STOP_ALL', this.releaseAllDOMImageResourcesForLifecycle);
    this.runtime.off('PROJECT_LOADED', this.releaseAllDOMImageResourcesForLifecycle);
    this.runtime.off('RUNTIME_DISPOSED', this.releaseDOMImageResourcesForRuntimeDispose);
  }

  private async ensureExternalAssetSkin(asset: ExternalMemoryAsset, name: string): Promise<number> {
    asset.mimeType = normalizeMimeType(asset.mimeType, asset.url || name);
    if (!asset.mimeType.startsWith('image/')) {
      throw this.assetTypeMismatch('show', name, 'image', `external/${this.externalMediaKind(asset)}`);
    }
    if (asset.skinId !== null) return asset.skinId;
    const blob = new Blob([asset.data], {type: asset.mimeType});
    asset.skinId = asset.mimeType === 'image/svg+xml'
      ? this.renderer.createSVGSkin(await blob.text())
      : this.renderer.createBitmapSkin(await createImageBitmap(blob), asset.bitmapResolution ?? 1);
    return asset.skinId;
  }

  private async resolveSkinFromAsset(
    name: string,
    kind: AssetKind,
    asset: RegisteredAsset
  ): Promise<ResolvedSkin> {
    if (kind === 'external' && asset.kind === 'external') {
      return {skinId: await this.ensureExternalAssetSkin(asset, name), sourceSize: null};
    }
    if ((kind === 'costume' || kind === 'backdrop') &&
        (asset.kind === 'costume' || asset.kind === 'backdrop')) {
      const {target, costume} = this.resolveCostumeAssetReference(name, asset);
      return {
        skinId: costume.skinId as number,
        sourceSize: target.isStage || !Number.isFinite(target.size) ? null : target.size
      };
    }
    throw this.assetTypeMismatch('show', name, 'image', kind);
  }

  private resolveCostumeReference(name: string): {
    target: TurboWarpTarget;
    costume: TurboWarpCostume;
  } {
    const reference = this.costumeAssets.get(name);
    if (!reference) throw this.assetNotRegistered('show', name);
    return this.resolveCostumeAssetReference(name, reference);
  }

  private resolveCostumeAssetReference(
    name: string,
    reference: CostumeAssetReference
  ): {target: TurboWarpTarget; costume: TurboWarpCostume} {
    const target = this.resolveReferencedTarget(reference.targetId, reference.targetName, reference.isStage);
    const costume = this.findCostume(target, reference.costumeName, reference.assetId);
    if (!costume) {
      const candidates = suggestNames(
        reference.costumeName,
        (target.sprite?.costumes ?? []).map((candidate) => candidate.name)
      );
      throw new AssetManagerError(
        'SOURCE_ASSET_NOT_FOUND',
        `Costume no longer exists: ${reference.targetName}/${reference.costumeName}.`,
        {
          operation: 'show',
          assetName: name,
          actorName: reference.targetName,
          candidates,
          hint: suggestionHint(candidates)
        }
      );
    }
    if (typeof costume.skinId !== 'number') {
      throw new AssetManagerError(
        'SOURCE_ASSET_NOT_FOUND',
        `Costume skin is not available: ${reference.targetName}/${reference.costumeName}.`,
        {
          operation: 'show',
          assetName: name,
          actorName: reference.targetName,
          hint: 'Wait for the project costume to finish loading and try again.'
        }
      );
    }
    return {target, costume};
  }

  private resolveSoundAssetReference(name: string): {
    target: TurboWarpTarget;
    sound: TurboWarpSound;
  } {
    const reference = this.soundAssets.get(name);
    if (!reference) throw this.assetNotRegistered('playSound', name);
    const target = this.resolveReferencedTarget(reference.targetId, reference.targetName, reference.isStage);
    const sound = this.findSound(target, reference.soundName, reference.assetId);
    if (!sound) {
      const candidates = suggestNames(
        reference.soundName,
        (target.sprite?.sounds ?? []).map((candidate) => candidate.name)
      );
      throw new AssetManagerError(
        'SOURCE_ASSET_NOT_FOUND',
        `Sound no longer exists: ${reference.targetName}/${reference.soundName}.`,
        {
          operation: 'playSound',
          assetName: name,
          actorName: reference.targetName,
          candidates,
          hint: suggestionHint(candidates)
        }
      );
    }
    return {target, sound};
  }

  private resolveSoundReference(name: string): {
    target: TurboWarpTarget;
    sound: TurboWarpSound;
    soundBank: TurboWarpSoundBank;
  } {
    const {target, sound} = this.resolveSoundAssetReference(name);
    if (!sound.soundId) {
      throw new AssetManagerError(
        'SOURCE_ASSET_NOT_FOUND',
        `Sound ID is not available: ${target.sprite?.name ?? target.id}/${sound.name}.`,
        {
          operation: 'playSound',
          assetName: name,
          actorName: target.sprite?.name ?? target.id,
          hint: 'Wait for the project sound to finish loading and try again.'
        }
      );
    }
    const soundBank = target.sprite?.soundBank;
    if (!soundBank) {
      throw new AssetManagerError(
        'DEPENDENCY_MISSING',
        `Sound bank is not available: ${target.sprite?.name ?? target.id}.`,
        {
          operation: 'playSound',
          assetName: name,
          actorName: target.sprite?.name ?? target.id,
          hint: 'Use a TurboWarp runtime with sound support.'
        }
      );
    }
    return {target, sound, soundBank};
  }

  private deleteOwnedSkinIfExists(asset: ExternalMemoryAsset | undefined): void {
    if (!asset || asset.skinId === null) return;
    try { this.renderer.destroySkin(asset.skinId); } catch (error) { console.warn('Failed to destroy skin', error); }
    asset.skinId = null;
  }

  protected applySkinToTarget(target: TurboWarpTarget, skin: ResolvedSkin): void {
    if (target.drawableID === undefined || target.drawableID === null) {
      throw new AssetManagerError(
        'SPRITE_NOT_FOUND',
        `Target drawable not found: ${target.sprite?.name ?? 'unknown'}.`,
        {
          operation: 'show',
          actorName: target.sprite?.name ?? target.id,
          hint: 'Use a live target with an initialized renderer drawable.'
        }
      );
    }
    this.renderer.updateDrawableSkinId(target.drawableID, skin.skinId);
    if (
      !target.isStage &&
      target.isOriginal &&
      skin.sourceSize !== null &&
      target.size !== skin.sourceSize
    ) {
      target.setSize(skin.sourceSize);
    }
    target.emitVisualChange?.();
    this.runtime.requestRedraw?.();
  }

  protected async playResolvedSound(value: unknown, waitUntilDone: boolean): Promise<void> {
    const name = normalizeName(value);
    const kind = this.assetRegistry.get(name);
    if (!kind) throw this.assetNotRegistered('playSound', name);
    if (kind === 'external') {
      await this.playExternalSound(name, waitUntilDone);
      return;
    }
    if (kind === 'sound') {
      await this.playProjectSound(name, waitUntilDone);
      return;
    }
    throw this.assetTypeMismatch('playSound', name, 'audio', kind);
  }

  private async resolveAudioBytes(name: string): Promise<{
    bytes: ArrayBuffer | Uint8Array;
    mimeType: string;
  }> {
    const kind = this.assetRegistry.get(name);
    if (!kind) throw this.assetNotRegistered('createAudioVoice', name);
    if (kind === 'external') {
      const asset = this.externalAssets.get(name);
      if (!asset) throw this.assetNotRegistered('createAudioVoice', name);
      asset.mimeType = normalizeMimeType(asset.mimeType, asset.url || name);
      if (!asset.mimeType.startsWith('audio/')) {
        throw this.assetTypeMismatch(
          'createAudioVoice',
          name,
          'audio',
          `external/${this.externalMediaKind(asset)}`
        );
      }
      return {bytes: asset.data, mimeType: asset.mimeType};
    }
    if (kind !== 'sound') {
      throw this.assetTypeMismatch('createAudioVoice', name, 'audio', kind);
    }
    const {target, sound} = this.resolveSoundAssetReference(name);
    const assetId = sound.assetId;
    const dataFormat = sound.dataFormat;
    const storage = this.runtime.storage;
    let asset = sound.asset ?? (assetId ? storage?.get?.(assetId) : null);
    if (
      !asset &&
      assetId &&
      dataFormat &&
      storage?.load &&
      storage.AssetType.Sound !== undefined
    ) {
      try {
        asset = await storage.load(storage.AssetType.Sound, assetId, dataFormat);
      } catch (error) {
        throw new AssetManagerError(
          'SOURCE_ASSET_NOT_FOUND',
          `Sound bytes could not be loaded: ${target.sprite?.name ?? target.id}/${sound.name}.`,
          {
            operation: 'createAudioVoice',
            assetName: name,
            actorName: target.sprite?.name ?? target.id,
            hint: 'Wait for the project sound to finish loading and try again.',
            cause: error
          }
        );
      }
    }
    if (!asset?.data) {
      throw new AssetManagerError(
        'SOURCE_ASSET_NOT_FOUND',
        `Sound bytes are not available: ${target.sprite?.name ?? target.id}/${sound.name}.`,
        {
          operation: 'createAudioVoice',
          assetName: name,
          actorName: target.sprite?.name ?? target.id,
          hint: 'Use a TurboWarp runtime that retains or can reload project sound assets.'
        }
      );
    }
    return {
      bytes: asset.data,
      mimeType: this.projectAssetMimeType(dataFormat, 'audio')
    };
  }

  private startBrowserAudioVoice(
    name: string,
    bytes: ArrayBuffer | Uint8Array,
    mimeType: string,
    initialGain: number,
    operation: string
  ): {voice: AssetManagerAudioVoice; started: Promise<void>} {
    const blobBytes = bytes instanceof Uint8Array ? new Uint8Array(bytes).buffer : bytes;
    const objectUrl = URL.createObjectURL(new Blob([blobBytes], {type: mimeType}));
    let audio: HTMLAudioElement;
    try {
      audio = new Audio(objectUrl);
      audio.volume = initialGain;
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw this.playbackError(name, error, operation);
    }

    let active = true;
    let resolveEnded!: () => void;
    let rejectEnded!: (error: unknown) => void;
    const ended = new Promise<void>((resolve, reject) => {
      resolveEnded = resolve;
      rejectEnded = reject;
    });
    void ended.catch(() => {});

    const cleanup = (error?: unknown) => {
      if (!active) return;
      active = false;
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      this.playingAudio.delete(audio);
      this.audioVoiceStops.delete(audio);
      URL.revokeObjectURL(objectUrl);
      if (error === undefined) resolveEnded();
      else rejectEnded(error);
    };
    const handleEnded = () => cleanup();
    const handleError = () => cleanup(
      operation === 'createAudioVoice'
        ? this.playbackError(
            name,
            new Error('The browser audio element reported a playback error.'),
            operation
          )
        : undefined
    );
    const stop = () => {
      if (!active) return;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // Cleanup still owns and releases partially initialized browser audio.
      }
      cleanup();
    };
    const voice = Object.freeze({
      ended,
      setGain(value: number) {
        const gain = normalizeAudioVoiceGain(value);
        if (active) audio.volume = gain;
      },
      stop
    });

    audio.addEventListener('ended', handleEnded, {once: true});
    audio.addEventListener('error', handleError, {once: true});
    this.playingAudio.set(audio, name);
    this.audioVoiceStops.set(audio, stop);
    let playResult: Promise<void> | void;
    try {
      playResult = audio.play();
    } catch (error) {
      const playbackError = this.playbackError(name, error, operation);
      cleanup(playbackError);
      return {voice, started: Promise.reject(playbackError)};
    }
    const started = Promise.resolve(playResult).catch((error) => {
      const playbackError = this.playbackError(name, error, operation);
      cleanup(playbackError);
      throw playbackError;
    });
    return {voice, started};
  }

  private async playExternalSound(name: string, waitUntilDone: boolean): Promise<void> {
    const asset = this.externalAssets.get(name);
    if (!asset) throw this.assetNotRegistered('playSound', name);
    asset.mimeType = normalizeMimeType(asset.mimeType, asset.url || name);
    if (!asset.mimeType.startsWith('audio/')) {
      throw this.assetTypeMismatch(
        'playSound',
        name,
        'audio',
        `external/${this.externalMediaKind(asset)}`
      );
    }
    const playback = this.startBrowserAudioVoice(
      name,
      asset.data,
      asset.mimeType,
      1,
      'playSound'
    );
    if (!waitUntilDone) {
      void playback.started.catch((error) => console.error(error));
      return;
    }
    await playback.started;
    await playback.voice.ended;
  }

  private stopExternalAudio(audio: HTMLAudioElement): void {
    const stopVoice = this.audioVoiceStops.get(audio);
    if (stopVoice) {
      stopVoice();
      return;
    }
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.dispatchEvent(new Event('ended'));
    } catch {
      // Ignore cleanup failures from partially initialized browser audio.
    } finally {
      this.playingAudio.delete(audio);
    }
  }

  private async playProjectSound(name: string, waitUntilDone: boolean): Promise<void> {
    const {target, sound, soundBank} = this.resolveSoundReference(name);
    const playResult = soundBank.playSound(target, sound.soundId as string);
    const playPromise = Promise.resolve(playResult);
    if (!waitUntilDone) {
      void playPromise.catch((error) => console.error(this.playbackError(name, error)));
      return;
    }
    try {
      await playPromise;
    } catch (error) {
      throw this.playbackError(name, error);
    }
  }

  private playbackError(
    name: string,
    cause: unknown,
    operation = 'playSound'
  ): AssetManagerError {
    return new AssetManagerError(
      'PLAYBACK_FAILED',
      `Failed to play audio asset "${name}": ${errorMessage(cause)}`,
      {
        operation,
        assetName: name,
        hint: 'Check browser audio permissions and the registered audio resource.',
        cause
      }
    );
  }

  private projectAssetMimeType(dataFormat: string | undefined, kind: 'image' | 'audio'): string {
    if (dataFormat) {
      const guessed = guessMimeType(`asset.${dataFormat}`);
      if (guessed !== 'application/octet-stream') return guessed;
    }
    return kind === 'image' ? 'image/x-scratch-costume' : 'audio/x-scratch-sound';
  }
}
