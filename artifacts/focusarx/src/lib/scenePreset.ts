/**
 * Scene preset store (Phase 7.4).
 *
 * Two independent layers: UI Theme (chrome) and Scene Preset (visual).
 * Core ships polished; Minimal Ring is the Tier-C default and a manual
 * choice everywhere. Deep Sea, Study Room, Constellation and Zen Garden are
 * Pro stubs — selectable only to show the upsell, never rendered.
 */

import { useState } from "react";

export type ScenePresetId =
  | "core"
  | "minimal-ring"
  | "deep-sea"
  | "study-room"
  | "constellation"
  | "zen-garden";

export interface ScenePreset {
  id: ScenePresetId;
  label: string;
  blurb: string;
  /** Shipped and selectable. */
  available: boolean;
  /** Pro-gated stub (shows upsell, renders Core). */
  pro: boolean;
}

export const SCENE_PRESETS: ScenePreset[] = [
  { id: "core", label: "Focus Core", blurb: "Reactive 3D core.", available: true, pro: false },
  { id: "minimal-ring", label: "Minimal Ring", blurb: "Calm CSS ring. Default on low-end devices.", available: true, pro: false },
  { id: "deep-sea", label: "Deep Sea", blurb: "Longer sessions dive deeper. Pro.", available: false, pro: true },
  { id: "study-room", label: "Study Room", blurb: "Lamp, window and books track progress. Pro.", available: false, pro: true },
  { id: "constellation", label: "Constellation", blurb: "Sessions become stars. Pro.", available: false, pro: true },
  { id: "zen-garden", label: "Zen Garden", blurb: "Sand rings trace minutes. Pro.", available: false, pro: true },
];

const PRESET_KEY = "focusarx-scene-preset";

export function getScenePreset(): ScenePresetId {
  try {
    const stored = window.localStorage.getItem(PRESET_KEY) as ScenePresetId | null;
    const found = SCENE_PRESETS.find((p) => p.id === stored);
    if (found?.available) return found.id;
  } catch {
    /* ignore */
  }
  return "core";
}

export function setScenePreset(id: ScenePresetId): boolean {
  const found = SCENE_PRESETS.find((p) => p.id === id);
  if (!found?.available) return false;
  try {
    window.localStorage.setItem(PRESET_KEY, id);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("focusarx:scene-preset", { detail: id }));
  return true;
}

export function useScenePreset(): [ScenePresetId, (id: ScenePresetId) => boolean] {
  const [preset, setPreset] = useState<ScenePresetId>(getScenePreset);
  const pick = (id: ScenePresetId): boolean => {
    const ok = setScenePreset(id);
    if (ok) setPreset(id);
    return ok;
  };
  return [preset, pick];
}
