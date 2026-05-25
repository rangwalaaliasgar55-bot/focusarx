import type { TimerMode } from "@/types/timer";

export function formatTime(totalSeconds: number): { minutes: string; seconds: string } {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return {
    minutes: String(m).padStart(2, "0"),
    seconds: String(s).padStart(2, "0"),
  };
}

export function calcProgress(remainingSeconds: number, totalSeconds: number): number {
  if (totalSeconds === 0) return 0;
  return 1 - remainingSeconds / totalSeconds;
}

export function getModeLabel(mode: TimerMode): string {
  switch (mode) {
    case "focus":     return "Focus";
    case "break":     return "Short Break";
    case "longBreak": return "Long Break";
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
