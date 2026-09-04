/**
 * Versioned, corruption-safe client storage (Phase 5.3 STATE fix).
 *
 * Why this exists:
 * - A single malformed `localStorage` value must never white-screen the app.
 *   Every read is guarded; corrupt values are quarantined (renamed, never
 *   deleted silently) so a future migration can still inspect them.
 * - Safari private-mode (and full disks) throw `QuotaExceededError` on
 *   `setItem`. Writes fall back to an in-memory map so the session keeps
 *   working; the timer never depends on a throwing write.
 * - `SCHEMA_VERSION` lets the one-time localStorage→DB import (and any
 *   future migration) detect legacy payloads without guessing.
 */

export const STORAGE_SCHEMA_VERSION = 1;
export const STORAGE_VERSION_KEY = "focusarx-schema-version";

const memoryFallback = new Map<string, string>();

function storageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function quarantine(key: string, raw: string): void {
  try {
    window.localStorage.setItem(
      `${key}:corrupt:${Date.now()}`,
      raw.slice(0, 4000),
    );
    window.localStorage.removeItem(key);
  } catch {
    memoryFallback.delete(key);
  }
}

/** Raw string read. Returns null when missing, unreadable, or unusable. */
export function safeGet(key: string): string | null {
  if (storageAvailable()) {
    try {
      const value = window.localStorage.getItem(key);
      // A null here means "not in localStorage" — the memory fallback
      // (private-mode writes) still gets a chance below.
      if (value != null) return value;
    } catch {
      /* fall through to memory */
    }
  }
  return memoryFallback.get(key) ?? null;
}

/** JSON read. Returns `fallback` on missing/corrupt/unparseable values (and quarantines them). */
export function safeGetJson<T>(key: string, fallback: T): T {
  const raw = safeGet(key);
  if (raw == null || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    quarantine(key, raw);
    return fallback;
  }
}

/** Best-effort write. Never throws. Returns false when only the memory fallback held it. */
export function safeSet(key: string, value: string): boolean {
  if (!storageAvailable()) {
    memoryFallback.set(key, value);
    return false;
  }
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    // Private mode / quota exceeded: keep the session alive in memory.
    try {
      memoryFallback.set(key, value);
    } catch {
      /* ignore */
    }
    return false;
  }
}

/** JSON write. Never throws. */
export function safeSetJson(key: string, value: unknown): boolean {
  try {
    return safeSet(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function safeRemove(key: string): void {
  memoryFallback.delete(key);
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Current device IANA timezone (`America/New_York`, `Asia/Kolkata`, …), or null when unknowable. */
export function deviceTimeZone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === "string" && tz.length > 0 ? tz : null;
  } catch {
    return null;
  }
}

/** Record (once) which storage schema the client last wrote, for future migrations. */
export function stampSchemaVersion(): void {
  try {
    if (safeGet(STORAGE_VERSION_KEY) == null) safeSet(STORAGE_VERSION_KEY, String(STORAGE_SCHEMA_VERSION));
  } catch {
    /* ignore */
  }
}
