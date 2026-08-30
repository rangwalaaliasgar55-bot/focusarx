import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";

/**
 * Community pulse with animated counters.
 * Shows "12,000+ members studying" for social proof with dynamic changes.
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
 * Animated number counter with dynamic changes
 */
function AnimatedCounter({ value, duration = 2 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const [trend, setTrend] = useState<"up" | "down" | "neutral">("neutral");
  const prevValueRef = useRef(value);
  
  // Animate count up/down to simulate users coming and going
  useEffect(() => {
    const targetValue = value;
    const startValue = display;
    const diff = targetValue - startValue;
    
    if (diff === 0) return;
    
    setTrend(diff > 0 ? "up" : diff < 0 ? "down" : "neutral");
    
    const steps = 20;
    const stepValue = diff / steps;
    let currentStep = 0;
    
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplay(targetValue);
        clearInterval(timer);
        setTimeout(() => setTrend("neutral"), 1000);
      } else {
        setDisplay(Math.round(startValue + stepValue * currentStep));
      }
    }, duration * 1000 / steps);
    
    return () => clearInterval(timer);
  }, [value, duration]);
  
  return (
    <div className="flex items-center gap-1.5">
      <motion.span
        key={display}
        initial={{ scale: 1.1, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="tabular-nums"
      >
        {display.toLocaleString("en-US")}
      </motion.span>
      <AnimatePresence mode="wait">
        {trend !== "neutral" && (
          <motion.div
            key={trend}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
          >
            {trend === "up" && <TrendingUp size={12} className="text-emerald-400" />}
            {trend === "down" && <TrendingDown size={12} className="text-rose-400" />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CommunityPulse({ className = "" }: { className?: string }) {
  const pulse = useCommunityPulse();
  const [dynamicCount, setDynamicCount] = useState(12847);
  
  // Show 12,000+ members studying (fixed for social proof)
  const baseCount = 12847;
  
  // Dynamically fluctuate the count to show users coming and going
  useEffect(() => {
    const interval = setInterval(() => {
      // Random change between -15 and +25 users every 3-8 seconds
      const change = Math.floor(Math.random() * 40) - 15;
      setDynamicCount(prev => {
        const newCount = Math.max(12000, Math.min(15000, prev + change));
        return newCount;
      });
    }, Math.random() * 5000 + 3000);
    
    return () => clearInterval(interval);
  }, []);
  
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
          <AnimatedCounter value={dynamicCount} duration={1.5} />
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
