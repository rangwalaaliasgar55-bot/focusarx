/**
 * Design assignment, client side.
 *
 * The value is owned by the server (`GET /api/appearance` returns the effective
 * assignment, already folded over the defaults and any admin pin) but it is read
 * by components deep in the tree that must not each own a query: the timer's
 * face switch, the companion stage, the arena. So the module keeps a small
 * external store — `useSyncExternalStore` over a single snapshot — that the
 * query hydrates and every reader subscribes to. One fetch, one truth, and a
 * component that only needs the id never has to handle "loading".
 *
 * `localStorage` is the offline fallback: it caches the last server answer (and
 * the user's own pick before the request lands), so a cold start with no network
 * still renders the face the user last chose instead of snapping back to
 * Classic. Cached values are coerced through `coerceAppearance`, because a cache
 * written by an older build can legitimately contain an id this build does not
 * know.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson, ApiError } from "@/lib/api";
import {
  APPEARANCE_FIELDS,
  DEFAULT_APPEARANCE,
  coerceAppearance,
  type AppearanceField,
  type AppearanceFields,
} from "@/lib/designPacks";
import { hasSessionHint } from "@/lib/auth";

const CACHE_KEY = "focusarx:appearance:v1";
/** Fired after a successful write so non-React listeners (tests, embeds) can react. */
export const APPEARANCE_EVENT = "focusarx:appearance";

export interface AppearanceState {
  fields: AppearanceFields;
  /** No server row: the account is still on the catalog defaults. */
  isDefault: boolean;
  /** An admin pinned this account; the settings UI must render read-only. */
  locked: boolean;
  source: "user" | "admin" | "default";
  /** True once the server has answered in this session. */
  synced: boolean;
}

interface ServerPayload {
  effective?: Partial<Record<AppearanceField, unknown>>;
  isDefault?: boolean;
  locked?: boolean;
  source?: "user" | "admin" | "default";
}

function readCache(): AppearanceFields | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return coerceAppearance(JSON.parse(raw) as Partial<Record<AppearanceField, unknown>>);
  } catch {
    return null;
  }
}

function writeCache(fields: AppearanceFields): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(fields));
  } catch {
    /* storage unavailable (private mode) — the value still lives in memory */
  }
}

let state: AppearanceState = {
  fields: readCache() ?? { ...DEFAULT_APPEARANCE },
  isDefault: true,
  locked: false,
  source: "default",
  synced: false,
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function setAppearanceState(next: Partial<AppearanceState> & { fields?: AppearanceFields }): void {
  const fields = next.fields ? coerceAppearance(next.fields) : state.fields;
  const merged: AppearanceState = { ...state, ...next, fields };
  if (
    merged.fields.timerFace === state.fields.timerFace &&
    merged.fields.petDesign === state.fields.petDesign &&
    merged.fields.battleDesign === state.fields.battleDesign &&
    merged.fields.layout === state.fields.layout &&
    merged.locked === state.locked &&
    merged.source === state.source &&
    merged.isDefault === state.isDefault &&
    merged.synced === state.synced
  ) {
    return;
  }
  state = merged;
  writeCache(state.fields);
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = (): AppearanceState => state;

/** The whole assignment (fields + lock state). Re-renders on change. */
export function useAppearanceState(): AppearanceState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Just the four ids — what a renderer needs, and nothing about provenance. */
export function useAppearanceFields(): AppearanceFields {
  return useAppearanceState().fields;
}

/**
 * Synchronous read for non-React callers (event handlers, a lazy initialiser).
 * Returns the last known value, never blocks, never throws.
 */
export function getAppearanceFields(): AppearanceFields {
  return state.fields;
}

function applyPayload(payload: ServerPayload): void {
  setAppearanceState({
    fields: coerceAppearance(payload.effective),
    isDefault: payload.isDefault ?? false,
    locked: payload.locked ?? false,
    source: payload.source ?? "user",
    synced: true,
  });
  window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: state.fields }));
}

/** Fetch the assignment. Guests are skipped — they have no row to read. */
export function useAppearance() {
  const query = useQuery({
    queryKey: ["appearance"],
    enabled: hasSessionHint(),
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<ServerPayload & { catalog?: unknown }> => {
      const payload = await apiJson<ServerPayload & { catalog?: unknown }>("/api/appearance", {
        credentials: "include",
      });
      applyPayload(payload);
      return payload;
    },
  });
  return query;
}

/** Thrown when an admin has pinned the account; the UI shows "managed". */
export class AppearanceLockedError extends Error {
  readonly code = "appearance_locked";
  constructor(message = "Your design is managed by an admin") {
    super(message);
    this.name = "AppearanceLockedError";
  }
}

export interface UpdateResult {
  ok: boolean;
  locked?: boolean;
  error?: string;
}

/**
 * Write one or more design fields.
 *
 * Optimistic: the local snapshot (and the cache) update before the request, so
 * the face changes the instant the user taps it. A 409 from the server — an
 * admin pinned the account between page load and the tap — rolls the snapshot
 * back to the server's values and reports `locked`, which is a state the UI
 * renders, not an error it toasts.
 */
export function useUpdateAppearance() {
  const queryClient = useQueryClient();
  return useCallback(
    async (patch: Partial<AppearanceFields>): Promise<UpdateResult> => {
      const previous = state;
      const nextFields: AppearanceFields = { ...state.fields };
      for (const field of APPEARANCE_FIELDS) {
        const value = patch[field];
        if (typeof value === "string") nextFields[field] = value as never;
      }
      setAppearanceState({ fields: nextFields, source: "user", isDefault: false });

      try {
        const payload = await apiJson<ServerPayload>("/api/appearance", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        applyPayload(payload);
        void queryClient.invalidateQueries({ queryKey: ["appearance"] });
        return { ok: true, locked: payload.locked };
      } catch (err) {
        setAppearanceState(previous);
        if (err instanceof ApiError && err.status === 409) {
          setAppearanceState({ locked: true, source: "admin" });
          return { ok: false, locked: true, error: new AppearanceLockedError().message };
        }
        return { ok: false, error: err instanceof Error ? err.message : "Could not save your design" };
      }
    },
    [queryClient],
  );
}

/** Reset to the catalog defaults (the user's own, unpinned choice). */
export function useResetAppearance() {
  const queryClient = useQueryClient();
  return useCallback(async (): Promise<UpdateResult> => {
    try {
      await apiJson<ServerPayload>("/api/appearance", { method: "DELETE", credentials: "include" });
      setAppearanceState({ fields: { ...DEFAULT_APPEARANCE }, isDefault: true, source: "default" });
      void queryClient.invalidateQueries({ queryKey: ["appearance"] });
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAppearanceState({ locked: true, source: "admin" });
        return { ok: false, locked: true, error: new AppearanceLockedError().message };
      }
      return { ok: false, error: err instanceof Error ? err.message : "Could not reset your design" };
    }
  }, [queryClient]);
}

/** Refresh the snapshot when the tab regains focus — an admin may just have written. */
export function useAppearanceRefreshOnFocus(): void {
  const query = useAppearance();
  const { refetch } = query;
  useEffect(() => {
    const onFocus = () => void refetch();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch]);
}

/** Test seam: reset the module store between cases. */
export function __resetAppearanceStateForTests(): void {
  state = { fields: { ...DEFAULT_APPEARANCE }, isDefault: true, locked: false, source: "default", synced: false };
  listeners.clear();
}
