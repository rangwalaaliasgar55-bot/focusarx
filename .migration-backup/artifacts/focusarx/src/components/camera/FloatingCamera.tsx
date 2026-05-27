"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { motion } from "framer-motion";
import { useToast } from "@/components/Toast";
import {
  loadCameraPosition,
  saveCameraPosition,
  stopMediaStream,
} from "@/lib/cameraUtils";
import { useSessionRecovery } from "@/components/SessionRecoveryContext";
import {
  processFaceDetection,
  processVisibilityHidden,
  resetFocusMonitor,
  setMonitorToastHandler,
  studyMonitorState,
} from "@/store/studyMonitorStore";
import type { DistractionType, FaceState } from "@/types/focus";

const MEDIAPIPE_VERSION = "0.10.35";
const WIDGET_W = 200;
const WIDGET_H = 150;

type WidgetStatus = "idle" | "focused" | "distracted" | "unknown";

function statusFromState(
  enabled: boolean,
  faceState: FaceState,
  distractionType: DistractionType
): WidgetStatus {
  if (!enabled) return "idle";
  if (!studyMonitorState.scoringActive || faceState === "unknown")
    return "unknown";
  if (distractionType === "major" || distractionType === "micro")
    return "distracted";
  return "focused";
}

const borderByStatus: Record<WidgetStatus, string> = {
  idle: "ring-zinc-600/80",
  focused:
    "ring-emerald-400/90 shadow-[0_0_24px_rgba(52,211,153,0.35)]",
  distracted:
    "ring-rose-500/90 shadow-[0_0_24px_rgba(244,63,94,0.4)] animate-pulse",
  unknown: "ring-zinc-500/70",
};

const statusLabel: Record<WidgetStatus, string> = {
  idle: "Idle",
  focused: "In Focus",
  distracted: "Distracted",
  unknown: "Warming up…",
};

export function FloatingCamera() {
  const webcamRef = useRef<Webcam>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceDetector | null>(null);

  const { toast } = useToast();
  const { recoverMonitor, clearMonitorRecovery, setMonitorEnabled } =
    useSessionRecovery();

  const recoveringRef = useRef(false);

  const [enabled, setEnabled] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [widgetStatus, setWidgetStatus] =
    useState<WidgetStatus>("idle");
  const [position, setPosition] = useState({ x: window.innerWidth - 224, y: window.innerHeight - 184 });
  const [dragging, setDragging] = useState(false);

const requestRef = useRef<number | null>(null);

const lastVideoTimeRef = useRef<number>(-1);

const dragOffset = useRef<{ x: number; y: number }>({
  x: 0,
  y: 0,
});
  useEffect(() => {
    setPosition(loadCameraPosition());
  }, []);

  useEffect(() => {
    setMonitorToastHandler((msg, type) => toast(msg, type));
    return () => setMonitorToastHandler(null);
  }, [toast]);

  useEffect(() => {
    studyMonitorState.enabled = enabled;
    setMonitorEnabled(enabled);
    if (!enabled) setWidgetStatus("idle");
  }, [enabled, setMonitorEnabled]);

  // -----------------------------
  // INIT MEDIAPIPE (FIXED)
  // -----------------------------
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
        );

        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
        });

        if (active) detectorRef.current = detector;
      } catch (e) {
        console.error("MediaPipe init failed", e);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const syncStatus = useCallback(() => {
    setWidgetStatus(
      statusFromState(
        studyMonitorState.enabled,
        studyMonitorState.faceState,
        studyMonitorState.distractionType
      )
    );
  }, []);

  // -----------------------------
  // FACE DETECTION LOOP (FIXED FOR MOBILE)
  // -----------------------------
  useEffect(() => {
    if (!enabled || !hasPermission) return;

    const loop = () => {
      const video = webcamRef.current?.video;
      const detector = detectorRef.current;

      if (
        video &&
        detector &&
        video.readyState === 4 &&
        video.videoWidth > 0 &&
        video.currentTime !== lastVideoTimeRef.current
      ) {
        try {
          lastVideoTimeRef.current = video.currentTime;

          const result = detector.detectForVideo(video, performance.now());

          const isFace = result.detections.length > 0;
          const isVisible = document.visibilityState === "visible";

          processFaceDetection(isFace, isVisible);
          syncStatus();
        } catch (err) {
          console.warn("Detection error:", err);
        }
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [enabled, hasPermission, syncStatus]);

  // -----------------------------
  // VISIBILITY HANDLER
  // -----------------------------
  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === "hidden" && enabled) {
        processVisibilityHidden();
        syncStatus();
      }
    };

    document.addEventListener("visibilitychange", handle);
    return () =>
      document.removeEventListener("visibilitychange", handle);
  }, [enabled, syncStatus]);

  // -----------------------------
  // ENABLE CAMERA (FIXED IMPORTANT PART)
  // -----------------------------
  const handleEnable = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;

      setHasPermission(true);
      setEnabled(true);

      resetFocusMonitor();
      studyMonitorState.enabled = true;

      setWidgetStatus("unknown");
    } catch (err) {
      console.error(err);
      setHasPermission(false);
      toast("Camera permission denied", "error");
    }
  }, [toast]);

  // -----------------------------
  // CLEANUP
  // -----------------------------
  const releaseCamera = useCallback(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);

    if (streamRef.current) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    }

    const video = webcamRef.current?.video;
    if (video?.srcObject) {
      stopMediaStream(video.srcObject as MediaStream);
      video.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => releaseCamera();
  }, [releaseCamera]);

  const handleClose = () => {
    releaseCamera();
    setEnabled(false);
    setWidgetStatus("idle");
    resetFocusMonitor();
  };

  // -----------------------------
  // DRAG HANDLERS
  // -----------------------------
  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;

    const x = e.clientX - dragOffset.current.x;
    const y = e.clientY - dragOffset.current.y;

    setPosition({ x, y });
  };

  const onPointerUp = () => {
    setDragging(false);
    saveCameraPosition(position);
  };

  // -----------------------------
  // UI
  // -----------------------------
  if (!enabled) {
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleEnable}
        className="relative rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-emerald-500/40 transition-all duration-300"
      >
        <span className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          AI Monitor
        </span>
      </motion.button>
    );
  }

  return (
    <motion.div
      style={{ left: position.x, top: position.y }}
      className="fixed z-50 touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <motion.div 
        className={`rounded-2xl bg-black/80 backdrop-blur-sm border-2 ${borderByStatus[widgetStatus]} p-2 shadow-2xl transition-all duration-300`}
        whileHover={{ boxShadow: "0 0 32px rgba(0,0,0,0.5)" }}
      >
        <div className="overflow-hidden rounded-lg">
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored
            playsInline
            videoConstraints={{
              facingMode: "user",
              width: WIDGET_W,
              height: WIDGET_H,
            }}
            onUserMedia={(stream) => {
              streamRef.current = stream;
            }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
              widgetStatus === "focused" ? "bg-emerald-400 shadow-lg shadow-emerald-400/50" :
              widgetStatus === "distracted" ? "bg-rose-500 shadow-lg shadow-rose-500/50 animate-pulse" :
              widgetStatus === "unknown" ? "bg-zinc-500 animate-pulse" :
              "bg-zinc-600"
            }`} />
            <span className="text-xs font-semibold text-zinc-300">
              {statusLabel[widgetStatus]}
            </span>
          </div>
          <button 
            onClick={handleClose}
            className="text-zinc-500 hover:text-rose-400 transition-colors p-1 hover:bg-zinc-800/50 rounded"
            title="Close monitor"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
