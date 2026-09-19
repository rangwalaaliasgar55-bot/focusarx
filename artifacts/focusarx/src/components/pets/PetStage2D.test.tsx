import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { PetStage2D, RARITY_GLOW } from "./PetStage2D";

/**
 * The 2D stage is what a companion looks like on every device that cannot run
 * the three.js pet — low-end Android, reduced-motion users, crash recovery,
 * and the explicit 2D toggle. These tests pin that it is still a companion
 * there: named, rarity-lit, mood-aware, and interactable — while never
 * implying that tapping it earns anything (bond XP is server-awarded only).
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("PetStage2D", () => {
  it("renders a labelled, keyboard-reachable stage", () => {
    render(<PetStage2D emoji="🦊" name="Clever Fox" rarity="rare" mood="happy" />);
    const stage = screen.getByRole("button", { name: "Say hi to Clever Fox" });
    expect(stage).toBeTruthy();
  });

  it("shows the server-derived mood in the chip", () => {
    render(<PetStage2D emoji="🦉" name="Night Owl" rarity="common" mood="excited" />);
    expect(screen.getByText("excited")).toBeTruthy();
    expect(screen.getByText("tap to say hi")).toBeTruthy();
  });

  it("hides the mood chip when no mood is known", () => {
    render(<PetStage2D emoji="🐲" name="Study Dragon" rarity="legendary" />);
    expect(screen.queryByText("tap to say hi")).toBeNull();
    // The stage still renders as a named companion.
    expect(screen.getByRole("button", { name: "Say hi to Study Dragon" })).toBeTruthy();
  });

  it("tapping greets back and cleans the ripple up after it plays", () => {
    const { container } = render(<PetStage2D emoji="🦊" name="Clever Fox" rarity="rare" mood="happy" />);
    const stage = screen.getByRole("button", { name: "Say hi to Clever Fox" });

    fireEvent.click(stage);
    expect(screen.getByText("Clever Fox noticed you")).toBeTruthy();
    expect(container.querySelector("[data-ripple]")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.querySelector("[data-ripple]")).toBeNull();
  });

  it("never promises rewards for tapping", () => {
    render(<PetStage2D emoji="🦊" name="Clever Fox" rarity="rare" mood="happy" />);
    const stage = screen.getByRole("button", { name: "Say hi to Clever Fox" });
    fireEvent.click(stage);
    const copy = document.body.textContent ?? "";
    expect(copy.toLowerCase()).not.toContain("xp");
    expect(copy.toLowerCase()).not.toContain("token");
    expect(copy.toLowerCase()).not.toContain("coin");
  });

  it("has a glow for every rarity the catalog uses", () => {
    for (const rarity of ["common", "rare", "epic", "legendary", "exclusive"]) {
      expect(RARITY_GLOW[rarity as keyof typeof RARITY_GLOW], rarity).toMatch(/^rgba\(/);
    }
  });

  it("shows the animated catalog sprite when one is provided", () => {
    const { container } = render(<PetStage2D emoji="🐾" imageUrl="https://sprites.example/pikachu.gif" name="Pikachu" />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("https://sprites.example/pikachu.gif");
    // Decorative — the stage button carries the accessible name.
    expect(img!.getAttribute("aria-hidden")).toBe("true");
    // CLS guard: the sprite reserves its box before loading.
    expect(img!.getAttribute("width")).toBeTruthy();
    expect(img!.getAttribute("height")).toBeTruthy();
    // The glyph stands down while the sprite is up.
    expect(screen.queryByText("🐾")).toBeNull();
  });

  it("drops back to the glyph if the sprite fails", () => {
    const { container } = render(<PetStage2D emoji="🐾" imageUrl="https://sprites.example/dead.gif" name="Ghost" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("🐾")).toBeTruthy();
  });
});
