/**
 * Haptics (Workstream J) — small vibration presets for high-value mobile
 * moments (timer start/stop, session complete, drop claimed, purchase).
 *
 * Safe by construction: no-ops on browsers/devices without
 * `navigator.vibrate` (all desktop, most iOS). iOS Safari has never shipped
 * Vibration API support, so this is effectively Android + supported WebView
 * polish — never required for functionality.
 */
type HapticPreset = "tap" | "select" | "success" | "error" | "celebrate";

const PATTERNS: Record<HapticPreset, number | number[]> = {
  tap: 10,
  select: 20,
  success: [30, 40, 30],
  error: [60, 50, 60],
  celebrate: [40, 30, 40, 30, 90],
};

let supported: boolean | null = null;

function canVibrate(): boolean {
  if (supported !== null) return supported;
  supported = typeof navigator !== "undefined" && "vibrate" in navigator;
  return supported;
}

/** Fire a haptic preset. Never throws; silently no-ops when unsupported. */
export function haptic(preset: HapticPreset = "tap"): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(PATTERNS[preset]);
  } catch {
    /* vibration denied — fine */
  }
}

/** Stop any ongoing pattern (used on timer cancel/pause). */
export function hapticStop(): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(0);
  } catch {
    /* no-op */
  }
}

export default haptic;
