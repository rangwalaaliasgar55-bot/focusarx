"use client";

import type { FocusTimelinePoint } from "@/types/focus";

export function FocusTimelineBar({ timeline }: { timeline: FocusTimelinePoint[] }) {
  if (!timeline.length) {
    return (
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-zinc-800/50">
        <div className="h-full flex-1 bg-zinc-700/40" title="No timeline data" />
      </div>
    );
  }

  const expanded: ("focus" | "distracted")[] = [];
  for (let i = 0; i < timeline.length; i++) {
    const cur = timeline[i];
    const nextT = timeline[i + 1]?.t ?? cur.t + 15;
    const segments = Math.max(1, Math.min(8, nextT - cur.t));
    for (let s = 0; s < segments; s++) {
      expanded.push(cur.state);
    }
  }

  const bars = expanded.slice(0, 24);

  return (
    <div
      className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-zinc-800/50"
      title="Focus timeline: green = focused, dim = distracted"
    >
      {bars.map((state, i) => (
        <div
          key={i}
          className={`h-full min-w-[4px] flex-1 rounded-sm ${
            state === "focus" ? "bg-emerald-400/90" : "bg-zinc-600/80"
          }`}
        />
      ))}
    </div>
  );
}
