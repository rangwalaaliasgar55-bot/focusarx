import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Elevation is a *tone step plus a hairline*, not a light source.
 *
 * v4's `glow` elevation painted a violet shadow under the card and `pulsing`
 * ran an infinite border animation; both are gone. `glow` survives as an
 * alias of `elevated` for existing call sites and will be removed with the
 * rest of the decorative vocabulary (docs/DESIGN.md).
 */
export type CardElevation = "default" | "elevated" | "flat" | "glow" | "ghost";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation;
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation = "default", interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      data-elevation={elevation}
      className={cn(
        "rounded-[var(--radius-xl)] border text-[var(--foreground)]",
        elevation === "default" && "border-[var(--border-subtle)] bg-[var(--surface-1)]",
        elevation === "elevated" && "border-[var(--border)] bg-[var(--surface-2)] shadow-[var(--shadow-sm)]",
        elevation === "flat" && "border-transparent bg-[var(--surface-2)]",
        elevation === "glow" && "border-[var(--border)] bg-[var(--surface-2)] shadow-[var(--shadow-sm)]",
        elevation === "ghost" && "border-transparent bg-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]",
        interactive && "cursor-pointer transition-[border-color,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex flex-col gap-1.5 p-5 pb-0 sm:p-6 sm:pb-0", className)} {...props} />,
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("text-base font-semibold leading-snug tracking-[-0.015em]", className)} {...props} />,
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("text-sm leading-relaxed text-[var(--foreground-muted)]", className)} {...props} />,
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-5 sm:p-6", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex items-center gap-2 border-t border-[var(--border-subtle)] p-5 sm:p-6", className)} {...props} />,
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
