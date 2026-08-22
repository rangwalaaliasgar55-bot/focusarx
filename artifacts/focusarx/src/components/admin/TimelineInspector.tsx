"use client";

import type { FocusTimelinePoint } from "@/types/focus";

type Props = {
  timeline: FocusTimelinePoint[] | null;
  durationSec: number;
};

export function TimelineInspector({ timeline, durationSec }: Props) {
  const points = timeline ?? [];
  const maxT = Math.max(durationSec, ...points.map((p) => p.t), 1);

  if (points.length === 0) {
    return (
      <p className="text-sm text-[var(--palette-zinc-500)]">No timeline points recorded for this session.</p>
    );
  }

  const focusedSec = estimateFocusedSeconds(points, durationSec);

  return (
    <div className="space-y-4">
      <div className="flex h-8 overflow-hidden rounded-lg border border-[var(--palette-zinc-800)]">
        {buildSegments(points, maxT).map((seg, i) => (
          <div
            key={`${seg.state}-${seg.start}-${i}`}
            title={`${seg.state} · ${seg.start}s–${seg.end}s`}
            className={`h-full ${seg.state === "focus" ? "bg-[var(--palette-emerald-500)]/80" : "bg-[var(--palette-rose-500)]/70"}`}
            style={{ width: `${((seg.end - seg.start) / maxT) * 100}%` }}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        <Stat label="Points" value={String(points.length)} />
        <Stat
          label="Est. focused"
          value={`${Math.round((focusedSec / Math.max(durationSec, 1)) * 100)}%`}
        />
        <Stat label="Duration" value={`${durationSec}s`} />
      </div>

      <div className="max-h-48 overflow-auto rounded-lg border border-[var(--palette-zinc-800)]/80">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-[var(--palette-zinc-900)] text-[var(--palette-zinc-500)]">
            <tr>
              <th className="px-3 py-2 font-medium">t (sec)</th>
              <th className="px-3 py-2 font-medium">state</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={`${p.t}-${i}`} className="border-t border-[var(--palette-zinc-800)]/60">
                <td className="px-3 py-2 font-mono text-[var(--palette-zinc-300)]">{p.t}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      p.state === "focus"
                        ? "text-[var(--palette-emerald-400)]"
                        : "text-[var(--palette-rose-400)]"
                    }
                  >
                    {p.state}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--palette-zinc-900)]/60 px-2 py-2 ring-1 ring-[var(--palette-zinc-800)]/80">
      <p className="text-[var(--palette-zinc-500)]">{label}</p>
      <p className="mt-0.5 font-semibold text-[var(--palette-zinc-200)]">{value}</p>
    </div>
  );
}

function buildSegments(
  points: FocusTimelinePoint[],
  maxT: number
): { start: number; end: number; state: "focus" | "distracted" }[] {
  const segs: { start: number; end: number; state: "focus" | "distracted" }[] = [];
  for (let i = 0; i < points.length; i++) {
    const start = points[i].t;
    const end = i + 1 < points.length ? points[i + 1].t : maxT;
    if (end > start) segs.push({ start, end, state: points[i].state });
  }
  return segs;
}

function estimateFocusedSeconds(
  points: FocusTimelinePoint[],
  durationSec: number
): number {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i].state !== "focus") continue;
    const start = points[i].t;
    const end = i + 1 < points.length ? points[i + 1].t : durationSec;
    total += Math.max(0, end - start);
  }
  return total;
}
