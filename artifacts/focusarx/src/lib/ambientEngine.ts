/**
 * Procedural ambient sound engine (Web Audio API).
 *
 * Everything is synthesised locally in the browser — no audio files to
 * download, no network requests. The builders below use layered noise
 * (white/pink/brown), LFO-driven filters and scheduled transient events
 * (thunder, bird chirps, fire crackles, café clinks…) to approximate
 * natural soundscapes.
 *
 * A single shared instance powers every UI surface (floating bar on mobile,
 * mixer panel on desktop) so there is never more than one AudioContext.
 */

export type SoundId =
  | "rain"
  | "ocean"
  | "forest"
  | "storm"
  | "cafe"
  | "fireplace"
  | "crickets"
  | "pink"
  | "brown"
  | "white"
  // Workstream D — Ambient v3 scenes
  | "monsoon-roof"
  | "waterfall"
  | "night-train"
  | "library"
  | "city-night"
  | "dawn-chorus"
  | "temple-bells"
  | "chai-stall"
  | "river-side"
  | "rain-tent"
  | "wind-chimes"
  | "binaural";

export interface SoundDef {
  id: SoundId;
  label: string;
  emoji: string;
  color: string;
}

export const AMBIENT_SOUNDS: SoundDef[] = [
  { id: "rain",      label: "Rain",       emoji: "🌧️", color: "var(--info)" },
  { id: "storm",     label: "Storm",      emoji: "⛈️", color: "var(--brand-500)" },
  { id: "ocean",     label: "Ocean",      emoji: "🌊", color: "var(--palette-0ea5e9)" },
  { id: "forest",    label: "Forest",     emoji: "🌲", color: "var(--color-success)" },
  { id: "cafe",      label: "Café",       emoji: "☕", color: "var(--palette-d97706)" },
  { id: "fireplace", label: "Fireplace",  emoji: "🔥", color: "var(--color-error)" },
  { id: "crickets",  label: "Crickets",   emoji: "🦗", color: "var(--palette-22d387)" },
  { id: "pink",      label: "Pink Noise", emoji: "🌸", color: "var(--palette-ec4899)" },
  { id: "brown",     label: "Brown Noise",emoji: "🟤", color: "var(--palette-b45309)" },
  { id: "white",     label: "White Noise",emoji: "🌫️", color: "var(--foreground-muted)" },
  // Ambient v3 (Workstream D)
  { id: "monsoon-roof", label: "Monsoon Tin Roof", emoji: "🏚️", color: "var(--palette-64748b)" },
  { id: "waterfall",    label: "Waterfall",        emoji: "💦", color: "var(--palette-38bdf8)" },
  { id: "night-train",  label: "Night Train",      emoji: "🚂", color: "var(--palette-f59e0b)" },
  { id: "library",      label: "Library",          emoji: "📚", color: "var(--palette-a78bfa)" },
  { id: "city-night",   label: "City Night",       emoji: "🌃", color: "var(--palette-f472b6)" },
  { id: "dawn-chorus",  label: "Dawn Chorus",      emoji: "🐦", color: "var(--palette-fbbf24)" },
  { id: "temple-bells", label: "Temple Bells",     emoji: "🛕", color: "var(--palette-fbbf24)" },
  { id: "chai-stall",   label: "Chai Stall",       emoji: "🫖", color: "var(--palette-d97706)" },
  { id: "river-side",   label: "River Side",       emoji: "🏞️", color: "var(--palette-2dd4bf)" },
  { id: "rain-tent",    label: "Rain on Tent",     emoji: "⛺", color: "var(--palette-94a3b8)" },
  { id: "wind-chimes",  label: "Wind Chimes",      emoji: "🎐", color: "var(--palette-67e8f9)" },
  { id: "binaural",     label: "Binaural Focus 🎧", emoji: "🧠", color: "var(--brand-400)" },
];

export interface PresetDef {
  id: string;
  label: string;
  emoji: string;
  layers: Array<{ id: SoundId; volume: number }>;
}

export const AMBIENT_PRESETS: PresetDef[] = [
  { id: "deep-focus",  label: "Deep Focus",   emoji: "🎯", layers: [{ id: "brown", volume: 0.5 }] },
  { id: "rainy-cafe",  label: "Rainy Café",   emoji: "☕", layers: [{ id: "rain", volume: 0.45 }, { id: "cafe", volume: 0.35 }] },
  { id: "storm-night", label: "Storm Night",  emoji: "⛈️", layers: [{ id: "storm", volume: 0.55 }, { id: "rain", volume: 0.2 }] },
  { id: "forest-walk", label: "Forest Walk",  emoji: "🌲", layers: [{ id: "forest", volume: 0.6 }] },
  { id: "night-camp",  label: "Night Camp",   emoji: "🔥", layers: [{ id: "fireplace", volume: 0.5 }, { id: "crickets", volume: 0.25 }] },
  { id: "waves",       label: "Ocean Waves",  emoji: "🌊", layers: [{ id: "ocean", volume: 0.6 }] },
  // Ambient v3 presets (4-layer cap respected)
  { id: "monsoon-study", label: "Monsoon Study", emoji: "🌧️", layers: [{ id: "monsoon-roof", volume: 0.55 }, { id: "chai-stall", volume: 0.3 }] },
  { id: "night-journey", label: "Night Journey", emoji: "🚂", layers: [{ id: "night-train", volume: 0.6 }, { id: "rain", volume: 0.18 }] },
  { id: "temple-calm",   label: "Temple Calm",   emoji: "🛕", layers: [{ id: "temple-bells", volume: 0.5 }, { id: "crickets", volume: 0.2 }, { id: "wind-chimes", volume: 0.25 }] },
  { id: "deep-sleep",    label: "Deep Sleep",    emoji: "😴", layers: [{ id: "brown", volume: 0.5 }, { id: "binaural", volume: 0.35 }] },
];

// ── EQ presets (Workstream D): shape the whole mix with a 3-band shelf/peak ─
export type EqPresetId = "flat" | "warm" | "bright" | "focus";

export interface EqPreset {
  id: EqPresetId;
  label: string;
  emoji: string;
  lowShelfDb: number;   // 200 Hz low shelf
  highShelfDb: number;  // 6 kHz high shelf
  focusLowpass: number; // 0 = bypass, else Hz
}

export const EQ_PRESETS: EqPreset[] = [
  { id: "flat",   label: "Flat",   emoji: "⚖️", lowShelfDb: 0,  highShelfDb: 0,  focusLowpass: 0 },
  { id: "warm",   label: "Warm",   emoji: "🔥", lowShelfDb: 3.5, highShelfDb: -2, focusLowpass: 0 },
  { id: "bright", label: "Bright", emoji: "✨", lowShelfDb: -1,  highShelfDb: 3.5, focusLowpass: 0 },
  { id: "focus",  label: "Focus",  emoji: "🎯", lowShelfDb: 2,   highShelfDb: -1, focusLowpass: 7500 },
];

/** Max simultaneous sound layers (Workstream D: 4-layer cap). */
export const MAX_LAYERS = 4;

