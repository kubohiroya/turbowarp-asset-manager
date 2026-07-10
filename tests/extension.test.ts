import {describe, expect, it} from 'vitest';
import {guessMimeType, normalizeMimeType} from '../src/extension.js';

describe('guessMimeType', () => {
  it('recognizes image and audio extensions', () => {
    expect(guessMimeType('https://example.com/a.PNG?x=1')).toBe('image/png');
    expect(guessMimeType('sound.mp3')).toBe('audio/mpeg');
  });
});

describe('normalizeMimeType', () => {
  it('removes MIME parameters', () => {
    expect(normalizeMimeType('audio/mpeg; charset=binary', 'sound.mp3')).toBe('audio/mpeg');
  });

  it('uses the file extension for generic binary MIME types', () => {
    expect(normalizeMimeType('application/octet-stream', 'image.svg')).toBe('image/svg+xml');
  });
});
