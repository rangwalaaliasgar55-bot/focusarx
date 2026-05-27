export type FaceState = "unknown" | "present" | "absent";
export type DistractionType = "none" | "micro" | "major";
export type FocusQuality = "high" | "medium" | "low";
export type StabilityRating = "High Stability" | "Medium Stability" | "Low Stability";

export type FocusTimelinePoint = {
  t: number;
  state: "focus" | "distracted";
};

export type SessionInsights = {
  summary: string;
  bestFocusPeriod: string;
  worstDistractionPeriod: string;
  totalInterruptions: number;
  stabilityRating: StabilityRating;
};

export type SessionFocusMetrics = {
  focusScore: number;
  focusQuality: FocusQuality;
  focusTimeline: FocusTimelinePoint[];
  stabilityRating: StabilityRating;
  sessionInsights: SessionInsights;
  longestFocusStreak: number;
  totalInterruptions: number;
  averageFocusDuration: number;
};
