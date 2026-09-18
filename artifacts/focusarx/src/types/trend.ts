/**
 * Mirror of the API's `artifacts/api-server/src/lib/trend.ts` wire shape.
 *
 * Kept as a hand-written type rather than imported from the server package:
 * the frontend must not take a build dependency on the API's internals, and
 * this file is the interface contract between the two. If the server shape
 * changes, `TrendPill` starts rendering `unknown` for everything, which the
 * tests in `components/ui/trend-pill.test.tsx` pin down.
 */

export type TrendDirection = "up" | "down" | "flat" | "unknown";

export interface Trend {
  /** `unknown` means "no defensible statement" — render no number at all. */
  direction: TrendDirection;
  /** Signed change in the metric's own unit. */
  delta: number;
  /** Signed percentage change, or null when a percentage would mislead. */
  percent: number | null;
  /** The baseline the comparison was made against, e.g. `"yesterday"`. */
  comparison: string;
  /** `direction !== "unknown"`. See the server module for why this is separate from `percent !== null`. */
  comparable: boolean;
}
