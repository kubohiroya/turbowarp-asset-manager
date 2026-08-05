export interface AssetManagerFeatureFlags {
    readonly ENABLE_LIVE_ASSET_REPLACEMENT: boolean;
    readonly ENABLE_STRICT_ASSET_KIND_REPLACEMENT: boolean;
}
/**
 * Startup-fixed rollout flags. Both features remain disabled unless a host
 * explicitly configures them before loading the extension bundle.
 */
export declare const FEATURE_FLAGS: AssetManagerFeatureFlags;
