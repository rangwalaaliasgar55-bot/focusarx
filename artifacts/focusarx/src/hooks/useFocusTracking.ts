
import { useCallback, useEffect, useRef, useState } from "react";
import {
  initVisionProcessor,
  processVideoFrame,
  resetVisionProcessorCache,
  type VisionFrameResult,
} from "@/lib/vision/visionProcessor";
import {
  processFaceDetection,
  processVisibilityHidden,
} from "@/store/studyMonitorStore";

const UI_THROTTLE_MS = 350;
const NO_FACE_WARN_MS = 3500;
/** Timeline resolution: one bucket per 2s, keep ~3 minutes. */
const TIMELINE_BUCKET_SEC = 2;
const TIMELINE_MAX_BUCKETS = 90;

export type DistanceState = "ok" | "too_far" | "too_close";

export type FocusTrackingSnapshot = {
  focusScore: number;
  attention: number;
  isFocused: boolean;
  warnings: string[];
  facePresent: boolean;
  faceCount: number;
  phoneDetected: boolean;
  /** Seconds of tracked, focused attention this session. */
  focusedSeconds: number;
  /** Seconds tracked away/distracted this session. */
  distractedSeconds: number;
  /** Number of distraction events (focus lost for > 2s). */
  distractionCount: number;
  /** Rolling attention 0-1 per 2s bucket — newest last. */
  timeline: number[];
  distance: DistanceState;
};

const IDLE_SNAPSHOT: FocusTrackingSnapshot = {
  focusScore: 100,
  attention: 0,
  isFocused: false,
  warnings: [],
  facePresent: false,
  faceCount: 0,
  phoneDetected: false,
  focusedSeconds: 0,
  distractedSeconds: 0,
  distractionCount: 0,
  timeline: [],
  distance: "ok",
};

