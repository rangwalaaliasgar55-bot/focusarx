/** Stop all tracks on a MediaStream to avoid camera leaks. */
export function stopMediaStream(stream: MediaStream | null | undefined) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

export type CameraWidgetPosition = { x: number; y: number };

const STORAGE_KEY = "focusarx-camera-position";

export function loadCameraPosition(): CameraWidgetPosition {
  if (typeof window === "undefined") return { x: 24, y: 96 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { x: 24, y: 96 };
    const parsed = JSON.parse(raw) as CameraWidgetPosition;
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return { x: 24, y: 96 };
}

export function saveCameraPosition(pos: CameraWidgetPosition) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}
