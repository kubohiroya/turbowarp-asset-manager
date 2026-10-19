import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createFixedInputEditor, EditorRegistry, type BlockEditorHost, type FixedBlockSnapshot, type FixedInputEditorOptions, type JsonObject, type LiteralValue} from '@kubohiroya/turbowarp-extension-data-editor';
import {fixedInputEditors, fixedInputRegistration, styleBinding} from '../src/fixed-input-editors.js';
import {AssetManagerExtension} from '../src/extension.js';
import {normalizeTextStyleValue, TEXT_STYLE_PROPERTIES} from '../src/text-style.js';
import canonicalSchema from '../schemas/block-editor-fixed-inputs.schema.json' with {type: 'json'};

const styleOptions = fixedInputEditors[0]!;
const indexOptions = fixedInputEditors[1]!;
const literal = (value: LiteralValue) => ({kind: 'literal' as const, value});
const reporter = {kind: 'reporter' as const};
const context = {consumerId: 'turbowarp-asset-manager', nowMs: 0, settings: null};

function snapshot(options = styleOptions, args: FixedBlockSnapshot['arguments'] = {PROPERTY: literal('font'), VALUE: literal('Sans Serif')},
  unavailable?: 'missing' | 'unsupported'): FixedBlockSnapshot {
  const inputs: Record<string, FixedBlockSnapshot['fixedContext']['inputs'][string]> = {};
  for (const binding of options.bindings) {
    const name = binding.argument;
    const slot = args[name];
    inputs[name] = {role: 'editable', source: name === 'PROPERTY' && unavailable ? unavailable :
      slot?.kind === 'reporter' ? 'reporter' : slot ? 'shadow' : 'missing', identity: `${name}:1`,
    ...(name === 'PROPERTY' && unavailable ? {reason: unavailable} : {}),
    ...(slot?.kind === 'literal' && !(name === 'PROPERTY' && unavailable) ?
      {field: {blockId: `${name}-shadow`, name: name === 'INDEX' ? 'NUM' : 'TEXT', type: name === 'INDEX' ? 'math_number' : 'text'}} : {})};
  }
  return {targetId: 'target', blockId: 'block', opcode: options.opcodes[0]!, revision: '1', arguments: args,
    fixedContext: {contractId: options.contractId, contractRevision: options.contractRevision, generation: '1',
      readOnlyArguments: [], dependencies: options.dependencies ?? [], inputs}};
}
function setup(args?: FixedBlockSnapshot['arguments'], unavailable?: 'missing' | 'unsupported') {
  const definition = createFixedInputEditor(styleOptions);
  const current = snapshot(styleOptions, args, unavailable);
  return {definition, current, draft: definition.readFixed(current)};
}
function edit(draft: JsonObject, argument: string, value: LiteralValue): JsonObject {
  const copy = structuredClone(draft) as {inputs: Record<string, {value: LiteralValue; changed: boolean}>};
  copy.inputs[argument] = {value, changed: true};
  return copy;
}
function ready(options: FixedInputEditorOptions, args: FixedBlockSnapshot['arguments'], argument: string, value: LiteralValue) {
  const definition = createFixedInputEditor(options); const current = snapshot(options, args);
  return definition.prepareFixedSave(edit(definition.readFixed(current), argument, value), current);
}

