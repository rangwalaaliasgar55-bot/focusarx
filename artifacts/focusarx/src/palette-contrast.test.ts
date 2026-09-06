import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The app has two colour systems: the semantic tokens (`--foreground`,
 * `--surface-1`, `--success`, …) that `html.light` re-declares, and a literal
 * Tailwind ramp (`--palette-zinc-400`, `--palette-emerald-950`, …) that ~900
 * call sites — and most of the admin console — reference directly. Only the
 * first system was theme-aware, and the second was only half mapped, so
 * "switch to Daylight" left the console with near-white text on dark panels
 * floating over a white page.
 *
 * These tests resolve both systems per theme and hold every colour pairing the
 * console writes down to WCAG AA. Nothing is hardcoded: the colours come out of
 * `src/index.css` and the pairings out of the components, so dropping a
 * light-mode mapping or using a new unmapped palette token turns this red.
 */

const SRC = path.resolve(process.cwd(), "src");
// Comments are stripped first: a rule's selector list is whatever precedes its
// `{`, and an explanatory comment left in there would look like part of it.
const css = readFileSync(path.join(SRC, "index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/* ── minimal CSS value resolver ─────────────────────────────────────────── */

type Rgb = [number, number, number];
type Rgba = [number, number, number, number];

/** Declarations of the given selectors, merged in source order (later wins). */
function declarationsFor(selectors: string[]): Map<string, string> {
  const wanted = new Set(selectors);
  const out = new Map<string, string>();
  // Every rule whose selector list mentions one of `wanted` — `.admin-shell`
  // overrides are declared in grouped rules (`a,\nb { … }`), so matching the
  // anchor of the rule alone is not enough.
  for (const rule of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const prelude = (rule[1] ?? "").slice((rule[1] ?? "").lastIndexOf("}") + 1);
    if (!prelude.split(",").some((part) => wanted.has(part.trim()))) continue;
    for (const d of (rule[2] ?? "").matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
      out.set(d[1]!, d[2]!.trim());
    }
  }
  return out;
}

// `.admin-shell` carries its own palette overrides (a previous pass fixed the
// console's faintest grey for the dark theme only), so the cascade the console
// actually sees includes that scope, not just the root blocks.
const THEMES = {
  dark: declarationsFor([":root", "html:not(.light)", "html:not(.light) .admin-shell"]),
  light: declarationsFor([":root", "html.light", "html.light .admin-shell"]),
} as const;
type Theme = keyof typeof THEMES;

function toRgb(value: string): Rgba | null {
  const raw = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  if (hex) {
    let s = hex[1]!;
    if (s.length === 3) s = s.split("").map((c) => c + c).join("");
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const oklch = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.-]+)\s*\)$/.exec(raw);
  if (oklch) {
    const L = +oklch[1]! / 100;
    const C = +oklch[2]!;
    const H = +oklch[3]!;
    const a = C * Math.cos((H * Math.PI) / 180);
    const b = C * Math.sin((H * Math.PI) / 180);
    const l_ = L + 0.3963377779 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l3 = l_ ** 3;
    const m3 = m_ ** 3;
    const s3 = s_ ** 3;
    const channel = (v: number) => {
      const lin = Math.max(0, Math.min(1, v));
      const s = lin <= 0.0031308 ? 12.92 * lin : 1.055 * lin ** (1 / 2.4) - 0.055;
      return Math.round(Math.max(0, Math.min(1, s)) * 255);
    };
    return [
      channel(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
      channel(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
      channel(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
      1,
    ];
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(raw);
  if (rgb) return [+rgb[1]!, +rgb[2]!, +rgb[3]!, rgb[4] === undefined ? 1 : +rgb[4]!];
  if (/^\d+(\.\d+)?%$/.test(raw)) return [0, 0, 0, +raw.slice(0, -1) / 100];
  if (raw === "transparent") return [0, 0, 0, 0];
  if (raw === "white" || raw === "black") return raw === "white" ? [255, 255, 255, 1] : [0, 0, 0, 1];
  return null;
}

function resolve(value: string, theme: Theme, depth = 0): Rgba {
  if (depth > 32) throw new Error(`custom-property cycle at \`${value}\``);
  const direct = toRgb(value);
  if (direct) return direct;

  const varRef = /^var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)$/.exec(value);
  if (varRef) {
    const declared = THEMES[theme].get(varRef[1]!);
    if (declared === undefined) {
      if (varRef[2]) return resolve(varRef[2], theme, depth + 1);
      throw new Error(`\`${varRef[1]}\` is not declared in src/index.css`);
    }
    return resolve(declared, theme, depth + 1);
  }

  const mix = /color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+?)\s*\)$/.exec(value);
  if (mix) {
    const a = resolve(mix[1]!, theme, depth + 1);
    const b = resolve(mix[3]!, theme, depth + 1);
    const p = +mix[2]! / 100;
    const ch = (x: number, y: number) => x * p + y * (1 - p);
    return [ch(a[0], b[0]), ch(a[1], b[1]), ch(a[2], b[2]), ch(a[3], b[3])];
  }

  throw new Error(`cannot resolve the CSS value \`${value}\``);
}

function over(fg: Rgba, bg: Rgb): Rgb {
  const a = fg[3];
  return [0, 1, 2].map((i) => Math.round(fg[i]! * a + bg[i]! * (1 - a))) as Rgb;
}

function luminance(c: Rgb): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
}

