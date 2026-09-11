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
 *    - Fast polling is capped (~10 min) then drops back to normal, so a
 *      stuck mismatch can never poll /api/deployment every 30s forever
 *    - Backs off exponentially on network errors (up to 10 min)
 *    - Pauses polling when page is hidden (battery saving)
 *    - Resumes immediately on visibility change
 *    - Unverifiable versions (dev sentinels, backend "unverifiable") never
 *      raise the banner; a resolved mismatch clears it without a refresh
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
import {
  cleanReloadParams,
  noteBoot,
  purgeCaches,
  reloadsRemaining,
  requestCoordinatedReload,
} from "./reloadCoordinator";
import { isChunkLoadError } from "./chunkRecovery";

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

/**
 * Fast-polling cap: after this many 30s polls (~10 min) with the skew still
 * unresolved, drop back to the normal interval. A stuck mismatch (e.g. a
 * backend that cannot identify its own deployment) must not hammer
 * /api/deployment every 30s forever — that poll storm was half of the
 * "request keeps coming again" complaint.
 */
const MAX_FAST_POLLS = 20;

/**
 * Sentinel the backend answers when it has no stable deployment identifier
 * (must match UNVERIFIABLE_DEPLOYMENT_VERSION in
 * artifacts/api-server/src/lib/deploymentVersion.ts).
 */
const UNVERIFIABLE_SERVER_VERSION = "unverifiable";

/** Prefix for per-process dev versions (`dev-local`, `dev-<pid>`). */
const DEV_VERSION_PREFIX = "dev-";

/**
 * True when a version string can never participate in skew detection: dev
 * sentinels on either side, or the backend's explicit "I don't know".
 * Comparing those values as if they were deployment ids is what produced a
 * permanent, unfixable "Update available" banner.
 */
export function isUnverifiableVersion(version: string | null | undefined): boolean {
  if (!version) return true;
  const trimmed = version.trim();
  if (trimmed === "") return true;
  const lower = trimmed.toLowerCase();
  return lower.startsWith(DEV_VERSION_PREFIX) || lower === UNVERIFIABLE_SERVER_VERSION;
}

/**
 * Mirror of the backend's compatibility rule (artifacts/api-server/src/lib/
 * deploymentVersion.ts → isDeploymentCompatible).
 *
 * The two sides used to disagree, and that disagreement — not a real skew — was
 * what put users on `/dashboard?_v=<ts>&_skew=1`:
 *
 *   • the **backend** accepted any of the deployment's known ids
 *     (VERCEL_DEPLOYMENT_ID, the 12-char commit SHA, DEPLOYMENT_VERSION) and
 *     treated an abbreviated SHA as a prefix match, failing open when it knew
 *     no stable id at all;
 *   • the **frontend** compared one string for strict equality against
 *     `/api/deployment`'s primary `version`.
 *
 * On Vercel the build-time version is usually a git SHA (vite.config.ts falls
 * back to `git rev-parse --short HEAD`) while the runtime primary version is
 * `VERCEL_DEPLOYMENT_ID` — two different strings for one deployment. The result
 * was a permanent mismatch: a banner on every page, an "Update now" that
 * reloaded into the same mismatch, 30 s polling forever, and refresh confusion.
 *
 * Rules, in the backend's order:
 *   1. either side unverifiable (dev sentinel, "unverifiable", blank) → true;
 *   2. the server knows no stable id → true (fail open, never loop);
 *   3. exact match against any known id → true;
 *   4. abbreviated-SHA prefix match in either direction → true;
 *   5. otherwise → false, this really is a different deployment.
 */
export function isVersionCompatible(
  frontendVersion: string | null | undefined,
  knownIds: ReadonlyArray<string | null | undefined> | string | null | undefined,
): boolean {
  if (isUnverifiableVersion(frontendVersion)) return true;

  const candidates = (Array.isArray(knownIds) ? knownIds : [knownIds])
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter((id) => id !== "" && !isUnverifiableVersion(id));

  // Fail open: a server that cannot identify its own deployment must not put
  // every visitor in a refresh loop.
  if (candidates.length === 0) return true;

  const mine = String(frontendVersion).trim();
  if (candidates.some((id) => id === mine || id.toLowerCase() === mine.toLowerCase())) return true;

  const shaLike = /^[0-9a-f]{7,40}$/i;
  if (shaLike.test(mine)) {
    const lower = mine.toLowerCase();
    // Build-time short SHA vs runtime 12-char slice, in either direction:
    // one is a prefix of the other only when they are the same commit.
    if (candidates.some((id) => shaLike.test(id) && id.toLowerCase().startsWith(lower))) return true;
    if (candidates.some((id) => shaLike.test(id) && lower.startsWith(id.toLowerCase()))) return true;
  }

  return false;
}

