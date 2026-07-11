import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * FocusArx Card — Phase 1 redesign
 *
 * Elevation levels:
 *   - default  → glass surface (elevation 1), subtle violet border
 *   - elevated → elevation 2 with stronger shadow
 *   - flat     → minimal border, no backdrop blur (for inner panels)
 *   - glow     → violet glow border for featured/highlight cards
 *   - ghost    → almost invisible, on-hover only
 *
 * All variants respect dark/light mode via CSS tokens.
 */

type CardElevation = 'default' | 'elevated' | 'flat' | 'glow' | 'ghost'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation
  /** Smooth hover lift effect */
  interactive?: boolean
  /** Neon border pulse animation */
  pulsing?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation = 'default', interactive = false, pulsing = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-elevation={elevation}
        className={cn(
          // Base
          "rounded-[var(--radius-lg)] border",
          "text-[var(--foreground)]",

          // Elevation variants
          elevation === 'default' && [
            "bg-[var(--surface-1)]",
            "border-[var(--card-border)]",
            "shadow-[var(--shadow-sm)]",
            "backdrop-blur-[16px]",
          ],

          elevation === 'elevated' && [
            "bg-[var(--surface-2)]",
            "border-[rgba(124,58,237,0.22)]",
            "shadow-[var(--shadow-md)]",
            "backdrop-blur-[20px]",
          ],

          elevation === 'flat' && [
            "bg-[rgba(255,255,255,0.025)]",
            "border-[rgba(255,255,255,0.06)]",
          ],

          elevation === 'glow' && [
            "bg-[var(--surface-1)]",
            "border-[rgba(124,58,237,0.30)]",
            "shadow-[var(--shadow-violet-md)]",
            "backdrop-blur-[16px]",
          ],

          elevation === 'ghost' && [
            "bg-transparent",
            "border-transparent",
            "hover:bg-[rgba(255,255,255,0.03)]",
            "hover:border-[rgba(255,255,255,0.06)]",
          ],

          // Interactive mode
          interactive && [
            "cursor-pointer",
            "transition-all duration-[200ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            "hover:-translate-y-[2px]",
            elevation === 'default'  && "hover:border-[rgba(124,58,237,0.28)] hover:shadow-[var(--shadow-violet-sm)]",
            elevation === 'elevated' && "hover:border-[rgba(124,58,237,0.40)] hover:shadow-[var(--shadow-violet-md)]",
            elevation === 'glow'     && "hover:border-[rgba(124,58,237,0.50)] hover:shadow-[var(--shadow-violet-lg)]",
            "active:translate-y-0 active:scale-[0.99]",
          ],

          // Pulsing neon border
          pulsing && "neon-border-pulse",

          className
        )}
        {...props}
      />
    )
  }
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1.5 p-5 pb-0", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-base font-semibold leading-snug tracking-[-0.01em] text-[var(--foreground)]",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-[var(--foreground-muted)] leading-relaxed", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center gap-2 p-5 pt-0 border-t border-[var(--border)] mt-2",
      className
    )}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  type CardElevation,
}
