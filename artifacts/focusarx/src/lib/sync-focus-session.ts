import { getToken } from "@/lib/auth";
import type { Session } from "@/types/timer";

export type SyncResult = {
  success: boolean;
  streakUpdated: boolean;
  sessionId?: string;
  error?: string;
  offline?: boolean;
};

export async function syncFocusSessionToCloud(
  session: Session,
  dbSessionId?: string | null
): Promise<SyncResult> {
  try {
    const token = getToken();
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        ...(dbSessionId ? { sessionId: dbSessionId } : {}),
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
    const data = await res.json() as { session?: { id?: string }; streakUpdated?: boolean };
    return { success: true, streakUpdated: !!data.streakUpdated, sessionId: data.session?.id };
  } catch {
    return { success: false, streakUpdated: false, offline: true };
  }
}
