import type { Session } from "@/types/timer";

export type SyncResult = {
  success: boolean;
  streakUpdated: boolean;
  error?: string;
  offline?: boolean;
};

export async function syncFocusSessionToCloud(
  session: Session,
  dbSessionId?: string | null
): Promise<SyncResult> {
  try {
    const res = await fetch("/api/sessions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
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
    
    const data = await res.json();
    return {
      success: true,
      streakUpdated: !!data.streakUpdated,
    };
  } catch (err) {
    // Treat fetch failures (e.g. network error) as offline gracefully
    return { success: false, streakUpdated: false, offline: true };
  }
}
