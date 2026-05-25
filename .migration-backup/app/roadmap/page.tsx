"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { aiRoadmapSchema } from "@/lib/validators";

type RoadmapDay = {
  day: number;
  focusSessions: string[];
  tasks: string[];
  estimatedTime: number;
};

export default function RoadmapPage() {
  const { status: authStatus } = useSession();

  const [goal, setGoal] = useState("Ship a production-ready SaaS MVP");
  const [dailyHours, setDailyHours] = useState(2);
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">(
    "intermediate"
  );
  const [deadline, setDeadline] = useState("");
  const [currentProgress, setCurrentProgress] = useState(
    "Timer engine + auth baseline in place"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapDay[] | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(1);

  const validPayload = useMemo(
    () => ({
      goal,
      dailyHours,
      level,
      deadline: deadline || undefined,
      currentProgress: currentProgress || undefined,
    }),
    [goal, dailyHours, level, deadline, currentProgress]
  );

  const sessionReady = authStatus === "authenticated";

  async function generate() {
    setError(null);
    const parsed = aiRoadmapSchema.safeParse(validPayload);
    if (!parsed.success) {
      const msg = parsed.error.issues
        .map((i) => `${i.path.join(".") || "form"}: ${i.message}`)
        .join(" · ");
      setError(msg || "Please check your inputs.");
      return;
    }
    if (!sessionReady) {
      setError(
        "Still connecting your session. Wait a moment, then try again — or refresh the page."
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/roadmap", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        roadmap?: RoadmapDay[];
      };
      if (!res.ok) {
        if (res.status === 401) {
          setError(
            "Not signed in yet. Wait a few seconds and try again, or refresh the page so guest sign-in can finish."
          );
        } else {
          setError(
            typeof data.error === "string"
              ? data.error
              : `Could not generate roadmap (${res.status}).`
          );
        }
        setRoadmap(null);
        return;
      }
      const days = Array.isArray(data.roadmap) ? data.roadmap : [];
      if (days.length === 0) {
        setError("The server returned an empty roadmap. Please try again.");
        setRoadmap(null);
        return;
      }
      setRoadmap(days);
      setOpenDay(1);
    } catch {
      setError("Network error — is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        <div className="absolute -left-24 top-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.28),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.18),transparent_70%)] blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
              Focusarx
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              AI study roadmap
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-full border border-zinc-700/60 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-300 backdrop-blur-sm transition-colors hover:border-zinc-600 hover:text-white"
          >
            ← Timer
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
          <motion.aside
            layout
            className="h-fit rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-2xl backdrop-blur-2xl"
          >
            <h2 className="text-sm font-semibold text-zinc-200">Plan inputs</h2>
            <p className="mt-1 text-xs text-zinc-500">
              We will shape Pomodoro-sized blocks to match your day.
            </p>

            {authStatus === "loading" && (
              <p className="mt-3 text-xs text-amber-200/90">
                Connecting your session…
              </p>
            )}
            {authStatus === "unauthenticated" && (
              <p className="mt-3 text-xs text-amber-200/90">
                Signing you in as a guest… If this stays stuck, refresh the page.
              </p>
            )}

            <label className="mt-5 block text-xs font-medium text-zinc-400">
              Goal
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
                className="mt-1.5 w-full resize-none rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 outline-none ring-sky-500/40 focus:ring-2"
              />
            </label>

            <label className="mt-4 block text-xs font-medium text-zinc-400">
              Daily hours
              <input
                type="number"
                min={0.5}
                max={12}
                step={0.25}
                value={dailyHours}
                onChange={(e) => setDailyHours(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 outline-none ring-sky-500/40 focus:ring-2"
              />
            </label>

            <label className="mt-4 block text-xs font-medium text-zinc-400">
              Level
              <select
                value={level}
                onChange={(e) =>
                  setLevel(e.target.value as typeof level)
                }
                className="mt-1.5 w-full rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 outline-none ring-sky-500/40 focus:ring-2"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>

            <label className="mt-4 block text-xs font-medium text-zinc-400">
              Deadline (optional)
              <input
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                placeholder="e.g. June 30"
                className="mt-1.5 w-full rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 outline-none ring-sky-500/40 focus:ring-2"
              />
            </label>

            <label className="mt-4 block text-xs font-medium text-zinc-400">
              Current progress
              <textarea
                value={currentProgress}
                onChange={(e) => setCurrentProgress(e.target.value)}
                rows={2}
                className="mt-1.5 w-full resize-none rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 outline-none ring-sky-500/40 focus:ring-2"
              />
            </label>

            <motion.button
              type="button"
              disabled={loading || authStatus === "loading"}
              onClick={() => void generate()}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "AI is planning your success…" : "Generate roadmap"}
            </motion.button>

            <button
              type="button"
              disabled={loading || authStatus === "loading"}
              onClick={() => void generate()}
              className="mt-3 w-full text-center text-xs text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline disabled:opacity-50"
            >
              Regenerate
            </button>

            {error && (
              <p className="mt-3 text-xs text-rose-400" role="alert">
                {error}
              </p>
            )}
          </motion.aside>

          <section className="space-y-4">
            <AnimatePresence mode="wait">
              {loading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-2xl border border-dashed border-zinc-700/70 bg-zinc-950/30 px-6 py-10 text-center text-sm text-zinc-400 backdrop-blur-xl"
                >
                  <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-400" />
                  AI is planning your success…
                </motion.div>
              )}
            </AnimatePresence>

            {!loading && roadmap !== null && roadmap.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {roadmap.map((day) => {
                  const open = openDay === day.day;
                  const progress = Math.min(
                    1,
                    day.focusSessions.length
                      ? day.estimatedTime / (day.focusSessions.length * 50)
                      : 0.5
                  );
                  return (
                    <motion.article
                      key={day.day}
                      layout
                      className="overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-xl backdrop-blur-2xl"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenDay(open ? null : day.day)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/5"
                      >
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                            Week plan
                          </p>
                          <h3 className="text-lg font-semibold text-zinc-50">
                            Day {day.day}
                          </h3>
                        </div>
                        <span className="text-xs text-zinc-500">
                          {open ? "Hide" : "Expand"}
                        </span>
                      </button>
                      <div className="px-5 pb-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress * 100}%` }}
                            transition={{ type: "spring", stiffness: 120, damping: 20 }}
                          />
                        </div>
                        <p className="mt-1 text-right text-[11px] text-zinc-500">
                          ~{day.estimatedTime} min planned
                        </p>
                      </div>
                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.28, ease: "easeInOut" }}
                            className="border-t border-zinc-800/60"
                          >
                            <div className="space-y-4 px-5 py-4 text-sm text-zinc-300">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                                  Focus sessions
                                </p>
                                <ul className="mt-2 list-disc space-y-1 pl-4">
                                  {day.focusSessions.map((s) => (
                                    <li key={s}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                                  Tasks
                                </p>
                                <ul className="mt-2 list-disc space-y-1 pl-4">
                                  {day.tasks.map((t) => (
                                    <li key={t}>{t}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.article>
                  );
                })}
              </motion.div>
            )}

            {!loading && (roadmap === null || roadmap.length === 0) && (
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/30 px-6 py-12 text-center text-sm text-zinc-500 backdrop-blur-xl">
                {authStatus === "authenticated"
                  ? "Generate a roadmap to see your week unfold here."
                  : "Once your session is connected, generate a roadmap to see it here."}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
