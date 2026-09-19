import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Trophy } from "lucide-react";
import { getToken } from "@/lib/auth";

interface Completion {
  id: string;
  userId: string;
  name: string;
  isMe: boolean;
  kind: "mission" | "quest";
  title: string;
  description: string | null;
  icon: string;
  xp: number;
  coins: number;
  type: string;
  at: string;
  minutesAgo: number;
}

function relative(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/**
 * "Who just finished what" — the announcement board for missions and quests.
 *
 * Competition needs a scoreboard, but it also needs *motion*: seeing that
 * someone else banked their session two minutes ago is what makes a learner
 * open the timer. The server assembles this from the real progress tables, so
 * nothing here can be fabricated or drift from what actually happened.
 *
 * The component polls every 60s while mounted — cheap, and it means a page left
 * open on a second monitor stays a live feed rather than a snapshot.
 */
export function CompletionFeed({ limit = 6, className = "" }: { limit?: number; className?: string }) {
  const [items, setItems] = useState<Completion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/social/completions", {
          headers: { Authorization: `Bearer ${getToken() ?? ""}` },
        });
        if (!res.ok) throw new Error("failed");
        const json = await res.json();
        if (!cancelled) { setItems(json.items ?? []); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  if (error) return null;
  if (!loaded) {
    return (
      <div className={`space-y-2 ${className}`} role="status" aria-label="Loading recent completions">
        {[0, 1, 2].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--surface-hover)]/50" />)}
      </div>
    );
  }

  const visible = items.slice(0, limit);

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
          <Trophy size={13} /> Just completed
        </p>
        <span className="flex items-center gap-1 text-[11px] text-[var(--foreground-subtle)]">
          <Flame size={11} className="text-[var(--color-warning)]" /> live
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-3 py-6 text-center text-xs text-[var(--foreground-subtle)]">
          Nobody has finished a mission in the last week. Be the first name on the board today.
        </p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {visible.map((c, i) => {
              const live = c.minutesAgo <= 10;
              return (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    c.isMe
                      ? "border-[var(--brand-strong)] bg-[var(--brand-soft)]"
                      : live
                        ? "border-[var(--success)]/40 bg-[var(--success-soft)]/40"
                        : "border-[var(--border-subtle)] bg-[var(--surface)]"
                  }`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-hover)] text-lg" aria-hidden="true">
                    {c.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                      {c.isMe ? "You" : c.name} · {c.title}
                    </p>
                    <p className="truncate text-[11px] text-[var(--foreground-subtle)]">
                      {c.kind === "mission" ? "Mission" : "Quest"} · +{c.xp} XP{c.coins > 0 ? ` · +${c.coins} 🪙` : ""}
                      {live && <span className="ml-1.5 font-semibold text-[var(--success)]">· new</span>}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-[var(--foreground-subtle)]">{relative(c.minutesAgo)}</span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--foreground-subtle)]">
        Completions are public for the last 7 days. Finish a mission and your name lands here too.
      </p>
    </div>
  );
}

export default CompletionFeed;
