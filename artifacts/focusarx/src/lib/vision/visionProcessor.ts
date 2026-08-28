import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { logger } from "../logger";

/** Results are derived locally in the browser; no camera frame leaves the device. */
export type VisionFrameResult = {
  available: boolean;
  facePresent: boolean;
  faceCount: number;
  phoneDetected: boolean;
  /** 0-100 — presence blended with how centered and well-framed the face is. */
  attentionScore: number;
  /** 0-1 — 1 means perfectly centered in frame. */
  centeredness: number;
  /** 0-1 — relative face area (proxy for distance from the screen). */
  faceScale: number;
};

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

/** Sample the webcam at ~7fps — plenty for attention tracking, easy on the CPU/GPU. */
const MIN_SAMPLE_INTERVAL_MS = 140;

let detector: FaceDetector | null = null;
let initialization: Promise<void> | null = null;
let initializationFailed = false;
let lastVideoTime = -1;
let lastProcessedAt = 0;
let lastResult: VisionFrameResult = {
  available: false,
  facePresent: false,
  faceCount: 0,
  phoneDetected: false,
  attentionScore: 0,
  centeredness: 0,
  faceScale: 0,
};

export function initVisionProcessor(): Promise<void> {
  if (detector || initializationFailed) return Promise.resolve();
  if (initialization) return initialization;

  initialization = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5,
      });
    } catch (error) {
      // GPU delegate can fail on some machines — retry once on CPU before giving up.
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
        detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: "CPU" },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.5,
        });
      } catch (cpuError) {
        initializationFailed = true;
        detector = null;
        logger.warn("[vision] MediaPipe face detector unavailable", cpuError ?? error);
      }
    }
  })();

  return initialization;
}

export function isVisionProcessorReady(): boolean {
  return detector !== null;
}

/**
 * Turn the largest detected face's bounding box into soft attention signals:
 * - centeredness: how close the face is to the sweet spot (slightly above center)
 * - faceScale: relative face area → sitting distance proxy
 * Attention mostly follows presence, but drifts down when you lean away,
 * turn aside, or shrink towards the back of your desk.
 */
function scoreFromBox(box: { originX: number; originY: number; width: number; height: number }, frameW: number, frameH: number) {
  const cx = (box.originX + box.width / 2) / frameW;
  const cy = (box.originY + box.height / 2) / frameH;
  // Ideal focus point: center horizontally, slightly above middle vertically.
  const dx = Math.abs(cx - 0.5) / 0.5;
  const dy = Math.abs(cy - 0.42) / 0.42;
  const offset = Math.min(1, Math.sqrt(dx * dx + dy * dy)); // 0 = perfect, 1 = edge
  const centeredness = Math.max(0, 1 - offset * 0.9);
  const faceScale = Math.min(1, (box.width * box.height) / (frameW * frameH) / 0.25); // 0.25 area ≈ comfortable distance
  return { centeredness, faceScale, cx, cy };
}

export async function processVideoFrame(video: HTMLVideoElement): Promise<VisionFrameResult> {
  await initVisionProcessor();
  if (!detector || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return { ...lastResult, available: false, facePresent: false, faceCount: 0, attentionScore: 0 };
  }

  // Throttle: skip frames that arrive faster than the sampling budget.
  const now = performance.now();
  if (video.currentTime === lastVideoTime || now - lastProcessedAt < MIN_SAMPLE_INTERVAL_MS) {
    return lastResult;
  }
  lastVideoTime = video.currentTime;
  lastProcessedAt = now;

  const result = detector.detectForVideo(video, now);
  const detections = result.detections ?? [];
  const facePresent = detections.length > 0;

  if (!facePresent) {
    lastResult = {
      available: true,
      facePresent: false,
      faceCount: 0,
      // FaceDetector cannot identify phones. Keep this capability explicitly off
      // rather than fabricating a detection result.
      phoneDetected: false,
      attentionScore: 0,
      centeredness: 0,
      faceScale: 0,
    };
    return lastResult;
  }

  // Score the largest face (closest to the camera).
  const largest = detections
    .map(d => d.boundingBox)
    .filter((b): b is NonNullable<typeof b> => Boolean(b))
    .sort((a, b) => (b!.width * b!.height) - (a!.width * a!.height))[0];

  if (!largest) {
    lastResult = { ...lastResult, available: true, facePresent: true, faceCount: detections.length };
    return lastResult;
  }

  const { centeredness, faceScale } = scoreFromBox(largest, video.videoWidth || 640, video.videoHeight || 480);

  // Multiple faces visible → someone else is in frame; soften attention.
  const multiPenalty = detections.length > 1 ? 0.75 : 1;
  // Presence is the main signal; framing contributes the rest.
  const attentionScore = Math.round(
    Math.min(100, (62 + 38 * centeredness) * multiPenalty * (faceScale < 0.25 ? 0.85 + 0.6 * faceScale : 1))
  );

  lastResult = {
    available: true,
    facePresent: true,
    faceCount: detections.length,
    phoneDetected: false,
    attentionScore,
    centeredness,
    faceScale,
  };
  return lastResult;
}

export function resetVisionProcessorCache(): void {
  lastVideoTime = -1;
  lastProcessedAt = 0;
  lastResult = { available: detector !== null, facePresent: false, faceCount: 0, phoneDetected: false, attentionScore: 0, centeredness: 0, faceScale: 0 };
}

export function releaseVisionProcessor(): void {
  detector?.close();
  detector = null;
  initialization = null;
  initializationFailed = false;
  resetVisionProcessorCache();
}
