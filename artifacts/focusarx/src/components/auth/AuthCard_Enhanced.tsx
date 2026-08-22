/**
 * AuthCard — FocusArx Phase 2 redesign
 * Used by forgot-password and reset-password.
 */
import React from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE } from "@/lib/animations";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  icon?: React.ReactNode;
  onBack?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  icon,
  onBack,
  isLoading = false,
  className,
}: AuthCardProps) {
  return (
    <div className="relative min-h-screen overflow-hidden forge-bg-glow flex items-center justify-center px-4 py-12">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 z-[var(--z-base)]" aria-hidden>
        <div className="absolute -left-40 -top-40 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle_at_center,var(--rgba-124-58-237-0_12),transparent_65%)] blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,var(--rgba-79-70-229-0_07),transparent_65%)] blur-3xl" />
      </div>

      <motion.div
        variants={PAGE}
        initial="initial"
        animate="animate"
        className="relative z-[var(--z-content)] w-full max-w-[420px]"
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)] bg-gradient-to-br from-[var(--brand-violet)] to-[var(--palette-4f46e5)] shadow-[var(--shadow-violet-md)] logo-pulse">
            {icon ?? <Zap size={22} className="text-[var(--palette-white)]" fill="var(--palette-white)" />}
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tracking-tight text-[var(--foreground)]">FocusArx</p>
          </div>
        </div>

        {/* Card */}
        <div className={cn("glass rounded-[var(--radius-2xl)] p-8 shadow-[var(--shadow-xl)]", className)}>
          {/* Back button */}
          {onBack && (
            <button
              onClick={onBack}
              className="mb-4 flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </button>
          )}

          <div className="mb-6">
            <h1 className="text-h3 text-[var(--foreground)]">{title}</h1>
            {subtitle && (
              <p className="mt-1.5 text-sm text-[var(--foreground-muted)] leading-relaxed">{subtitle}</p>
            )}
          </div>

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-[var(--z-content)] flex items-center justify-center rounded-[var(--radius-2xl)] bg-[var(--surface-3)]/60 backdrop-blur-sm">
              <div className="size-7 animate-spin rounded-full border-2 border-[var(--brand-violet)] border-t-transparent" />
            </div>
          )}

          <div>{children}</div>

          {footer && (
            <div className="mt-6 pt-5 border-t border-[var(--border)]">
              {footer}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function AuthLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "font-medium text-[var(--brand-violet-light)] transition-colors hover:text-[var(--brand-violet)] underline-offset-4 hover:underline",
        className
      )}
    >
      {children}
    </Link>
  );
}
