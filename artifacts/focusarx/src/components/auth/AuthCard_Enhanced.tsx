"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { cn } from "@/lib/utils"; // Assuming a standard shadcn-like utility, I'll provide a fallback

/**
 * Enhanced AuthCard Component
 * 
 * Improvements:
 * 1. Added Icon/Logo support
 * 2. Integrated "Back" button for multi-step flows
 * 3. Added Loading state overlay
 * 4. Improved Glassmorphism and animations
 * 5. Better accessibility with ARIA roles
 * 6. Responsive padding and better typography
 */

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
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 selection:bg-rose-500/30">
      {/* Decorative background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[25%] -left-[10%] w-[70%] h-[70%] rounded-full bg-rose-500/10 blur-[120px]" />
        <div className="absolute -bottom-[25%] -right-[10%] w-[70%] h-[70%] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ 
          duration: 0.5, 
          ease: [0.16, 1, 0.3, 1],
          staggerChildren: 0.1 
        }}
        className={cn(
          "relative w-full max-w-[440px] overflow-hidden rounded-[2rem]",
          "border border-white/10 bg-zinc-900/70 backdrop-blur-xl",
          "shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]",
          className
        )}
      >
        {/* Loading Overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm"
            >
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-8 md:p-10">
          {/* Header Section */}
          <div className="relative mb-8 flex flex-col items-center text-center">
            {onBack && (
              <button
                onClick={onBack}
                className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition-all hover:bg-white/10 hover:text-white"
                aria-label="Go back"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </button>
            )}

            {icon && (
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 p-0.5 shadow-lg shadow-rose-500/20"
              >
                <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-zinc-900 text-white">
                  {icon}
                </div>
              </motion.div>
            )}

            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-3xl font-bold tracking-tight text-white"
            >
              {title}
            </motion.h1>
            
            {subtitle && (
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-3 text-balance text-zinc-400"
              >
                {subtitle}
              </motion.p>
            )}
          </div>

          {/* Main Content */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {children}
          </motion.div>

          {/* Footer Section */}
          {footer && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-10 border-t border-white/5 pt-8 text-center"
            >
              {footer}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Enhanced AuthLink Component
 */
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
        "font-medium text-rose-500 transition-all hover:text-rose-400 hover:underline underline-offset-4",
        className
      )}
    >
      {children}
    </Link>
  );
}

