export declare const TEXT_RUNTIME_NAMESPACE = "text";
export declare const TEXT_STYLE_RUNTIME_NAMESPACE = "textStyle";
export declare const TEXT_STYLE_PROPERTIES: readonly ["animation", "font", "color", "width", "align"];
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
export declare const DEFAULT_OUTLINE_WIDTH = 2;
export declare const DEFAULT_OUTLINE_COLOR = "#000000";
export declare function textRuntimeVariableName(name: string): string;
export declare function textStyleRuntimeVariableName(name: string, property: TextStyleProperty): string;
export declare function normalizeTextStyleProperty(value: unknown): TextStyleProperty;
/**
 * Normalize a DSL-facing style value for runtime-variable storage.
 * An empty value intentionally resets the property to its default.
 */
export declare function normalizeTextStyleValue(property: TextStyleProperty, value: unknown): string;
export declare function resolveTextStyle(name: string, stageWidth: unknown, getRuntimeVariable: (variableName: string) => unknown): TextStyle;
