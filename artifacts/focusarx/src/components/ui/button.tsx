import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * FocusArx Button — Phase 1 redesign
 *
 * Variants: default · secondary · outline · ghost · destructive · glow · link
 * All variants have: hover · focus-visible · active/pressed · disabled · loading states.
 */
const buttonVariants = cva(
  // Base
  [
    "relative inline-flex items-center justify-center gap-2",
    "whitespace-nowrap rounded-[10px]",
    "text-sm font-semibold tracking-[-0.01em]",
    "transition-all",
    "select-none cursor-pointer",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-violet)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
    "disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "duration-[150ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
  ].join(" "),
  {
    variants: {
      variant: {
        /** Primary CTA — violet fill */
        default: [
          "bg-[var(--brand-violet)] text-white",
          "border border-[rgba(167,139,250,0.20)]",
          "shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.10)]",
          "hover:bg-[#8B4EF8] hover:shadow-[0_4px_16px_rgba(124,58,237,0.35)]",
          "active:scale-[0.97] active:shadow-[0_1px_3px_rgba(0,0,0,0.4)]",
        ].join(" "),

        /** Secondary — glass surface */
        secondary: [
          "bg-[rgba(124,58,237,0.10)] text-[var(--brand-violet-light)]",
          "border border-[rgba(124,58,237,0.22)]",
          "hover:bg-[rgba(124,58,237,0.16)] hover:border-[rgba(124,58,237,0.35)]",
          "active:scale-[0.97]",
        ].join(" "),

        /** Outline — transparent with violet border */
        outline: [
          "bg-transparent text-[var(--foreground)]",
          "border border-[var(--border)]",
          "hover:border-[rgba(124,58,237,0.30)] hover:bg-[rgba(124,58,237,0.06)] hover:text-[var(--brand-violet-light)]",
          "active:scale-[0.97]",
        ].join(" "),

        /** Ghost — no border, minimal fill on hover */
        ghost: [
          "bg-transparent text-[var(--foreground-muted)]",
          "border border-transparent",
          "hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--foreground)]",
          "active:scale-[0.97]",
        ].join(" "),

        /** Destructive */
        destructive: [
          "bg-[#DC2626] text-white",
          "border border-[rgba(239,68,68,0.30)]",
          "shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
          "hover:bg-[#EF4444] hover:shadow-[0_4px_16px_rgba(239,68,68,0.30)]",
          "active:scale-[0.97]",
        ].join(" "),

        /** Glow — premium CTA with animated violet glow */
        glow: [
          "bg-[var(--brand-violet)] text-white",
          "border border-[rgba(167,139,250,0.25)]",
          "shadow-[0_0_0_1px_rgba(124,58,237,0.30),0_4px_20px_rgba(124,58,237,0.30)]",
          "hover:shadow-[0_0_0_1px_rgba(124,58,237,0.50),0_8px_32px_rgba(124,58,237,0.45)]",
          "hover:bg-[#8B4EF8]",
          "active:scale-[0.97]",
        ].join(" "),

        /** Link */
        link: [
          "bg-transparent text-[var(--brand-violet-light)] underline-offset-4",
          "border border-transparent",
          "hover:underline hover:text-[var(--brand-violet)]",
        ].join(" "),
      },

      size: {
        xs:      "h-7  min-w-7  px-2.5 text-xs  rounded-[8px]",
        sm:      "h-8  min-w-8  px-3   text-xs",
        default: "h-9  min-w-9  px-4   text-sm",
        lg:      "h-10 min-w-10 px-5   text-sm",
        xl:      "h-12 min-w-12 px-6   text-base",
        icon:    "h-9  w-9  rounded-[10px]",
        "icon-sm": "h-7 w-7 rounded-[8px]",
        "icon-lg": "h-10 w-10 rounded-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Show a spinner and disable the button */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        ref={ref}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {loading ? (
          <>
            <Spinner />
            <span className="opacity-70">{children}</span>
          </>
        ) : children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

/** Internal spinner — reuses brand violet */
function Spinner() {
  return (
    <svg
      className="animate-spin size-4 shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

export { Button, buttonVariants }