// ── noise buffers ─────────────────────────────────────────────────────────────

type NoiseColor = "white" | "pink" | "brown";

const bufferCache = new Map<string, AudioBuffer>();

/** Random in [min, max) */
function rnd(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/**
 * Generate a loop-friendly noise buffer. The last `xf` seconds are
 * cross-faded with the beginning so looping doesn't click.
 */
function makeNoiseBuffer(ctx: AudioContext, color: NoiseColor, seconds = 6): AudioBuffer {
  const key = `${color}:${seconds}:${ctx.sampleRate}`;
  const cached = bufferCache.get(key);
  if (cached) return cached;

  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    if (color === "white") {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else if (color === "brown") {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
    } else {
      // pink — Paul Kellet's refined filter
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    // Crossfade the tail into the head for a seamless loop.
    const xf = Math.min(Math.floor(ctx.sampleRate * 0.5), Math.floor(len / 4));
    for (let i = 0; i < xf; i++) {
      const t = i / xf;
      const head = d[i] ?? 0;
      const tail = d[len - xf + i] ?? 0;
      d[i] = head * t + tail * (1 - t);
    }
    // Short fade on the very end so the loop point has matching silence ramp.
    for (let i = 0; i < xf; i++) {
      const t = i / xf;
      const idx = len - xf + i;
      d[idx] = (d[idx] ?? 0) * (1 - t);
    }
  }
  bufferCache.set(key, buf);
  return buf;
}

function noiseSource(ctx: AudioContext, color: NoiseColor, seconds = 6): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, color, seconds);
  src.loop = true;
  return src;
}

interface BuilderResult {
  output: GainNode;
  stop: () => void;
}

type Builder = (ctx: AudioContext) => BuilderResult;

/** Collect setTimeout ids so transient schedulers can be cancelled cleanly. */
function makeScheduler() {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let cancelled = false;
  return {
    get cancelled() { return cancelled; },
    after(ms: number, fn: () => void) {
      if (cancelled) return;
      const id = setTimeout(() => {
        timers.delete(id);
        if (!cancelled) fn();
      }, ms);
      timers.add(id);
    },
    cancelAll() {
      cancelled = true;
      timers.forEach(clearTimeout);
      timers.clear();
    },
  };
}

function connectChain(...nodes: AudioNode[]): AudioNode {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i]!.connect(nodes[i + 1]!);
  return nodes[nodes.length - 1]!;
}

function makeGain(ctx: AudioContext, v: number) {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

function makeFilter(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** Slow sine LFO wired to an AudioParam. */
function lfo(ctx: AudioContext, target: AudioParam, rateHz: number, depth: number, base: number, phase = 0) {
  const osc = ctx.createOscillator();
  osc.frequency.value = rateHz;
  const g = makeGain(ctx, depth);
  target.value = base;
  osc.connect(g);
  g.connect(target);
  osc.start(ctx.currentTime + phase);
  return osc;
}

// ── individual soundscapes ────────────────────────────────────────────────────

function buildRain(ctx: AudioContext, heavy = false): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);

  // Body: pink noise band-limited to the "rain band".
  const body = noiseSource(ctx, "pink", 8);
  const hp = makeFilter(ctx, "highpass", heavy ? 120 : 300, 0.5);
  const lp = makeFilter(ctx, "lowpass", heavy ? 3200 : 4800, 0.4);
  const bodyGain = makeGain(ctx, heavy ? 0.62 : 0.42);
  connectChain(body, hp, lp, bodyGain, out);
  body.start();

  // Distant rumble underneath.
  const rumble = noiseSource(ctx, "brown", 6);
  const rumbleLp = makeFilter(ctx, "lowpass", 180, 0.5);
  const rumbleGain = makeGain(ctx, heavy ? 0.5 : 0.22);
  connectChain(rumble, rumbleLp, rumbleGain, out);
  rumble.start();

  // Individual droplets — short band-passed noise ticks.
  const droplet = () => {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, "white", 0.1);
    const bp = makeFilter(ctx, "bandpass", rnd(1200, 4200), rnd(4, 9));
    const g = makeGain(ctx, 0);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(rnd(0.02, 0.07), now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + rnd(0.03, 0.09));
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.8, 0.8);
    connectChain(src, bp, g, pan, out);
    src.start(now);
    src.stop(now + 0.15);
    sched.after(rnd(80, heavy ? 240 : 420), droplet);
  };
  droplet();

  return { output: out, stop: () => { sched.cancelAll(); try { body.stop(); } catch {} try { rumble.stop(); } catch {} } };
}

function buildOcean(ctx: AudioContext): BuilderResult {
  const out = makeGain(ctx, 1);
  const oscs: OscillatorNode[] = [];

  // Deep swell — brown noise, lowpass swept by slow LFOs (two wave trains).
  const swell = noiseSource(ctx, "brown", 8);
  const lp = makeFilter(ctx, "lowpass", 500, 0.6);
  const swellGain = makeGain(ctx, 0.0);
  connectChain(swell, lp, swellGain, out);
  swell.start();

  oscs.push(lfo(ctx, lp.frequency, 0.055, 260, 560));
  oscs.push(lfo(ctx, lp.frequency, 0.083, 180, 620, 0.7));
  // Wave amplitude: two offset sines → irregular, breathing swells.
  oscs.push(lfo(ctx, swellGain.gain, 0.071, 0.16, 0.26));
  oscs.push(lfo(ctx, swellGain.gain, 0.047, 0.12, 0.3, 0.4));

  // Foam hiss on top of each swell.
  const foam = noiseSource(ctx, "pink", 6);
  const foamBp = makeFilter(ctx, "bandpass", 2600, 0.4);
  const foamGain = makeGain(ctx, 0);
  connectChain(foam, foamBp, foamGain, out);
  foam.start();
  oscs.push(lfo(ctx, foamGain.gain, 0.071, 0.05, 0.075, 0.18));

  return { output: out, stop: () => { try { swell.stop(); } catch {} try { foam.stop(); } catch {} oscs.forEach(o => { try { o.stop(); } catch {} }); } };
}

