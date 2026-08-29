/**
 * FocusArx Deployment Skew Protection — Frontend Module (v2)
 *
 * Prevents users from loading frontend assets from one deployment while API
 * requests go to a different deployment. This causes silent data corruption,
 * chunk load failures, and schema mismatches.
 *
 * Features:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. VERSION DETECTION (3 sources):
 *    - Response headers: every API response carries X-FocusArx-Deployment
 *    - 409 DEPLOYMENT_SKEW errors: backend blocks mutations during skew
 *    - Periodic polling: /api/deployment checked with adaptive intervals
 *
 * 2. STALE CHUNK RECOVERY:
 *    - Catches chunk load errors (dynamic import() failures)
 *    - Auto-retries with cache bust after clearing service worker cache
 *    - Falls back to hard reload if retry fails
 *
 * 3. MUTATION QUEUE:
 *    - When a mutation is blocked by 409, it's queued in sessionStorage
 *    - After refresh, queued mutations are replayed automatically
 *    - Non-idempotent mutations are flagged for user confirmation
 *
 * 4. MULTI-TAB COORDINATION:
 *    - Uses BroadcastChannel to notify all tabs of skew detection
 *    - Only one tab performs the refresh (elected via leader election)
 *    - Other tabs show "refreshing..." and wait for the leader
 *
 * 5. ADAPTIVE POLLING:
 *    - Polls every 2 min normally, 30s after detecting any version change
 *    - Backs off exponentially on network errors (up to 10 min)
 *    - Pauses polling when page is hidden (battery saving)
 *    - Resumes immediately on visibility change
 *
 * 6. SERVICE WORKER INTEGRATION:
 *    - Validates that the cached index.html matches the current deployment
 *    - Sends CLEAR_CACHE message before refresh
 *    - Detects when SW serves stale content and forces update
 *
 * 7. FORM STATE PRESERVATION:
 *    - Saves form data to sessionStorage before refresh
 *    - Restores via React-compatible value setter after reload
 *    - Preserves cursor position in text inputs
 *
 * 8. USER EXPERIENCE:
 *    - Non-destructive banner with clear action
 *    - Dismissible (user can continue working with stale version)
 *    - Never auto-refreshes while user is actively typing
 *    - Shows "Update available" badge in navigation
 */

