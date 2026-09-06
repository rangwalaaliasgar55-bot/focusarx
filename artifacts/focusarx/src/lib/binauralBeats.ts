/**
 * Binaural Beats Synthesizer
 * Creates frequency-following response (FFR) via stereo audio offsets
 * 
 * Beta (13-30 Hz): Active focus, alertness
 * Alpha (8-13 Hz): Relaxed focus, flow state
 * Theta (4-8 Hz): Deep meditation, creativity
 * Delta (0.5-4 Hz): Deep sleep, recovery
 */

export type BinauralFrequency = 'beta' | 'alpha' | 'theta' | 'delta';

interface BinauralState {
  frequency: BinauralFrequency;
  isPlaying: boolean;
  volume: number;
}

const FREQUENCY_MAP: Record<BinauralFrequency, { base: number; offset: number; label: string }> = {
  beta:  { base: 200, offset: 18, label: 'Beta (18Hz) — Active Focus' },
  alpha: { base: 200, offset: 10, label: 'Alpha (10Hz) — Flow State' },
  theta: { base: 180, offset: 6,  label: 'Theta (6Hz) — Deep Meditation' },
  delta: { base: 160, offset: 2,  label: 'Delta (2Hz) — Deep Rest' },
};

class BinauralSynthesizer {
  private audioContext: AudioContext | null = null;
  private leftOsc: OscillatorNode | null = null;
  private rightOsc: OscillatorNode | null = null;
  private leftGain: GainNode | null = null;
  private rightGain: GainNode | null = null;
  private merger: ChannelMergerNode | null = null;
  private masterGain: GainNode | null = null;
  private state: BinauralState = {
    frequency: 'beta',
    isPlaying: false,
    volume: 0.15,
  };

  async init() {
    if (this.audioContext) return;
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.state.volume;
      this.masterGain.connect(this.audioContext.destination);
      
      // Stereo merger for binaural effect
      this.merger = this.audioContext.createChannelMerger(2);
      this.merger.connect(this.masterGain);
    } catch {
      // AudioContext not available — silently skip
    }
  }

  async play(frequency: BinauralFrequency = 'beta') {
    await this.init();
    if (!this.audioContext || !this.merger || !this.masterGain) return;

    // Stop any existing oscillators
    this.stop();

    const { base, offset } = FREQUENCY_MAP[frequency];

    // Create left and right oscillators with slight frequency difference
    this.leftOsc = this.audioContext.createOscillator();
    this.rightOsc = this.audioContext.createOscillator();

    this.leftGain = this.audioContext.createGain();
    this.rightGain = this.audioContext.createGain();

    // Left ear: base frequency
    this.leftOsc.frequency.value = base;
    this.leftOsc.type = 'sine';
    this.leftGain.gain.value = 0.5;

    // Right ear: base + offset (creates binaural beat)
    this.rightOsc.frequency.value = base + offset;
    this.rightOsc.type = 'sine';
    this.rightGain.gain.value = 0.5;

    // Connect to stereo merger
    this.leftOsc.connect(this.leftGain);
    this.rightOsc.connect(this.rightGain);
    
    this.leftGain.connect(this.merger, 0, 0); // Left channel
    this.rightGain.connect(this.merger, 0, 1); // Right channel

    // Start oscillators
    this.leftOsc.start();
    this.rightOsc.start();

    this.state.frequency = frequency;
    this.state.isPlaying = true;
  }

  stop() {
    if (this.leftOsc) {
      this.leftOsc.stop();
      this.leftOsc.disconnect();
      this.leftOsc = null;
    }
    if (this.rightOsc) {
      this.rightOsc.stop();
      this.rightOsc.disconnect();
      this.rightOsc = null;
    }
    if (this.leftGain) {
      this.leftGain.disconnect();
      this.leftGain = null;
    }
    if (this.rightGain) {
      this.rightGain.disconnect();
      this.rightGain = null;
    }
    this.state.isPlaying = false;
  }

  setVolume(volume: number) {
    this.state.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.state.volume;
    }
  }

  getFrequency() {
    return this.state.frequency;
  }

  isPlaying() {
    return this.state.isPlaying;
  }

  getFrequencyInfo() {
    return FREQUENCY_MAP[this.state.frequency];
  }

  static getFrequencies() {
    return FREQUENCY_MAP;
  }
}

// Singleton instance
export const binauralSynth = new BinauralSynthesizer();
