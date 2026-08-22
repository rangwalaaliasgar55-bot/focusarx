import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string;
}

const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value = 0, indicatorClassName, "aria-label": ariaLabel = "Progress", ...props }, ref) => {
    const normalized = Math.min(100, Math.max(0, value ?? 0));
    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={normalized}
        aria-label={ariaLabel}
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-[var(--brand-soft)]", className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn("h-full w-full rounded-full bg-[var(--brand-500)] transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] motion-reduce:transition-none", indicatorClassName)}
          style={{ transform: `translateX(-${100 - normalized}%)` }}
        />
      </ProgressPrimitive.Root>
    );
  },
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
