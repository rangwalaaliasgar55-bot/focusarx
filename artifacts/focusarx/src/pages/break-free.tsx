import { useState } from "react";
import { motion } from "framer-motion";
import { Flame, Wind, BookOpen, SmilePlus, MessageSquare } from "lucide-react";
import BreakFreeStreak from "@/components/break-free/BreakFreeStreak";
import UrgeSurfing from "@/components/break-free/UrgeSurfing";
import WhyItMatters from "@/components/break-free/WhyItMatters";
import MoodCheckin from "@/components/break-free/MoodCheckin";
import PledgeWall from "@/components/break-free/PledgeWall";

const TABS = [
  { id: "streak",  label: "Streak",   icon: Flame },
  { id: "urge",    label: "Urge Tool", icon: Wind },
  { id: "mood",    label: "Mood",      icon: SmilePlus },
  { id: "why",     label: "Science",   icon: BookOpen },
  { id: "pledges", label: "Pledges",   icon: MessageSquare },
] as const;

type TabId = typeof TABS[number]["id"];

export default function BreakFreePage() {
  const [tab, setTab] = useState<TabId>("streak");

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: "linear-gradient(160deg, #030e10 0%, #020c0e 60%, #030810 100%)" }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-teal-700 mb-0.5">
            Digital Wellness
          </p>
          <h1 className="text-2xl font-black text-teal-100 leading-tight">
            Break Free
          </h1>
          <p className="text-xs text-teal-700 mt-1 leading-relaxed">
            Science-backed. Zero shame. One day at a time.
          </p>
        </motion.div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
                active
                  ? "bg-teal-900/40 border border-teal-500/25 text-teal-200 shadow-[0_0_12px_rgba(45,212,191,0.12)]"
                  : "border border-transparent text-teal-800 hover:text-teal-600 hover:bg-teal-900/15"
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {tab === "streak"  && <BreakFreeStreak />}
          {tab === "urge"    && <UrgeSurfing />}
          {tab === "mood"    && <MoodCheckin />}
          {tab === "why"     && <WhyItMatters />}
          {tab === "pledges" && <PledgeWall />}
        </motion.div>
      </div>

      {/* Footer note */}
      <div className="px-4 py-4 text-center">
        <p className="text-[10px] text-[#0e2020] leading-relaxed">
          All data is private and stored securely. Camera processing used elsewhere in FocusArx
          is completely separate from this module.
        </p>
      </div>
    </div>
  );
}