function buildForest(ctx: AudioContext): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);
  const oscs: OscillatorNode[] = [];

  // Wind through trees.
  const wind = noiseSource(ctx, "brown", 8);
  const windLp = makeFilter(ctx, "lowpass", 420, 0.5);
  const windGain = makeGain(ctx, 0.5);
  connectChain(wind, windLp, windGain, out);
  wind.start();
  oscs.push(lfo(ctx, windLp.frequency, 0.05, 190, 420));
  oscs.push(lfo(ctx, windGain.gain, 0.037, 0.14, 0.42, 0.3));

  // Leaf rustle.
  const leaves = noiseSource(ctx, "pink", 6);
  const leavesHp = makeFilter(ctx, "highpass", 2800, 0.6);
  const leavesGain = makeGain(ctx, 0.015);
  connectChain(leaves, leavesHp, leavesGain, out);
  leaves.start();
  const rustle = () => {
    const now = ctx.currentTime;
    leavesGain.gain.setTargetAtTime(rnd(0.004, 0.05), now, 0.6);
    sched.after(rnd(1200, 3200), rustle);
  };
  rustle();

  // Songbirds — 2–4 syllable chirps with pitch sweeps, randomly panned.
  const chirpOnce = () => {
    const syllables = Math.floor(rnd(2, 5));
    const baseF = rnd(2400, 4200);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.9, 0.9);
    const birdGain = makeGain(ctx, rnd(0.05, 0.1));
    connectChain(pan, birdGain, out);
    for (let s = 0; s < syllables; s++) {
      const t0 = ctx.currentTime + s * rnd(0.09, 0.16);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const f0 = baseF * rnd(0.9, 1.12);
      osc.frequency.setValueAtTime(f0, t0);
      osc.frequency.exponentialRampToValueAtTime(f0 * rnd(1.15, 1.5), t0 + 0.03);
      osc.frequency.exponentialRampToValueAtTime(f0 * rnd(0.8, 1.05), t0 + 0.09);
      // faint second harmonic for a less "beepy" tone
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(f0 * 2, t0);
      const g = makeGain(ctx, 0);
      const g2 = makeGain(ctx, 0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(1, t0 + 0.012);
      g.gain.linearRampToValueAtTime(0, t0 + rnd(0.06, 0.1));
      g2.gain.setValueAtTime(0, t0);
      g2.gain.linearRampToValueAtTime(0.25, t0 + 0.012);
      g2.gain.linearRampToValueAtTime(0, t0 + 0.07);
      osc.connect(g); g.connect(pan);
      osc2.connect(g2); g2.connect(pan);
      osc.start(t0); osc.stop(t0 + 0.14);
      osc2.start(t0); osc2.stop(t0 + 0.12);
    }
    sched.after(rnd(1400, 5200), chirpOnce);
  };
  sched.after(600, chirpOnce);

  return { output: out, stop: () => { sched.cancelAll(); try { wind.stop(); } catch {} try { leaves.stop(); } catch {} oscs.forEach(o => { try { o.stop(); } catch {} }); } };
}

function buildStorm(ctx: AudioContext): BuilderResult {
  const rain = buildRain(ctx, true);
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);
  rain.output.connect(out);

  // Constant distant roll.
  const roll = noiseSource(ctx, "brown", 8);
  const rollLp = makeFilter(ctx, "lowpass", 110, 0.4);
  const rollGain = makeGain(ctx, 0.35);
  connectChain(roll, rollLp, rollGain, out);
  roll.start();

  const thunder = () => {
    const now = ctx.currentTime;
    const dur = rnd(2.2, 5.5);
    const near = Math.random() < 0.4;
    // rumble body
    const src = noiseSource(ctx, "brown", 0.2);
    const lp = makeFilter(ctx, "lowpass", near ? 220 : 120, 0.5);
    lp.frequency.setValueAtTime(near ? 320 : 160, now);
    lp.frequency.exponentialRampToValueAtTime(near ? 60 : 45, now + dur);
    const g = makeGain(ctx, 0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(near ? 0.55 : 0.3, now + rnd(0.04, 0.25));
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    connectChain(src, lp, g, out);
    src.start(now);
    src.stop(now + dur + 0.1);
    // close lightning crack
    if (near) {
      const crack = ctx.createBufferSource();
      crack.buffer = makeNoiseBuffer(ctx, "white", 0.3);
      const bp = makeFilter(ctx, "bandpass", rnd(900, 2200), 1.2);
      const cg = makeGain(ctx, 0);
      cg.gain.setValueAtTime(0.28, now);
      cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      connectChain(crack, bp, cg, out);
      crack.start(now);
      crack.stop(now + 0.4);
    }
    sched.after(rnd(7000, 22000), thunder);
  };
  sched.after(rnd(2000, 5000), thunder);

  return { output: out, stop: () => { sched.cancelAll(); rain.stop(); try { roll.stop(); } catch {} } };
}

function buildCafe(ctx: AudioContext): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);
  const oscs: OscillatorNode[] = [];

  // Room murmur — layered band noises that swell like conversations.
  const murmur = noiseSource(ctx, "brown", 8);
  const murmurBp = makeFilter(ctx, "bandpass", 260, 1.1);
  const murmurGain = makeGain(ctx, 0.4);
  connectChain(murmur, murmurBp, murmurGain, out);
  murmur.start();
  const murmur2 = noiseSource(ctx, "pink", 7);
  const murmur2Bp = makeFilter(ctx, "bandpass", 620, 1.6);
  const murmur2Gain = makeGain(ctx, 0.12);
  connectChain(murmur2, murmur2Bp, murmur2Gain, out);
  murmur2.start();
  oscs.push(lfo(ctx, murmur2Gain.gain, 0.13, 0.05, 0.12));
  oscs.push(lfo(ctx, murmurBp.frequency, 0.09, 60, 260, 0.5));

  // Air conditioning hush.
  const air = noiseSource(ctx, "pink", 6);
  const airLp = makeFilter(ctx, "lowpass", 900, 0.4);
  const airGain = makeGain(ctx, 0.05);
  connectChain(air, airLp, airGain, out);
  air.start();

  // Cup & spoon clinks — resonant pings with fast decay.
  const clink = () => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    const f = rnd(1500, 3400);
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 0.94, now + 0.1);
    const g = makeGain(ctx, 0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(rnd(0.015, 0.05), now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, now + rnd(0.08, 0.18));
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.9, 0.9);
    connectChain(osc, g, pan, out);
    osc.start(now);
    osc.stop(now + 0.25);
    sched.after(rnd(2500, 9000), clink);
  };
  sched.after(1500, clink);

  // Occasional low thump — chair, footstep, cup set down.
  const thump = () => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(rnd(70, 110), now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);
    const g = makeGain(ctx, 0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(rnd(0.03, 0.08), now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    connectChain(osc, g, out);
    osc.start(now);
    osc.stop(now + 0.2);
    sched.after(rnd(4000, 12000), thump);
  };
  sched.after(4000, thump);

  return { output: out, stop: () => { sched.cancelAll(); try { murmur.stop(); } catch {} try { murmur2.stop(); } catch {} try { air.stop(); } catch {} oscs.forEach(o => { try { o.stop(); } catch {} }); } };
}

