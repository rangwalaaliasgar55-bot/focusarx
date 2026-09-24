import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { TIMER_THEMES, getStoredTimerTheme, setStoredTimerTheme } from "./timerTheme";

const KEY = "focusarx-timer-theme";

describe("timerTheme persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to classic when nothing is stored", () => {
    expect(getStoredTimerTheme()).toBe("classic");
  });

  it("round-trips a stored theme", () => {
    setStoredTimerTheme("neon");
    expect(getStoredTimerTheme()).toBe("neon");
    setStoredTimerTheme("zen");
    expect(getStoredTimerTheme()).toBe("zen");
    setStoredTimerTheme("flip");
    expect(getStoredTimerTheme()).toBe("flip");
  });

  it("ignores a corrupted stored value instead of crashing", () => {
    window.localStorage.setItem(KEY, "sparkle-unicorn");
    expect(getStoredTimerTheme()).toBe("classic");
  });

  it("restores every registered face, not a hand-written subset", () => {
    // The old implementation listed the ids inline, so a new face would be
    // stored on selection and then silently revert to Classic on reload.
    for (const face of TIMER_THEMES) {
      setStoredTimerTheme(face.id);
      expect(getStoredTimerTheme()).toBe(face.id);
    }
  });

  it("ships exactly the documented faces", () => {
    // Order is the picker's order and is part of the UX: the three ring faces
    // first, then the layouts that change what the face means. Adding a face
    // here is a deliberate edit — the list is asserted so a face cannot be
    // introduced without its blurb being written (the loop below).
    expect(TIMER_THEMES.map((t) => t.id)).toEqual([
      "classic", "neon", "zen", "flip", "segments", "bars", "dots", "rounds",
    ]);
    for (const t of TIMER_THEMES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.blurb.length).toBeGreaterThan(0);
      // The picker prints this under the row, so it has to be a sentence a
      // student can act on, not a label repeated ("Dots. A dot face.").
      expect(t.blurb.length, `${t.id} blurb is too short to explain anything`).toBeGreaterThan(30);
      expect(t.blurb.endsWith("."), `${t.id} blurb should be a sentence`).toBe(true);
    }
  });

  it("has a renderer for every layout face", () => {
    // A registered face with no component renders as nothing (the picker still
    // offers it), which is how a design lands half-shipped. `TimerDisplay` is
    // the only place layouts are delegated, so its source is the source of
    // truth: every layout id must appear in its LAYOUT_FACES set.
    const display = readFileSync(path.join(__dirname, "../components/TimerDisplay.tsx"), "utf8");
    const setLine = display.slice(display.indexOf("const LAYOUT_FACES"));
    const declared = setLine.slice(0, setLine.indexOf("]")).match(/"[a-z]+"/g)?.map((q) => q.replace(/"/g, "")) ?? [];
    const registered = TIMER_THEMES.map((t) => t.id);
    const layouts = ["segments", "bars", "dots", "rounds"];
    expect(declared.sort()).toEqual(layouts.slice().sort());
    for (const layout of layouts) {
      expect(registered, `${layout} is a layout but is not in the registry`).toContain(layout);
    }
    const faces = readFileSync(path.join(__dirname, "../components/timerfaces/TimerFaces.tsx"), "utf8");
    for (const layout of layouts) {
      const component = `TimerFace${layout[0]!.toUpperCase()}${layout.slice(1)}`;
      expect(faces, `${component} is registered but not implemented`).toContain(`export function ${component}`);
    }
  });

  it("documents every face in docs/TIMER_LAYOUTS.md", () => {
    // The doc is the answer to "how does each layout work", so a face that is
    // in the picker but not in the doc is a face nobody can explain.
    const doc = readFileSync(path.join(__dirname, "../../../../docs/TIMER_LAYOUTS.md"), "utf8");
    for (const t of TIMER_THEMES) {
      expect(doc, `${t.id} is missing from docs/TIMER_LAYOUTS.md`).toContain(t.label);
    }
  });
});
