import type {
  DistractionType,
  FaceState,
  FocusTimelinePoint,
  SessionFocusMetrics,
  SessionInsights,
} from "@/types/focus";
import { computeAdaptiveFocusScore } from "@/lib/focusScoreEngine";
import { computeStabilityRating } from "@/lib/stabilityEngine";
import { generateSessionInsights } from "@/lib/insightGenerator";
import { getFocusQuality } from "@/lib/focusScoreEngine";

const MICRO_MS = 2000;
const MAJOR_MS = 5000;
const TIMELINE_INTERVAL_SEC = 15;

export const studyMonitorState = {
  enabled: false,
  scoringActive: false,
  faceState: "unknown" as FaceState,
  focused: false,
  distractionType: "none" as DistractionType,
  lastSeenFaceTimestamp: 0,
  faceMissingSince: null as number | null,
  currentDistractionDurationMs: 0,
  distractionCount: 0,
  majorDistractionCount: 0,
  microDistractionCount: 0,
  activeSessionDuration: 0,
  distractedDuration: 0,
  adaptiveScore: 100,
  consecutiveDistractions: 0,
  longestFocusStreak: 0,
  currentFocusStreak: 0,
  totalInterruptions: 0,
  focusStreakSamples: [] as number[],
  focusTimeline: [] as FocusTimelinePoint[],
  lastTimelineBucket: -1,
  sessionElapsedSec: 0,
  currentDistractionStartSec: null as number | null,
  longestDistractionSec: 0,
  bestFocusStreakSec: 0,
  visibilityVisible: true,
  lastMicroToastAt: 0,
  lastMajorToastAt: 0,
};

export type MonitorToastHandler = (message: string, type: "error" | "info") => void;

let toastHandler: MonitorToastHandler | null = null;

export function setMonitorToastHandler(handler: MonitorToastHandler | null) {
  toastHandler = handler;
}

function elapsedSessionSec(): number {
  return Math.floor(studyMonitorState.activeSessionDuration);
}

function appendTimeline(state: "focus" | "distracted") {
  const t = elapsedSessionSec();
  const last = studyMonitorState.focusTimeline.at(-1);
  if (last?.state === state && last.t === t) return;
  studyMonitorState.focusTimeline.push({ t, state });
}

function maybeBucketTimeline() {
  const bucket = Math.floor(studyMonitorState.activeSessionDuration / TIMELINE_INTERVAL_SEC);
  if (bucket <= studyMonitorState.lastTimelineBucket) return;
  studyMonitorState.lastTimelineBucket = bucket;
  const state = studyMonitorState.focused ? "focus" : "distracted";
  appendTimeline(state);
}

function endFocusStreak() {
  if (studyMonitorState.currentFocusStreak > 0) {
    studyMonitorState.focusStreakSamples.push(studyMonitorState.currentFocusStreak);
    if (studyMonitorState.currentFocusStreak > studyMonitorState.longestFocusStreak) {
      studyMonitorState.longestFocusStreak = studyMonitorState.currentFocusStreak;
    }
    if (studyMonitorState.currentFocusStreak > studyMonitorState.bestFocusStreakSec) {
      studyMonitorState.bestFocusStreakSec = studyMonitorState.currentFocusStreak;
    }
  }
  studyMonitorState.currentFocusStreak = 0;
}

function startDistractionPeriod() {
  if (studyMonitorState.currentDistractionStartSec === null) {
    studyMonitorState.currentDistractionStartSec = elapsedSessionSec();
  }
}

function endDistractionPeriod() {
  if (studyMonitorState.currentDistractionStartSec !== null) {
    const duration = elapsedSessionSec() - studyMonitorState.currentDistractionStartSec;
    if (duration > studyMonitorState.longestDistractionSec) {
      studyMonitorState.longestDistractionSec = duration;
    }
    studyMonitorState.currentDistractionStartSec = null;
  }
}

function applyMajorDistraction() {
  if (studyMonitorState.distractionType === "major") return;
  studyMonitorState.distractionType = "major";
  studyMonitorState.majorDistractionCount++;
  studyMonitorState.distractionCount++;
  studyMonitorState.totalInterruptions++;
  studyMonitorState.consecutiveDistractions++;
  studyMonitorState.focused = false;
  endFocusStreak();
  startDistractionPeriod();
  appendTimeline("distracted");

  const now = Date.now();
  if (now - studyMonitorState.lastMajorToastAt > 4000) {
    studyMonitorState.lastMajorToastAt = now;
    toastHandler?.("Major distraction — please return to your study.", "error");
  }
}

