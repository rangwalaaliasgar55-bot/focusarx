import * as React from "react";
import { cn } from "@/lib/utils";

export type CardElevation = "default" | "elevated" | "flat" | "glow" | "ghost";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation;
  interactive?: boolean;
  pulsing?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation = "default", interactive = false, pulsing = false, ...props }, ref) => (
    <div
      ref={ref}
      data-elevation={elevation}
      className={cn(
        "rounded-[var(--radius-xl)] border text-[var(--foreground)]",
        elevation === "default" && "border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-sm)]",
        elevation === "elevated" && "border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-[var(--shadow-md)]",
        elevation === "flat" && "border-[var(--border-subtle)] bg-[var(--surface-hover)]",
        elevation === "glow" && "border-[var(--card-border)] bg-[var(--surface)] shadow-[var(--shadow-violet-md)]",
        elevation === "ghost" && "border-transparent bg-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]",
        interactive && "cursor-pointer transition-[transform,border-color,box-shadow] duration-[var(--duration-normal)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[var(--card-border)] hover:shadow-[var(--shadow-md)] active:translate-y-0 active:scale-[0.99]",
        pulsing && "neon-border-pulse",
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
