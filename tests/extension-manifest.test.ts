import {describe, expect, it} from 'vitest';
import {
  createExtensionManifest,
  serializeExtensionManifest
} from '@kubohiroya/turbowarp-extension-manifest';
import policy from '../repo-policy.json' with {type: 'json'};
import definitions from '../src/block-definitions.json' with {type: 'json'};

describe('extension API manifest', () => {
  it('serializes the canonical block definitions deterministically', () => {
    const first = serializeExtensionManifest(policy.extension.id, definitions);
    const second = serializeExtensionManifest(policy.extension.id, structuredClone(definitions));
    const manifest = createExtensionManifest(policy.extension.id, definitions);

    expect(first).toBe(second);
    expect(first).toBe(`${JSON.stringify(manifest, null, 2)}\n`);
    expect(manifest.id).toBe(policy.extension.id);
    expect(manifest.blocks).toHaveLength(definitions.blocks.length);
    expect(manifest.blocks.map((block) => block.opcode)).toEqual(
      definitions.blocks.map((block) => block.opcode).sort()
    );
  });

  it('rejects an invalid extension ID', () => {
    expect(() => createExtensionManifest('Invalid-ID', definitions)).toThrow(
      'Extension manifest ID must contain only lowercase letters and numbers.'
    );
  });

  it('rejects duplicate opcodes', () => {
    expect(() =>
      createExtensionManifest(policy.extension.id, {
        blocks: [
          {opcode: 'same', blockType: 'COMMAND'},
          {opcode: 'same', blockType: 'REPORTER'}
        ]
      })
    ).toThrow('Duplicate block opcode: same');
  });

  it('rejects an argument that references an unknown menu', () => {
    expect(() =>
      createExtensionManifest(policy.extension.id, {
        blocks: [
          {
            opcode: 'choose',
            blockType: 'REPORTER',
            arguments: {VALUE: {type: 'STRING', menu: 'missing'}}
          }
        ]
      })
    ).toThrow('references unknown menu: missing');
  });
});
