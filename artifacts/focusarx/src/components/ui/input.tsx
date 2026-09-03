import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  error?: boolean;
  success?: boolean;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

const stateClasses = (error?: boolean, success?: boolean) =>
  error
    ? "border-[var(--danger)] ring-[3px] ring-[var(--danger-soft)]"
    : success
      ? "border-[var(--success)] ring-[3px] ring-[var(--success-soft)]"
      : "border-[var(--input-border)] focus-within:border-[var(--brand-500)] focus-within:ring-[3px] focus-within:ring-[var(--ring)] focus:border-[var(--brand-500)] focus:ring-[3px] focus:ring-[var(--ring)]";

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, success, leftSlot, rightSlot, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const field = (
      <input
        type={type}
        ref={ref}
        aria-invalid={ariaInvalid ?? error ?? undefined}
        className={cn(
          "flex min-h-11 w-full rounded-[var(--radius-md)] bg-[var(--input-bg)] px-3 py-2",
          "font-[inherit] text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)]",
          "outline-none transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]",
          "disabled:cursor-not-allowed disabled:opacity-45",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--foreground)]",
          leftSlot && "pl-10",
          rightSlot && "pr-10",
          !(leftSlot || rightSlot) && "border",
          !(leftSlot || rightSlot) && stateClasses(error, success),
          !(leftSlot || rightSlot) && className,
        )}
        {...props}
      />
    );

    if (!(leftSlot || rightSlot)) return field;

    return (
      <div className={cn("relative flex items-center rounded-[var(--radius-md)] border bg-[var(--input-bg)]", stateClasses(error, success), className)}>
        {leftSlot && <span className="pointer-events-none absolute left-3 text-[var(--foreground-subtle)] [&_svg]:size-4">{leftSlot}</span>}
        {field}
        {rightSlot && <span className="absolute right-0 flex min-h-11 min-w-11 items-center justify-center text-[var(--foreground-muted)] [&_button]:min-h-11 [&_button]:min-w-11 [&_svg]:size-4">{rightSlot}</span>}
      </div>
    );
  },
);
Input.displayName = "Input";

interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  error?: boolean;
  success?: boolean;
}

function InputGroup({ className, error, success, ...props }: InputGroupProps) {
  return <div className={cn("relative flex items-center rounded-[var(--radius-md)] border", stateClasses(error, success), className)} {...props} />;
}

export { Input, InputGroup };