function buildFireplace(ctx: AudioContext): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);
  const oscs: OscillatorNode[] = [];

  // Roar.
  const roar = noiseSource(ctx, "brown", 8);
  const roarLp = makeFilter(ctx, "lowpass", 760, 0.5);
  const roarGain = makeGain(ctx, 0.34);
  connectChain(roar, roarLp, roarGain, out);
  roar.start();
  oscs.push(lfo(ctx, roarGain.gain, 0.09, 0.09, 0.34));
  oscs.push(lfo(ctx, roarLp.frequency, 0.05, 220, 760, 0.6));

  // Hiss of gas escaping.
  const hiss = noiseSource(ctx, "pink", 6);
  const hissBp = makeFilter(ctx, "bandpass", 3600, 0.7);
  const hissGain = makeGain(ctx, 0.012);
  connectChain(hiss, hissBp, hissGain, out);
  hiss.start();

  // Crackles — Poisson-ish impulses.
  const crackle = () => {
    const now = ctx.currentTime;
    const big = Math.random() < 0.12;
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, "white", 0.05);
    const bp = makeFilter(ctx, "bandpass", big ? rnd(700, 1800) : rnd(1800, 5200), rnd(1.5, 4));
    const g = makeGain(ctx, 0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(big ? rnd(0.1, 0.2) : rnd(0.015, 0.06), now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (big ? rnd(0.06, 0.14) : rnd(0.01, 0.04)));
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.6, 0.6);
    connectChain(src, bp, g, pan, out);
    src.start(now);
    src.stop(now + 0.2);
    sched.after(big ? rnd(500, 2200) : rnd(40, 420), crackle);
  };
  crackle();

  return { output: out, stop: () => { sched.cancelAll(); try { roar.stop(); } catch {} try { hiss.stop(); } catch {} oscs.forEach(o => { try { o.stop(); } catch {} }); } };
}

function buildCrickets(ctx: AudioContext): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);
  const stoppables: Array<{ stop: () => void }> = [];

  // Night air.
  const air = noiseSource(ctx, "brown", 8);
  const airLp = makeFilter(ctx, "lowpass", 300, 0.4);
  const airGain = makeGain(ctx, 0.18);
  connectChain(air, airLp, airGain, out);
  air.start();

  const makeCricketVoice = (pitch: number, panV: number, vol: number, period: [number, number]) => {
    const pan = ctx.createStereoPanner();
    pan.pan.value = panV;
    const voiceGain = makeGain(ctx, vol);
    connectChain(pan, voiceGain, out);
    // AM pulse — crickets chirp by modulating a pure tone at ~25-40Hz.
    const am = ctx.createOscillator();
    am.frequency.value = rnd(24, 38);
    const amGain = makeGain(ctx, 0.5);
    const amOffset = ctx.createConstantSource();
    amOffset.offset.value = 0.5;
    am.connect(amGain);
    am.start();
    amOffset.start();
    stoppables.push(am, amOffset);
    const train = () => {
      const chirps = Math.floor(rnd(2, 6));
      const t0 = ctx.currentTime + 0.01;
      for (let c = 0; c < chirps; c++) {
        const start = t0 + c * rnd(0.16, 0.24);
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = pitch * rnd(0.99, 1.01);
        const env = makeGain(ctx, 0);
        env.gain.setValueAtTime(0, start);
        env.gain.linearRampToValueAtTime(1, start + 0.015);
        env.gain.setValueAtTime(1, start + 0.06);
        env.gain.linearRampToValueAtTime(0, start + 0.085);
        const amEnv = makeGain(ctx, 0);
        amGain.connect(amEnv.gain);
        amOffset.connect(amEnv.gain);
        connectChain(osc, env, amEnv, pan);
        osc.start(start);
        osc.stop(start + 0.12);
      }
      sched.after(rnd(period[0], period[1]), train);
    };
    train();
  };

  makeCricketVoice(rnd(4100, 4600), -0.55, 0.05, [900, 2600]);
  makeCricketVoice(rnd(3600, 4100), 0.6, 0.035, [1400, 3600]);
  makeCricketVoice(rnd(4600, 5200), 0.1, 0.02, [2000, 5000]);

  return { output: out, stop: () => { sched.cancelAll(); try { air.stop(); } catch {} stoppables.forEach(o => { try { o.stop(); } catch {} }); } };
}

function buildPlainNoise(ctx: AudioContext, color: NoiseColor, gainVal: number, soften = false): BuilderResult {
  const src = noiseSource(ctx, color, 8);
  const out = makeGain(ctx, 1);
  if (soften) {
    const shelf = ctx.createBiquadFilter();
    shelf.type = "highshelf";
    shelf.frequency.value = 6000;
    shelf.gain.value = -4;
    connectChain(src, shelf, makeGain(ctx, gainVal), out);
  } else {
    connectChain(src, makeGain(ctx, gainVal), out);
  }
  src.start();
  return { output: out, stop: () => { try { src.stop(); } catch {} } };
}

// ── Ambient v3 scenes (Workstream D) ─────────────────────────────────────────

/** Monsoon on a tin roof — rain body + resonant "ping-ping" tin shimmer. */
function buildMonsoonRoof(ctx: AudioContext): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);

  const rain = noiseSource(ctx, "pink", 8);
  const hp = makeFilter(ctx, "highpass", 240, 0.5);
  const lp = makeFilter(ctx, "lowpass", 3600, 0.4);
  const bodyGain = makeGain(ctx, 0.4);
  connectChain(rain, hp, lp, bodyGain, out);
  rain.start();

  const tinPing = () => {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, "white", 0.12);
    const bp = makeFilter(ctx, "bandpass", rnd(2400, 5200), rnd(8, 14));
    const g = makeGain(ctx, 0);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(rnd(0.015, 0.05), now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, now + rnd(0.12, 0.3)); // the "ring"
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.9, 0.9);
    connectChain(src, bp, g, pan, out);
    src.start(now);
    src.stop(now + 0.35);
    sched.after(rnd(120, 500), tinPing);
  };
  tinPing();
  tinPing();

  return { output: out, stop: () => { sched.cancelAll(); try { rain.stop(); } catch {} } };
}

/** Waterfall — powerful rushing white body + droplet spray. */
function buildWaterfall(ctx: AudioContext): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);

  const rush = noiseSource(ctx, "white", 8);
  const hp = makeFilter(ctx, "highpass", 350, 0.4);
  const lp = makeFilter(ctx, "lowpass", 6500, 0.3);
  const rushGain = makeGain(ctx, 0.34);
  connectChain(rush, hp, lp, rushGain, out);
  rush.start();

  const plunge = noiseSource(ctx, "brown", 8);
  const plLp = makeFilter(ctx, "lowpass", 900, 0.5);
  const plGain = makeGain(ctx, 0.3);
  lfo(ctx, plGain.gain, 0.07, 0.12, 0.3);
  connectChain(plunge, plLp, plGain, out);
  plunge.start();

  const spray = () => {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, "white", 0.08);
    const bp = makeFilter(ctx, "bandpass", rnd(3000, 7000), rnd(3, 6));
    const g = makeGain(ctx, 0);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(rnd(0.008, 0.02), now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-1, 1);
    connectChain(src, bp, g, pan, out);
    src.start(now);
    src.stop(now + 0.1);
    sched.after(rnd(60, 260), spray);
  };
  spray();

  return { output: out, stop: () => { sched.cancelAll(); try { rush.stop(); } catch {} try { plunge.stop(); } catch {} } };
}

