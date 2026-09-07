/**
 * Membership tier → timer skin.
 *
 * The server returns a coarse cosmetic `tier` with `/api/premium/status`
 * (`free` | `plus` | `pro` | `elite`). This module turns that into a small,
 * theme-aware palette the timer faces (desktop ring + mobile digits) render.
 *
 * Rules:
 *  - Tier is *flavour*, never a gate. Every tier gets a fully working timer.
 *  - Skins only tint the ring/halo/label; they never override the mode
 *    colour for break / long-break so the "what am I doing now" signal
 *    (focus vs rest) stays legible for everyone.
 *  - All colours are CSS variables or literal hex so they work in both the
 *    dark and light themes.
 */
export type MembershipTier = "free" | "plus" | "pro" | "elite";

export const TIERS: readonly MembershipTier[] = ["free", "plus", "pro", "elite"] as const;

export function isMembershipTier(v: unknown): v is MembershipTier {
  return typeof v === "string" && (TIERS as readonly string[]).includes(v);
}

export interface TimerSkin {
  tier: MembershipTier;
  /** Short label shown in the tier chip next to the mode label. */
  label: string;
  /** Primary ring / accent colour for focus mode. */
  ring: string;
  /** Second stop used for the gradient ring (Plus and above). */
  ringAlt: string;
  /** Faint track colour behind the progress ring. */
  track: string;
  /** Glow intensity 0–1 for the ambient halo. */
  glow: number;
  /** Whether the ring uses a two-stop gradient rather than a solid colour. */
  gradient: boolean;
  /** Whether a slowly rotating "orbit" spark is drawn on the ring head. */
  spark: boolean;
  /** Whether the digits get a subtle metallic text gradient. */
  metallicDigits: boolean;
  /** Emoji/glyph for compact badges (mobile chip, session dots). */
  glyph: string;
}

const SKINS: Record<MembershipTier, TimerSkin> = {
  free: {
    tier: "free",
    label: "Focus",
    ring: "var(--brand-500)",
    ringAlt: "var(--brand-500)",
    track: "var(--brand-soft)",
    glow: 0.22,
    gradient: false,
    spark: false,
    metallicDigits: false,
    glyph: "",
  },
  plus: {
    tier: "plus",
    label: "Plus",
    ring: "var(--brand-500)",
    ringAlt: "#22D3EE", // cyan-400
    track: "var(--brand-soft)",
    glow: 0.3,
    gradient: true,
    spark: false,
    metallicDigits: false,
    glyph: "✦",
  },
  pro: {
    tier: "pro",
    label: "Pro",
    ring: "#8B5CF6", // violet-500
    ringAlt: "#F472B6", // pink-400
    track: "rgba(139, 92, 246, 0.14)",
    glow: 0.38,
    gradient: true,
    spark: true,
    metallicDigits: false,
    glyph: "◆",
  },
  elite: {
    tier: "elite",
    label: "Elite",
    ring: "#F5C242", // warm gold
    ringAlt: "#FF8A3D", // amber-orange
    track: "rgba(245, 194, 66, 0.16)",
    glow: 0.46,
    gradient: true,
    spark: true,
    metallicDigits: true,
    glyph: "👑",
  },
};

export function getTimerSkin(tier: MembershipTier | null | undefined): TimerSkin {
  return SKINS[isMembershipTier(tier) ? tier : "free"];
}

/** CSS gradient string used by the metallic digits (Elite) and tier chips. */
export function skinTextGradient(skin: TimerSkin): string {
  return `linear-gradient(135deg, ${skin.ring} 0%, ${skin.ringAlt} 55%, ${skin.ring} 100%)`;
}
