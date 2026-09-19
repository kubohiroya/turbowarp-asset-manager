import {
  NamedDataError,
  type NamedDataBody,
  type NamedDataErrorCode,
  type NamedDataMetadata,
  type NamedDataProvider,
  type NamedDataReference,
  type NamedDataResolveContext
} from '@kubohiroya/turbowarp-named-data/composition';

export const NAMED_ASSET_BODY_NAMESPACE = 'asset' as const;

export const NamedAssetBodyError = NamedDataError;
export type NamedAssetBodyErrorCode = NamedDataErrorCode;
export type NamedAssetBodyMetadata = NamedDataMetadata;
export type NamedAssetBodyReference = NamedDataReference;
export type NamedAssetBodySnapshot = NamedDataBody;
export type NamedAssetBodyOpenOptions = NamedDataResolveContext;
export type NamedAssetBodyProvider = NamedDataProvider;

export function requireNamedAssetBodyReference(value: unknown): NamedDataReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidReference();
  const reference = value as Partial<NamedDataReference>;
  if (
    reference.namespace !== NAMED_ASSET_BODY_NAMESPACE ||
    typeof reference.name !== 'string' ||
    reference.name.length === 0 ||
    reference.kind !== 'asset' ||
    reference.scope !== 'project'
  ) {
    throw invalidReference();
  }
  return Object.freeze({
    namespace: NAMED_ASSET_BODY_NAMESPACE,
    name: reference.name,
    kind: 'asset',
    scope: 'project'
  });
}

function invalidReference(): NamedDataError {
  return new NamedDataError(
    'NAMED_DATA_INVALID_REF',
    'Expected an asset/project reference with a non-empty string name.'
  );
}

export function namedBodyAbortError(): NamedDataError {
  return new NamedDataError('NAMED_DATA_ABORTED', 'Named asset body resolution was aborted.');
}

export function throwIfNamedBodyAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw namedBodyAbortError();
}
