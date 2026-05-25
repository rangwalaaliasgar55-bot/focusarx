import { getToken } from "@/lib/auth";
import type { PersistedActiveSession, SessionSyncPayload } from "@/types/session-persistence";
import type { Session } from "@/types/timer";

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
    return data.session ?? null;
  } catch {
    return null;
  }
}

export async function createActiveSession(body: {
  mode: string;
  secondsLeft: number;
  timerStatus: string;
  monitorEnabled?: boolean;
}): Promise<PersistedActiveSession | null> {
  try {
    const res = await fetch("/api/sessions/active", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
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
    const res = await fetch("/api/sessions/sync", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function completePersistedSession(
  session: Session,
  dbSessionId: string
): Promise<{ success: boolean; streakUpdated: boolean; offline?: boolean; error?: string }> {
  try {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        sessionId: dbSessionId,
        mode: session.mode,
        durationSec: session.durationSeconds,
        completedAt: session.completedAt,
        clientNonce: session.id,
        focusScore: session.focusScore,
        focusQuality: session.focusQuality,
        focusTimeline: session.focusTimeline,
        stabilityRating: session.stabilityRating,
        sessionInsights: session.sessionInsights,
        taskId: session.taskId,
      }),
    });
    if (!res.ok) {
      return { success: false, streakUpdated: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json() as { streakUpdated?: boolean };
    return { success: true, streakUpdated: !!data.streakUpdated };
  } catch {
    return { success: false, streakUpdated: false, offline: true };
  }
}