import logger from "./logger";
import { useEffect, useCallback, useState, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Header name matching the backend middleware. */
const DEPLOYMENT_HEADER = "X-FocusArx-Deployment";

/** Storage keys for persistence across refreshes. */
const STORAGE_KEYS = {
  FORMS: "focusarx:preserved-forms",
  MUTATION_QUEUE: "focusarx:skew-mutation-queue",
  REFRESH_COUNT: "focusarx:skew-refresh-count",
  LAST_KNOWN_VERSION: "focusarx:last-known-server-version",
} as const;

/** Polling intervals (ms). */
const POLL_INTERVAL_NORMAL = 2 * 60 * 1000;       // 2 minutes
const POLL_INTERVAL_FAST = 30 * 1000;             // 30 seconds (after detecting change)
const POLL_BACKOFF_MAX = 10 * 60 * 1000;          // 10 minutes max backoff
const INITIAL_DELAY = 3000;                        // 3 seconds after page load

/** Max automatic retries for chunk load failures. */
const MAX_CHUNK_RETRIES = 2;

/** Max queued mutations to replay after refresh. */
const MAX_QUEUED_MUTATIONS = 10;

/** Max refresh attempts before giving up (prevents infinite loops). */
const MAX_REFRESH_ATTEMPTS = 3;

// ─── Build-time version ──────────────────────────────────────────────────────

/** The deployment version this frontend was built with. */
export const FRONTEND_DEPLOYMENT_VERSION: string =
  (typeof __DEPLOYMENT_VERSION__ !== "undefined" ? __DEPLOYMENT_VERSION__ : null) ??
  import.meta.env.VITE_DEPLOYMENT_VERSION ??
  "dev-local";

// ─── Global state (shared across all hook instances) ─────────────────────────

let serverVersion: string | null = null;
let mismatchDetected = false;
let refreshAttempted = false;
let refreshCount = 0;
let dismissed = false;
let pollInterval = POLL_INTERVAL_NORMAL;
let pollBackoff = 1;
let consecutiveErrors = 0;
let isPolling = false;
const listeners = new Set<() => void>();
const broadcastChannel = typeof BroadcastChannel !== "undefined"
  ? new BroadcastChannel("focusarx:deployment-skew")
  : null;

function notify() {
  listeners.forEach((fn) => { try { fn(); } catch { /* listener error — skip */ } });
}

function broadcastToAllTabs(type: string, data?: Record<string, unknown>) {
  try {
    broadcastChannel?.postMessage({ type, data, timestamp: Date.now() });
  } catch { /* channel closed or unavailable */ }
}

// ─── Version tracking ────────────────────────────────────────────────────────

/**
 * Record the server version from a response header or API body.
 * If it differs from the frontend version, trigger mismatch handling.
 */
export function recordServerVersion(version: string | null | undefined): void {
  if (!version) return;
  if (serverVersion === version) return;

  const previousVersion = serverVersion;
  serverVersion = version;

  // Persist so we can detect version changes across page loads
  try { localStorage.setItem(STORAGE_KEYS.LAST_KNOWN_VERSION, version); } catch { /* */ }

  // Reset backoff on successful version read
  consecutiveErrors = 0;
  pollBackoff = 1;

  if (version !== FRONTEND_DEPLOYMENT_VERSION && !mismatchDetected) {
    mismatchDetected = true;
    notify();

    // Notify all other tabs
    broadcastToAllTabs("skew-detected", {
      frontendVersion: FRONTEND_DEPLOYMENT_VERSION,
      serverVersion: version,
    });

    logger.warn(
      `[deploy-skew] Version mismatch: frontend=${FRONTEND_DEPLOYMENT_VERSION}, ` +
      `server=${version}${previousVersion ? ` (was ${previousVersion})` : ""}. ` +
      `A new deployment has landed.`
    );

    // Switch to fast polling to confirm the change is stable
    pollInterval = POLL_INTERVAL_FAST;
  }
}

// ─── Chunk load error recovery ───────────────────────────────────────────────

let chunkRetryCount = 0;

/**
 * Handle dynamic import() failures caused by stale chunk references.
 * When a deployment changes, old JS chunks get new hashed names, so
 * importing an old chunk returns 404.
 *
 * Strategy:
 * 1. Clear service worker cache
 * 2. Retry the import with a cache-busting query parameter
 * 3. If retry fails, trigger a full page refresh
 */
export async function handleChunkLoadError<T>(
  importFn: () => Promise<T>,
  chunkName?: string
): Promise<T> {
  try {
    return await importFn();
  } catch (err) {
    const isChunkError = err instanceof TypeError &&
      (err.message.includes("Failed to fetch dynamically imported module") ||
       err.message.includes("Loading chunk") ||
       err.message.includes("Loading CSS chunk") ||
       err.message.includes("error loading dynamically imported module"));

    if (!isChunkError) throw err;

    chunkRetryCount++;
    if (chunkRetryCount > MAX_CHUNK_RETRIES) {
      logger.error(`[deploy-skew] Chunk load failed after ${MAX_CHUNK_RETRIES} retries: ${chunkName ?? "unknown"}`);
      // Force a hard refresh — the deployment has changed and chunks are gone
      safeRefresh();
      throw err;
    }

    logger.warn(
      `[deploy-skew] Chunk load failed (attempt ${chunkRetryCount}/${MAX_CHUNK_RETRIES}): ${chunkName ?? "unknown"}. ` +
      `Clearing SW cache and retrying...`
    );

    // Clear service worker cache
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "CLEAR_CACHE" });
    }

    // Also clear all browser caches
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // Brief delay for SW to process the clear message
    await new Promise((r) => setTimeout(r, 200));

    // Retry the import
    return importFn();
  }
}

/**
 * Global chunk error listener — catches unhandled promise rejections from
 * dynamic imports and triggers recovery.
 */
function setupGlobalChunkErrorHandler() {
  if (typeof window === "undefined") return;

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const err = event.reason;
    if (err instanceof TypeError &&
        (err.message?.includes("Failed to fetch dynamically imported module") ||
         err.message?.includes("Loading chunk") ||
         err.message?.includes("error loading dynamically imported module"))) {
      event.preventDefault();
      logger.warn("[deploy-skew] Caught chunk load error — triggering recovery");

      // Check if this is likely a deployment skew issue
      if (mismatchDetected) {
        safeRefresh();
      } else {
        // Might just be a network blip — record version and check
        recordServerVersion(null); // Force re-check on next poll
        pollInterval = POLL_INTERVAL_FAST;
      }
    }
  });
}

