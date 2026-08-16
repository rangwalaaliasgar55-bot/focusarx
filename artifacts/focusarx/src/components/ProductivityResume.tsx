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
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-8 shadow-2xl relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 h-64 w-64 rounded-full bg-purple-600/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />
      
      <div className="relative z-10">
        <header className="flex justify-between items-start mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <div className="h-6 w-6 rounded bg-gradient-to-br from-[#7C3AED] to-[#F472B6]" />
               <span className="text-xs font-black uppercase tracking-[0.3em] text-[#4B5563]">FocusArx Certificate</span>
            </div>
            <h2 className="text-3xl font-black text-white">{userName}</h2>
            <p className="text-sm text-[#94A3B8] mt-1">Academic Discipline Summary</p>
          </div>
          <div className="text-right">
             <span className="rounded-full border border-[#A78BFA]/30 bg-[#A78BFA]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#A78BFA]">
               {rank}
             </span>
          </div>
        </header>

        <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: "Focus Depth", value: `${avgFocusScore}%`, icon: <Target size={14} />, color: "text-[#A78BFA]" },
            { label: "Total Volume", value: `${totalFocusHours}h`, icon: <Clock size={14} />, color: "text-[#60A5FA]" },
            { label: "Current Streak", value: `${streak} Days`, icon: <Zap size={14} />, color: "text-[#F59E0B]" },
            { label: "Primary Flow", value: topMode, icon: <TrendingUp size={14} />, color: "text-[#10B981]" },
          ].map((stat, i) => (
            <StaggerItem key={i}>
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <div className={`${stat.color} mb-3`}>{stat.icon}</div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#4B5563]">{stat.label}</p>
                <p className="text-xl font-black text-white mt-1">{stat.value}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <footer className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-white/5">
           <button className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-black hover:bg-zinc-200 transition-all">
             <Download size={16} /> Export as PDF
           </button>
           <button 
             onClick={shareToX}
             className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white hover:bg-white/10 transition-all"
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
