import { getToken } from "@/lib/auth";
import { deviceTimeZone } from "@/lib/safeStorage";
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
