import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  error?: boolean;
  success?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, success, "aria-invalid": ariaInvalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={ariaInvalid ?? error ?? undefined}
      className={cn(
        "flex min-h-24 w-full resize-y rounded-[var(--radius-md)] border bg-[var(--input-bg)] px-3 py-2.5",
        "font-[inherit] text-sm leading-6 text-[var(--foreground)] shadow-[var(--shadow-xs)] placeholder:text-[var(--foreground-subtle)]",
        "outline-none transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]",
        "focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45",
        error ? "border-[var(--danger)] ring-2 ring-[var(--danger-soft)]" : success ? "border-[var(--success)] ring-2 ring-[var(--success-soft)]" : "border-[var(--input-border)]",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
