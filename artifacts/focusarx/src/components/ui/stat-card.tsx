import * as React from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { TrendPill } from "@/components/ui/trend-pill";
import type { Trend } from "@/types/trend";

/**
 * A KPI card: one number, its meaning, and its direction.
 *
 * Built to the research findings that the old dashboard missed:
 *
 * • **"A metric without direction is incomplete."** The number and its trend
 *   are rendered by one component so a headline figure cannot ship without its
 *   context — there is no prop combination that produces a bare number.
 * • **Fitts's Law.** The value is the largest type in the card and sits in a
 *   predictable position regardless of label length, so the eye can target it
 *   without reading. Detail text is deliberately smaller and lighter.
 * • **Progressive disclosure.** `detail` is a short qualifier, not a paragraph,
 *   and `sparkline` shows the shape of the last week without a single axis
 *   label or tooltip. Anyone who needs more taps through; nobody is handed a
 *   chart to interpret on a summary screen.
 * • **Five-second test.** Order of reading is label → value → trend → detail,
 *   so a glance yields "minutes focused: 42, up 12%". If a stranger remembers
 *   the colour and not the number, the hierarchy here has failed.
 */

export interface StatCardProps {
  label: string;
  value: number | string;
  /** Rendered small and muted directly after the value, e.g. `"min"`. */
  unit?: string;
  icon?: React.ReactNode;
  /** Direction of travel. Omit for a metric with no comparison — renders as "no comparison yet". */
  trend?: Trend | null;
  /** Which direction is good news. Defaults to `"up"`. */
  goodDirection?: "up" | "down";
  /** Suffix for the trend's absolute-delta fallback. Defaults to `unit`. */
  trendUnit?: string;
  /** One short line of context under the value. Intentionally not a sentence. */
  detail?: string;
  tone?: "brand" | "success" | "warning" | "info";
  /**
   * `primary` enlarges the value and takes an accent border. Reserve it for the
   * single decision-critical KPI — the one that decides what the user does next.
   */
  emphasis?: "default" | "primary";
  /** Makes the whole card a link, with a real focus ring. */
  href?: string;
  /** Last N values for an inline shape indicator. Needs 2+ points to render. */
  sparkline?: number[];
  /**
   * Optional content pinned to the bottom of the card. Used for a progress bar
   * that belongs to the same metric as the headline (level → XP toward next
   * level), so the two cannot drift apart into separate cards.
   */
  footer?: React.ReactNode;
  /**
   * Replaces the trend row with something that is not a time comparison.
   *
   * A streak's meaningful context is its personal record, not last week —
   * `computeTrend` is the wrong tool for that, and forcing one would produce
   * either a fake baseline or a misleading "no comparison yet" on a card that
   * has real context to give. A badge says it honestly.
   */
  badge?: React.ReactNode;
  /** Marks the value as already being interpolated, so it is not re-animated on refetch. */
  className?: string;
}

const TONES = {
  brand: { color: "var(--brand-strong)", soft: "var(--brand-soft)" },
  success: { color: "var(--success)", soft: "var(--success-soft)" },
  warning: { color: "var(--warning)", soft: "var(--warning-soft)" },
  info: { color: "var(--info)", soft: "var(--info-soft)" },
} as const;

/**
 * Inline sparkline.
 *
 * Hand-rolled SVG rather than a chart library: this is a 60×24 flourish inside
 * a card, and pulling a charting dependency (plus its layout pass) into the
 * dashboard for it would cost more than it gives. Decorative by definition —
 * the numbers next to it carry the meaning — so it is `aria-hidden` and
 * `preserveAspectRatio="none"` is safe.
 */
function Sparkline({ points, stroke }: { points: number[]; stroke: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  // A perfectly flat series has no range to normalise against; pin it to the
  // middle rather than dividing by zero and drawing NaN.
  const span = max - min || 1;
  const width = 64;
  const height = 20;
  const step = width / (points.length - 1);
  const path = points
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-5 w-16 shrink-0 overflow-visible"
      data-sparkline=""
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  unit,
  icon,
  trend,
  goodDirection = "up",
  trendUnit,
  detail,
  tone = "brand",
  emphasis = "default",
  href,
  sparkline,
  footer,
  badge,
  className,
}: StatCardProps) {
  const colors = TONES[tone];
  const isPrimary = emphasis === "primary";
  const isNumeric = typeof value === "number";

  const body = (
    <div
      className={cn(
        "flex h-full flex-col rounded-[var(--radius-xl)] border bg-[var(--surface)] p-5 transition-[border-color,box-shadow,transform] duration-[var(--duration-normal)]",
        isPrimary
          ? "border-[var(--card-border)]"
          : "border-[var(--border-subtle)] shadow-[var(--shadow-sm)]",
        href && "group-hover:-translate-y-0.5 group-hover:border-[var(--card-border)] group-hover:shadow-[var(--shadow-md)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--foreground-subtle)]">
          {label}
        </p>
        {icon ? (
          <span
            className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-lg)] [&_svg]:size-4"
            style={{ color: colors.color, background: colors.soft }}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
      </div>

      {/* Value first in the visual hierarchy — the whole point of the card. */}
      <p
        className={cn(
          "mt-3 font-semibold tracking-[-0.03em] tabular-nums",
          isPrimary ? "text-5xl sm:text-6xl" : "text-3xl",
        )}
      >
        {isNumeric ? (
          <AnimatedCounter value={value} duration={isPrimary ? 0.6 : 0.4} />
        ) : (
          value
        )}
        {unit ? (
          <span className="ml-1.5 text-sm font-medium tracking-normal text-[var(--foreground-muted)]">{unit}</span>
        ) : null}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {badge ?? <TrendPill trend={trend} goodDirection={goodDirection} unit={trendUnit ?? unit ?? ""} />}
        {sparkline && sparkline.length > 1 ? <Sparkline points={sparkline} stroke={colors.color} /> : null}
      </div>

      {detail ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--foreground-muted)]">{detail}</p>
      ) : null}

      {footer ? <div className="mt-auto pt-3">{footer}</div> : null}
    </div>
  );

  if (!href) return body;

  return (
    <Link
      href={href}
      className={cn(
        "group block h-full rounded-[var(--radius-xl)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        isPrimary && "sm:col-span-2",
      )}
    >
      {body}
    </Link>
  );
}

export default StatCard;
