import {describe, expect, it} from 'vitest';
import {
  normalizeTextStyleProperty,
  normalizeTextStyleValue,
  resolveTextStyle,
  textRuntimeVariableName,
  textStyleRuntimeVariableName
} from '../src/text-style.js';

describe('runtime text style', () => {
  it('builds internal runtime-variable names', () => {
    expect(textRuntimeVariableName('Narration')).toBe('text:Narration');
    expect(textStyleRuntimeVariableName('Narration', 'font')).toBe('textStyle:Narration:font');
  });

  it('normalizes supported DSL values', () => {
    expect(normalizeTextStyleProperty(' Animation ')).toBe('animation');
    expect(normalizeTextStyleValue('animation', 'typing')).toBe('type');
    expect(normalizeTextStyleValue('animation', 'RAINBOW')).toBe('rainbow');
    expect(normalizeTextStyleValue('color', '#F80')).toBe('#ff8800');
    expect(normalizeTextStyleValue('width', '0200')).toBe('200');
    expect(normalizeTextStyleValue('align', 'LEFT')).toBe('left');
  });

  it('uses Animated Text defaults for missing properties', () => {
    const values = new Map<string, unknown>();
    expect(resolveTextStyle('Narration', 600, (name) => values.get(name) ?? '')).toEqual({
      animation: 'none',
      font: 'Handwriting',
      color: '#575e75',
      width: 600,
      align: 'center'
    });
  });
});
