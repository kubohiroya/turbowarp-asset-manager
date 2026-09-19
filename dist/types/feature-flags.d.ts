export interface AssetManagerFeatureFlags {
    readonly ENABLE_LIVE_ASSET_REPLACEMENT: boolean;
    readonly ENABLE_STRICT_ASSET_KIND_REPLACEMENT: boolean;
    readonly NAMED_ASSET_BODY_PROVIDER: boolean;
}
/**
 * Startup-fixed rollout flags. Optional features remain disabled unless a host
 * explicitly configures them before loading the extension bundle.
 */
export declare const FEATURE_FLAGS: AssetManagerFeatureFlags;
