import {
  createAssetManagerComposition,
  type AssetManagerComposition,
  type EmbeddedAssetBytesInput,
  type EmbeddedAssetRegistration,
  type VerifiedRemoteBinaryInput,
  type VerifiedRemoteBinaryResult
} from '@kubohiroya/turbowarp-asset-manager/composition';

const input: EmbeddedAssetBytesInput = {
  name: 'OpeningImage',
  sourceName: 'opening.svg',
  mimeType: 'image/svg+xml',
  bytes: new Uint8Array([60, 115, 118, 103, 47, 62])
};
const composition: AssetManagerComposition = createAssetManagerComposition();
const registration: Promise<EmbeddedAssetRegistration> = composition.registerEmbeddedAsset(input);
const remoteInput: VerifiedRemoteBinaryInput = {
  url: 'https://example.com/model.bin',
  integrity: `sha256-${'0'.repeat(64)}`,
  size: 1,
  contentType: 'application/octet-stream'
};
const remote: Promise<VerifiedRemoteBinaryResult> = composition.resolveVerifiedRemoteBinary(
  remoteInput,
  {
    load: async () => ({
      bytes: new Uint8Array([0]),
      contentType: 'application/octet-stream'
    })
  }
);

void registration;
void remote;
