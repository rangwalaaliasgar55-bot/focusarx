import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Users, Volume2, VolumeX, Play, Square, Headphones } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";

// ---- Audio Engine ----
type AudioTrackId = "whitenoise" | "binaural" | "rain" | "lofi" | "forest" | "coffee";

interface TrackDef {
  id: AudioTrackId;
  name: string;
  description: string;
  icon: string;
  color: string;
}

const TRACKS: TrackDef[] = [
  { id: "whitenoise", name: "White Noise",    description: "Pure focus frequency",   icon: "〰️", color: "var(--foreground-muted)" },
  { id: "binaural",   name: "Deep Focus",     description: "Binaural beats 40Hz",    icon: "🧠", color: "var(--brand-400)" },
  { id: "rain",       name: "Rain & Thunder", description: "Calming rain ambience",   icon: "🌧️", color: "var(--info)" },
  { id: "lofi",       name: "Lo-Fi Static",   description: "Warm analog texture",    icon: "🎵", color: "var(--color-warning)" },
  { id: "forest",     name: "Forest",         description: "Nature sounds & birds",   icon: "🌿", color: "var(--palette-4ade80)" },
  { id: "coffee",     name: "Coffee Shop",    description: "Ambient café noise",     icon: "☕", color: "var(--palette-d97706)" },
];

const USER_AVATAR_COLORS = [
  "var(--brand-600)",
  "var(--info)",
  "var(--success)",
  "var(--warning)",
  "var(--brand-pink)",
];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private nodes: Map<AudioTrackId, AudioNode[]> = new Map();
  private gains: Map<AudioTrackId, GainNode> = new Map();

  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private createWhiteNoise(ctx: AudioContext, gainNode: GainNode) {
    const bufSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(gainNode);
    src.start();
    return [src];
  }

  private createBinaural(ctx: AudioContext, gainNode: GainNode) {
    const merger = ctx.createChannelMerger(2);
    merger.connect(gainNode);

    const freqBase = 200;
    const beatFreq = 40;

    const left = ctx.createOscillator();
    const right = ctx.createOscillator();
    const leftGain = ctx.createGain();
    const rightGain = ctx.createGain();
    leftGain.gain.value = 0.25;
    rightGain.gain.value = 0.25;

    left.frequency.value = freqBase;
    right.frequency.value = freqBase + beatFreq;
    left.type = "sine";
    right.type = "sine";

    left.connect(leftGain);
    right.connect(rightGain);
    leftGain.connect(merger, 0, 0);
    rightGain.connect(merger, 0, 1);

    left.start();
    right.start();
    return [left, right, leftGain, rightGain, merger];
  }

  private createRain(ctx: AudioContext, gainNode: GainNode) {
    const bufSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Pink noise approximation
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;
    filter.Q.value = 0.5;

    src.connect(filter);
    filter.connect(gainNode);
    src.start();
    return [src, filter];
  }

  private createLofi(ctx: AudioContext, gainNode: GainNode) {
    const bufSize = ctx.sampleRate;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.12;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 400;
    filter.Q.value = 0.8;

    src.connect(filter);
    filter.connect(gainNode);
    src.start();
    return [src, filter];
  }

  private createForest(ctx: AudioContext, gainNode: GainNode) {
    const nodes: AudioNode[] = [];
    // Background: filtered noise
    const bufSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * 0.04;
    const bg = ctx.createBufferSource();
    bg.buffer = buf;
    bg.loop = true;
    const bgFilter = ctx.createBiquadFilter();
    bgFilter.type = "bandpass";
    bgFilter.frequency.value = 1200;
    bgFilter.Q.value = 0.4;
    bg.connect(bgFilter);
    bgFilter.connect(gainNode);
    bg.start();
    nodes.push(bg, bgFilter);

    // Bird chirps (oscillators)
    const birdFreqs = [2000, 2400, 1800, 2800];
    birdFreqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.frequency.value = f;
      osc.type = "sine";
      oscGain.gain.value = 0;
      osc.connect(oscGain);
      oscGain.connect(gainNode);
      osc.start();

      const chirp = () => {
        const now = ctx.currentTime;
        oscGain.gain.setValueAtTime(0, now);
        oscGain.gain.linearRampToValueAtTime(0.03, now + 0.05);
        oscGain.gain.linearRampToValueAtTime(0, now + 0.25);
        setTimeout(chirp, 2000 + i * 800 + Math.random() * 3000);
      };
      setTimeout(chirp, i * 500 + Math.random() * 1000);
      nodes.push(osc, oscGain);
    });

    return nodes;
  }

  private createCoffee(ctx: AudioContext, gainNode: GainNode) {
    const bufSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Brown noise approximation
    let lastOut = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i]!;
      data[i]! *= 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "peaking";
    filter.frequency.value = 800;
    filter.Q.value = 1;
    filter.gain.value = 6;
    src.connect(filter);
    filter.connect(gainNode);
    src.start();
    return [src, filter];
  }

  play(id: AudioTrackId, volume: number) {
    if (this.nodes.has(id)) return;
    const ctx = this.getCtx();
    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;
    gainNode.connect(ctx.destination);
    this.gains.set(id, gainNode);

    let nodes: AudioNode[];
    switch (id) {
      case "whitenoise": nodes = this.createWhiteNoise(ctx, gainNode); break;
      case "binaural":   nodes = this.createBinaural(ctx, gainNode); break;
      case "rain":       nodes = this.createRain(ctx, gainNode); break;
      case "lofi":       nodes = this.createLofi(ctx, gainNode); break;
      case "forest":     nodes = this.createForest(ctx, gainNode); break;
      case "coffee":     nodes = this.createCoffee(ctx, gainNode); break;
    }
    nodes.push(gainNode);
    this.nodes.set(id, nodes);
  }

  stop(id: AudioTrackId) {
    const nodes = this.nodes.get(id);
    if (!nodes) return;
    nodes.forEach((n) => {
      try { (n as OscillatorNode).stop?.(); } catch {}
      try { n.disconnect(); } catch {}
    });
    this.nodes.delete(id);
    this.gains.delete(id);
  }

  setVolume(id: AudioTrackId, volume: number) {
    const gain = this.gains.get(id);
    if (gain) gain.gain.linearRampToValueAtTime(volume, (this.ctx?.currentTime ?? 0) + 0.1);
  }

  isPlaying(id: AudioTrackId) { return this.nodes.has(id); }
}