export function useFocusTracking(
  getVideo: () => HTMLVideoElement | null | undefined,
  enabled: boolean
) {
  const [snapshot, setSnapshot] = useState<FocusTrackingSnapshot>(IDLE_SNAPSHOT);
  const rafRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const lastUiPushRef = useRef(0);
  const noFaceSinceRef = useRef<number | null>(null);
  const smoothedScoreRef = useRef(100);

  // Session-scoped rolling stats.
  const startedAtRef = useRef<number | null>(null);
  const lastSampleAtRef = useRef<number | null>(null);
  const focusedMsRef = useRef(0);
  const distractedMsRef = useRef(0);
  const distractionSinceRef = useRef<number | null>(null);
  const distractionCountRef = useRef(0);
  const timelineRef = useRef<number[]>([]);
  const timelineBucketRef = useRef(-1);
  const bucketAccumRef = useRef({ sum: 0, n: 0 });

  const pushTimelineBucket = useCallback((force = false) => {
    const now = Date.now();
    if (startedAtRef.current === null) return;
    const elapsedSec = (now - startedAtRef.current) / 1000;
    const bucket = Math.floor(elapsedSec / TIMELINE_BUCKET_SEC);
    if (bucket === timelineBucketRef.current && !force) return;
    if (timelineBucketRef.current >= 0 || force) {
      const { sum, n } = bucketAccumRef.current;
      const avg = n > 0 ? sum / n : 0;
      timelineRef.current.push(avg);
      if (timelineRef.current.length > TIMELINE_MAX_BUCKETS) {
        timelineRef.current.shift();
      }
    }
    timelineBucketRef.current = bucket;
    bucketAccumRef.current = { sum: 0, n: 0 };
  }, []);

  const buildSnapshot = useCallback(
    (result: VisionFrameResult): FocusTrackingSnapshot => {
      const now = Date.now();

      if (!result.available) {
        return {
          ...IDLE_SNAPSHOT,
          warnings: ["Attention monitor unavailable"],
        };
      }

      // ── accumulate time-based stats ─────────────────────────────────
      if (startedAtRef.current === null) startedAtRef.current = now;
      if (lastSampleAtRef.current !== null) {
        const dt = Math.min(2000, now - lastSampleAtRef.current);
        const present = result.facePresent && result.attentionScore >= 45;
        if (present) {
          focusedMsRef.current += dt;
          // Recovering from an active distraction?
          if (distractionSinceRef.current !== null && now - distractionSinceRef.current > 2000) {
            distractionCountRef.current += 1;
          }
          distractionSinceRef.current = null;
        } else {
          distractedMsRef.current += dt;
          if (distractionSinceRef.current === null) distractionSinceRef.current = now;
        }
      }
      lastSampleAtRef.current = now;
      pushTimelineBucket();
      bucketAccumRef.current.sum += result.attentionScore / 100;
      bucketAccumRef.current.n += 1;

      // ── smooth the headline score ──────────────────────────────────
      smoothedScoreRef.current =
        smoothedScoreRef.current * 0.8 + result.attentionScore * 0.2;
      const focusScore = Math.round(smoothedScoreRef.current);
      const attention = result.facePresent ? result.attentionScore : 0;

      // ── warnings ───────────────────────────────────────────────────
      const warnings: string[] = [];
      if (result.phoneDetected) warnings.push("Phone detected");
      if (result.faceCount > 1) warnings.push("Multiple people in frame");

      if (!result.facePresent) {
        if (noFaceSinceRef.current === null) {
          noFaceSinceRef.current = now;
        } else if (now - noFaceSinceRef.current >= NO_FACE_WARN_MS) {
          warnings.push("No face detected");
        }
      } else {
        noFaceSinceRef.current = null;
      }

      const distance: DistanceState =
        !result.facePresent || result.faceScale > 0.55
          ? "ok"
          : result.faceScale < 0.18
            ? "too_far"
            : "ok";
      if (distance === "too_far") warnings.push("Move closer to the screen");

      const isFocused =
        focusScore >= 60 &&
        result.facePresent &&
        result.faceCount <= 1 &&
        !result.phoneDetected;

      return {
        focusScore,
        attention,
        isFocused,
        warnings,
        facePresent: result.facePresent,
        faceCount: result.faceCount,
        phoneDetected: result.phoneDetected,
        focusedSeconds: Math.round(focusedMsRef.current / 1000),
        distractedSeconds: Math.round(distractedMsRef.current / 1000),
        distractionCount: distractionCountRef.current,
        timeline: [...timelineRef.current],
        distance,
      };
    },
    [pushTimelineBucket]
  );

  const pushSnapshot = useCallback((next: FocusTrackingSnapshot) => {
    const now = Date.now();
    if (now - lastUiPushRef.current < UI_THROTTLE_MS) return;
    lastUiPushRef.current = now;
    setSnapshot(next);
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      resetVisionProcessorCache();
      smoothedScoreRef.current = 100;
      noFaceSinceRef.current = null;
      startedAtRef.current = null;
      lastSampleAtRef.current = null;
      focusedMsRef.current = 0;
      distractedMsRef.current = 0;
      distractionSinceRef.current = null;
      distractionCountRef.current = 0;
      timelineRef.current = [];
      timelineBucketRef.current = -1;
      bucketAccumRef.current = { sum: 0, n: 0 };
      // Consumers see IDLE_SNAPSHOT via the derived return below; the stored
      // snapshot is only reset lazily to avoid a synchronous setState here.
      return;
    }

    void initVisionProcessor();

    // Drop any snapshot left over from a previous tracking run before the
    // first new sample lands (scheduled, so it is not a sync setState in effect).
    let first = true;
    const loop = () => {
      if (first) { first = false; setSnapshot(IDLE_SNAPSHOT); }
      const video = getVideo();
      if (video && !inFlightRef.current) {
        inFlightRef.current = true;
        void processVideoFrame(video)
          .then((result) => {
            const visible = document.visibilityState === "visible";
            processFaceDetection(result.facePresent, visible);
            pushSnapshot(buildSnapshot(result));
          })
          .finally(() => {
            inFlightRef.current = false;
          });
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, getVideo, buildSnapshot, pushSnapshot]);

  // Flush the last partial timeline bucket when the monitor stops.
  useEffect(() => {
    if (!enabled) return;
    return () => pushTimelineBucket(true);
  }, [enabled, pushTimelineBucket]);

  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        processVisibilityHidden();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled]);

  // While tracking is disabled always expose the idle snapshot, regardless of
  // whatever the last live sample was.
  return enabled ? snapshot : IDLE_SNAPSHOT;
}
