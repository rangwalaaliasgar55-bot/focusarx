/**
 * Ambient Sound Bar - Compact, Expandable Design
 * 
 * Blueprint: Weeks 7-8 3D Gamification
 * 
 * Compact pill when collapsed, expands to show all sounds
 * Smooth animations, minimal footprint
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Music, Wind, Waves, TreePine, Coffee, Flame, X } from "lucide-react";

interface AmbientSound {
  id: string;
  name: string;
  icon: any;
  color: string;
  volume: number;
  active: boolean;
}

const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: "rain", name: "Rain", icon: Waves, color: "#3b82f6", volume: 0.5, active: false },
  { id: "wind", name: "Wind", icon: Wind, color: "#10b981", volume: 0.4, active: false },
  { id: "forest", name: "Forest", icon: TreePine, color: "#22c55e", volume: 0.3, active: false },
  { id: "fire", name: "Fire", icon: Flame, color: "#f97316", volume: 0.6, active: false },
  { id: "cafe", name: "Cafe", icon: Coffee, color: "#a855f7", volume: 0.4, active: false },
];

export default function AmbientSoundBar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sounds, setSounds] = useState<AmbientSound[]>(AMBIENT_SOUNDS);
  const [masterVolume, setMasterVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<Map<string, { osc: OscillatorNode; gain: GainNode }>>(new Map());

  // Initialize audio context
  useEffect(() => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      // Audio not supported
    }

    return () => {
      oscillatorsRef.current.forEach(({ osc }) => {
        try { osc.stop(); } catch {}
      });
      oscillatorsRef.current.clear();
    };
  }, []);

  const toggleSound = (soundId: string) => {
    if (!audioContextRef.current) return;

    setSounds(prev => prev.map(s => {
      if (s.id === soundId) {
        const newActive = !s.active;
        
        if (newActive) {
          // Start sound
          startSound(s.id, s.volume * masterVolume);
        } else {
          // Stop sound
          stopSound(s.id);
        }
        
        return { ...s, active: newActive };
      }
      return s;
    }));
  };

  const startSound = (soundId: string, volume: number) => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Different waveforms for different sounds
    switch (soundId) {
      case "rain":
        osc.type = "sawtooth";
        osc.frequency.value = 200;
        break;
      case "wind":
        osc.type = "sine";
        osc.frequency.value = 150;
        break;
      case "forest":
        osc.type = "triangle";
        osc.frequency.value = 300;
        break;
      case "fire":
        osc.type = "square";
        osc.frequency.value = 100;
        break;
      case "cafe":
        osc.type = "sine";
        osc.frequency.value = 250;
        break;
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = isMuted ? 0 : volume;

    osc.start();
    oscillatorsRef.current.set(soundId, { osc, gain });
  };

  const stopSound = (soundId: string) => {
    const sound = oscillatorsRef.current.get(soundId);
    if (sound) {
      try {
        sound.osc.stop();
        sound.osc.disconnect();
        sound.gain.disconnect();
      } catch {}
      oscillatorsRef.current.delete(soundId);
    }
  };

  const updateSoundVolume = (soundId: string, volume: number) => {
    setSounds(prev => prev.map(s => s.id === soundId ? { ...s, volume } : s));
    
    const sound = oscillatorsRef.current.get(soundId);
    if (sound) {
      sound.gain.gain.value = isMuted ? 0 : volume * masterVolume;
    }
  };

  const toggleMasterMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    oscillatorsRef.current.forEach(({ gain }, id) => {
      const sound = sounds.find(s => s.id === id);
      if (sound) {
        gain.gain.value = newMuted ? 0 : sound.volume * masterVolume;
      }
    });
  };

  const updateMasterVolume = (volume: number) => {
    setMasterVolume(volume);
    
    oscillatorsRef.current.forEach(({ gain }, id) => {
      const sound = sounds.find(s => s.id === id);
      if (sound) {
        gain.gain.value = isMuted ? 0 : sound.volume * volume;
      }
    });
  };

  const activeCount = sounds.filter(s => s.active).length;

  return (
    <div className="relative">
      {/* Compact Pill (Collapsed) */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 rounded-full border border-[var(--forge-border)] bg-[var(--surface-1)] px-4 py-2 text-xs font-bold transition-all hover:border-[var(--brand-400)]/30 hover:bg-[var(--brand-soft)]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {activeCount > 0 ? (
              <>
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                >
                  <Music size={14} className="text-[var(--brand-400)]" />
                </motion.div>
                <span className="text-[var(--brand-400)]">{activeCount} ambient{activeCount !== 1 ? 's' : ''}</span>
              </>
            ) : (
              <>
                <Volume2 size={14} className="text-[var(--foreground-subtle)]" />
                <span className="text-[var(--foreground-muted)]">Add sounds</span>
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            className="w-80 rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--forge-border)] bg-[var(--surface-1)] px-4 py-3 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Music size={16} className="text-[var(--brand-400)]" />
                <h3 className="text-sm font-bold">Ambient Sounds</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMasterMute}
                  className="rounded-lg p-1.5 text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="rounded-lg p-1.5 text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Sound List */}
            <div className="p-4 space-y-3">
              {sounds.map((sound) => {
                const Icon = sound.icon;
                return (
                  <motion.div
                    key={sound.id}
                    layout
                    className={`rounded-xl border p-3 transition-all ${
                      sound.active
                        ? 'border-[var(--brand-400)]/30 bg-[var(--brand-soft)]'
                        : 'border-[var(--forge-border)] bg-[var(--surface-1)]'
                    }`}
                    whileHover={{ scale: 1.01 }}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => toggleSound(sound.id)}
                        className="flex items-center gap-2 flex-1"
                      >
                        <div
                          className="grid h-8 w-8 place-items-center rounded-lg transition-all"
                          style={{
                            background: sound.active ? `${sound.color}20` : 'var(--surface-2)',
                            color: sound.active ? sound.color : 'var(--foreground-subtle)',
                          }}
                        >
                          <Icon size={16} />
                        </div>
                        <span className={`text-xs font-bold ${sound.active ? 'text-[var(--foreground)]' : 'text-[var(--foreground-muted)]'}`}>
                          {sound.name}
                        </span>
                      </button>
                      {sound.active && (
                        <motion.div
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={sound.volume}
                            onChange={(e) => updateSoundVolume(sound.id, parseFloat(e.target.value))}
                            className="w-20 h-1 appearance-none rounded-full bg-[var(--surface-2)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                            style={{
                              background: `linear-gradient(to right, ${sound.color} 0%, ${sound.color} ${sound.volume * 100}%, var(--surface-2) ${sound.volume * 100}%, var(--surface-2) 100%)`
                            }}
                          />
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Master Volume */}
            <div className="border-t border-[var(--forge-border)] bg-[var(--surface-1)] px-4 py-3 rounded-b-2xl">
              <div className="flex items-center gap-3">
                <Volume2 size={14} className="text-[var(--foreground-subtle)]" />
                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={masterVolume}
                    onChange={(e) => updateMasterVolume(parseFloat(e.target.value))}
                    className="w-full h-1.5 appearance-none rounded-full bg-[var(--surface-2)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--brand-400)] [&::-webkit-slider-thumb]:cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, var(--brand-400) 0%, var(--brand-400) ${masterVolume * 100}%, var(--surface-2) ${masterVolume * 100}%, var(--surface-2) 100%)`
                    }}
                  />
                </div>
                <span className="text-[11px] font-bold text-[var(--foreground-subtle)] w-8 text-right">
                  {Math.round(masterVolume * 100)}%
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