/** Night train — clack-clack rhythm, low rumble, rare distant whistle. */
function buildNightTrain(ctx: AudioContext): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);
  const stoppables: Array<{ stop: () => void }> = [];

  const rumble = noiseSource(ctx, "brown", 6);
  const rp = makeFilter(ctx, "lowpass", 160, 0.5);
  const rg = makeGain(ctx, 0.42);
  connectChain(rumble, rp, rg, out);
  rumble.start();

  const hiss = noiseSource(ctx, "pink", 6);
  const hbp = makeFilter(ctx, "bandpass", 1800, 0.6);
  const hg = makeGain(ctx, 0.05);
  connectChain(hiss, hbp, hg, out);
  hiss.start();

  const clackPair = (t: number) => {
    for (let i = 0; i < 2; i++) {
      const st = t + i * 0.11;
      const thump = ctx.createOscillator();
      thump.type = "sine";
      thump.frequency.value = rnd(55, 75);
      const tg = makeGain(ctx, 0);
      tg.gain.setValueAtTime(0, st);
      tg.gain.linearRampToValueAtTime(0.22, st + 0.008);
      tg.gain.exponentialRampToValueAtTime(0.0001, st + 0.09);
      thump.connect(tg); tg.connect(out);
      thump.start(st); thump.stop(st + 0.12);
      stoppables.push(thump);

      const tick = ctx.createBufferSource();
      tick.buffer = makeNoiseBuffer(ctx, "white", 0.04);
      const tbp = makeFilter(ctx, "bandpass", rnd(2600, 4000), 6);
      const tkg = makeGain(ctx, 0);
      tkg.gain.setValueAtTime(0, st + 0.012);
      tkg.gain.linearRampToValueAtTime(0.06, st + 0.018);
      tkg.gain.exponentialRampToValueAtTime(0.0001, st + 0.05);
      tick.connect(tbp); tbp.connect(tkg); tkg.connect(out);
      tick.start(st + 0.012); tick.stop(st + 0.07);
      stoppables.push(tick);
    }
  };
  const loop = () => {
    clackPair(ctx.currentTime + 0.02);
    sched.after(rnd(880, 1150), loop);
  };
  loop();

  const whistle = () => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(rnd(520, 640), now);
    osc.frequency.linearRampToValueAtTime(rnd(380, 460), now + 1.6);
    const g = makeGain(ctx, 0);
    const lp = makeFilter(ctx, "lowpass", 900, 0.5);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.035, now + 0.5);
    g.gain.linearRampToValueAtTime(0, now + 1.8);
    osc.connect(lp); lp.connect(g); g.connect(out);
    osc.start(now); osc.stop(now + 2);
    sched.after(rnd(45000, 110000), whistle);
  };
  sched.after(rnd(20000, 50000), whistle);

  return {
    output: out,
    stop: () => { sched.cancelAll(); stoppables.forEach(n => { try { n.stop(); } catch {} }); try { rumble.stop(); } catch {} try { hiss.stop(); } catch {} },
  };
}

/** Library — near-silence, page turns, distant HVAC hum, a pen tap. */
function buildLibrary(ctx: AudioContext): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);

  const room = noiseSource(ctx, "pink", 8);
  const rlp = makeFilter(ctx, "lowpass", 500, 0.4);
  const rg = makeGain(ctx, 0.05);
  connectChain(room, rlp, rg, out);
  room.start();

  const hum = ctx.createOscillator();
  hum.type = "sine";
  hum.frequency.value = 120;
  const humLp = makeFilter(ctx, "lowpass", 300, 0.5);
  const humG = makeGain(ctx, 0.016);
  hum.connect(humLp); humLp.connect(humG); humG.connect(out);
  hum.start();

  const pageTurn = () => {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, "pink", 0.5);
    const bp = makeFilter(ctx, "bandpass", rnd(1200, 2200), 1.2);
    const g = makeGain(ctx, 0);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(rnd(0.03, 0.05), now + 0.08);
    g.gain.linearRampToValueAtTime(0.01, now + 0.18);
    g.gain.linearRampToValueAtTime(0, now + 0.32);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.5, 0.5);
    connectChain(src, bp, g, pan, out);
    src.start(now);
    src.stop(now + 0.4);
    sched.after(rnd(9000, 26000), pageTurn);
  };
  sched.after(rnd(4000, 9000), pageTurn);

  const penTap = () => {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, "white", 0.03);
    const bp = makeFilter(ctx, "bandpass", rnd(1800, 2600), 8);
    const g = makeGain(ctx, 0);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.035, now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.4, 0.4);
    connectChain(src, bp, g, pan, out);
    src.start(now); src.stop(now + 0.06);
    sched.after(rnd(12000, 40000), penTap);
  };
  sched.after(rnd(6000, 15000), penTap);

  return { output: out, stop: () => { sched.cancelAll(); try { room.stop(); } catch {} try { hum.stop(); } catch {} } };
}

/** City night — low traffic wash, distant muffled honks, air movement. */
function buildCityNight(ctx: AudioContext): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);

  const wash = noiseSource(ctx, "brown", 8);
  const wlp = makeFilter(ctx, "lowpass", 240, 0.5);
  const wg = makeGain(ctx, 0.3);
  lfo(ctx, wg.gain, 0.05, 0.08, 0.3);
  connectChain(wash, wlp, wg, out);
  wash.start();

  const carPass = () => {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, "brown", 2.5);
    const bp = makeFilter(ctx, "bandpass", 300, 1.4);
    const now = ctx.currentTime;
    bp.frequency.setValueAtTime(140, now);
    bp.frequency.linearRampToValueAtTime(700, now + 1.1);
    bp.frequency.linearRampToValueAtTime(180, now + 2.3);
    const g = makeGain(ctx, 0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(rnd(0.05, 0.09), now + 1.1);
    g.gain.linearRampToValueAtTime(0, now + 2.4);
    const pan = ctx.createStereoPanner();
    const dir = Math.random() < 0.5 ? -1 : 1;
    pan.pan.setValueAtTime(dir * 0.7, now);
    pan.pan.linearRampToValueAtTime(-dir * 0.7, now + 2.4);
    connectChain(src, bp, g, pan, out);
    src.start(now); src.stop(now + 2.5);
    sched.after(rnd(8000, 22000), carPass);
  };
  sched.after(rnd(2000, 7000), carPass);

  const honk = () => {
    const now = ctx.currentTime;
    [0, 0.35].forEach((off, i) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = i === 0 ? 220 : 196;
      const lp = makeFilter(ctx, "lowpass", 400, 0.8);
      const g = makeGain(ctx, 0);
      g.gain.setValueAtTime(0, now + off);
      g.gain.linearRampToValueAtTime(0.02, now + off + 0.03);
      g.gain.linearRampToValueAtTime(0, now + off + 0.3);
      osc.connect(lp); lp.connect(g); g.connect(out);
      osc.start(now + off); osc.stop(now + off + 0.35);
    });
    sched.after(rnd(50000, 120000), honk);
  };
  sched.after(rnd(25000, 60000), honk);

  return { output: out, stop: () => { sched.cancelAll(); try { wash.stop(); } catch {} } };
}

