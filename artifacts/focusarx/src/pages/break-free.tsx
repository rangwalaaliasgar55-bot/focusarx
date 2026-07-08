import { useState } from "react";
import { motion } from "framer-motion";
import { Flame, Wind, BookOpen, SmilePlus, MessageSquare } from "lucide-react";
import BreakFreeStreak from "@/components/break-free/BreakFreeStreak";
import UrgeSurfing from "@/components/break-free/UrgeSurfing";
import WhyItMatters from "@/components/break-free/WhyItMatters";
import MoodCheckin from "@/components/break-free/MoodCheckin";
import PledgeWall from "@/components/break-free/PledgeWall";
import { useBreakFreeAuthReady } from "@/hooks/useBreakFreeAuthReady";

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
  const { loading: authLoading } = useBreakFreeAuthReady();

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#7C3AED] mb-0.5">
            Digital Wellness
          </p>
          <h1 className="text-2xl font-black text-[#E2E8F0] leading-tight">
            Break Free
          </h1>
          <p className="text-xs text-[#4B5563] mt-1 leading-relaxed">
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
                  ? "bg-[rgba(124,58,237,0.2)] border border-[rgba(124,58,237,0.3)] text-[#A78BFA] shadow-[0_0_12px_rgba(124,58,237,0.15)]"
                  : "border border-transparent text-[#4B5563] hover:text-[#94A3B8] hover:bg-[rgba(124,58,237,0.08)]"
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
        {authLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.2)] border-t-[#7C3AED]" />
          </div>
        ) : (
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
        )}
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
