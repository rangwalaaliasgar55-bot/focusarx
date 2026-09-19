import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trend, TrendDirection } from "@/types/trend";

/**
 * A direction badge for a KPI.
 *
 * Three things this gets right that a naive `+123%` span does not:
 *
 * 1. **"Up" is not always good.** Minutes focused going up is good; a
 *    time-to-complete metric going up is not. `goodDirection` decides which
 *    arrow earns the success colour, so a card never celebrates a regression.
 *    Colour is never the only signal — every state carries its own icon and
 *    wording, so the pill survives greyscale and colour-blind readers.
 *
 * 2. **`unknown` must not look like `flat`.** "No comparison yet" and "steady"
 *    are different claims about a user's life. Unknown renders muted with a
 *    dash and says so in words; flat renders neutral with a right arrow. A
 *    brand-new account and a perfectly consistent one do not look the same.
 *
 * 3. **No fabricated percentages.** When `percent` is null but a direction is
 *    defensible (a rise from no baseline, or a baseline too small to divide
 *    by), the absolute delta is shown instead, in the metric's own unit. The
 *    component can never render `Infinity%`, `NaN%`, or a `0%` that means "we
 *    have no idea".
 */

export interface TrendPillProps {
  trend: Trend | null | undefined;
  /**
   * Which direction counts as good news. Defaults to `"up"`; pass `"down"` for
   * metrics where less is better (time to complete, missed days, overspend).
   */
  goodDirection?: "up" | "down";
  /** Suffix for the absolute-delta fallback, e.g. `"m"` for minutes, `"pts"` for scores. */
  unit?: string;
  /** Replaces the server's `comparison` string when the caller has better wording. */
  comparisonLabel?: string;
  className?: string;
}

const STATE: Record<
  TrendDirection,
  { icon: typeof ArrowUpRight; label: string; className: string }
> = {
  up: {
    icon: ArrowUpRight,
    label: "up",
    className: "text-[var(--success)]",
  },
  down: {
    icon: ArrowDownRight,
    label: "down",
    className: "text-[var(--danger)]",
  },
  flat: {
    icon: ArrowRight,
    label: "steady",
    // Flat is neutral, not good. Painting "no change" green implies the reader
    // is being told something encouraging when they are being told nothing.
    className: "text-[var(--foreground-muted)]",
  },
  unknown: {
    icon: Minus,
    label: "no comparison yet",
    className: "text-[var(--foreground-subtle)]",
  },
};

/** `12.4` → `+12%`; `-3.6` → `−4%`; `0.2` → `0%`. Null in, null out. */
export function formatPercentChange(percent: number | null | undefined): string | null {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return null;
  const rounded = Math.round(percent);
  if (rounded === 0) return "0%";
  // U+2212 MINUS SIGN, not a hyphen: it is the glyph that aligns with `+` in
  // tabular figures, and it renders at the same weight as the digits.
  return rounded > 0 ? `+${rounded}%` : `\u2212${Math.abs(rounded)}%`;
}

/** `42` → `+42`; `-3` → `−3`; `0` → `0`. */
export function formatAbsChange(delta: number): string {
  if (!Number.isFinite(delta)) return "0";
  const rounded = Math.round(delta);
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : `\u2212${Math.abs(rounded)}`;
}

export function TrendPill({
  trend,
  goodDirection = "up",
  unit = "",
  comparisonLabel,
  className,
}: TrendPillProps) {
  // A missing trend is the same claim as an unknown one: we have nothing to say.
  const state = STATE[trend?.direction ?? "unknown"];
  const Icon = state.icon;
  const baseline = comparisonLabel ?? trend?.comparison;

  const tone =
    state === STATE.unknown || trend?.direction === "flat"
      ? state.className
      : trend?.direction === goodDirection
        ? "text-[var(--success)]"
        : "text-[var(--danger)]";

  // Prefer the percentage; fall back to the absolute delta only when a
  // percentage would have misled. Never show both — two numbers for one change
  // is exactly the clutter this is meant to remove.
  const percentText = formatPercentChange(trend?.percent);
  const magnitude = percentText ?? (trend?.comparable ? `${formatAbsChange(trend.delta)}${unit}` : null);

  const accessibleLabel =
    trend?.direction === "unknown" || !trend
      ? `No comparison available${baseline ? ` against ${baseline}` : ""}`
      : `${magnitude} ${state.label}${baseline ? ` vs ${baseline}` : ""}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[0.6875rem] font-semibold leading-none",
        tone,
        className,
      )}
      data-trend={trend?.direction ?? "unknown"}
      title={accessibleLabel}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {magnitude ? (
        <span className="tabular-nums">{magnitude}</span>
      ) : (
        <span className="font-medium text-[var(--foreground-subtle)]">No comparison yet</span>
      )}
      {magnitude && baseline ? (
        <span className="font-medium text-[var(--foreground-subtle)]">vs {baseline}</span>
      ) : null}
      <span className="sr-only">{accessibleLabel}</span>
    </span>
  );
}

export default TrendPill;
