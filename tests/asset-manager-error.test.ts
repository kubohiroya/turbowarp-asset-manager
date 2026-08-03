import {describe, expect, it} from 'vitest';
import {
  AssetManagerError,
  suggestNames,
  suggestionHint
} from '../src/asset-manager-error.js';
import {FEATURE_FLAGS} from '../src/feature-flags.js';

describe('AssetManagerError', () => {
  it('keeps both rollout flags disabled by default', () => {
    expect(FEATURE_FLAGS).toEqual({
      ENABLE_LIVE_ASSET_REPLACEMENT: false,
      ENABLE_STRICT_ASSET_KIND_REPLACEMENT: false
    });
  });

  it('keeps stable diagnostic context and the original cause', () => {
    const cause = new Error('network failed');
    const error = new AssetManagerError(
      'REPLACEMENT_FAILED',
      'Cannot replace asset "Narration".',
      {
        operation: 'registerAsset',
        assetName: 'Narration',
        resourceId: 'https://example.com/narration.mp3',
        actorName: 'Prompt',
        expectedKind: 'text',
        actualKind: 'sound',
        hint: 'Delete the old asset first.',
        cause
      }
    );

    expect(error).toMatchObject({
      name: 'AssetManagerError',
      code: 'REPLACEMENT_FAILED',
      operation: 'registerAsset',
      assetName: 'Narration',
      resourceId: 'https://example.com/narration.mp3',
      actorName: 'Prompt',
      expectedKind: 'text',
      actualKind: 'sound',
      hint: 'Delete the old asset first.'
    });
    expect(error.cause).toBe(cause);
    expect(error.message).toContain('[Asset Manager][REPLACEMENT_FAILED]');
  });

  it('prioritizes case-insensitive exact matches, then edit distance, up to three items', () => {
    const candidates = suggestNames(
      'narration',
      ['Narrator', 'Other', 'NARRATION', 'Narration 2', 'Far away']
    );

    expect(candidates).toEqual(['NARRATION', 'Narrator', 'Narration 2']);
    expect(suggestionHint(candidates)).toBe(
      'Did you mean one of: "NARRATION", "Narrator", "Narration 2"?'
    );
  });
});
