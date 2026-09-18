import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PageSEO } from "./PageSEO";
import { clusterFor } from "@/content/locales.mjs";

/**
 * Hreflang on client-side navigation.
 *
 * The static build writes each page's hreflang cluster into its document.
 * After hydration the SPA changes route without a new document, so PageSEO has
 * to move the cluster with it: a page that keeps the previous route's
 * alternates tells Google other languages of some *other* page live at this URL.
 *
 * The expectations come from `clusterFor()` — the same function
 * scripts/prerender.mjs uses at build time — rather than a hard-coded list, so
 * this tests the wiring (does the DOM match what the build wrote?) instead of
 * restating the model. The cluster is no longer four copies of one URL:
 * /pricing advertises five localized editions, and an edition page advertises
 * its English original as x-default.
 *
 * The noindex rules matter as much: a noindex page must not declare a cluster
 * at all, because every alternate in a cluster is supposed to be live and
 * indexable.
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

/** The cluster scripts/prerender.mjs writes for this route, as absolute URLs. */
function built(route: string) {
  return clusterFor(route).map((a) => ({ locale: a.locale, href: `${BASE}${a.href}` }));
}

afterEach(() => {
  cleanup();
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
  document.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
});

describe("PageSEO hreflang cluster", () => {
  it("writes the same cluster the build writes for an English page", () => {
    render(<PageSEO title="15 minute timer" description="d" canonical="/15-minute-timer" />);

    expect(alternates()).toEqual(built("/15-minute-timer"));
  });

  it("moves the cluster when the route changes, instead of adding to it", () => {
    const { rerender } = render(
      <PageSEO title="GRE guide" description="d" canonical="/exam/gre" />,
    );
    rerender(<PageSEO title="GMAT guide" description="d" canonical="/exam/gmat" />);

    expect(alternates()).toEqual(built("/exam/gmat"));
  });

  it("advertises the five localized editions from /pricing", () => {
    render(<PageSEO title="Pricing" description="d" canonical="/pricing" />);

    const byLocale = new Map(alternates().map((a) => [a.locale, a.href]));
    // Each alternate names a real edition URL, not this page's own canonical.
    // Pointing them all at /pricing was the old single-edition behaviour, and
    // it told Google five languages of the English page lived at one URL.
    expect(byLocale.get("en-IN")).toBe(`${BASE}/in/pricing`);
    expect(byLocale.get("en-US")).toBe(`${BASE}/us/pricing`);
    expect(byLocale.get("hi")).toBe(`${BASE}/hi/pricing`);
    expect(byLocale.get("es")).toBe(`${BASE}/es/pricing`);
    expect(byLocale.get("pt-BR")).toBe(`${BASE}/pt-br/pricing`);
    expect(byLocale.get("x-default")).toBe(`${BASE}/pricing`);
  });

  it("points an edition page's x-default back at the English original", () => {
    render(<PageSEO title="pricing" description="d" canonical="/hi/pricing" />);

    const byLocale = new Map(alternates().map((a) => [a.locale, a.href]));
    expect(byLocale.get("x-default")).toBe(`${BASE}/pricing`);
    expect(byLocale.get("en")).toBe(`${BASE}/pricing`);
    expect(byLocale.get("hi")).toBe(`${BASE}/hi/pricing`);
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

    expect(alternates()).toEqual(built("/pomodoro-timer"));
  });
});
