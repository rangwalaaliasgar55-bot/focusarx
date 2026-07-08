"use client";

/**
 * Thin hook surface for focus monitoring — logic lives in @/store/studyMonitorStore.
 */
export {
  studyMonitorState,
  processFaceDetection,
  processVisibilityHidden,
  updateFocusSessionDuration,
  finalizeSessionMetrics,
  resetFocusMonitor,
  setMonitorToastHandler,
} from "@/store/studyMonitorStore";
