import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Legibility floor.
 * ══════════════════════════════════════════════════════════════════
 * §18 #28 set an 11px minimum for on-screen text. It is the kind of rule that
 * decays silently: nobody adds `text-[9px]` on purpose, they add it to make a
 * badge fit, and six months later the app has a dozen unreadable labels that no
 * reviewer caught because they were reading the diff and not the screen.
 *
 * This is a source-level gate rather than a rendering check, because there is
 * no browser binary in this environment — but it is the right level anyway. The
 * rule is about what is written, and a string scan catches every site including
 * the ones behind a feature flag or a conditional branch that a DOM snapshot
 * would miss.
 *
 * Two deliberate exclusions:
 *   • `text-[var(--...)]` is a *colour*, not a size — the regex below matches
 *     only numeric sizes, so those are untouched by construction.
 *   • `index.css` is not scanned; it defines the scale (`--text-xs` etc.) rather
 *     than using it, and the scale's own floor is asserted separately below.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = here;

/** 11px expressed in the units this codebase actually uses. */
const FLOOR_PX = 11;
const REM = 16;

/** Any `text-[<number><unit>]` font-size utility. */
const SIZE_UTILITY = /text-\[(\d*\.?\d+)(px|rem)\]/g;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.(tsx|ts)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("legibility floor (§18 #28)", () => {
  const files = sourceFiles(ROOT);

  it("finds source files to scan, so a broken glob cannot pass silently", () => {
    // A source-scanning gate that matches nothing always passes. This is the
    // assertion that makes the ones below meaningful.
    expect(files.length).toBeGreaterThan(100);
  });

  it("never sets text below 11px anywhere in the app", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(SIZE_UTILITY)) {
        const [, raw, unit] = match;
        const px = unit === "rem" ? Number(raw) * REM : Number(raw);
        if (px < FLOOR_PX) {
          // Line number makes the failure actionable without opening the file.
          const line = source.slice(0, match.index).split("\n").length;
          offenders.push(`${path.relative(ROOT, file)}:${line} → ${match[0]} (${px}px)`);
        }
      }
    }

    expect(
      offenders,
      `Text below the ${FLOOR_PX}px floor:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps the CSS scale itself at or above the floor", () => {
    // The utilities above are the visible risk; these are the tokens they are
    // built on. A `--text-2xs: 9px` would reintroduce the problem through a
    // single token instead of forty call sites.
    const css = readFileSync(path.join(ROOT, "index.css"), "utf8");
    const offenders: string[] = [];

    for (const match of css.matchAll(/(--text-[\w-]+):\s*(\d*\.?\d+)(px|rem)\s*;/g)) {
      const [, name, raw, unit] = match;
      const px = unit === "rem" ? Number(raw) * REM : Number(raw);
      if (px < FLOOR_PX) offenders.push(`${name}: ${raw}${unit} (${px}px)`);
    }

    expect(offenders, `CSS text tokens below the floor:\n${offenders.join("\n")}`).toEqual([]);
  });
});
