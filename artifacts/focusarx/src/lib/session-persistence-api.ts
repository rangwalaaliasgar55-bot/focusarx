import { getToken } from "@/lib/auth";
import { deviceTimeZone } from "@/lib/safeStorage";
import type { FocusTimelinePoint } from "@/types/focus";
import type { PersistedActiveSession, SessionSyncPayload } from "@/types/session-persistence";

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export async function fetchActiveSession(): Promise<PersistedActiveSession | null> {
  try {
    const res = await fetch("/api/sessions/active", {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as { session: PersistedActiveSession | null };
    if (!data.session) return null;
    return { ...data.session, focusTimeline: parseTimeline(data.session.focusTimeline) };
  } catch {
    return null;
  }
}

/**
 * The server persists the timeline as a JSON string (text column) while the
 * client works with `{ t, state }[]`. Normalise at the boundary so restore
 * code never spreads a string into characters or trusts a malformed blob.
 */
function parseTimeline(raw: unknown): FocusTimelinePoint[] {
  let value: unknown = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  const out: FocusTimelinePoint[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { t, state } = item as { t?: unknown; state?: unknown };
    if (typeof t !== "number" || !Number.isFinite(t)) continue;
    if (state !== "focus" && state !== "distracted") continue;
    out.push({ t, state });
  }
  return out;
}

export async function createActiveSession(body: {
  mode: string;
  secondsLeft: number;
  timerStatus: string;
  monitorEnabled?: boolean;
}): Promise<PersistedActiveSession | null> {
  try {
    // Device zone lets the server keep streak/productivity days user-local.
    const tz = deviceTimeZone();
    const res = await fetch("/api/sessions/active", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(tz ? { ...body, timezone: tz } : body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { session: PersistedActiveSession };
    return data.session;
  } catch {
    return null;
  }
}

export async function abandonActiveSession(): Promise<void> {
  try {
    await fetch("/api/sessions/active", {
      method: "DELETE",
      headers: authHeaders(),
    });
  } catch {
    /* offline */
  }
}

export async function syncActiveSession(payload: SessionSyncPayload): Promise<boolean> {
  try {
    const post = (body: SessionSyncPayload) => fetch("/api/sessions/sync", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    const res = await post(payload);
    // A body-too-large response must never wedge the session: the timer
    // clock is what matters, so retry once without the (optional) timeline.
    if (res.status === 413 && payload.focusTimeline && payload.focusTimeline.length > 0) {
      const slim = { ...payload };
      delete slim.focusTimeline;
      const retry = await post(slim);
      return retry.ok;
    }
    return res.ok;
  } catch {
    return false;
  }
}
