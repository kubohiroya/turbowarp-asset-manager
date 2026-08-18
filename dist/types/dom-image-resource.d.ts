export interface DOMImageResource {
    readonly url: string;
    readonly mimeType: string;
    readonly width: number;
    readonly height: number;
    readonly released: boolean;
    release(): void;
}
export interface DOMImageResourceInput {
    readonly name: string;
    readonly bytes: Uint8Array;
    readonly mimeType: string;
}
export interface DOMImageResourceBacking {
    acquire(onRelease?: (resource: DOMImageResource) => void): DOMImageResource;
}
export declare function createDOMImageResource(input: DOMImageResourceInput, onRelease?: (resource: DOMImageResource) => void): Promise<DOMImageResource>;
export declare function createDOMImageResourceBacking(input: DOMImageResourceInput, onIdle?: (backing: DOMImageResourceBacking) => void): Promise<DOMImageResourceBacking>;
