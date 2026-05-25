import type { FocusTimelinePoint, SessionInsights } from "@/types/focus";

export function parseFocusTimeline(raw: string | null): FocusTimelinePoint[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FocusTimelinePoint[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseSessionInsights(raw: string | null): SessionInsights | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionInsights;
  } catch {
    return null;
  }
}
