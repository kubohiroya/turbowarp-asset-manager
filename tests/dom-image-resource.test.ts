import {
  DOMParser as XMLDOMParser,
  XMLSerializer as XMLDOMSerializer
} from '@xmldom/xmldom';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {createDOMImageResource} from '../src/dom-image-resource.js';

describe('DOM image resources', () => {
  const createObjectURL = vi.fn((_blob: Blob | MediaSource) => 'blob:resource-1');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal('DOMParser', XMLDOMParser);
    vi.stubGlobal('XMLSerializer', XMLDOMSerializer);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURL);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns a frozen SVG object URL with verified intrinsic dimensions and idempotent release', async () => {
    const onRelease = vi.fn();
    const resource = await createDOMImageResource({
      name: 'Portrait',
      mimeType: 'image/svg+xml',
      bytes: new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">' +
        '<defs><clipPath id="face"><rect width="120" height="80"/></clipPath></defs>' +
        '<rect width="120" height="80" clip-path="url(#face)"/></svg>'
      )
    }, onRelease);

    expect(resource).toMatchObject({
      url: 'blob:resource-1',
      mimeType: 'image/svg+xml',
      width: 120,
      height: 80,
      released: false
    });
    expect(Object.isFrozen(resource)).toBe(true);
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    if (!(blob instanceof Blob)) throw new Error('Object URL Blob was not captured.');
    expect(blob.type).toBe('image/svg+xml');
    expect(await blob.text()).toContain('clip-path="url(#face)"');

    resource.release();
    resource.release();
    expect(resource.released).toBe(true);
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:resource-1');
    expect(onRelease).toHaveBeenCalledOnce();
  });

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" onload="run()"/>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><foreignObject/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><set attributeName="href" to="https://example.com/a.svg"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><image href="https://example.com/a.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><style>@import "https://example.com/a.css";</style></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><style>image {fill: u\\72l(https://example.com/a.svg)}</style></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" style="background: image(\'relative.png\')"/>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="0" viewBox="0 0 1 1"/>',
    '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'
  ])('rejects unsafe SVG content before creating an object URL', async (source) => {
    await expect(createDOMImageResource({
      name: 'Unsafe',
      mimeType: 'image/svg+xml',
      bytes: new TextEncoder().encode(source)
    })).rejects.toMatchObject({code: 'RESOURCE_ID_INVALID'});
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('derives a missing SVG dimension from its viewBox aspect ratio', async () => {
    const resource = await createDOMImageResource({
      name: 'Wide',
      mimeType: 'image/svg+xml',
      bytes: new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="2in" viewBox="0 0 4 2"/>'
      )
    });
    expect(resource.width).toBe(192);
    expect(resource.height).toBe(96);
    resource.release();
  });

  it('verifies raster signatures and decoded dimensions without creating a renderer skin', async () => {
    const close = vi.fn();
    const createImageBitmap = vi.fn(async () => ({width: 64, height: 32, close}));
    vi.stubGlobal('createImageBitmap', createImageBitmap);
    const resource = await createDOMImageResource({
      name: 'Portrait',
      mimeType: 'image/x-png',
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    });

    expect(resource).toMatchObject({mimeType: 'image/png', width: 64, height: 32});
    expect(createImageBitmap).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    resource.release();
  });

  it('rejects a declared raster MIME type that does not match the bytes', async () => {
    await expect(createDOMImageResource({
      name: 'Mismatch',
      mimeType: 'image/jpeg',
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    })).rejects.toMatchObject({
      code: 'ASSET_TYPE_MISMATCH',
      expectedKind: 'image/jpeg',
      actualKind: 'image/png'
    });
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
