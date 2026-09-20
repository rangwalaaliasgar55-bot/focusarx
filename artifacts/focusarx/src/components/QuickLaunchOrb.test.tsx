import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { QuickLaunchOrb } from "./QuickLaunchOrb";

afterEach(cleanup);

describe("QuickLaunchOrb", () => {
  it("starts collapsed with an accessible trigger", () => {
    render(<QuickLaunchOrb />);
    const trigger = screen.getByRole("button", { name: /quick launch — explore/i });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the launcher with the momentum features one tap away", () => {
    render(<QuickLaunchOrb />);
    fireEvent.click(screen.getByRole("button", { name: /quick launch — explore/i }));

    const dialog = screen.getByRole("dialog", { name: /quick launch/i });
    expect(dialog).toBeTruthy();
    // The previously hard-to-find features are all present as links.
    const links = Array.from(dialog.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    for (const href of ["/pets", "/missions", "/quests", "/leaderboard", "/city", "/break-free", "/social", "/achievements"]) {
      expect(links, `missing ${href}`).toContain(href);
    }
  });

  it("closes on Escape and returns focus to the orb", () => {
    render(<QuickLaunchOrb />);
    const trigger = screen.getByRole("button", { name: /quick launch — explore/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when the scrim is clicked", () => {
    render(<QuickLaunchOrb />);
    fireEvent.click(screen.getByRole("button", { name: /quick launch — explore/i }));
    fireEvent.click(screen.getByRole("button", { name: "Close quick launch" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes after navigating to a feature", () => {
    render(<QuickLaunchOrb />);
    fireEvent.click(screen.getByRole("button", { name: /quick launch — explore/i }));
    fireEvent.click(screen.getByText("Companions"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("uses the nav-clearing geometry classes and a scrollable panel", () => {
    // The overlap bug: the orb sat flush with the bottom nav and the panel
    // had no height cap. Both are now driven by index.css media queries —
    // pin that the elements actually carry those hooks.
    render(<QuickLaunchOrb />);
    const trigger = screen.getByRole("button", { name: /quick launch — explore/i });
    expect(trigger.className).toContain("quicklaunch-orb");

    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("quicklaunch-panel");
    expect(dialog.className).toContain("overflow-y-auto");
  });
});

describe("QuickLaunchOrb geometry (the corner-overlap regression)", () => {
  // The bottom-right corner used to be a free-for-all: this orb, the AI coach
  // orb and the focus page's "Tasks & Stats" pill all anchored to it
  // independently and drew on top of each other. The contract now:
  //   coach orb (h-12) → this orb (h-14) stacked one gap above it,
  // with the exact offsets pinned in index.css. These assertions read the
  // real stylesheet so a "small" tweak that puts the orbs back on top of
  // each other fails here instead of shipping.
  const css = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../index.css"), "utf8");
  const coach = { mobileBottom: 7, mobileTop: 10, mdBottom: 2.5, mdTop: 5.5 }; // bottom-28/bottom-10 + h-12, rem

  function mediaBlock(minWidth: number): string {
    const marker = `@media (min-width: ${minWidth}px)`;
    const start = css.indexOf(marker);
    expect(start, `${marker} block must exist`).toBeGreaterThan(-1);
    const open = css.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) return css.slice(open + 1, i);
      }
    }
    throw new Error(`unterminated media block for ${marker}`);
  }

  function rule(block: string, selector: string): string {
    const start = block.indexOf(selector);
    expect(start, `${selector} rule must exist`).toBeGreaterThan(-1);
    const open = block.indexOf("{", start);
    const close = block.indexOf("}", open);
    return block.slice(open + 1, close);
  }

  function remValue(block: string, prop: string): number {
    const m = new RegExp(`${prop}:\\s*([0-9.]+)rem`).exec(block);
    expect(m, `${prop} must be a plain rem length`).toBeTruthy();
    return Number(m![1]);
  }

  it("stacks the orb above the coach orb, never on top of it", () => {
    // Mobile: base .quicklaunch-orb rule.
    const orbBase = rule(css, ".quicklaunch-orb");
    const mobileBottom = remValue(orbBase, "bottom");
    expect(mobileBottom).toBeGreaterThanOrEqual(coach.mobileTop + 0.75);

    // md+: the media-query override, right-aligned with the coach orb edge.
    const md = mediaBlock(768);
    const orbMd = remValue(rule(md, ".quicklaunch-orb"), "bottom");
    expect(orbMd).toBeGreaterThanOrEqual(coach.mdTop + 0.75);
    expect(remValue(rule(md, ".quicklaunch-orb"), "right")).toBe(1.5);
  });

  it("opens the panel above the orb (never under it or under the header)", () => {
    const orbTop = remValue(rule(css, ".quicklaunch-orb"), "bottom") + 3.5; // h-14
    const panelBottom = remValue(rule(css, ".quicklaunch-panel"), "bottom");
    expect(panelBottom).toBeGreaterThanOrEqual(orbTop + 0.5);
    expect(css).toMatch(/\.quicklaunch-panel\s*{[^}]*max-height/);

    const md = mediaBlock(768);
    const orbMdTop = remValue(rule(md, ".quicklaunch-orb"), "bottom") + 3.5;
    expect(remValue(rule(md, ".quicklaunch-panel"), "bottom")).toBeGreaterThanOrEqual(orbMdTop + 0.5);
  });

  it("steps aside while the coach chat panel is open", () => {
    // The open coach panel occupies exactly the band this orb sits in.
    expect(css).toContain("html[data-coach-open] .quicklaunch-orb");
    const coachSource = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "CoachPanel.tsx"), "utf8");
    expect(coachSource).toContain('data-coach-open');
  });
});
