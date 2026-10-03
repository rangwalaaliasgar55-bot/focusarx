/**
 * The uploaded layer mixer — a straight port of
 * `redesign-focusarx-frontend-interface/src/lib/audio.ts`.
 *
 * Why this exists next to `ambientEngine.ts` instead of inside it: the two are
 * different instruments. The engine plays one *soundscape* at a time (a rain
 * bed with a cafe under it, say) and is driven by presets, a track list and an
 * EQ; this is a four-fader mixer where every layer is always available and the
 * user rides the levels live. The uploads' whole point was that interaction, so
 * the synthesis is copied as-is — the same noise colours, the same filter
 * frequencies, the same `vol² × 0.55` gain law, the same 700 ms teardown, the
 * same four-note chime — rather than folded into the engine's vocabulary and
 * lost.
 *
 * The one adaptation: it borrows the app's single AudioContext from
 * `ambientEngine` when one exists (`ambientEngine.ts` states the invariant that
 * the app never holds more than one), and only creates its own when there is
 * none — outside the app, or before the engine has ever started.
 */

export type LayerId = "rain" | "brown" | "ocean" | "wind";

export const LAYERS: { id: LayerId; label: string; hint: string }[] = [
  { id: "rain", label: "Rain", hint: "Steady, soft rainfall" },
  { id: "brown", label: "Brown noise", hint: "Deep and warm" },
  { id: "ocean", label: "Ocean", hint: "Slow rolling waves" },
  { id: "wind", label: "Wind", hint: "Drifting air" },
];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const nodes: Partial<Record<LayerId, { gain: GainNode; stop: () => void }>> = {};
let volumes: Record<LayerId, number> = { rain: 0, brown: 0, ocean: 0, wind: 0 };
const listeners = new Set<() => void>();

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  // Shared with the engine first: two contexts on one page is the bug this
  // avoids, not a style preference.
  const shared = ambientEngineContext();
  if (shared) {
    if (!master) {
      master = shared.createGain();
      master.gain.value = 0.9;
      master.connect(shared.destination);
    }
    if (shared.state === "suspended") void shared.resume();
    return shared;
  }
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Late-bound so importing this module never pulls the engine into a chunk. */
function ambientEngineContext(): AudioContext | null {
  try {
    return engineContextGetter?.() ?? null;
  } catch {
    return null;
  }
}

type EngineLike = { getAudioContext?: () => AudioContext | null };

let engineContextGetter: (() => AudioContext | null) | null = null;

/**
 * Point the mixer at the app's engine. `AmbientSoundBar` calls this once, which
 * keeps this module free of a static import of `ambientEngine.ts` (it is a
 * 2 000-line module, and the mixer is only mounted with the sound panel).
 */
export function shareEngineContext(engine: EngineLike | null): void {
  engineContextGetter = engine?.getAudioContext ? () => engine.getAudioContext!() : null;
}

function noiseBuffer(c: AudioContext, type: "white" | "brown" | "pink"): AudioBuffer {
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === "white") d[i] = w;
      else if (type === "brown") {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      }
    }
    // Crossfade the ends so the loop is seamless.
    const fade = 2000;
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      d[i] = d[i] * k + d[len - fade + i] * (1 - k);
    }
  }
  return buf;
}

function loop(c: AudioContext, type: "white" | "brown" | "pink") {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, type);
  src.loop = true;
  src.loopEnd = src.buffer.duration - 2000 / c.sampleRate;
  src.start();
  return src;
}

function build(id: LayerId, c: AudioContext) {
  const out = c.createGain();
  out.gain.value = 0;
  out.connect(master!);
  const stops: (() => void)[] = [];

  if (id === "rain") {
    const src = loop(c, "white");
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 7500;
    const peak = c.createBiquadFilter();
    peak.type = "peaking";
    peak.frequency.value = 3200;
    peak.gain.value = 4;
    src.connect(hp).connect(peak).connect(lp).connect(out);
    stops.push(() => src.stop());
  } else if (id === "brown") {
    const src = loop(c, "brown");
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    src.connect(lp).connect(out);
    stops.push(() => src.stop());
  } else if (id === "ocean") {
    const src = loop(c, "pink");
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1100;
    const swell = c.createGain();
    swell.gain.value = 0.55;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.09;
    const depth = c.createGain();
    depth.gain.value = 0.45;
    lfo.connect(depth).connect(swell.gain);
    lfo.start();
    src.connect(lp).connect(swell).connect(out);
    stops.push(() => src.stop(), () => lfo.stop());
  } else {
    const src = loop(c, "pink");
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 520;
    bp.Q.value = 0.8;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const depth = c.createGain();
    depth.gain.value = 260;
    lfo.connect(depth).connect(bp.frequency);
    lfo.start();
    src.connect(bp).connect(out);
    stops.push(() => src.stop(), () => lfo.stop());
  }
  return {
    gain: out,
    stop: () => {
      stops.forEach((s) => {
        try {
          s();
        } catch {
          /* already stopped */
        }
      });
      out.disconnect();
    },
  };
}

