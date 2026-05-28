import { useEffect, useRef, useState, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";

type Environment = "forest" | "tokyo_rain" | "space_station" | "ancient_library" | "underground_lab";

interface SoundEngineProps {
  sessionActive: boolean;
  sessionMinutesLeft?: number;
  sessionTotalMinutes?: number;
  onDistracted?: boolean;
}

const ENVS: { id: Environment; label: string; emoji: string }[] = [
  { id: "forest",           label: "Deep Forest",      emoji: "🌲" },
  { id: "tokyo_rain",       label: "Tokyo Rain",        emoji: "🌧" },
  { id: "space_station",    label: "Space Station",     emoji: "🚀" },
  { id: "ancient_library",  label: "Ancient Library",   emoji: "📚" },
  { id: "underground_lab",  label: "Underground Lab",   emoji: "⚗️" },
];

// --- Procedural audio generators ---

function createNoise(ctx: AudioContext): AudioBufferSourceNode {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

function createOscillator(ctx: AudioContext, freq: number, type: OscillatorType = "sine"): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  return osc;
}

function createFilter(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, ctx.currentTime);
  f.Q.setValueAtTime(q, ctx.currentTime);
  return f;
}

// Environment-specific sound builders
function buildForest(ctx: AudioContext, masterGain: GainNode) {
  // Layer 1: Wind (filtered noise)
  const wind = createNoise(ctx);
  const windFilter = createFilter(ctx, "bandpass", 400, 0.5);
  const windGain = ctx.createGain();
  windGain.gain.setValueAtTime(0.06, ctx.currentTime);
  wind.connect(windFilter).connect(windGain).connect(masterGain);
  wind.start();

  // Layer 2: Low drone
  const drone = createOscillator(ctx, 80, "sine");
  const droneGain = ctx.createGain();
  droneGain.gain.setValueAtTime(0.03, ctx.currentTime);
  drone.connect(droneGain).connect(masterGain);
  drone.start();

  // Layer 3: High frequency crickets (amplitude-modulated noise)
  const crickets = createNoise(ctx);
  const cricketFilter = createFilter(ctx, "highpass", 3000, 2);
  const cricketGain = ctx.createGain();
  cricketGain.gain.setValueAtTime(0.015, ctx.currentTime);
  crickets.connect(cricketFilter).connect(cricketGain).connect(masterGain);
  crickets.start();

  return {
    stop: () => { try { wind.stop(); drone.stop(); crickets.stop(); } catch { /* already stopped */ } },
    rhythmGain: droneGain,
    ambientGain: windGain,
  };
}

function buildTokyoRain(ctx: AudioContext, masterGain: GainNode) {
  // Layer 1: Rain (white noise lowpass)
  const rain = createNoise(ctx);
  const rainFilter = createFilter(ctx, "lowpass", 2000);
  const rainGain = ctx.createGain();
  rainGain.gain.setValueAtTime(0.12, ctx.currentTime);
  rain.connect(rainFilter).connect(rainGain).connect(masterGain);
  rain.start();

  // Layer 2: Street hum
  const hum = createOscillator(ctx, 50, "sawtooth");
  const humFilter = createFilter(ctx, "lowpass", 150);
  const humGain = ctx.createGain();
  humGain.gain.setValueAtTime(0.02, ctx.currentTime);
  hum.connect(humFilter).connect(humGain).connect(masterGain);
  hum.start();

  // Layer 3: High rain hits
  const mist = createNoise(ctx);
  const mistFilter = createFilter(ctx, "highpass", 5000, 0.5);
  const mistGain = ctx.createGain();
  mistGain.gain.setValueAtTime(0.02, ctx.currentTime);
  mist.connect(mistFilter).connect(mistGain).connect(masterGain);
  mist.start();

  return {
    stop: () => { try { rain.stop(); hum.stop(); mist.stop(); } catch { /* stopped */ } },
    rhythmGain: humGain,
    ambientGain: rainGain,
  };
}

