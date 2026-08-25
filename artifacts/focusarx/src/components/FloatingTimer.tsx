import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth";

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
  const [, forceTick] = useState(0);

  const query = useQuery<{ session: ActiveSessionRow }>({
    queryKey: ["active-session-pill"],
    queryFn: () => apiJson<{ session: ActiveSessionRow }>("/api/sessions/active"),
    enabled: status === "authenticated",
    refetchInterval: POLL_MS,
    staleTime: 10_000,
    retry: false,
  });

  // Re-render every second so the interpolated countdown ticks smoothly.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  if (status !== "authenticated" || location === "/" || query.isError) return null;

  const session = query.data?.session;
  if (!session || session.mode !== "focus" || session.timerStatus !== "running") return null;

  // Interpolate remaining time from the last server checkpoint.
  const driftedMs = Date.now() - new Date(session.updatedAt).getTime();
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
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 z-[var(--z-nav)] flex items-center gap-2 rounded-full border border-[var(--palette-violet-500)]/35 bg-[var(--palette-violet-500)]/12 px-3.5 py-2 text-xs font-bold text-[var(--palette-a5a8ff)] shadow-lg shadow-[var(--palette-black)]/40 backdrop-blur-xl transition-transform hover:scale-[1.03] md:bottom-5"
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
