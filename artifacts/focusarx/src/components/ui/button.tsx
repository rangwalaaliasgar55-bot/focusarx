import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[var(--radius-md)] border border-transparent px-4",
    "text-sm font-semibold tracking-[-0.01em] select-none",
    "transition-[transform,background-color,border-color,color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
    "active:scale-[0.97] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-[var(--brand-600)] text-[var(--neutral-0)] shadow-[var(--shadow-violet-sm)] hover:bg-[var(--brand-500)] hover:shadow-[var(--shadow-violet-md)]",
        secondary: "border-[var(--card-border)] bg-[var(--brand-soft)] text-[var(--brand-strong)] hover:bg-[var(--brand-soft-hover)]",
        outline: "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--brand-500)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)]",
        ghost: "bg-transparent text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
        destructive: "bg-[var(--danger)] text-[var(--neutral-0)] shadow-[var(--shadow-sm)] hover:brightness-110",
        glow: "bg-[var(--brand-600)] text-[var(--neutral-0)] shadow-[var(--shadow-violet-md)] hover:bg-[var(--brand-500)] hover:shadow-[var(--shadow-violet-lg)]",
        link: "min-h-0 border-0 bg-transparent p-0 text-[var(--brand-strong)] underline-offset-4 hover:underline",
      },
      size: {
        xs: "min-h-11 rounded-[var(--radius-sm)] px-2.5 text-xs",
        sm: "min-h-11 px-3 text-xs",
        default: "min-h-11 px-4",
        lg: "min-h-12 px-5",
        xl: "min-h-14 rounded-[var(--radius-lg)] px-7 text-base",
        icon: "h-11 w-11 p-0",
        "icon-sm": "h-11 min-h-11 w-11 p-0",
        "icon-lg": "h-12 w-12 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className);

    // Radix Slot requires exactly one React child. Keep the loading indicator
    // on native buttons so `asChild` links never receive sibling nodes.
    if (asChild) {
      return (
        <Slot
          ref={ref}
          aria-disabled={disabled || loading || undefined}
          className={classes}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-disabled={disabled || loading || undefined}
        aria-busy={loading || undefined}
        className={classes}
        {...props}
      >
        {loading && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
