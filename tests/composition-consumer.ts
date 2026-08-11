import {
  createAssetManagerComposition,
  createBinaryBundleStore,
  createSessionBinaryBacking,
  createVerifiedRemoteCacheDatabaseName,
  type AssetManagerComposition,
  type BinaryBundlePutInput,
  type BinaryBundleRegistration,
  type BinaryBundleResult,
  type BinaryBundleStore,
  type EmbeddedAssetBytesInput,
  type EmbeddedAssetRegistration,
  type ProjectAssetLocator,
  type SessionBinaryBacking,
  type SessionBinaryBackingAssetInput,
  type SessionBinaryBackingSource,
  type VerifiedRemoteBinaryInput,
  type VerifiedRemoteBinaryResult,
  type VerifiedRemoteCacheWarning,
  type VerifiedRemoteStoryCacheDeleteResult,
  type VerifiedRemoteStoryCacheInfo,
  type VerifiedRemoteStoryCachePruneResult
} from '@kubohiroya/turbowarp-asset-manager/composition';

const input: EmbeddedAssetBytesInput = {
  name: 'OpeningImage',
  sourceName: 'opening.svg',
  mimeType: 'image/svg+xml',
  bytes: new Uint8Array([60, 115, 118, 103, 47, 62])
};
const bitmapInput: EmbeddedAssetBytesInput = {
  name: 'RetinaCostume',
  sourceName: 'retina.png',
  mimeType: 'image/png',
  bytes: new Uint8Array([137, 80, 78, 71]),
  bitmapResolution: 2
};
const composition: AssetManagerComposition = createAssetManagerComposition();
const projectLocator: ProjectAssetLocator = {
  kind: 'costume',
  target: ' Actor/\u0001: ',
  name: ' Costume/\u0001: '
};
const projectRegistration: Promise<EmbeddedAssetRegistration> = composition.registerProjectAsset({
  name: ' Costume ID/\u0001: ',
  locator: projectLocator
});
const databaseName: string = createVerifiedRemoteCacheDatabaseName({
  id: 'story-0001',
  label: 'opening.kamishibai.yaml'
});
const registration: Promise<EmbeddedAssetRegistration> = composition.registerEmbeddedAsset(input);
const bitmapRegistration: Promise<EmbeddedAssetRegistration> =
  composition.registerEmbeddedAsset(bitmapInput);
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
const warning: VerifiedRemoteCacheWarning = {
  operation: 'cleanup',
  code: 'ASSET_CACHE_CLEANUP_FAILED'
};
const storyCaches: Promise<ReadonlyArray<VerifiedRemoteStoryCacheInfo>> =
  composition.listVerifiedRemoteStoryCaches();
const storyPrune: Promise<VerifiedRemoteStoryCachePruneResult> =
  composition.pruneVerifiedRemoteStoryCaches();
const storyDelete: Promise<VerifiedRemoteStoryCacheDeleteResult> =
  composition.deleteVerifiedRemoteStoryCache(databaseName);
const storyLeaseRenewal: Promise<void> = composition.renewVerifiedRemoteStoryCacheLease();
const storyLeaseRelease: Promise<void> = composition.releaseVerifiedRemoteStoryCacheLease();
const binaryBundle: BinaryBundlePutInput = {
  namespace: 'story-0001/source-integrity',
  name: 'RescuePose',
  integrity: `sha256-${'1'.repeat(64)}`,
  files: [
    {
      path: 'weights.bin',
      size: 1,
      integrity: `sha256-${'2'.repeat(64)}`,
      bytes: new Uint8Array([0])
    }
  ]
};
const binaryStore: BinaryBundleStore = createBinaryBundleStore();
const binaryRegistration: Promise<BinaryBundleRegistration> = composition.putBinaryBundle(
  binaryBundle
);
const binaryResult: Promise<BinaryBundleResult> = composition.getBinaryBundle(binaryBundle);
const binaryDelete: Promise<void> = composition.deleteBinaryBundle(binaryBundle);
const binaryStoreRelease: Promise<void> = composition.releaseBinaryStore();
const sessionAsset: SessionBinaryBackingAssetInput = {
  namespace: 'story-0001/source-integrity',
  name: 'RescuePose',
  integrity: `sha256-${'3'.repeat(64)}`,
  files: [
    {
      path: 'weights.bin',
      size: 1,
      integrity: `sha256-${'2'.repeat(64)}`
    }
  ]
};
const sessionSource: SessionBinaryBackingSource = {
  async read(asset) {
    return {
      namespace: asset.namespace,
      name: asset.name,
      integrity: asset.integrity,
      files: [{...asset.files[0]!, bytes: new Uint8Array([0])}]
    };
  },
  release() {}
};
const directSession: Promise<SessionBinaryBacking> = createSessionBinaryBacking({
  policy: 'disabled',
  sessionId: 'runtime-session-1',
  assets: [sessionAsset],
  source: sessionSource
});
const compositionSession: Promise<SessionBinaryBacking> = composition.createSessionBinaryBacking({
  policy: 'disabled',
  sessionId: 'runtime-session-2',
  assets: [sessionAsset],
  source: sessionSource
});

void registration;
void bitmapRegistration;
void projectRegistration;
void projectLocator;
void remote;
void warning;
void databaseName;
void storyCaches;
void storyPrune;
void storyDelete;
void storyLeaseRenewal;
void storyLeaseRelease;
void binaryStore;
void binaryRegistration;
void binaryResult;
void binaryDelete;
void binaryStoreRelease;
void directSession;
void compositionSession;
