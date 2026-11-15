import {parseFixedNumberInput} from '@kubohiroya/turbowarp-extension-data-editor';
import type {FixedInputBinding, FixedInputEditorOptions, JsonValue, LiteralValue} from '@kubohiroya/turbowarp-extension-data-editor';
import type {SchemaDocument} from '@kubohiroya/turbowarp-extension-data-editor/schema';
import {fixedInputBundle, fixedSchemas} from './fixed-input-schema.js';
import {normalizeTextStyleProperty, normalizeTextStyleValue, TEXT_STYLE_PROPERTIES, type TextStyleProperty} from './text-style.js';

const extensionId = 'kubohiroyaassetmanager';
const choices = (values: readonly string[]) => values.map(value => ({value}));
const context = () => ({consumerId: 'turbowarp-asset-manager', nowMs: 0, settings: null});
const string = (value: JsonValue | LiteralValue): string => {
  if (typeof value !== 'string') throw new TypeError('Expected a string literal.');
  return value;
};
const issue = () => [{message: 'Invalid asset style value.'}];

/** New edits preserve the candidate token; existing aliases are display projections only. */
export function styleBinding(property: TextStyleProperty): FixedInputBinding {
  const values = property === 'animation' ? ['', 'none', 'type', 'rainbow', 'zoom', 'shake'] :
    property === 'align' ? ['', 'left', 'center', 'right'] : undefined;
  return {
    argument: 'VALUE', schemaBundle: fixedInputBundle(property, fixedSchemas[property] as SchemaDocument),
    control: {kind: values ? 'enum' : property === 'color' ? 'color' : property === 'width' ? 'number' : 'text',
      reset: '', ...(values ? {choices: choices(values)} : {})},
    read(value) {
      const raw = string(value);
      // Preserve the STRING storage contract, including empty reset and number tokens.
      return normalizeTextStyleValue(property, raw);
    },
    encode(value) {
      const raw = string(value);
      if (property !== 'width' || raw === '') return raw;
      normalizeTextStyleValue(property, raw);
      return raw;
    },
    validateCandidate(value) {
      try {
        const raw = string(value);
        normalizeTextStyleValue(property, raw);
        return [];
      } catch {return issue();}
    }
  };
}

export const fixedInputEditors: readonly FixedInputEditorOptions[] = [
  {
    apiVersion: 1, extensionId, editorId: 'text-style-fixed', opcodes: [`${extensionId}_setTextStyle`],
    contractId: 'CP-asset-manager', contractRevision: '1', validationContext: context,
    bindings: [
      {argument: 'PROPERTY', schemaBundle: fixedInputBundle('setTextStyle-PROPERTY', fixedSchemas.setTextStyle.properties.PROPERTY),
        control: {kind: 'enum', choices: choices(TEXT_STYLE_PROPERTIES)},
        read(value) {
          const raw = string(value);
          try {return normalizeTextStyleProperty(raw);} catch {return raw;}
        },
        encode: value => string(value),
        validateCandidate(value) {try {normalizeTextStyleProperty(value); return [];} catch {return issue();}}},
      {argument: 'VALUE', schemaBundle: fixedInputBundle('setTextStyle-VALUE', fixedSchemas.setTextStyle.properties.VALUE),
        read: value => string(value), encode: value => string(value), validateCandidate: () => []}
    ],
    dependencies: [{selector: 'PROPERTY', dependents: ['VALUE']}],
    branchPolicies: [{selector: 'PROPERTY', normalize: {trim: true, lowercase: true},
      cases: TEXT_STYLE_PROPERTIES.map(property => ({values: [property], activeDependents: ['VALUE'], bindings: [styleBinding(property)]}))}]
  },
  {
    apiVersion: 1, extensionId, editorId: 'loading-costume-index-fixed', opcodes: [`${extensionId}_loadingCostumeAt`],
    contractId: 'turbowarp-asset-manager/loadingCostumeAt.INDEX', contractRevision: '1', validationContext: context,
    bindings: [{argument: 'INDEX', schemaBundle: fixedInputBundle('loadingCostumeAt-INDEX', fixedSchemas.loadingCostumeAt.properties.INDEX),
      control: {kind: 'number'},
      read(value) {
        if ((typeof value !== 'number' && typeof value !== 'string') ||
            (typeof value === 'string' && value.trim() === '')) throw new TypeError('Non-numeric index.');
        const number = Number(value);
        if (!Number.isFinite(number)) throw new TypeError('Nonfinite index.');
        return number;
      },
      encode(value) {
        const parsed = parseFixedNumberInput(value);
        if (parsed.kind !== 'valid') throw new TypeError('Invalid index.');
        return parsed.token;
      },
      validateCandidate(value) {return Number.isFinite(Number(value)) ? [] : [{message: 'Invalid index.'}];}
    }]
  }
];

interface OptionalHost {
  gui?: {blockEditors?: {apiVersion?: number; registerFixedInputEditor?: (options: FixedInputEditorOptions) => () => void}};
  vm?: {runtime?: {on?: (event: string, listener: () => void) => void; off?: (event: string, listener: () => void) => void}};
}

/**
 * Per-instance, idempotent registration. Legacy hosts never acquire the fixed capability.
 * Loading a project disposes the runtime but keeps this extension loaded, so RUNTIME_DISPOSED only
 * releases the editors until the next PROJECT_LOADED; the owner's dispose is final.
 */
export function fixedInputRegistration(scratch: unknown) {
  const host = (typeof scratch === 'object' && scratch !== null ? scratch : {}) as OptionalHost;
  let active: unknown;
  const removers: (() => void)[] = [];
  let disposed = false;
  let released = false;
  let listening = false;
  let lastOpcodes: readonly string[] | undefined;
  const unregister = () => {
    for (const remove of removers.splice(0).reverse()) remove();
    active = undefined;
  };
  const releaseForRuntimeDispose = () => {
    if (disposed || active === undefined) return;
    unregister();
    released = true;
  };
  const restoreAfterProjectLoad = () => {
    if (disposed || !released || lastOpcodes === undefined) return;
    released = false;
    ensure(lastOpcodes);
  };
  function ensure(opcodes: readonly string[]) {
    const api = host.gui?.blockEditors;
    if (disposed || api === active) return;
    unregister();
    if (api?.apiVersion !== 1 || typeof api.registerFixedInputEditor !== 'function') return;
    lastOpcodes = opcodes;
    released = false;
    try {
      for (const definition of fixedInputEditors) {
        if (definition.opcodes.every(opcode => opcodes.includes(opcode))) {
          const remove = api.registerFixedInputEditor.call(api, definition);
          if (typeof remove !== 'function') throw new TypeError('Invalid fixed registration cleanup.');
          removers.push(remove);
        }
      }
      active = api;
      if (!listening) {
        listening = true;
        host.vm?.runtime?.on?.('RUNTIME_DISPOSED', releaseForRuntimeDispose);
        host.vm?.runtime?.on?.('PROJECT_LOADED', restoreAfterProjectLoad);
      }
    } catch (error) {unregister(); throw error;}
  }
  const shutdown = () => {
    disposed = true;
    if (listening) {
      listening = false;
      host.vm?.runtime?.off?.('RUNTIME_DISPOSED', releaseForRuntimeDispose);
      host.vm?.runtime?.off?.('PROJECT_LOADED', restoreAfterProjectLoad);
    }
    unregister();
  };
  return {ensure, dispose: shutdown};
}
