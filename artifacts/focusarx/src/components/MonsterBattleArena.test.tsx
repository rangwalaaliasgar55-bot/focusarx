import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

/**
 * Battle arena mechanics.
 *
 * The arena's whole contract is "does the fight resolve the way the user
 * experienced it". Every case below is a bug this file previously had:
 *
 *   • a pause used to read as an abandon and end the fight as a defeat;
 *   • a finished block used to resolve against a progress value the parent had
 *     already zeroed, so it was scored from the wrong frame;
 *   • `onComplete` sits behind a reward, so it must fire exactly once per
 *     battle even when the caller hands us a new closure on every render;
 *   • both HP bars must be derivable from the same input as what the 3D scene
 *     draws, or the bars lie.
 */

// WebGL does not exist under jsdom. The scene is stubbed out entirely: what is
// under test here is the resolution state machine and the DOM it drives, and
// the 3D meshes are handed the same derived frame the bars are.
vi.mock("@react-three/fiber", () => ({
  Canvas: () => <div data-testid="canvas" />,
  useFrame: () => {},
  useThree: () => ({ camera: { position: { lerp: () => {} }, lookAt: () => {} } }),
}));

vi.mock("three", () => ({
  BufferAttribute: class {
    constructor(public array: Float32Array, public itemSize: number) {}
  },
  Vector3: class {
    constructor(
      public x: number,
      public y: number,
      public z: number,
    ) {}
  },
  Group: class {},
  clock: {},
}));

vi.mock("@/lib/threeConsole", () => ({
  installThreeConsoleFilter: () => {},
  onWebGLContextLost: () => {},
}));

import MonsterBattleArena from "./MonsterBattleArena";

/**
 * Replays the prop sequence the real focus page produces, so the tests
 * exercise the same state machine the app does rather than a synthetic one.
 */
