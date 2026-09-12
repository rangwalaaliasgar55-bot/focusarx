import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Design-token gates for the Liquid Glass system (WS5).
 * ══════════════════════════════════════════════════════════════════
 * Tokens are only a system if something stops them drifting. Three
 * drifts are worth failing the build for, because each one is invisible
 * in review and obvious to users:
 *
 *   • motion longer than ~250 ms — feels laggy, and anything animated
 *     that long is usually animating layout instead of intent;
 *   • no `prefers-reduced-motion` escape hatch — vestibular safety, and
 *     a WCAG 2.3.3 expectation;
 *   • text contrast under WCAG AA (4.5:1) — the muted/subtle greys are
 *     the first thing a redesign darkens "just a little".
 *
 * The contrast gate reads the real token values out of index.css for
 * both themes, so editing a grey re-runs the maths instead of silently
 * shipping it.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(path.join(here, "index.css"), "utf8");

function themeBlock(selector: string): string {
  const start = CSS.indexOf(selector);
  expect(start, `${selector} block must exist`).toBeGreaterThan(-1);
  const open = CSS.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < CSS.length; i += 1) {
    if (CSS[i] === "{") depth += 1;
    else if (CSS[i] === "}") {
      depth -= 1;
      if (depth === 0) return CSS.slice(open + 1, i);
    }
  }
  throw new Error(`unterminated block for ${selector}`);
}

function token(block: string, name: string): string {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(block);
  expect(m, `token --${name} must exist`).toBeTruthy();
  return m![1].trim();
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("motion budget", () => {
  it("keeps every interactive duration inside 150-250ms", () => {
    const root = themeBlock(":root {");
    for (const name of ["duration-instant", "duration-fast", "duration-normal", "duration-slow", "duration-slower"]) {
      const ms = parseInt(token(root, name), 10);
      expect(ms, `--${name} is ${ms}ms; interactive motion must stay in 150-250ms`).toBeGreaterThanOrEqual(150);
      expect(ms, `--${name} is ${ms}ms; interactive motion must stay in 150-250ms`).toBeLessThanOrEqual(250);
    }
  });

  it("never animates without a reduced-motion escape", () => {
    const blocks = CSS.match(/@media \(prefers-reduced-motion: reduce\)/g) ?? [];
    expect(blocks.length, "expected reduced-motion media blocks in index.css").toBeGreaterThan(0);
  });
});

describe("text contrast (WCAG AA, 4.5:1)", () => {
  const cases: Array<{ theme: string; selector: string; pairs: string[] }> = [
    {
      theme: "dark",
      selector: ":root {",
      pairs: ["foreground", "foreground-muted", "foreground-subtle", "muted-fg"],
    },
    {
      theme: "light",
      selector: "html.light {",
      pairs: ["foreground", "foreground-muted", "foreground-subtle", "muted-fg"],
    },
  ];

  for (const c of cases) {
    it.each(c.pairs)(`%s on background passes in the ${c.theme} theme`, (name) => {
      const block = themeBlock(c.selector);
      const bg = token(block, "background");
      const fg = token(block, name);
      const ratio = contrast(fg, bg);
      expect(
        ratio,
        `--${name} (${fg}) on --background (${bg}) is ${ratio.toFixed(2)}:1 in the ${c.theme} theme — AA body text needs 4.5:1`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("focus visibility", () => {
  it("defines a focus ring token and uses focus-visible, not focus, for it", () => {
    expect(CSS).toContain("--ring:");
    // :focus without :visible traps keyboard and mouse users alike in rings
    // that never disappear; the system standard is focus-visible.
    const bareFocus = CSS.match(/(?<![-\w]):focus(?!-visible|-within)/g) ?? [];
    expect(bareFocus.length, `bare :focus selectors found (${bareFocus.length}); use :focus-visible`).toBe(0);
  });
});
