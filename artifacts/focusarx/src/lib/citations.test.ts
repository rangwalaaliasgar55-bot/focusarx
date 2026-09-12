import { describe, expect, it } from "vitest";
import { citationParts, citationUrl } from "./citations.mjs";
import { COMPARISONS, SEO_PAGES } from "@/content/seo-pages.mjs";
import { EXAM_GUIDES } from "@/content/exam/index.mjs";
import { BLOG_POSTS } from "@/content/blog.mjs";

/**
 * Citation links — the "how do I check this?" half of E-E-A-T.
 *
 * A visible source list that goes nowhere is a decoration, and a source list
 * that links to a DOI guessed from memory is worse: it 404s, and a reader who
 * clicks it once stops trusting the rest. So the registry points at publisher
 * and author sites for books and standards, and at an index search (PubMed,
 * ACM, Scholar) for papers — a search always lands, a remembered deep link
 * usually does not.
 *
 * The last test is the one that keeps the registry honest as content grows:
 * every reference-shaped source anywhere in the content files must resolve. A
 * new paper cited in a guide without a registry entry fails here, at test time,
 * instead of shipping as plain text.
 */

/** Everything a source string in the content files can look like. */
function allSources(): string[] {
  const raw: (string | [string, string])[] = [];
  for (const entry of Object.values(SEO_PAGES)) raw.push(...(entry.sources ?? []));
  for (const entry of Object.values(COMPARISONS)) raw.push(...(entry.sources ?? []));
  for (const guide of EXAM_GUIDES) raw.push(...((guide as { sources?: string[] }).sources ?? []));
  for (const post of BLOG_POSTS) raw.push(...((post as { sources?: string[] }).sources ?? []));
  return [...new Set(raw.map((s) => (Array.isArray(s) ? s[0] : s)))];
}

/** A source that is a reference rather than a disclaimer about our own scope. */
const looksLikeAReference = (text: string) =>
  /\(\d{4}\)|et al\.|\bdoi\b|ISBN|Proceedings|Journal|Am J |CHI |University|Press/i.test(text);

describe("citationUrl", () => {
  it("links books and standards to the publisher or author, not to a reseller", () => {
    const cases: [string, string][] = [
      ["Francesco Cirillo, The Pomodoro Technique (late 1980s)", "https://francescocirillo.com/"],
      ["Cal Newport, Deep Work (2016)", "https://www.calnewport.com/"],
      ["David Allen, Getting Things Done", "https://gettingthingsdone.com/"],
      ["BJ Fogg, Tiny Habits", "https://www.bjfogg.com/"],
      ["Pychyl, Solving Procrastination", "https://www.procrastination.ca/"],
      ["Russell A. Barkley, Taking Charge of ADHD (3rd ed., 2020)", "https://chadd.org/"],
      ["W3C, Web Content Accessibility Guidelines (WCAG) 2.2", "https://www.w3.org/TR/WCAG22/"],
      ["American Academy of Pediatrics guidance on screen time", "https://www.aap.org/"],
      ["NTA published exam pattern", "https://nta.ac.in/"],
      ["CBSE curriculum documents", "https://www.cbse.gov.in/"],
      ["Google Search Central review snippet documentation", "https://developers.google.com/search/docs/appearance/review-snippets"],
    ];
    for (const [text, url] of cases) expect(citationUrl(text), text).toBe(url);
  });

  it("links papers to an index search rather than a guessed deep link", () => {
    const leroy = citationUrl("Sophie Leroy, 'Why is it so hard to do my work?' (2009)");
    expect(leroy).toMatch(/^https:\/\/scholar\.google\.com\/scholar\?q=/);
    expect(decodeURIComponent(leroy!)).toContain("Leroy");

    const volkow = citationUrl("Volkow N.D. et al., 'Dopamine transporter densities' (2009)");
    expect(volkow).toMatch(/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov/);

    const mark = citationUrl("Mark, Gudith & Klocke, 'The Cost of Interrupted Work', CHI (2008)");
    expect(mark).toMatch(/^https:\/\/dl\.acm\.org\//);
  });

  it("never emits a fabricated DOI or PMID", () => {
    for (const source of allSources()) {
      const url = citationUrl(source);
      if (!url) continue;
      expect(url, source).not.toMatch(/doi\.org\/10\./);
      expect(url, source).not.toMatch(/[?&]PMID=\d+/);
      expect(url, source).not.toMatch(/\/pmc\/articles\/PMC\d+/);
    }
  });

  it("leaves our own disclaimers unlinked", () => {
    expect(citationUrl("FocusArx makes no clinical claims on this page.")).toBeNull();
    expect(
      citationUrl("'Body doubling' is a term used within ADHD communities rather than a formal clinical construct."),
    ).toBeNull();
    expect(citationUrl("")).toBeNull();
    expect(citationUrl(undefined as unknown as string)).toBeNull();
  });

  it("only ever returns an https URL with no whitespace in it", () => {
    for (const source of allSources()) {
      const url = citationUrl(source);
      if (!url) continue;
      expect(url.startsWith("https://"), `${source} -> ${url}`).toBe(true);
      expect(/\s/.test(url), `${source} -> ${url}`).toBe(false);
      expect(() => new URL(url), `${source} -> ${url}`).not.toThrow();
    }
  });
});

describe("citationParts", () => {
  it("normalises a plain string against the registry", () => {
    expect(citationParts("Cal Newport, Deep Work (2016)")).toEqual({
      text: "Cal Newport, Deep Work (2016)",
      url: "https://www.calnewport.com/",
    });
  });

  it("lets an explicit pair win over the registry", () => {
    // The author knows better than the pattern matcher: a [text, url] pair is
    // used verbatim even when the text would have matched a rule.
    const parts = citationParts(["Cal Newport, Deep Work (2016)", "https://example.org/deep-work"]);
    expect(parts).toEqual({ text: "Cal Newport, Deep Work (2016)", url: "https://example.org/deep-work" });
  });

  it("keeps an unresolvable source as plain text rather than dropping it", () => {
    expect(citationParts("FocusArx makes no clinical claims on this page.")).toEqual({
      text: "FocusArx makes no clinical claims on this page.",
      url: null,
    });
  });
});

describe("the registry covers what the content actually cites", () => {
  it("resolves every reference-shaped source in the content files", () => {
    const unlinked = allSources().filter((s) => looksLikeAReference(s) && !citationUrl(s));
    expect(
      unlinked,
      `These sources are cited in prose but link nowhere — add a rule to src/lib/citations.mjs (or an explicit [text, url] pair in the content file): ${unlinked.join(" | ")}`,
    ).toEqual([]);
  });

  it("cites enough to be worth the section", () => {
    const sources = allSources();
    expect(sources.length).toBeGreaterThan(20);
    expect(sources.filter((s) => citationUrl(s)).length).toBeGreaterThan(sources.length * 0.8);
  });
});