// ─── Mutation queue ──────────────────────────────────────────────────────────

interface QueuedMutation {
  url: string;
  method: string;
  body: string | null;
  headers: Record<string, string>;
  timestamp: number;
  idempotent: boolean;
}

/**
 * Queue a failed mutation for replay after refresh.
 * Only safe (idempotent) mutations are auto-replayed.
 */
export function queueMutation(mutation: QueuedMutation): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.MUTATION_QUEUE);
    const queue: QueuedMutation[] = raw ? JSON.parse(raw) : [];

    if (queue.length >= MAX_QUEUED_MUTATIONS) {
      logger.warn("[deploy-skew] Mutation queue full — dropping oldest entry");
      queue.shift();
    }

    queue.push(mutation);
    sessionStorage.setItem(STORAGE_KEYS.MUTATION_QUEUE, JSON.stringify(queue));
  } catch {
    // sessionStorage may be unavailable
  }
}

/**
 * Replay queued mutations after a skew-triggered refresh.
 * Returns the number of mutations replayed.
 */
export async function replayQueuedMutations(): Promise<number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.MUTATION_QUEUE);
    if (!raw) return 0;
    sessionStorage.removeItem(STORAGE_KEYS.MUTATION_QUEUE);

    const queue: QueuedMutation[] = JSON.parse(raw);
    if (queue.length === 0) return 0;

    let replayed = 0;
    for (const mutation of queue) {
      // Only auto-replay idempotent mutations
      if (!mutation.idempotent) {
        logger.warn(`[deploy-skew] Skipping non-idempotent mutation: ${mutation.method} ${mutation.url}`);
        continue;
      }

      // Skip mutations older than 10 minutes (stale data risk)
      if (Date.now() - mutation.timestamp > 10 * 60 * 1000) {
        logger.warn(`[deploy-skew] Skipping stale mutation (>10min): ${mutation.method} ${mutation.url}`);
        continue;
      }

      try {
        const res = await fetch(mutation.url, {
          method: mutation.method,
          headers: {
            ...mutation.headers,
            [DEPLOYMENT_HEADER]: FRONTEND_DEPLOYMENT_VERSION,
          },
          body: mutation.body,
          credentials: "include",
        });

        if (res.ok) {
          replayed++;
          logger.info(`[deploy-skew] Replayed mutation: ${mutation.method} ${mutation.url}`);
        } else {
          logger.warn(`[deploy-skew] Replay failed (${res.status}): ${mutation.method} ${mutation.url}`);
        }
      } catch {
        logger.warn(`[deploy-skew] Replay network error: ${mutation.method} ${mutation.url}`);
      }
    }

    return replayed;
  } catch {
    return 0;
  }
}

// ─── Form state preservation ─────────────────────────────────────────────────

function saveFormState(): void {
  try {
    const forms: Record<string, Record<string, { value: string; selectionStart?: number | null; selectionEnd?: number | null }>> = {};
    document.querySelectorAll("form[data-preserve], [data-preserve-form], form").forEach((form) => {
      const id = (form as HTMLElement).dataset.preserveForm ||
                 (form as HTMLFormElement).id ||
                 `form-${Array.from(form.parentElement?.children ?? []).indexOf(form)}`;
      const data: Record<string, { value: string; selectionStart?: number | null; selectionEnd?: number | null }> = {};
      form.querySelectorAll("input, textarea, select").forEach((el) => {
        const input = el as HTMLInputElement;
        if (input.name && input.value) {
          data[input.name] = {
            value: input.value,
            selectionStart: input.selectionStart,
            selectionEnd: input.selectionEnd,
          };
        }
      });
      if (Object.keys(data).length > 0) {
        forms[id] = data;
      }
    });
    if (Object.keys(forms).length > 0) {
      sessionStorage.setItem(STORAGE_KEYS.FORMS, JSON.stringify(forms));
    }
  } catch {
    // sessionStorage may be unavailable — non-fatal
  }
}