function buildSpaceStation(ctx: AudioContext, masterGain: GainNode) {
  // Layer 1: Ventilation hum
  const vent = createNoise(ctx);
  const ventFilter = createFilter(ctx, "bandpass", 200, 2);
  const ventGain = ctx.createGain();
  ventGain.gain.setValueAtTime(0.04, ctx.currentTime);
  vent.connect(ventFilter).connect(ventGain).connect(masterGain);
  vent.start();

  // Layer 2: Electronic pulse
  const pulse = createOscillator(ctx, 220, "square");
  const pulseFilter = createFilter(ctx, "lowpass", 400);
  const pulseGain = ctx.createGain();
  pulseGain.gain.setValueAtTime(0.01, ctx.currentTime);
  pulse.connect(pulseFilter).connect(pulseGain).connect(masterGain);
  pulse.start();

  // Layer 3: Deep space tone
  const space = createOscillator(ctx, 40, "sine");
  const spaceGain = ctx.createGain();
  spaceGain.gain.setValueAtTime(0.04, ctx.currentTime);
  space.connect(spaceGain).connect(masterGain);
  space.start();

  return {
    stop: () => { try { vent.stop(); pulse.stop(); space.stop(); } catch { /* stopped */ } },
    rhythmGain: pulseGain,
    ambientGain: ventGain,
  };
}

function buildAncientLibrary(ctx: AudioContext, masterGain: GainNode) {
  // Layer 1: Room tone
  const room = createNoise(ctx);
  const roomFilter = createFilter(ctx, "bandpass", 300, 0.3);
  const roomGain = ctx.createGain();
  roomGain.gain.setValueAtTime(0.025, ctx.currentTime);
  room.connect(roomFilter).connect(roomGain).connect(masterGain);
  room.start();

  // Layer 2: Fireplace crackle
  const fire = createNoise(ctx);
  const fireFilter = createFilter(ctx, "bandpass", 800, 1);
  const fireGain = ctx.createGain();
  fireGain.gain.setValueAtTime(0.03, ctx.currentTime);
  fire.connect(fireFilter).connect(fireGain).connect(masterGain);
  fire.start();

  // Layer 3: Deep wooden tone
  const wood = createOscillator(ctx, 60, "sine");
  const woodGain = ctx.createGain();
  woodGain.gain.setValueAtTime(0.015, ctx.currentTime);
  wood.connect(woodGain).connect(masterGain);
  wood.start();

  return {
    stop: () => { try { room.stop(); fire.stop(); wood.stop(); } catch { /* stopped */ } },
    rhythmGain: fireGain,
    ambientGain: roomGain,
  };
}

function buildUndergroundLab(ctx: AudioContext, masterGain: GainNode) {
  // Layer 1: Industrial hum
  const hum = createNoise(ctx);
  const humFilter = createFilter(ctx, "bandpass", 120, 3);
  const humGain = ctx.createGain();
  humGain.gain.setValueAtTime(0.06, ctx.currentTime);
  hum.connect(humFilter).connect(humGain).connect(masterGain);
  hum.start();

  // Layer 2: Electronic tone
  const elec = createOscillator(ctx, 180, "sawtooth");
  const elecFilter = createFilter(ctx, "lowpass", 300);
  const elecGain = ctx.createGain();
  elecGain.gain.setValueAtTime(0.012, ctx.currentTime);
  elec.connect(elecFilter).connect(elecGain).connect(masterGain);
  elec.start();

  // Layer 3: Sub bass
  const sub = createOscillator(ctx, 35, "sine");
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.05, ctx.currentTime);
  sub.connect(subGain).connect(masterGain);
  sub.start();

  return {
    stop: () => { try { hum.stop(); elec.stop(); sub.stop(); } catch { /* stopped */ } },
    rhythmGain: elecGain,
    ambientGain: humGain,
  };
}

const BUILDERS: Record<Environment, (ctx: AudioContext, master: GainNode) => { stop: () => void; rhythmGain: GainNode; ambientGain: GainNode }> = {
  forest:          buildForest,
  tokyo_rain:      buildTokyoRain,
  space_station:   buildSpaceStation,
  ancient_library: buildAncientLibrary,
  underground_lab: buildUndergroundLab,
};

