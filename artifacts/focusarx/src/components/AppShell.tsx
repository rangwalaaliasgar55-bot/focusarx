import { useLocation, Link } from "wouter";
import { useAuth, isAdminUser, getToken } from "@/lib/auth";
import {
  Timer, LayoutDashboard, TrendingUp, Trophy, Star,
  Users, Sparkles, LogOut, LogIn, Menu, X, Shield, BookOpen,
  Dna, Ghost, Sword, Radio, Wind, UserCircle, Flame, Target,
  Bell, BellOff, Users2, Zap, Brain, CheckSquare, MessageSquare,
  ShoppingBag, Flag, Gift, Sun, Moon, Building2, Coins, Package,
  ChevronLeft, ChevronRight, ChevronDown, Settings, MoreHorizontal,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/lib/theme";
import { requestPushPermission, unsubscribePush, isPushSubscribed } from "@/lib/pushNotifications";
import { motion, AnimatePresence } from "framer-motion";
import CoachPanel from "@/components/CoachPanel";
import { useQuery } from "@tanstack/react-query";

async function fetchMissionStats() {
  const token = getToken();
  const res = await fetch("/api/missions", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) return null;
  return res.json();
}

async function fetchNotifCount() {
  const token = getToken();
  if (!token) return null;
  const res = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

function MissionsBadge({ dot }: { dot?: boolean }) {
  const { data } = useQuery({ queryKey: ["missions-badge"], queryFn: fetchMissionStats, staleTime: 60_000, refetchInterval: 120_000 });
  const claimable = (data?.daily ?? []).filter((m: any) => m.completed && !m.rewardClaimed).length
    + (data?.weekly ?? []).filter((m: any) => m.completed && !m.rewardClaimed).length;
  if (!claimable) return null;
  if (dot) return <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-1 ring-[#08090f]" />;
  return <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-black">{claimable}</span>;
}

function NotifBadge({ dot }: { dot?: boolean }) {
  const { data } = useQuery({ queryKey: ["notif-count-nav"], queryFn: fetchNotifCount, staleTime: 30_000, refetchInterval: 60_000 });
  const count = data?.unreadCount ?? 0;
  if (!count) return null;
  if (dot) return <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500 ring-1 ring-[#08090f]" />;
  return <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">{count > 9 ? "9+" : count}</span>;
}

const PRIMARY_NAV = [
  { href: "/",             label: "Focus",        icon: Timer,         shortcut: "1" },
  { href: "/dashboard",    label: "Dashboard",     icon: LayoutDashboard, shortcut: "2" },
  { href: "/habits",       label: "Tasks",         icon: CheckSquare,   shortcut: "t" },
  { href: "/goals",        label: "Goals",         icon: Flag,          shortcut: "g" },
  { href: "/ai-insights",  label: "AI Coach",      icon: Brain,         shortcut: "a", aiBadge: true },
  { href: "/analytics",    label: "Analytics",     icon: TrendingUp,    shortcut: "3" },
  { href: "/achievements", label: "Achievements",  icon: Star,          shortcut: "5" },
  { href: "/social",       label: "Community",     icon: Users,         shortcut: "s" },
  { href: "/profile",      label: "Profile",       icon: UserCircle,    shortcut: "p" },
];

const MORE_NAV = [
  { href: "/missions",     label: "Missions",       icon: Target,       badge: "missions" as const },
  { href: "/quests",       label: "Quests",         icon: Sparkles },
  { href: "/roadmap",      label: "AI Roadmap",     icon: Sparkles,     aiBadge: true },
  { href: "/leaderboard",  label: "Leaderboard",    icon: Trophy },
  { href: "/groups",       label: "Study Groups",   icon: Users2 },
  { href: "/messages",     label: "Messages",       icon: MessageSquare },
  { href: "/study-rooms",  label: "Study Rooms",    icon: Radio },
  { href: "/notifications",label: "Notifications",  icon: Bell,         badge: "notif" as const },
  { href: "/wallet",       label: "Wallet & XP",    icon: Coins },
  { href: "/shop",         label: "Coin Shop",      icon: ShoppingBag },
  { href: "/marketplace",  label: "Marketplace",    icon: ShoppingBag },
  { href: "/lootboxes",    label: "Loot Boxes",     icon: Gift },
  { href: "/battle-pass",  label: "Battle Pass",    icon: Zap },
  { href: "/referral",     label: "Refer Friends",  icon: Gift },
  { href: "/premium",      label: "Premium",        icon: Zap },
  { href: "/pets",         label: "Pet Companion",  icon: Star },
  { href: "/city",         label: "Focus City",     icon: Building2 },
  { href: "/break-free",   label: "Break Free",     icon: Flame },
  { href: "/breathe",      label: "Breathe",        icon: Wind },
  { href: "/dreams",       label: "My Dreams",      icon: Star },
  { href: "/wrapped",      label: "Wrapped",        icon: Package },
  { href: "/focus-dna",    label: "Focus DNA",      icon: Dna },
  { href: "/ghosts",       label: "Ghost Mode",     icon: Ghost },
  { href: "/consequences", label: "Consequences",   icon: Sword },
  { href: "/distractions", label: "Focus Journal",  icon: BookOpen },
  { href: "/replay",       label: "Session Replay", icon: Radio },
  { href: "/profiles",     label: "Focus Profiles", icon: Shield },
  { href: "/forge",        label: "Forge Room",     icon: Users },
];

const MOBILE_BOTTOM = [
  { href: "/",             label: "Focus",       icon: Timer },
  { href: "/dashboard",    label: "Home",        icon: LayoutDashboard },
  { href: "/habits",       label: "Tasks",       icon: CheckSquare },
  { href: "/achievements", label: "Wins",        icon: Star },
  { href: "/profile",      label: "Me",          icon: UserCircle },
];

const NO_SHELL_ALWAYS = ["/login", "/signup", "/forgot-password", "/reset-password", "/admin", "/auth/callback"];

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  shortcut?: string;
  aiBadge?: boolean;
  badge?: "missions" | "notif";
  onClick?: () => void;
  collapsed?: boolean;
  small?: boolean;
}

function NavItem({ href, label, icon: Icon, active, aiBadge, badge, onClick, collapsed, small }: NavItemProps) {
  if (collapsed) {
    return (
      <div className="group relative flex justify-center py-0.5">
        <Link
          href={href}
          onClick={onClick}
          className={`relative flex items-center justify-center rounded-lg h-9 w-9 transition-all duration-150 ${
            active
              ? "bg-[rgba(124,58,237,0.18)] text-[#A78BFA]"
              : "text-[#4B5563] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#94A3B8]"
          }`}
        >
          {active && <span className="absolute left-0 top-1/2 h-[55%] w-0.5 -translate-y-1/2 rounded-r bg-[#7C3AED]" />}
          <Icon size={16} />
          {badge === "missions" && <MissionsBadge dot />}
          {badge === "notif" && <NotifBadge dot />}
        </Link>
        <div className="pointer-events-none absolute left-full top-1/2 ml-2.5 -translate-y-1/2 z-[200] whitespace-nowrap rounded-md bg-[#0d0f1c] border border-[rgba(255,255,255,0.08)] px-2.5 py-1 text-xs font-medium text-[#E2E8F0] opacity-0 group-hover:opacity-100 transition-opacity duration-100 shadow-xl">
          {label}
          {aiBadge && <span className="ml-1.5 text-[8px] font-bold text-[#A78BFA]">AI</span>}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all duration-150 ${
        small ? "text-[11px]" : "text-[13px]"
      } font-medium ${
        active
          ? "bg-[rgba(124,58,237,0.15)] text-[#C4B5FD]"
          : "text-[#52586B] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#94A3B8]"
      }`}
    >
      {active && <span className="absolute left-0 top-1/2 h-[55%] w-0.5 -translate-y-1/2 rounded-r bg-[#7C3AED]" />}
      <Icon size={small ? 14 : 15} className={`shrink-0 ${active ? "text-[#A78BFA]" : "text-[#374151] group-hover:text-[#6B7280]"}`} />
      <span className="flex-1 truncate leading-none">{label}</span>
      {badge === "missions" && <MissionsBadge />}
      {badge === "notif" && <NotifBadge />}
      {aiBadge && !badge && <span className="rounded-sm bg-[rgba(124,58,237,0.25)] px-1 py-0.5 text-[8px] font-bold text-[#A78BFA] uppercase tracking-wider">AI</span>}
    </Link>
  );
}

function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const s = size === "sm" ? 7 : 8;
  return (
    <div className={`relative flex h-${s} w-${s} shrink-0 items-center justify-center rounded-xl overflow-hidden`}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#7c3aed] to-[#4f46e5]" />
      <svg viewBox="0 0 24 24" fill="white" className="relative z-10 h-4 w-4">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: session, status, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const [pushEnabled, setPushEnabled] = useState(() => isPushSubscribed());
  const [pushLoading, setPushLoading] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [mobileMoreExpanded, setMobileMoreExpanded] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("fx-sidebar-collapsed") === "true"; } catch { return false; }
  });

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("fx-sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const update = () => {
      const w = sidebarCollapsed ? "58px" : "260px";
      document.documentElement.style.setProperty("--sidebar-width", w);
      document.documentElement.style.setProperty("--sidebar-ml", window.innerWidth >= 768 ? w : "0px");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const token = getToken();
    if (!token) return;
    fetch("/api/sessions/active", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => {
        if (data?.id) {
          setSidebarCollapsed(true);
          try { localStorage.setItem("fx-sidebar-collapsed", "true"); } catch {}
        }
      })
      .catch(() => {});
  }, [location, status]);

  const handlePushToggle = async () => {
    setPushLoading(true);
    try {
      if (pushEnabled) { await unsubscribePush(); setPushEnabled(false); }
      else { await requestPushPermission(); setPushEnabled(true); }
    } catch { /* user denied */ }
    setPushLoading(false);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKeyDown); document.body.style.overflow = ""; };
  }, [mobileOpen, handleKeyDown]);
  useEffect(() => { setMobileOpen(false); }, [location]);

  if (NO_SHELL_ALWAYS.some((p) => location === p || location.startsWith(p))) return <>{children}</>;
  if (location === "/" && status !== "authenticated") return <>{children}</>;

  const user = session?.user;
  const initials = user ? (user.name?.slice(0, 2) || user.email?.slice(0, 2) || "??").toUpperCase() : "??";
  const userName = user?.name || user?.email?.split("@")[0] || "User";

  const renderNav = (onClick?: () => void, collapsed?: boolean) => (
    <>
      <div className={`space-y-0.5 ${collapsed ? "flex flex-col items-center px-1" : "px-2"}`}>
        {PRIMARY_NAV.map((item) => (
          <NavItem key={item.href} {...item} active={location === item.href} onClick={onClick} collapsed={collapsed} />
        ))}
      </div>

      {/* More section */}
      <div className={`mt-1 ${collapsed ? "px-1" : "px-2"}`}>
        <div className={`h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.06)] to-transparent mb-1`} />
        {!collapsed ? (
          <>
            <button
              onClick={() => onClick ? setMobileMoreExpanded(v => !v) : setMoreExpanded(v => !v)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-[rgba(255,255,255,0.28)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#6B7280] transition-all duration-150"
            >
              <MoreHorizontal size={15} className="shrink-0" />
              <span className="flex-1 text-left">More features</span>
              <ChevronDown
                size={12}
                className={`transition-transform duration-200 ${(onClick ? mobileMoreExpanded : moreExpanded) ? "rotate-180" : ""}`}
              />
            </button>
            <AnimatePresence initial={false}>
              {(onClick ? mobileMoreExpanded : moreExpanded) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-0.5 pt-0.5">
                    {MORE_NAV.map((item) => (
                      <NavItem key={item.href} {...item} active={location === item.href} onClick={onClick} small />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            {MORE_NAV.slice(0, 8).map((item) => (
              <NavItem key={item.href} {...item} active={location === item.href} onClick={onClick} collapsed />
            ))}
          </div>
        )}
      </div>

      {isAdminUser(user) && (
        <div className={`mt-1 ${collapsed ? "px-1" : "px-2"}`}>
          <div className="h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.06)] to-transparent mb-1" />
          <NavItem href="/admin" label="Admin" icon={Shield} active={location === "/admin"} onClick={onClick} collapsed={collapsed} />
        </div>
      )}
    </>
  );

  return (
    <div className="flex min-h-[100dvh] bg-[#080A14]">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside
        className="app-sidebar hidden md:flex flex-col"
        style={{
          width: sidebarCollapsed ? "58px" : "260px",
          transition: "width 0.25s cubic-bezier(0.22,1,0.36,1)",
          background: "linear-gradient(180deg, #09091A 0%, #07080F 100%)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Logo */}
        <div className={`flex h-14 shrink-0 items-center border-b border-[rgba(255,255,255,0.05)] ${sidebarCollapsed ? "justify-center px-2" : "gap-3 px-4"}`}>
          <Logo />
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold tracking-tight text-white leading-none">FocusArx</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#2D3748] mt-0.5">Productivity OS</p>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center rounded-lg p-1.5 text-[#2D3748] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#6B7280]"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 scrollbar-none">
          {renderNav(undefined, sidebarCollapsed)}
        </nav>

        {/* User section */}
        <div className={`border-t border-[rgba(255,255,255,0.05)] py-3 space-y-1 ${sidebarCollapsed ? "px-1" : "px-2"}`}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-[rgba(255,255,255,0.28)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#6B7280] transition-colors"
              >
                {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              {"Notification" in window && (
                <button
                  onClick={handlePushToggle}
                  disabled={pushLoading}
                  className={`flex items-center justify-center rounded-lg p-1.5 transition-colors disabled:opacity-40 ${pushEnabled ? "text-emerald-500" : "text-[rgba(255,255,255,0.28)] hover:text-[#6B7280] hover:bg-[rgba(255,255,255,0.04)]"}`}
                  title={pushEnabled ? "Notifications on" : "Enable notifications"}
                >
                  {pushEnabled ? <Bell size={13} /> : <BellOff size={13} />}
                </button>
              )}
            </div>
          )}

          {status === "authenticated" && user ? (
            <>
              <Link href="/profile">
                <div className={`flex items-center rounded-lg cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.04)] py-2 ${sidebarCollapsed ? "justify-center px-1" : "gap-2.5 px-2.5"}`}>
                  <div className="relative h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center text-[10px] font-bold text-white">
                    {initials}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-[#09091A]" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-[#94A3B8]">{userName}</p>
                    </div>
                  )}
                </div>
              </Link>
              <button
                onClick={() => void signOut()}
                className={`flex w-full items-center rounded-lg py-1.5 text-[12px] text-[#2D3748] transition-colors hover:bg-[rgba(239,68,68,0.06)] hover:text-[#F87171] ${sidebarCollapsed ? "justify-center px-1" : "gap-2 px-2.5"}`}
                title="Sign out"
              >
                <LogOut size={12} />
                {!sidebarCollapsed && "Sign out"}
              </button>
            </>
          ) : (
            <Link href="/login">
              <div className={`flex items-center rounded-lg py-2 text-[12px] text-[rgba(255,255,255,0.28)] hover:text-[#94A3B8] hover:bg-[rgba(255,255,255,0.04)] transition-colors ${sidebarCollapsed ? "justify-center px-1" : "gap-2 px-2.5"}`}>
                <LogIn size={13} />
                {!sidebarCollapsed && "Sign in"}
              </div>
            </Link>
          )}

          {!sidebarCollapsed && (
            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 px-2.5 pt-1">
              {[["Privacy", "/privacy"], ["Terms", "/terms"], ["Support", "/support"]].map(([l, h]) => (
                <Link key={h} href={h} className="text-[9px] text-[rgba(255,255,255,0.18)] hover:text-[rgba(255,255,255,0.28)] transition-colors">{l}</Link>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── MOBILE HEADER ── */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[rgba(255,255,255,0.05)] bg-[rgba(8,9,20,0.96)] px-4 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <span className="text-[14px] font-bold text-white tracking-tight">FocusArx</span>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/notifications" className="relative rounded-lg p-2 text-[#4B5563]">
            <Bell size={17} />
            <NotifBadge dot />
          </Link>
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-[#4B5563] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#94A3B8]"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* ── MOBILE DRAWER ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="bd"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col md:hidden"
              style={{ background: "linear-gradient(180deg, #09091A 0%, #07080F 100%)", borderRight: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="flex h-14 items-center justify-between border-b border-[rgba(255,255,255,0.05)] px-4">
                <div className="flex items-center gap-2.5"><Logo size="sm" /><span className="text-[14px] font-bold text-white">FocusArx</span></div>
                <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-[rgba(255,255,255,0.28)] hover:text-[#94A3B8]" aria-label="Close">
                  <X size={17} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto py-3 scrollbar-none">
                {renderNav(() => setMobileOpen(false), false)}
              </nav>

              <div className="border-t border-[rgba(255,255,255,0.05)] px-2 py-3 space-y-1">
                {status === "authenticated" && user ? (
                  <>
                    <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 mb-1">
                      <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center text-[10px] font-bold text-white">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-[#94A3B8]">{userName}</p>
                        <p className="truncate text-[10px] text-[#2D3748]">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { void signOut(); setMobileOpen(false); }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-[rgba(255,255,255,0.28)] hover:bg-[rgba(239,68,68,0.06)] hover:text-[#F87171] transition-colors"
                    >
                      <LogOut size={12} /> Sign out
                    </button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-[rgba(255,255,255,0.28)] hover:text-[#94A3B8] transition-colors">
                    <LogIn size={13} /> Sign in
                  </Link>
                )}
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-[rgba(255,255,255,0.28)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#6B7280] transition-colors"
                >
                  {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── MOBILE BOTTOM TAB BAR ── */}
      <nav className="app-bottom-nav flex items-center justify-around md:hidden">
        {MOBILE_BOTTOM.map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center gap-1 px-4 py-2 transition-colors ${active ? "text-[#A78BFA]" : "text-[#2D3748]"}`}
            >
              {active && (
                <motion.div
                  layoutId="mobile-tab-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-[#7C3AED]"
                />
              )}
              <motion.div whileTap={{ scale: 0.85 }} transition={{ type: "spring", stiffness: 500 }}>
                <Icon size={20} />
              </motion.div>
              <span className="text-[9px] font-semibold tracking-wide">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main
        id="main-content"
        className="flex-1 pt-14 pb-16 md:pt-0 md:pb-0 min-w-0 overflow-x-hidden"
        style={{
          marginLeft: "var(--sidebar-ml, 0px)",
          transition: "margin-left 0.25s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {children}
      </main>

      {status === "authenticated" && <CoachPanel />}
    </div>
  );
}
