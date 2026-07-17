import {describe, expect, it} from 'vitest';
import blockDefinitions from '../src/block-definitions.json' with {type: 'json'};

interface AnimationBlockDefinition {
  opcode: string;
  text: string;
  description: string;
  arguments: Record<string, unknown>;
}

describe('actor animation block arguments', () => {
  it('uses ASSETS instead of COSTUMES for loop and sequence blocks', () => {
    const animationBlocks = blockDefinitions.blocks.filter(
      (block): block is typeof block & AnimationBlockDefinition =>
        block.opcode === 'startActorLoop' || block.opcode === 'startActorSequence'
    );

    expect(animationBlocks).toHaveLength(2);
    for (const block of animationBlocks) {
      expect(block.text).toContain('[ASSETS]');
      expect(block.text).not.toContain('[COSTUMES]');
      expect(block.arguments).toHaveProperty('ASSETS');
      expect(block.arguments).not.toHaveProperty('COSTUMES');
      expect(block.description).toContain('registered image asset names');
    }
  });
});