function applyMicroDistraction() {
  if (
    studyMonitorState.distractionType === "micro" ||
    studyMonitorState.distractionType === "major"
  ) {
    return;
  }
  studyMonitorState.distractionType = "micro";
  studyMonitorState.microDistractionCount++;
  studyMonitorState.focused = false;
  endFocusStreak();
  startDistractionPeriod();
  appendTimeline("distracted");

  const now = Date.now();
  if (now - studyMonitorState.lastMicroToastAt > 5000) {
    studyMonitorState.lastMicroToastAt = now;
    toastHandler?.("Brief distraction detected — stay with your session.", "info");
  }
}

function applyFocusRestored() {
  const wasDistracted =
    studyMonitorState.distractionType !== "none" || !studyMonitorState.focused;
  studyMonitorState.faceMissingSince = null;
  studyMonitorState.currentDistractionDurationMs = 0;
  studyMonitorState.distractionType = "none";
  studyMonitorState.faceState = "present";
  studyMonitorState.lastSeenFaceTimestamp = Date.now();
  studyMonitorState.focused = true;
  studyMonitorState.consecutiveDistractions = 0;

  if (wasDistracted) {
    endDistractionPeriod();
    appendTimeline("focus");
  }
}

/** Process face presence from MediaPipe (call only when video frame advances). */
export function processFaceDetection(isFacePresent: boolean, isVisible: boolean) {
  if (!studyMonitorState.enabled) return;

  studyMonitorState.visibilityVisible = isVisible;
  const now = Date.now();

  if (!isVisible) {
    if (isFacePresent) {
      studyMonitorState.lastSeenFaceTimestamp = now;
    }
    if (!studyMonitorState.scoringActive) return;

    if (studyMonitorState.faceState !== "absent" || studyMonitorState.focused) {
      studyMonitorState.faceState = "absent";
      studyMonitorState.focused = false;
      if (!studyMonitorState.faceMissingSince) {
        studyMonitorState.faceMissingSince = now;
      }
    }
    updateDistractionThresholds(now);
    return;
  }

  if (isFacePresent) {
    if (!studyMonitorState.scoringActive) {
      studyMonitorState.scoringActive = true;
      studyMonitorState.faceState = "present";
      studyMonitorState.focused = true;
      studyMonitorState.lastSeenFaceTimestamp = now;
      appendTimeline("focus");
      return;
    }
    applyFocusRestored();
    return;
  }

  if (!studyMonitorState.scoringActive) {
    studyMonitorState.faceState = "unknown";
    studyMonitorState.focused = false;
    return;
  }

  studyMonitorState.faceState = "absent";
  if (!studyMonitorState.faceMissingSince) {
    studyMonitorState.faceMissingSince = now;
  }
  updateDistractionThresholds(now);
}

function updateDistractionThresholds(now: number) {
  if (!studyMonitorState.faceMissingSince) return;

  const missingMs = now - studyMonitorState.faceMissingSince;
  studyMonitorState.currentDistractionDurationMs = missingMs;

  if (missingMs < MICRO_MS) {
    studyMonitorState.distractionType = "none";
    studyMonitorState.focused = true;
    return;
  }

  if (missingMs >= MAJOR_MS) {
    applyMajorDistraction();
    return;
  }

  if (missingMs >= MICRO_MS) {
    applyMicroDistraction();
  }
}

export function processVisibilityHidden() {
  if (!studyMonitorState.enabled || !studyMonitorState.scoringActive) return;
  studyMonitorState.visibilityVisible = false;
  const now = Date.now();
  if (!studyMonitorState.faceMissingSince) {
    studyMonitorState.faceMissingSince = now;
  }
  studyMonitorState.faceState = "absent";
  updateDistractionThresholds(now);
}

