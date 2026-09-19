import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  X,
  Timer,
  PawPrint,
  Target,
  Compass,
  Trophy,
  Users,
  Building2,
  Flame,
  Medal,
  Gift,
} from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

/**
 * Quick Launch — one floating circle that opens the whole momentum layer.
 *
 * Discovery was the problem: features like Companions, Missions or Break Free
 * only existed in the sidebar, which mobile users never unfold. This orb sits
 * in the thumb corner on every app page (desktop too, since a sidebar entry
 * still costs a scroll) and expands into a grid of the features that make
 * people come back.
 *
 * Contract:
 * - One tap opens, one tap on the scrim / the × / Escape closes.
 * - Focus moves into the panel on open and returns to the orb on close, so
 *   keyboard users never land on the page behind it.
 * - Never renders during an active focus session (the shell hides it the way
 *   it hides the bottom nav — a deep-work product must not interrupt itself).
 * - Reduced motion: no pulse, no stagger; the panel simply appears.
 */

type LaunchItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const LAUNCH_ITEMS: LaunchItem[] = [
  { href: "/", label: "Timer", icon: Timer },
  { href: "/pets", label: "Companions", icon: PawPrint },
  { href: "/missions", label: "Missions", icon: Target },
  { href: "/quests", label: "Quests", icon: Compass },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/social", label: "Community", icon: Users },
  { href: "/city", label: "Focus City", icon: Building2 },
  { href: "/break-free", label: "Break Free", icon: Flame },
  { href: "/achievements", label: "Achievements", icon: Medal },
  { href: "/shop", label: "Rewards", icon: Gift },
];

const EASE = [0.16, 1, 0.3, 1] as const;

export function QuickLaunchOrb() {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(open);

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to the orb so keyboard users stay where they were.
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    // Move focus into the panel once it exists.
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      {/* Floating orb — above the mobile bottom nav, in the thumb corner. */}
      <motion.button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="quick-launch-panel"
        aria-label="Quick launch — explore FocusArx features"
        whileHover={reduceMotion ? undefined : { scale: 1.06 }}
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        className="fixed right-4 z-[var(--z-float)] grid h-14 w-14 place-items-center rounded-full text-[var(--palette-white)] shadow-[0_10px_30px_var(--rgba-124-58-237-0_45)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        style={{
          bottom: "calc(4.5rem + env(safe-area-inset-bottom))",
          background: "linear-gradient(135deg, var(--brand-600), var(--brand-pink))",
        }}
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
        {/* Idle pulse invites the first tap; skipped under reduced motion. */}
        {!open && !reduceMotion && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full"
            animate={{ boxShadow: ["0 0 0 0 var(--rgba-124-58-237-0_4)", "0 0 0 14px transparent"] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeOut" }}
          />
        )}
      </motion.button>

      {open && (
        <>
          {/* Full-area dismiss, the repo's accessible-overlay convention. */}
          <button
            type="button"
            aria-label="Close quick launch"
            onClick={close}
            className="fixed inset-0 z-[var(--z-overlay)] cursor-default bg-[var(--palette-black)]/40 backdrop-blur-[2px]"
          />
          <motion.div
            ref={panelRef}
            id="quick-launch-panel"
            tabIndex={-1}
            role="dialog"
            aria-label="Quick launch — explore FocusArx features"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="fixed right-4 z-[var(--z-overlay)] w-[min(22rem,calc(100vw-2rem))] origin-bottom-right rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 shadow-[0_24px_80px_var(--rgba-0-0-0-0_55)] outline-none"
            style={{ bottom: "calc(9rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Explore FocusArx</p>
                <p className="text-xs text-[var(--foreground-subtle)]">Everything that keeps you coming back</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close quick launch panel"
                className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-hover)] text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LAUNCH_ITEMS.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.href}
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, ease: EASE, delay: reduceMotion ? 0 : 0.03 * i }}
                  >
                    <Link
                      href={item.href}
                      onClick={close}
                      className="flex min-h-14 flex-col items-start justify-center gap-1 rounded-xl border border-transparent bg-[var(--surface-hover)]/60 px-3 py-2.5 transition-colors hover:border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] active:scale-[0.98]"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                          <Icon size={15} />
                        </span>
                        {item.label}
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </>
  );
}
