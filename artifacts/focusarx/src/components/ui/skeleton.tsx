import { cn } from "@/lib/utils"

/**
 * Skeleton — shimmer placeholder for loading states.
 * Uses design-token colors and respects prefers-reduced-motion.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        "rounded-[var(--radius-md)]",
        "bg-[rgba(255,255,255,0.04)]",
        // shimmer sweep
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:bg-gradient-to-r before:from-transparent before:via-[rgba(255,255,255,0.06)] before:to-transparent",
        "before:animate-[shimmer-sweep_1.6s_ease-in-out_infinite]",
        // Reduce motion
        "motion-reduce:animate-none motion-reduce:before:animate-none",
        className
      )}
      aria-hidden="true"
      {...props}
    />
  )
}

export { Skeleton }
