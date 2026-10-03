import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHIME_PREFERENCE_KEY,
  LAYERS,
  __resetForTests,
  getVolumes,
  playBreakChime,
  playChime,
  playClick,
  playTick,
  setCompletionChime,
  setLayer,
  stopAll,
  subscribeAudio,
} from "./audioLayers";

/**
 * The uploaded mixer is a small piece of DSP with three contracts that are easy
 * to break silently: the fader law (square, scaled 0.55), the tail (a layer
 * keeps playing 700 ms after it is zeroed, then stops), and the two one-shots
 * (the four-note chime, the 660 Hz tick).
 *
 * jsdom has no WebAudio, so the module runs against a fake AudioContext that
 * records what was asked of it. The fake is deliberately dumb — it stores gain
 * targets and start/stop calls — because the point is to pin *the port*, not to
 * simulate an audio graph.
 */

interface FakeParam {
  value: number;
  scheduled: Array<{ target: number; at: number }>;
  cancelScheduledValues: (t: number) => void;
  setTargetAtTime: (target: number, when: number, tc: number) => void;
  setValueAtTime: (v: number) => void;
  linearRampToValueAtTime: (v: number) => void;
  exponentialRampToValueAtTime: (v: number) => void;
}

/** Every gain node the module builds, in creation order. */
let gains: FakeParam[] = [];
let started: string[] = [];
let stopped: string[] = [];
let tones: Array<{ type: string; frequency: number }> = [];
let resumed = 0;

function fakeParam(value: number): FakeParam {
  const p: FakeParam = {
    value,
    scheduled: [],
    cancelScheduledValues: () => {},
    setTargetAtTime: (target, when, tc) => {
      p.value = target;
      p.scheduled.push({ target, at: when + tc });
    },
    setValueAtTime: (v) => {
      p.value = v;
    },
    linearRampToValueAtTime: (v) => {
      p.value = v;
    },
    exponentialRampToValueAtTime: (v) => {
      p.value = v;
    },
  };
  return p;
}

function chain() {
  return { connect: (node: unknown) => node, disconnect: () => {} };
}

function createFakeContext() {
  return {
    sampleRate: 8000, // small buffers: the 4-second noise fill stays cheap
    currentTime: 10,
    state: "running",
    destination: { kind: "destination" },
    resume: () => {
      resumed += 1;
    },
    createGain: () => {
      const gain = fakeParam(0);
      gains.push(gain);
      return { gain, ...chain() };
    },
    createBiquadFilter: () => ({
      type: "",
      frequency: fakeParam(0),
      Q: fakeParam(0),
      gain: fakeParam(0),
      ...chain(),
    }),
    createOscillator: () => {
      const tone = { type: "", frequency: 0 };
      const param = fakeParam(0);
      Object.defineProperty(tone, "frequency", {
        get: () => param.value,
        set: (v: number) => {
          param.value = v;
        },
      });
      return {
        get type() {
          return tone.type;
        },
        set type(v: string) {
          tone.type = v;
        },
        frequency: param,
        start: () => {
          started.push("osc");
          tones.push({ type: tone.type, frequency: param.value });
        },
        stop: () => stopped.push("osc"),
        ...chain(),
      };
    },
    createBufferSource: () => ({
      buffer: null as null | { duration: number },
      loop: false,
      loopEnd: 0,
      start: () => started.push("src"),
      stop: () => stopped.push("src"),
      ...chain(),
    }),
    createBuffer: (_ch: number, len: number, rate: number) => ({
      duration: len / rate,
      getChannelData: () => new Float32Array(len),
    }),
  } as unknown as AudioContext;
}

beforeEach(() => {
  vi.useFakeTimers();
  __resetForTests();
  gains = [];
  started = [];
  stopped = [];
  tones = [];
  resumed = 0;
  (window as unknown as { AudioContext: unknown }).AudioContext = function FakeAudioContext() {
    return createFakeContext();
  };
});

afterEach(() => {
  __resetForTests();
  vi.useRealTimers();
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
});

