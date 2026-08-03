export const ASSET_MANAGER_ERROR_CODES = [
  'INVALID_ASSET_NAME',
  'ASSET_NOT_REGISTERED',
  'ASSET_TYPE_MISMATCH',
  'ASSET_TYPE_CHANGE',
  'SPRITE_NOT_FOUND',
  'SPRITE_NAME_AMBIGUOUS',
  'SOURCE_ASSET_NOT_FOUND',
  'RESOURCE_ID_INVALID',
  'DEPENDENCY_MISSING',
  'STYLE_PROPERTY_INVALID',
  'STYLE_VALUE_INVALID',
  'PLAYBACK_FAILED',
  'ANIMATION_FAILED',
  'REPLACEMENT_FAILED'
] as const;

export type AssetManagerErrorCode = typeof ASSET_MANAGER_ERROR_CODES[number];

export interface AssetManagerErrorContext {
  operation: string;
  assetName?: string | undefined;
  resourceId?: string | undefined;
  actorName?: string | undefined;
  expectedKind?: string | undefined;
  actualKind?: string | undefined;
  hint?: string | undefined;
  candidates?: string[] | undefined;
  cause?: unknown;
}

export class AssetManagerError extends Error {
  readonly code: AssetManagerErrorCode;
  readonly operation: string;
  readonly assetName: string | undefined;
  readonly resourceId: string | undefined;
  readonly actorName: string | undefined;
  readonly expectedKind: string | undefined;
  readonly actualKind: string | undefined;
  readonly hint: string | undefined;
  readonly candidates: readonly string[];

  constructor(code: AssetManagerErrorCode, message: string, context: AssetManagerErrorContext) {
    const hintText = context.hint ? ` ${context.hint}` : '';
    super(`[Asset Manager][${code}] ${message}${hintText}`, {cause: context.cause});
    this.name = 'AssetManagerError';
    this.code = code;
    this.operation = context.operation;
    this.assetName = context.assetName;
    this.resourceId = context.resourceId;
    this.actorName = context.actorName;
    this.expectedKind = context.expectedKind;
    this.actualKind = context.actualKind;
    this.hint = context.hint;
    this.candidates = context.candidates ?? [];
  }
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({length: right.length + 1}, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? 0;
}

export function suggestNames(value: unknown, choices: Iterable<string>, limit = 3): string[] {
  const input = String(value ?? '').trim();
  if (!input || limit <= 0) return [];
  const normalizedInput = input.toLocaleLowerCase();
  const unique = [...new Set([...choices].map((choice) => choice.trim()).filter(Boolean))];
  return unique
    .map((choice, index) => ({
      choice,
      index,
      exactCaseInsensitive: choice.toLocaleLowerCase() === normalizedInput,
      distance: editDistance(normalizedInput, choice.toLocaleLowerCase())
    }))
    .sort((left, right) =>
      Number(right.exactCaseInsensitive) - Number(left.exactCaseInsensitive) ||
      left.distance - right.distance ||
      left.index - right.index
    )
    .slice(0, limit)
    .map(({choice}) => choice);
}

export function suggestionHint(candidates: readonly string[]): string | undefined {
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return `Did you mean "${candidates[0]}"?`;
  return `Did you mean one of: ${candidates.map((candidate) => `"${candidate}"`).join(', ')}?`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
