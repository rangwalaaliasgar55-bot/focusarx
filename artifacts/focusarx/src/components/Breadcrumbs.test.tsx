import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Breadcrumbs } from "./Breadcrumbs";
import { ContentTOC } from "./ContentTOC";
import { breadcrumbTrail } from "@/lib/breadcrumbs.mjs";
import { headingAnchors } from "@/lib/heading-id.mjs";

/**
 * The two pieces of on-page navigation that WS8 adds to every long-form page.
 *
 * What is worth testing is not the markup but the contract each component makes
 * with the prerendered document: the same trail, the same crumb labels, the same
 * anchor ids. scripts/prerender.mjs renders both from the same modules, and
 * scripts/seo-validate.mjs fails the build if a document's visible trail and its
 * BreadcrumbList disagree or a jump link points at a missing id — so these tests
 * are the client-side half of that guarantee.
 */

afterEach(cleanup);

describe("Breadcrumbs", () => {
  it("renders a Breadcrumb landmark with the current page marked", () => {
    render(<Breadcrumbs path="/exam/gre" title="GRE study plan" />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.querySelectorAll("li")).toHaveLength(3);
    const current = screen.getByText("GRE study plan");
    expect(current.getAttribute("aria-current")).toBe("page");
    // The current page is never a link; the crumbs above it are.
    expect(current.closest("a")).toBeNull();
  });

  it("links only crumbs whose hub route exists", () => {
    render(<Breadcrumbs path="/exam/gre" title="GRE study plan" />);
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links).toEqual(["/", "/exam"]);

    cleanup();
    render(<Breadcrumbs path="/pomodoro-timer-for/clat" title="Pomodoro timer for CLAT" />);
    // No /pomodoro-timer-for index page exists yet: plain text, not a dead link.
    expect(screen.queryAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/"]);
    expect(screen.getByText("Pomodoro timers").tagName).toBe("SPAN");
  });

  it("renders nothing on the homepage, where there is no trail", () => {
    const { container } = render(<Breadcrumbs path="/" title="FocusArx" />);
    expect(container.innerHTML).toBe("");
    expect(breadcrumbTrail("/")).toHaveLength(1);
  });
});

describe("ContentTOC", () => {
  const headings = ["How to run it", "Why fifteen minutes", "Frequently asked questions"];

  it("renders an On this page landmark whose anchors match the heading ids", () => {
    render(<ContentTOC headings={headings} />);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    const hrefs = Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(headingAnchors(headings).map((a) => `#${a.id}`));
    expect(hrefs[0]).toBe("#how-to-run-it");
  });

  it("numbers the entries, because an outline reads as a sequence", () => {
    render(<ContentTOC headings={headings} />);
    expect(screen.getByRole("navigation", { name: "On this page" }).textContent).toContain("1");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("stays out of the way when there is nothing to jump between", () => {
    const { container } = render(<ContentTOC headings={["Only one section"]} />);
    expect(container.innerHTML).toBe("");
  });
});
