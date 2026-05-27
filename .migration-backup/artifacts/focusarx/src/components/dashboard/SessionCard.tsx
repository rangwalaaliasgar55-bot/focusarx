"use client";

import { motion } from "framer-motion";
import type { FocusQuality, FocusTimelinePoint, SessionInsights } from "@/types/focus";
import { FocusTimelineBar } from "./FocusTimelineBar";

export type DashboardSession = {
  id: string;
  mode: string;
  durationSec: number;
  completedAt: Date;
  focusScore: number | null;
  focusQuality: string | null;
  stabilityRating: string | null;
  focusTimeline: FocusTimelinePoint[] | null;
  sessionInsights: SessionInsights | null;
};

const qualityStyles: Record<FocusQuality, string> = {
  high: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

export function SessionCard({ session }: { session: DashboardSession }) {
  const quality = (session.focusQuality as FocusQuality | null) ?? null;
  const date = new Date(session.completedAt);
  const mins = Math.round(session.durationSec / 60);

  return (
    <motion.article
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-lg backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500">
            {date.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}{" "}
            · {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-100">
            {mins} min <span className="text-sm font-normal text-zinc-500">focus</span>
          </p>
        </div>
        {session.focusScore != null && (
          <div className="text-right">
            <div className="text-2xl font-semibold text-zinc-100">{session.focusScore}</div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">score</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {quality && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${qualityStyles[quality]}`}
          >
            {quality} quality
          </span>
        )}
        {session.stabilityRating && (
          <span className="rounded-full border border-zinc-700 bg-zinc-800/50 px-2 py-0.5 text-[10px] text-zinc-400">
            {session.stabilityRating}
          </span>
        )}
      </div>

      {session.focusTimeline && session.focusTimeline.length > 0 && (
        <div className="mt-3">
          <FocusTimelineBar timeline={session.focusTimeline} />
        </div>
      )}

      {session.sessionInsights?.summary && (
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">
          {session.sessionInsights.summary}
        </p>
      )}
    </motion.article>
  );
}
