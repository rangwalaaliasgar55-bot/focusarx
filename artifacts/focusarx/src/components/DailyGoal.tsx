import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useSessionHistory } from "@/hooks/useSessionHistory";

const GOAL_KEY = "focusarx-daily-goal-minutes";

function Ring({ pct, size, stroke, color }: { pct: number; size: number; stroke: number; color: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(124,58,237,0.1)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </svg>
  );
}

export default function DailyGoal() {
  const { sessions } = useSessionHistory();
  const [goalStr, setGoalStr] = useState<string>(() => localStorage.getItem(GOAL_KEY) ?? "120");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const goalMinutes = parseInt(goalStr) || 120;

  const focusMinutesToday = useMemo(() => {
    const today = new Date().toDateString();
    return sessions
      .filter(s => s.mode === "focus" && new Date(s.completedAt).toDateString() === today)
      .reduce((sum, s) => sum + Math.round(s.durationSeconds / 60), 0);
  }, [sessions]);

  const pct = goalMinutes > 0 ? (focusMinutesToday / goalMinutes) * 100 : 0;
  const isComplete = pct >= 100;

  const color = isComplete ? "#4ADE80" : pct >= 60 ? "#F59E0B" : "#7C3AED";

  const startEdit = () => {
    setDraft(goalStr);
    setEditing(true);
  };

  const commitEdit = () => {
    const v = parseInt(draft);
    if (!isNaN(v) && v > 0) {
      localStorage.setItem(GOAL_KEY, String(v));
      setGoalStr(String(v));
    }
    setEditing(false);
  };

  const fmtTime = (min: number) => {
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  return (
    <div className="rounded-2xl border border-[#1e2130] bg-[#111318] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4a4f62]">Daily Goal</p>
        {!editing && (
          <button
            onClick={startEdit}
            className="text-[10px] text-[#4B5563] hover:text-[#A78BFA] transition-colors"
          >
            {isComplete ? "🎉 done" : "edit"}
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <Ring pct={pct} size={68} stroke={6} color={color} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs font-black text-[#e8eaf0] leading-none">
              {Math.min(Math.round(pct), 100)}%
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {isComplete ? (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-bold text-[#4ADE80]"
            >
              Goal smashed! 🎉
            </motion.p>
          ) : (
            <p className="text-xs font-semibold text-[#e8eaf0]">
              {fmtTime(focusMinutesToday)}{" "}
              <span className="font-normal text-[#4a4f62]">of {fmtTime(goalMinutes)}</span>
            </p>
          )}
          {!isComplete && (
            <p className="text-[10px] text-[#4a4f62] mt-0.5">
              {focusMinutesToday === 0
                ? "Start your first session!"
                : `${fmtTime(Math.max(0, goalMinutes - focusMinutesToday))} to go`}
            </p>
          )}

          {editing ? (
            <div className="mt-2 flex items-center gap-1.5">
              <input
                autoFocus
                type="number"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
                placeholder="minutes"
                className="w-20 rounded-lg border border-[rgba(124,58,237,0.3)] bg-transparent px-2 py-1 text-xs text-[#A78BFA] focus:outline-none"
              />
              <span className="text-[10px] text-[#4B5563]">min</span>
              <button onClick={commitEdit} className="text-[10px] text-[#7C3AED] hover:text-[#A78BFA]">Save</button>
            </div>
          ) : (
            <div className="mt-2 h-1.5 rounded-full bg-[#1e2130] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(pct, 100)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