/** Dawn chorus — bird chirps with vibrato over a soft breeze bed. */
function buildDawnChorus(ctx: AudioContext): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);

  const breeze = noiseSource(ctx, "pink", 8);
  const blp = makeFilter(ctx, "lowpass", 800, 0.4);
  const bg = makeGain(ctx, 0.06);
  connectChain(breeze, blp, bg, out);
  breeze.start();

  const chirpSeq = () => {
    const now = ctx.currentTime;
    const notes = Math.floor(rnd(3, 8));
    const base = rnd(2200, 4200);
    for (let i = 0; i < notes; i++) {
      const st = now + i * rnd(0.09, 0.16);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const f0 = base * rnd(0.95, 1.25);
      osc.frequency.setValueAtTime(f0, st);
      osc.frequency.linearRampToValueAtTime(f0 * rnd(0.8, 1.15), st + 0.07);
      const vib = ctx.createOscillator();
      vib.frequency.value = rnd(30, 45);
      const vibG = makeGain(ctx, f0 * 0.04);
      vib.connect(vibG); vibG.connect(osc.frequency);
      const g = makeGain(ctx, 0);
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(rnd(0.02, 0.045), st + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, st + rnd(0.07, 0.12));
      const pan = ctx.createStereoPanner();
      pan.pan.value = rnd(-0.9, 0.9);
      osc.connect(g); g.connect(pan); pan.connect(out);
      osc.start(st); osc.stop(st + 0.15);
      vib.start(st); vib.stop(st + 0.15);
    }
    sched.after(rnd(1200, 5000), chirpSeq);
  };
  chirpSeq();

  return { output: out, stop: () => { sched.cancelAll(); try { breeze.stop(); } catch {} } };
}

/** Temple bells — sparse bells (inharmonic partials) over a quiet room. */
function buildTempleBells(ctx: AudioContext): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);

  const room = noiseSource(ctx, "pink", 8);
  const rlp = makeFilter(ctx, "lowpass", 400, 0.4);
  const rg = makeGain(ctx, 0.035);
  connectChain(room, rlp, rg, out);
  room.start();

  const RATIO = [1, 2.0, 2.98, 4.2, 5.43];
  const bell = () => {
    const now = ctx.currentTime;
    const f0 = rnd(320, 420);
    const decay = rnd(4.5, 7);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.6, 0.6);
    const bellGain = makeGain(ctx, 0.09);
    connectChain(pan, bellGain, out);
    RATIO.forEach((r, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f0 * r;
      const g = makeGain(ctx, 1 / (i + 1));
      g.gain.setValueAtTime(1 / (i + 1), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay / (i * 0.6 + 1));
      osc.connect(g); g.connect(bellGain);
      osc.start(now); osc.stop(now + decay + 0.5);
    });
    const tick = ctx.createBufferSource();
    tick.buffer = makeNoiseBuffer(ctx, "white", 0.03);
    const bp = makeFilter(ctx, "bandpass", 2500, 5);
    const tg = makeGain(ctx, 0.03);
    tg.gain.setValueAtTime(0.03, now);
    tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    tick.connect(bp); bp.connect(tg); tg.connect(bellGain);
    tick.start(now); tick.stop(now + 0.06);
    sched.after(rnd(25000, 55000), bell);
  };
  sched.after(rnd(1500, 5000), bell);

  return { output: out, stop: () => { sched.cancelAll(); try { room.stop(); } catch {} } };
}

/** Chai stall — murmur bed (modulated noise), kettle whistles, cup clinks. */
function buildChaiStall(ctx: AudioContext): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);

  const murmur = noiseSource(ctx, "pink", 8);
  const mhp = makeFilter(ctx, "highpass", 300, 0.5);
  const mlp = makeFilter(ctx, "lowpass", 1600, 0.5);
  const mg = makeGain(ctx, 0.09);
  lfo(ctx, mg.gain, 0.13, 0.035, 0.09);
  lfo(ctx, mg.gain, 0.071, 0.025, 0.09, 1.2);
  connectChain(murmur, mhp, mlp, mg, out);
  murmur.start();

  const clink = () => {
    const now = ctx.currentTime;
    [0, 0.02].forEach(off => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = rnd(2600, 3400);
      const g = makeGain(ctx, 0);
      g.gain.setValueAtTime(0.025, now + off);
      g.gain.exponentialRampToValueAtTime(0.0001, now + off + 0.18);
      const pan = ctx.createStereoPanner();
      pan.pan.value = rnd(-0.6, 0.6);
      osc.connect(g); g.connect(pan); pan.connect(out);
      osc.start(now + off); osc.stop(now + off + 0.25);
    });
    sched.after(rnd(7000, 20000), clink);
  };
  sched.after(rnd(3000, 8000), clink);

  const kettle = () => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.linearRampToValueAtTime(rnd(2400, 2800), now + 2.2);
    const wob = ctx.createOscillator();
    wob.frequency.value = 6;
    const wobG = makeGain(ctx, 60);
    wob.connect(wobG); wobG.connect(osc.frequency);
    const lp = makeFilter(ctx, "lowpass", 3000, 0.6);
    const g = makeGain(ctx, 0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.02, now + 0.6);
    g.gain.linearRampToValueAtTime(0.008, now + 1.8);
    g.gain.linearRampToValueAtTime(0, now + 2.4);
    osc.connect(lp); lp.connect(g); g.connect(out);
    osc.start(now); osc.stop(now + 2.5);
    wob.start(now); wob.stop(now + 2.5);
    sched.after(rnd(50000, 120000), kettle);
  };
  sched.after(rnd(30000, 70000), kettle);

  return { output: out, stop: () => { sched.cancelAll(); try { murmur.stop(); } catch {} } };
}

/** River side — rushing mid band, lapping, occasional frog calls. */
function buildRiverSide(ctx: AudioContext): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);

  const rush = noiseSource(ctx, "pink", 8);
  const hp = makeFilter(ctx, "highpass", 400, 0.4);
  const lp = makeFilter(ctx, "lowpass", 3800, 0.4);
  const rg = makeGain(ctx, 0.3);
  lfo(ctx, rg.gain, 0.09, 0.1, 0.3);
  connectChain(rush, hp, lp, rg, out);
  rush.start();

  const lapping = () => {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, "white", 0.25);
    const bp = makeFilter(ctx, "bandpass", rnd(800, 1600), 1.5);
    const g = makeGain(ctx, 0);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(rnd(0.02, 0.045), now + 0.1);
    g.gain.linearRampToValueAtTime(0, now + 0.3);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.8, 0.8);
    connectChain(src, bp, g, pan, out);
    src.start(now); src.stop(now + 0.35);
    sched.after(rnd(900, 2400), lapping);
  };
  lapping();

  const frog = () => {
    const now = ctx.currentTime;
    const blips = Math.floor(rnd(2, 5));
    for (let i = 0; i < blips; i++) {
      const st = now + i * 0.18;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(rnd(180, 240), st);
      osc.frequency.linearRampToValueAtTime(rnd(140, 180), st + 0.1);
      const lp = makeFilter(ctx, "lowpass", 700, 0.8);
      const g = makeGain(ctx, 0);
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.03, st + 0.02);
      g.gain.linearRampToValueAtTime(0, st + 0.14);
      const pan = ctx.createStereoPanner();
      pan.pan.value = rnd(-0.9, 0.9);
      osc.connect(lp); lp.connect(g); g.connect(pan); pan.connect(out);
      osc.start(st); osc.stop(st + 0.18);
    }
    sched.after(rnd(15000, 45000), frog);
  };
  sched.after(rnd(8000, 20000), frog);

  return { output: out, stop: () => { sched.cancelAll(); try { rush.stop(); } catch {} } };
}