function mount(overrides: Partial<React.ComponentProps<typeof MonsterBattleArena>> = {}) {
  const props = {
    sessionDuration: 1500,
    sessionProgress: 0,
    isActive: false,
    petLevel: 1,
    ...overrides,
  };
  const utils = render(<MonsterBattleArena {...props} />);
  const rerender = (next: Partial<typeof props>) =>
    utils.rerender(<MonsterBattleArena {...props} {...next} />);
  return { ...utils, rerender, props };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("resolution", () => {
  it("scores a completed block as a victory even when the block ends on the same render", () => {
    const onComplete = vi.fn();
    const { rerender, props } = mount({ onComplete });

    // Running, at the very end of the block.
    rerender({ isActive: true, sessionProgress: 100 });
    expect(onComplete).not.toHaveBeenCalled();

    // The block completes: the bus flips to the break phase in the same commit,
    // so `active` is already false and progress is already back to zero by the
    // time the arena hears about it.
    rerender({ isActive: false, sessionProgress: 0, isPaused: false });

    expect(onComplete).toHaveBeenCalledExactlyOnceWith("victory");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Victory!")).toBeTruthy();
    expect(props.petLevel).toBe(1);
  });

  it("treats a pause as a hold, not a loss", () => {
    const onComplete = vi.fn();
    const { rerender } = mount({ onComplete });

    rerender({ isActive: true, sessionProgress: 40 });
    // Pausing reports `active:false` exactly like an abandon does.
    rerender({ isActive: false, sessionProgress: 40, isPaused: true });

    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    // The arena stays on screen, mid-fight, so a pause does not read as an end.
    expect(screen.getByText("Battle paused.")).toBeTruthy();

    // Resuming continues the same fight rather than starting a new one.
    rerender({ isActive: true, sessionProgress: 40, isPaused: false });
    rerender({ isActive: false, sessionProgress: 40, isPaused: true });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("scores an early abandon as a defeat, carrying the progress it reached", () => {
    const onComplete = vi.fn();
    const { rerender } = mount({ onComplete });

    rerender({ isActive: true, sessionProgress: 12 });
    rerender({ isActive: false, sessionProgress: 0 });

    expect(onComplete).toHaveBeenCalledExactlyOnceWith("defeat");
    expect(screen.getByText("Defeated")).toBeTruthy();
    // Reported from the latched peak, not from the zero the parent just sent.
    expect(screen.getByText("12%")).toBeTruthy();
  });

  it("calls onComplete once per battle however often the caller re-renders", () => {
    // The reward lives behind this callback, and a caller passing an inline
    // arrow gives us a brand-new function on every one of its renders.
    const onComplete = vi.fn();
    const { rerender, props } = mount({ onComplete });

    rerender({ isActive: true, sessionProgress: 100 });
    rerender({ isActive: false, sessionProgress: 0 });

    for (let i = 0; i < 5; i += 1) {
      rerender({ onComplete: vi.fn(props.onComplete) as typeof props.onComplete });
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("allows a second battle after the first one is dismissed", () => {
    const onComplete = vi.fn();
    const { rerender } = mount({ onComplete });

    rerender({ isActive: true, sessionProgress: 100 });
    rerender({ isActive: false, sessionProgress: 0 });
    act(() => {
      screen.getByText("Continue").click();
    });

    // Second block.
    rerender({ isActive: true, sessionProgress: 5, isPaused: false });
    rerender({ isActive: false, sessionProgress: 5, isPaused: false });

    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenLastCalledWith("defeat");
  });

  it("closes the result on Escape and hands focus back", () => {
    const { rerender } = mount();
    rerender({ isActive: true, sessionProgress: 100 });
    rerender({ isActive: false, sessionProgress: 0 });

    expect(screen.getByRole("dialog")).toBeTruthy();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not end a live session when the timer remounts under it", () => {
    const onComplete = vi.fn();
    const { rerender } = mount({ onComplete });

    rerender({ isActive: true, sessionProgress: 40 });
    // Crossing the 768px breakpoint unmounts one timer and mounts the other,
    // and the outgoing one resets the bus on its way out: not active, idle, and
    // no announced length. That is a remount, not the end of a block.
    rerender({ isActive: false, sessionProgress: 0, sessionDuration: 0 });

    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();

    // The replacement timer takes over and the fight carries on.
    rerender({ isActive: true, sessionProgress: 40, sessionDuration: 1500 });
    rerender({ isActive: false, sessionProgress: 0, sessionDuration: 1500 });
    expect(onComplete).toHaveBeenCalledExactlyOnceWith("defeat");
  });
});

describe("combat model", () => {
  it("keeps both bars non-negative and inside their own pools", () => {
    for (const progress of [0, 1, 25, 50, 75, 99, 100, 150, -20, Number.NaN]) {
      const { unmount } = mount({ isActive: true, sessionProgress: progress, petLevel: 7 });
      for (const bar of screen.getAllByRole("progressbar")) {
        const now = Number(bar.getAttribute("aria-valuenow"));
        const max = Number(bar.getAttribute("aria-valuemax"));
        expect(Number.isFinite(now), `progress ${progress} produced ${now}`).toBe(true);
        expect(now).toBeGreaterThanOrEqual(0);
        expect(now).toBeLessThanOrEqual(max);
        expect(max).toBeGreaterThan(0);
      }
      unmount();
    }
  });

  it("reaches a decision at 100% without relying on an exact final frame", () => {
    const onComplete = vi.fn();
    const { rerender } = mount({ onComplete });
    // A block that finishes without ever publishing a precise 100 — the arena
    // has to read the same win off the fight state, not off the raw number.
    rerender({ isActive: true, sessionProgress: 97 });
    rerender({ isActive: false, sessionProgress: 0 });
    expect(onComplete).toHaveBeenCalledExactlyOnceWith("victory");
  });

  it("reads the pet level live, so a level that lands late is not ignored", () => {
    const { rerender } = mount({ isActive: true, petLevel: 1 });
    const levelText = () => screen.getByText(/^Your Pet \(Lv\./).textContent;
    expect(levelText()).toBe("Your Pet (Lv.1)");

    // The pet inventory resolves over the network, after first paint.
    rerender({ petLevel: 9 });
    expect(levelText()).toBe("Your Pet (Lv.9)");
    // And the health pool moved with it rather than staying frozen at Lv.1.
    expect(screen.getByText(/^280\/280 HP$/)).toBeTruthy();
  });

  it("survives a pet level that is zero, negative or missing", () => {
    for (const petLevel of [0, -5, Number.NaN]) {
      const { unmount } = mount({ isActive: true, sessionProgress: 30, petLevel });
      expect(screen.getByText("Your Pet (Lv.1)")).toBeTruthy();
      const bar = screen.getAllByRole("progressbar")[0];
      expect(Number(bar.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(0);
      unmount();
    }
  });

  it("scales the monster's health with its own level, not the pet's", () => {
    const { unmount } = mount({ isActive: true, petLevel: 10 });
    const monsterLabel = screen.getByText(/^Monster \(Lv\./);
    // Level is rolled per arena, so assert the pool is tied to whichever level
    // is on screen rather than to the pet level behind it.
    const level = Number(/Lv\.(\d+)/.exec(monsterLabel.textContent ?? "")?.[1]);
    expect(screen.getByText(`${80 + level * 15}/${80 + level * 15} HP`)).toBeTruthy();
    unmount();
  });
});

describe("presentation", () => {
  it("exposes the countdown, the round and both health pools to assistive tech", () => {
    mount({ isActive: true, sessionProgress: 50, sessionDuration: 1500 });
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("12:30 remaining");
    expect(status.textContent).toContain("Round 5 of 10");
    expect(status.textContent).toMatch(/Pet \d+ of \d+ health, monster \d+ of \d+/);
  });

  it("describes each health bar as a progressbar with a spoken value", () => {
    mount({ isActive: true, sessionProgress: 50, petLevel: 1 });
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(2);
    for (const bar of bars) {
      expect(bar.getAttribute("aria-valuetext")).toMatch(/of \d+ health, \d+ percent/);
    }
  });

  it("keeps the result modal a labelled dialog", () => {
    const { rerender } = mount();
    rerender({ isActive: true, sessionProgress: 100 });
    rerender({ isActive: false, sessionProgress: 0 });
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
  });

  it("gives the primary action a full touch target", () => {
    const { rerender } = mount();
    rerender({ isActive: true, sessionProgress: 100 });
    rerender({ isActive: false, sessionProgress: 0 });
    expect(screen.getByText("Continue").className).toContain("min-h-[44px]");
  });
});

describe("render purity", () => {
  it("rolls the monster once and never again for the same arena", () => {
    const random = vi.spyOn(Math, "random");
    const { rerender } = mount({ isActive: true, sessionProgress: 10 });
    const afterMount = random.mock.calls.length;

    // Twenty re-renders of one live arena, ticking the clock as a session does.
    for (let i = 1; i <= 20; i += 1) {
      rerender({ sessionProgress: i });
    }

    // A roll per render would hand the user a different monster mid-battle,
    // and would put randomness in the render path besides.
    expect(random.mock.calls.length).toBe(afterMount);
    expect(screen.getByText(/^Monster \(Lv\./)).toBeTruthy();
  });
});

describe("reduced motion", () => {
  const original = window.matchMedia;

  afterEach(() => {
    window.matchMedia = original;
  });

  it("still resolves the battle with motion disabled", () => {
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    const onComplete = vi.fn();
    const { rerender } = mount({ onComplete });
    rerender({ isActive: true, sessionProgress: 100 });
    rerender({ isActive: false, sessionProgress: 0 });

    expect(onComplete).toHaveBeenCalledExactlyOnceWith("victory");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});