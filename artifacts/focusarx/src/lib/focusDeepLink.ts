/**
 * Focus deep links (Phase 4.5 / 9.7 — Instagram funnel).
 *
 * `/focus?duration=25&task=Revise+thermo&src=ig` and `/go/ig` land here.
 * The first session must work with zero login: duration pre-arms the idle
 * timer, the task prefills the intention line, `src` flows into analytics
 * (`device_context` event) instead of a login wall.
 *
 * Bounds: duration 1–240 min (matches `MAX_CUSTOM_MINUTES`), task ≤120
 * chars, src ≤32 chars. Garbage in → nulls out, never a throw, never NaN.
 */

export const FOCUS_DEEP_LINK_EVENT = "focusarx:apply-deep-link";

export interface FocusDeepLink {
  /** Focus slice in seconds, or null when absent/invalid. */
  durationSeconds: number | null;
  /** Prefill task, or null when absent. */
  task: string | null;
  /** Acquisition source (`ig`, …), or null when absent. */
  src: string | null;
  /** True when the URL carried any focus intent. */
  armed: boolean;
}

export const MIN_DEEP_LINK_MINUTES = 1;
export const MAX_DEEP_LINK_MINUTES = 240;

export function parseFocusDeepLink(search: string): FocusDeepLink {
  let durationSeconds: number | null = null;
  let task: string | null = null;
  let src: string | null = null;
  try {
    const params = new URLSearchParams(search || "");
    const rawDuration = (params.get("duration") || "").trim();
    if (rawDuration !== "") {
      const minutes = Number(rawDuration);
      if (
        Number.isFinite(minutes) &&
        minutes >= MIN_DEEP_LINK_MINUTES &&
        minutes <= MAX_DEEP_LINK_MINUTES
      ) {
        durationSeconds = Math.round(minutes * 60);
      }
    }
    const rawTask = (params.get("task") || "").trim().replace(/\s+/g, " ");
    if (rawTask !== "") task = rawTask.slice(0, 120);
    const rawSrc = (params.get("src") || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (rawSrc !== "") src = rawSrc.slice(0, 32);
  } catch {
    return { durationSeconds: null, task: null, src: null, armed: false };
  }
  return {
    durationSeconds,
    task,
    src,
    armed: durationSeconds != null || task != null,
  };
}

/** Broadcast a parsed deep link to mounted timers (they apply it only when idle). */
export function dispatchFocusDeepLink(link: FocusDeepLink): void {
  try {
    window.dispatchEvent(
      new CustomEvent(FOCUS_DEEP_LINK_EVENT, {
        detail: { seconds: link.durationSeconds, task: link.task },
      }),
    );
  } catch {
    /* ignore */
  }
}
