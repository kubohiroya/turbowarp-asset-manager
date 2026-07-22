export const TEXT_RUNTIME_NAMESPACE = 'text';
export const TEXT_STYLE_RUNTIME_NAMESPACE = 'textStyle';

export const TEXT_STYLE_PROPERTIES = [
  'animation',
  'font',
  'color',
  'width',
  'align'
] as const;

export type TextStyleProperty = typeof TEXT_STYLE_PROPERTIES[number];
export type TextAnimation = 'none' | 'type' | 'rainbow' | 'zoom' | 'shake';
export type TextAlignment = 'left' | 'center' | 'right';

export interface TextStyle {
  animation: TextAnimation;
  font: string;
  color: string;
  width: number;
  align: TextAlignment;
}

const DEFAULT_STAGE_WIDTH = 480;
const DEFAULT_FONT = 'Handwriting';
const DEFAULT_COLOR = '#575e75';
const DEFAULT_ALIGNMENT: TextAlignment = 'center';

export function textRuntimeVariableName(name: string): string {
  return `${TEXT_RUNTIME_NAMESPACE}:${name}`;
}

export function textStyleRuntimeVariableName(name: string, property: TextStyleProperty): string {
  return `${TEXT_STYLE_RUNTIME_NAMESPACE}:${name}:${property}`;
}

export function normalizeTextStyleProperty(value: unknown): TextStyleProperty {
  const property = String(value ?? '').trim().toLowerCase();
  if ((TEXT_STYLE_PROPERTIES as readonly string[]).includes(property)) {
    return property as TextStyleProperty;
  }
  throw new Error(`Unknown text style property: ${property || '(empty)'}`);
}

/**
 * Normalize a DSL-facing style value for runtime-variable storage.
 * An empty value intentionally resets the property to its default.
 */
export function normalizeTextStyleValue(property: TextStyleProperty, value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  switch (property) {
    case 'animation': {
      const animation = raw.toLowerCase() === 'typing' ? 'type' : raw.toLowerCase();
      if (animation === 'none' || animation === 'type' || animation === 'rainbow' ||
          animation === 'zoom' || animation === 'shake') {
        return animation;
      }
      throw new Error(`Invalid text animation: ${raw}`);
    }
    case 'font':
      return raw;
    case 'color': {
      if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
      const shortColor = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(raw);
      if (shortColor) {
        return `#${shortColor[1]}${shortColor[1]}${shortColor[2]}${shortColor[2]}${shortColor[3]}${shortColor[3]}`
          .toLowerCase();
      }
      throw new Error(`Invalid text color: ${raw}`);
    }
    case 'width': {
      const width = Number(raw);
      if (!Number.isFinite(width) || width <= 0) {
        throw new Error(`Text width must be a positive number: ${raw}`);
      }
      return String(width);
    }
    case 'align': {
      const align = raw.toLowerCase();
      if (align === 'left' || align === 'center' || align === 'right') return align;
      throw new Error(`Invalid text alignment: ${raw}`);
    }
  }
}

export function resolveTextStyle(
  name: string,
  stageWidth: unknown,
  getRuntimeVariable: (variableName: string) => unknown
): TextStyle {
  const width = Number(stageWidth);
  const defaults: TextStyle = {
    animation: 'none',
    font: DEFAULT_FONT,
    color: DEFAULT_COLOR,
    width: Number.isFinite(width) && width > 0 ? width : DEFAULT_STAGE_WIDTH,
    align: DEFAULT_ALIGNMENT
  };

  const read = (property: TextStyleProperty): string => normalizeTextStyleValue(
    property,
    getRuntimeVariable(textStyleRuntimeVariableName(name, property))
  );
  const animation = read('animation');
  const font = read('font');
  const color = read('color');
  const configuredWidth = read('width');
  const align = read('align');

  return {
    animation: animation ? animation as TextAnimation : defaults.animation,
    font: font || defaults.font,
    color: color || defaults.color,
    width: configuredWidth ? Number(configuredWidth) : defaults.width,
    align: align ? align as TextAlignment : defaults.align
  };
}
