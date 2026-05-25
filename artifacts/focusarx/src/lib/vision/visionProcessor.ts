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

export async function initVisionProcessor(): Promise<void> {
  /* no-op */
}

export function isVisionProcessorReady(): boolean {
  return false;
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