export function SoundEngine({ sessionActive, sessionMinutesLeft, sessionTotalMinutes, onDistracted }: SoundEngineProps) {
  const [env, setEnv] = useState<Environment>("forest");
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const soundRef = useRef<{ stop: () => void; rhythmGain: GainNode; ambientGain: GainNode } | null>(null);
  const reentryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopSounds = useCallback(() => {
    soundRef.current?.stop();
    soundRef.current = null;
  }, []);

  const startSounds = useCallback((environment: Environment) => {
    if (!ctxRef.current || !masterGainRef.current) return;
    stopSounds();
    try {
      soundRef.current = BUILDERS[environment](ctxRef.current, masterGainRef.current);
    } catch { /* audio not supported */ }
  }, [stopSounds]);

  // Enable/disable audio
  useEffect(() => {
    if (enabled) {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext();
        masterGainRef.current = ctxRef.current.createGain();
        masterGainRef.current.gain.setValueAtTime(0.8, ctxRef.current.currentTime);
        masterGainRef.current.connect(ctxRef.current.destination);
      }
      ctxRef.current.resume().catch(() => {});
      startSounds(env);
    } else {
      stopSounds();
      ctxRef.current?.suspend().catch(() => {});
    }
    return stopSounds;
  }, [enabled]);

  // Change environment
  useEffect(() => {
    if (enabled && ctxRef.current) startSounds(env);
  }, [env]);

  // Focus intensifier — boost in final 10 min
  useEffect(() => {
    if (!masterGainRef.current || !ctxRef.current || !enabled) return;
    const isInFinalStretch = sessionMinutesLeft != null && sessionMinutesLeft <= 10 && sessionMinutesLeft > 0;
    const target = isInFinalStretch ? 1.0 : 0.8;
    masterGainRef.current.gain.linearRampToValueAtTime(target, ctxRef.current.currentTime + 2);
  }, [sessionMinutesLeft, enabled]);

  // Re-entry fade when distracted
  useEffect(() => {
    if (!onDistracted || !masterGainRef.current || !ctxRef.current || !enabled) return;
    if (reentryTimeoutRef.current) clearTimeout(reentryTimeoutRef.current);
    masterGainRef.current.gain.linearRampToValueAtTime(0.1, ctxRef.current.currentTime + 0.5);
    reentryTimeoutRef.current = setTimeout(() => {
      if (masterGainRef.current && ctxRef.current) {
        masterGainRef.current.gain.linearRampToValueAtTime(0.8, ctxRef.current.currentTime + 8);
      }
    }, 500);
  }, [onDistracted, enabled]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopSounds();
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition-all ${enabled ? "border-[rgba(124,58,237,0.4)] bg-[rgba(124,58,237,0.1)] text-[#A78BFA]" : "border-[rgba(124,58,237,0.15)] text-[#4B5563] hover:text-[#94A3B8]"}`}
        title="Sound Engine"
      >
        {enabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
        <span className="hidden sm:inline">{enabled ? ENVS.find((e) => e.id === env)?.emoji : "Sound"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl border border-[rgba(124,58,237,0.25)] bg-[rgba(8,12,28,0.97)] p-3 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-[#4B5563]">Sound Engine</p>
            <button
              onClick={() => setEnabled((v) => !v)}
              className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-colors ${enabled ? "bg-[rgba(124,58,237,0.2)] text-[#A78BFA]" : "bg-[rgba(74,222,128,0.1)] text-[#4ADE80]"}`}
            >
              {enabled ? "On" : "Off"}
            </button>
          </div>
          <div className="space-y-1">
            {ENVS.map((e) => (
              <button
                key={e.id}
                onClick={() => { setEnv(e.id); if (!enabled) setEnabled(true); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition-all ${env === e.id && enabled ? "bg-[rgba(124,58,237,0.15)] text-[#A78BFA]" : "text-[#94A3B8] hover:bg-[rgba(124,58,237,0.08)]"}`}
              >
                <span>{e.emoji}</span>
                <span>{e.label}</span>
                {env === e.id && enabled && <span className="ml-auto text-[9px] text-[#7C3AED]">● LIVE</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
