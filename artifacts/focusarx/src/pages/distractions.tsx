import { useEffect, useState } from "react";
import { PageTransition } from "@/components/PageTransition";
import { BookOpen, TrendingDown } from "lucide-react";
import { getToken } from "@/lib/auth";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type ReasonEntry = { reason: string; count: number };
type HourEntry = { hour: number; label: string; count: number };
type PatternsData = {
  reasonData: ReasonEntry[];
  hourData: HourEntry[];
  total: number;
  notWorthItPct: number;
};
type NudgeData = { showNudge: boolean; message: string | null };

const Tip = ({ text }: { text: string }) => (
  <div className="rounded-2xl border border-[rgba(255,184,0,0.25)] bg-[rgba(255,184,0,0.05)] px-4 py-3 text-sm text-[#FFB800]">
    💡 {text}
  </div>
);

export default function DistractionsPage() {
  const [data, setData] = useState<PatternsData | null>(null);
  const [nudge, setNudge] = useState<NudgeData | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = (): HeadersInit => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/distractions/patterns", { headers: headers() }).then(r => r.ok ? r.json() : null),
      fetch("/api/distractions/nudge", { headers: headers() }).then(r => r.ok ? r.json() : null),
    ]).then(([p, n]: [PatternsData | null, NudgeData | null]) => {
      setData(p);
      setNudge(n);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const peakHour = data?.hourData.reduce((best, h) => h.count > best.count ? h : best, { hour: 0, label: "—", count: 0 });

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        <PageTransition>
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#4B5563]">Self-awareness</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#E2E8F0] sm:text-3xl">
              <BookOpen size={22} className="text-[#A78BFA]" /> Distraction Patterns
            </h1>
          </header>

          {loading && (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
            </div>
          )}

          {!loading && data && (
            <div className="space-y-6">
              {nudge?.showNudge && nudge.message && <Tip text={nudge.message} />}

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Total logged", value: data.total, color: "#A78BFA" },
                  { label: "Not worth it", value: `${data.notWorthItPct}%`, color: "#F97316" },
                  { label: "Peak hour", value: peakHour?.count ? `${peakHour.hour}:00` : "—", color: "#60A5FA" },
                ].map(c => (
                  <div key={c.label} className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4 text-center backdrop-blur-xl">
                    <p className="text-[9px] uppercase tracking-wider text-[#4B5563]">{c.label}</p>
                    <p className="mt-1 text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
                  </div>
                ))}
              </div>

              {data.reasonData.length > 0 && (
                <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-6 backdrop-blur-xl">
                  <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#E2E8F0]">
                    <TrendingDown size={14} className="text-[#F97316]" /> By category
                  </h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.reasonData} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.08)" />
                      <XAxis dataKey="reason" tick={{ fill: "#4B5563", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#4B5563", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "rgba(12,17,40,0.95)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 12, fontSize: 12, color: "#E2E8F0" }}
                        cursor={{ fill: "rgba(124,58,237,0.05)" }}
                      />
                      <Bar dataKey="count" fill="#F97316" radius={[4, 4, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-6 backdrop-blur-xl">
                <h2 className="mb-5 text-sm font-semibold text-[#E2E8F0]">By time of day</h2>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={data.hourData.filter(h => h.count > 0 || h.hour % 3 === 0)} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.08)" />
                    <XAxis dataKey="hour" tickFormatter={h => `${h}h`} tick={{ fill: "#4B5563", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#4B5563", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: number) => [v, "distractions"]}
                      labelFormatter={l => `${l}:00`}
                      contentStyle={{ background: "rgba(12,17,40,0.95)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 12, fontSize: 12, color: "#E2E8F0" }}
                      cursor={{ fill: "rgba(124,58,237,0.05)" }}
                    />
                    <Bar dataKey="count" fill="#7C3AED" radius={[3, 3, 0, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {data.total === 0 && (
                <p className="text-center text-sm text-[#4B5563] py-8">
                  No distractions logged yet. They'll appear here after you complete focus sessions.
                </p>
              )}
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
