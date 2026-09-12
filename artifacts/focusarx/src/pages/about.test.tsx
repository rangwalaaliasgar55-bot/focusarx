import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import AboutPage from "./about";
import { TEAM_AUTHOR } from "@/content/authors.mjs";

/**
 * The About page is where E-E-A-T is either demonstrated or merely claimed.
 *
 * scripts/seo-validate.mjs checks the *prerendered* document, which is what a
 * crawler reads first. This checks the rendered page a human ends up on, so the
 * editorial standards and the byline cannot be lost between the two — the
 * failure mode being a section that exists in the static HTML and disappears
 * the moment React hydrates.
 */

afterEach(cleanup);

describe("About page", () => {
  it("names who is responsible for the site", () => {
    const { container } = render(<AboutPage />);
    const copy = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(copy).toContain(TEAM_AUTHOR.name);
    expect(copy).toContain("Who writes this");
  });

  it("states the editorial standards, including the corrections route", () => {
    const { container } = render(<AboutPage />);
    const copy = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(copy).toContain("How we research what we publish");
    for (const promise of [
      "Sources you can open",
      "Numbers with a ledger",
      "Review dates, not build dates",
      "No clinical claims",
      "No advertising, no data sales",
    ]) {
      expect(copy, `missing standard: ${promise}`).toContain(promise);
    }
    expect(container.querySelector('a[href="mailto:focusarx@gmail.com?subject=Correction"]')).toBeTruthy();
  });

  it("carries the same visible review date as the prerendered document", () => {
    const { container } = render(<AboutPage />);
    const copy = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(copy).toContain("Last updated 11 September 2026");
    const time = Array.from(container.querySelectorAll("time")).find(
      (t) => t.getAttribute("datetime") === "2026-09-11",
    );
    expect(time, "the review date must be machine-readable").toBeTruthy();
  });

  it("links the pages that back the standards up", () => {
    const { container } = render(<AboutPage />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    for (const target of ["/evidence", "/camera-data", "/accessibility", "/safety"]) {
      expect(hrefs, `About should link to ${target}`).toContain(target);
    }
  });
});
