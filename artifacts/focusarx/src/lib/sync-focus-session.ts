import { getToken } from "@/lib/auth";
import { deviceTimeZone } from "@/lib/safeStorage";
import type { Session } from "@/types/timer";

export type SyncResult = {
  success: boolean;
  streakUpdated: boolean;
  shieldUsed?: boolean;
  sessionId?: string;
  earnedXp?: number;
  earnedCoins?: number;
  error?: string;
  offline?: boolean;
};

export async function syncFocusSessionToCloud(
  session: Session,
  dbSessionId?: string | null,
  earlyCompletionData?: {
    plannedDurationSec: number;
    completedEarly: boolean;
    completionPercentage: number;
    sessionStatus: "completed" | "completed_early";
  }
): Promise<SyncResult> {
  try {
    const token = getToken();
    // Device zone drives user-local streak/productivity day keys server-side.
    const tz = deviceTimeZone();
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
        ...(tz ? { timezone: tz } : {}),
        ...(earlyCompletionData ?? {}),
      }),
    });
    if (!res.ok) {
      return { success: false, streakUpdated: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json() as {
      session?: { id?: string };
      streakUpdated?: boolean;
      shieldUsed?: boolean;
      earnedXp?: number;
      earnedCoins?: number;
    };
    return {
      success: true,
      streakUpdated: !!data.streakUpdated,
      shieldUsed: !!data.shieldUsed,
      sessionId: data.session?.id,
      earnedXp: data.earnedXp ?? 0,
      earnedCoins: data.earnedCoins ?? 0,
    };
  } catch {
    return { success: false, streakUpdated: false, offline: true };
  }
}
