/**
 * Cross-tab timer leader election (Phase 5.3 TIMER fix).
 *
 * `crossTabSync` only *announces* timer events — nothing stopped two tabs
 * from running two timers and double-submitting sessions (saved from double
 * rewards only by the `clientNonce` backstop). This module elects a single
 * leader tab while a timer runs:
 *
 * - Modern browsers: `navigator.locks` (`ifAvailable`) — the lock is held by
 *   the leader and auto-releases if the tab crashes or closes, so there are
 *   no stale leaders and no heartbeat protocol to get wrong.
 * - Older browsers (no `navigator.locks`, e.g. legacy WebViews): announce
 *   via `BroadcastChannel` and grant locally. Enforcement is best-effort
 *   there; the server-side `clientNonce` idempotency remains the backstop.
 */

const LEAD_LOCK_NAME = "focusarx-timer-leader";
const ANNOUNCE_CHANNEL = "focusarx-timer";

export interface LeadGrant {
  acquired: boolean;
  release: () => void;
}

function announce(tabId: string): void {
  try {
    const ch = new BroadcastChannel(ANNOUNCE_CHANNEL);
    ch.postMessage({ type: "leader", payload: { tabId }, timestamp: Date.now(), tabId });
    ch.close();
  } catch {
    /* BroadcastChannel unavailable — ignore */
  }
}

function broadcastGrant(tabId: string): LeadGrant {
  announce(tabId);
  let released = false;
  return {
    acquired: true,
    release() {
      if (released) return;
      released = true;
      try {
        const ch = new BroadcastChannel(ANNOUNCE_CHANNEL);
        ch.postMessage({ type: "resign", payload: { tabId }, timestamp: Date.now(), tabId });
        ch.close();
      } catch {
        /* ignore */
      }
    },
  };
}

/**
 * Try to become the timer leader. Resolves `acquired:false` when another tab
 * already leads. The grant MUST be released when the timer leaves `running`
 * (pause/reset/complete/unmount) — the hook owns that lifecycle.
 */
export function acquireTimerLead(tabId?: string): Promise<LeadGrant> {
  const id =
    tabId ?? `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return new Promise((resolve) => {
    const locks =
      typeof navigator !== "undefined"
        ? (navigator as Navigator & { locks?: LockManager }).locks
        : undefined;
    if (!locks?.request) {
      resolve(broadcastGrant(id));
      return;
    }
    let settled = false;
    let releaser: (() => void) | null = null;
    const done = (grant: LeadGrant) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(grant);
    };
    // If the locks implementation hangs, degrade to announce-only rather
    // than wedging the timer start path.
    const timer = window.setTimeout(() => done(broadcastGrant(id)), 800);
    try {
      void locks
        .request(LEAD_LOCK_NAME, { ifAvailable: true }, (lock) => {
          if (!lock) {
            done({ acquired: false, release() {} });
            return;
          }
          done({
            acquired: true,
            release() {
              releaser?.();
            },
          });
          // Hold the lock until the owner releases (or the tab dies, which
          // releases it automatically — no stale leaders possible).
          return new Promise<void>((res) => {
            releaser = res;
          });
        })
        .catch(() => done(broadcastGrant(id)));
    } catch {
      done(broadcastGrant(id));
    }
  });
}