/** Rain on a tent — muffled low rain + tarp flaps. */
function buildRainTent(ctx: AudioContext): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);

  const rain = noiseSource(ctx, "pink", 8);
  const lp = makeFilter(ctx, "lowpass", 900, 0.5);
  const rg = makeGain(ctx, 0.5);
  lfo(ctx, rg.gain, 0.06, 0.08, 0.5);
  connectChain(rain, lp, rg, out);
  rain.start();

  const flap = () => {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, "pink", 0.4);
    const bp = makeFilter(ctx, "bandpass", 600, 1.2);
    const now = ctx.currentTime;
    bp.frequency.setValueAtTime(300, now);
    bp.frequency.linearRampToValueAtTime(1400, now + 0.12);
    bp.frequency.linearRampToValueAtTime(400, now + 0.3);
    const g = makeGain(ctx, 0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(rnd(0.04, 0.07), now + 0.08);
    g.gain.linearRampToValueAtTime(0, now + 0.32);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.7, 0.7);
    connectChain(src, bp, g, pan, out);
    src.start(now); src.stop(now + 0.4);
    sched.after(rnd(1800, 6000), flap);
  };
  sched.after(rnd(800, 2500), flap);

  return { output: out, stop: () => { sched.cancelAll(); try { rain.stop(); } catch {} } };
}

/** Wind chimes — pentatonic sine pings with long decays over a wind bed. */
function buildWindChimes(ctx: AudioContext): BuilderResult {
  const sched = makeScheduler();
  const out = makeGain(ctx, 1);

  const wind = noiseSource(ctx, "pink", 8);
  const wp = makeFilter(ctx, "bandpass", 500, 0.7);
  const wg = makeGain(ctx, 0.05);
  lfo(ctx, wg.gain, 0.08, 0.03, 0.05);
  lfo(ctx, wp.frequency, 0.05, 150, 500);
  connectChain(wind, wp, wg, out);
  wind.start();

  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.5];
  const ping = () => {
    const now = ctx.currentTime;
    const n = PENTA[Math.floor(Math.random() * PENTA.length)]!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = n * rnd(0.999, 1.001);
    const g = makeGain(ctx, 0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(rnd(0.05, 0.09), now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + rnd(1.8, 3.2));
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.8, 0.8);
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = n * 2;
    const g2 = makeGain(ctx, 0);
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(rnd(0.008, 0.02), now + 0.012);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + rnd(1.2, 2));
    connectChain(osc, g, pan, out);
    connectChain(osc2, g2, pan);
    osc.start(now); osc.stop(now + 3.5);
    osc2.start(now); osc2.stop(now + 2.2);
    const extra = Math.floor(rnd(0, 3));
    for (let i = 0; i < extra; i++) {
      const st = now + rnd(0.25, 0.9) * (i + 1);
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = PENTA[Math.floor(Math.random() * PENTA.length)]! * rnd(0.999, 1.001);
      const gg = makeGain(ctx, 0);
      gg.gain.setValueAtTime(0, st);
      gg.gain.linearRampToValueAtTime(rnd(0.03, 0.06), st + 0.01);
      gg.gain.exponentialRampToValueAtTime(0.0001, st + rnd(1.5, 2.8));
      o.connect(gg); gg.connect(pan);
      o.start(st); o.stop(st + 3);
    }
    sched.after(rnd(6000, 20000), ping);
  };
  sched.after(rnd(1000, 4000), ping);

  return { output: out, stop: () => { sched.cancelAll(); try { wind.stop(); } catch {} } };
}

/**
 * Binaural focus — a 200 Hz carrier split to 190 Hz (L) / 200 Hz (R),
 * producing a 10 Hz theta beat perceived inside the head. Needs headphones;
 * mono playback collapses it to a plain 200 Hz tone (harmless).
 */
function buildBinaural(ctx: AudioContext): BuilderResult {
  const out = makeGain(ctx, 1);
  const left = ctx.createOscillator();
  left.type = "sine";
  left.frequency.value = 190;
  const right = ctx.createOscillator();
  right.type = "sine";
  right.frequency.value = 200;
  const lg = makeGain(ctx, 0.5);
  const rg = makeGain(ctx, 0.5);
  const lpan = ctx.createStereoPanner();
  lpan.pan.value = -1;
  const rpan = ctx.createStereoPanner();
  rpan.pan.value = 1;
  connectChain(left, lg, lpan, out);
  connectChain(right, rg, rpan, out);
  lfo(ctx, lg.gain, 0.03, 0.15, 0.5);
  lfo(ctx, rg.gain, 0.03, 0.15, 0.5, 0.9);
  left.start();
  right.start();
  return { output: out, stop: () => { try { left.stop(); } catch {} try { right.stop(); } catch {} } };
}

const BUILDERS: Record<SoundId, Builder> = {
  rain: ctx => buildRain(ctx, false),
  storm: buildStorm,
  ocean: buildOcean,
  forest: buildForest,
  cafe: buildCafe,
  fireplace: buildFireplace,
  crickets: buildCrickets,
  pink: ctx => buildPlainNoise(ctx, "pink", 0.5),
  brown: ctx => buildPlainNoise(ctx, "brown", 0.65),
  white: ctx => buildPlainNoise(ctx, "white", 0.32, true),
  "monsoon-roof": buildMonsoonRoof,
  waterfall: buildWaterfall,
  "night-train": buildNightTrain,
  library: buildLibrary,
  "city-night": buildCityNight,
  "dawn-chorus": buildDawnChorus,
  "temple-bells": buildTempleBells,
  "chai-stall": buildChaiStall,
  "river-side": buildRiverSide,
  "rain-tent": buildRainTent,
  "wind-chimes": buildWindChimes,
  binaural: buildBinaural,
};

// ── engine ─────────────────────────────────────────────────────────────────────

interface ActiveLayer {
  result: BuilderResult;
  gain: GainNode;
  volume: number;
}