/** The fader. Square law, 120 ms glide, and a teardown only after the tail. */
export function setLayer(id: LayerId, vol: number) {
  const c = getCtx();
  if (!c) return;
  const clamped = Math.min(1, Math.max(0, vol));
  volumes = { ...volumes, [id]: clamped };
  if (clamped > 0 && !nodes[id]) nodes[id] = build(id, c);
  const n = nodes[id];
  if (n) {
    n.gain.gain.cancelScheduledValues(c.currentTime);
    n.gain.gain.setTargetAtTime(clamped * clamped * 0.55, c.currentTime, 0.12);
    if (clamped === 0) {
      const node = n;
      window.setTimeout(() => {
        if (volumes[id] === 0 && nodes[id] === node) {
          node.stop();
          delete nodes[id];
        }
      }, 700);
    }
  }
  listeners.forEach((l) => l());
}

export function stopAll() {
  (Object.keys(volumes) as LayerId[]).forEach((id) => setLayer(id, 0));
}

export function getVolumes() {
  return volumes;
}

export function subscribeAudio(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Storage key for the completion chime; on unless the user turns it off. */
export const CHIME_PREFERENCE_KEY = "focusarx-completion-chime";

/** Whether the completion chime is enabled (the uploads' default: it is). */
export function completionChimeEnabled(): boolean {
  try {
    return window.localStorage.getItem(CHIME_PREFERENCE_KEY) !== "off";
  } catch {
    return true; // private mode: keep the designed default rather than going silent
  }
}

export function setCompletionChime(enabled: boolean): void {
  try {
    window.localStorage.setItem(CHIME_PREFERENCE_KEY, enabled ? "on" : "off");
  } catch {
    /* private mode — the chime simply keeps its default */
  }
}

/** Rising four-note arpeggio, used by the uploads for "session done". */
export function playChime() {
  const c = getCtx();
  if (!c || !master) return;
  // Respects the user's choice; a session ending is a moment, not a launch.
  if (!completionChimeEnabled()) return;
  const t0 = c.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    const t = t0 + i * 0.16;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g).connect(master!);
    o.start(t);
    o.stop(t + 1.5);
  });
}

/**
 * Two more one-shots from `new-chat.zip`'s `lib/audio.ts`, kept as a pair with
 * the chime above rather than merged into it: theirs distinguishes a finished
 * block from a finished break (a rising three-note "done", a falling two-note
 * "break"), and this app's completion callbacks do not yet carry which one
 * ended, so the break cue is ported and available while the done cue is the one
 * wired to a live moment.
 */
export function playBreakChime() {
  const c = getCtx();
  if (!c || !master) return;
  if (!completionChimeEnabled()) return;
  [783.99, 587.33].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    const t = c.currentTime + i * 0.17;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    o.connect(g).connect(master!);
    o.start(t);
    o.stop(t + 1.4);
  });
}

/** The UI click — 520 Hz triangle, 120 ms. */
export function playClick() {
  const c = getCtx();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "triangle";
  o.frequency.value = 520;
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.14);
}

/** The clock tick — 660 Hz triangle, gone in 180 ms. */
export function playTick() {
  const c = getCtx();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "triangle";
  o.frequency.value = 660;
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.08, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
  o.connect(g).connect(master);
  o.start();
  o.stop(c.currentTime + 0.2);
}

/** Test seam: forget every node and level without touching the context. */
export function __resetForTests() {
  volumes = { rain: 0, brown: 0, ocean: 0, wind: 0 };
  listeners.clear();
  master = null;
  ctx = null;
  engineContextGetter = null;
  (Object.keys(nodes) as LayerId[]).forEach((id) => delete nodes[id]);
}
