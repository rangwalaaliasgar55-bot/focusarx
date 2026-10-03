/**
 * Panel order — the "move the timer or the tasks where I want them" part of the
 * workspace.
 *
 * The uploaded builds each fix their panels in place: the timer is where the
 * demo put it, and that is the end of it. Nothing to copy, so this is the one
 * piece of the workspace that is written here rather than ported — kept to a
 * pure order list and a storage key so the arrangement is a *preference*, never
 * a second source of truth about what the page contains.
 *
 * The order is validated on the way in: a stored list from an older build (or a
 * hand-edited one) is filtered against the panels that still exist, de-duped,
 * and any panel missing from it is appended in its default position. That is the
 * same rule the design packs use, and it is what stops a renamed panel from
 * turning into a blank workspace.
 */

import { safeGetJson, safeSetJson } from "./safeStorage";

/** The movable panels on the focus page, in their default order. */
export const PANEL_IDS = ["timer", "companion", "tasks"] as const;
export type PanelId = (typeof PANEL_IDS)[number];

export const DEFAULT_PANEL_ORDER: readonly PanelId[] = PANEL_IDS;

export const PANEL_LABELS: Record<PanelId, string> = {
  timer: "Timer",
  companion: "Companion",
  tasks: "Tasks and stats",
};

export const PANEL_ORDER_KEY = "focusarx-panel-order";

function isPanelId(value: unknown): value is PanelId {
  return typeof value === "string" && (PANEL_IDS as readonly string[]).includes(value);
}

/**
 * Coerce anything into a complete, duplicate-free order.
 *
 * Unknown ids are dropped, repeats keep their first position, and every panel
 * the current build knows about ends up in the list even if the stored order
 * predates it — a new panel appears where it belongs instead of not at all.
 */
export function normalizePanelOrder(raw: unknown): PanelId[] {
  const seen = new Set<PanelId>();
  const out: PanelId[] = [];
  if (Array.isArray(raw)) {
    for (const value of raw) {
      if (isPanelId(value) && !seen.has(value)) {
        seen.add(value);
        out.push(value);
      }
    }
  }
  for (const id of DEFAULT_PANEL_ORDER) if (!seen.has(id)) out.push(id);
  return out;
}

/** Move one panel by `delta` places, clamped to the ends. Pure. */
export function movePanel(order: readonly PanelId[], id: PanelId, delta: number): PanelId[] {
  const list = normalizePanelOrder(order);
  const from = list.indexOf(id);
  if (from === -1) return list;
  const to = Math.min(list.length - 1, Math.max(0, from + delta));
  if (to === from) return list;
  const next = [...list];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** Drop `id` where `targetId` currently sits — the drag path. Pure. */
export function reorderPanel(order: readonly PanelId[], id: PanelId, targetId: PanelId): PanelId[] {
  const list = normalizePanelOrder(order);
  if (id === targetId) return list;
  const from = list.indexOf(id);
  // The target's index *before* the dragged panel is removed: dragging the
  // first panel onto the second has to land it second, not first.
  const to = list.indexOf(targetId);
  if (from === -1 || to === -1) return list;
  const next = [...list];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export function readPanelOrder(): PanelId[] {
  return normalizePanelOrder(safeGetJson<unknown>(PANEL_ORDER_KEY, null));
}

export function writePanelOrder(order: readonly PanelId[]): PanelId[] {
  const next = normalizePanelOrder(order);
  safeSetJson(PANEL_ORDER_KEY, next);
  return next;
}

/** `style={{ order }}` for a flex child — the whole rendering change. */
export function orderIndex(order: readonly PanelId[], id: PanelId): number {
  const at = normalizePanelOrder(order).indexOf(id);
  return at === -1 ? 0 : at;
}