// ─── Build-time version ──────────────────────────────────────────────────────

/** The deployment version this frontend was built with. */
export const FRONTEND_DEPLOYMENT_VERSION: string =
  (typeof __DEPLOYMENT_VERSION__ !== "undefined" ? __DEPLOYMENT_VERSION__ : null) ??
  import.meta.env.VITE_DEPLOYMENT_VERSION ??
  "dev-local";

// ─── Global state (shared across all hook instances) ─────────────────────────

let serverVersion: string | null = null;
let serverKnownIds: string[] = [];
let mismatchDetected = false;
/** True once the reload budget is spent: the banner must say so instead of
 *  offering an "Update now" that cannot work. */
let reloadBlocked = false;
let refreshAttempted = false;
let dismissed = false;
let pollInterval = POLL_INTERVAL_NORMAL;
let pollBackoff = 1;
let fastPollCount = 0;
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
 *
 * Three cases that used to misbehave:
 * - Either side is unverifiable (dev sentinels, backend "unverifiable"):
 *   skew cannot be determined, so stay quiet instead of raising a banner
 *   that no refresh can ever clear.
 * - Versions agree after a mismatch (transient overlap during a rolling
 *   deploy): resolve the flag so the banner hides itself and polling calms
 *   down — previously the flag latched forever until a manual refresh.
 */
