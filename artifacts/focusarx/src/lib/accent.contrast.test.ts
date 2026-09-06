import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACCENT_PRESETS, buildAccentScale } from "./accent";

/**
 * Contrast gate for the user-customisable accent.
 *
 * Settings offers twelve presets plus a free colour picker, and every one of
 * them drives the *primary button*: `bg-[var(--brand-600)]` with
 * `text-[var(--neutral-0)]` white labels, hovering to `--brand-500`. The tonal
 * scale generator eases lightness toward the ends, but it never checked whether
 * white text is actually readable on the result — so a light-picked accent
 * (Gold, Amber) shipped buttons whose label disappeared, worst on hover, which
 * is the state a user is looking at while they decide to click.
 *
 * Accent colours are user input, so the generator is where the floor belongs:
 * clamping it fixes the presets, every custom colour, and any preset added
 * later, without touching a single component.
 */

const WHITE = [255, 255, 255] as const;

function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]: readonly number[]): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastWithWhite(hex: string): number {
  const a = luminance(rgbOf(hex));
  const b = luminance(WHITE);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Button labels are 14px semibold: WCAG's normal-text bar applies. */
const AA = 4.5;

/** The class string of one `variants.variant.<name>` entry in button.tsx. */
function buttonVariants(source: string, variant: string): string {
  const match = source.match(new RegExp(`"?${variant}"?:\\s*"([^"]+)"`));
  expect(match, `button.tsx no longer declares a "${variant}" variant`).toBeTruthy();
  return match![1]!;
}

describe("accent scale — readable on brand-filled surfaces", () => {
  it.each(ACCENT_PRESETS)("$label ($color)", ({ color }) => {
    const scale = buildAccentScale(color);
    // The fill pair: 600 at rest, 700 on hover (see `ui/button.tsx`). Step 500
    // is intentionally excluded — it is the identity colour for rings and
    // progress fills, where nothing sits on top of it.
    expect(
      contrastWithWhite(scale[600]),
      `"${color}" renders a primary button label at ${contrastWithWhite(scale[600]).toFixed(2)}:1 at rest`,
    ).toBeGreaterThanOrEqual(AA);
    expect(
      contrastWithWhite(scale[700]),
      `"${color}" renders a primary button label at ${contrastWithWhite(scale[700]).toFixed(2)}:1 on hover`,
    ).toBeGreaterThanOrEqual(AA);
  });

  it("holds the floor for an arbitrary custom colour, not just the presets", () => {
    // Settings offers a colour input, so the twelve presets are the easy case.
    for (const color of ["#FFFF00", "#FFFFFF", "#00FF00", "#FFD700", "#F0F8FF"]) {
      const scale = buildAccentScale(color);
      expect(
        contrastWithWhite(scale[600]),
        `a user picking ${color} gets a ${contrastWithWhite(scale[600]).toFixed(2)}:1 button label`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it("keeps the ramp monotonic after the clamp, so a graded accent still reads as one", () => {
    for (const { color } of ACCENT_PRESETS) {
      const scale = buildAccentScale(color);
      const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
      const lums = steps.map((s) => luminance(rgbOf(scale[s])));
      for (let i = 1; i < lums.length; i += 1) {
        expect(
          lums[i] <= lums[i - 1] + 0.001,
          `${color}: step ${steps[i]} is lighter than step ${steps[i - 1]}`,
        ).toBe(true);
      }
    }
  });

  it("still honours the picked colour as the identity step for a dark-safe input", () => {
    // A colour that already clears the bar must come through untouched — the
    // clamp is a floor, not a re-tint of every accent in the app.
    const scale = buildAccentScale("#8B5CF6");
    expect(scale[500]).toBe("#8B5CF6");
  });

  it("does not hover a filled button onto the identity step", () => {
    // The floor only covers the fill steps, so a component that hovers to
    // `--brand-500` re-opens the bug for bright accents. Enforced against the
    // real class strings because that is where the pairing lives.
    const button = readFileSync(path.resolve(process.cwd(), "src/components/ui/button.tsx"), "utf8");
    for (const variant of ["default", "glow"]) {
      const line = buttonVariants(button, variant);
      expect(line, `the ${variant} variant hovers onto a step white text cannot sit on`).not.toMatch(
        /hover:bg-\[var\(--brand-500\)\]/,
      );
      expect(line).toMatch(/hover:bg-\[var\(--brand-700\)\]/);
    }
  });
});
