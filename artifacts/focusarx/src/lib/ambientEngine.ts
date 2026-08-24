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
  | "white";

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
];

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
  private layers = new Map<SoundId, ActiveLayer>();
  private masterVolume = 0.9;
  private listeners = new Set<() => void>();

  getAudioContext(): AudioContext | null {
    return this.ctx;
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
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 20;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVolume;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  play(id: SoundId, volume = 0.5, fadeSec = 0.8) {
    if (this.layers.has(id)) return;
    const ctx = this.ensureCtx();
    const result = BUILDERS[id](ctx);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), ctx.currentTime + fadeSec);
    result.output.connect(gain);
    gain.connect(this.master!);
    this.layers.set(id, { result, gain, volume });
    this.emit();
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
    if (!this.ctx || !this.master) return;
    const target = visible ? this.masterVolume : 0;
    this.master.gain.setTargetAtTime(Math.max(0.0001, target), this.ctx.currentTime, 0.4);
  }
}

/** Shared singleton so every UI controls the same audio graph. */
export const ambientEngine = new AmbientEngine();
