import { useCallback, useSyncExternalStore } from "react";

/**
 * The current time, in a form React will not object to.
 *
 * Rendering `Date.now()` directly is impure: two renders with the same props
 * can disagree, and React is entitled to re-render whenever it likes. Putting
 * the read in an effect and mirroring it into state is the usual workaround,
 * but it costs a second render pass per tick and this codebase deliberately
 * has zero `set-state-in-effect` sites.
 *
 * `useSyncExternalStore` is the sanctioned escape hatch for exactly this — an
 * impure value that lives outside React. `getSnapshot` is allowed to read the
 * clock because React only calls it to check whether the store changed since
 * the last notification, and the value is cached in module scope so repeated
 * calls within one tick return an identical number (returning a fresh
 * `Date.now()` would make React think the store changed on every read, which
 * is an infinite render loop).
 *
 * One shared interval serves every subscriber, so a page with a dozen live
 * clocks still wakes the main thread once a second.
 */

let tick = Date.now();
const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function notify() {
  tick = Date.now();
  for (const listener of listeners) listener();
}

function subscribeToClock(onChange: () => void): () => void {
  listeners.add(onChange);
  if (intervalId === null) {
    // Refresh before starting the interval. `tick` was seeded at module import,
    // which may be minutes before the first component mounts (it is imported by
    // the timer, which is not the landing route) — without this, the first
    // subscriber would briefly render an "ends at" time from page load.
    // React re-reads the snapshot right after subscribing precisely to catch
    // this kind of correction, so the stale value never reaches the screen.
    tick = Date.now();
    intervalId = setInterval(notify, 1000);
  }
  return () => {
    listeners.delete(onChange);
    // Stop the clock when the last subscriber leaves — an idle tab should not
    // keep a wake-up scheduled.
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot(): number {
  return tick;
}

/**
 * Server/prerender value. `0` is not a real timestamp, which makes it
 * impossible to accidentally render "ends at 12:00 AM" into static HTML — any
 * consumer has to treat `0` as "unknown" explicitly.
 */
function getServerSnapshot(): number {
  return 0;
}

/**
 * `Date.now()` that updates once a second while `enabled`, and `null` when
 * disabled or before the first client tick.
 *
 * Disabled means "do not subscribe", so an idle timer page schedules nothing.
 */
export function useNow(enabled = true): number | null {
  const subscribe = useCallback(
    (onChange: () => void) => (enabled ? subscribeToClock(onChange) : () => {}),
    [enabled],
  );
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!enabled || value === 0) return null;
  return value;
}

/** Exposed for tests: how many live subscriptions the shared clock has. */
export const __clockSubscriptionCount = () => listeners.size;

export default useNow;
