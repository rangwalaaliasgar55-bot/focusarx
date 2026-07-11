import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { FADE_UP } from "@/lib/animations";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

/**
 * EmptyState — shown when a data-driven view has no content.
 * Uses FADE_UP entrance and design-token typography.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      variants={FADE_UP}
      initial="initial"
      animate="animate"
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-16 px-6 text-center",
        className
      )}
    >
      {/* Icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-2xl)] bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.14)]">
        <span className="text-3xl select-none" role="img" aria-hidden>{icon}</span>
      </div>

      <div className="space-y-1.5 max-w-xs">
        <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">{description}</p>
      </div>

      {action && (
        <Button variant="outline" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}
