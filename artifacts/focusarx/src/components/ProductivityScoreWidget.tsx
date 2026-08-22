import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

async function fetchProductivity() {
  const token = getToken();
  const res = await fetch("/api/stats/productivity", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  return res.json();
}

export default function ProductivityScoreWidget() {
  const { data } = useQuery({ queryKey: ["productivity-score"], queryFn: fetchProductivity, staleTime: 120_000 });

  if (!data) return null;

  const score = data.productivityScore ?? 0;
  const trend = data.trend ?? 0;
  const scoreColor = score >= 80 ? "var(--palette-22d387)" : score >= 60 ? "var(--color-warning)" : "var(--palette-f87171)";
  const TrendIcon = trend > 5 ? TrendingUp : trend < -5 ? TrendingDown : Minus;
  const trendColor = trend > 5 ? "var(--palette-22d387)" : trend < -5 ? "var(--palette-f87171)" : "var(--palette-5a5f72)";
  const arcProgress = Math.min(100, score) / 100;
  const circumference = 2 * Math.PI * 28;
  const strokeDashoffset = circumference * (1 - arcProgress);

  return (
    <div className="rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)] mb-3">Productivity Score</p>
      <div className="flex items-center gap-4">
        <div className="relative flex items-center justify-center">
          <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
            <circle cx="36" cy="36" r="28" fill="none" stroke="var(--rgba-255-255-255-0_08)" strokeWidth="6" />
            <circle
              cx="36" cy="36" r="28" fill="none"
              stroke={scoreColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 0.8s ease" }}
            />
          </svg>
          <span className="absolute text-base font-black" style={{ color: scoreColor }}>{Math.round(score)}</span>
        </div>
        <div className="flex-1">
          <p className="text-xs text-[var(--foreground-subtle)] mb-1">
            {score >= 80 ? "🔥 Elite performance" : score >= 60 ? "📈 On track" : "⚠️ Needs focus"}
          </p>
          <div className="flex items-center gap-1.5">
            <TrendIcon size={12} style={{ color: trendColor }} />
            <span className="text-[11px]" style={{ color: trendColor }}>
              {trend > 0 ? `+${trend}` : trend} vs last week
            </span>
          </div>
          {data.focusMinutesToday > 0 && (
            <p className="text-[10px] text-[var(--foreground-subtle)] mt-1">{data.focusMinutesToday}m focused today</p>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {[
          { label: "Sessions", value: data.sessionsToday ?? 0, suffix: "" },
          { label: "Avg Focus", value: data.avgFocusScore ? `${Math.round(data.avgFocusScore)}%` : "—", suffix: "" },
          { label: "Streak", value: data.currentStreak ?? 0, suffix: "d 🔥" },
        ].map(m => (
          <div key={m.label} className="rounded-lg bg-[var(--rgba-255-255-255-0_04)] border border-[var(--rgba-255-255-255-0_06)] px-2 py-1.5 text-center">
            <p className="text-xs font-bold text-[var(--foreground)]">{m.value}{m.suffix}</p>
            <p className="text-[9px] text-[var(--foreground-subtle)] mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