// ---- Room data ----
const ROOMS = [
  {
    id: "dungeon",
    name: "Deep Work Dungeon",
    theme: "No distractions. Pure focus.",
    icon: "⚔️",
    color: "var(--brand-600)",
    occupancy: 23,
    track: "binaural" as AudioTrackId,
    users: ["Alex", "Maria", "Jin", "Sam", "Priya"],
  },
  {
    id: "library",
    name: "Chill Library",
    theme: "Quiet and calm. Steady progress.",
    icon: "📚",
    color: "var(--brand-teal)",
    occupancy: 41,
    track: "lofi" as AudioTrackId,
    users: ["Taylor", "Lena", "Omar", "Chloe"],
  },
  {
    id: "grind",
    name: "Exam Grind",
    theme: "Crunch mode. High intensity.",
    icon: "📝",
    color: "var(--palette-f97316)",
    occupancy: 18,
    track: "whitenoise" as AudioTrackId,
    users: ["Ravi", "Emma", "Noah", "Zara", "Leo", "Mia"],
  },
  {
    id: "creative",
    name: "Creative Flow",
    theme: "Ideas, music, and making.",
    icon: "🎨",
    color: "var(--palette-ec4899)",
    occupancy: 12,
    track: "forest" as AudioTrackId,
    users: ["Felix", "Isla", "Kai"],
  },
];

const SUBJECTS = ["Math", "CS", "Design", "Writing", "Languages", "Science"];

