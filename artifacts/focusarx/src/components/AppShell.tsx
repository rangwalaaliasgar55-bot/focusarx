import { useLocation, Link } from "wouter";
import { useAuth, isAdminUser, getToken } from "@/lib/auth";
import {
  Timer, LayoutDashboard, TrendingUp, Trophy, Star,
  Users, Sparkles, LogOut, LogIn, Menu, X, Shield, BookOpen,
  Dna, Ghost, Sword, Radio, Wind, UserCircle, Info, Flame, Target,
  Bell, BellOff, Users2, Zap, Brain, Network, CheckSquare, MessageSquare, ShoppingBag, Flag, Gift, Sun, Moon,
  Building2, Coins, Package, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "@/lib/theme";
import { requestPushPermission, unsubscribePush, isPushSubscribed } from "@/lib/pushNotifications";
import { motion, AnimatePresence } from "framer-motion";
import CoachPanel from "@/components/CoachPanel";
import { useQuery } from "@tanstack/react-query";

function InfoTooltip() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);
  return (
    <div ref={ref} className="relative flex items-center">
      <button onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onClick={() => setOpen((v) => !v)} aria-label="What is FocusArx?" className="flex items-center justify-center rounded-lg p-1.5 text-[#4B5563] transition-colors hover:bg-[rgba(124,58,237,0.12)] hover:text-[#A78BFA]">
        <Info size={14} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.97 }} transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-8 top-1/2 -translate-y-1/2 z-[200] w-64 rounded-xl border border-[rgba(124,58,237,0.2)] bg-[#0d0f1c] p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#7C3AED] mb-1.5">What is FocusArx?</p>
            <p className="text-xs text-[#94A3B8] leading-relaxed">An AI-powered deep-work environment that tracks your attention in real-time, gamifies your focus sessions, and builds lasting study habits.</p>
            <p className="text-[11px] text-[#4B5563] mt-1.5">Built for students, developers &amp; creators.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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

function MissionsBadge({ compact }: { compact?: boolean }) {
  const { data } = useQuery({ queryKey: ["missions-badge"], queryFn: fetchMissionStats, staleTime: 60_000, refetchInterval: 120_000 });
  const claimable = (data?.daily ?? []).filter((m: any) => m.completed && !m.rewardClaimed).length
    + (data?.weekly ?? []).filter((m: any) => m.completed && !m.rewardClaimed).length;
  if (!claimable) return null;
  if (compact) return <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#22d387] ring-1 ring-[#08090f]" />;
  return <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-[#22d387] text-[9px] font-bold text-black shrink-0">{claimable}</span>;
}

function NotifBadge({ compact }: { compact?: boolean }) {
  const { data } = useQuery({ queryKey: ["notif-count-nav"], queryFn: fetchNotifCount, staleTime: 30_000, refetchInterval: 60_000 });
  const count = data?.unreadCount ?? 0;
  if (!count) return null;
  if (compact) return <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 ring-1 ring-[#08090f]" />;
  return <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shrink-0">{count > 9 ? "9+" : count}</span>;
}

const NAV_ITEMS = [
  { href: "/",              label: "Timer",          icon: Timer,          shortcut: "1", group: "core" },
  { href: "/dashboard",     label: "Dashboard",      icon: LayoutDashboard,shortcut: "2", group: "core" },
  { href: "/missions",      label: "Missions",       icon: Target,         shortcut: "m", badge: "missions", group: "core" },
  { href: "/quests",        label: "Quests",         icon: Sparkles,       shortcut: "q", group: "core" },
  { href: "/habits",        label: "Habits",         icon: CheckSquare,    shortcut: "h", group: "core" },
  { href: "/goals",         label: "Goals",          icon: Flag,           shortcut: "g", group: "core" },
  { href: "/social",        label: "Social",         icon: Network,        shortcut: "s", group: "social" },
  { href: "/groups",        label: "Study Groups",   icon: Users2,         shortcut: "",  group: "social" },
  { href: "/messages",      label: "Messages",       icon: MessageSquare,  shortcut: "",  group: "social" },
  { href: "/study-rooms",   label: "Study Rooms",    icon: Radio,          shortcut: "",  group: "social" },
  { href: "/leaderboard",   label: "Leaderboard",    icon: Trophy,         shortcut: "4", group: "social" },
  { href: "/notifications", label: "Notifications",  icon: Bell,           shortcut: "n", badge: "notif", group: "social" },
  { href: "/pets",          label: "Pet Companion",  icon: Star,           shortcut: "",  group: "engage" },
  { href: "/city",          label: "Focus City",     icon: Building2,      shortcut: "",  group: "engage" },
  { href: "/marketplace",   label: "Marketplace",    icon: ShoppingBag,    shortcut: "",  group: "engage" },
  { href: "/lootboxes",     label: "Loot Boxes",     icon: Gift,           shortcut: "",  group: "engage" },
  { href: "/premium",       label: "Premium",        icon: Zap,            shortcut: "",  group: "engage" },
  { href: "/wallet",        label: "Wallet & XP",    icon: Coins,          shortcut: "",  group: "engage" },
  { href: "/shop",          label: "Coin Shop",      icon: ShoppingBag,    shortcut: "",  group: "engage" },
  { href: "/battle-pass",   label: "Battle Pass",    icon: Zap,            shortcut: "",  group: "engage" },
  { href: "/referral",      label: "Refer Friends",  icon: Gift,           shortcut: "",  group: "engage" },
  { href: "/ai-insights",   label: "AI Insights",    icon: Brain,          shortcut: "",  aiBadge: true, group: "engage" },
  { href: "/roadmap",       label: "AI Roadmap",     icon: Sparkles,       shortcut: "7", aiBadge: true, group: "engage" },
  { href: "/analytics",     label: "Analytics",      icon: TrendingUp,     shortcut: "3", group: "engage" },
  { href: "/achievements",  label: "Achievements",   icon: Star,           shortcut: "5", group: "engage" },
  { href: "/break-free",    label: "Break Free",     icon: Flame,          shortcut: "",  group: "tools" },
  { href: "/breathe",       label: "Breathe",        icon: Wind,           shortcut: "",  group: "tools" },
  { href: "/dreams",        label: "My Dreams",      icon: Star,           shortcut: "",  group: "tools" },
  { href: "/wrapped",       label: "Wrapped",        icon: Package,        shortcut: "",  group: "tools" },
  { href: "/focus-dna",     label: "Focus DNA",      icon: Dna,            shortcut: "0", group: "tools" },
  { href: "/ghosts",        label: "Ghost Mode",     icon: Ghost,          shortcut: "",  group: "tools" },
  { href: "/consequences",  label: "Consequences",   icon: Sword,          shortcut: "",  group: "tools" },
  { href: "/distractions",  label: "Focus Journal",  icon: BookOpen,       shortcut: "9", group: "tools" },
  { href: "/replay",        label: "Session Replay", icon: Radio,          shortcut: "",  group: "tools" },
  { href: "/profile",       label: "Profile",        icon: UserCircle,     shortcut: "",  group: "tools" },
  { href: "/profiles",      label: "Focus Profiles", icon: Shield,         shortcut: "8", group: "tools" },
  { href: "/forge",         label: "Forge Room",     icon: Users,          shortcut: "6", group: "tools" },
];

const NAV_GROUPS = [
  { id: "core",   label: "Core" },
  { id: "social", label: "Social" },
  { id: "engage", label: "Growth" },
  { id: "tools",  label: "Tools" },
];

const NO_SHELL = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/admin", "/auth/callback"];

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  shortcut?: string;
  aiBadge?: boolean;
  badge?: string;
  onClick?: () => void;
  collapsed?: boolean;
}

function NavItem({ href, label, icon: Icon, active, shortcut, aiBadge, badge, onClick, collapsed }: NavItemProps) {
  if (collapsed) {
    return (
      <div className="group relative flex justify-center">
        <Link
          href={href}
          onClick={onClick}
          className={`relative flex items-center justify-center rounded-xl h-10 w-10 transition-all duration-200 ${
            active
              ? "bg-gradient-to-r from-[rgba(124,58,237,0.25)] to-[rgba(79,70,229,0.12)] text-[#A78BFA] shadow-[0_0_20px_rgba(124,58,237,0.18),inset_0_0_12px_rgba(124,58,237,0.06)]"
              : "text-[#94A3B8] hover:bg-[rgba(124,58,237,0.08)] hover:text-[#E2E8F0]"
          }`}
        >
          {active && (
            <>
              <motion.span
                layoutId="nav-pill"
                className="absolute left-0 top-1/2 h-[60%] w-0.5 -translate-y-1/2 rounded-r bg-gradient-to-b from-[#7C3AED] to-[#a78bfa]"
                style={{ boxShadow: "0 0 8px rgba(124,58,237,0.6)" }}
              />
              <motion.span
                className="absolute inset-0 rounded-xl opacity-0"
                animate={{ opacity: [0, 0.06, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                style={{ background: "linear-gradient(90deg, rgba(124,58,237,0.3), transparent)" }}
              />
            </>
          )}
          <Icon size={16} className={`shrink-0 transition-all duration-200 ${active ? "text-[#a78bfa]" : "text-[#4B5563] group-hover:text-[#7C3AED]"}`} />
          {badge === "missions" && <MissionsBadge compact />}
          {badge === "notif" && <NotifBadge compact />}
        </Link>
        {/* Hover tooltip */}
        <div className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 z-[200] whitespace-nowrap rounded-lg border border-[rgba(124,58,237,0.2)] bg-[#0d0f1c] px-2.5 py-1.5 text-xs font-medium text-[#E2E8F0] opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-xl">
          {label}
          {aiBadge && <span className="ml-1.5 rounded-full bg-[rgba(124,58,237,0.2)] border border-[rgba(124,58,237,0.35)] px-1 py-0.5 text-[8px] font-bold text-[#A78BFA] uppercase">AI</span>}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
    >
      <Link href={href} onClick={onClick}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          active
            ? "bg-gradient-to-r from-[rgba(124,58,237,0.25)] to-[rgba(79,70,229,0.12)] text-[#A78BFA] shadow-[0_0_20px_rgba(124,58,237,0.18),inset_0_0_12px_rgba(124,58,237,0.06)]"
            : "text-[#94A3B8] hover:bg-[rgba(124,58,237,0.08)] hover:text-[#E2E8F0]"
        }`}
      >
        {active && (
          <>
            <motion.span
              layoutId="nav-pill"
              className="absolute left-0 top-1/2 h-[60%] w-0.5 -translate-y-1/2 rounded-r bg-gradient-to-b from-[#7C3AED] to-[#a78bfa]"
              style={{ boxShadow: "0 0 8px rgba(124,58,237,0.6)" }}
            />
            <motion.span
              className="absolute inset-0 rounded-xl opacity-0"
              animate={{ opacity: [0, 0.06, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: "linear-gradient(90deg, rgba(124,58,237,0.3), transparent)" }}
            />
          </>
        )}
        <Icon size={15} className={`shrink-0 transition-all duration-200 ${active ? "text-[#a78bfa]" : "text-[#4B5563] group-hover:text-[#7C3AED]"}`} />
        <span className="flex-1 text-xs font-medium">{label}</span>
        {badge === "missions" && <MissionsBadge />}
        {badge === "notif" && <NotifBadge />}
        {aiBadge && !badge && (
          <span className="rounded-full bg-[rgba(124,58,237,0.2)] border border-[rgba(124,58,237,0.35)] px-1.5 py-0.5 text-[8px] font-bold text-[#A78BFA] uppercase tracking-wider">AI</span>
        )}
        {!aiBadge && !badge && shortcut && (
          <span className="ml-auto hidden text-[9px] font-mono text-[#2D3748] group-hover:text-[#4B5563] lg:block bg-[rgba(124,58,237,0.06)] rounded px-1 py-0.5">{shortcut}</span>
        )}
      </Link>
    </motion.div>
  );
}

function SidebarLogo() {
  return (
    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#7c3aed] to-[#4f46e5]" />
      <div className="absolute inset-0 opacity-30"
        style={{ background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 60%)" }} />
      <svg viewBox="0 0 24 24" fill="white" className="relative z-10 h-5 w-5">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <motion.div
        className="absolute inset-0 rounded-xl"
        animate={{ boxShadow: ["0 0 0px rgba(124,58,237,0)", "0 0 16px rgba(124,58,237,0.6)", "0 0 0px rgba(124,58,237,0)"] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // ── Sidebar collapse state (desktop only) ──────────────────────────────────
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

  // Sync CSS variable so main content margin transitions smoothly
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", sidebarCollapsed ? "60px" : "240px");
  }, [sidebarCollapsed]);

  // Auto-collapse when a focus session is actively running
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
  // ───────────────────────────────────────────────────────────────────────────

  const handlePushToggle = async () => {
    setPushLoading(true);
    try {
      if (pushEnabled) { await unsubscribePush(); setPushEnabled(false); }
      else { await requestPushPermission(); setPushEnabled(true); }
    } catch { /* user denied */ }
    setPushLoading(false);
  };

  const toggleGroup = (id: string) =>
    setCollapsedGroups(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleKeyDown = useCallback((e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKeyDown); document.body.style.overflow = ""; };
  }, [mobileOpen, handleKeyDown]);
  useEffect(() => { setMobileOpen(false); }, [location]);

  if (NO_SHELL.some((p) => location === p || location.startsWith(p))) return <>{children}</>;

  const user = session?.user;
  const initials = user ? (user.name?.slice(0, 2) || user.email?.slice(0, 2) || "?").toUpperCase() : "?";

  const renderNavGroup = (onClick?: () => void, collapsed?: boolean) => (
    <>
      {NAV_GROUPS.map((group, gi) => {
        const items = NAV_ITEMS.filter(i => i.group === group.id);
        const groupCollapsed = collapsedGroups.has(group.id);
        return (
          <div key={group.id}>
            {gi > 0 && <div className="mx-3 my-1.5 h-px bg-gradient-to-r from-transparent via-[rgba(124,58,237,0.15)] to-transparent" />}
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.id)}
                className="group flex w-full items-center justify-between px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#2D3748] hover:text-[#4B5563] transition-colors"
              >
                <span>{group.label}</span>
                <motion.span
                  animate={{ rotate: groupCollapsed ? -90 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-[8px] opacity-50"
                >▾</motion.span>
              </button>
            )}
            <AnimatePresence initial={false}>
              {/* In collapsed (icon) mode show all items; in expanded mode respect groupCollapsed */}
              {(collapsed || !groupCollapsed) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className={`space-y-0.5 ${collapsed ? "flex flex-col items-center px-1" : ""}`}>
                    {items.map((item) => (
                      <NavItem key={item.href} {...item} active={location === item.href} onClick={onClick} collapsed={collapsed} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </>
  );

  const MOBILE_BOTTOM = NAV_ITEMS.slice(0, 5);

  return (
    <div className="flex min-h-[100dvh] forge-bg-glow">
      {/* ── DESKTOP SIDEBAR ── */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="app-sidebar hidden md:flex sidebar-ambient"
        style={{
          background: "linear-gradient(180deg, rgba(7,8,18,0.98) 0%, rgba(4,5,14,0.99) 50%, rgba(8,5,18,0.99) 100%)",
          borderRight: "1px solid rgba(124,58,237,0.18)",
          boxShadow: "4px 0 32px rgba(0,0,0,0.5), inset -1px 0 0 rgba(124,58,237,0.08)",
          width: sidebarCollapsed ? "60px" : "240px",
          transition: "width 0.3s cubic-bezier(0.22,1,0.36,1)",
          overflow: "hidden",
        }}
      >
        {/* Ambient glassmorphism glow orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-none" aria-hidden>
          <motion.div
            className="absolute -top-16 -left-16 h-48 w-48 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(124,58,237,0.22) 0%, rgba(79,46,220,0.08) 50%, transparent 70%)", filter: "blur(28px)" }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-16 -left-12 h-36 w-36 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(6,214,160,0.12) 0%, transparent 70%)", filter: "blur(22px)" }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.65, 0.3] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
          />
          <motion.div
            className="absolute top-1/2 -right-6 h-28 w-28 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)", filter: "blur(20px)" }}
            animate={{ scale: [0.8, 1.3, 0.8], opacity: [0.2, 0.55, 0.2] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 4.5 }}
          />
          <motion.div
            className="absolute top-1/3 left-1/2 h-20 w-20 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(232,121,249,0.1) 0%, transparent 70%)", filter: "blur(16px)" }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0.4, 0.15] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          />
          <motion.div
            className="absolute inset-x-0 h-px"
            style={{ top: "35%", background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.15), rgba(232,121,249,0.1), transparent)" }}
            animate={{ opacity: [0, 0.8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
        </div>

        {/* Logo header */}
        <div className={`relative border-b border-[rgba(124,58,237,0.12)] transition-all duration-300 ${sidebarCollapsed ? "flex flex-col items-center gap-2 px-2 py-3" : "flex items-center gap-3 px-4 py-5"}`}>
          <div className="absolute inset-0 bg-gradient-to-b from-[rgba(124,58,237,0.05)] to-transparent pointer-events-none" />
          <SidebarLogo />
          {!sidebarCollapsed && (
            <div className="relative flex-1 min-w-0 overflow-hidden">
              <p className="text-[14px] font-black tracking-tight text-white leading-none whitespace-nowrap">FocusArx</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#4B5563] mt-0.5 whitespace-nowrap">AI-Powered Study OS</p>
            </div>
          )}
          {!sidebarCollapsed && <InfoTooltip />}
          {/* Collapse toggle */}
          <button
            onClick={toggleSidebar}
            className="relative z-10 flex items-center justify-center rounded-lg p-1.5 text-[#4B5563] transition-all hover:bg-[rgba(124,58,237,0.12)] hover:text-[#A78BFA]"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="nav-scroll-fade flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {renderNavGroup(undefined, sidebarCollapsed)}
          {isAdminUser(user) && (
            <>
              <div className="mx-3 my-1.5 h-px bg-gradient-to-r from-transparent via-[rgba(124,58,237,0.15)] to-transparent" />
              <NavItem href="/admin" label="Admin" icon={Shield} active={location === "/admin"} collapsed={sidebarCollapsed} />
            </>
          )}
        </nav>

        {/* User section */}
        <div className="border-t border-[rgba(124,58,237,0.12)] px-2 py-3 space-y-1">
          {status === "authenticated" && user ? (
            <>
              <Link href="/profile" title={user.name || user.email?.split("@")[0] || "Profile"}>
                <motion.div
                  whileHover={{ backgroundColor: "rgba(124,58,237,0.08)" }}
                  className={`flex items-center rounded-xl py-2.5 cursor-pointer transition-colors ${sidebarCollapsed ? "justify-center px-1" : "gap-3 px-3"}`}
                >
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-xs font-bold text-white shadow-lg shadow-purple-900/40">
                    {initials}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#08090f]" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="truncate text-xs font-semibold text-[#E2E8F0]">{user.name || user.email?.split("@")[0] || "User"}</p>
                      <p className="truncate text-[10px] text-[#3D4760]">{user.email ?? "Signed in"}</p>
                    </div>
                  )}
                </motion.div>
              </Link>

              {!sidebarCollapsed ? (
                <button onClick={() => void signOut()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-[#6B7280] transition-all hover:bg-[rgba(239,68,68,0.08)] hover:text-[#F87171]">
                  <LogOut size={13} /> Sign out
                </button>
              ) : (
                <div title="Sign out">
                  <button onClick={() => void signOut()} className="flex w-full items-center justify-center rounded-xl px-1 py-2 text-[#6B7280] hover:bg-[rgba(239,68,68,0.08)] hover:text-[#F87171]">
                    <LogOut size={13} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <Link href="/login" title="Sign in" className={`flex items-center rounded-xl px-3 py-2 text-xs text-[#6B7280] transition-colors hover:bg-[rgba(124,58,237,0.08)] hover:text-[#A78BFA] ${sidebarCollapsed ? "justify-center px-1" : "gap-3"}`}>
              <LogIn size={13} />
              {!sidebarCollapsed && "Sign in"}
            </Link>
          )}

          {!sidebarCollapsed ? (
            <>
              <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-[#4B5563] transition-colors hover:bg-[rgba(124,58,237,0.08)] hover:text-[#A78BFA]">
                {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              {"Notification" in window && (
                <button onClick={handlePushToggle} disabled={pushLoading}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs transition-colors disabled:opacity-50 ${pushEnabled ? "text-emerald-500 hover:bg-emerald-500/8" : "text-[#4B5563] hover:bg-[rgba(124,58,237,0.08)] hover:text-[#A78BFA]"}`}>
                  {pushEnabled ? <Bell size={13} /> : <BellOff size={13} />}
                  {pushLoading ? "…" : pushEnabled ? "Notifications on" : "Enable notifications"}
                </button>
              )}
            </>
          ) : (
            <>
              <div title={theme === "dark" ? "Light mode" : "Dark mode"}>
                <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex w-full items-center justify-center rounded-xl px-1 py-2 text-[#4B5563] hover:bg-[rgba(124,58,237,0.08)] hover:text-[#A78BFA]">
                  {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
                </button>
              </div>
              {"Notification" in window && (
                <div title={pushEnabled ? "Notifications on" : "Enable notifications"}>
                  <button onClick={handlePushToggle} disabled={pushLoading}
                    className={`flex w-full items-center justify-center rounded-xl px-1 py-2 transition-colors disabled:opacity-50 ${pushEnabled ? "text-emerald-500" : "text-[#4B5563] hover:bg-[rgba(124,58,237,0.08)] hover:text-[#A78BFA]"}`}>
                    {pushEnabled ? <Bell size={13} /> : <BellOff size={13} />}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer links — hidden when collapsed */}
        {!sidebarCollapsed && (
          <div className="border-t border-[rgba(124,58,237,0.08)] px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              {[["Privacy", "/privacy"], ["Terms", "/terms"], ["AI Policy", "/ai-policy"], ["Pricing", "/pricing"], ["About", "/about"], ["Support", "/support"]].map(([label, href]) => (
                <Link key={href} href={href} className="text-[9px] font-medium text-[#1E2740] hover:text-[#4B5563] transition-colors">{label}</Link>
              ))}
            </div>
          </div>
        )}
      </motion.aside>

      {/* ── MOBILE HEADER ── */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[rgba(124,58,237,0.15)] bg-[rgba(5,6,16,0.95)] px-4 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2.5">
          <SidebarLogo />
          <div>
            <span className="text-sm font-black text-white tracking-tight">FocusArx</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href="/notifications" className="relative rounded-lg p-2 text-[#94A3B8] hover:text-[#a78bfa]">
            <Bell size={18} />
            <NotifBadge />
          </Link>
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-[#94A3B8] hover:bg-[rgba(124,58,237,0.1)] hover:text-[#A78BFA]" aria-label="Open menu">
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* ── MOBILE DRAWER ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
            <motion.aside key="drawer"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col md:hidden"
              style={{ background: "linear-gradient(180deg, rgba(8,9,20,0.99) 0%, rgba(5,6,16,1) 100%)", borderRight: "1px solid rgba(124,58,237,0.2)" }}
            >
              <div className="flex items-center justify-between border-b border-[rgba(124,58,237,0.15)] px-4 py-4">
                <div className="flex items-center gap-2.5"><SidebarLogo /><span className="text-sm font-black text-white">FocusArx</span></div>
                <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-[#4B5563] hover:text-[#A78BFA]" aria-label="Close menu">
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
                {renderNavGroup(() => setMobileOpen(false))}
                {isAdminUser(user) && (
                  <>
                    <div className="mx-3 my-1.5 h-px bg-gradient-to-r from-transparent via-[rgba(124,58,237,0.15)] to-transparent" />
                    <NavItem href="/admin" label="Admin" icon={Shield} active={location === "/admin"} onClick={() => setMobileOpen(false)} />
                  </>
                )}
              </nav>
              <div className="border-t border-[rgba(124,58,237,0.15)] px-3 py-3 space-y-1">
                {status === "authenticated" && user ? (
                  <>
                    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 mb-1">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-xs font-bold text-white">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[#E2E8F0]">{user.name || user.email?.split("@")[0] || "User"}</p>
                        <p className="truncate text-[10px] text-[#3D4760]">{user.email ?? ""}</p>
                      </div>
                    </div>
                    <button onClick={() => { void signOut(); setMobileOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-[#6B7280] hover:bg-[rgba(239,68,68,0.08)] hover:text-[#F87171]">
                      <LogOut size={13} /> Sign out
                    </button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-[#6B7280] hover:text-[#A78BFA]">
                    <LogIn size={13} /> Sign in
                  </Link>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── BOTTOM TAB BAR (mobile) ── */}
      <nav className="app-bottom-nav flex items-center justify-around md:hidden">
        {MOBILE_BOTTOM.map(({ href, label, icon: Icon, badge }) => {
          const active = location === href;
          return (
            <Link key={href} href={href} className={`relative flex flex-col items-center gap-0.5 px-3 py-2 transition-all ${active ? "text-[#A78BFA]" : "text-[#3D4760]"}`}>
              {active && (
                <motion.div
                  layoutId="bottom-tab-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-gradient-to-r from-[#7c3aed] to-[#a78bfa]"
                  style={{ boxShadow: "0 0 8px rgba(124,58,237,0.6)" }}
                />
              )}
              <motion.div whileTap={{ scale: 0.85 }} transition={{ type: "spring", stiffness: 500 }}>
                <Icon size={20} />
              </motion.div>
              <span className="text-[9px] font-semibold">{label.split(" ")[0]}</span>
              {badge === "missions" && <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#22d387] text-[7px] font-bold text-black">!</span>}
            </Link>
          );
        })}
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main
        id="main-content"
        className="flex-1 pt-14 pb-16 md:pt-0 md:pb-0 min-w-0"
        style={{
          marginLeft: undefined,
          transition: "margin-left 0.3s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {children}
      </main>

      {/* AI Coach */}
      {status === "authenticated" && <CoachPanel />}
    </div>
  );
}
