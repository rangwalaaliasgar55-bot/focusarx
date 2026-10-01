import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useNow } from "@/hooks/useNow";

type ActiveSessionRow = {
  mode: string;
  secondsLeft: number | null;
  timerStatus: string | null;
  updatedAt: string;
} | null;

const POLL_MS = 15_000;

/**
 * Floating mini-timer (audit H3): while a focus block is running on the home
 * page, users who wander to another route still see a live countdown and can
 * jump back in one click. Reads the same persisted active-session row the
 * Timer syncs to the server, so it never desyncs.
 */
export default function FloatingTimer() {
  const { status } = useAuth();
  const [location, navigate] = useLocation();

  const query = useQuery<{ session: ActiveSessionRow }>({
    queryKey: ["active-session-pill"],
    queryFn: () => apiJson<{ session: ActiveSessionRow }>("/api/sessions/active"),
    enabled: status === "authenticated",
    refetchInterval: POLL_MS,
    staleTime: 10_000,
    retry: false,
  });

  // The shared 1 Hz clock. Interpolating the countdown needs a wall-clock read,
  // and reading `Date.now()` in render is impure; `useNow` is the sanctioned
  // `useSyncExternalStore` wrapper for exactly this and is already what the rest
  // of the timer uses for its "ends at" label. It also replaces the local
  // `setInterval` this component used to run just to force a re-render.
  const now = useNow(true);

  if (status !== "authenticated" || location === "/" || query.isError) return null;

  const session = query.data?.session;
  if (!session || session.mode !== "focus" || session.timerStatus !== "running") return null;

  // Interpolate remaining time from the last server checkpoint. This used to be
  // a `useState` initialiser on the theory that the component "remounts with the
  // session row" — it does not (`AuthenticatedChrome` renders it with no `key`),
  // and a lazy initialiser runs *before* the query has resolved anyway, so
  // `driftedMs` was frozen at Number.MAX_SAFE_INTEGER for the life of the
  // component. The pill then failed the staleness test on every route and never
  // rendered at all. Hidden for the single tick before the clock is available
  // rather than shown with a wrong number.
  const rowMs = new Date(session.updatedAt).getTime();
  const driftedMs = now === null || Number.isNaN(rowMs) ? Number.MAX_SAFE_INTEGER : now - rowMs;
  if (driftedMs > 2 * 60 * 60 * 1000) return null; // stale row — ignore
  const remaining = Math.round((session.secondsLeft ?? 0) - driftedMs / 1000);
  if (remaining <= 0) return null;

  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");

  return (
    <AnimatePresence>
      <motion.button
        key="floating-timer"
        type="button"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={() => navigate("/")}
        aria-label={`Focus session running — ${Math.ceil(remaining / 60)} minutes left. Return to session`}
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 z-[var(--z-nav)] flex items-center gap-2 rounded-full border border-[var(--palette-violet-500)]/35 bg-[var(--palette-violet-500)]/12 px-3.5 py-2 text-xs font-bold text-[var(--palette-a5a8ff)] shadow-lg transition-transform md:bottom-5"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--palette-violet-400)] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--palette-violet-400)]" />
        </span>
        <span className="font-mono tabular-nums">{mm}:{ss}</span>
        <span className="hidden sm:inline font-semibold">Focus running</span>
      </motion.button>
    </AnimatePresence>
  );
}
