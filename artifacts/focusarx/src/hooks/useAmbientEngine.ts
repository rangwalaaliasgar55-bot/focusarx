import { useSyncExternalStore } from "react";
import { ambientEngine, type EqPresetId, type SoundId } from "@/lib/ambientEngine";

export interface AmbientState {
  activeIds: SoundId[];
  volumes: Record<string, number>;
  masterVolume: number;
  eq: EqPresetId;
  reactive: boolean;
}

let cached: AmbientState | null = null;
let version = 0;

function read(): AmbientState {
  const activeIds = ambientEngine.activeIds();
  const volumes: Record<string, number> = {};
  for (const id of activeIds) volumes[id] = ambientEngine.getVolume(id);
  return {
    activeIds,
    volumes,
    masterVolume: ambientEngine.getMasterVolume(),
    eq: ambientEngine.getEq(),
    reactive: ambientEngine.isReactive(),
  };
}

function subscribe(cb: () => void) {
  return ambientEngine.subscribe(() => {
    version += 1;
    cached = null;
    cb();
  });
}

function getSnapshot(): AmbientState {
  // Stable reference between engine emits so React does not re-render in a loop.
  if (!cached) {
    cached = read();
    (cached as AmbientState & { _v?: number })._v = version;
  }
  return cached;
}

const SERVER_SNAPSHOT: AmbientState = { activeIds: [], volumes: {}, masterVolume: 0.9, eq: "flat", reactive: false };

/** Reactive view of the shared ambient engine (single AudioContext app-wide). */
export function useAmbientEngine(): AmbientState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}
