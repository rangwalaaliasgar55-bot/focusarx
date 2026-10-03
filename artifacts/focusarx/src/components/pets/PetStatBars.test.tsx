import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PetStatBars } from "./PetStatBars";
import { statsFor } from "@/lib/petBattle";

/**
 * The uploads' companion stat rows.
 *
 * The point of these tests is that the numbers are *the engine's*: a showcase
 * that grows its own copy of the stat curve is a showcase that starts lying the
 * first time the curve moves, and this app has exactly one place where a level
 * becomes HP/ATK/DEF/SPD (`lib/petBattle.statsFor`).
 */

afterEach(cleanup);

function rowValues() {
  // `dd > span`: the track and the printed value. The bar itself is a span
  // inside the track, which is why this is not a bare descendant selector.
  return [...document.querySelectorAll("[data-testid='pet-stat-bars'] > div")].map((row) => {
    const [track, value] = row.querySelectorAll("dd > span");
    return {
      label: row.querySelector("dt")?.textContent,
      value: Number(value?.textContent),
      width: (track?.firstElementChild as HTMLElement | null)?.style.width,
    };
  });
}

describe("PetStatBars", () => {
  it("shows the four stats the engine fights with", () => {
    const stats = statsFor("fox", 7);
    render(<PetStatBars slug="fox" level={7} />);

    expect(rowValues()).toEqual([
      { label: "HP", value: stats.hp, width: expect.stringMatching(/%$/) },
      { label: "ATK", value: stats.atk, width: expect.stringMatching(/%$/) },
      { label: "DEF", value: stats.def, width: expect.stringMatching(/%$/) },
      { label: "SPD", value: stats.spd, width: expect.stringMatching(/%$/) },
    ]);
  });

  it("normalises against the level cap, not against a flat table", () => {
    // At the cap every bar is full; at level 1 none of them are. A copied flat
    // table (`{hp: 260, atk: 90, …}`) would fail the first assertion for every
    // species in the catalog.
    const { unmount } = render(<PetStatBars slug="owl" level={20} maxLevel={20} />);
    expect(rowValues().map((row) => row.width)).toEqual(["100%", "100%", "100%", "100%"]);
    unmount();

    render(<PetStatBars slug="owl" level={1} maxLevel={20} />);
    const open = statsFor("owl", 1);
    const cap = statsFor("owl", 20);
    const widths = rowValues().map((row) => row.width);
    // Exactly the ratio the engine's own numbers give, and never full.
    expect(widths).toEqual(["hp", "atk", "def", "spd"].map((key) =>
      `${Math.round((open[key as keyof typeof open] / cap[key as keyof typeof cap]) * 100)}%`,
    ));
    for (const width of widths) {
      expect(Number.parseInt(width ?? "100", 10)).toBeLessThan(100);
    }
  });

  it("keeps the bar decoration out of the accessible reading", () => {
    render(<PetStatBars slug="capybara" level={12} />);
    // The bar is a picture of the number printed beside it, so it is hidden
    // from assistive tech rather than announced as a percentage of something
    // the screen never names.
    for (const bar of document.querySelectorAll("[data-testid='pet-stat-bars'] dd > span:first-child")) {
      expect(bar.getAttribute("aria-hidden")).toBe("true");
    }
    const stats = statsFor("capybara", 12);
    expect(screen.getByText(String(stats.hp))).toBeTruthy();
  });
});
