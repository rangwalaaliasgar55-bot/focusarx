import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  CheckSquare2,
  ChevronDown,
  Flame,
  Gift,
  Goal,
  GraduationCap,
  History,
  LayoutDashboard,
  Library,
  LogIn,
  LogOut,
  Medal,
  Menu,
  MessageCircle,
  Moon,
  Crown,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Target,
  Timer,
  Trophy,
  UserRound,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, getToken, isAdminUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import CoachPanel from "@/components/CoachPanel";
import { usePremium } from "@/hooks/usePremium";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { MobileMoreMenu } from "@/components/mobile/MobileMoreMenu";
import { NetworkStatusBanner } from "@/components/mobile/NetworkStatusBanner";

interface NavEntry {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  badge?: "missions" | "notifications";
  admin?: boolean;
  premium?: boolean;
}

interface NavGroup {
  label: string;
  entries: NavEntry[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    entries: [
      { href: "/", label: "Focus", icon: Timer },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/tasks", label: "Tasks", icon: CheckSquare2 },
      { href: "/goals", label: "Goals", icon: Goal },
    ],
  },
  {
    label: "Learn",
    entries: [
      { href: "/flashcards", label: "Flashcards", icon: Library },
      { href: "/forge-room", label: "Study room", icon: GraduationCap },
      { href: "/ai-insights", label: "AI coach", icon: Brain, premium: true },
      { href: "/analytics", label: "Analytics", icon: BarChart3, premium: true },
      { href: "/session-replay", label: "Session replay", icon: History },
    ],
  },
  {
    label: "Momentum",
    entries: [
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
      { href: "/missions", label: "Missions", icon: Target, badge: "missions" },
      { href: "/achievements", label: "Achievements", icon: Medal },
      { href: "/break-free", label: "Break Free", icon: Flame },
      { href: "/social", label: "Community", icon: Users },
    ],
  },
  {
    label: "More",
    entries: [
      { href: "/habits", label: "Habits", icon: Sparkles },
      { href: "/messages", label: "Messages", icon: MessageCircle },
      { href: "/wallet", label: "Wallet & XP", icon: WalletCards },
      { href: "/shop", label: "Rewards", icon: Gift },
      { href: "/focus-guide", label: "Focus guides", icon: BookOpen },
      { href: "/admin", label: "Admin", icon: Shield, admin: true },
    ],
  },
];

const NO_SHELL = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/admin",
  "/welcome",
];

async function fetchMissionCount() {
  const token = getToken();
  const response = await fetch("/api/missions", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) return 0;
  const data = await response.json();
  return [...(data?.daily ?? []), ...(data?.weekly ?? [])].filter(
    (mission: { completed?: boolean; rewardClaimed?: boolean }) => mission.completed && !mission.rewardClaimed,
  ).length;
}

async function fetchNotificationCount() {
  const token = getToken();
  if (!token) return 0;
  const response = await fetch("/api/notifications", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return 0;
  return (await response.json())?.unreadCount ?? 0;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-3" aria-label="FocusArx dashboard">
      <span className="brand-mark" aria-hidden="true">
        <Zap size={compact ? 16 : 18} fill="currentColor" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold tracking-tight text-[var(--foreground)]">FocusArx</span>
          <span className="block truncate text-[0.6875rem] font-medium text-[var(--foreground-subtle)]">Deep work, made clear</span>
        </span>
      )}
    </Link>
  );
}

