/**
 * Derive last-7-days completion facets from local session history.
 * Pure and unit-tested. Oldest → today. Authed cloud history is not
 * consulted: this drives an ambient visual, and same-device meaning is
 * honest for it.
 */

export interface HistorySession {
  completedAt: string;
  mode?: string;
  durationSeconds?: number;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Seven flags (oldest → today): did a focus session complete that day? */
export function weeklyFacets(sessions: HistorySession[], now: number = Date.now()): boolean[] {
  const days: string[] = [];
  const base = new Date(now);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    days.push(dayKey(d));
  }
  const done = new Set<string>();
  for (const s of sessions) {
    if (s.mode && s.mode !== "focus") continue;
    const t = new Date(s.completedAt).getTime();
    if (!Number.isFinite(t)) continue;
    const d = new Date(t);
    done.add(dayKey(d));
  }
  return days.map((k) => done.has(k));
}
