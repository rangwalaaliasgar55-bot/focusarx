"use client";

import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Building2,
  Medal,
  Brain,
  Users,
  Award,
  Settings,
  HelpCircle,
  Sparkles,
  Flame,
  BookOpen,
  Crown,
  Gift,
  Wallet,
  Library,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MenuItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description?: string;
  premium?: boolean;
};

const SECONDARY_ITEMS: MenuItem[] = [
  { href: "/city", label: "Focus City", icon: Building2, description: "Your growing city" },
  { href: "/achievements", label: "Achievements", icon: Medal, description: "Badges & milestones" },
  { href: "/ai-insights", label: "AI Coach", icon: Brain, description: "Personalized insights", premium: true },
  { href: "/study-rooms", label: "Forge Rooms", icon: Users, description: "Study together" },
  { href: "/leaderboard", label: "Leaderboard", icon: Award, description: "Top focusers" },
  { href: "/flashcards", label: "Flashcards", icon: Library, description: "Spaced repetition" },
  { href: "/missions", label: "Missions", icon: Flame, description: "Daily quests" },
  { href: "/shop", label: "Rewards", icon: Gift, description: "Spend your coins" },
  { href: "/wallet", label: "Wallet", icon: Wallet, description: "XP & coins" },
  { href: "/focus-guide", label: "Guides", icon: BookOpen, description: "Learn to focus" },
  { href: "/premium", label: "Premium", icon: Crown, description: "Unlock all features" },
  { href: "/support", label: "Help", icon: HelpCircle, description: "Support & FAQ" },
  { href: "/profile", label: "Settings", icon: Settings, description: "Account & appearance" },
];

interface MobileMoreMenuProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMoreMenu({ open, onClose }: MobileMoreMenuProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] max-h-[85dvh] overflow-hidden rounded-t-[1.5rem] border-t border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-2xl md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="More options"
          >
            {/* Handle */}
            <div className="flex flex-col">
              <div className="flex justify-center pt-3">
                <div className="h-1.5 w-10 rounded-full bg-[var(--border-strong)]" />
              </div>
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">More</h2>
                  <p className="text-xs text-[var(--foreground-subtle)]">Explore FocusArx</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-hover)] text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Menu grid */}
            <div className="overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]" style={{ maxHeight: "calc(85dvh - 80px)" }}>
              <div className="grid grid-cols-1 gap-1.5">
                {SECONDARY_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-4 py-3.5",
                        "border border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]",
                        "transition-colors active:scale-[0.98]"
                      )}
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)] group-hover:bg-[var(--brand-soft-hover)]">
                        <Icon size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{item.label}</span>
                          {item.premium && <Crown size={12} className="text-[var(--palette-amber-400)]" />}
                        </span>
                        {item.description && (
                          <span className="block text-xs text-[var(--foreground-subtle)]">{item.description}</span>
                        )}
                      </span>
                      <span className="text-[var(--foreground-subtle)] group-hover:text-[var(--foreground-muted)]">›</span>
                    </Link>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="mt-4 flex items-center justify-center gap-4 border-t border-[var(--border-subtle)] px-4 py-4 text-[11px] text-[var(--foreground-subtle)]">
                <Link href="/privacy" onClick={onClose} className="hover:text-[var(--foreground)]">
                  Privacy
                </Link>
                <span>•</span>
                <Link href="/terms" onClick={onClose} className="hover:text-[var(--foreground)]">
                  Terms
                </Link>
                <span>•</span>
                <Link href="/support" onClick={onClose} className="hover:text-[var(--foreground)]">
                  Help
                </Link>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
