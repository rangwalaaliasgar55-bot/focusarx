"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
import { useSessionRecovery } from "@/components/SessionRecoveryContext";
import { useToast } from "@/components/Toast";
import { useFocusTracking } from "@/hooks/useFocusTracking";
import { stopMediaStream } from "@/lib/cameraUtils";
import { initVisionProcessor, isVisionProcessorReady } from "@/lib/vision/visionProcessor";
import {
  resetFocusMonitor,
  studyMonitorState,
} from "@/store/studyMonitorStore";

type FocusCameraProps = {
  className?: string;
};

async function getCameraPermissionState(): Promise<PermissionState | "unknown"> {
  if (!("permissions" in navigator)) return "unknown";
  try {
    const status = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });
    return status.state;
  } catch {
    return "unknown";
  }
}

function formatDuration(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Tiny attention sparkline — last ~3 minutes, one bar per 2s. */
function AttentionSparkline({ timeline }: { timeline: number[] }) {
  const bars = timeline.slice(-45);
  return (
    <div className="flex h-8 items-end gap-[2px]" aria-hidden>
      {bars.length === 0 && <span className="text-[10px] text-[var(--palette-zinc-600)]">Attention history appears here</span>}
      {bars.map((v, i) => (
        <div
          key={i}
          className="flex-1 min-w-[2px] rounded-sm transition-all duration-300"
          style={{
            height: `${Math.max(8, v * 100)}%`,
            background:
              v > 0.66
                ? "var(--palette-emerald-400)"
                : v > 0.35
                  ? "var(--palette-amber-400)"
                  : "var(--palette-rose-400)",
            opacity: 0.35 + 0.65 * (i / Math.max(1, bars.length - 1)),
          }}
        />
      ))}
    </div>
  );
}

export function FocusCamera({ className = "" }: FocusCameraProps) {
  const webcamRef = useRef<Webcam>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  const { recoverMonitor, clearMonitorRecovery, setMonitorEnabled } =
    useSessionRecovery();

  const [enabled, setEnabled] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const recoveringRef = useRef(false);

  const getVideo = useCallback(
    () => webcamRef.current?.video ?? null,
    []
  );

  const tracking = useFocusTracking(getVideo, enabled);

  useEffect(() => {
    studyMonitorState.enabled = enabled;
    setMonitorEnabled(enabled);
  }, [enabled, setMonitorEnabled]);

  useEffect(() => {
    let active = true;
    void initVisionProcessor().then(() => {
      if (active) setModelsReady(isVisionProcessorReady());
    });
    return () => {
      active = false;
    };
  }, []);

  const releaseCamera = useCallback(() => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    const video = webcamRef.current?.video;
    if (video?.srcObject) {
      stopMediaStream(video.srcObject as MediaStream);
      video.srcObject = null;
    }
  }, []);

  const handleEnable = useCallback(async () => {
    try {
      // Kick model loading in parallel — it finishes while the camera warms up.
      void initVisionProcessor().then(() => setModelsReady(isVisionProcessorReady()));
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 480, height: 360 },
        audio: false,
      });
      streamRef.current = stream;
      setHasPermission(true);
      setEnabled(true);
      if (!recoveringRef.current) {
        resetFocusMonitor();
      }
      studyMonitorState.enabled = true;
    } catch {
      setHasPermission(false);
      toast("Camera permission denied.", "error");
    }
  }, [toast]);

  useEffect(() => {
    if (!recoverMonitor || enabled || recoveringRef.current) return;
    recoveringRef.current = true;
    void (async () => {
      const permission = await getCameraPermissionState();
      if (permission === "granted") {
        await handleEnable();
      } else {
        setEnabled(false);
        studyMonitorState.enabled = false;
        toast("Focus camera was not restored automatically. Start it when you are ready.", "info");
      }
    })().finally(() => {
      recoveringRef.current = false;
      clearMonitorRecovery();
    });
  }, [recoverMonitor, enabled, handleEnable, clearMonitorRecovery, toast]);

  useEffect(() => {
    return () => {
      releaseCamera();
      studyMonitorState.enabled = false;
    };
  }, [releaseCamera]);

  const handleDisable = () => {
    releaseCamera();
    setEnabled(false);
    resetFocusMonitor();
    studyMonitorState.enabled = false;
  };

  const scoreColor =
    tracking.focusScore >= 75
      ? "text-[var(--palette-emerald-400)]"
      : tracking.focusScore >= 50
        ? "text-[var(--palette-amber-400)]"
        : "text-[var(--palette-rose-400)]";

  const ringColor = tracking.isFocused
    ? "var(--palette-emerald-500)"
    : tracking.warnings.length > 0
      ? "var(--palette-rose-500)"
      : "var(--palette-zinc-700)";

  const stateLabel = !tracking.facePresent
    ? tracking.warnings.includes("No face detected")
      ? "Away from desk"
      : "Looking for you…"
    : tracking.faceCount > 1
      ? "Multiple people"
      : tracking.isFocused
        ? "In the zone"
        : "Distracted";

  return (
    <motion.div
      layout
      className={`w-full rounded-2xl border-2 border-[var(--palette-zinc-700)]/60 bg-gradient-to-br from-[var(--palette-zinc-950)]/60 to-[var(--palette-zinc-900)]/40 backdrop-blur-sm p-4 shadow-lg ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--palette-zinc-400)]">
            🎥 AI Focus Monitor
          </p>
          <p className="text-[11px] text-[var(--palette-zinc-500)] mt-0.5">
            On-device vision · posture &amp; attention
          </p>
        </div>
        {enabled ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={handleDisable}
            className="rounded-lg border border-[var(--palette-rose-500)]/50 bg-[var(--palette-rose-500)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--palette-rose-400)] hover:bg-[var(--palette-rose-500)]/20 transition-all"
          >
            Stop Camera
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => void handleEnable()}
            className="rounded-lg bg-gradient-to-r from-[var(--palette-emerald-500)] to-[var(--palette-teal-500)] px-3 py-1.5 text-xs font-semibold text-[var(--palette-white)] hover:shadow-lg hover:shadow-[var(--palette-emerald-500)]/40 transition-all"
          >
            {modelsReady ? "Start Camera" : "Start Camera · AI…"}
          </motion.button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {enabled && (
          <motion.div
            key="feed"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-3 overflow-hidden"
          >
            <div
              className="relative aspect-video overflow-hidden rounded-xl bg-[var(--palette-black)] ring-2 transition-colors duration-500"
              style={{ ["--tw-ring-color" as string]: ringColor }}
            >
              {hasPermission === false ? (
                <p className="flex h-full items-center justify-center text-sm text-[var(--palette-zinc-500)]">
                  Camera unavailable
                </p>
              ) : (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  mirrored
                  playsInline
                  className="h-full w-full object-cover"
                  videoConstraints={{
                    facingMode: "user",
                    width: 480,
                    height: 360,
                  }}
                  onUserMedia={(stream) => {
                    streamRef.current = stream;
                  }}
                />
              )}
              {/* Live state chip */}
              <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-[var(--palette-black)]/60 px-2.5 py-1 backdrop-blur-sm">
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: ringColor }}
                />
                <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--palette-white)]">
                  {stateLabel}
                </span>
              </div>
              {/* Attention gauge */}
              <div className="absolute inset-x-2 bottom-2">
                <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--palette-black)]/50">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${tracking.attention}%`,
                      background: tracking.attention >= 66
                        ? "var(--palette-emerald-400)"
                        : tracking.attention >= 35
                          ? "var(--palette-amber-400)"
                          : "var(--palette-rose-400)",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--palette-zinc-500)]">
                  Focus score
                </p>
                <p className={`text-3xl font-semibold tabular-nums ${scoreColor}`}>
                  {tracking.focusScore}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <p className="text-[11px] text-[var(--palette-zinc-400)]">
                  🎯 <span className="font-bold text-[var(--palette-zinc-200)]">{formatDuration(tracking.focusedSeconds)}</span> focused
                </p>
                <p className="text-[11px] text-[var(--palette-zinc-400)]">
                  ⏱ <span className="font-bold text-[var(--palette-zinc-200)]">{formatDuration(tracking.distractedSeconds)}</span> away
                </p>
                <p className="text-[11px] text-[var(--palette-zinc-400)]">
                  ⚡ <span className="font-bold text-[var(--palette-zinc-200)]">{tracking.distractionCount}</span> distraction{tracking.distractionCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Attention history */}
            <div className="rounded-xl border border-[var(--palette-zinc-800)]/70 bg-[var(--palette-zinc-950)]/40 px-2.5 py-2">
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-600)]">
                Attention — last 90s
              </p>
              <AttentionSparkline timeline={tracking.timeline} />
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-1.5">
              {tracking.isFocused && <Badge tone="ok">In focus</Badge>}
              {tracking.warnings.includes("No face detected") && <Badge tone="warn">No face detected</Badge>}
              {tracking.faceCount > 1 && <Badge tone="warn">{tracking.faceCount} people in frame</Badge>}
              {tracking.distance === "too_far" && <Badge tone="warn">Too far from screen</Badge>}
              {!tracking.facePresent && !tracking.warnings.includes("No face detected") && (
                <Badge tone="muted">Looking for face…</Badge>
              )}
              {tracking.isFocused && tracking.focusScore >= 85 && <Badge tone="ok">Deep focus 🔥</Badge>}
            </div>

            <p className="text-[9px] leading-relaxed text-[var(--palette-zinc-600)]">
              🔒 Video never leaves your device — all analysis runs locally in your browser.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "ok" | "warn" | "muted";
}) {
  const styles = {
    ok: "border-[var(--palette-emerald-500)]/40 bg-[var(--palette-emerald-500)]/10 text-[var(--palette-emerald-400)]",
    warn: "border-[var(--palette-rose-500)]/40 bg-[var(--palette-rose-500)]/10 text-[var(--palette-rose-400)]",
    muted: "border-[var(--palette-zinc-600)] bg-[var(--palette-zinc-800)]/50 text-[var(--palette-zinc-400)]",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles[tone]}`}
    >
      {children}
    </span>
  );
}
