import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface FocusChartProps {
  data: Array<{ day: string; date: string; minutes: number }>;
}

export default function FocusChart({ data }: FocusChartProps) {
  return (
    <div className="h-56 w-full" aria-label="Weekly focus minutes chart" role="img">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="var(--border-subtle)" />
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--foreground-subtle)", fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--foreground-subtle)", fontSize: 10 }} />
          <Tooltip
            cursor={{ fill: "var(--surface-hover)" }}
            contentStyle={{ background: "var(--surface-overlay)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)", color: "var(--foreground)", boxShadow: "var(--shadow-lg)" }}
            labelStyle={{ color: "var(--foreground-muted)" }}
          />
          <Bar dataKey="minutes" name="Focus minutes" fill="var(--brand-500)" radius={[6, 6, 2, 2]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
