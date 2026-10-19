import document from '../schemas/block-editor-fixed-inputs.schema.json' with {type: 'json'};
import type {SchemaBundle, SchemaDocument} from '@kubohiroya/turbowarp-extension-data-editor/schema';

/** Canonical owner schema fragments; no network resources or runtime providers. */
export function fixedInputBundle(fragment: string, schema: SchemaDocument): SchemaBundle {
  const symbols: Readonly<Record<string, string>> = {
    'setTextStyle-PROPERTY': '#/$defs/setTextStyle/properties/PROPERTY',
    'setTextStyle-VALUE': '#/$defs/setTextStyle/properties/VALUE',
    'loadingCostumeAt-INDEX': '#/$defs/loadingCostumeAt/properties/INDEX'
  };
  const source = {repository: 'turbowarp-asset-manager', path: 'schemas/block-editor-fixed-inputs.schema.json',
    symbol: symbols[fragment] ?? `#/$defs/${fragment}`};
  return {
    identity: {ownerId: 'turbowarp-asset-manager', contractId: 'fixed-inputs', revision: '1', variantId: fragment},
    dialect: '2020-12',
    root: {
      retrievalUri: document.$id,
      document: schema,
      artifact: {role: 'canonical-schema', source}
    },
    resources: [],
    provenance: {
      canonicalSources: [source, {repository: 'turbowarp-asset-manager', path: 'src/text-style.ts', symbol: 'normalizeTextStyleProperty / normalizeTextStyleValue'},
        {repository: 'turbowarp-asset-manager', path: 'src/extension.ts', symbol: 'getInfo / loadingCostumeAt'}],
      generatedFiles: [], referenceSchemas: [], generationSources: []
    }
  };
}

export const fixedSchemas = document.$defs;
