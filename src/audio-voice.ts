export interface AssetManagerAudioVoice {
  readonly ended: Promise<void>;
  setGain(value: number): void;
  stop(): void;
}

export interface AssetManagerAudioVoiceOptions {
  readonly gain?: number;
}

export function normalizeAudioVoiceGain(value: unknown, label = 'Audio voice gain'): number {
  const gain = value === undefined ? 1 : value;
  if (typeof gain !== 'number' || !Number.isFinite(gain) || gain < 0 || gain > 1) {
    throw new TypeError(`${label} must be a finite number from 0 to 1.`);
  }
  return gain;
}
