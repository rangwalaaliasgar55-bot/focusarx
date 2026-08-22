import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music2, VolumeX, Volume2, ChevronDown, ChevronUp } from "lucide-react";

type SoundId = "rain" | "ocean" | "forest" | "storm" | "whitenoise" | "cafe";

interface SoundDef {
  id: SoundId;
  label: string;
  emoji: string;
  color: string;
}

const SOUNDS: SoundDef[] = [
  { id: "rain",       label: "Rain",         emoji: "🌧️", color: "var(--info)" },
  { id: "ocean",      label: "Ocean",        emoji: "🌊", color: "var(--palette-0ea5e9)" },
  { id: "forest",     label: "Forest",       emoji: "🌲", color: "var(--color-success)" },
  { id: "storm",      label: "Storm",        emoji: "⛈️", color: "var(--brand-500)" },
  { id: "whitenoise", label: "White Noise",  emoji: "🌫️", color: "var(--foreground-muted)" },
  { id: "cafe",       label: "Café Hum",     emoji: "☕", color: "var(--palette-d97706)" },
];

// ── Web Audio procedural sound generators ──────────────────────────
function createAudioCtx() {
  return new (window.AudioContext || (window as any).webkitAudioContext)();
}

function buildRainNode(ctx: AudioContext): AudioNode {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.7;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lo = ctx.createBiquadFilter();
  lo.type = "lowpass"; lo.frequency.value = 3500; lo.Q.value = 0.3;
  const hi = ctx.createBiquadFilter();
  hi.type = "highpass"; hi.frequency.value = 400;
  src.connect(lo); lo.connect(hi);
  src.start();
  return hi;
}

function buildOceanNode(ctx: AudioContext): AudioNode {
  const master = ctx.createGain();
  const rate = 0.1;
  const osc = ctx.createOscillator();
  osc.frequency.value = rate;
  const oscGain = ctx.createGain();
  oscGain.gain.value = 0;
  osc.connect(oscGain.gain);
  osc.start();

  const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass"; filter.frequency.value = 600; filter.Q.value = 0.5;
  src.connect(filter); filter.connect(oscGain); oscGain.connect(master);
  src.start();
  return master;
}

function buildForestNode(ctx: AudioContext): AudioNode {
  const master = ctx.createGain();
  // Wind
  const wBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const wd = wBuf.getChannelData(0);
  for (let i = 0; i < wd.length; i++) wd[i] = (Math.random() * 2 - 1) * 0.3;
  const wSrc = ctx.createBufferSource();
  wSrc.buffer = wBuf; wSrc.loop = true;
  const wFilt = ctx.createBiquadFilter();
  wFilt.type = "lowpass"; wFilt.frequency.value = 500;
  wSrc.connect(wFilt); wFilt.connect(master);
  wSrc.start();
  // Birds — short chirp pattern
  const chirp = () => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2400 + Math.random() * 1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(3200 + Math.random() * 800, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    osc.connect(g); g.connect(master);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
    setTimeout(chirp, 800 + Math.random() * 3200);
  };
  setTimeout(chirp, 500);
  return master;
}

function buildStormNode(ctx: AudioContext): AudioNode {
  const master = ctx.createGain();
  // Heavy rain
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const lo = ctx.createBiquadFilter(); lo.type = "lowpass"; lo.frequency.value = 4000;
  const hi = ctx.createBiquadFilter(); hi.type = "highpass"; hi.frequency.value = 200;
  src.connect(lo); lo.connect(hi); hi.connect(master); src.start();
  // Thunder rumble
  const thunder = () => {
    const g = ctx.createGain();
    const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = 30;
    const filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 80;
    const dur = 1.5 + Math.random();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(filt); filt.connect(g); g.connect(master);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
    setTimeout(thunder, 8000 + Math.random() * 15000);
  };
  setTimeout(thunder, 3000);
  return master;
}

function buildWhiteNoiseNode(ctx: AudioContext): AudioNode {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true; src.start();
  return src;
}

