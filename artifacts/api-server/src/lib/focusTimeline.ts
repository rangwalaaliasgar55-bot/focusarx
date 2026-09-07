/**
 * Focus-timeline normalisation shared by the active-session sync and the
 * completion endpoints.
 *
 * The client's study monitor records a `{ t, state }` point on every
 * focus/distracted transition plus one bucket every 15 s. Over a long session
 * (or a flapping camera) that list grew without bound and the raw payload
 * eventually exceeded the JSON body limit (HTTP 413) — after which the
 * session could never sync again. The server therefore treats the timeline
 * as untrusted, compacts it, and caps both the point count and the stored
 * byte size so a single session can never poison the row.
 */

export type FocusTimelinePoint = { t: number; state: "focus" | "distracted" };

/** Hard cap on stored points (≈ one per 15 s for a 4 h session). */
export const MAX_TIMELINE_POINTS = 960;
/** Hard cap on the serialised JSON we persist per session. */
export const MAX_TIMELINE_BYTES = 48 * 1024;

function toPoint(value: unknown): FocusTimelinePoint | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { t?: unknown; state?: unknown };
  const t = typeof raw.t === "number" ? raw.t : Number(raw.t);
  if (!Number.isFinite(t) || t < 0) return null;
  const state = raw.state === "focus" || raw.state === "distracted" ? raw.state : null;
  if (!state) return null;
  return { t: Math.floor(t), state };
}

/**
 * Accepts an array, a JSON string, or garbage; always returns a clean list.
 * Consecutive points with the same state are collapsed to the first one,
 * points are sorted by time, and the result is downsampled to
 * `MAX_TIMELINE_POINTS` while preserving the first and last samples.
 */
export function normalizeFocusTimeline(input: unknown, maxPoints = MAX_TIMELINE_POINTS): FocusTimelinePoint[] {
  let source: unknown = input;
  if (typeof source === "string") {
    if (!source.trim()) return [];
    try {
      source = JSON.parse(source);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(source)) return [];

  const points: FocusTimelinePoint[] = [];
  for (const item of source) {
    const point = toPoint(item);
    if (point) points.push(point);
  }
  points.sort((a, b) => a.t - b.t);

  const collapsed = collapseRuns(points);
  if (collapsed.length <= maxPoints) return collapsed;
  // Even-stride downsample that always keeps the first and the last point,
  // then collapse again so the output is stable under repeated normalisation.
  const sampled: FocusTimelinePoint[] = [];
  const stride = (collapsed.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const index = Math.min(collapsed.length - 1, Math.round(i * stride));
    const candidate = collapsed[index]!;
    const previous = sampled[sampled.length - 1];
    if (previous && previous.t === candidate.t) continue;
    sampled.push(candidate);
  }
  return collapseRuns(sampled);
}

/** Keep only the first point of every run of identical states. */
function collapseRuns(points: readonly FocusTimelinePoint[]): FocusTimelinePoint[] {
  const out: FocusTimelinePoint[] = [];
  for (const point of points) {
    const previous = out[out.length - 1];
    if (previous && previous.state === point.state) continue;
    out.push(point);
  }
  return out;
}

/** Serialise a timeline for storage, shrinking until it fits the byte cap. */
export function serializeFocusTimeline(input: unknown): string {
  let points = normalizeFocusTimeline(input);
  let json = JSON.stringify(points);
  let budget = MAX_TIMELINE_POINTS;
  while (json.length > MAX_TIMELINE_BYTES && budget > 16) {
    budget = Math.floor(budget / 2);
    points = normalizeFocusTimeline(points, budget);
    json = JSON.stringify(points);
  }
  return json;
}
