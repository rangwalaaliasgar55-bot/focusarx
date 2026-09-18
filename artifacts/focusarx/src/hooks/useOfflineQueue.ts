import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  addItem,
  applyOutcome,
  classifyStatus,
  dueItems,
  makeIdempotencyKey,
  summarise,
  type QueuedItem,
  type QueueSummary,
} from "@/lib/offlineQueueCore";

const QUEUE_KEY = "focusarx-offline-queue";
/** How often the queue looks for anything that has become due. */
const TICK_MS = 15_000;

export type { QueuedItem } from "@/lib/offlineQueueCore";

/**
 * Offline queue for completed focus sessions.
 *
 * ## Why this is a module store rather than component state
 *
 * It used to be `useState` inside the hook, so **every caller got its own
 * copy**. `NetworkStatusBanner` and `FocusTimerMobileFirst` both call
 * `useOfflineQueue()`, so the timer could enqueue a session while the banner's
 * `queueCount` stayed at zero — the badge promising "1 session waiting to sync"
 * could not appear, because the component that renders it was reading a
 * different array. `refresh()` existed to paper over this and nothing called it.
 *
 * A module-level store with `useSyncExternalStore` makes every consumer observe
 * the same queue, and is the pattern already used for the shared clock in
 * `useNow`. The snapshot is cached because a getSnapshot that builds a fresh
 * object on every call reads as "the store changed" on every check — an
 * infinite render loop, which is the mistake `useNow` documents.
 *
 * ## What it will not do
 *
 * It will not discard a session. See `lib/offlineQueueCore.ts` for the five-
 * attempt cap that used to delete one.
 */

let items: QueuedItem[] = [];
let syncing = false;
/**
 * True when the queue could not be written to storage. The in-memory copy is
 * still correct, so the user's session is not lost while the tab is open — but
 * a reload would lose it, and saying nothing about that would be the same
 * silent-loss bug in a quieter form.
 */
let persistenceFailed = false;
let snapshot: StoreSnapshot = { items: [], summary: summarise([]), syncing: false, persistenceFailed: false };
const listeners = new Set<() => void>();

interface StoreSnapshot {
  items: QueuedItem[];
  summary: QueueSummary;
  syncing: boolean;
  persistenceFailed: boolean;
}

function publish(): void {
  // Recomputed once per change and cached, so `getSnapshot` is referentially
  // stable between changes.
  snapshot = { items, summary: summarise(items), syncing, persistenceFailed };
  for (const listener of listeners) listener();
}

function persist(next: QueuedItem[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
    persistenceFailed = false;
  } catch {
    // Quota exceeded, or storage disabled (private mode, blocked cookies).
    // The old code swallowed this too — but it swallowed it *after* writing,
    // so an enqueue silently did nothing at all and the session was gone.
    // Keeping the item in memory is strictly better than dropping it, and the
    // flag makes the difference visible.
    persistenceFailed = true;
  }
}

function load(): QueuedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validate rather than trust: a queue written by an older build, or a
    // half-written string, must not put `undefined` into the retry loop.
    return parsed.filter((entry): entry is QueuedItem => {
      const e = entry as Partial<QueuedItem> | null;
      return (
        typeof e?.id === "string" &&
        typeof e.idempotencyKey === "string" &&
        typeof e.createdAt === "number" &&
        typeof e.attempts === "number"
      );
    });
  } catch {
    return [];
  }
}

function setItems(next: QueuedItem[]): void {
  items = next;
  persist(next);
  publish();
}

/** Load once, at module init, so the first render already knows the count. */
if (typeof window !== "undefined") {
  items = load();
  snapshot = { items, summary: summarise(items), syncing: false, persistenceFailed: false };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = (): StoreSnapshot => snapshot;
const getServerSnapshot = (): StoreSnapshot =>
  ({ items: [], summary: summarise([]), syncing: false, persistenceFailed: false });

/** The endpoint every queued payload is delivered to. */
const DELIVERY_ENDPOINT = "/api/sessions";

/**
 * Deliver one item. Never throws — the caller only cares about the outcome.
 *
 * Uses a bare `fetch` rather than the shared client on purpose: `apiFetch`
 * refreshes on 401 and retries, which would blur the response the classifier
 * needs to see, and it must work when the auth layer itself is unreachable.
 */
async function deliver(item: QueuedItem): Promise<{ outcome: ReturnType<typeof classifyStatus>; error?: string }> {
  try {
    const token = localStorage.getItem("focusarx-auth-token");
    const res = await fetch(DELIVERY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(item.payload),
    });
    const outcome = classifyStatus(res.status);
    if (outcome === "rejected") {
      // Read the server's explanation if it gave one — "Focused session already
      // recorded" is actionable for the user; "400" is not.
      const body = await res.json().catch(() => null);
      const message =
        (body as { error?: { message?: string } | string } | null)?.error;
      return {
        outcome,
        error: typeof message === "string" ? message : message?.message ?? `Rejected (${res.status})`,
      };
    }
    return { outcome };
  } catch (err) {
    // A rejected promise here is a network failure: no response at all, so the
    // request definitely did not land. Transient.
    return { outcome: "transient", error: err instanceof Error ? err.message : "Network error" };
  }
}

