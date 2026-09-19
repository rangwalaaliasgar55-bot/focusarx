import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