describe('CP-asset-manager owner branch fixtures', () => {
  it('BC01@CP-asset-manager: a reporter selector makes the group readonly without evaluation', () => {
    const f = setup({PROPERTY: reporter, VALUE: literal('20')});
    const view = f.definition.describeFixed!(f.draft, f.current);
    expect(view.inputs.PROPERTY!.state).toBe('readonly');
    expect(view.inputs.VALUE!.state).toBe('readonly');
    expect(f.definition.prepareFixedSave(f.draft, f.current)).toMatchObject({kind: 'ready', changes: []});
    expect(f.definition.prepareFixedSave(edit(f.draft, 'VALUE', '30'), f.current).kind).toBe('invalid');
  });
  it('BC02@CP-asset-manager: an unknown selector retains raw until repaired and rechecks VALUE', () => {
    const f = setup({PROPERTY: literal('unknown'), VALUE: literal('20')});
    expect(f.definition.describeFixed!(f.draft, f.current).inputs.VALUE!.state).toBe('readonly');
    expect(f.definition.prepareFixedSave(f.draft, f.current)).toMatchObject({kind: 'ready', changes: []});
    expect(f.definition.prepareFixedSave(edit(f.draft, 'PROPERTY', 'width'), f.current)).toMatchObject({kind: 'ready', changes: [{argument: 'PROPERTY', value: 'width'}]});
  });
  it('BC03@CP-asset-manager: aliases project to color controls without changing either raw literal', () => {
    const f = setup({PROPERTY: literal(' COLOR '), VALUE: literal('#AbC')});
    expect(f.definition.describeFixed!(f.draft, f.current).inputs.VALUE).toMatchObject({state: 'editable', control: 'color'});
    expect(f.definition.prepareFixedSave(f.draft, f.current)).toMatchObject({kind: 'ready', changes: []});
    expect(f.current.arguments).toEqual({PROPERTY: literal(' COLOR '), VALUE: literal('#AbC')});
  });
  it('BC04@CP-asset-manager: an invalid dependent blocks all writes until corrected or reset', () => {
    const f = setup({PROPERTY: literal('font'), VALUE: literal('abc')});
    const switched = edit(f.draft, 'PROPERTY', 'width');
    expect(f.definition.prepareFixedSave(switched, f.current).kind).toBe('invalid');
    for (const value of ['20', '']) {
      const result = f.definition.prepareFixedSave(edit(switched, 'VALUE', value), f.current);
      expect(result).toMatchObject({kind: 'ready', changes: [{argument: 'PROPERTY', value: 'width'}, {argument: 'VALUE', value}]});
    }
    expect(switched).toMatchObject({inputs: {VALUE: {value: 'abc', changed: false}}});
  });
  it('BC05@CP-asset-manager: a reporter dependent prevents selector changes without replacing it', () => {
    const f = setup({PROPERTY: literal('font'), VALUE: reporter});
    expect(f.definition.prepareFixedSave(edit(f.draft, 'PROPERTY', 'width'), f.current).kind).toBe('invalid');
    expect(f.current.arguments.VALUE).toEqual(reporter);
  });
  it('BC14@CP-asset-manager: unsupported or missing selectors leave the group readonly without defaults', () => {
    for (const state of ['missing', 'unsupported'] as const) {
      const f = setup({...(state === 'missing' ? {} : {PROPERTY: literal('font')}), VALUE: literal('20')}, state);
      const view = f.definition.describeFixed!(f.draft, f.current);
      expect(view.inputs.PROPERTY!.state).toBe('readonly');
      expect(view.inputs.VALUE!.state).toBe('readonly');
      expect(f.definition.prepareFixedSave(f.draft, f.current)).toMatchObject({kind: 'ready', changes: []});
      expect(f.definition.prepareFixedSave(edit(f.draft, 'VALUE', '30'), f.current).kind).toBe('invalid');
    }
  });
});

