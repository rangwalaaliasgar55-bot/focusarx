import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StreakFlameProps {
  streak: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function StreakFlame({ streak, size = "md", showLabel = false, className }: StreakFlameProps) {
  const sizeMap = { sm: "text-sm", md: "text-base", lg: "text-xl" };
  const numSize = { sm: "text-xs", md: "text-sm", lg: "text-lg" };

  const glowColor = streak >= 30
    ? "drop-shadow(0 0 6px var(--palette-ff6b6b)) drop-shadow(0 0 12px var(--palette-ffd93d))"
    : streak >= 7
    ? "drop-shadow(0 0 6px var(--brand-gold))"
    : "none";

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <motion.span
        className={sizeMap[size]}
        style={{ filter: glowColor, display: "inline-block" }}
        animate={streak > 0 ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 0.4, ease: "easeOut" }}
        key={streak}
      >
        🔥
      </motion.span>
      <span className={cn("font-bold tabular-nums", numSize[size])}>{streak}</span>
      {showLabel && <span className={cn("text-muted-foreground", numSize[size])}>day streak</span>}
    </span>
  );
}
