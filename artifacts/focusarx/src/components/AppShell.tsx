import { useLocation, Link } from "wouter";
import { useAuth, isAdminUser, getToken } from "@/lib/auth";
import {
  Timer, LayoutDashboard, TrendingUp, Trophy, Star,
  Users, Sparkles, LogOut, LogIn, Menu, X, Shield, BookOpen,
  Dna, Ghost, Sword, Radio, Wind, UserCircle, Info, Flame, Target,
  Bell, Users2, Zap, Brain, Network, CheckSquare, MessageSquare, ShoppingBag, Flag, Gift, Sun, Moon,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "@/lib/theme";
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

function MissionsBadge() {
  const { data } = useQuery({ queryKey: ["missions-badge"], queryFn: fetchMissionStats, staleTime: 60_000, refetchInterval: 120_000 });
  const claimable = (data?.daily ?? []).filter((m: any) => m.completed && !m.rewardClaimed).length
    + (data?.weekly ?? []).filter((m: any) => m.completed && !m.rewardClaimed).length;
  if (!claimable) return null;
  return <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-[#22d387] text-[9px] font-bold text-black shrink-0">{claimable}</span>;
}

function NotifBadge() {
  const { data } = useQuery({ queryKey: ["notif-count-nav"], queryFn: fetchNotifCount, staleTime: 30_000, refetchInterval: 60_000 });
  const count = data?.unreadCount ?? 0;
  if (!count) return null;
  return <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shrink-0">{count > 9 ? "9+" : count}</span>;
}

const NAV_ITEMS = [
  { href: "/",              label: "Timer",          icon: Timer,          shortcut: "1", group: "core" },
  { href: "/dashboard",     label: "Dashboard",      icon: LayoutDashboard,shortcut: "2", group: "core" },
  { href: "/missions",      label: "Missions",       icon: Target,         shortcut: "m", badge: "missions", group: "core" },
  { href: "/habits",        label: "Habits",         icon: CheckSquare,    shortcut: "h", group: "core" },
  { href: "/goals",         label: "Goals",          icon: Flag,           shortcut: "g", group: "core" },
  { href: "/social",        label: "Social",         icon: Network,        shortcut: "s", group: "social" },
  { href: "/groups",        label: "Study Groups",   icon: Users2,         shortcut: "",  group: "social" },
  { href: "/messages",      label: "Messages",       icon: MessageSquare,  shortcut: "",  group: "social" },
  { href: "/study-rooms",   label: "Study Rooms",    icon: Radio,          shortcut: "",  group: "social" },
  { href: "/leaderboard",   label: "Leaderboard",    icon: Trophy,         shortcut: "4", group: "social" },
  { href: "/notifications", label: "Notifications",  icon: Bell,           shortcut: "n", badge: "notif", group: "social" },
  { href: "/shop",          label: "Coin Shop",      icon: ShoppingBag,    shortcut: "",  group: "engage" },
  { href: "/battle-pass",   label: "Battle Pass",    icon: Zap,            shortcut: "",  group: "engage" },
  { href: "/referral",      label: "Refer Friends",  icon: Gift,           shortcut: "",  group: "engage" },
  { href: "/ai-insights",   label: "AI Insights",    icon: Brain,          shortcut: "",  aiBadge: true, group: "engage" },
  { href: "/roadmap",       label: "AI Roadmap",     icon: Sparkles,       shortcut: "7", aiBadge: true, group: "engage" },
  { href: "/analytics",     label: "Analytics",      icon: TrendingUp,     shortcut: "3", group: "engage" },
  { href: "/achievements",  label: "Achievements",   icon: Star,           shortcut: "5", group: "engage" },
  { href: "/break-free",    label: "Break Free",     icon: Flame,          shortcut: "",  group: "tools" },
  { href: "/breathe",       label: "Breathe",        icon: Wind,           shortcut: "",  group: "tools" },
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

const NO_SHELL = ["/login", "/signup", "/forgot-password", "/reset-password", "/admin", "/auth/callback"];

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  shortcut?: string;
  aiBadge?: boolean;
  badge?: string;
  onClick?: () => void;
}

function NavItem({ href, label, icon: Icon, active, shortcut, aiBadge, badge, onClick }: NavItemProps) {
  return (
    <motion.div whileHover={{ x: 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}>
      <Link href={href} onClick={onClick}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 ${active ? "bg-[rgba(124,58,237,0.2)] text-[#A78BFA] shadow-[0_0_12px_rgba(124,58,237,0.15)]" : "text-[#94A3B8] hover:bg-[rgba(124,58,237,0.1)] hover:text-[#E2E8F0]"}`}>
        {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-[#7C3AED]" />}
        <Icon size={15} className="shrink-0" />
        <span className="flex-1 text-xs">{label}</span>
        {badge === "missions" && <MissionsBadge />}
        {badge === "notif" && <NotifBadge />}
        {aiBadge && !badge && <span className="rounded-full bg-[rgba(124,58,237,0.25)] border border-[rgba(124,58,237,0.4)] px-1.5 py-0.5 text-[8px] font-bold text-[#A78BFA] uppercase tracking-wider">AI</span>}
        {!aiBadge && !badge && shortcut && <span className="ml-auto hidden text-[10px] text-[#4B5563] group-hover:text-[#6B7280] lg:block">{shortcut}</span>}
      </Link>
    </motion.div>
  );
}

function LogoMark({ size = "default" }: { size?: "default" | "small" }) {
  const imgSize = size === "small" ? "h-7 w-7" : "h-9 w-9";
  return <img src="/logo.png" alt="FocusArx Shield Crest Logo" className={`${imgSize} rounded-full object-cover logo-pulse`} loading="lazy" width={size === "small" ? 28 : 36} height={size === "small" ? 28 : 36} />;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: session, status, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useTheme();

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

  const renderNavGroup = (onClick?: () => void) => (
    <>
      {NAV_GROUPS.map((group, gi) => {
        const items = NAV_ITEMS.filter(i => i.group === group.id);
        return (
          <div key={group.id}>
            {gi > 0 && <div className="mx-3 my-2 border-t border-[rgba(124,58,237,0.08)]" />}
            <p className="px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#2D3748]">{group.label}</p>
            {items.map((item) => (
              <NavItem key={item.href} {...item} active={location === item.href} onClick={onClick} />
            ))}
          </div>
        );
      })}
    </>
  );

  const MOBILE_BOTTOM = NAV_ITEMS.slice(0, 5);

  return (
    <div className="flex min-h-[100dvh] forge-bg-glow">
      {/* DESKTOP SIDEBAR */}
      <aside className="app-sidebar hidden md:flex">
        <div className="flex items-center gap-2.5 border-b border-[rgba(124,58,237,0.15)] px-5 py-5">
          <LogoMark />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold tracking-tight text-[#E2E8F0]">FocusArx</p>
            <p className="text-[10px] text-[#4B5563] leading-tight">AI-Powered Study OS</p>
          </div>
          <InfoTooltip />
        </div>
        <nav className="nav-scroll-fade flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {renderNavGroup()}
          {isAdminUser(user) && (
            <>
              <div className="mx-3 my-2 border-t border-[rgba(124,58,237,0.08)]" />
              <NavItem href="/admin" label="Admin" icon={Shield} active={location === "/admin"} />
            </>
          )}
        </nav>
        <div className="border-t border-[rgba(124,58,237,0.15)] px-3 py-4 space-y-2">
          {status === "authenticated" && user ? (
            <>
              <div className="flex items-center gap-3 rounded-xl px-3 py-2">
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-xs font-bold text-white">
                  {initials}
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[rgba(8,12,28,0.97)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[#E2E8F0]">{user.name || user.email?.split("@")[0] || "User"}</p>
                  <p className="truncate text-[10px] text-[#4B5563]">{user.isGuest ? "Guest session" : (user.email ?? "Signed in")}</p>
                </div>
              </div>
              <button onClick={() => void signOut()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-[#6B7280] transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-[#F87171]">
                <LogOut size={14} /> Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-[#6B7280] transition-colors hover:bg-[rgba(124,58,237,0.1)] hover:text-[#A78BFA]">
              <LogIn size={14} /> Sign in
            </Link>
          )}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-[#6B7280] transition-colors hover:bg-[rgba(124,58,237,0.1)] hover:text-[#A78BFA]">
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[rgba(124,58,237,0.15)] bg-[rgba(8,12,28,0.95)] px-4 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2">
          <LogoMark size="small" />
          <span className="text-sm font-bold text-[#E2E8F0]">FocusArx</span>
          <InfoTooltip />
        </div>
        <div className="flex items-center gap-2">
          <Link href="/notifications" className="relative rounded-lg p-2 text-[#94A3B8]">
            <Bell size={18} />
            <NotifBadge />
          </Link>
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-[#94A3B8] hover:bg-[rgba(124,58,237,0.1)] hover:text-[#A78BFA]" aria-label="Open menu">
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
            <motion.aside key="drawer" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[rgba(124,58,237,0.2)] bg-[rgba(8,12,28,0.99)] md:hidden">
              <div className="flex items-center justify-between border-b border-[rgba(124,58,237,0.15)] px-5 py-5">
                <div className="flex items-center gap-2.5"><LogoMark size="small" /><span className="text-sm font-bold text-[#E2E8F0]">FocusArx</span></div>
                <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[rgba(124,58,237,0.15)] hover:text-[#E2E8F0]" aria-label="Close menu"><X size={18} /></button>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
                {renderNavGroup(() => setMobileOpen(false))}
                {isAdminUser(user) && (
                  <>
                    <div className="mx-3 my-2 border-t border-[rgba(124,58,237,0.08)]" />
                    <NavItem href="/admin" label="Admin" icon={Shield} active={location === "/admin"} onClick={() => setMobileOpen(false)} />
                  </>
                )}
              </nav>
              <div className="border-t border-[rgba(124,58,237,0.15)] px-3 py-4">
                {status === "authenticated" && user ? (
                  <button onClick={() => { void signOut(); setMobileOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-[#6B7280] hover:bg-[rgba(239,68,68,0.1)] hover:text-[#F87171]">
                    <LogOut size={14} /> Sign out
                  </button>
                ) : (
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-[#6B7280] hover:text-[#A78BFA]">
                    <LogIn size={14} /> Sign in
                  </Link>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* BOTTOM TAB BAR */}
      <nav className="app-bottom-nav flex items-center justify-around md:hidden">
        {MOBILE_BOTTOM.map(({ href, label, icon: Icon, badge }) => {
          const active = location === href;
          return (
            <Link key={href} href={href} className={`relative flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${active ? "text-[#A78BFA]" : "text-[#4B5563]"}`}>
              <Icon size={20} />
              <span className="text-[9px] font-medium">{label.split(" ")[0]}</span>
              {badge === "missions" && <span className="absolute -top-0.5 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#22d387] text-[7px] font-bold text-black">!</span>}
            </Link>
          );
        })}
      </nav>

      {/* MAIN CONTENT */}
      <main id="main-content" className="flex-1 md:ml-[240px] pt-14 pb-16 md:pt-0 md:pb-0 min-w-0">
        {children}
      </main>

      {/* AI COACH PANEL */}
      {status === "authenticated" && <CoachPanel />}

      {/* LEGAL FOOTER */}
      <footer className="hidden md:flex fixed bottom-0 left-0 w-[240px] z-30 items-center justify-center gap-3 border-t border-[rgba(124,58,237,0.1)] bg-[rgba(8,12,28,0.97)] px-3 py-2">
        <Link href="/privacy" className="text-[9px] text-[#2D3748] hover:text-[#4B5563]">Privacy</Link>
        <span className="text-[9px] text-[#1A202C]">·</span>
        <Link href="/terms" className="text-[9px] text-[#2D3748] hover:text-[#4B5563]">Terms</Link>
        <span className="text-[9px] text-[#1A202C]">·</span>
        <Link href="/ai-policy" className="text-[9px] text-[#2D3748] hover:text-[#4B5563]">AI Policy</Link>
        <span className="text-[9px] text-[#1A202C]">·</span>
        <Link href="/pricing" className="text-[9px] text-[#2D3748] hover:text-[#4B5563]">Pricing</Link>
      </footer>
    </div>
  );
}