describe("the uploaded layer mixer", () => {
  it("keeps the uploads' four layers, labels and hints, in order", () => {
    expect(LAYERS.map((l) => l.id)).toEqual(["rain", "brown", "ocean", "wind"]);
    expect(LAYERS.map((l) => l.label)).toEqual(["Rain", "Brown noise", "Ocean", "Wind"]);
    expect(LAYERS.every((l) => l.hint.length > 0)).toBe(true);
    // Every fader starts silent — the mixer never makes noise on mount.
    expect(getVolumes()).toEqual({ rain: 0, brown: 0, ocean: 0, wind: 0 });
  });

  it("applies the square fader law scaled by 0.55", () => {
    setLayer("rain", 0.5);

    // The layer's own gain is the last node built; the target the module asked
    // for is 0.5² × 0.55 = 0.1375, not 0.5.
    const layerGain = gains.at(-1)!;
    expect(layerGain.scheduled.at(-1)?.target).toBeCloseTo(0.1375, 6);

    setLayer("rain", 0.2);
    expect(layerGain.scheduled.at(-1)?.target).toBeCloseTo(0.2 * 0.2 * 0.55, 6);
  });

  it("clamps a fader to 0…1 and notifies subscribers on every change", () => {
    const seen: number[] = [];
    const off = subscribeAudio(() => seen.push(getVolumes().rain));
    setLayer("rain", 2);
    setLayer("rain", -1);
    expect(seen).toEqual([1, 0]);
    off();
    setLayer("rain", 0.4);
    expect(seen).toEqual([1, 0]);
  });

  it("starts a layer's sources only once, however often the fader moves", () => {
    setLayer("ocean", 0.2);
    const firstStart = started.length;
    expect(firstStart).toBeGreaterThan(0);
    setLayer("ocean", 0.6);
    setLayer("ocean", 0.9);
    expect(started.length).toBe(firstStart);
  });

  it("holds a zeroed layer for 700 ms, then tears its nodes down", () => {
    setLayer("ocean", 0.6);
    setLayer("ocean", 0);
    expect(stopped).toEqual([]);
    vi.advanceTimersByTime(699);
    expect(stopped).toEqual([]);
    vi.advanceTimersByTime(2);
    expect(stopped.length).toBeGreaterThan(0);
  });

  it("does not tear down a layer that came back before the tail ran out", () => {
    setLayer("wind", 0.5);
    setLayer("wind", 0);
    setLayer("wind", 0.3);
    vi.advanceTimersByTime(1000);
    expect(stopped).toEqual([]);
    stopAll();
  });

  it("plays the uploads' four-note chime and their 660 Hz tick", () => {
    playChime();
    expect(tones.map((t) => t.frequency)).toEqual([523.25, 659.25, 783.99, 1046.5]);
    expect(tones.every((t) => t.type === "sine")).toBe(true);

    playTick();
    expect(tones.at(-1)).toEqual({ type: "triangle", frequency: 660 });
  });

  it("keeps the other upload's break cue and click as their own one-shots", () => {
    playBreakChime();
    expect(tones.map((t) => t.frequency)).toEqual([783.99, 587.33]);
    playClick();
    expect(tones.at(-1)).toEqual({ type: "triangle", frequency: 520 });
  });

  it("goes quiet when the chime is switched off, and comes back on", () => {
    setCompletionChime(false);
    const before = tones.length;
    playChime();
    playBreakChime();
    expect(tones.length).toBe(before);

    setCompletionChime(true);
    playChime();
    expect(tones.length).toBe(before + 4);
    window.localStorage.removeItem(CHIME_PREFERENCE_KEY);
  });

  it("is a no-op before any context exists (SSR and locked-down browsers)", () => {
    // Both names: the module falls back to the Safari-era `webkitAudioContext`,
    // and jsdom ships a stub under that name whose methods are not implemented.
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    delete (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
    __resetForTests();
    expect(() => setLayer("brown", 0.5)).not.toThrow();
    expect(() => playChime()).not.toThrow();
    expect(resumed).toBe(0);
  });
});
