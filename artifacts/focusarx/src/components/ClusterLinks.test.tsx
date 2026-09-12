import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ClusterLinks } from "./ClusterLinks";
import { CLUSTERS, pillarLinksFor } from "@/content/clusters.mjs";

/**
 * Pillar/cluster navigation, rendered.
 *
 * The map itself is tested in src/content/clusters.test.ts and the two-way
 * wiring is gated per document in scripts/seo-validate.mjs. What is worth
 * testing here is the component's two behaviours — a pillar shows its whole
 * cluster, a spoke shows the way back up — and the rule that a page never
 * offers a destination it already links to.
 */

afterEach(cleanup);

const pomodoro = CLUSTERS.find((c) => c.id === "pomodoro")!;

function hrefs(container: HTMLElement) {
  return Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
}

describe("ClusterLinks on a pillar", () => {
  it("lists the cluster it holds", () => {
    const { container } = render(<ClusterLinks path="/pomodoro-guide" />);
    const nav = screen.getByRole("navigation", { name: "All Pomodoro pages" });
    expect(nav).toBeTruthy();
    const links = hrefs(container);
    expect(links.length).toBe(pomodoro.spokes.length);
    for (const spoke of pomodoro.spokes) expect(links).toContain(spoke.path);
    // A pillar does not link to itself.
    expect(links).not.toContain("/pomodoro-guide");
  });

  it("skips spokes the page already links to", () => {
    const { container } = render(
      <ClusterLinks path="/pomodoro-guide" exclude={["/pomodoro-timer", "/study-timer"]} />,
    );
    const links = hrefs(container);
    expect(links).not.toContain("/pomodoro-timer");
    expect(links).not.toContain("/study-timer");
    expect(links).toHaveLength(pomodoro.spokes.length - 2);
  });

  it("renders nothing when every spoke is already linked", () => {
    const { container } = render(
      <ClusterLinks path="/pomodoro-guide" exclude={pomodoro.spokes.map((s) => s.path)} />,
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("ClusterLinks on a spoke", () => {
  it("offers the way back to each pillar it belongs to", () => {
    render(<ClusterLinks path="/two-hour-study-method" />);
    const nav = screen.getByRole("navigation", { name: "Topic clusters" });
    expect(nav.textContent).toContain("Pomodoro and Deep work cluster");
    for (const pillar of pillarLinksFor("/two-hour-study-method")) {
      expect(screen.getByText(pillar.label).getAttribute("href")).toBe(pillar.href);
    }
  });

  it("adds neighbours, but never the page itself or an excluded link", () => {
    const { container } = render(
      <ClusterLinks path="/5-minute-timer" exclude={["/pomodoro-timer"]} limit={4} />,
    );
    const links = hrefs(container);
    expect(links).not.toContain("/5-minute-timer");
    expect(links).not.toContain("/pomodoro-timer");
    expect(links).toContain("/pomodoro-guide");
    // One pillar link plus four siblings.
    expect(links).toHaveLength(5);
  });

  it("renders nothing for a page outside every cluster", () => {
    const { container } = render(<ClusterLinks path="/privacy" />);
    expect(container.innerHTML).toBe("");
  });
});
