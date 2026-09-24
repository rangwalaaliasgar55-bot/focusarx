/**
 * "Read of your week" — the four sentences a student actually needs.
 *
 * The analytics page has always had the data: 14 days of minutes, an hour
 * histogram, an hour-by-weekday grid, week-over-week totals and all-time bests.
 * What it did not have was a conclusion. Every one of those charts answers a
 * question the student has to think to ask — "which hours am I best at?", "am I
 * getting better?", "how consistent am I?" — and a page of charts that requires
 * four questions is a page people look at once.
 *
 * These functions derive the conclusion, name the evidence, and where there is
 * something to *do*, say what to do. Pure and total: every input may be missing
 * (a brand-new account has nothing), and an insight that cannot be supported by
 * the data is simply not emitted rather than guessed at.
 */

export interface InsightInput {
  /** Minutes per day for the last 14 days, oldest first (holes allowed). */
  chart14: Array<{ date: string; minutes: number }>;
  /** Minutes per hour of day, 0–23. */
  hourDist: Array<{ hour: number; minutes: number }>;
  /** Minutes per (weekday, hour) — weekday is 0 = Sunday. */
  timeDayHeatmap?: Array<{ day: number; hour: number; minutes: number; sessions: number }>;
  weekComparison?: { thisWeekMinutes: number; lastWeekMinutes: number } | undefined;
  personalBests?: {
    longestSessionMinutes?: number;
    bestDayMinutes?: number;
    totalSessions?: number;
    totalMinutes?: number;
    longestStreak?: number;
  } | undefined;
}

export type InsightTone = "neutral" | "up" | "down" | "action";

