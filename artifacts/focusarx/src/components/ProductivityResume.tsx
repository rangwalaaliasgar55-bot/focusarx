import { motion } from "framer-motion";
import { Award, Clock, Zap, Target, TrendingUp, Download, Share2 } from "lucide-react";
import { STAGGER, STAGGER_CHILD } from "@/lib/animations";

interface ProductivityResumeProps {
  userName: string;
  totalFocusHours: number;
  avgFocusScore: number;
  rank: string;
  streak: number;
  topMode: string;
}

export default function ProductivityResume({
  userName,
  totalFocusHours,
  avgFocusScore,
  rank,
  streak,
  topMode,
}: ProductivityResumeProps) {
  const shareToX = () => {
    const text = `I've reached ${rank} on @FocusArx! 🚀\n\nTotal Volume: ${totalFocusHours}h\nFocus Depth: ${avgFocusScore}%\nStreak: ${streak} Days\n\nLevel up your productivity at https://focusarx.site`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="rounded-3xl border border-[var(--palette-white)]/10 bg-[var(--palette-zinc-950)] p-8 shadow-2xl relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 h-64 w-64 rounded-full bg-[var(--palette-purple-600)]/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-[var(--palette-blue-600)]/10 blur-3xl" />

      <div className="relative z-[var(--z-content)]">
        <header className="flex justify-between items-start mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <div className="h-6 w-6 rounded bg-gradient-to-br from-[var(--brand-600)] to-[var(--brand-pink)]" />
               <span className="text-xs font-black uppercase tracking-[0.3em] text-[var(--foreground-subtle)]">FocusArx Certificate</span>
            </div>
            <h2 className="text-3xl font-black text-[var(--palette-white)]">{userName}</h2>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">Academic Discipline Summary</p>
          </div>
          <div className="text-right">
             <span className="rounded-full border border-[var(--brand-400)]/30 bg-[var(--brand-400)]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--brand-400)]">
               {rank}
             </span>
          </div>
        </header>

        <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: "Focus Depth", value: `${avgFocusScore}%`, icon: <Target size={14} />, color: "text-[var(--brand-400)]" },
            { label: "Total Volume", value: `${totalFocusHours}h`, icon: <Clock size={14} />, color: "text-[var(--info)]" },
            { label: "Current Streak", value: `${streak} Days`, icon: <Zap size={14} />, color: "text-[var(--color-warning)]" },
            { label: "Primary Flow", value: topMode, icon: <TrendingUp size={14} />, color: "text-[var(--palette-10b981)]" },
          ].map((stat, i) => (
            <StaggerItem key={i}>
              <div className="rounded-2xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-4">
                <div className={`${stat.color} mb-3`}>{stat.icon}</div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-subtle)]">{stat.label}</p>
                <p className="text-xl font-black text-[var(--palette-white)] mt-1">{stat.value}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <footer className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-[var(--palette-white)]/5">
           <button className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[var(--palette-white)] px-6 py-3 text-sm font-bold text-[var(--palette-black)] hover:bg-[var(--palette-zinc-200)] transition-all">
             <Download size={16} /> Export as PDF
           </button>
           <button
             onClick={shareToX}
             className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[var(--palette-white)]/10 bg-[var(--palette-white)]/5 px-6 py-3 text-sm font-bold text-[var(--palette-white)] hover:bg-[var(--palette-white)]/10 transition-all"
           >
             <Share2 size={16} /> Share Achievement
           </button>
        </footer>
      </div>
    </div>
  );
}

function StaggerContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={STAGGER} initial="initial" animate="animate" className={className}>
      {children}
    </motion.div>
  );
}

function StaggerItem({ children }: { children: React.ReactNode }) {
  return <motion.div variants={STAGGER_CHILD}>{children}</motion.div>;
}
