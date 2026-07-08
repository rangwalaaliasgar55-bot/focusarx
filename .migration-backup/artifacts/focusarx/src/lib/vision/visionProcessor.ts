/**
 * Vision processor stub for web deployment.
 * The full TensorFlow + MediaPipe implementation is not available in the
 * Replit sandbox environment. This stub keeps the rest of the app functional —
 * face tracking reports "present" so focus score isn't penalised.
 */

export type VisionFrameResult = {
  facePresent: boolean;
  phoneDetected: boolean;
  attentionScore: number;
};

let _ready = false;

export async function initVisionProcessor(): Promise<void> {
  _ready = true;
}

export function isVisionProcessorReady(): boolean {
  return _ready;
}

export async function processVideoFrame(
  _video: HTMLVideoElement,
): Promise<VisionFrameResult> {
  return { facePresent: true, phoneDetected: false, attentionScore: 100 };
}

export function resetVisionProcessorCache(): void {
  /* no-op */
}

export function releaseVisionProcessor(): void {
  /* no-op */
}
