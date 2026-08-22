import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-hover)]",
        "before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-[var(--border-strong)] before:to-transparent",
        "before:animate-[shimmer-sweep_1.6s_ease-in-out_infinite] motion-reduce:before:animate-none",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

function ViewSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-4", className)} role="status" aria-label="Loading content">
      <span className="sr-only">Loading content…</span>
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }).map((_, index) => <Skeleton key={index} className="h-32" />)}
      </div>
    </div>
  );
}

export { Skeleton, ViewSkeleton };
