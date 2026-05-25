import type { FocusQuality } from "@/types/focus";

export function getFocusQuality(score: number): FocusQuality {
  if (score >= 85) return "high";
  if (score >= 60) return "medium";
  return "low";
}

export type AdaptiveScoreInput = {
  activeSessionDuration: number;
  distractedDuration: number;
  majorDistractionCount: number;
  microDistractionCount: number;
  consecutiveDistractions: number;
  totalInterruptions: number;
  longestFocusStreak: number;
};

export function computeAdaptiveFocusScore(input: AdaptiveScoreInput): number {
  let score = 100;
  const total = input.activeSessionDuration;

  score -= input.majorDistractionCount * 12;
  score -= input.microDistractionCount * 5;

  const stackPenalty = Math.min(
    20,
    input.consecutiveDistractions * 3 +
      Math.max(0, input.totalInterruptions - 1) * 2
  );
  score -= stackPenalty;

  if (total > 0) {
    const focusRatio = Math.max(0, total - input.distractedDuration) / total;
    score = score * 0.55 + focusRatio * 100 * 0.45;
  }

  const streakBonus = Math.min(15, Math.floor(input.longestFocusStreak / 60) * 2);
  score += streakBonus;

  if (input.totalInterruptions >= 5) {
    score *= 0.88;
  } else if (input.totalInterruptions >= 3) {
    score *= 0.94;
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}
