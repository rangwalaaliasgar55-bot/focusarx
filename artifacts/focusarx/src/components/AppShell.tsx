import { useLocation, Link } from "wouter";
import { useAuth, isAdminUser } from "@/lib/auth";
import {
  Timer, LayoutDashboard, TrendingUp, Trophy, Star,
  Users, Sparkles, LogOut, LogIn, Menu, X, Shield, BookOpen,
  Dna, Ghost, Sword, Radio, Wind, UserCircle, Info,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CoachPanel from "@/components/CoachPanel";

function InfoTooltip() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        aria-label="What is FocusArx?"
        className="flex items-center justify-center rounded-lg p-1.5 text-[#4B5563] transition-colors hover:bg-[rgba(124,58,237,0.12)] hover:text-[#A78BFA]"
      >
        <Info size={14} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-8 top-1/2 -translate-y-1/2 z-[200] w-64 rounded-xl border border-[rgba(124,58,237,0.2)] bg-[#0d0f1c] p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#7C3AED] mb-1.5">
              What is FocusArx?
            </p>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              An AI-powered deep-work environment that tracks your attention in real-time,
              gamifies your focus sessions, and builds lasting study habits.
            </p>
            <p className="text-[11px] text-[#4B5563] mt-1.5">
              Built for students, developers & creators.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/",             label: "Timer",         icon: Timer,         shortcut: "1" },
  { href: "/dashboard",    label: "Dashboard",     icon: LayoutDashboard, shortcut: "2" },
  { href: "/analytics",    label: "Analytics",     icon: TrendingUp,    shortcut: "3" },
  { href: "/leaderboard",  label: "Leaderboard",   icon: Trophy,        shortcut: "4" },
  { href: "/achievements", label: "Achievements",  icon: Star,          shortcut: "5" },
  { href: "/forge",        label: "Forge Room",    icon: Users,         shortcut: "6" },
  { href: "/roadmap",      label: "AI Roadmap",    icon: Sparkles,      shortcut: "7" },
  { href: "/breathe",      label: "Breathe",       icon: Wind,          shortcut: "" },
  { href: "/profile",      label: "Profile",       icon: UserCircle,    shortcut: "" },
  { href: "/profiles",     label: "Profiles",      icon: Shield,        shortcut: "8" },
  { href: "/distractions", label: "Focus Journal", icon: BookOpen,      shortcut: "9" },
  { href: "/focus-dna",    label: "Focus DNA",     icon: Dna,           shortcut: "0" },
  { href: "/ghosts",       label: "Ghost Mode",    icon: Ghost,         shortcut: "" },
  { href: "/consequences", label: "Consequences",  icon: Sword,         shortcut: "" },
  { href: "/replay",       label: "Session Replay",icon: Radio,         shortcut: "" },
];

const NO_SHELL = ["/login", "/signup", "/forgot-password", "/reset-password", "/admin", "/auth/callback"];

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  shortcut?: string;
  onClick?: () => void;
  compact?: boolean;
}

