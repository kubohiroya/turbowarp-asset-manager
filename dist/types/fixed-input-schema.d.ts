import type { SchemaBundle, SchemaDocument } from '@kubohiroya/turbowarp-extension-data-editor/schema';
/** Canonical owner schema fragments; no network resources or runtime providers. */
export declare function fixedInputBundle(fragment: string, schema: SchemaDocument): SchemaBundle;
export declare const fixedSchemas: {
    setTextStyle: {
        type: string;
        properties: {
            PROPERTY: {
                type: string;
                enum: string[];
            };
            VALUE: {
                type: string;
            };
        };
        additionalProperties: boolean;
    };
    animation: {
        type: string;
        enum: string[];
    };
    font: {
        type: string;
    };
    color: {
        type: string;
        pattern: string;
    };
    width: {
        type: string;
        $comment: string;
    };
    align: {
        type: string;
        enum: string[];
    };
    loadingCostumeAt: {
        type: string;
        properties: {
            INDEX: {
                type: string;
            };
        };
        additionalProperties: boolean;
    };
};
