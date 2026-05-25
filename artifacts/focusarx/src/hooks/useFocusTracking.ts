"use client";

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

const UI_THROTTLE_MS = 400;
const NO_FACE_WARN_MS = 4000;

export type FocusTrackingSnapshot = {
  focusScore: number;
  isFocused: boolean;
  warnings: string[];
  facePresent: boolean;
  phoneDetected: boolean;
};

const IDLE_SNAPSHOT: FocusTrackingSnapshot = {
  focusScore: 100,
  isFocused: false,
  warnings: [],
  facePresent: false,
  phoneDetected: false,
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

  const buildSnapshot = useCallback(
    (result: VisionFrameResult): FocusTrackingSnapshot => {
      smoothedScoreRef.current =
        smoothedScoreRef.current * 0.82 + result.attentionScore * 0.18;
      const focusScore = Math.round(smoothedScoreRef.current);

      const warnings: string[] = [];
      if (result.phoneDetected) warnings.push("Phone detected");

      if (!result.facePresent) {
        if (noFaceSinceRef.current === null) {
          noFaceSinceRef.current = Date.now();
        } else if (Date.now() - noFaceSinceRef.current >= NO_FACE_WARN_MS) {
          warnings.push("No face detected");
        }
      } else {
        noFaceSinceRef.current = null;
      }

      const isFocused =
        focusScore >= 65 && result.facePresent && !result.phoneDetected;

      return {
        focusScore,
        isFocused,
        warnings,
        facePresent: result.facePresent,
        phoneDetected: result.phoneDetected,
      };
    },
    []
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
      setSnapshot(IDLE_SNAPSHOT);
      return;
    }

    void initVisionProcessor();

    const loop = () => {
      const video = getVideo();
      if (video && !inFlightRef.current) {
        inFlightRef.current = true;
        void processVideoFrame(video, performance.now())
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

  return snapshot;
}
