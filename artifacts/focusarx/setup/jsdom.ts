/**
 * jsdom stand-ins for Web APIs jsdom does not implement.
 *
 * Each stub below exists because jsdom lacks the API, NOT to paper over a real
 * browser error. Anything that logs in a real browser must still log here, so
 * these are deliberately inert: they never throw and never call back.
 *
 * Deliberately NOT stubbed (so real problems surface):
 *   - console.error / console.warn — these are what the suite asserts on
 *   - window.onerror / unhandledrejection — captured, not swallowed
 */
import { vi } from "vitest";

class IntersectionObserverStub {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: number[] = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class MutationObserverStub {
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
}

const g = globalThis as unknown as Record<string, unknown>;
const w = window as unknown as Record<string, unknown>;

for (const target of [g, w]) {
  target.IntersectionObserver ??= IntersectionObserverStub;
  target.ResizeObserver ??= ResizeObserverStub;
  target.MutationObserver ??= MutationObserverStub;
}

// matchMedia — jsdom has none; next-themes and the mobile hooks both call it.
if (!window.matchMedia) {
  w.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// Scroll / measurement APIs jsdom leaves at 0 or unimplemented.
w.scrollTo ??= () => {};
Element.prototype.scrollIntoView ??= function () {};
// jsdom ships a stub that returns all zeros; layout-dependent code needs a real box.
{
  Element.prototype.getBoundingClientRect = function () {
    return { x: 0, y: 0, width: 1024, height: 768, top: 0, left: 0, right: 1024, bottom: 768, toJSON: () => ({}) } as DOMRect;
  };
}

// Audio — the ambient engine and focus sounds construct an AudioContext.
class AudioContextStub {
  currentTime = 0;
  state = "suspended" as const;
  sampleRate = 44100;
  destination = {};
  resume = async () => {};
  suspend = async () => {};
  close = async () => {};
  createGain = () => ({ gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} });
  createOscillator = () => ({ frequency: { value: 0, setValueAtTime() {} }, connect() {}, start() {}, stop() {} });
  createBufferSource = () => ({ buffer: null, connect() {}, start() {}, stop() {} });
  createBiquadFilter = () => ({ frequency: { value: 0 }, Q: { value: 0 }, connect() {}, disconnect() {} });
  createAnalyser = () => ({ fftSize: 0, frequencyBinCount: 0, getByteFrequencyData() {}, connect() {} });
  decodeAudioData = async () => ({});
}
w.AudioContext ??= AudioContextStub;
w.webkitAudioContext ??= AudioContextStub;

// Media / camera / sensors — FocusCamera and the posture detector use these.
w.MediaRecorder ??= class { static isTypeSupported = () => false; start() {} stop() {} };
w.navigator.mediaDevices ??= {
  getUserMedia: async () => { throw new Error("getUserMedia unavailable in jsdom"); },
  enumerateDevices: async () => [],
} as unknown as MediaDevices;

// requestIdleCallback — used by deferred boot work.
w.requestIdleCallback ??= ((cb: (d: { didTimeout: boolean; timeRemaining: () => number }) => void) =>
  setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 1)) as unknown;
w.cancelIdleCallback ??= ((id: number) => clearTimeout(id)) as unknown;

// Third-party scripts are never fetched in jsdom; make the failure mode inert
// so the suite reports *our* errors, not "network request failed" noise.
w.fetch ??= (async () => ({ ok: false, status: 0, json: async () => ({}), text: async () => "" })) as unknown;

// Silence React's act() environment notice — the suite drives renders through
// @testing-library, which wraps in act() itself.
vi.stubEnv("IS_REACT_ACT_ENVIRONMENT", "true");
