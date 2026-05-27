import type { SessionInsights, StabilityRating } from "@/types/focus";

export function generateSessionInsights(input: {
  focusScore: number;
  stabilityRating: StabilityRating;
  longestFocusStreak: number;
  totalInterruptions: number;
  averageFocusDuration: number;
  durationSec: number;
  bestFocusStreakSec: number;
  longestDistractionSec: number;
  majorDistractionCount: number;
  microDistractionCount: number;
}): SessionInsights {
  const {
    focusScore,
    stabilityRating,
    longestFocusStreak,
    totalInterruptions,
    averageFocusDuration,
    durationSec,
    bestFocusStreakSec,
    longestDistractionSec,
    majorDistractionCount,
    microDistractionCount,
  } = input;

  const bestMin = Math.max(1, Math.round(bestFocusStreakSec / 60));
  const worstMin = Math.max(0, Math.round(longestDistractionSec / 60));

  const bestFocusPeriod =
    bestFocusStreakSec > 0
      ? `Best focus: ~${bestMin} min uninterrupted (from ~${formatOffset(bestFocusStreakSec, durationSec)} into session).`
      : "Best focus: steady attention for most of the session.";

  const worstDistractionPeriod =
    longestDistractionSec > 0
      ? `Longest away period: ~${worstMin} min.`
      : totalInterruptions > 0
        ? "Distractions were brief and scattered."
        : "No significant away periods detected.";

  let summary: string;

  if (focusScore >= 85 && stabilityRating === "High Stability") {
    summary =
      "Excellent focus stability. You maintained long uninterrupted study periods.";
  } else if (focusScore >= 60) {
    summary =
      "You had moderate focus. Most distractions occurred after short study bursts.";
  } else if (majorDistractionCount >= 3) {
    summary =
      "Frequent distractions detected. Try shorter focus sessions with breaks.";
  } else if (microDistractionCount > majorDistractionCount * 2) {
    summary =
      "Many brief distractions added up. Reduce tab-switching and keep your gaze on the task.";
  } else {
    summary =
      "Focus dipped in the second half. Consider a short break before your next block.";
  }

  if (averageFocusDuration < 120 && durationSec > 600 && focusScore < 70) {
    summary +=
      " Your average focused stretch was under 2 minutes — aim for one longer uninterrupted block.";
  }

  return {
    summary,
    bestFocusPeriod,
    worstDistractionPeriod,
    totalInterruptions,
    stabilityRating,
  };
}

function formatOffset(streakSec: number, totalSec: number): string {
  const start = Math.max(0, totalSec - streakSec);
  const m = Math.floor(start / 60);
  return `${m} min`;
}
