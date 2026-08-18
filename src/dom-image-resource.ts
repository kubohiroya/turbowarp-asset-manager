import {AssetManagerError} from './asset-manager-error.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';
const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';
const FORBIDDEN_SVG_ELEMENTS = new Set([
  'animate',
  'animatemotion',
  'animatetransform',
  'discard',
  'embed',
  'foreignobject',
  'iframe',
  'object',
  'script',
  'set'
]);
const SAFE_DATA_IMAGE_REFERENCE =
  /^data:image\/(?:avif|bmp|gif|jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i;

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

interface VerifiedDOMImage {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
}

export async function createDOMImageResource(
  input: DOMImageResourceInput,
  onRelease?: (resource: DOMImageResource) => void
): Promise<DOMImageResource> {
  const backing = await createDOMImageResourceBacking(input);
  return backing.acquire(onRelease);
}

export async function createDOMImageResourceBacking(
  input: DOMImageResourceInput,
  onIdle?: (backing: DOMImageResourceBacking) => void
): Promise<DOMImageResourceBacking> {
  const normalizedInput = {...input, mimeType: normalizedImageMimeType(input.mimeType)};
  const verified = normalizedInput.mimeType === 'image/svg+xml'
    ? verifySVGImage(normalizedInput)
    : await verifyRasterImage(normalizedInput);
  const objectURL = URL.createObjectURL(new Blob(
    [copyArrayBuffer(verified.bytes)],
    {type: verified.mimeType}
  ));
  let leaseCount = 0;
  let revoked = false;
  let idleListener = onIdle;
  const backing: DOMImageResourceBacking = Object.freeze({
    acquire(onRelease?: (resource: DOMImageResource) => void) {
      if (revoked) throw new Error('DOM image resource backing has been released.');
      leaseCount += 1;
      let released = false;
      let releaseListener = onRelease;
      let backingReference: DOMImageResourceBacking | undefined = backing;
      const resource: DOMImageResource = Object.freeze({
        url: objectURL,
        mimeType: verified.mimeType,
        width: verified.width,
        height: verified.height,
        get released() {
          return released;
        },
        release() {
          if (released) return;
          released = true;
          leaseCount -= 1;
          const releasedBacking = backingReference;
          backingReference = undefined;
          try {
            if (leaseCount === 0) {
              revoked = true;
              URL.revokeObjectURL(objectURL);
            }
          } finally {
            const listener = releaseListener;
            releaseListener = undefined;
            try {
              listener?.(resource);
            } finally {
              if (revoked) {
                const listener = idleListener;
                idleListener = undefined;
                if (releasedBacking) listener?.(releasedBacking);
              }
            }
          }
        }
      });
      return resource;
    }
  });
  return backing;
}

function verifySVGImage(input: DOMImageResourceInput): VerifiedDOMImage {
  let source: string;
  try {
    source = new TextDecoder('utf-8', {fatal: true}).decode(input.bytes);
  } catch (error) {
    throw invalidResource(input.name, 'SVG bytes are not valid UTF-8.', error);
  }
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet\b/i.test(source)) {
    throw unsafeSVG(input.name, 'DOCTYPE, entity, and stylesheet processing instructions are forbidden.');
  }
  if (typeof DOMParser !== 'function' || typeof XMLSerializer !== 'function') {
    throw new AssetManagerError(
      'DEPENDENCY_MISSING',
      'DOMParser and XMLSerializer are required to validate SVG image resources.',
      {
        operation: 'resolveDOMImageResource',
        assetName: input.name,
        hint: 'Resolve SVG resources in a browser DOM environment.'
      }
    );
  }
  let document: Document;
  try {
    document = new DOMParser().parseFromString(source, 'image/svg+xml');
  } catch (error) {
    throw invalidResource(input.name, 'SVG markup is not well-formed XML.', error);
  }
  const root = document.documentElement;
  if (
    root.localName.toLowerCase() === 'parsererror' ||
    document.getElementsByTagName('parsererror').length > 0
  ) {
    throw invalidResource(input.name, 'SVG markup is not well-formed XML.');
  }
  if (root.namespaceURI !== SVG_NAMESPACE || root.localName.toLowerCase() !== 'svg') {
    throw invalidResource(input.name, 'SVG resource must have an SVG root element.');
  }

  validateSVGElement(input.name, root);
  for (const element of root.getElementsByTagName('*')) {
    validateSVGElement(input.name, element);
  }
  const {width, height} = svgIntrinsicSize(input.name, root);
  const serialized = new XMLSerializer().serializeToString(document);
  return {
    bytes: new TextEncoder().encode(serialized),
    mimeType: 'image/svg+xml',
    width,
    height
  };
}

