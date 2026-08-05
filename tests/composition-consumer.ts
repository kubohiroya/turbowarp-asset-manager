import {
  createAssetManagerComposition,
  type AssetManagerComposition,
  type EmbeddedAssetBytesInput,
  type EmbeddedAssetRegistration
} from '@kubohiroya/turbowarp-asset-manager/composition';

const input: EmbeddedAssetBytesInput = {
  name: 'OpeningImage',
  sourceName: 'opening.svg',
  mimeType: 'image/svg+xml',
  bytes: new Uint8Array([60, 115, 118, 103, 47, 62])
};
const composition: AssetManagerComposition = createAssetManagerComposition();
const registration: Promise<EmbeddedAssetRegistration> = composition.registerEmbeddedAsset(input);

void registration;
