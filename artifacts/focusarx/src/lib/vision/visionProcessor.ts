import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

/** Results are derived locally in the browser; no camera frame leaves the device. */
export type VisionFrameResult = {
  available: boolean;
  facePresent: boolean;
  phoneDetected: boolean;
  attentionScore: number;
};

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

let detector: FaceDetector | null = null;
let initialization: Promise<void> | null = null;
let initializationFailed = false;
let lastVideoTime = -1;
let lastResult: VisionFrameResult = {
  available: false,
  facePresent: false,
  phoneDetected: false,
  attentionScore: 0,
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
        minDetectionConfidence: 0.6,
      });
    } catch (error) {
      initializationFailed = true;
      detector = null;
      console.warn("[vision] MediaPipe face detector unavailable", error);
    }
  })();

  return initialization;
}

export function isVisionProcessorReady(): boolean {
  return detector !== null;
}

export async function processVideoFrame(video: HTMLVideoElement): Promise<VisionFrameResult> {
  await initVisionProcessor();
  if (!detector || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return { available: false, facePresent: false, phoneDetected: false, attentionScore: 0 };
  }

  if (video.currentTime === lastVideoTime) return lastResult;
  lastVideoTime = video.currentTime;

  const result = detector.detectForVideo(video, performance.now());
  const facePresent = result.detections.length > 0;
  lastResult = {
    available: true,
    facePresent,
    // FaceDetector cannot identify phones. Keep this capability explicitly off
    // rather than fabricating a detection result.
    phoneDetected: false,
    attentionScore: facePresent ? 100 : 0,
  };
  return lastResult;
}

export function resetVisionProcessorCache(): void {
  lastVideoTime = -1;
  lastResult = { available: detector !== null, facePresent: false, phoneDetected: false, attentionScore: 0 };
}

export function releaseVisionProcessor(): void {
  detector?.close();
  detector = null;
  initialization = null;
  initializationFailed = false;
  resetVisionProcessorCache();
}
