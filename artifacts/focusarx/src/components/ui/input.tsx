import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * FocusArx Input — Phase 1 redesign
 *
 * States: default · focus · error · success · disabled
 * All states use CSS custom property tokens.
 */

export interface InputProps extends React.ComponentProps<"input"> {
  /** Error state — red ring + red border */
  error?: boolean
  /** Success state — teal ring + teal border */
  success?: boolean
  /** Left slot — icon or text adornment */
  leftSlot?: React.ReactNode
  /** Right slot — icon or button adornment */
  rightSlot?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, success, leftSlot, rightSlot, ...props }, ref) => {
    if (leftSlot || rightSlot) {
      return (
        <InputGroup
          leftSlot={leftSlot}
          rightSlot={rightSlot}
          error={error}
          success={success}
          className={className}
        >
          <input
            type={type}
            ref={ref}
            className={inputCoreClass({ error, success, hasLeft: !!leftSlot, hasRight: !!rightSlot })}
            {...props}
          />
        </InputGroup>
      )
    }

    return (
      <input
        type={type}
        ref={ref}
        className={cn(inputCoreClass({ error, success }), className)}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

/* ── Grouped input wrapper ──────────────────────────────────────────────── */
interface InputGroupProps {
  leftSlot?: React.ReactNode
  rightSlot?: React.ReactNode
  error?: boolean
  success?: boolean
  className?: string
  children: React.ReactNode
}

function InputGroup({ leftSlot, rightSlot, error, success, className, children }: InputGroupProps) {
  return (
    <div
      className={cn(
        "relative flex items-center",
        "rounded-[var(--radius-md)]",
        "bg-[var(--input-bg)]",
        "border",
        error   && "border-[var(--color-error)]   ring-2 ring-[var(--ring-error)]",
        success && "border-[var(--color-success)] ring-2 ring-[var(--ring-success)]",
        !error && !success && "border-[var(--input-border)] focus-within:border-[var(--brand-violet)] focus-within:ring-2 focus-within:ring-[var(--ring)]",
        "transition-all duration-[150ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        className
      )}
    >
      {leftSlot && (
        <span className="absolute left-3 flex items-center text-[var(--foreground-muted)] pointer-events-none [&_svg]:size-4">
          {leftSlot}
        </span>
      )}
      {children}
      {rightSlot && (
        <span className="absolute right-3 flex items-center text-[var(--foreground-muted)] [&_svg]:size-4">
          {rightSlot}
        </span>
      )}
    </div>
  )
}

/* ── Core input class factory ───────────────────────────────────────────── */
function inputCoreClass({
  error,
  success,
  hasLeft,
  hasRight,
}: {
  error?: boolean
  success?: boolean
  hasLeft?: boolean
  hasRight?: boolean
} = {}) {
  return cn(
    // Layout
    "flex h-9 w-full",
    "rounded-[var(--radius-md)]",
    "px-3 py-1.5",
    hasLeft  && "pl-9",
    hasRight && "pr-9",

    // Typography
    "text-sm text-[var(--foreground)] placeholder:text-[var(--muted-fg)]",
    "font-[inherit]",

    // Background & border (ungrouped only — grouped wrapper handles this)
    "bg-[var(--input-bg)]",
    "border",
    error   ? "border-[var(--color-error)]   ring-2 ring-[var(--ring-error)]   outline-none"  : "",
    success ? "border-[var(--color-success)] ring-2 ring-[var(--ring-success)] outline-none" : "",
    !error && !success && [
      "border-[var(--input-border)]",
      "outline-none",
      "focus:border-[var(--brand-violet)] focus:ring-2 focus:ring-[var(--ring)]",
    ],

    // Misc
    "transition-all duration-[150ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
    "disabled:cursor-not-allowed disabled:opacity-40",
    "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--foreground)]",

    // Autofill — override browser yellow
    "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_var(--surface-1)]",
    "[&:-webkit-autofill]:[-webkit-text-fill-color:var(--foreground)]",
  )
}

export { Input, InputGroup }
