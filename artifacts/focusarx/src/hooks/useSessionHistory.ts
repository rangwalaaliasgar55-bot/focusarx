
import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { STORAGE_KEYS } from "@/lib/constants";
import type { Session } from "@/types/timer";

export function useSessionHistory() {
  const [sessions, setSessions] = useLocalStorage<Session[]>(
    STORAGE_KEYS.sessions,
    []
  );

  const addSession = useCallback(
    (session: Session) => setSessions((prev) => [session, ...prev].slice(0, 100)),
    [setSessions]
  );

  const clearHistory = useCallback(() => setSessions([]), [setSessions]);

  const focusSessionsToday = sessions.filter((s) => {
    const today = new Date().toDateString();
    return (
      s.mode === "focus" &&
      new Date(s.completedAt).toDateString() === today
    );
  }).length;

  return { sessions, addSession, clearHistory, focusSessionsToday };
}
