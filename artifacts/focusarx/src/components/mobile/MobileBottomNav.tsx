
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Timer,
  CheckSquare2,
  Target,
  UserRound,
  MoreHorizontal,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";

async function fetchClaimableMissions(): Promise<number> {
  if (!getToken()) return 0;
  const response = await apiFetch("/api/missions");
  if (!response.ok) return 0;
  const data = await response.json();
  return [...(data?.daily ?? []), ...(data?.weekly ?? [])].filter(
    (m: { completed?: boolean; rewardClaimed?: boolean }) => m.completed && !m.rewardClaimed,
  ).length;
}

type Tab = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  primary?: boolean;
  badge?: "missions";
};

const PRIMARY_TABS: Tab[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Plan", icon: CheckSquare2 },
  { href: "/", label: "Timer", icon: Timer, primary: true },
  // Analytics is premium-gated; a primary tab must never land free users on
  // a paywall. Missions is useful to everyone and carries the claim badge.
  { href: "/missions", label: "Missions", icon: Target, badge: "missions" },
  { href: "/profile", label: "Profile", icon: UserRound },
];

interface MobileBottomNavProps {
  onMoreClick?: () => void;
  hidden?: boolean;
}

export function MobileBottomNav({ onMoreClick, hidden }: MobileBottomNavProps) {
  const [location] = useLocation();
  const [isFocusMode, setIsFocusMode] = useState(() => typeof document !== "undefined" && !!document.querySelector("[data-focus-mode='active']"));

  // Listen for focus mode events to auto-hide. Both timer implementations
  // (Timer.tsx and FocusTimerMobileFirst.tsx) dispatch these events, so no
  // polling is needed; a one-time mount check covers the case where this nav
  // mounts while a focus session is already active.
  useEffect(() => {
    const handleFocusStart = () => setIsFocusMode(true);
    const handleFocusStop = () => setIsFocusMode(false);
    window.addEventListener("fx:focus-start", handleFocusStart);
    window.addEventListener("fx:focus-stop", handleFocusStop);
    return () => {
      window.removeEventListener("fx:focus-start", handleFocusStart);
      window.removeEventListener("fx:focus-stop", handleFocusStop);
    };
  }, []);

  const shouldHide = hidden || isFocusMode;
  const { data: claimable = 0 } = useQuery({
    queryKey: ["missions-badge"],
    queryFn: fetchClaimableMissions,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  return (
    <nav
      className={cn(
        "app-bottom-nav fixed inset-x-0 bottom-0 z-[var(--z-nav)] flex md:hidden",
        "border-t border-[var(--border-subtle)] bg-[var(--backdrop)] backdrop-blur-[24px] saturate-[150%]",
        "transition-transform duration-300 ease-out",
        shouldHide ? "translate-y-full pointer-events-none" : "translate-y-0"
      )}
      aria-label="Mobile navigation"
      style={{
        height: "calc(4.5rem + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {PRIMARY_TABS.map((tab) => {
        const Icon = tab.icon;
        const active = location === tab.href || (tab.href === "/" && location === "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "mobile-tab relative flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5",
              "text-[0.625rem] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-2",
              active ? "text-[var(--brand-strong)]" : "text-[var(--foreground-subtle)] hover:text-[var(--foreground)]",
              tab.primary && "mobile-tab-primary"
            )}
            aria-current={active ? "page" : undefined}
            aria-label={tab.label}
          >
            {active && (
              <motion.span
                layoutId="mobile-nav-active"
                className="mobile-tab-indicator absolute -top-0.5 h-0.5 w-6 rounded-full bg-[var(--brand-500)]"
              />
            )}
            <span
              className={cn(
                "mobile-tab-icon relative grid h-8 w-8 place-items-center rounded-[var(--radius-md)] transition-all",
                active && "bg-[var(--brand-soft)]",
                tab.primary && active && "bg-transparent",
                tab.primary
                  ? "h-10 w-10 rounded-[1.1rem] bg-gradient-to-br from-[var(--brand-500)] to-[var(--brand-700)] text-white shadow-[var(--shadow-violet-sm)]"
                  : ""
              )}
            >
              <Icon size={tab.primary ? 22 : 20} />
              {tab.badge === "missions" && claimable > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--brand-600)] px-1 text-[0.6rem] font-bold leading-none text-white ring-2 ring-[var(--backdrop)]"
                  aria-label={`${claimable} reward${claimable === 1 ? "" : "s"} to claim`}
                >
                  {claimable > 9 ? "9+" : claimable}
                </span>
              )}
            </span>
            <span className="leading-none tracking-tight">{tab.label}</span>
          </Link>
        );
      })}
      {onMoreClick && (
        <button
          type="button"
          onClick={onMoreClick}
          className={cn(
            "mobile-tab relative flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5",
            "text-[0.625rem] font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-2",
            "text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
          )}
          aria-label="More options"
        >
          <span className="mobile-tab-icon grid h-8 w-8 place-items-center rounded-[var(--radius-md)] transition-all">
            <MoreHorizontal size={20} />
          </span>
          <span className="leading-none tracking-tight">More</span>
        </button>
      )}
    </nav>
  );
}

// Secondary more menu trigger - optional floating button for secondary items
export function MobileMoreTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="More options"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-[var(--z-nav)] grid h-11 w-11 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] shadow-lg md:hidden"
    >
      <MoreHorizontal size={20} />
    </button>
  );
}
