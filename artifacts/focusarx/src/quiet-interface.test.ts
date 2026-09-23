import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The "quiet tools" contract, enforced where it is cheapest to break: class
 * names in components.
 *
 * Every rule below was a real, repeated regression before v5 — the interface
 * grew a backdrop blur here, a glow shadow there, a decorative gradient on a
 * card, and six months later it read as a template rather than as a tool. The
 * tokens can be right (see `design-tokens.contrast.test.ts`) while a single
 * `shadow-[0_0_40px_...]` puts the light rig back.
 *
 * The admin console is exempt: it is a dense operational surface with its own
 * deliberate material in `src/index.css`, not a consumer screen.
 */

const SRC = path.resolve(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return [full];
  });
}

/**
 * Comments are stripped first: the migration notes in `lib/accent.ts` name the
 * deprecated tokens on purpose ("deliberately absent: `--glow-violet`"), and a
 * rule that cannot tell documentation from a call site would forbid writing
 * down why the rule exists.
 */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const sources = walk(SRC)
  .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
  .filter((file) => !file.includes(`${path.sep}admin${path.sep}`) && path.basename(file) !== "admin.tsx")
  .map((file) => ({ file: path.relative(SRC, file), text: withoutComments(readFileSync(file, "utf8")) }));

describe("the interface stays quiet", () => {
  it("has no backdrop blur anywhere in the product", () => {
    // Blur is a compositor layer per element, and on a dark page it lowers the
    // contrast of everything sitting on it. Sticky chrome is opaque instead.
    // Spelled in two pieces on purpose: the framework scans this file, and the
    // literal would make Tailwind emit the very utility the test forbids.
    const banned = `backdrop${"-"}blur`;
    const offenders = sources.filter((s) => s.text.includes(banned)).map((s) => s.file);
    expect(offenders, "backdrop blur is banned; use --surface-* and a hairline").toEqual([]);
  });

  it("has no coloured halo behind anything", () => {
    const pattern = /(?:shadow|drop-shadow)-\[0_0_/;
    const offenders = sources.filter((s) => pattern.test(s.text)).map((s) => s.file);
    expect(offenders, "glow shadows are not elevation; use --shadow-* or a border").toEqual([]);
  });

  it("reserves gradients for scrims, never for material", () => {
    // A fade over a photo or a long headline is functional. A gradient from a
    // brand hue is decoration standing in for a design decision.
    const decorative = /bg-gradient-to-[a-z]+\s+from-\[var\(--(?:brand|palette|color)/;
    const offenders = sources.filter((s) => decorative.test(s.text)).map((s) => s.file);
    expect(offenders, "a gradient from an accent hue is atmosphere, not surface").toEqual([]);
  });

  it("keeps the pre-v5 vocabulary out of components", () => {
    const banned =
      /\b(?:text-gradient|glow-violet|glow-teal|glow-gold|glow-aurora|radial-glow-\w+|shadow-3d(?:-violet)?|logo-pulse|forge-bg-glow|neon-border-pulse|texture-grain|texture-dotgrid|hud-reticle|hud-corner|hud-scanline|magnetic-hover|perspective-card|animate-sparkle|animate-shimmer-sweep|animate-fire|animate-scan|animate-float-orb|animate-breathe|animate-orbit|animate-marquee|animate-liquid-fill|animate-slow-rotate|animate-border-glow)\b/;
    const offenders = sources.filter((s) => banned.test(s.text)).map((s) => s.file);
    expect(offenders, "these names are deprecated in docs/DESIGN.md §5; delete the call site").toEqual([]);
  });
});

describe("the stylesheet stays a system", () => {
  const css = readFileSync(path.join(SRC, "index.css"), "utf8");

  it("keeps the glass family flat and blur-free", () => {
    expect(css).not.toContain(`backdrop${"-"}filter`);
    // The names survive for their call sites, but they must resolve to a
    // surface token — not to a translucent fill.
    const glass = /\.glass[^{]*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(glass).toContain("var(--surface-");
    expect(glass).not.toMatch(/rgba\(|blur\(|#[0-9a-f]{3,6}/i);
  });

  it("re-inks the whites for the light theme", () => {
    // The v4 compatibility ramp is near-white at low alpha — a brush stroke on
    // a black page and nothing at all on a white one. Daylight restates those
    // alphas as ink; without it, every hover fill and inset highlight in light
    // mode silently disappears.
    const light = /html\.light\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    const wash = /--rgba-255-255-255-0_06:\s*([^;]+);/.exec(light)?.[1]?.trim() ?? "";
    expect(wash, "the light theme must restate the white washes").toBeTruthy();
    const [r, g, b] = (wash.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    expect(Math.min(r!, g!, b!), `a light-theme wash must be ink, not white (${wash})`).toBeLessThan(128);
  });

  it("keeps a visible tone step between a card and a raised row, in both themes", () => {
    const dark = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    const light = /html\.light\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    for (const [theme, block] of [["dark", dark], ["light", light]] as const) {
      const rgb = (name: string) => {
        const hex = new RegExp(`--surface-${name}:\\s*#([0-9a-f]{6})`, "i").exec(block)?.[1];
        expect(hex, `${theme}: --surface-${name} must be a hex value`).toBeTruthy();
        return [0, 2, 4].map((i) => parseInt(hex!.slice(i, i + 2), 16));
      };
      const [a, b] = [rgb("1"), rgb("2")];
      const delta = a.reduce((sum, v, i) => sum + Math.abs(v - b[i]!), 0);
      expect(delta, `${theme}: --surface-2 must read as a distinct step from --surface-1`).toBeGreaterThan(10);
    }
  });
});