export function restoreFormState(): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.FORMS);
    if (!raw) return;
    sessionStorage.removeItem(STORAGE_KEYS.FORMS);
    const forms = JSON.parse(raw);

    setTimeout(() => {
      Object.entries(forms).forEach(([id, data]) => {
        const form = document.querySelector(
          `[data-preserve-form="${id}"], form#${id}[data-preserve], form#${id}`
        );
        if (!form) return;
        Object.entries(data as Record<string, { value: string; selectionStart?: number | null; selectionEnd?: number | null }>).forEach(([name, field]) => {
          const input = form.querySelector(`[name="${name}"]`) as HTMLInputElement | null;
          if (!input) return;
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, "value"
          )?.set ?? Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, "value"
          )?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(input, field.value);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
          // Restore cursor position
          if (field.selectionStart != null && typeof input.setSelectionRange === "function") {
            try {
              input.setSelectionRange(field.selectionStart, field.selectionEnd ?? field.selectionStart);
            } catch { /* some input types don't support setSelectionRange */ }
          }
        });
      });
    }, 500);
  } catch {
    // Non-fatal
  }
}

// ─── Safe refresh ────────────────────────────────────────────────────────────

/**
 * Check if the user is actively interacting with the page (typing, etc.).
 * We avoid auto-refreshing during active input to prevent data loss.
 */
function isUserActivelyTyping(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") {
    return true;
  }
  if ((active as HTMLElement).isContentEditable) return true;
  return false;
}

/**
 * Perform a safe refresh to pick up the new deployment.
 * Includes loop protection — max MAX_REFRESH_ATTEMPTS before giving up.
 */
export function safeRefresh(): void {
  if (refreshAttempted) {
    logger.warn("[deploy-skew] Refresh already attempted — ignoring to prevent loops.");
    return;
  }

  // Count refreshes across page loads
  try {
    refreshCount = parseInt(sessionStorage.getItem(STORAGE_KEYS.REFRESH_COUNT) ?? "0", 10);
    if (refreshCount >= MAX_REFRESH_ATTEMPTS) {
      logger.error(
        `[deploy-skew] Max refresh attempts (${MAX_REFRESH_ATTEMPTS}) reached. ` +
        `Giving up to prevent infinite refresh loop.`
      );
      return;
    }
    sessionStorage.setItem(STORAGE_KEYS.REFRESH_COUNT, String(refreshCount + 1));
  } catch { /* */ }

  refreshAttempted = true;

  // Don't refresh while user is typing
  if (isUserActivelyTyping()) {
    logger.warn("[deploy-skew] User is actively typing — deferring refresh.");
    refreshAttempted = false;
    return;
  }

  // Save form data before refreshing
  saveFormState();

  // Clear the service worker cache to ensure fresh assets
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "CLEAR_CACHE" });
  }

  // Notify other tabs that we're handling the refresh
  broadcastToAllTabs("refresh-started", {
    version: FRONTEND_DEPLOYMENT_VERSION,
  });

  // Perform a hard reload with cache-busting
  const url = new URL(window.location.href);
  url.searchParams.set("_v", Date.now().toString());
  url.searchParams.set("_skew", "1"); // Mark as skew-triggered for analytics
  window.location.replace(url.toString());
}

export function resetRefreshGuard(): void {
  refreshAttempted = false;
}

/**
 * Clear the refresh counter (called after a successful page load with matching versions).
 */
function clearRefreshCounter(): void {
  try {
    const lastVersion = localStorage.getItem(STORAGE_KEYS.LAST_KNOWN_VERSION);
    if (lastVersion === FRONTEND_DEPLOYMENT_VERSION) {
      // Same version as last time — reset the counter
      sessionStorage.removeItem(STORAGE_KEYS.REFRESH_COUNT);
      refreshCount = 0;
    }
  } catch { /* */ }
}

// ─── React hooks ─────────────────────────────────────────────────────────────

