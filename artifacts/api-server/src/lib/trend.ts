/**
 * Direction for a point-in-time metric.
 *
 * "A metric without direction is incomplete" — a dashboard that shows `42` but
 * not whether 42 is better or worse than usual asks the reader to do the
 * analysis. Every headline number in this product is now paired with the
 * comparison that makes it mean something.
 *
 * The interesting part is not the percentage, it is the cases where a
 * percentage is a lie. `(current - previous) / previous * 100` is the obvious
 * implementation and it is wrong for three inputs that happen constantly in a
 * habit product:
 *
 *   • **previous = 0.** A first session ever, or the first session after a
 *     break. The division is by zero: the naive version ships `Infinity%`,
 *     `NaN%`, or — if someone guards with `|| 1` — a confident and completely
 *     fabricated `+2500%`. None of those is a fact about the user.
 *   • **both = 0.** Nothing either day. That is not "0% change" (which reads as
 *     "flat, steady effort"); it is no data at all, and rendering it as flat is
 *     how a dead account looks healthy.
 *   • **tiny previous.** Going from 1 minute to 10 is `+900%`, which is
 *     arithmetically true and useless as a signal. Below a floor the absolute
 *     delta is the honest unit.
 *
 * So a trend is either a percentage, an absolute delta, or a refusal to claim
 * anything — and the caller renders each of the three differently. This module
 * only decides which; the wording lives with the component.
 */

export type TrendDirection = "up" | "down" | "flat" | "unknown";

export interface Trend {
  /** `unknown` means "no defensible statement", and callers must not render a number. */
  direction: TrendDirection;
  /** Signed change, in the metric's own unit. Always present when direction is known. */
  delta: number;
  /**
   * Signed percentage change, or null when a percentage would mislead.
   * Null is a normal outcome, not an error.
   */
  percent: number | null;
  /** The comparison actually made, for the label ("vs yesterday"). */
  comparison: string;
  /**
   * Exactly `direction !== "unknown"` — kept as its own field because it reads
   * better at the call site than comparing against a magic string, and because
   * it makes the rule explicit: the UI shows a direction only when one is
   * defensible. Note this is NOT the same as "a percentage is available": a
   * rise from no baseline has a direction but no honest percentage.
   */
  comparable: boolean;
}

export interface TrendInput {
  current: number;
  previous: number;
  /** Human label for the baseline period, e.g. "yesterday", "your 7-day average". */
  comparison: string;
  /**
   * Below this `previous`, report the absolute delta instead of a percentage.
   * Going 1 → 10 minutes is +900% and reads as noise.
   */
  minPercentBase?: number;
  /** Treat changes smaller than this as flat, so ±1 minute does not read as a trend. */
  flatThreshold?: number;
}

const DEFAULT_MIN_PERCENT_BASE = 5;
const DEFAULT_FLAT_THRESHOLD = 0.5;

/**
 * Compare two periods.
 *
 * Never throws and never returns NaN/Infinity in a numeric field: `percent` is
 * null rather than a fabricated figure when the baseline cannot support one.
 */
export function computeTrend(input: TrendInput): Trend {
  const { current, previous, comparison } = input;
  const minPercentBase = input.minPercentBase ?? DEFAULT_MIN_PERCENT_BASE;
  const flatThreshold = input.flatThreshold ?? DEFAULT_FLAT_THRESHOLD;

  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safePrevious = Number.isFinite(previous) ? previous : 0;
  const delta = safeCurrent - safePrevious;

  // Nothing to compare. Reporting "0%" here would describe a dead account as
  // perfectly steady, so refuse to make a claim at all.
  //
  // This is the ONLY case where a direction is not defensible: if either period
  // has activity, "up"/"down"/"flat" is a fact. `comparable` tracks exactly
  // that, which is why it is derived from this flag and not from whether a
  // percentage exists — a rise from no baseline has a direction but no honest
  // percentage.
  const canCompare = !(safeCurrent === 0 && safePrevious === 0);

  const direction: TrendDirection = !canCompare
    ? "unknown"
    : Math.abs(delta) <= flatThreshold
      ? "flat"
      : delta > 0
        ? "up"
        : "down";

  // A baseline below the floor cannot support a percentage: 1 → 10 minutes is
  // +900% and reads as noise. The absolute delta carries the meaning instead.
  const percent = canCompare && safePrevious >= minPercentBase ? (delta / safePrevious) * 100 : null;

  return { direction, delta, percent, comparison, comparable: canCompare };
}

/**
 * Trend of a value against the mean of a window (e.g. today vs the 7-day daily
 * average). Uses the same rules, with the mean standing in for `previous`.
 */
export function computeTrendVsAverage(
  current: number,
  window: readonly number[],
  comparison: string,
  opts: Omit<TrendInput, "current" | "previous" | "comparison"> = {},
): Trend {
  const observed = window.filter((n) => Number.isFinite(n));
  // An empty window has no average; a mean of [] is NaN and would poison every
  // comparison downstream.
  const previous = observed.length ? observed.reduce((sum, n) => sum + n, 0) / observed.length : 0;
  return computeTrend({ current, previous, comparison, ...opts });
}

/** `42` → `+42`; `-3` → `−3` (U+2212, which aligns in tabular figures). */
export function formatDelta(delta: number): string {
  if (!Number.isFinite(delta) || delta === 0) return "0";
  const rounded = Math.round(delta);
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : `\u2212${Math.abs(rounded)}`;
}

/** `12.4` → `+12%`. Returns null when there is no defensible percentage. */
export function formatPercent(percent: number | null): string | null {
  if (percent === null || !Number.isFinite(percent)) return null;
  const rounded = Math.round(percent);
  if (rounded === 0) return "0%";
  return rounded > 0 ? `+${rounded}%` : `\u2212${Math.abs(rounded)}%`;
}
