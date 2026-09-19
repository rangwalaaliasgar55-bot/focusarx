import { describe, expect, it } from "vitest";
import { COMPARISONS, COMPARISON_PATHS, COMPARISONS_REVIEWED, cellText } from "./seo-pages.mjs";

/**
 * `COMPARISONS` is the single source of truth for the /comparison/* pages, read
 * by three things that must agree:
 *
 *   • `src/pages/comparison.tsx` — the rendered table and the two checklists;
 *   • `scripts/prerender-data.mjs` — which turns each entry into the `table` and
 *     `sections[].bullets` the static document carries;
 *   • `scripts/seo-validate.mjs` — which fails the build unless every declared
 *     row label and cell reaches the emitted HTML.
 *
 * That gate is what makes §18 #20 ("prerendered tables missing rows") impossible
 * to reintroduce, but it can only be as good as the data: a row that is
 * malformed, duplicated, or has no label produces a table that renders wrong
 * while the gate reports parity. These tests pin the shape the gate assumes.
 */

const ENTRIES = Object.entries(COMPARISONS);

describe("COMPARISONS data shape", () => {
  it("has entries, and every one is reachable by its own path", () => {
    expect(ENTRIES.length).toBeGreaterThan(0);
    for (const [key, c] of ENTRIES) {
      expect(COMPARISON_PATHS).toContain(`/comparison/${c.slug}`);
      // The prerenderer resolves a path back to an entry by slug; a slug that
      // does not match its key silently yields `undefined` and a blank page.
      expect(typeof key).toBe("string");
      expect(c.slug.length).toBeGreaterThan(0);
    }
  });

  it("has unique slugs and paths", () => {
    const slugs = ENTRIES.map(([, c]) => c.slug);
    const paths = ENTRIES.map(([, c]) => `/comparison/${c.slug}`);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(COMPARISON_PATHS).size).toBe(COMPARISON_PATHS.length);
  });

  it("pins a review date, so a stale comparison is visible in the source", () => {
    expect(COMPARISONS_REVIEWED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  for (const [, c] of ENTRIES) {
    describe(c.slug, () => {
      it("declares a name, lead and both verdicts", () => {
        expect(c.name.trim().length).toBeGreaterThan(0);
        expect(c.lead.trim().length).toBeGreaterThan(40);
        expect(c.whenOurs.trim().length).toBeGreaterThan(40);
        expect(c.whenTheirs.trim().length).toBeGreaterThan(40);
      });

      it("has a table of three-column rows with a label on every one", () => {
        expect(Array.isArray(c.rows)).toBe(true);
        expect(c.rows.length).toBeGreaterThan(0);
        for (const row of c.rows) {
          expect(Array.isArray(row)).toBe(true);
          // [label, ours, theirs] — a 2-element row would emit a ragged <tr>
          // and the parity gate would flag the missing cell, not the cause.
          expect(row.length).toBe(3);
          expect(String(row[0]).trim().length).toBeGreaterThan(0);
        }
      });

      it("does not repeat a row label", () => {
        // The gate matches labels by text, so a duplicate would let a dropped
        // row pass: the second occurrence still satisfies the first's check.
        const labels = c.rows.map((r) => String(r[0]));
        expect(new Set(labels).size).toBe(labels.length);
      });

      it("resolves every cell to non-empty text", () => {
        for (const row of c.rows) {
          for (const cell of row.slice(1)) {
            // `false` must be expressible: it becomes the word "No". Only
            // undefined/null/"" are meaningless.
            expect(typeof cell === "boolean" || String(cell ?? "").trim().length > 0).toBe(true);
            expect(cellText(cell).length).toBeGreaterThan(0);
          }
        }
      });

      it("carries both checklists, so the prerendered bullets are not empty", () => {
        expect(c.ours.length).toBeGreaterThan(0);
        expect(c.theirs.length).toBeGreaterThan(0);
        for (const b of [...c.ours, ...c.theirs]) {
          expect(b.trim().length).toBeGreaterThan(0);
        }
      });

      it("names a real competitor in its title", () => {
        expect(c.title).toContain(c.name);
      });
    });
  }
});

describe("cellText", () => {
  it("maps booleans to words, because a tick glyph is not content", () => {
    expect(cellText(true)).toBe("Yes");
    expect(cellText(false)).toBe("No");
  });

  it("passes strings through unchanged", () => {
    expect(cellText("Basic statistics")).toBe("Basic statistics");
    expect(cellText("PWA (installable)")).toBe("PWA (installable)");
  });

  it("never yields 'undefined' or 'null' for a missing value", () => {
    expect(cellText(undefined)).toBe("");
    expect(cellText(null)).toBe("");
  });

  it("keeps false distinct from missing", () => {
    // "No" and "" mean different things in a comparison table: one is a checked
    // claim, the other is a gap in our research.
    expect(cellText(false)).not.toBe(cellText(undefined));
  });
});