function buildCafeNode(ctx: AudioContext): AudioNode {
  const master = ctx.createGain();
  // Low murmur
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const filt = ctx.createBiquadFilter(); filt.type = "bandpass"; filt.frequency.value = 300; filt.Q.value = 0.8;
  src.connect(filt); filt.connect(master); src.start();
  // Coffee cup + keyboard sounds
  const click = () => {
    const g = ctx.createGain();
    const osc = ctx.createOscillator(); osc.type = "square"; osc.frequency.value = 1200;
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 800;
    g.gain.setValueAtTime(0.02, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
    osc.connect(f); f.connect(g); g.connect(master);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.05);
    setTimeout(click, 200 + Math.random() * 600);
  };
  setTimeout(click, 1000);
  return master;
}

const BUILDERS: Record<SoundId, (ctx: AudioContext) => AudioNode> = {
  rain:       buildRainNode,
  ocean:      buildOceanNode,
  forest:     buildForestNode,
  storm:      buildStormNode,
  whitenoise: buildWhiteNoiseNode,
  cafe:       buildCafeNode,
};

interface ActiveSound {
  id: SoundId;
  gainNode: GainNode;
  volume: number;
}

interface Props {
  visible?: boolean;
}

const STORAGE_KEY = "focusarx_sounds";

function loadSavedPrefs(): { sounds: Array<{ id: SoundId; volume: number }> } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as { sounds: Array<{ id: SoundId; volume: number }> };
  } catch {}
  return { sounds: [] };
}

function saveSoundPrefs(sounds: Array<{ id: SoundId; volume: number }>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ sounds })); } catch {}
}