export class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lowShelf: BiquadFilterNode | null = null;
  private highShelf: BiquadFilterNode | null = null;
  private focusLp: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private reactiveLfo: OscillatorNode | null = null;
  private reactiveDepth: GainNode | null = null;
  private reactiveOn = false;
  private eqId: EqPresetId = "flat";
  private eqApplied = false;
  private visible = true;
  private layers = new Map<SoundId, ActiveLayer>();
  private masterVolume = 0.9;
  private listeners = new Set<() => void>();

  getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  /** Live frequency data for the 12-bar visualizer (null until first play). */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /** 4-layer cap (Workstream D): refuses a 5th simultaneous layer. */
  canAddLayer(): boolean {
    return this.layers.size < MAX_LAYERS;
  }

  isActive(id: SoundId): boolean {
    return this.layers.has(id);
  }

  activeIds(): SoundId[] {
    return [...this.layers.keys()];
  }

  getVolume(id: SoundId): number {
    return this.layers.get(id)?.volume ?? 0;
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach(fn => fn());
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // master → low shelf → high shelf → focus lowpass → analyser → comp → out
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVolume;
      this.lowShelf = this.ctx.createBiquadFilter();
      this.lowShelf.type = "lowshelf";
      this.lowShelf.frequency.value = 200;
      this.lowShelf.gain.value = 0;
      this.highShelf = this.ctx.createBiquadFilter();
      this.highShelf.type = "highshelf";
      this.highShelf.frequency.value = 6000;
      this.highShelf.gain.value = 0;
      this.focusLp = this.ctx.createBiquadFilter();
      this.focusLp.type = "lowpass";
      this.focusLp.frequency.value = 20000; // "bypass" until a preset engages
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 20;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      this.master.connect(this.lowShelf);
      this.lowShelf.connect(this.highShelf);
      this.highShelf.connect(this.focusLp);
      this.focusLp.connect(this.analyser);
      this.analyser.connect(comp);
      comp.connect(this.ctx.destination);
    }
    if (!this.eqApplied) {
      this.applyEqState(EQ_PRESETS.find(p => p.id === this.eqId) ?? EQ_PRESETS[0]!);
      this.eqApplied = true;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Apply an EQ preset to the whole mix (smooth ~0.2s transitions). */
  setEq(id: EqPresetId) {
    this.eqId = id;
    const preset = EQ_PRESETS.find(p => p.id === id) ?? EQ_PRESETS[0]!;
    if (!this.ctx) return; // will apply on next ensureCtx via applyEqState
    this.applyEqState(preset);
    this.emit();
  }

  getEq(): EqPresetId {
    return this.eqId;
  }

  private applyEqState(preset: EqPreset) {
    if (!this.ctx || !this.lowShelf || !this.highShelf || !this.focusLp) return;
    const t = this.ctx.currentTime;
    this.lowShelf.gain.setTargetAtTime(preset.lowShelfDb, t, 0.15);
    this.highShelf.gain.setTargetAtTime(preset.highShelfDb, t, 0.15);
    this.focusLp.frequency.setTargetAtTime(preset.focusLowpass || 20000, t, 0.2);
  }

  /**
   * Reactive mode (Workstream D): a very slow ±5% "breathing" on the master
   * gain so the mix feels alive while you focus. Depth scales with the
   * focus intensity (0..1) passed in.
   */
  setReactive(on: boolean, intensity = 1) {
    this.reactiveOn = on;
    if (!on) {
      if (this.reactiveLfo && this.ctx) {
        try { this.reactiveLfo.stop(this.ctx.currentTime + 0.3); } catch {}
        this.reactiveLfo = null;
        if (this.reactiveDepth) this.reactiveDepth.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      }
      this.emit();
      return;
    }
    const ctx = this.ensureCtx();
    if (!this.reactiveLfo) {
      this.reactiveLfo = ctx.createOscillator();
      this.reactiveLfo.frequency.value = 0.05; // ~20s breath
      this.reactiveDepth = ctx.createGain();
      this.reactiveDepth.gain.value = 0;
      this.reactiveLfo.connect(this.reactiveDepth);
      this.reactiveDepth.connect(this.master!.gain);
      this.reactiveLfo.start();
    }
    const depth = Math.max(0, Math.min(1, intensity)) * (this.visible ? 0.05 : 0);
    this.reactiveDepth!.gain.setTargetAtTime(depth, ctx.currentTime, 0.4);
    this.emit();
  }

  isReactive(): boolean {
    return this.reactiveOn;
  }

  play(id: SoundId, volume = 0.5, fadeSec = 0.8): boolean {
    if (this.layers.has(id)) return true;
    if (this.layers.size >= MAX_LAYERS) return false; // 4-layer cap
    const ctx = this.ensureCtx();
    const result = BUILDERS[id](ctx);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), ctx.currentTime + fadeSec);
    result.output.connect(gain);
    gain.connect(this.master!);
    this.layers.set(id, { result, gain, volume });
    this.emit();
    return true;
  }

  stop(id: SoundId, fadeSec = 0.6) {
    const layer = this.layers.get(id);
    if (!layer || !this.ctx) return;
    const ctx = this.ctx;
    layer.gain.gain.cancelScheduledValues(ctx.currentTime);
    layer.gain.gain.setValueAtTime(Math.max(0.0001, layer.gain.gain.value), ctx.currentTime);
    layer.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fadeSec);
    this.layers.delete(id);
    this.emit();
    setTimeout(() => {
      try { layer.result.output.disconnect(); } catch {}
      try { layer.gain.disconnect(); } catch {}
      layer.result.stop();
    }, (fadeSec + 0.2) * 1000);
  }

  stopAll() {
    [...this.layers.keys()].forEach(id => this.stop(id));
  }

  applyPreset(preset: PresetDef) {
    // stop everything not in the preset, then fade preset layers in
    const keep = new Set(preset.layers.map(l => l.id));
    [...this.layers.keys()].forEach(id => { if (!keep.has(id)) this.stop(id); });
    // 4-layer cap: presets are ≤3 layers, but if the user has extras active,
    // drop the oldest non-preset layers until there is room.
    while (this.layers.size + preset.layers.length > MAX_LAYERS) {
      const extras = [...this.layers.keys()].filter(id => !keep.has(id));
      if (extras.length === 0) break;
      this.stop(extras[0]!);
    }
    preset.layers.forEach(l => {
      if (this.layers.has(l.id)) this.setVolume(l.id, l.volume);
      else this.play(l.id, l.volume);
    });
  }

  setVolume(id: SoundId, vol: number) {
    const layer = this.layers.get(id);
    if (!layer || !this.ctx) return;
    layer.volume = vol;
    layer.gain.gain.cancelScheduledValues(this.ctx.currentTime);
    layer.gain.gain.setTargetAtTime(Math.max(0.0001, vol), this.ctx.currentTime, 0.05);
    this.emit();
  }

  setMasterVolume(vol: number) {
    this.masterVolume = vol;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(Math.max(0.0001, vol), this.ctx.currentTime, 0.05);
    }
    this.emit();
  }

  /** Duck/fade everything (e.g. when the tab hides). */
  setVisible(visible: boolean) {
    this.visible = visible;
    if (!this.ctx || !this.master) return;
    const target = visible ? this.masterVolume : 0;
    this.master.gain.setTargetAtTime(Math.max(0.0001, target), this.ctx.currentTime, 0.4);
    // The reactive breath must not leak through when the mix is ducked.
    if (this.reactiveDepth && this.reactiveOn) {
      const depth = visible ? 0.05 : 0;
      this.reactiveDepth.gain.setTargetAtTime(depth, this.ctx.currentTime, 0.4);
    }
  }
}

/** Shared singleton so every UI controls the same audio graph. */
export const ambientEngine = new AmbientEngine();