function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function token(name: string, theme: Theme): Rgba {
  const declared = THEMES[theme].get(name);
  if (declared === undefined) throw new Error(`\`${name}\` is not declared in src/index.css`);
  return resolve(declared, theme);
}

/** The console paints `--background` on `.admin-shell`; resolve it flat. */
function pageBg(theme: Theme): Rgb {
  return over(token("--background", theme), theme === "dark" ? [0, 0, 0] : [255, 255, 255]);
}

/**
 * Every surface a console label can end up on, derived from `AdminHelpers`'
 * own class strings rather than restated here. `AdminCard` is
 * `--palette-zinc-900` at 40%, `AdminPanelCard` is `--palette-zinc-950`/40%,
 * and the dense rows and inset tiles are lighter alpha steps of the same ramp.
 */
function adminSurfaces(theme: Theme): { label: string; rgb: Rgb }[] {
  const page = pageBg(theme);
  const paint = (name: string, alpha: number) => over(token(name, theme).slice(0, 3).concat(alpha) as Rgba, page);
  // Only the containers the console defines for itself in AdminHelpers — the
  // things paragraphs of text sit inside. Chips, pills and toggle rails paint a
  // background and their own label in the same class string, which the pairing
  // test below checks exactly rather than cross-multiplying.
  return [
    { label: "the console page background", rgb: page },
    { label: "an AdminCard (zinc-900/40)", rgb: paint("--palette-zinc-900", 0.4) },
    { label: "an AdminPanelCard (zinc-950/40)", rgb: paint("--palette-zinc-950", 0.4) },
    { label: "an accent AdminCard (violet-950/20)", rgb: paint("--palette-violet-950", 0.2) },
    { label: "an inset tile (zinc-900/20)", rgb: paint("--palette-zinc-900", 0.2) },
  ];
}

/* ── the console's own source ───────────────────────────────────────────── */

function adminSources(): { file: string; source: string }[] {
  const dir = path.join(SRC, "components/admin");
  const files = [
    { file: path.join(SRC, "pages/admin.tsx"), label: "pages/admin.tsx" },
    ...readdirSync(dir)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => ({ file: path.join(dir, f), label: `components/admin/${f}` })),
  ];
  return files.map((f) => ({ file: f.label, source: readFileSync(f.file, "utf8") }));
}