export function updateFocusSessionDuration(deltaSec: number) {
  if (!studyMonitorState.enabled || !studyMonitorState.scoringActive) return;

  studyMonitorState.activeSessionDuration += deltaSec;
  studyMonitorState.sessionElapsedSec = elapsedSessionSec();

  if (studyMonitorState.focused && studyMonitorState.distractionType === "none") {
    studyMonitorState.currentFocusStreak += deltaSec;
    if (studyMonitorState.currentFocusStreak > studyMonitorState.longestFocusStreak) {
      studyMonitorState.longestFocusStreak = studyMonitorState.currentFocusStreak;
    }
  } else {
    studyMonitorState.distractedDuration += deltaSec;
  }

  maybeBucketTimeline();

  if (studyMonitorState.faceMissingSince) {
    updateDistractionThresholds(Date.now());
  }
}

export function finalizeSessionMetrics(
  durationSec: number
): SessionFocusMetrics | null {
  if (!studyMonitorState.enabled) return null;

  endFocusStreak();
  endDistractionPeriod();

  const averageFocusDuration =
    studyMonitorState.focusStreakSamples.length > 0
      ? Math.round(
          studyMonitorState.focusStreakSamples.reduce((a, b) => a + b, 0) /
            studyMonitorState.focusStreakSamples.length
        )
      : studyMonitorState.scoringActive
        ? durationSec
        : 0;

  const focusScore = studyMonitorState.scoringActive
    ? computeAdaptiveFocusScore({
        activeSessionDuration: studyMonitorState.activeSessionDuration,
        distractedDuration: studyMonitorState.distractedDuration,
        majorDistractionCount: studyMonitorState.majorDistractionCount,
        microDistractionCount: studyMonitorState.microDistractionCount,
        consecutiveDistractions: studyMonitorState.consecutiveDistractions,
        totalInterruptions: studyMonitorState.totalInterruptions,
        longestFocusStreak: studyMonitorState.longestFocusStreak,
      })
    : null;

  if (focusScore === null) return null;

  const stabilityRating = computeStabilityRating({
    longestFocusStreak: studyMonitorState.longestFocusStreak,
    totalInterruptions: studyMonitorState.totalInterruptions,
    averageFocusDuration,
    durationSec,
  });

  const sessionInsights = generateSessionInsights({
    focusScore,
    stabilityRating,
    longestFocusStreak: studyMonitorState.longestFocusStreak,
    totalInterruptions: studyMonitorState.totalInterruptions,
    averageFocusDuration,
    durationSec,
    bestFocusStreakSec: studyMonitorState.bestFocusStreakSec,
    longestDistractionSec: studyMonitorState.longestDistractionSec,
    majorDistractionCount: studyMonitorState.majorDistractionCount,
    microDistractionCount: studyMonitorState.microDistractionCount,
  });

  const timeline =
    studyMonitorState.focusTimeline.length > 0
      ? [...studyMonitorState.focusTimeline]
      : [{ t: 0, state: "focus" as const }];

  return {
    focusScore,
    focusQuality: getFocusQuality(focusScore),
    focusTimeline: timeline,
    stabilityRating,
    sessionInsights,
    longestFocusStreak: Math.round(studyMonitorState.longestFocusStreak),
    totalInterruptions: studyMonitorState.totalInterruptions,
    averageFocusDuration,
  };
}

export function resetFocusMonitor() {
  studyMonitorState.scoringActive = false;
  studyMonitorState.faceState = "unknown";
  studyMonitorState.focused = false;
  studyMonitorState.distractionType = "none";
  studyMonitorState.lastSeenFaceTimestamp = 0;
  studyMonitorState.faceMissingSince = null;
  studyMonitorState.currentDistractionDurationMs = 0;
  studyMonitorState.distractionCount = 0;
  studyMonitorState.majorDistractionCount = 0;
  studyMonitorState.microDistractionCount = 0;
  studyMonitorState.activeSessionDuration = 0;
  studyMonitorState.distractedDuration = 0;
  studyMonitorState.adaptiveScore = 100;
  studyMonitorState.consecutiveDistractions = 0;
  studyMonitorState.longestFocusStreak = 0;
  studyMonitorState.currentFocusStreak = 0;
  studyMonitorState.totalInterruptions = 0;
  studyMonitorState.focusStreakSamples = [];
  studyMonitorState.focusTimeline = [];
  studyMonitorState.lastTimelineBucket = -1;
  studyMonitorState.sessionElapsedSec = 0;
  studyMonitorState.currentDistractionStartSec = null;
  studyMonitorState.longestDistractionSec = 0;
  studyMonitorState.bestFocusStreakSec = 0;
  studyMonitorState.visibilityVisible = true;
  studyMonitorState.lastMicroToastAt = 0;
  studyMonitorState.lastMajorToastAt = 0;
}

