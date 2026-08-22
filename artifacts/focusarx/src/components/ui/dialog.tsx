import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

/* ── Overlay ────────────────────────────────────────────────────────────── */
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[var(--z-modal)]",
      "bg-[var(--palette-black)]/60 backdrop-blur-[4px]",
      "data-[state=open]:animate-in   data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "duration-[var(--duration-fast)]",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/* ── Content ────────────────────────────────────────────────────────────── */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Positioning
        "fixed left-1/2 top-1/2 z-[var(--z-modal)] -translate-x-1/2 -translate-y-1/2",
        "w-full max-w-lg",

        // Appearance
        "bg-[var(--surface-3)]",
        "border border-[var(--rgba-124-58-237-0_20)]",
        "rounded-[var(--radius-xl)]",
        "shadow-[var(--shadow-xl),var(--shadow-violet-sm)]",
        "p-0 overflow-hidden",

        // Animation
        "data-[state=open]:animate-in   data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
        "data-[state=open]:slide-in-from-left-1/2   data-[state=open]:slide-in-from-top-[48%]",
        "duration-[var(--duration-fast)]",

        className
      )}
      {...props}
    >
      {children}

      {/* Close button */}
      <DialogPrimitive.Close
        className={cn(
          "absolute right-4 top-4 z-[var(--z-content)]",
          "grid h-11 w-11 place-items-center rounded-[var(--radius-md)]",
          "text-[var(--foreground-muted)]",
          "bg-transparent border border-transparent",
          "opacity-70 transition-all duration-[var(--duration-fast)]",
          "hover:opacity-100 hover:bg-[var(--rgba-255-255-255-0_07)] hover:border-[var(--rgba-255-255-255-0_08)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-violet)] focus-visible:ring-offset-2",
          "disabled:pointer-events-none",
          "data-[state=open]:bg-[var(--rgba-255-255-255-0_05)] data-[state=open]:text-[var(--foreground)]"
        )}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

/* ── Header ─────────────────────────────────────────────────────────────── */
const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col gap-1.5",
      "px-6 pt-6 pb-4",
      "border-b border-[var(--border)]",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

/* ── Body ───────────────────────────────────────────────────────────────── */
const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-6 py-4", className)} {...props} />
)
DialogBody.displayName = "DialogBody"

/* ── Footer ─────────────────────────────────────────────────────────────── */
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
      "px-6 py-4 pt-3",
      "border-t border-[var(--border)]",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

/* ── Title ──────────────────────────────────────────────────────────────── */
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-base font-semibold leading-snug tracking-[-0.01em] text-[var(--foreground)] pr-8",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

/* ── Description ────────────────────────────────────────────────────────── */
const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-[var(--foreground-muted)] leading-relaxed", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