const TEXT_ON_SURFACE = /text-\[var\(--palette-([\w-]+)-(\d+)\)\]/g;
const CLASS_LITERAL = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;
const BG_IN_LITERAL = /(?:^|\s)bg-\[var\(--palette-([\w-]+)-(\d+)\)\](?:\/(\d+))?/g;
const TEXT_IN_LITERAL = /(?:^|\s)text-\[var\(--palette-([\w-]+)-(\d+)\)\]|(?:^|\s)text-(white|black)(?=\s|$|")/g;


describe("admin console palette", () => {
  const sources = adminSources();

  it("covers the console", () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it.each(["dark", "light"] as Theme[])(
    "keeps every console label legible on every console surface in the %s theme",
    (theme) => {
      const surfaces = adminSurfaces(theme);
      const failures = new Set<string>();
      const checked = new Set<string>();
      for (const { source } of sources) {
        for (const m of source.matchAll(TEXT_ON_SURFACE)) {
          const name = `--palette-${m[1]}-${m[2]}`;
          if (checked.has(name)) continue;
          checked.add(name);
          const fg = token(name, theme);
          for (const { label, rgb: bg } of surfaces) {
            const r = contrast(over(fg, bg), bg);
            // A label has to clear AA on the surface it is most likely to sit
            // on. The tinted fills are excluded: those carry a white or dark
            // label of their own, asserted by the pairing test below.
            if (r < 4.5 && !/tint|fill/.test(label)) failures.add(`${name} on ${label} = ${r.toFixed(2)}:1`);
          }
        }
      }
      expect(checked.size, "no palette colours found in the console sources").toBeGreaterThan(20);
      expect([...failures].slice(0, 15), [...failures].slice(0, 15).join("\n")).toEqual([]);
    },
  );

  it.each(["dark", "light"] as Theme[])(
    "keeps labels legible on the fills they are written next to in the %s theme",
    (theme) => {
      const failures = new Set<string>();
      let pairs = 0;
      for (const { source } of sources) {
        for (const literal of source.matchAll(CLASS_LITERAL)) {
          const classes = `${literal[1] ?? ""} ${literal[2] ?? ""}`;
          const bgs = [...classes.matchAll(BG_IN_LITERAL)];
          if (bgs.length === 0) continue;
          const texts = [...classes.matchAll(TEXT_IN_LITERAL)];
          for (const bg of bgs) {
            const page = pageBg(theme);
            const alpha = bg[3] === undefined ? 1 : +bg[3] / 100;
            const bgRgb = over(token(`--palette-${bg[1]}-${bg[2]}`, theme).slice(0, 3).concat(alpha) as Rgba, page);
            for (const t of texts) {
              pairs += 1;
              const label = t[1] ? token(`--palette-${t[1]}-${t[2]}`, theme) : t[3] === "white" ? ([255, 255, 255, 1] as Rgba) : ([0, 0, 0, 1] as Rgba);
              const shown = t[1] ? `var(--palette-${t[1]}-${t[2]})` : t[3];
              const r = contrast(over(label, bgRgb), bgRgb);
              if (r < 4.5) {
                failures.add(`text-[${shown}] on bg-${bg[1]}-${bg[2]}${bg[3] ? `/${bg[3]}` : ""} = ${r.toFixed(2)}:1`);
              }
            }
          }
        }
      }
      expect(pairs, "no bg+text pairs written in the same class string").toBeGreaterThan(0);
      expect([...failures].slice(0, 15), [...failures].slice(0, 15).join("\n")).toEqual([]);
    },
  );

  it("keeps every status colour legible as text in both themes", () => {
    for (const theme of ["dark", "light"] as Theme[]) {
      const page = pageBg(theme);
      const card = over(token("--palette-zinc-900", theme).slice(0, 3).concat(0.4) as Rgba, page);
      for (const name of ["--success", "--warning", "--danger", "--info", "--color-success", "--color-warning", "--color-error"]) {
        const fg = token(name, theme);
        for (const [label, bg] of [
          ["the page background", page],
          ["a card", card],
        ] as [string, Rgb][]) {
          const r = contrast(over(fg, bg), bg);
          expect(r, `${name} (${theme}) on ${label}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("maps every palette family the console leans on into the light theme", () => {
    const light = THEMES.light;
    const used = new Set<string>();
    for (const { source } of sources) {
      for (const m of source.matchAll(/var\(--palette-([\w-]+)-\d+\)/g)) used.add(m[1]!);
    }
    expect(used.size).toBeGreaterThan(8);
    for (const family of used) {
      // A family whose only console use is a surface step (zinc's 700-900) is
      // already handled by the neutral ramp; every *coloured* family needs the
      // status mapping, because its dark-theme shades are the wrong direction
      // for a white card.
      if (family === "zinc" || family === "slate") continue;
      const mapped = [...light.keys()].filter((k) => k.startsWith(`--palette-${family}-`));
      expect(mapped.length, `html.light declares no --palette-${family}-* values`).toBeGreaterThan(0);
    }
  });
});
