import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const RANK_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  beginner:     { label: "Beginner",     color: "var(--rank-beginner)",     icon: "🌱" },
  apprentice:   { label: "Apprentice",   color: "var(--rank-apprentice)",   icon: "📘" },
  scholar:      { label: "Scholar",      color: "var(--rank-scholar)",      icon: "📖" },
  expert:       { label: "Expert",       color: "var(--rank-expert)",       icon: "⚡" },
  master:       { label: "Master",       color: "var(--rank-master)",       icon: "🔥" },
  grandmaster:  { label: "Grandmaster",  color: "var(--rank-grandmaster)",  icon: "💎" },
  legend:       { label: "Legend",       color: "var(--rank-legend)",       icon: "👑" },
};

interface RankBadgeProps {
  rank: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
}

export function RankBadge({ rank, showLabel = false, size = "md", animated = false, className }: RankBadgeProps) {
  const cfg = RANK_CONFIG[rank] ?? RANK_CONFIG.beginner!;
  const sizeClasses = { sm: "text-xs px-1.5 py-0.5 gap-1", md: "text-sm px-2 py-1 gap-1.5", lg: "text-base px-3 py-1.5 gap-2" };
  const iconSizes = { sm: "text-xs", md: "text-sm", lg: "text-base" };

  return (
    <motion.span
      className={cn("inline-flex items-center rounded-full font-semibold border", sizeClasses[size], className)}
      style={{ color: cfg.color, borderColor: cfg.color, backgroundColor: `${cfg.color}15` }}
      animate={animated ? { boxShadow: [`0 0 0px ${cfg.color}`, `0 0 12px ${cfg.color}60`, `0 0 0px ${cfg.color}`] } : {}}
      transition={animated ? { duration: 2, repeat: Infinity } : {}}
    >
      <span className={iconSizes[size]}>{cfg.icon}</span>
      {showLabel && <span>{cfg.label}</span>}
    </motion.span>
  );
}
