import { describe, it, expect, beforeEach } from "vitest";
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

  it("ships exactly the documented faces", () => {
    expect(TIMER_THEMES.map((t) => t.id)).toEqual(["classic", "neon", "zen", "flip"]);
    for (const t of TIMER_THEMES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.blurb.length).toBeGreaterThan(0);
    }
  });
});