function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--brand-soft)] px-1.5 py-0.5 text-[0.625rem] font-bold tabular-nums text-[var(--brand-strong)]">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { data: user } = useAuth();
  const { isPremium } = usePremium();
  const { data: missionCount = 0 } = useQuery({
    queryKey: ["missions-badge"],
    queryFn: fetchMissionCount,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Primary navigation">
      {NAV_GROUPS.map((group) => {
        const entries = group.entries.filter((entry) => !entry.admin || isAdminUser(user?.user));
        if (!entries.length) return null;
        return (
          <section key={group.label} aria-labelledby={`nav-${group.label.toLowerCase()}`}>
            <h2
              id={`nav-${group.label.toLowerCase()}`}
              className="mb-2 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]"
            >
              {group.label}
            </h2>
            <div className="space-y-1">
              {entries.map((entry) => {
                const Icon = entry.icon;
                const active = location === entry.href;
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn("nav-item min-h-[44px]", active && "nav-item-active")}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span className="truncate">{entry.label}</span>
                    {entry.badge === "missions" && <CountBadge count={missionCount} />}
                    {entry.premium && !isPremium && (
                      <Crown size={12} className="ml-auto shrink-0 text-[var(--palette-amber-400)]" aria-label="Premium" />
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}

function UserMenu({ compact = false }: { compact?: boolean }) {
  const { data, status, signOut } = useAuth();
  const [theme, setTheme] = useTheme();
  const user = data?.user;
  const label = user?.name || user?.email?.split("@")[0] || "Account";
  const initials = (user?.name || user?.email || "FA")
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  if (status !== "authenticated") {
    return (
      <Button asChild variant="outline" className={cn(compact && "w-11 px-0", "min-h-[44px]")}>
        <Link href="/login" aria-label="Sign in">
          <LogIn /> {!compact && "Sign in"}
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn("h-11 min-h-[44px] justify-start px-2", compact ? "w-11" : "w-full")} aria-label="Open user menu">
          <Avatar className="h-8 w-8 border border-[var(--border-strong)]">
            <AvatarFallback className="bg-[var(--brand-soft)] text-xs font-bold text-[var(--brand-strong)]">{initials}</AvatarFallback>
          </Avatar>
          {!compact && (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-[var(--foreground)]">{label}</span>
                <span className="block truncate text-xs font-normal text-[var(--foreground-subtle)]">View profile</span>
              </span>
              <ChevronDown size={15} />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuLabel>
          <span className="block truncate">{label}</span>
          <span className="block truncate text-xs font-normal text-[var(--foreground-subtle)]">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/profile"><UserRound /> Profile</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/notifications"><Bell /> Notifications</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/profile"><Settings /> Settings</Link></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun /> : <Moon />} {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-[var(--danger)]" onSelect={() => void signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { focusSessionsToday } = useSessionHistory();
  const { data: notificationCount = 0 } = useQuery({
    queryKey: ["notif-count-nav"],
    queryFn: fetchNotificationCount,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const openPalette = useCallback(() => {
    window.dispatchEvent(new CustomEvent("focusarx:open-command"));
  }, []);

  return (
    <header className="app-topbar">
      <div className="flex items-center gap-2 md:hidden">
        <Button variant="ghost" size="icon" onClick={onMenu} aria-label="Open navigation" className="min-h-[44px] min-w-[44px]">
          <Menu />
        </Button>
        <Brand compact />
      </div>

      <button type="button" onClick={openPalette} className="global-search min-h-[44px]" aria-label="Open global search">
        <Search size={17} aria-hidden="true" />
        <span className="hidden sm:inline">Search FocusArx</span>
        <kbd className="ml-auto hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-0.5 text-[0.6875rem] text-[var(--foreground-subtle)] sm:inline">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <div className="streak-pill min-h-[36px]" aria-label={`${focusSessionsToday} focus sessions today`}>
          <Flame size={16} aria-hidden="true" />
          <span className="tabular-nums">{focusSessionsToday}</span>
          <span className="hidden lg:inline">today</span>
        </div>
        <Button asChild variant="ghost" size="icon" className="relative min-h-[44px] min-w-[44px]" aria-label="Notifications">
          <Link href="/notifications">
            <Bell />
            {!!notificationCount && <span className="notification-dot" aria-label={`${notificationCount} unread`} />}
          </Link>
        </Button>
        <div className="hidden sm:block"><UserMenu compact /></div>
      </div>
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { status } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isFocusActive, setIsFocusActive] = useState(false);

  useEffect(() => setMobileOpen(false), [location]);

  useEffect(() => {
    const handleStart = () => setIsFocusActive(true);
    const handleStop = () => setIsFocusActive(false);
    window.addEventListener("fx:focus-start", handleStart);
    window.addEventListener("fx:focus-stop", handleStop);
    return () => {
      window.removeEventListener("fx:focus-start", handleStart);
      window.removeEventListener("fx:focus-stop", handleStop);
    };
  }, []);

  const isFocusPage = location === "/";
  const hideBottomNav = isFocusPage && isFocusActive;

  if (NO_SHELL.some((path) => location === path || location.startsWith(`${path}/`))) return <>{children}</>;
  if (location === "/" && status !== "authenticated") return <>{children}</>;

  return (
    <div className="app-frame">
      <NetworkStatusBanner />
      {/*
        Keyboard and screen-reader users otherwise have to tab through the
        entire sidebar on every page load before reaching the content. The
        .skip-to-content styling already existed but was never rendered, so the
        shortcut was styled and unreachable.
      */}
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>

      <aside className="app-sidebar hidden md:flex" aria-label="Application sidebar">
        <div className="flex h-[4.5rem] shrink-0 items-center border-b border-[var(--border)] px-5">
          <Brand />
        </div>
        <Navigation />
        <div className="border-t border-[var(--border)] p-3">
          <UserMenu />
          <div className="mt-2 flex gap-3 px-2 text-[0.6875rem] text-[var(--foreground-subtle)]">
            <Link href="/support" className="hover:text-[var(--foreground)]">Help</Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)]">Privacy</Link>
          </div>
        </div>
      </aside>

      <div className="app-workspace">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main id="main-content" className="app-main" tabIndex={-1}>{children}</main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-[min(90vw,22rem)] flex-col p-0">
          <SheetHeader className="border-b border-[var(--border)] px-5 py-4 text-left">
            <SheetTitle><Brand /></SheetTitle>
            <SheetDescription className="sr-only">Navigate FocusArx</SheetDescription>
          </SheetHeader>
          <Navigation onNavigate={() => setMobileOpen(false)} />
          <div className="border-t border-[var(--border)] p-3"><UserMenu /></div>
        </SheetContent>
      </Sheet>

      {/* New mobile bottom nav: Home · Timer · Plan · Stats · Profile */}
      <MobileBottomNav hidden={hideBottomNav} onMoreClick={() => setMoreOpen(true)} />
      <MobileMoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} />
      {status === "authenticated" && <CoachPanel />}
    </div>
  );
}
