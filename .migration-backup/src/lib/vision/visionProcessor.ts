import type { FaceDetector } from "@mediapipe/tasks-vision";

const MEDIAPIPE_VERSION = "0.10.35";
const PHONE_CLASS = "cell phone";
const PHONE_SCORE_MIN = 0.5;
const PHONE_INTERVAL_MS = 900;

export type VisionFrameResult = {
  facePresent: boolean;
  phoneDetected: boolean;
  attentionScore: number;
};

type CocoDetection = { class: string; score: number };
type CocoModel = {
  detect: (
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ) => Promise<CocoDetection[]>;
};

let faceDetector: FaceDetector | null = null;
let cocoModel: CocoModel | null = null;
let initPromise: Promise<void> | null = null;

let lastPhoneDetected = false;
let lastPhoneCheckAt = 0;
let phoneCheckInFlight = false;

let lastFacePresent = false;
let lastVideoTime = -1;

function computeAttentionScore(
  facePresent: boolean,
  phoneDetected: boolean
): number {
  let score = 100;
  if (!facePresent) score -= 50;
  if (phoneDetected) score -= 45;
  return Math.max(0, Math.min(100, score));
}

export async function initVisionProcessor(): Promise<void> {
  if (typeof window === "undefined") return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const { FaceDetector, FilesetResolver } = await import(
      "@mediapipe/tasks-vision"
    );
    const vision = await FilesetResolver.forVisionTasks(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
    );

    faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
    });

    const tf = await import("@tensorflow/tfjs");
    await tf.ready();
    const cocoSsd = await import("@tensorflow-models/coco-ssd");
    cocoModel = await cocoSsd.load({ base: "lite_mobilenet_v2" });
  })();

  return initPromise;
}

async function refreshPhoneDetection(
  video: HTMLVideoElement,
  now: number
): Promise<void> {
  if (!cocoModel || phoneCheckInFlight) return;
  if (now - lastPhoneCheckAt < PHONE_INTERVAL_MS) return;

  lastPhoneCheckAt = now;
  phoneCheckInFlight = true;
  try {
    const preds = await cocoModel.detect(video);
    lastPhoneDetected = preds.some(
      (p) => p.class === PHONE_CLASS && p.score >= PHONE_SCORE_MIN
    );
  } catch (err) {
    console.warn("[vision] phone detection failed", err);
  } finally {
    phoneCheckInFlight = false;
  }
}

export async function processVideoFrame(
  video: HTMLVideoElement,
  timestampMs: number
): Promise<VisionFrameResult> {
  await initVisionProcessor();

  if (video.readyState < 3 || video.videoWidth === 0) {
    return {
      facePresent: lastFacePresent,
      phoneDetected: lastPhoneDetected,
      attentionScore: computeAttentionScore(lastFacePresent, lastPhoneDetected),
    };
  }

  if (video.currentTime !== lastVideoTime && faceDetector) {
    lastVideoTime = video.currentTime;
    try {
      const result = faceDetector.detectForVideo(video, timestampMs);
      lastFacePresent = result.detections.length > 0;
    } catch (err) {
      console.warn("[vision] face detection failed", err);
    }
  }

  void refreshPhoneDetection(video, timestampMs);

  return {
    facePresent: lastFacePresent,
    phoneDetected: lastPhoneDetected,
    attentionScore: computeAttentionScore(lastFacePresent, lastPhoneDetected),
  };
}

export function resetVisionProcessorCache(): void {
  lastPhoneDetected = false;
  lastFacePresent = false;
  lastVideoTime = -1;
  lastPhoneCheckAt = 0;
}

export function isVisionProcessorReady(): boolean {
  return faceDetector !== null && cocoModel !== null;
}