function validateSVGElement(name: string, element: Element): void {
  const localName = element.localName.toLowerCase();
  if (element.namespaceURI !== SVG_NAMESPACE) {
    throw unsafeSVG(name, `Element namespace is not allowed: ${element.namespaceURI ?? '(none)'}.`);
  }
  if (FORBIDDEN_SVG_ELEMENTS.has(localName)) {
    throw unsafeSVG(name, `SVG <${localName}> elements are forbidden.`);
  }
  if (localName === 'style') validateCSSReferences(name, element.textContent ?? '');

  for (const attribute of [...element.attributes]) {
    const attributeName = attribute.localName.toLowerCase();
    if (attributeName.startsWith('on')) {
      throw unsafeSVG(name, `SVG event handler attribute ${attribute.name} is forbidden.`);
    }
    if (attribute.namespaceURI && ![
      XLINK_NAMESPACE,
      XML_NAMESPACE,
      XMLNS_NAMESPACE
    ].includes(attribute.namespaceURI)) {
      throw unsafeSVG(name, `Attribute namespace is not allowed: ${attribute.namespaceURI}.`);
    }
    if (attributeName === 'base' && attribute.namespaceURI === XML_NAMESPACE) {
      throw unsafeSVG(name, 'SVG xml:base is forbidden.');
    }
    if (attributeName === 'href' || attributeName === 'src') {
      validateImageReference(name, attribute.value);
    }
    if (attributeName === 'style' || /url\s*\(/i.test(attribute.value)) {
      validateCSSReferences(name, attribute.value);
    }
  }
}

function validateImageReference(name: string, rawReference: string): void {
  const reference = rawReference.trim();
  if (!reference || reference.startsWith('#') || SAFE_DATA_IMAGE_REFERENCE.test(reference)) return;
  throw unsafeSVG(name, `External SVG reference is forbidden: ${safeLabel(reference)}.`);
}

function validateCSSReferences(name: string, css: string): void {
  if (
    /[\\@]|\/\*|expression\s*\(|-moz-binding\s*:|(?:-webkit-)?image(?:-set)?\s*\(|cross-fade\s*\(|(?:https?|file|ftp|javascript):|\/\//i
      .test(css)
  ) {
    throw unsafeSVG(name, 'Imported, obfuscated, external, or executable SVG CSS is forbidden.');
  }
  for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    validateImageReference(name, match[2] ?? '');
  }
}

function svgIntrinsicSize(name: string, root: Element): {width: number; height: number} {
  const rawWidth = root.getAttribute('width');
  const rawHeight = root.getAttribute('height');
  const rawViewBox = root.getAttribute('viewBox');
  const width = absoluteSVGLength(rawWidth);
  const height = absoluteSVGLength(rawHeight);
  const viewBox = svgViewBox(rawViewBox);
  if (rawWidth !== null && width === null) {
    throw invalidResource(name, 'SVG width must be a positive absolute length.');
  }
  if (rawHeight !== null && height === null) {
    throw invalidResource(name, 'SVG height must be a positive absolute length.');
  }
  if (rawViewBox !== null && viewBox === null) {
    throw invalidResource(name, 'SVG viewBox must contain four finite values and positive dimensions.');
  }
  if (width !== null && height !== null) return {width, height};
  if (width !== null && viewBox) {
    return {width, height: width * viewBox.height / viewBox.width};
  }
  if (height !== null && viewBox) {
    return {width: height * viewBox.width / viewBox.height, height};
  }
  if (viewBox) return {width: viewBox.width, height: viewBox.height};
  throw invalidResource(
    name,
    'SVG resource must declare positive absolute width/height or a positive viewBox.'
  );
}

function absoluteSVGLength(raw: string | null): number | null {
  if (raw === null || !raw.trim()) return null;
  const match = /^([+]?(?:\d+\.?\d*|\.\d+))(px|in|cm|mm|q|pt|pc)?$/i.exec(raw.trim());
  if (!match) return null;
  const value = Number(match[1]);
  const factor = new Map<string, number>([
    ['', 1], ['px', 1], ['in', 96], ['cm', 96 / 2.54], ['mm', 96 / 25.4],
    ['q', 96 / 101.6], ['pt', 96 / 72], ['pc', 16]
  ]).get((match[2] ?? '').toLowerCase());
  const pixels = value * (factor ?? Number.NaN);
  return Number.isFinite(pixels) && pixels > 0 ? pixels : null;
}

function svgViewBox(raw: string | null): {width: number; height: number} | null {
  if (raw === null) return null;
  const values = raw.trim().split(/[\s,]+/).map(Number);
  if (
    values.length !== 4 ||
    values.some((value) => !Number.isFinite(value)) ||
    !(values[2]! > 0) ||
    !(values[3]! > 0)
  ) return null;
  return {width: values[2]!, height: values[3]!};
}

async function verifyRasterImage(input: DOMImageResourceInput): Promise<VerifiedDOMImage> {
  const detectedMimeType = sniffRasterMimeType(input.bytes);
  if (!detectedMimeType || detectedMimeType !== input.mimeType) {
    throw new AssetManagerError(
      'ASSET_TYPE_MISMATCH',
      `Image asset "${input.name}" bytes do not match MIME type ${input.mimeType}.`,
      {
        operation: 'resolveDOMImageResource',
        assetName: input.name,
        expectedKind: input.mimeType,
        actualKind: detectedMimeType ?? 'unrecognized image bytes',
        hint: 'Use PNG, JPEG, GIF, WebP, BMP, or AVIF bytes with the matching MIME type.'
      }
    );
  }
  if (typeof createImageBitmap !== 'function') {
    throw new AssetManagerError(
      'DEPENDENCY_MISSING',
      'createImageBitmap is required to validate raster image dimensions.',
      {
        operation: 'resolveDOMImageResource',
        assetName: input.name,
        hint: 'Resolve raster resources in a browser that supports createImageBitmap.'
      }
    );
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob(
      [copyArrayBuffer(input.bytes)],
      {type: input.mimeType}
    ));
  } catch (error) {
    throw invalidResource(input.name, 'Raster image bytes could not be decoded.', error);
  }
  try {
    if (
      !Number.isFinite(bitmap.width) || bitmap.width <= 0 ||
      !Number.isFinite(bitmap.height) || bitmap.height <= 0
    ) {
      throw invalidResource(input.name, 'Raster image has invalid intrinsic dimensions.');
    }
    return {
      bytes: input.bytes,
      mimeType: input.mimeType,
      width: bitmap.width,
      height: bitmap.height
    };
  } finally {
    bitmap.close();
  }
}

function sniffRasterMimeType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return 'image/gif';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp';
  if (ascii(bytes, 0, 2) === 'BM') return 'image/bmp';
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }
  return null;
}

function normalizedImageMimeType(value: string): string {
  const mimeType = value.split(';')[0]?.trim().toLowerCase() ?? '';
  if (mimeType === 'image/jpg' || mimeType === 'image/pjpeg') return 'image/jpeg';
  if (mimeType === 'image/x-png') return 'image/png';
  if (mimeType === 'image/x-ms-bmp') return 'image/bmp';
  return mimeType;
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.byteLength < offset + length) return '';
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function copyArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

function invalidResource(name: string, message: string, cause?: unknown): AssetManagerError {
  return new AssetManagerError('RESOURCE_ID_INVALID', message, {
    operation: 'resolveDOMImageResource',
    assetName: name,
    hint: 'Provide a well-formed image with verifiable intrinsic dimensions.',
    cause
  });
}

function unsafeSVG(name: string, message: string): AssetManagerError {
  return new AssetManagerError('RESOURCE_ID_INVALID', message, {
    operation: 'resolveDOMImageResource',
    assetName: name,
    hint: 'Remove scripts, event handlers, embedded HTML, and external references from the SVG.'
  });
}

function safeLabel(value: string): string {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80);
  return JSON.stringify(normalized || '(empty)');
}
