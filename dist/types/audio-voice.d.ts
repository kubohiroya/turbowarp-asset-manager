export interface AssetManagerAudioVoice {
    readonly ended: Promise<void>;
    setGain(value: number): void;
    stop(): void;
}
export interface AssetManagerAudioVoiceOptions {
    readonly gain?: number;
}
export declare function normalizeAudioVoiceGain(value: unknown, label?: string): number;