export interface Insight {
  id: "window" | "trend" | "consistency" | "strength" | "headroom";
  title: string;
  detail: string;
  tone: InsightTone;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Named bands, so "20:00–23:00" reads as a part of the day, not a number. */
const BANDS: Array<{ id: string; label: string; from: number; to: number }> = [
  { id: "early", label: "early mornings (5–9)", from: 5, to: 9 },
  { id: "morning", label: "mornings (9–12)", from: 9, to: 12 },
  { id: "afternoon", label: "afternoons (12–17)", from: 12, to: 17 },
  { id: "evening", label: "evenings (17–21)", from: 17, to: 21 },
  { id: "night", label: "nights (21–24)", from: 21, to: 24 },
];

export function formatHours(minutes: number): string {
  const safe = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  const h = Math.floor(safe / 60);
  const m = Math.round(safe % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * The hour band with the most focus time, when it holds a real share of the
 * total. A band that is merely the largest of five empty ones is not a finding.
 */
export function bestWindow(
  hourDist: Array<{ hour: number; minutes: number }>,
): { label: string; from: number; to: number; share: number; minutes: number } | null {
  const usable = (hourDist ?? []).filter((h) => Number.isFinite(h?.hour) && Number.isFinite(h?.minutes) && h.minutes > 0);
  const total = usable.reduce((sum, h) => sum + h.minutes, 0);
  if (total <= 0) return null;

  let best: { id: string; label: string; from: number; to: number; minutes: number } | null = null;
  for (const band of BANDS) {
    const minutes = usable
      .filter((h) => h.hour >= band.from && h.hour < band.to)
      .reduce((sum, h) => sum + h.minutes, 0);
    if (minutes > (best?.minutes ?? 0)) best = { ...band, minutes };
  }
  if (!best) return null;

  const share = best.minutes / total;
  // Four evenly-used bands put 25% in each; a "best window" needs to stand out
  // beyond that, or the recommendation is noise.
  if (share <= 0.3) return null;
  return { label: best.label, from: best.from, to: best.to, share, minutes: best.minutes };
}

/** The weekday with the most minutes, when it clears the weekly average. */
export function strongestWeekday(
  heatmap: Array<{ day: number; minutes: number }> | undefined,
): { day: number; minutes: number } | null {
  const rows = (heatmap ?? []).filter((r) => Number.isFinite(r?.day) && Number.isFinite(r?.minutes));
  if (rows.length === 0) return null;
  const perDay = new Map<number, number>();
  for (const row of rows) perDay.set(row.day, (perDay.get(row.day) ?? 0) + row.minutes);
  const entries = [...perDay.entries()].filter(([, minutes]) => minutes > 0);
  if (entries.length < 3) return null; // not enough of a week to compare
  const total = entries.reduce((sum, [, minutes]) => sum + minutes, 0);
  const [day, minutes] = entries.sort((a, b) => b[1] - a[1])[0]!;
  const average = total / entries.length;
  if (minutes < average * 1.25) return null; // nothing stands out
  return { day, minutes };
}

/** Focused days, the current run, and the longest run across the window. */
export function consistency(chart14: Array<{ minutes: number }>): {
  activeDays: number;
  window: number;
  bestRun: number;
} | null {
  const days = (chart14 ?? []).map((d) => (Number.isFinite(d?.minutes) ? d.minutes : 0));
  if (days.length === 0) return null;
  let activeDays = 0;
  let run = 0;
  let bestRun = 0;
  for (const minutes of days) {
    if (minutes > 0) {
      activeDays += 1;
      run += 1;
      bestRun = Math.max(bestRun, run);
    } else {
      run = 0;
    }
  }
  if (activeDays === 0) return null;
  return { activeDays, window: days.length, bestRun };
}

/**
 * Everything the page can honestly say, strongest first, capped so the card
 * stays readable.
 */
export function buildInsights(input: InsightInput, max = 4): Insight[] {
  const insights: Insight[] = [];

  const window = bestWindow(input.hourDist ?? []);
  if (window) {
    insights.push({
      id: "window",
      title: `Your best focus window is ${window.label}`,
      detail: `${Math.round(window.share * 100)}% of all your focus time happens then. Put your next block at ${String(window.from).padStart(2, "0")}:00 and protect it.`,
      tone: "action",
    });
  }

  const wc = input.weekComparison;
  if (wc && (wc.thisWeekMinutes > 0 || wc.lastWeekMinutes > 0)) {
    const delta = wc.thisWeekMinutes - wc.lastWeekMinutes;
    const pct = wc.lastWeekMinutes > 0 ? Math.round((delta / wc.lastWeekMinutes) * 100) : null;
    if (delta === 0 && wc.thisWeekMinutes > 0) {
      insights.push({
        id: "trend",
        title: `Holding steady at ${formatHours(wc.thisWeekMinutes)} this week`,
        detail: "Same volume as last week. Steady is a good sign — add one block to move the line up.",
        tone: "neutral",
      });
    } else if (delta > 0) {
      insights.push({
        id: "trend",
        title: pct == null ? `Already ${formatHours(wc.thisWeekMinutes)} this week` : `Up ${pct}% on last week`,
        detail: `${formatHours(wc.thisWeekMinutes)} so far against ${formatHours(wc.lastWeekMinutes)} last week (${formatHours(delta)} more).`,
        tone: "up",
      });
    } else {
      insights.push({
        id: "trend",
        title: pct == null ? `Down to ${formatHours(wc.thisWeekMinutes)} this week` : `Down ${Math.abs(pct)}% on last week`,
        detail: `${formatHours(wc.thisWeekMinutes)} so far against ${formatHours(wc.lastWeekMinutes)} last week. One 25-minute block today closes most of that gap.`,
        tone: "down",
      });
    }
  }

  const cons = consistency(input.chart14 ?? []);
  if (cons) {
    const strongest = cons.bestRun >= 3;
    insights.push({
      id: "consistency",
      title: `You focused on ${cons.activeDays} of the last ${cons.window} days`,
      detail: strongest
        ? `Your longest run in that stretch was ${cons.bestRun} days in a row. Keeping the run alive beats a longer session.`
        : `Best run so far: ${cons.bestRun} ${cons.bestRun === 1 ? "day" : "days"} in a row. Two days back to back is the first real milestone.`,
      tone: cons.activeDays / cons.window >= 0.5 ? "up" : "action",
    });
  }

  const pb = input.personalBests;
  const sessions = pb?.totalSessions ?? 0;
  const totalMinutes = pb?.totalMinutes ?? 0;
  const longest = pb?.longestSessionMinutes ?? 0;
  if (sessions >= 5 && totalMinutes > 0 && longest > 0) {
    const average = Math.round(totalMinutes / sessions);
    if (longest >= average * 2 && longest >= 45) {
      insights.push({
        id: "headroom",
        title: `Your typical block is ${average} min, your best is ${longest} min`,
        detail: `You already have a longer gear. Book one ${Math.min(longest, 90)}-minute block this week and see what it produces.`,
        tone: "action",
      });
    }
  }

  const best = strongestWeekday(input.timeDayHeatmap);
  if (best) {
    insights.push({
      id: "strength",
      title: `${WEEKDAYS[best.day] ?? "One day"} is your strongest day`,
      detail: `${formatHours(best.minutes)} focused on ${WEEKDAYS[best.day] ?? "that day"} — the day your week actually works. Nothing has to change there.`,
      tone: "neutral",
    });
  }

  // Ordered most-actionable first, so the cap trims the observations rather than
  // the instructions.
  return insights.slice(0, max);
}
