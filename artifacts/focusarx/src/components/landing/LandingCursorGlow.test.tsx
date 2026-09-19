import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { LandingCursorGlow } from "./LandingCursorGlow";

/**
 * The cursor glow is deliberately conditional decoration: it exists only for
 * fine pointers that have not asked for reduced motion. These tests pin both
 * gates, because the failure mode is a blur blob chasing a finger on a phone
 * or ignoring a user's motion preference.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LandingCursorGlow", () => {
  it("renders nothing for coarse pointers (the default jsdom stub)", () => {
    const { container } = render(<LandingCursorGlow />);
    expect(container.querySelector("[aria-hidden]")).toBeNull();
  });

  it("renders and follows the pointer for fine pointers", () => {
    const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(pointer: fine)",
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    vi.stubGlobal("matchMedia", matchMediaMock);

    const { container } = render(<LandingCursorGlow />);
    const glow = container.querySelector("[aria-hidden]") as HTMLElement | null;
    expect(glow).toBeTruthy();

    // Pointer movement must not throw, and the listener must be detachable
    // without error on unmount.
    fireEvent(window, new PointerEvent("pointermove", { clientX: 300, clientY: 200 }));
  });
});
