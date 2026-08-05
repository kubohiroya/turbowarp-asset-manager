export declare const ASSET_MANAGER_ERROR_CODES: readonly ["INVALID_ASSET_NAME", "ASSET_NOT_REGISTERED", "ASSET_TYPE_MISMATCH", "ASSET_TYPE_CHANGE", "SPRITE_NOT_FOUND", "SPRITE_NAME_AMBIGUOUS", "SOURCE_ASSET_NOT_FOUND", "RESOURCE_ID_INVALID", "DEPENDENCY_MISSING", "STYLE_PROPERTY_INVALID", "STYLE_VALUE_INVALID", "PLAYBACK_FAILED", "ANIMATION_FAILED", "REPLACEMENT_FAILED"];
export type AssetManagerErrorCode = typeof ASSET_MANAGER_ERROR_CODES[number];
export interface AssetManagerErrorContext {
    operation: string;
    assetName?: string | undefined;
    resourceId?: string | undefined;
    actorName?: string | undefined;
    expectedKind?: string | undefined;
    actualKind?: string | undefined;
    hint?: string | undefined;
    candidates?: string[] | undefined;
    cause?: unknown;
}
export declare class AssetManagerError extends Error {
    readonly code: AssetManagerErrorCode;
    readonly operation: string;
    readonly assetName: string | undefined;
    readonly resourceId: string | undefined;
    readonly actorName: string | undefined;
    readonly expectedKind: string | undefined;
    readonly actualKind: string | undefined;
    readonly hint: string | undefined;
    readonly candidates: readonly string[];
    constructor(code: AssetManagerErrorCode, message: string, context: AssetManagerErrorContext);
}
export declare function suggestNames(value: unknown, choices: Iterable<string>, limit?: number): string[];
export declare function suggestionHint(candidates: readonly string[]): string | undefined;
export declare function errorMessage(error: unknown): string;
