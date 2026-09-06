import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrast gate for the design tokens.
 *
 * The theme is a table of CSS custom properties that roughly a thousand call
 * sites read (`text-[var(--foreground-subtle)]` alone is used 727 times), so a
 * single token that is a little too faint is not one bad label — it is the whole
 * interface going unreadable, in one theme only, which is exactly how it stays
 * unnoticed: nobody tests the theme they do not use.
 *
 * This test parses `index.css` rather than hard-coding colours, so it fails when
 * a token is edited, not when a constant is edited alongside it. It composites
 * each translucent surface over its own background — `--surface-1` is
 * `rgba(8, 12, 28, 0.96)`, and checking text against it as if it were opaque
 * would flatter it — and requires WCAG AA for normal text (4.5:1) on the worse
 * of page background and card surface, since both carry body copy.
 */

// Resolved from cwd rather than `import.meta.url`: this suite runs in jsdom,
// where Vite hands the module a served-file URL with no bearing on the checkout.
const CSS_PATH = path.resolve(process.cwd(), "src/index.css");
expect(existsSync(CSS_PATH), `expected the theme file at ${CSS_PATH}`).toBe(true);
const css = readFileSync(CSS_PATH, "utf8");

type RGB = [number, number, number];

function hex(value: string): RGB {
  const h = value.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * Collect the `--token: value` declarations of every top-level block with this
 * selector, in order, so a later block can extend an earlier one the way the
 * cascade does (`index.css` has two `:root` blocks). A theme block therefore
 * reads as the default theme plus its own overrides, which is what a browser
 * computes — a test that only read the override block would miss every token it
 * inherits, including the palette the accent aliases point at.
 */
function tokensFor(selector: string, base?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...(base ?? {}) };
  const at = new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{`, "m");
  let from = 0;
  for (;;) {
    const found = at.exec(css.slice(from));
    if (!found) break;
    let i = from + found.index + found[0].length;
    let depth = 1;
    const start = i;
    while (i < css.length && depth > 0) {
      const c = css[i];
      if (c === "{") depth += 1;
      else if (c === "}") depth -= 1;
      i += 1;
    }
    for (const m of css.slice(start, i - 1).matchAll(/--([\w-]+):\s*([^;]+);/g)) {
      out[m[1]] = m[2].trim();
    }
    from = i;
  }
  expect(Object.keys(out).length, `no custom properties found for ${selector}`).toBeGreaterThan(0);
  return out;
}

/** Resolve `#hex`, `rgba(...)`, or an alias chain of `var(--x)`. */
function resolve(tokens: Record<string, string>, raw: string, depth = 0): RGB {
  if (depth > 8) throw new Error("token alias cycle");
  const alias = raw.match(/^var\(--([\w-]+)\)$/);
  if (alias) return resolve(tokens, tokens[alias[1]] ?? "", depth + 1);
  const rgba = raw.match(/rgba?\(([^)]+)\)/);
  if (rgba) {
    const [r, g, b, a = "1"] = rgba[1].split(/[,\s/]+/).filter(Boolean);
    const alpha = Number(a);
    // Translucent surfaces sit on the theme background; composite them.
    const base = resolve(tokens, tokens.background, depth + 1);
    const mix = (c: number, over: number) => Math.round(c * alpha + over * (1 - alpha));
    return [mix(Number(r), base[0]), mix(Number(g), base[1]), mix(Number(b), base[2])];
  }
  if (/^#[0-9A-Fa-f]{3,6}$/.test(raw)) return hex(raw);
  throw new Error(`unresolvable colour: ${JSON.stringify(raw)}`);
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Text tokens that carry body copy, and the WCAG AA bar they must clear. */
const BODY_TEXT = [
  "foreground",
  "foreground-muted",
  "foreground-subtle",
  "muted-fg",
] as const;

const AA_NORMAL_TEXT = 4.5;

const DEFAULT_THEME = ":root";

const THEMES: Array<{ selector: string; label: string }> = [
  { selector: DEFAULT_THEME, label: "dark (default)" },
  { selector: "html.light", label: "light" },
];

const baseTokens = tokensFor(DEFAULT_THEME);

describe("design tokens — text contrast", () => {
  for (const { selector, label } of THEMES) {
    describe(label, () => {
      const tokens = selector === DEFAULT_THEME ? baseTokens : tokensFor(selector, baseTokens);

      it.each([...BODY_TEXT])("--%s clears WCAG AA on the page and on a card", (token) => {
        const raw = tokens[token];
        expect(raw, `--${token} is not defined in the ${label} theme block`).toBeTruthy();
        const colour = resolve(tokens, raw);
        const surfaces = [
          resolve(tokens, tokens.background),
          resolve(tokens, tokens["surface-1"]),
        ];
        const worst = Math.min(...surfaces.map((s) => contrast(colour, s)));
        expect(
          worst,
          `--${token} in ${label} reads at ${worst.toFixed(2)}:1 — needs ${AA_NORMAL_TEXT}:1. ` +
            `Fix the token; do not lower the bar.`,
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      });

      it("keeps the muted → subtle ordering, so hierarchy survives the fixes", () => {
        // Both are secondary text, and they are only distinguishable if one is
        // measurably weaker than the other; a contrast-only fix could flatten
        // them onto the same value and quietly remove a whole type tier.
        const muted = contrast(
          resolve(tokens, tokens["foreground-muted"]),
          resolve(tokens, tokens.background),
        );
        const subtle = contrast(
          resolve(tokens, tokens["foreground-subtle"]),
          resolve(tokens, tokens.background),
        );
        const stronger = Math.max(muted, subtle);
        const weaker = Math.min(muted, subtle);
        expect(weaker, "foreground-muted and foreground-subtle are indistinguishable").toBeLessThan(
          stronger - 1,
        );
      });

      it("keeps the accent used for text above the large-text bar", () => {
        // `--brand-strong` is the text accent (99 uses); the raw hue is for
        // borders and glows, where contrast is not the point.
        const raw = tokens["brand-strong"];
        const colour = resolve(tokens, raw);
        const surfaces = [resolve(tokens, tokens.background), resolve(tokens, tokens["surface-1"])];
        const worst = Math.min(...surfaces.map((s) => contrast(colour, s)));
        expect(worst, `--brand-strong reads at ${worst.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      });
    });
  }
});