/** @deprecated Use finalizeSessionMetrics */
export function getFocusScore(): number | null {
  if (!studyMonitorState.enabled || !studyMonitorState.scoringActive) return null;
  return computeAdaptiveFocusScore({
    activeSessionDuration: studyMonitorState.activeSessionDuration,
    distractedDuration: studyMonitorState.distractedDuration,
    majorDistractionCount: studyMonitorState.majorDistractionCount,
    microDistractionCount: studyMonitorState.microDistractionCount,
    consecutiveDistractions: studyMonitorState.consecutiveDistractions,
    totalInterruptions: studyMonitorState.totalInterruptions,
    longestFocusStreak: studyMonitorState.longestFocusStreak,
  });
}

/** @deprecated Use resetFocusMonitor */
export function resetFocusScore() {
  resetFocusMonitor();
}

export type FocusStateLabel = "focus" | "distracted" | "unknown";

export function getFocusStateLabel(): FocusStateLabel {
  if (!studyMonitorState.scoringActive || studyMonitorState.faceState === "unknown") {
    return "unknown";
  }
  if (
    studyMonitorState.distractionType === "major" ||
    studyMonitorState.distractionType === "micro" ||
    !studyMonitorState.focused
  ) {
    return "distracted";
  }
  return "focus";
}

export function getLiveFocusScore(): number | null {
  if (!studyMonitorState.enabled || !studyMonitorState.scoringActive) return null;
  return computeAdaptiveFocusScore({
    activeSessionDuration: studyMonitorState.activeSessionDuration,
    distractedDuration: studyMonitorState.distractedDuration,
    majorDistractionCount: studyMonitorState.majorDistractionCount,
    microDistractionCount: studyMonitorState.microDistractionCount,
    consecutiveDistractions: studyMonitorState.consecutiveDistractions,
    totalInterruptions: studyMonitorState.totalInterruptions,
    longestFocusStreak: studyMonitorState.longestFocusStreak,
  });
}

export type MonitorPersistenceSnapshot = {
  activeSeconds: number;
  distractionCount: number;
  lastSeenFaceAt: string | null;
  focusTimeline: FocusTimelinePoint[];
  monitorEnabled: boolean;
  scoringActive?: boolean;
};

export function getMonitorPersistenceSnapshot(
  monitorEnabled: boolean
): MonitorPersistenceSnapshot {
  return {
    activeSeconds: Math.floor(studyMonitorState.activeSessionDuration),
    distractionCount: studyMonitorState.distractionCount,
    lastSeenFaceAt:
      studyMonitorState.lastSeenFaceTimestamp > 0
        ? new Date(studyMonitorState.lastSeenFaceTimestamp).toISOString()
        : null,
    focusTimeline: [...studyMonitorState.focusTimeline],
    monitorEnabled,
    scoringActive: studyMonitorState.scoringActive,
  };
}

export function restoreStudyMonitorFromPersistence(
  snapshot: MonitorPersistenceSnapshot
) {
  studyMonitorState.enabled = snapshot.monitorEnabled;
  studyMonitorState.activeSessionDuration = snapshot.activeSeconds;
  studyMonitorState.sessionElapsedSec = snapshot.activeSeconds;
  studyMonitorState.distractionCount = snapshot.distractionCount;
  studyMonitorState.focusTimeline = [...snapshot.focusTimeline];
  studyMonitorState.lastTimelineBucket = Math.floor(
    snapshot.activeSeconds / TIMELINE_INTERVAL_SEC
  );
  studyMonitorState.lastSeenFaceTimestamp = snapshot.lastSeenFaceAt
    ? new Date(snapshot.lastSeenFaceAt).getTime()
    : 0;

  if (snapshot.scoringActive || snapshot.focusTimeline.length > 0) {
    studyMonitorState.scoringActive = true;
    studyMonitorState.faceState = "present";
    studyMonitorState.focused = true;
    studyMonitorState.distractionType = "none";
  } else {
    studyMonitorState.scoringActive = false;
    studyMonitorState.faceState = "unknown";
    studyMonitorState.focused = false;
    studyMonitorState.distractionType = "none";
  }
}