export default function AmbientSoundBar({ visible = true }: Props) {
  const ctxRef = useRef<AudioContext | null>(null);
  const activeSoundsRef = useRef<Map<SoundId, { gainNode: GainNode; source: AudioNode }>>(new Map());
  const [activeSounds, setActiveSounds] = useState<ActiveSound[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = createAudioCtx();
      setInitialized(true);
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Fade on visibility change
  useEffect(() => {
    if (!initialized) return;
    activeSoundsRef.current.forEach(({ gainNode }) => {
      gainNode.gain.cancelScheduledValues(ctxRef.current!.currentTime);
      if (visible) {
        gainNode.gain.linearRampToValueAtTime(
          activeSounds.find((s) => s.id === gainNode as any)?.volume ?? 0.5,
          ctxRef.current!.currentTime + 1
        );
      } else {
        gainNode.gain.linearRampToValueAtTime(0, ctxRef.current!.currentTime + 1);
      }
    });
  }, [visible, initialized]);

  const playSound = useCallback((id: SoundId) => {
    if (activeSounds.length >= 2 && !activeSounds.find((s) => s.id === id)) return;
    if (activeSoundsRef.current.has(id)) return; // already playing

    const ctx = getCtx();
    const sourceNode = BUILDERS[id](ctx);
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1);
    sourceNode.connect(gainNode);
    gainNode.connect(ctx.destination);
    activeSoundsRef.current.set(id, { gainNode, source: sourceNode });

    setActiveSounds((prev) => {
      const next = [...prev.filter((s) => s.id !== id), { id, gainNode, volume: 0.5 }];
      saveSoundPrefs(next.map((s) => ({ id: s.id, volume: s.volume })));
      return next;
    });
  }, [activeSounds, getCtx]);

  const stopSound = useCallback((id: SoundId) => {
    const entry = activeSoundsRef.current.get(id);
    if (!entry) return;
    const ctx = ctxRef.current!;
    entry.gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    setTimeout(() => {
      try { entry.gainNode.disconnect(); } catch {}
      try { (entry.source as any).stop?.(); } catch {}
      activeSoundsRef.current.delete(id);
    }, 600);
    setActiveSounds((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSoundPrefs(next.map((s) => ({ id: s.id, volume: s.volume })));
      return next;
    });
  }, []);

  const toggleSound = useCallback((id: SoundId) => {
    if (activeSoundsRef.current.has(id)) {
      stopSound(id);
    } else {
      playSound(id);
    }
  }, [playSound, stopSound]);

  const setVolume = useCallback((id: SoundId, vol: number) => {
    const entry = activeSoundsRef.current.get(id);
    if (!entry) return;
    entry.gainNode.gain.linearRampToValueAtTime(vol, ctxRef.current!.currentTime + 0.1);
    setActiveSounds((prev) => {
      const next = prev.map((s) => s.id === id ? { ...s, volume: vol } : s);
      saveSoundPrefs(next.map((s) => ({ id: s.id, volume: s.volume })));
      return next;
    });
  }, []);

  const stopAll = () => {
    activeSounds.forEach((s) => stopSound(s.id));
  };

  if (!visible) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 28 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[var(--z-nav)] w-[calc(100%-2rem)] max-w-md"
    >
      <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_25)] bg-[var(--rgba-12-17-40-0_92)] backdrop-blur-xl shadow-[0_8px_40px_var(--rgba-0-0-0-0_4)]">
        {/* Header row */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Music2 size={13} className="text-[var(--brand-400)]" />
            <span className="text-xs font-semibold text-[var(--foreground-muted)]">Ambient Sounds</span>
            {activeSounds.length > 0 && (
              <span className="rounded-full bg-[var(--rgba-124-58-237-0_2)] px-2 py-0.5 text-[9px] font-semibold text-[var(--brand-400)]">
                {activeSounds.length} playing
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeSounds.length > 0 && (
              <button onClick={stopAll} className="text-[10px] text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors">
                Stop all
              </button>
            )}
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? "Collapse ambient sounds" : "Expand ambient sounds"}
              className="grid h-11 w-11 place-items-center rounded-[var(--radius-md)] text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground-muted)]"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>

        {/* Sound grid */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {SOUNDS.map((sound) => {
                    const isActive = activeSounds.some((s) => s.id === sound.id);
                    const isDisabled = activeSounds.length >= 2 && !isActive;
                    return (
                      <button
                        key={sound.id}
                        onClick={() => !isDisabled && toggleSound(sound.id)}
                        disabled={isDisabled}
                        className={`rounded-xl border p-2.5 text-center transition-all ${
                          isActive
                            ? "border-[var(--rgba-124-58-237-0_4)] bg-[var(--rgba-124-58-237-0_15)]"
                            : isDisabled
                            ? "border-[var(--rgba-124-58-237-0_06)] bg-transparent opacity-40 cursor-not-allowed"
                            : "border-[var(--rgba-124-58-237-0_1)] bg-[var(--rgba-124-58-237-0_04)] hover:bg-[var(--rgba-124-58-237-0_09)]"
                        }`}
                      >
                        <span className="text-base">{sound.emoji}</span>
                        <p className={`text-[9px] mt-0.5 font-medium ${isActive ? "text-[var(--brand-400)]" : "text-[var(--palette-6b7280)]"}`}>
                          {sound.label}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Volume sliders for active sounds */}
                {activeSounds.map((s) => {
                  const def = SOUNDS.find((sd) => sd.id === s.id)!;
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="text-sm w-6 shrink-0 text-center">{def.emoji}</span>
                      <VolumeX size={11} className="text-[var(--foreground-subtle)] shrink-0" />
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={s.volume}
                        onChange={(e) => setVolume(s.id, parseFloat(e.target.value))}
                        className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, ${def.color} 0%, ${def.color} ${s.volume * 100}%, var(--rgba-124-58-237-0_12) ${s.volume * 100}%, var(--rgba-124-58-237-0_12) 100%)`,
                        }}
                      />
                      <Volume2 size={11} className="text-[var(--foreground-subtle)] shrink-0" />
                    </div>
                  );
                })}

                {activeSounds.length === 0 && (
                  <p className="text-center text-[10px] text-[var(--foreground-subtle)]">Tap a sound to begin. Layer up to 2.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mini indicator when collapsed */}
        {!expanded && activeSounds.length > 0 && (
          <div className="flex items-center gap-2 px-4 pb-2.5">
            {activeSounds.map((s) => {
              const def = SOUNDS.find((sd) => sd.id === s.id)!;
              return (
                <div key={s.id} className="flex items-center gap-1.5 flex-1">
                  <span className="text-sm">{def.emoji}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={s.volume}
                    onChange={(e) => setVolume(s.id, parseFloat(e.target.value))}
                    className="flex-1 h-0.5 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${def.color} 0%, ${def.color} ${s.volume * 100}%, var(--rgba-124-58-237-0_1) ${s.volume * 100}%, var(--rgba-124-58-237-0_1) 100%)`,
                    }}
                  />
                  <button onClick={() => stopSound(s.id)} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors">
                    <VolumeX size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