export function recordServerVersion(
  version: string | null | undefined,
  knownIds?: ReadonlyArray<string | null | undefined>,
): void {
  if (knownIds && knownIds.length > 0) {
    serverKnownIds = [...new Set(knownIds.filter((id): id is string => typeof id === "string" && id.trim() !== ""))];
  }
  if (!version) return;
  if (serverVersion === version && (knownIds === undefined || knownIds.length === 0)) return;

  const previousVersion = serverVersion;
  serverVersion = version;

  // Persist so we can detect version changes across page loads
  try { localStorage.setItem(STORAGE_KEYS.LAST_KNOWN_VERSION, version); } catch { /* */ }

  // Reset backoff on successful version read
  pollBackoff = 1;
  // A new server version restarts the fast-poll budget (see scheduleNextPoll).
  fastPollCount = 0;

  // Skew cannot be judged — record quietly and change nothing.
  if (isUnverifiableVersion(version) || isUnverifiableVersion(FRONTEND_DEPLOYMENT_VERSION)) {
    return;
  }

  // Compatible with this build — a rolling deploy settled, or the server simply
  // answered with a different (but equivalent) identifier for the same deploy.
  if (isVersionCompatible(FRONTEND_DEPLOYMENT_VERSION, [...serverKnownIds, version])) {
    if (mismatchDetected) {
      mismatchDetected = false;
      dismissed = false;
      pollInterval = POLL_INTERVAL_NORMAL;
      notify();
      logger.info("[deploy-skew] Versions are compatible again — mismatch resolved without refresh.");
    }
    return;
  }

  if (!mismatchDetected) {
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
 * Retry a dynamic import that failed on a stale chunk.
 *
 * When a deployment changes, old JS chunks get new hashed names, so importing
 * an old chunk 404s. Strategy: purge the caches that can still be serving the
 * stale document (the shared coordinator purge, not an ad-hoc copy), retry the
 * import once, and if it fails again ask for the one coordinated reload.
 *
 * Detection uses `chunkRecovery.isChunkLoadError`, the same predicate as the
 * global handlers, so this path and the `vite:preloadError` path can never
 * disagree about what counts as a chunk failure. The old inline check required
 * a `TypeError` and missed the Firefox/Safari wording ("Importing a module
 * script failed", "Failed to load module script"), which is how some browsers
 * ended up with a broken route and no recovery at all.
 */
export async function handleChunkLoadError<T>(
  importFn: () => Promise<T>,
  chunkName?: string
): Promise<T> {
  try {
    return await importFn();
  } catch (err) {
    if (!isChunkLoadError(err)) throw err;

    chunkRetryCount++;
    if (chunkRetryCount > MAX_CHUNK_RETRIES) {
      logger.error(`[deploy-skew] Chunk load failed after ${MAX_CHUNK_RETRIES} retries: ${chunkName ?? "unknown"}`);
      // The deployment has changed and the chunks are gone: reload through the
      // shared budget rather than reloading on our own counter.
      safeRefresh();
      throw err;
    }

    logger.warn(
      `[deploy-skew] Chunk load failed (attempt ${chunkRetryCount}/${MAX_CHUNK_RETRIES}): ${chunkName ?? "unknown"}. ` +
      `Purging caches and retrying...`
    );

    await purgeCaches();

    // Give the worker a tick to finish its own purge before the retry fetches.
    await new Promise((r) => setTimeout(r, 200));

    // Retry the import
    return importFn();
  }
}

/**
 * Chunk-load failures are handled by `lib/chunkRecovery.ts`, which owns the
 * `vite:preloadError` and `unhandledrejection` listeners and routes both through
 * reloadCoordinator. This module used to install a second `unhandledrejection`
 * listener that also reloaded the page, so one stale chunk could trigger two
 * reloads from two independent counters. What survives here is the part that is
 * genuinely about skew: when a chunk fails, start polling faster so a new
 * deployment is confirmed (or ruled out) quickly.
 */
function onChunkFailureHint(): void {
  pollInterval = POLL_INTERVAL_FAST;
  pollBackoff = 1;
}

if (typeof window !== "undefined") {
  window.addEventListener("fx:chunk-recovered", onChunkFailureHint);
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
 * Ask for the reload that picks up the new deployment.
 *
 * Loop protection is not local any more: `reloadCoordinator` owns one budget
 * shared with stale-chunk recovery, persisted across the reload and verified
 * against the build that actually comes back. What stays here is the cheap
 * same-tick guard, the "don't refresh while the user is typing" deferral, and
 * the mutation/form state that has to be saved before we navigate.
 *
 * Returns false when the reload did not happen (already attempted, the user is
 * typing, another tab owns the lock, or the budget is spent) so the banner can
 * say something honest instead of offering a button that does nothing.
 */
export function safeRefresh(): boolean {
  if (refreshAttempted) {
    logger.warn("[deploy-skew] Refresh already attempted — ignoring to prevent loops.");
    return false;
  }

  // The loop guard lives in reloadCoordinator (one budget shared with stale-chunk
  // recovery, persisted across the reload, verified against the build that comes
  // back). This counter only stops the same tick asking twice.
  if (reloadsRemaining() <= 0) {
    reloadBlocked = true;
    notify();
    logger.error("[deploy-skew] Reload budget spent — not refreshing again this window.");
    return false;
  }

  refreshAttempted = true;

  // Don't refresh while user is typing
  if (isUserActivelyTyping()) {
    logger.warn("[deploy-skew] User is actively typing — deferring refresh.");
    refreshAttempted = false;
    return false;
  }

  // Save form data before refreshing
  saveFormState();

  // Notify other tabs that we're handling the refresh — the coordinator also
  // holds a cross-tab lock, so siblings stand down instead of reloading too.
  broadcastToAllTabs("refresh-started", { version: FRONTEND_DEPLOYMENT_VERSION });

  const owned = requestCoordinatedReload({
    reason: "deployment-skew",
    fromVersion: FRONTEND_DEPLOYMENT_VERSION,
    cacheBust: true,
  });
  if (!owned) {
    refreshAttempted = false;
    reloadBlocked = reloadsRemaining() <= 0;
    notify();
  }
  return owned;
}

/**
 * Purge the caches without navigating. Used by the chunk-recovery path when it
 * can retry an import instead of reloading the page.
 */
export { purgeCaches };

export function resetRefreshGuard(): void {
  refreshAttempted = false;
}

/**
 * Drop the legacy per-tab refresh counter.
 *
 * Older builds counted refresh attempts in sessionStorage and gave up after
 * three; the reload coordinator's budget replaced that counter (persisted,
 * shared with chunk recovery, verified against the build that comes back). The
 * key is still removed on boot so a value written by an older deployment cannot
 * be misread by anything that looks for it.
 */
function clearRefreshCounter(): void {
  try {
    const lastVersion = localStorage.getItem(STORAGE_KEYS.LAST_KNOWN_VERSION);
    if (lastVersion === FRONTEND_DEPLOYMENT_VERSION) {
      sessionStorage.removeItem(STORAGE_KEYS.REFRESH_COUNT);
    }
  } catch { /* */ }
}

// ─── React hooks ─────────────────────────────────────────────────────────────

export interface DeploymentSkewState {
  mismatch: boolean;
  serverVersion: string | null;
  frontendVersion: string;
  /** Every identifier the server says it answers to. */
  knownIds: string[];
  /** True when the reload budget is spent — "Update now" cannot work, so the
   *  banner must say the update will apply on the next visit instead. */
  reloadBlocked: boolean;
  /** The reload we just came back from did not change the build. */
  reloadIneffective: boolean;
}

let lastBootIneffective = false;

export function useDeploymentSkew() {
  const snapshot = (): DeploymentSkewState => ({
    mismatch: mismatchDetected && !dismissed,
    serverVersion,
    frontendVersion: FRONTEND_DEPLOYMENT_VERSION,
    knownIds: [...serverKnownIds],
    reloadBlocked: reloadBlocked || reloadsRemaining() <= 0,
    reloadIneffective: lastBootIneffective,
  });

  const [state, setState] = useState<DeploymentSkewState>(snapshot);

  useEffect(() => {
    const handler = () => {
      setState(snapshot());
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
      pollBackoff = 1;
      const data = (await res.json()) as { version?: string; knownIds?: string[] };
      // `knownIds` is every identifier this deployment answers to (deployment
      // id, commit SHA, explicit version). Without it the frontend compared
      // one string against a build-time SHA and saw a permanent mismatch.
      recordServerVersion(data.version, data.knownIds);
    }

    // The header carries a single id, so it is only evidence *for* a match —
    // never overwrite the richer known-id set with it.
    const headerVersion = res.headers.get(DEPLOYMENT_HEADER);
    if (headerVersion) {
      recordServerVersion(headerVersion, serverKnownIds);
    }
  } catch {
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
    const wasFastPoll = pollInterval === POLL_INTERVAL_FAST;
    pollTimerRef.current = setTimeout(async () => {
      await checkDeployment();
      // Cap fast polling: a skew that survives ~10 min of 30s polls is not
      // going to resolve by polling harder — drop back to the normal
      // interval instead of requesting /api/deployment forever.
      if (wasFastPoll && pollInterval === POLL_INTERVAL_FAST) {
        fastPollCount += 1;
        if (fastPollCount >= MAX_FAST_POLLS) {
          fastPollCount = 0;
          pollInterval = POLL_INTERVAL_NORMAL;
          logger.warn(
            "[deploy-skew] Skew unresolved after extended fast polling — backing off to the normal interval."
          );
        }
      }
      scheduleNextPoll(); // Schedule next after completion
    }, interval);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Reconcile the reload we may have just come back from, and get the
    // cache-busting params out of the address bar before anything reads them
    // (analytics page_location, canonical tags, a user copying the URL).
    const boot = noteBoot(FRONTEND_DEPLOYMENT_VERSION);
    if (boot.reloaded) {
      lastBootIneffective = !boot.buildChanged;
      if (!boot.buildChanged) {
        // The reload did not deliver a new build — the service worker or the
        // edge cache answered again. Do not ask for another one.
        reloadBlocked = boot.remaining <= 0;
        logger.warn(
          "[deploy-skew] returned from a reload on the same build — standing down instead of reloading again.",
        );
      } else {
        logger.info(`[deploy-skew] reload delivered a new build (${boot.reason}).`);
      }
    }
    cleanReloadParams();

    // Clear refresh counter if versions match (successful previous refresh)
    clearRefreshCounter();


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
export function getServerKnownIds(): string[] { return [...serverKnownIds]; }
/** Test hook: forget everything learned about the server version. */
export function __resetSkewState(): void {
  serverVersion = null;
  serverKnownIds = [];
  mismatchDetected = false;
  refreshAttempted = false;
  dismissed = false;
  reloadBlocked = false;
  lastBootIneffective = false;
  pollInterval = POLL_INTERVAL_NORMAL;
  pollBackoff = 1;
  fastPollCount = 0;
}

// Type declaration for __DEPLOYMENT_VERSION__ injected at build time.
declare const __DEPLOYMENT_VERSION__: string | undefined;