describe('pure owner codec and existing runtime compatibility', () => {
  beforeEach(() => vi.stubGlobal('Scratch', {vm: {runtime: {renderer: {}, targets: [], ext_lmsTempVars2: {getRuntimeVariable: vi.fn(), setRuntimeVariable: vi.fn()}}},
    extensions: {unsandboxed: true, register: vi.fn()}, BlockType: {COMMAND: 'command', BOOLEAN: 'boolean', REPORTER: 'reporter'},
    ArgumentType: {STRING: 'string', NUMBER: 'number'}, translate: (value: string) => value}));
  afterEach(() => vi.unstubAllGlobals());

  it('resolves every canonical provenance pointer to its exact binding schema document', () => {
    let checked = 0;
    for (const options of fixedInputEditors) {
      const bindings = [...options.bindings, ...(options.branchPolicies ?? []).flatMap(policy => policy.cases.flatMap(branch => branch.bindings ?? []))];
      for (const binding of bindings) {
        const artifact = binding.schemaBundle.root.artifact;
        expect(artifact.role).toBe('canonical-schema');
        const pointer = artifact.source.symbol!;expect(pointer.startsWith('#/$defs/')).toBe(true);
        let selected: unknown = canonicalSchema;
        for (const part of pointer.slice(2).split('/')) {
          expect(typeof selected).toBe('object');expect(selected).not.toBeNull();
          selected = (selected as Record<string, unknown>)[part.replaceAll('~1', '/').replaceAll('~0', '~')];
        }
        expect(selected).toEqual(binding.schemaBundle.root.document);checked++;
      }
    }
    expect(checked).toBe(8);
  });

  it('matches actual setTextStyle runtime normalization for every branch and reset', () => {
    const extension = new AssetManagerExtension();
    const examples = {animation: ['typing', 'RAINBOW', ''], font: [' Sans Serif ', ''], color: ['#F80', '#aBcDeF', ''],
      width: ['1.5e2', '0.25', ''], align: [' RIGHT ', '']};
    for (const property of TEXT_STYLE_PROPERTIES) {
      const binding = styleBinding(property);
      for (const value of examples[property]) {
        extension.setTextStyle({NAME: 'Text', PROPERTY: property, VALUE: value});
        expect(Scratch.vm.runtime.ext_lmsTempVars2!.setRuntimeVariable).toHaveBeenLastCalledWith({VAR: `textStyle:Text:${property}`, STRING: normalizeTextStyleValue(property, value)});
        expect(binding.validateCandidate(value, context, snapshot())).toEqual([]);
        expect(binding.read(value)).toBe(normalizeTextStyleValue(property, value));
      }
    }
  });
  it('preserves aliases and accepts programmatic width strings by the CP runtime contract', () => {
    for (const [property, value] of [['animation', 'typing'], ['align', ' RIGHT '], ['color', '#F80'], ['width', '0x10']] as const) {
      const f = setup({PROPERTY: literal(property), VALUE: literal(value)});
      expect(f.definition.prepareFixedSave(f.draft, f.current)).toMatchObject({kind: 'ready', changes: []});
    }
    for (const value of ['0', '-1', 'Infinity', 'NaN', '1e']) {
      expect(ready(styleOptions, {PROPERTY: literal('width'), VALUE: literal('20')}, 'VALUE', value).kind).toBe('invalid');
    }
    for (const value of ['0x10', '+20', '001', '1.', ' ', ' 2e1 ']) {
      const form = setup({PROPERTY: literal('width'), VALUE: literal('20')});
      expect(form.definition.describeFixed!(edit(form.draft, 'VALUE', value), form.current).issues).toEqual([]);
      expect(ready(styleOptions, {PROPERTY: literal('width'), VALUE: literal('20')}, 'VALUE', value))
        .toMatchObject({kind: 'ready', changes: [{argument: 'VALUE', value}]});
    }
    // A selector change validates the existing literal using runtime rules, not NEW-input syntax.
    expect(ready(styleOptions, {PROPERTY: literal('font'), VALUE: literal('0x10')}, 'PROPERTY', 'width'))
      .toMatchObject({kind: 'ready', changes: [{argument: 'PROPERTY', value: 'width'}]});
  });
  it('keeps the exact new INDEX numeric token and permits finite fraction/negative values accepted by runtime', () => {
    const extension = new AssetManagerExtension(); extension.setLoadingCostumes({NAMES: 'one,two'});
    for (const token of ['-0', '-1.5', '0.25', '2.9', '1e1', '9007199254740993']) {
      const definition = createFixedInputEditor(indexOptions); const current = snapshot(indexOptions, {INDEX: literal('1')});
      const draft = {inputs: {INDEX: {value: Number(token), changed: true, buffer: token}}};
      const result = definition.prepareFixedSave(draft, current);
      expect(result).toMatchObject({kind: 'ready', changes: [{argument: 'INDEX', value: token}]});
      const runtimeIndex = Math.max(1, Math.trunc(Number(token)));
      expect(extension.loadingCostumeAt({INDEX: token})).toBe(['one', 'two'][(runtimeIndex - 1) % 2]);
    }
    for (const value of ['Infinity', 'NaN', '0x10', '+1', '001', '1.', '', '1e']) {
      expect(ready(indexOptions, {INDEX: literal('1')}, 'INDEX', value).kind).toBe('invalid');
    }
    const f = createFixedInputEditor(indexOptions); const old = snapshot(indexOptions, {INDEX: literal('Infinity')});
    expect(f.prepareFixedSave(f.readFixed(old), old)).toMatchObject({kind: 'ready', changes: []});
    expect(extension.loadingCostumeAt({INDEX: 'Infinity'})).toBe('one');
    const hexadecimal = snapshot(indexOptions, {INDEX: literal('0x10')});
    expect(f.prepareFixedSave(f.readFixed(hexadecimal), hexadecimal)).toMatchObject({kind: 'ready', changes: []});
    for (const value of ['', '  ', false] as const) {
      const blank = snapshot(indexOptions, {INDEX: literal(value)}); const draft = f.readFixed(blank);
      expect(draft).toEqual({inputs: {INDEX: {readOnly: true}}});
      expect(f.prepareFixedSave(draft, blank)).toMatchObject({kind: 'ready', changes: []});
      expect(f.prepareFixedSave({inputs: {INDEX: {value: 2, buffer: '2', changed: true, repair: true}}}, blank))
        .toMatchObject({kind: 'ready', changes: [{argument: 'INDEX', value: '2'}]});
      expect(blank.arguments.INDEX).toEqual(literal(value));
    }
  });
  it('retains an invalid draft across branch switches and failed saves without patching NAME', () => {
    const f = setup({PROPERTY: literal('width'), VALUE: literal('20')});
    const invalid = edit(f.draft, 'VALUE', '1e');
    expect(f.definition.prepareFixedSave(invalid, f.current).kind).toBe('invalid');
    const switched = edit(invalid, 'PROPERTY', 'font');
    expect(switched).toMatchObject({inputs: {VALUE: {value: '1e', changed: true}}});
    expect(f.definition.prepareFixedSave(edit(switched, 'PROPERTY', 'width'), f.current).kind).toBe('invalid');
    const fixed = f.definition.prepareFixedSave(edit(invalid, 'VALUE', '30'), f.current);
    expect(fixed).toMatchObject({kind: 'ready', changes: [{argument: 'VALUE', value: '30'}]});
  });
});