/** Flush now. `force` ignores the backoff schedule. */
export async function flushOfflineQueue(force = true): Promise<void> {
  if (syncing) return;
  // `navigator.onLine === false` is a reliable "do not bother"; `true` is not a
  // reliable "the network works", which is why this only short-circuits offline.
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const due = force ? items : dueItems(items, Date.now());
  if (due.length === 0) return;

  syncing = true;
  publish();

  const dueIds = new Set(due.map((i) => i.id));
  let working = items;

  for (const item of due) {
    if (!dueIds.has(item.id)) continue;
    const { outcome, error } = await deliver(item);
    const updated = applyOutcome(item, outcome, Date.now(), error);
    working = updated === null
      ? working.filter((i) => i.id !== item.id)
      : working.map((i) => (i.id === item.id ? updated : i));
    // Persisted after every item, not at the end: a tab closed midway through a
    // long flush must not re-send what already succeeded or lose what did not.
    items = working;
    persist(working);
  }

  syncing = false;
  publish();
}

/**
 * Re-arm every stalled item so the next run will try it again.
 *
 * The escape hatch for a payload the server refused hours ago, and for the case
 * where the outage outlasted the attempt budget. Resets the counter rather than
 * deleting anything — a user who asks for a retry wants the data sent, not
 * forgotten.
 */
/** Re-arm every stalled item for another attempt. */
export function retryOfflineQueue(): void {
  setItems(
    items.map((i) => ({ ...i, attempts: 0, rejected: false, lastAttemptAt: null, lastError: undefined })),
  );
}

/** Queue a payload. Returns the stored item, or null if it was refused. */
export function enqueueOfflineItem(payload: unknown, idempotencyKey?: string): QueuedItem | null {
  const now = Date.now();
  const key = idempotencyKey ?? makeIdempotencyKey(payload, now);
  const candidate: QueuedItem = {
    id: `${now}_${Math.random().toString(36).slice(2)}`,
    idempotencyKey: key,
    payload: typeof payload === "object" && payload !== null ? { ...payload, idempotencyKey: key } : payload,
    createdAt: now,
    attempts: 0,
    lastAttemptAt: null,
    rejected: false,
  };
  const { items: next, added } = addItem(items, candidate);
  if (!added) return null;
  setItems(next);
  return candidate;
}

/** Remove one item. Only ever the user's decision — see the note below. */
export function removeOfflineItem(id: string): void {
  // Only ever called because the user asked. Nothing in this module removes an
  // item except an accepted response.
  setItems(items.filter((i) => i.id !== id));
}

/** Drop the whole queue. Used on sign-out, where the items belong to the
 * account that just left. */
export function clearOfflineQueue(): void {
  setItems([]);
}

function useOfflineQueue() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Kept in a ref so the effect below never needs `state` in its deps and the
  // intervals are not torn down and rebuilt on every queue change.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const onOnline = () => void flushOfflineQueue(false);
    // A tab returning to the foreground is the most likely moment for a flaky
    // connection to have recovered, and `online` does not always fire for it.
    const onVisible = () => {
      if (document.visibilityState === "visible") void flushOfflineQueue(false);
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const tick = setInterval(() => void flushOfflineQueue(false), TICK_MS);
    // Deferred so the first flush never runs inside the effect body.
    const first = setTimeout(() => void flushOfflineQueue(false), 0);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(tick);
      clearTimeout(first);
    };
  }, []);

  const processQueue = useCallback(() => flushOfflineQueue(true), []);

  return {
    queue: state.items,
    queueCount: state.items.length,
    syncing: state.syncing,
    summary: state.summary,
    /** True when the queue is not being written to disk — a reload would lose it. */
    persistenceFailed: state.persistenceFailed,
    enqueue: enqueueOfflineItem,
    remove: removeOfflineItem,
    clearAll: clearOfflineQueue,
    retryAll: retryOfflineQueue,
    processQueue,
    hasPending: state.items.length > 0,
    /** True when at least one item will not retry itself. */
    needsAttention: state.summary.needsAttention > 0,
  };
}

/** For tests and for a hard reset on sign-out. */
export function resetOfflineQueue(): void {
  items = [];
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {
    // Nothing to do; the in-memory queue is already empty.
  }
  publish();
}

export { useOfflineQueue };
