import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * FocusArx Badge — Phase 1 redesign
 *
 * Variants: default (violet) · teal · gold · success · warning · error · outline · ghost
 */
const badgeVariants = cva(
  [
    "inline-flex items-center gap-1",
    "whitespace-nowrap rounded-[var(--radius-full)]",
    "px-2.5 py-0.5",
    "text-[11px] font-semibold tracking-[0.01em]",
    "border",
    "transition-all duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
    "select-none",
    "[&_svg]:size-3 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        /** Violet (primary brand) */
        default: [
          "bg-[rgba(124,58,237,0.15)] text-[var(--brand-violet-light)]",
          "border-[rgba(124,58,237,0.28)]",
          "shadow-[0_1px_2px_rgba(0,0,0,0.20)]",
        ].join(" "),

        /** Teal */
        teal: [
          "bg-[rgba(6,214,160,0.12)] text-[#06D6A0]",
          "border-[rgba(6,214,160,0.25)]",
        ].join(" "),

        /** Gold */
        gold: [
          "bg-[rgba(255,184,0,0.12)] text-[#FFB800]",
          "border-[rgba(255,184,0,0.25)]",
        ].join(" "),

        /** Success */
        success: [
          "bg-[rgba(34,197,94,0.12)] text-[#22C55E]",
          "border-[rgba(34,197,94,0.25)]",
        ].join(" "),

        /** Warning */
        warning: [
          "bg-[rgba(245,158,11,0.12)] text-[#F59E0B]",
          "border-[rgba(245,158,11,0.25)]",
        ].join(" "),

        /** Error / destructive */
        error: [
          "bg-[rgba(239,68,68,0.12)] text-[#EF4444]",
          "border-[rgba(239,68,68,0.25)]",
        ].join(" "),

        /** Secondary — subdued */
        secondary: [
          "bg-[rgba(255,255,255,0.06)] text-[var(--foreground-muted)]",
          "border-[rgba(255,255,255,0.08)]",
        ].join(" "),

        /** Outline only */
        outline: [
          "bg-transparent text-[var(--foreground)]",
          "border-[var(--border)]",
        ].join(" "),

        /** Ghost — no border, no bg */
        ghost: [
          "bg-transparent text-[var(--foreground-muted)]",
          "border-transparent",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
