/**
 * BinauralBeatsPanel — Web Audio binaural beats synthesizer UI
 * 
 * Blueprint: Weeks 3-4 Scientific Focus Engine
 * Creates frequency-following response via stereo audio offsets
 * 
 * Frequencies:
 * - Beta (18Hz): Active focus, alertness
 * - Alpha (10Hz): Flow state, relaxed focus
 * - Theta (6Hz): Deep meditation, creativity
 * - Delta (2Hz): Deep rest, recovery
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Headphones, Volume2, VolumeX, Waves } from 'lucide-react';
import { binauralSynth, type BinauralFrequency } from '@/lib/binauralBeats';

const FREQUENCIES: { value: BinauralFrequency; label: string; icon: string; color: string; desc: string }[] = [
  { value: 'beta',  label: 'Focus',  icon: '⚡', color: 'var(--palette-rose-400)',    desc: '18Hz — Active concentration' },
  { value: 'alpha', label: 'Flow',   icon: '🌊', color: 'var(--palette-emerald-400)', desc: '10Hz — Relaxed flow state' },
  { value: 'theta', label: 'Create', icon: '🎨', color: 'var(--palette-violet-400)',  desc: '6Hz — Creative thinking' },
  { value: 'delta', label: 'Rest',   icon: '🌙', color: 'var(--palette-blue-400)',    desc: '2Hz — Deep relaxation' },
];

export default function BinauralBeatsPanel() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedFreq, setSelectedFreq] = useState<BinauralFrequency>('beta');
  const [volume, setVolume] = useState(0.15);
  const [muted, setMuted] = useState(false);
  const prevVolumeRef = useRef(0.15);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      binauralSynth.stop();
      setIsPlaying(false);
    } else {
      await binauralSynth.play(selectedFreq);
      binauralSynth.setVolume(muted ? 0 : volume);
      setIsPlaying(true);
    }
  }, [isPlaying, selectedFreq, volume, muted]);

  const handleFreqChange = useCallback(async (freq: BinauralFrequency) => {
    setSelectedFreq(freq);
    if (isPlaying) {
      await binauralSynth.play(freq);
      binauralSynth.setVolume(muted ? 0 : volume);
    }
  }, [isPlaying, volume, muted]);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    if (!muted) {
      binauralSynth.setVolume(v);
    }
  }, [muted]);

  const toggleMute = useCallback(() => {
    if (muted) {
      binauralSynth.setVolume(prevVolumeRef.current);
      setMuted(false);
    } else {
      prevVolumeRef.current = volume;
      binauralSynth.setVolume(0);
      setMuted(true);
    }
  }, [muted, volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { binauralSynth.stop(); };
  }, []);

  const currentFreqInfo = FREQUENCIES.find(f => f.value === selectedFreq)!;

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/80 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Headphones size={14} className="text-[var(--palette-violet-400)]" />
            <span className="text-xs font-bold text-[var(--palette-zinc-300)]">Binaural Beats</span>
          </div>
          
          {/* Play/Pause + Mute */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="rounded-lg p-1.5 text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)] transition-colors"
            >
              {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>
            <button
              onClick={togglePlay}
              className={`rounded-xl px-3 py-1.5 text-[10px] font-bold transition-all ${
                isPlaying
                  ? 'border border-[var(--palette-rose-500)]/40 bg-[var(--palette-rose-500)]/15 text-[var(--palette-rose-300)]'
                  : 'border border-[var(--palette-violet-500)]/40 bg-[var(--palette-violet-500)]/15 text-[var(--palette-violet-300)]'
              }`}
            >
              {isPlaying ? '⏹ Stop' : '▶ Play'}
            </button>
          </div>
        </div>

        {/* Frequency Selector */}
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {FREQUENCIES.map((freq) => (
            <button
              key={freq.value}
              onClick={() => handleFreqChange(freq.value)}
              className={`rounded-xl border p-2 text-center transition-all ${
                selectedFreq === freq.value
                  ? `border-[var(--palette-zinc-600)] bg-[var(--palette-zinc-800)] ring-1 ring-[${freq.color}]/20`
                  : 'border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/60 hover:border-[var(--palette-zinc-700)]'
              }`}
            >
              <div className="text-lg mb-0.5">{freq.icon}</div>
              <div className="text-[9px] font-bold text-[var(--palette-zinc-400)]">{freq.label}</div>
            </button>
          ))}
        </div>

        {/* Current frequency info */}
        <div className="mb-3 text-center">
          <p className="text-[10px] text-[var(--palette-zinc-500)]">{currentFreqInfo.desc}</p>
        </div>

        {/* Volume slider */}
        <div className="flex items-center gap-2">
          <VolumeX size={10} className="text-[var(--palette-zinc-600)] flex-shrink-0" />
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.01"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="flex-1 h-1 appearance-none rounded-full bg-[var(--palette-zinc-800)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--palette-violet-400)]"
          />
          <Volume2 size={10} className="text-[var(--palette-zinc-600)] flex-shrink-0" />
        </div>

        {/* Waveform animation when playing */}
        {isPlaying && !muted && (
          <motion.div
            className="flex items-center justify-center gap-1 mt-3 h-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="w-0.5 rounded-full bg-[var(--palette-violet-400)]/60"
                animate={{
                  height: [4, 8 + Math.random() * 8, 4],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.8 + Math.random() * 0.5,
                  delay: i * 0.05,
                }}
              />
            ))}
          </motion.div>
        )}

        {/* Note about headphones */}
        <p className="mt-3 text-center text-[9px] text-[var(--palette-zinc-600)]">
          🎧 Use headphones for binaural effect
        </p>
      </div>
    </div>
  );
}
