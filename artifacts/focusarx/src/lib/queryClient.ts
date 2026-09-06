import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

/**
 * The single React Query client for the whole app.
 *
 * It lives in its own module (rather than inside App.tsx) so that non-component
 * code — the auth provider in particular — can act on the cache. The one thing
 * it must be able to do is `clear()`: see `clearSessionCache`.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => window.dispatchEvent(new CustomEvent("focusarx:api-error", { detail: { message: error instanceof Error ? error.message : "Unable to load data." } })),
  }),
  mutationCache: new MutationCache({
    onError: (error) => window.dispatchEvent(new CustomEvent("focusarx:api-error", { detail: { message: error instanceof Error ? error.message : "Unable to save your changes." } })),
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const err = error as { status?: number; message?: string } | null;
        if (err?.status === 401 || err?.status === 403) return false;
        if (err?.message?.includes("401") || err?.message?.includes("403")) return false;
        return failureCount < 2;
      },
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      // Live data arrives over Socket.IO, and stale queries refetch on mount,
      // so re-hammering every endpoint on each window focus was pure waste.
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

/**
 * Drop every cached server response.
 *
 * Signing out used to clear the token and the auth context but leave the query
 * cache — tasks, sessions, wallet, DMs, the lot — fully populated. Anyone who
 * then signed in as a *different* account on the same device saw the previous
 * user's data rendered on screen until each query refetched, and a query that
 * was already fresh never refetched at all (`staleTime` 60 s). On a shared
 * laptop or a parent's phone that is a data leak, not a cosmetic glitch.
 *
 * Called on sign-out, on account deletion and after a password change, i.e.
 * wherever the browser stops owning one identity and starts owning another.
 */
export function clearSessionCache(): void {
  try {
    queryClient.clear();
  } catch {
    // A cache that refuses to clear must never break sign-out.
  }
}
