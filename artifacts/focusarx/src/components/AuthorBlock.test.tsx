import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { AuthorBlock, formatLongDate } from "./AuthorBlock";
import { TEAM_AUTHOR } from "@/content/authors.mjs";

/**
 * The byline — the visible half of E-E-A-T.
 *
 * scripts/seo-validate.mjs gates the *emitted* HTML for a byline, a visible
 * "Last updated" date and a schema dateModified that agrees with it. This file
 * covers the rendered component, which the gate cannot see: the same dates have
 * to survive hydration, or the static document and the page a reader ends up
 * looking at would disagree about when the copy was last checked.
 *
 * Two rules matter most here, and both are things a well-meaning edit could
 * quietly break:
 *
 *   • a date that is not known is not shown — no build date, no "today", no
 *     empty "Last updated";
 *   • the machine-readable `datetime` is the ISO date, while the text is the
 *     long form a human reads. Google uses the first, the reader the second.
 */

afterEach(cleanup);

function text(container: HTMLElement) {
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("AuthorBlock", () => {
  it("names the team by default, with a way to find out who that is", () => {
    const { container } = render(<AuthorBlock />);
    const copy = text(container);
    expect(copy).toContain(TEAM_AUTHOR.name);
    expect(copy).toContain(TEAM_AUTHOR.role);
    expect(container.querySelector('a[href="/about"]')).toBeTruthy();
  });

  it("shows a review date as a real <time>, ISO in datetime and long-form in text", () => {
    const { container } = render(<AuthorBlock lastReviewed="2026-09-11" />);
    const times = Array.from(container.querySelectorAll("time"));
    const updated = times.find((t) => t.getAttribute("datetime") === "2026-09-11");
    expect(updated, "the review date must be a <time datetime=…> element").toBeTruthy();
    expect(text(updated!)).toBe("Last updated 11 September 2026");
  });

  it("shows publication date and read time when a post has them", () => {
    const { container } = render(<AuthorBlock published="2026-09-05" readMin={6} lastReviewed="2026-09-05" />);
    const copy = text(container);
    expect(copy).toContain("5 September 2026");
    expect(copy).toContain("6 min read");
    const datetimes = Array.from(container.querySelectorAll("time")).map((t) => t.getAttribute("datetime"));
    expect(datetimes.filter((d) => d === "2026-09-05").length).toBe(2);
  });

  it("invents no date when none is known", () => {
    const { container } = render(<AuthorBlock />);
    expect(container.querySelectorAll("time").length).toBe(0);
    expect(text(container)).not.toContain("Last updated");
    // The byline still says who is responsible — anonymity is not the fallback.
    expect(text(container)).toContain(TEAM_AUTHOR.name);
  });

  it("accepts a named author object and keeps the id for schema parity", () => {
    const { container } = render(
      <AuthorBlock author={{ id: "someone-real", name: "Someone Real", role: "Reviewer" }} />,
    );
    const copy = text(container);
    expect(copy).toContain("Someone Real");
    expect(copy).toContain("Reviewer");
    // An id nobody has registered falls back to the team rather than printing
    // a name that does not exist.
    const { container: fallback } = render(<AuthorBlock author="nobody-by-that-name" />);
    expect(text(fallback)).toContain(TEAM_AUTHOR.name);
  });
});

describe("formatLongDate", () => {
  it("renders the site's house date format", () => {
    expect(formatLongDate("2026-09-11")).toBe("11 September 2026");
    expect(formatLongDate("2026-01-05")).toBe("5 January 2026");
  });

  it("gives back what it was given if it cannot parse it", () => {
    // A malformed date must never become "Invalid Date" on a live page.
    expect(formatLongDate("not-a-date")).toBe("not-a-date");
  });
});
