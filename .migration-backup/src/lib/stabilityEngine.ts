import type { StabilityRating } from "@/types/focus";

export function computeStabilityRating(input: {
  longestFocusStreak: number;
  totalInterruptions: number;
  averageFocusDuration: number;
  durationSec: number;
}): StabilityRating {
  const { longestFocusStreak, totalInterruptions, averageFocusDuration, durationSec } =
    input;

  const streakRatio =
    durationSec > 0 ? longestFocusStreak / durationSec : 0;
  const interruptionRate =
    durationSec > 0 ? totalInterruptions / (durationSec / 60) : totalInterruptions;

  if (
    longestFocusStreak >= 300 &&
    totalInterruptions <= 2 &&
    averageFocusDuration >= 120
  ) {
    return "High Stability";
  }

  if (
    streakRatio >= 0.45 &&
    totalInterruptions <= 4 &&
    interruptionRate <= 2.5
  ) {
    return "High Stability";
  }

  if (
    longestFocusStreak >= 90 ||
    (totalInterruptions <= 6 && averageFocusDuration >= 45)
  ) {
    return "Medium Stability";
  }

  return "Low Stability";
}
