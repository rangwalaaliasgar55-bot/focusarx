import { motion } from "framer-motion";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  /** Optional emoji illustration rendered instead of / above the icon tile. */
  illustration?: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon, illustration, title, description, action, secondaryAction, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}
    >
      <div className="relative mb-6 grid place-items-center">
        {/* Layered illustration rings (audit M6) */}
        <span aria-hidden="true" className="absolute size-28 rounded-full border border-[var(--border-subtle)] opacity-60" />
        <motion.span
          aria-hidden="true"
          className="absolute size-20 rounded-full border border-dashed border-[var(--brand-500)]/30"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 24, ease: "linear" }}
        />
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className={cn(
            "grid h-14 w-14 place-items-center rounded-[var(--radius-xl)] border border-[var(--card-border)] bg-[var(--brand-soft)] text-[var(--brand-strong)] shadow-[var(--shadow-sm)]",
            illustration ? "text-2xl" : "[&_svg]:size-6",
          )}
        >
          {illustration ?? icon ?? <Inbox aria-hidden="true" />}
        </motion.div>
      </div>
      <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--foreground-muted)]">{description}</p>
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {action && <Button onClick={action.onClick}>{action.label}</Button>}
          {secondaryAction && <Button variant="outline" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>}
        </div>
      )}
    </motion.div>
  );
}
