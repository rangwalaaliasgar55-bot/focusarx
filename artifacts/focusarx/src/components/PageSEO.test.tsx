import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PageSEO } from "./PageSEO";
import { HREFLANG_LOCALES } from "@/lib/seo-text.mjs";

/**
 * Hreflang on client-side navigation.
 *
 * The static build writes a four-locale cluster (x-default, en, en-IN, en-GB)
 * into every indexable document, all pointing at that page's own canonical.
 * After hydration the SPA changes route without a new document, so PageSEO has
 * to move the cluster with it: a page that keeps the previous route's
 * alternates tells Google four languages of some *other* page live at this URL.
 *
 * The second rule matters as much as the first — a noindex page must not
 * declare a cluster at all, because every alternate in a cluster is supposed
 * to be live and indexable.
 */

const BASE = "https://www.focusarx.site";

function alternates(): { locale: string; href: string }[] {
  return Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]'),
  ).map((el) => ({
    locale: el.getAttribute("hreflang") ?? "",
    href: el.getAttribute("href") ?? "",
  }));
}

afterEach(() => {
  cleanup();
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
  document.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
});

describe("PageSEO hreflang cluster", () => {
  it("writes one alternate per locale, all pointing at this page's canonical", () => {
    render(<PageSEO title="15 minute timer" description="d" canonical="/15-minute-timer" />);

    const found = alternates();
    expect(found.map((a) => a.locale)).toEqual(HREFLANG_LOCALES);
    for (const alt of found) {
      expect(alt.href).toBe(`${BASE}/15-minute-timer`);
    }
  });

  it("moves the cluster when the route changes, instead of adding to it", () => {
    const { rerender } = render(
      <PageSEO title="GRE guide" description="d" canonical="/exam/gre" />,
    );
    rerender(<PageSEO title="GMAT guide" description="d" canonical="/exam/gmat" />);

    const found = alternates();
    expect(found).toHaveLength(HREFLANG_LOCALES.length);
    expect(found.every((a) => a.href === `${BASE}/exam/gmat`)).toBe(true);
  });

  it("keeps the cluster next to the canonical, not at the end of <head>", () => {
    render(<PageSEO title="t" description="d" canonical="/focus" />);

    const canonical = document.querySelector('link[rel="canonical"]');
    const firstAlternate = document.querySelector('link[rel="alternate"][hreflang]');
    expect(canonical).not.toBeNull();
    expect(firstAlternate).not.toBeNull();
    // Inserted as a block straight after the canonical (allowing for the
    // text node between them).
    expect(canonical!.nextElementSibling).toBe(firstAlternate);
  });

  it("drops the cluster entirely on a noindex page", () => {
    render(<PageSEO title="Search" description="d" canonical="/search" noindex />);

    expect(alternates()).toEqual([]);
    expect(document.querySelector('link[rel="canonical"]')).not.toBeNull();
  });

  it("re-adds the cluster when navigating from a noindex page to an indexable one", () => {
    const { rerender } = render(<PageSEO title="Search" description="d" canonical="/search" noindex />);
    expect(alternates()).toEqual([]);

    rerender(<PageSEO title="Pomodoro timer" description="d" canonical="/pomodoro-timer" />);

    const found = alternates();
    expect(found.map((a) => a.locale)).toEqual(HREFLANG_LOCALES);
    expect(found.every((a) => a.href === `${BASE}/pomodoro-timer`)).toBe(true);
  });
});
