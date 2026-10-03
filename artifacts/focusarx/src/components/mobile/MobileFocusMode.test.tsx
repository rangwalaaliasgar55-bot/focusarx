import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MobileFocusMode } from "./MobileFocusMode";

/**
 * The phone's studying screen.
 *
 * Two things are asserted here because they are the two that regress silently:
 * the companion only appears while a session is actually running (a pet on the
 * idle screen, or a missing pet mid-session, are both wrong and neither shows
 * up in a screenshot of the other state), and there is exactly one sound
 * control — this screen used to carry the same speaker twice.
 */

function renderMode(overrides: Partial<Parameters<typeof MobileFocusMode>[0]> = {}) {
  return render(
    <MobileFocusMode
      isActive
      mode="focus"
      secondsLeft={1500}
      progress={0.2}
      isRunning
      onPause={() => {}}
      onResume={() => {}}
      onEnd={() => {}}
      onToggleSound={() => {}}
      {...overrides}
    />,
  );
}

afterEach(cleanup);

describe("MobileFocusMode", () => {
  it("shows the companion above the clock while the session runs", () => {
    renderMode({ companion: <span data-testid="the-pet">Luna</span> });
    const stage = screen.getByTestId("focus-mode-companion");
    expect(stage.contains(screen.getByTestId("the-pet"))).toBe(true);
    // Above the clock in the reading order, so a screen reader meets the pet
    // before the digits too.
    const clock = screen.getByText("25:00");
    expect(stage.compareDocumentPosition(clock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders nothing at all when no session is in focus", () => {
    renderMode({ isActive: false, companion: <span data-testid="the-pet">Luna</span> });
    expect(screen.queryByTestId("focus-mode-companion")).toBeNull();
    expect(screen.queryByTestId("the-pet")).toBeNull();
  });

  it("has one sound control, not two", () => {
    renderMode();
    expect(screen.getAllByRole("button", { name: /ambient sound/i })).toHaveLength(1);
  });
});
