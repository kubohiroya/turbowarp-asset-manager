export interface AssetManagerFeatureFlags {
  readonly ENABLE_LIVE_ASSET_REPLACEMENT: boolean;
  readonly ENABLE_STRICT_ASSET_KIND_REPLACEMENT: boolean;
  readonly NAMED_ASSET_BODY_PROVIDER: boolean;
}

function configuredFlag(name: keyof AssetManagerFeatureFlags): boolean {
  const configured = globalThis.__TW_ASSET_MANAGER_FEATURE_FLAGS__?.[name];
  return configured === true || configured === 'true';
}

/**
 * Startup-fixed rollout flags. Optional features remain disabled unless a host
 * explicitly configures them before loading the extension bundle.
 */
export const FEATURE_FLAGS: AssetManagerFeatureFlags = Object.freeze({
  ENABLE_LIVE_ASSET_REPLACEMENT: configuredFlag('ENABLE_LIVE_ASSET_REPLACEMENT'),
  ENABLE_STRICT_ASSET_KIND_REPLACEMENT: configuredFlag('ENABLE_STRICT_ASSET_KIND_REPLACEMENT'),
  NAMED_ASSET_BODY_PROVIDER: configuredFlag('NAMED_ASSET_BODY_PROVIDER')
});