export default function ForgePage() {
  const engineRef = useRef<SoundEngine | null>(null);
  const [playing, setPlaying] = useState<Set<AudioTrackId>>(new Set());
  const [volumes, setVolumes] = useState<Record<AudioTrackId, number>>(() =>
    Object.fromEntries(TRACKS.map((t) => [t.id, 0.4])) as Record<AudioTrackId, number>
  );
  const [joinedRoom, setJoinedRoom] = useState<string | null>(null);
  const [presenceTimer, setPresenceTimer] = useState(0);

  useEffect(() => {
    engineRef.current = new SoundEngine();
    return () => {
      TRACKS.forEach((t) => engineRef.current?.stop(t.id));
    };
  }, []);

  // Simulate timer when in a room
  useEffect(() => {
    if (!joinedRoom) return;
    const id = setInterval(() => setPresenceTimer((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [joinedRoom]);

  const toggleTrack = useCallback((id: AudioTrackId) => {
    const engine = engineRef.current!;
    if (engine.isPlaying(id)) {
      engine.stop(id);
      setPlaying((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } else {
      engine.play(id, volumes[id]);
      setPlaying((prev) => new Set([...prev, id]));
    }
  }, [volumes]);

  const handleVolume = useCallback((id: AudioTrackId, vol: number) => {
    setVolumes((prev) => ({ ...prev, [id]: vol }));
    engineRef.current?.setVolume(id, vol);
  }, []);

  const formatTime = (s: number) =>
    `${Math.floor(s / 3600).toString().padStart(2, "0")}:${Math.floor((s % 3600) / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute right-0 bottom-1/4 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,var(--rgba-236-72-153-0_06),transparent_65%)] blur-3xl" />
      </div>
      <main className="relative z-[var(--z-content)] mx-auto max-w-4xl px-4 py-10">
        <PageTransition>
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--foreground-subtle)]">Co-working</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
              <Users size={24} className="text-[var(--palette-ec4899)]" /> The Forge Room
            </h1>
          </header>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Study Rooms */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--foreground-muted)]">
                <Users size={14} /> Virtual Study Rooms
              </h2>
              <div className="space-y-3">
                {ROOMS.map((room) => {
                  const joined = joinedRoom === room.id;
                  return (
                    <motion.div
                      key={room.id}
                      className={`rounded-2xl border p-4 backdrop-blur-xl transition-all ${
                        joined
                          ? "border-[var(--rgba-124-58-237-0_5)] bg-[var(--rgba-124-58-237-0_12)] shadow-[0_0_20px_var(--rgba-124-58-237-0_15)]"
                          : "border-[var(--forge-border)] bg-[var(--card)] hover:border-[var(--rgba-124-58-237-0_3)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{room.icon}</span>
                          <div>
                            <p className="text-sm font-semibold text-[var(--foreground)]">{room.name}</p>
                            <p className="text-[11px] text-[var(--foreground-subtle)]">{room.theme}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--muted)] px-2.5 py-1 text-[10px] text-[var(--foreground-muted)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--palette-4ade80)] animate-pulse" />
                          {room.occupancy}
                        </div>
                      </div>

                      {/* User dots */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {room.users.map((u) => (
                          <div
                            key={u}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-[var(--palette-white)]"
                            style={{ background: USER_AVATAR_COLORS[u.charCodeAt(0) % USER_AVATAR_COLORS.length] }}
                            title={u}
                          >
                            {u[0]}
                          </div>
                        ))}
                        {room.occupancy > room.users.length && (
                          <div className="flex h-6 items-center rounded-full bg-[var(--surface-hover)] px-1.5 text-[9px] text-[var(--foreground-subtle)]">
                            +{room.occupancy - room.users.length}
                          </div>
                        )}
                      </div>

                      {joined && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 rounded-xl bg-[var(--rgba-124-58-237-0_1)] p-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] text-[var(--brand-400)]">You are studying</p>
                              <p className="text-lg font-mono font-bold text-[var(--foreground)]">{formatTime(presenceTimer)}</p>
                            </div>
                            <div className="flex gap-1">
                              {SUBJECTS.slice(0, 3).map((s) => (
                                <span key={s} className="rounded-full bg-[var(--rgba-124-58-237-0_2)] px-2 py-0.5 text-[9px] text-[var(--brand-400)]">{s}</span>
                              ))}
                            </div>
                          </div>
                          <p className="mt-1 text-[9px] text-[var(--foreground-subtle)]">👁 Focus mode: others can see you're here</p>
                        </motion.div>
                      )}

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => {
                            if (joined) {
                              setJoinedRoom(null);
                              setPresenceTimer(0);
                            } else {
                              setJoinedRoom(room.id);
                              // Auto-play the room's track
                              if (!engineRef.current?.isPlaying(room.track)) {
                                toggleTrack(room.track);
                              }
                            }
                          }}
                          className={`flex-1 rounded-xl py-1.5 text-xs font-semibold transition-all ${
                            joined
                              ? "bg-[var(--rgba-239-68-68-0_15)] text-[var(--palette-f87171)] hover:bg-[var(--rgba-239-68-68-0_25)]"
                              : "bg-[var(--brand-600)] hover:bg-[var(--brand-700)] text-[var(--palette-white)] shadow-[0_0_10px_var(--rgba-124-58-237-0_3)] hover:opacity-90"
                          }`}
                        >
                          {joined ? "Leave Room" : "Join Room"}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>

            {/* Soundscape */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--foreground-muted)]">
                <Headphones size={14} /> Soundscape Studio
              </h2>
              <div className="space-y-3">
                {TRACKS.map((track) => {
                  const isPlaying = playing.has(track.id);
                  const vol = volumes[track.id];
                  return (
                    <div
                      key={track.id}
                      className={`rounded-2xl border p-4 backdrop-blur-xl transition-all ${
                        isPlaying
                          ? "border-[var(--forge-border-bright)] bg-[var(--rgba-124-58-237-0_08)]"
                          : "border-[var(--forge-border)] bg-[var(--card)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Animated waveform when playing */}
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${track.color} 9%, transparent)` }}>
                          <span className="text-xl">{track.icon}</span>
                          {isPlaying && (
                            <div className="absolute inset-0 flex items-end justify-center gap-0.5 overflow-hidden rounded-xl pb-1.5">
                              {[...Array(5)].map((_, i) => (
                                <motion.div
                                  key={i}
                                  className="w-0.5 rounded-full"
                                  style={{ background: track.color }}
                                  animate={{ height: [4, 10 + i * 2, 4] }}
                                  transition={{ repeat: Infinity, duration: 0.4 + i * 0.1, delay: i * 0.1 }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[var(--foreground)]">{track.name}</p>
                          <p className="text-[10px] text-[var(--foreground-subtle)]">{track.description}</p>
                        </div>
                        <button
                          onClick={() => toggleTrack(track.id)}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${
                            isPlaying
                              ? "bg-[var(--rgba-239-68-68-0_15)] text-[var(--palette-f87171)]"
                              : "bg-[var(--rgba-124-58-237-0_15)] text-[var(--brand-400)] hover:bg-[var(--rgba-124-58-237-0_25)]"
                          }`}
                        >
                          {isPlaying ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                        </button>
                      </div>

                      {/* Volume slider */}
                      {isPlaying && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 flex items-center gap-2"
                        >
                          <VolumeX size={11} className="shrink-0 text-[var(--foreground-subtle)]" />
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={vol}
                            onChange={(e) => handleVolume(track.id, parseFloat(e.target.value))}
                            className="h-1 flex-1 appearance-none rounded-full bg-[var(--rgba-124-58-237-0_2)] outline-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--brand-400)] cursor-pointer"
                            style={{ accentColor: track.color }}
                          />
                          <Volume2 size={11} className="shrink-0 text-[var(--foreground-subtle)]" />
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>

              {playing.size >= 2 && (
                <p className="mt-2 text-center text-[10px] text-[var(--brand-400)]">
                  🎛 Mix mode active — {playing.size} tracks playing
                </p>
              )}
            </section>
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
