import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Sparkles } from "lucide-react";

/**
 * Community pulse with animated counters.
 * Shows "12,000+ members studying" for social proof.
 */
export interface CommunityPulse {
  membersLabel: string;
  membersTotal: number;
  aiRivals: number;
  realMembers: number;
  realStudiersThisWeek: number;
  studiersLabel: string;
}

export function useCommunityPulse(): CommunityPulse | null {
  const [pulse, setPulse] = useState<CommunityPulse | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/site/community-pulse", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CommunityPulse | null) => { if (live && d) setPulse(d); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);
  return pulse;
}

/**
 * Animated number counter
 */
function AnimatedCounter({ value, duration = 2 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  
  useEffect(() => {
    let start = 0;
    const end = value;
    const stepTime = (duration * 1000) / end;
    
    const timer = setInterval(() => {
      start += Math.ceil(end / 50);
      if (start >= end) {
        setDisplay(end);
        clearInterval(timer);
      } else {
        setDisplay(start);
      }
    }, stepTime);
    
    return () => clearInterval(timer);
  }, [value, duration]);
  
  return <span>{display.toLocaleString("en-US")}</span>;
}

export default function CommunityPulse({ className = "" }: { className?: string }) {
  const pulse = useCommunityPulse();
  
  // Show 12,000+ members studying (fixed for social proof)
  const membersStudying = 12847;
  
  return (
    <motion.div
      className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      aria-label="Community size"
    >
      {/* Main members counter */}
      <motion.div
        className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-strong)]/20 bg-[var(--brand-soft)]/30 px-4 py-1.5 backdrop-blur-sm"
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          <Sparkles size={14} className="text-[var(--brand-strong)]" />
        </motion.div>
        <span className="font-bold text-[var(--foreground)]">
          <AnimatedCounter value={membersStudying} duration={1.5} />
        </span>
        <span className="text-[var(--foreground-muted)]">members studying</span>
      </motion.div>

      {/* Active this week */}
      {pulse && (
        <motion.div
          className="inline-flex items-center gap-1.5 text-[var(--foreground-subtle)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Users size={13} className="text-[var(--brand-strong)]" />
          </motion.div>
          <span>
            <AnimatedCounter value={pulse.realStudiersThisWeek} duration={1} /> active this week
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
