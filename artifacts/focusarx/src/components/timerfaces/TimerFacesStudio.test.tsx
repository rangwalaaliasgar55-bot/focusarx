import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TIMER_THEMES } from "@/lib/timerTheme";
import { STUDIO_FACES } from "./TimerFacesStudio";
import type { TimerFaceProps } from "./TimerFaces";

/**
 * The ported faces, rendered.
 *
 * The registry gate (`lib/timerTheme.test.ts`) proves each id has a *component*
 * by grepping for its export — which is exactly the kind of check that passes
 * while the face crashes on mount. These six came from a design upload with a
 * different props contract, so the thing worth pinning is that each one renders
 * against *this* app's contract: the spoken label, the finish time, the
 * countdown, and the editable-when-idle rule.
 *
 * No session hint, so the companion face's `useActivePet` skips its request and
 * draws the starter animal — the guest path, which is the one that has to work
 * with no data at all.
 */

afterEach(cleanup);

const PROPS: TimerFaceProps = {
  secondsLeft: 750,
  // A 25-minute block, half spent. `progress` is the *elapsed* fraction, which
  // is the mistake `sessionTotal`'s doc comment is about.
  progress: 0.5,
  totalSeconds: 1500,
  mode: "focus",
  isRunning: true,
  onEditClick: () => {},
  sessionType: "deep_work",
  accent: "#7c3aed",
  accentSoft: "#3f3f46",
};

function renderFace(Face: React.ComponentType<TimerFaceProps>, props: Partial<TimerFaceProps> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <Face {...PROPS} {...props} />
    </QueryClientProvider>,
  );
}

/**
 * The countdown control, found by its accessible name rather than as "the
 * button": each face also renders the idle-only `EditHint`, and both are named
 * from the same spoken label. The countdown is the one that also carries the
 * finish time.
 */
const timeButton = () => screen.getByRole("button", { name: /Finishes at/ }) as HTMLButtonElement;

describe("ported timer faces", () => {
  it("registers every face it exports, and only known ids", () => {
    const known = new Set(TIMER_THEMES.map((t) => t.id));
    for (const id of Object.keys(STUDIO_FACES)) {
      expect(known.has(id as never), `${id} is in STUDIO_FACES but not in TIMER_THEMES`).toBe(true);
    }
    // The five from the first port plus the wedge dial: a face that exists in
    // the registry but not here would render as nothing (the gate in
    // timerTheme.test.ts catches the reverse direction).
    expect(Object.keys(STUDIO_FACES).sort()).toEqual(
      ["analog", "aurora", "companion", "garden", "hourglass", "orbit"],
    );
  });

  it.each(Object.entries(STUDIO_FACES))("renders %s with a spoken countdown and a finish time", (_id, Face) => {
    renderFace(Face);
    // The countdown itself is a `RollingClock` (one element per digit, so it is
    // never a single text node) — the state it publishes is the accessible name.
    const label = timeButton().getAttribute("aria-label") ?? "";
    expect(label).toContain("12 minutes 30 seconds remaining");
    expect(label).toMatch(/Finishes at ./);
  });

  it("disables the edit affordance while the block is running", () => {
    for (const Face of Object.values(STUDIO_FACES)) {
      const { unmount } = renderFace(Face, { isRunning: true });
      expect(timeButton().disabled).toBe(true);
      unmount();
    }
    // ...and offers it when idle, which is the rule the house faces follow.
    for (const Face of Object.values(STUDIO_FACES)) {
      const { unmount } = renderFace(Face, { isRunning: false });
      expect(timeButton().disabled).toBe(false);
      unmount();
    }
  });

  it("draws the analog wedge from the remaining fraction, not the elapsed one", () => {
    const { container } = renderFace(STUDIO_FACES.analog);
    const wedge = container.querySelector("circle[stroke-dasharray]");
    expect(wedge, "the wedge dial is missing").toBeTruthy();
    const [drawn] = (wedge!.getAttribute("stroke-dasharray") ?? "").split(" ").map(Number);
    // Half the block is left, so half the circumference is filled. The radius
    // is the face's own (66 units in a 300×300 viewBox).
    expect(drawn).toBeCloseTo(2 * Math.PI * 66 * 0.5, 0);
    // The dial states its own scale: 25 minutes at twelve o'clock.
    const numerals = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(numerals).toContain("25");

    // A two-hour block switches the scale to tens rather than printing 120.
    const { container: long } = renderFace(STUDIO_FACES.analog, {
      secondsLeft: 3600,
      progress: 0.5,
      totalSeconds: 7200,
    });
    const longNumerals = Array.from(long.querySelectorAll("text")).map((t) => t.textContent);
    expect(longNumerals).toContain("120");
    expect(longNumerals).toContain("10");
  });

  it("shows the companion face's animal on the track with no account loaded", () => {
    const { container } = renderFace(STUDIO_FACES.companion);
    // The walker is an SVG animal from petBodyParams, so the guest still sees a
    // pet rather than an empty track.
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(1);
  });
});