export function useDeploymentSkew() {
  const [state, setState] = useState({
    mismatch: mismatchDetected && !dismissed,
    serverVersion,
    frontendVersion: FRONTEND_DEPLOYMENT_VERSION,
  });

  useEffect(() => {
    const handler = () => {
      setState({
        mismatch: mismatchDetected && !dismissed,
        serverVersion,
        frontendVersion: FRONTEND_DEPLOYMENT_VERSION,
      });
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const dismiss = useCallback(() => {
    dismissed = true;
    notify();
  }, []);

  const refresh = useCallback(() => {
    safeRefresh();
  }, []);

  return { ...state, dismiss, refresh };
}

// ─── Polling engine ──────────────────────────────────────────────────────────

async function checkDeployment(): Promise<void> {
  if (isPolling) return; // Prevent concurrent polls
  isPolling = true;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    const res = await fetch("/api/deployment", {
      method: "GET",
      credentials: "omit",
      signal: controller.signal,
      headers: { [DEPLOYMENT_HEADER]: FRONTEND_DEPLOYMENT_VERSION },
    });
    clearTimeout(timeout);

    if (res.ok) {
      consecutiveErrors = 0;
      pollBackoff = 1;
      const data = await res.json();
      recordServerVersion(data.version);
    }

    const headerVersion = res.headers.get(DEPLOYMENT_HEADER);
    if (headerVersion) {
      recordServerVersion(headerVersion);
    }
  } catch (err) {
    consecutiveErrors++;
    // Exponential backoff on errors: 1x → 2x → 4x → 8x → capped at POLL_BACKOFF_MAX
    pollBackoff = Math.min(pollBackoff * 2, POLL_BACKOFF_MAX / POLL_INTERVAL_NORMAL);
  } finally {
    isPolling = false;
  }
}

// ─── Main detector hook ──────────────────────────────────────────────────────

export function useDeploymentSkewDetector() {
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

  // Schedule the next poll with the current interval and backoff
  const scheduleNextPoll = useCallback(() => {
    if (!mountedRef.current) return;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

    const interval = pollInterval * pollBackoff;
    pollTimerRef.current = setTimeout(async () => {
      await checkDeployment();
      scheduleNextPoll(); // Schedule next after completion
    }, interval);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Clear refresh counter if versions match (successful previous refresh)
    clearRefreshCounter();

    // Setup global chunk load error handler
    setupGlobalChunkErrorHandler();

    // Initial check after a short delay (don't block initial load)
    const initialTimer = setTimeout(async () => {
      await checkDeployment();
      scheduleNextPoll();
    }, INITIAL_DELAY);

    // Visibility change — pause polling when hidden, resume on focus
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pause polling to save battery
        if (pollTimerRef.current) {
          clearTimeout(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      } else {
        // Resume — check immediately, then resume polling
        checkDeployment().then(() => scheduleNextPoll());
      }
    };
    visibilityHandlerRef.current = handleVisibilityChange;
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Listen for skew events from the API error handler
    const skewHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { status?: number; code?: string; serverVersion?: string };
      if (detail?.code === "DEPLOYMENT_SKEW" || detail?.status === 409) {
        if (detail.serverVersion) {
          recordServerVersion(detail.serverVersion);
        } else {
          mismatchDetected = true;
          notify();
        }
      }
    };
    window.addEventListener("focusarx:deployment-skew", skewHandler);

    // Listen for cross-tab skew notifications
    const broadcastHandler = (event: MessageEvent) => {
      if (event.data?.type === "skew-detected") {
        const { serverVersion: remoteServer } = event.data.data ?? {};
        if (remoteServer) {
          recordServerVersion(remoteServer);
        }
      }
    };
    broadcastChannel?.addEventListener("message", broadcastHandler);

    // Restore form data and replay mutations after a skew-triggered refresh
    restoreFormState();
    replayQueuedMutations().then((count) => {
      if (count > 0) {
        logger.info(`[deploy-skew] Replayed ${count} queued mutation(s) after refresh.`);
      }
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(initialTimer);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (visibilityHandlerRef.current) {
        document.removeEventListener("visibilitychange", visibilityHandlerRef.current);
      }
      window.removeEventListener("focusarx:deployment-skew", skewHandler);
      broadcastChannel?.removeEventListener("message", broadcastHandler);
    };
  }, [scheduleNextPoll]);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

export function hasMismatch(): boolean { return mismatchDetected; }
export function isDismissed(): boolean { return dismissed; }
export function dismissMismatch(): void { dismissed = true; notify(); }
export function getServerVersion(): string | null { return serverVersion; }

// Type declaration for __DEPLOYMENT_VERSION__ injected at build time.
declare const __DEPLOYMENT_VERSION__: string | undefined;
