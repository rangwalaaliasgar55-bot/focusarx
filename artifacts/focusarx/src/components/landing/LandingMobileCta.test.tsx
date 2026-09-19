import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LandingMobileCta } from "./LandingMobileCta";
import { CONSENT_STORAGE_KEY } from "@/lib/consent";

/**
 * The sticky mobile CTA is a conversion aid, so its visibility rules are the
 * product behaviour: it appears only after the visitor scrolls past the hero,
 * it steps aside for the page's own final CTA near the bottom (and the ad
 * slot above the footer), and it never shows while the cookie-consent banner
 * is still open on a first visit.
 */

function setScroll(y: number, scrollHeight = 4000) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  Object.defineProperty(window, "pageYOffset", { value: y, configurable: true });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    value: scrollHeight,
    configurable: true,
  });
}

beforeEach(() => {
  localStorage.clear();
  // Returning visitor: consent already answered, so the scroll zone alone
  // decides visibility in these cases.
  localStorage.setItem(CONSENT_STORAGE_KEY, "false");
  setScroll(0);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("LandingMobileCta", () => {
  it("stays hidden at the top of the page", () => {
    render(<LandingMobileCta />);
    setScroll(200);
    fireEvent.scroll(window);
    expect(screen.queryByText("Ready when you are")).toBeNull();
  });

  it("appears once the visitor scrolls past the hero", () => {
    render(<LandingMobileCta />);
    setScroll(900);
    fireEvent.scroll(window);
    const link = screen.getByRole("link", { name: /start focusing/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/focus");
  });

  it("hides again near the bottom, where the page already has a CTA", () => {
    render(<LandingMobileCta />);
    // innerHeight is 768 in jsdom; scrollHeight 4000 → bottom zone starts at
    // 4000 - 768 - 420 = 2812.
    setScroll(3000);
    fireEvent.scroll(window);
    expect(screen.queryByText("Ready when you are")).toBeNull();
  });

  it("stays hidden while the cookie-consent choice is still open", () => {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    render(<LandingMobileCta />);
    setScroll(900);
    fireEvent.scroll(window);
    expect(screen.queryByText("Ready when you are")).toBeNull();

    // The visitor answers the banner; the next scroll re-evaluates and the
    // bar appears in the bottom position (no lifted offset to collide with
    // anything).
    localStorage.setItem(CONSENT_STORAGE_KEY, "false");
    fireEvent.scroll(window);
    expect(screen.getByRole("link", { name: /start focusing/i })).toBeTruthy();
  });
});
