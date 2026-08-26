"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MobileFormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function MobileFormField({ label, htmlFor, required, hint, error, children }: MobileFormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-[var(--foreground)]">
        {label}
        {required && <span className="ml-1 text-[var(--danger)]" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[var(--foreground-subtle)]">{hint}</p>}
      {error && <p className="text-xs text-[var(--danger)]" role="alert">{error}</p>}
    </div>
  );
}

interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function MobileInput({ className, error, type = "text", inputMode, ...props }: MobileInputProps) {
  // Auto-detect numeric keyboard for number-like fields
  const effectiveInputMode = inputMode || (type === "number" ? "numeric" : type === "tel" ? "tel" : type === "email" ? "email" : undefined);
  const effectiveType = type === "number" ? "text" : type; // Use text with inputMode to prevent spinner and allow better mobile UX

  return (
    <input
      type={effectiveType}
      inputMode={effectiveInputMode as any}
      className={cn(
        "min-h-[48px] w-full rounded-xl border bg-[var(--surface-1)] px-4 py-3 text-base text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]/20",
        error ? "border-[var(--danger)]" : "border-[var(--border-subtle)]",
        className
      )}
      {...props}
    />
  );
}

export function MobileTextarea({ className, error, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      className={cn(
        "min-h-[96px] w-full rounded-xl border bg-[var(--surface-1)] px-4 py-3 text-base text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]/20",
        error ? "border-[var(--danger)]" : "border-[var(--border-subtle)]",
        className
      )}
      {...props}
    />
  );
}

export function MobileForm({ children, className, ...props }: React.FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form className={cn("flex flex-col gap-5", className)} {...props}>
      {children}
    </form>
  );
}

export function MobileFormActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-3 pt-2", className)}>{children}</div>;
}

export function MobileButton({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      className={cn(
        "min-h-[48px] w-full rounded-full px-5 py-3 text-sm font-bold transition-transform active:scale-[0.98] disabled:opacity-50",
        variant === "primary" && "bg-[var(--brand-600)] text-white shadow-[var(--shadow-violet-sm)]",
        variant === "secondary" && "border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground)]",
        variant === "ghost" && "text-[var(--foreground-muted)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