describe('optional registration and lifetime', () => {
  it('uses the owner registration in a common session and retains failed drafts only until session exit', async () => {
    const registry = new EditorRegistry();
    const registration = fixedInputRegistration({gui: {blockEditors: {apiVersion: 1,
      registerFixedInputEditor: (options: FixedInputEditorOptions) => registry.registerFixed(createFixedInputEditor(options))}}});
    registration.ensure(styleOptions.opcodes);
    let live = snapshot(styleOptions, {PROPERTY: literal('width'), VALUE: literal('20')});
    let failCommit = true;
    const host: BlockEditorHost = {readBlock: () => live, commit: () => {throw Error('Legacy commit must not run.');},
      fixedInputs: {capability: 'fixed-inputs-v1', readBlock: () => live, commit(request) {
        if (failCommit) throw Error('Owner fixture commit failure.');
        live = {...live, revision: '2', arguments: {...live.arguments,
          ...Object.fromEntries(request.changes.map(change => [change.argument, literal(change.value)]))}};
      }}};
    const session = registry.open(live, host)!;
    session.setDraft(edit(session.getDraft(), 'VALUE', '1e'));
    session.setDraft(edit(session.getDraft(), 'PROPERTY', 'font'));
    session.setDraft(edit(session.getDraft(), 'PROPERTY', 'width'));
    expect((await session.save()).status).toBe('invalid');
    expect(session.getDraft()).toMatchObject({inputs: {VALUE: {value: '1e', changed: true}}});
    session.setDraft(edit(session.getDraft(), 'VALUE', '30'));
    expect((await session.save()).status).toBe('failed');
    expect(session.getDraft()).toMatchObject({inputs: {VALUE: {value: '30', changed: true}}});
    failCommit = false;expect((await session.save()).status).toBe('saved');
    expect(live.arguments.VALUE).toEqual(literal('30'));
    const reopened = registry.open(live, host)!;
    expect(reopened.getDraft()).toMatchObject({inputs: {VALUE: {value: '30', changed: false}}});
    reopened.setDraft(edit(reopened.getDraft(), 'VALUE', '40'));
    registration.dispose();expect(reopened.getState().status).toBe('disposed');
    expect(registry.open(live, host)).toBeUndefined();
  });
  it('does nothing with absent/legacy/default-OFF APIs and excludes absent getInfo opcodes', () => {
    for (const host of [{}, {gui: {blockEditors: {apiVersion: 1}}}, {gui: {blockEditors: {apiVersion: 2, registerFixedInputEditor: vi.fn()}}}]) {
      expect(() => fixedInputRegistration(host).ensure(styleOptions.opcodes)).not.toThrow();
    }
    const register = vi.fn(() => vi.fn());
    const registration = fixedInputRegistration({gui: {blockEditors: {apiVersion: 1, registerFixedInputEditor: register}}});
    registration.ensure(styleOptions.opcodes);
    expect(register).toHaveBeenCalledTimes(1);expect(register).toHaveBeenCalledWith(styleOptions);
    registration.ensure(styleOptions.opcodes);expect(register).toHaveBeenCalledTimes(1);
    registration.dispose();
  });
  it('unregisters once on dispose/runtime exit and rolls back a partial registration failure', () => {
    const remove = vi.fn();const register = vi.fn(() => remove);const listeners = new Map<string, () => void>();
    const runtime = {on: vi.fn((event: string, listener: () => void) => listeners.set(event, listener)),
      off: vi.fn((event: string) => listeners.delete(event))};
    const host = {gui: {blockEditors: {apiVersion: 1, registerFixedInputEditor: register}}, vm: {runtime}};
    const registration = fixedInputRegistration(host);registration.ensure(fixedInputEditors.flatMap(d => d.opcodes));
    expect(register).toHaveBeenCalledTimes(2);listeners.get('RUNTIME_DISPOSED')!();registration.dispose();
    expect(remove).toHaveBeenCalledTimes(2);registration.ensure(styleOptions.opcodes);expect(register).toHaveBeenCalledTimes(2);
    const undo = vi.fn();let count = 0;
    const failed = fixedInputRegistration({gui: {blockEditors: {apiVersion: 1, registerFixedInputEditor() {if (++count === 2) throw Error('fail'); return undo;}}}});
    expect(() => failed.ensure(fixedInputEditors.flatMap(d => d.opcodes))).toThrow('fail');expect(undo).toHaveBeenCalledOnce();
  });
  it('registers only after getInfo, preserves all metadata and supports API replacement without duplication', () => {
    const remove = vi.fn();const register = vi.fn(() => remove);const runtime = {renderer: {}, targets: [], on: vi.fn(), off: vi.fn()};
    const host = {gui: {blockEditors: {apiVersion: 1, registerFixedInputEditor: register}}, vm: {runtime},
      extensions: {unsandboxed: true, register: vi.fn()}, BlockType: {COMMAND: 'command', BOOLEAN: 'boolean', REPORTER: 'reporter'},
      ArgumentType: {STRING: 'string', NUMBER: 'number'}, translate: (value: string) => value};
    vi.stubGlobal('Scratch', host);
    try {
      const extension = new AssetManagerExtension();expect(register).not.toHaveBeenCalled();
      const first = extension.getInfo();expect(register).toHaveBeenCalledTimes(2);expect(extension.getInfo()).toEqual(first);expect(register).toHaveBeenCalledTimes(2);
      expect(first.blocks.find(b => b.opcode === 'loadingCostumeAt')).toMatchObject({hideFromPalette: true, arguments: {INDEX: {type: 'number', defaultValue: '1'}}});
      host.gui.blockEditors = {apiVersion: 1, registerFixedInputEditor: vi.fn(() => vi.fn())};
      expect(extension.getInfo()).toEqual(first);expect(remove).toHaveBeenCalledTimes(2);expect(host.gui.blockEditors.registerFixedInputEditor).toHaveBeenCalledTimes(2);
      extension.dispose();
    } finally {vi.unstubAllGlobals();}
  });
});