function NavItem({ href, label, icon: Icon, active, shortcut, onClick, compact }: NavItemProps) {
  return (
    <motion.div whileHover={{ x: 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}>
      <Link
        href={href}
        onClick={onClick}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
          active
            ? "bg-[rgba(124,58,237,0.2)] text-[#A78BFA] shadow-[0_0_12px_rgba(124,58,237,0.15)]"
            : "text-[#94A3B8] hover:bg-[rgba(124,58,237,0.1)] hover:text-[#E2E8F0]"
        } ${compact ? "justify-center px-2" : ""}`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-[#7C3AED]" />
        )}
        <Icon size={16} className="shrink-0" />
        {!compact && <span>{label}</span>}
        {!compact && shortcut && (
          <span className="ml-auto hidden text-[10px] text-[#4B5563] group-hover:text-[#6B7280] lg:block">
            {shortcut}
          </span>
        )}
      </Link>
    </motion.div>
  );
}

function LogoMark({ size = "default" }: { size?: "default" | "small" }) {
  const imgSize = size === "small" ? "h-7 w-7" : "h-9 w-9";
  return (
    <img
      src="/logo.png"
      alt="FocusArx Shield Crest Logo"
      className={`${imgSize} rounded-full object-cover logo-pulse`}
      loading="lazy"
      width={size === "small" ? 28 : 36}
      height={size === "small" ? 28 : 36}
    />
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: session, status, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setMobileOpen(false);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileOpen, handleKeyDown]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  if (NO_SHELL.some((p) => location === p || location.startsWith(p))) {
    return <>{children}</>;
  }

  const user = session?.user;
  const initials = user
    ? (user.name?.slice(0, 2) || user.email?.slice(0, 2) || "?").toUpperCase()
    : "?";

  return (
    <div className="flex min-h-[100dvh] forge-bg-glow">
      {/* ==================== DESKTOP SIDEBAR ==================== */}
      <aside className="app-sidebar hidden md:flex">
        {/* Logo — desktop */}
        <div className="flex items-center gap-2.5 border-b border-[rgba(124,58,237,0.15)] px-5 py-5">
          <LogoMark />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold tracking-tight text-[#E2E8F0]">FocusArx</p>
            <p className="text-[10px] text-[#4B5563]">Study OS</p>
          </div>
          <InfoTooltip />
        </div>

        {/* Nav */}
        <nav className="nav-scroll-fade flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.href} {...item} active={location === item.href} />
          ))}
          {isAdminUser(user) && (
            <NavItem href="/admin" label="Admin" icon={Shield} active={location === "/admin"} />
          )}
        </nav>

        {/* User section */}
        <div className="border-t border-[rgba(124,58,237,0.15)] px-3 py-4 space-y-2">
          {status === "authenticated" && user ? (
            <>
              <div className="flex items-center gap-3 rounded-xl px-3 py-2">
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-xs font-bold text-white">
                  {initials}
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[rgba(8,12,28,0.97)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[#E2E8F0]">
                    {user.name || user.email?.split("@")[0] || "User"}
                  </p>
                  <p className="truncate text-[10px] text-[#4B5563]">
                    {user.isGuest ? "Guest session" : (user.email ?? "Signed in")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => void signOut()}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-[#6B7280] transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-[#F87171]"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-[#6B7280] transition-colors hover:bg-[rgba(124,58,237,0.1)] hover:text-[#A78BFA]"
            >
              <LogIn size={14} />
              Sign in
            </Link>
          )}
        </div>
      </aside>

      {/* ==================== MOBILE HEADER ==================== */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[rgba(124,58,237,0.15)] bg-[rgba(8,12,28,0.95)] px-4 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2">
          <LogoMark size="small" />
          <span className="text-sm font-bold text-[#E2E8F0]">FocusArx</span>
          <InfoTooltip />
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-[#94A3B8] hover:bg-[rgba(124,58,237,0.1)] hover:text-[#A78BFA]"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
      </div>

      {/* ==================== MOBILE DRAWER ==================== */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            />

            <motion.aside
              key="mobile-drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[rgba(124,58,237,0.2)] bg-[rgba(8,12,28,0.99)] md:hidden"
            >
              <div className="flex items-center justify-between border-b border-[rgba(124,58,237,0.15)] px-5 py-5">
                <div className="flex items-center gap-2.5">
                  <LogoMark size="small" />
                  <span className="text-sm font-bold text-[#E2E8F0]">FocusArx</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-[#6B7280] transition-colors hover:bg-[rgba(124,58,237,0.15)] hover:text-[#E2E8F0]"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {NAV_ITEMS.map((item) => (
                  <NavItem
                    key={item.href}
                    {...item}
                    active={location === item.href}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
                {isAdminUser(user) && (
                  <NavItem
                    href="/admin"
                    label="Admin"
                    icon={Shield}
                    active={location === "/admin"}
                    onClick={() => setMobileOpen(false)}
                  />
                )}
              </nav>

              <div className="border-t border-[rgba(124,58,237,0.15)] px-3 py-4">
                {status === "authenticated" && user ? (
                  <button
                    onClick={() => { void signOut(); setMobileOpen(false); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-[#6B7280] transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-[#F87171]"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-[#6B7280] transition-colors hover:text-[#A78BFA]"
                  >
                    <LogIn size={14} /> Sign in
                  </Link>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ==================== BOTTOM TAB BAR (mobile) ==================== */}
      <nav className="app-bottom-nav flex items-center justify-around md:hidden">
        {NAV_ITEMS.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${
                active ? "text-[#A78BFA]" : "text-[#4B5563]"
              }`}
            >
              <Icon size={20} />
              <span className="text-[9px] font-medium">{label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>

      {/* ==================== MAIN CONTENT ==================== */}
      <main className="flex-1 md:ml-[240px] pt-14 pb-16 md:pt-0 md:pb-0 min-w-0">
        {children}
      </main>

      {/* ==================== AI COACH PANEL ==================== */}
      {status === "authenticated" && <CoachPanel />}
    </div>
  );
}
