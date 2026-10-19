import type { FixedInputBinding, FixedInputEditorOptions } from '@kubohiroya/turbowarp-extension-data-editor';
import { type TextStyleProperty } from './text-style.js';
/** New edits preserve the candidate token; existing aliases are display projections only. */
export declare function styleBinding(property: TextStyleProperty): FixedInputBinding;
export declare const fixedInputEditors: readonly FixedInputEditorOptions[];
/** Per-instance, idempotent registration. Legacy hosts never acquire the fixed capability. */
export declare function fixedInputRegistration(scratch: unknown): {
    ensure(opcodes: readonly string[]): void;
    dispose: () => void;
};
