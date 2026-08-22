import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-[var(--card-border)] bg-[var(--brand-soft)] text-[var(--brand-strong)]",
        teal: "border-[color-mix(in_srgb,var(--brand-teal)_28%,transparent)] bg-[var(--brand-teal-dim)] text-[var(--brand-teal)]",
        gold: "border-[color-mix(in_srgb,var(--brand-gold)_28%,transparent)] bg-[var(--brand-gold-dim)] text-[var(--brand-gold)]",
        success: "border-[color-mix(in_srgb,var(--success)_28%,transparent)] bg-[var(--success-soft)] text-[var(--success)]",
        warning: "border-[color-mix(in_srgb,var(--warning)_28%,transparent)] bg-[var(--warning-soft)] text-[var(--warning)]",
        error: "border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[var(--danger-soft)] text-[var(--danger)]",
        secondary: "border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--foreground-muted)]",
        outline: "border-[var(--border-strong)] bg-transparent text-[var(--foreground)]",
        ghost: "border-transparent bg-transparent text-[var(--foreground-muted)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
