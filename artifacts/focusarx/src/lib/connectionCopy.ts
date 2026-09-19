import type { NetworkStatus } from "@/hooks/useNetworkStatus";

/**
 * One voice for connection failures.
 *
 * The app had two error surfaces — `ErrorState` (7 pages) and `QueryError`
 * (19 pages) — and they disagreed about the same event. `ErrorState` read
 * `navigator.onLine` at render time and, when offline, said "You're offline /
 * Reconnect to load this view — nothing you did will be lost." `QueryError`
 * said "Check your connection, then try again" whether or not the user was
 * offline, and never mentioned that offline work is queued. The status was
 * also read once, at render: when the connection came back the message stayed
 * stale, because nothing re-rendered.
 *
 * Both now take the live status from `useNetworkStatus` — which already knew
 * about "slow" connections and had exactly two consumers — and both get their
 * wording here, so the language cannot drift apart again. A user who is
 * genuinely offline is told so, and told that their queued work is safe; a
 * user on a 2G link is told the connection, not their data, is the problem.
 *
 * Returns null when the connection is not the explanation: the caller then
 * uses its own title and message, which is the case the wording above was
 * originally written for (a request that failed for some other reason).
 */
export type ErrorCopy = { title: string; message: string; action: string };

export function networkNotice(
  status: NetworkStatus,
  variant: "inline" | "page",
): ErrorCopy | null {
  if (status === "offline") {
    return {
      title: "You're offline",
      message:
        variant === "page"
          ? "Reconnect to load this view — nothing you did will be lost."
          : "Reconnect and this will load on its own.",
      action: "Reconnect",
    };
  }

  if (status === "slow") {
    return {
      title: "Your connection is slow",
      message:
        "The request didn't complete. On a slow connection this is usually worth one more try.",
      action: "Try again",
    };
  }

  return null;
}
