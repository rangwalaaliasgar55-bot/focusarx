import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Timer, LayoutDashboard, TrendingUp, Trophy, Star,
  Users, Sparkles, LogOut, LogIn, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NAV_ITEMS = [
  { href: "/",             label: "Timer",         icon: Timer,         shortcut: "1" },
  { href: "/dashboard",    label: "Dashboard",     icon: LayoutDashboard, shortcut: "2" },
  { href: "/analytics",    label: "Analytics",     icon: TrendingUp,    shortcut: "3" },
  { href: "/leaderboard",  label: "Leaderboard",   icon: Trophy,        shortcut: "4" },
  { href: "/achievements", label: "Achievements",  icon: Star,          shortcut: "5" },
  { href: "/forge",        label: "Forge Room",    icon: Users,         shortcut: "6" },
  { href: "/roadmap",      label: "AI Roadmap",    icon: Sparkles,      shortcut: "7" },
];

const NO_SHELL = ["/login", "/signup", "/forgot-password", "/admin"];

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
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: session, status, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (NO_SHELL.some((p) => location === p || location.startsWith(p))) {
    return <>{children}</>;
  }

  const user = session?.user;
  const initials = user
    ? (user.name?.slice(0, 2) || user.email?.slice(0, 2) || "?").toUpperCase()
    : "?";

  return (
    <div className="flex min-h-[100dvh] forge-bg-glow">
      {/* Desktop sidebar */}
      <aside className="app-sidebar hidden md:flex">
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-[rgba(124,58,237,0.15)] px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] shadow-[0_0_12px_rgba(124,58,237,0.4)]">
            <Timer size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-[#E2E8F0]">FocusArx</p>
            <p className="text-[10px] text-[#4B5563]">Study OS</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.href} {...item} active={location === item.href} />
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-[rgba(124,58,237,0.15)] px-3 py-4 space-y-2">
          {status === "authenticated" && user ? (
            <>
              <div className="flex items-center gap-3 rounded-xl px-3 py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-xs font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[#E2E8F0]">
                    {user.name || user.email?.split("@")[0] || "User"}
                  </p>
                  <p className="text-[10px] text-[#4B5563]">{user.isGuest ? "Guest" : "Signed in"}</p>
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

      {/* Mobile header */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[rgba(124,58,237,0.15)] bg-[rgba(8,12,28,0.95)] px-4 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#4F46E5]">
            <Timer size={13} className="text-white" />
          </div>
          <span className="text-sm font-bold text-[#E2E8F0]">FocusArx</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-[#94A3B8] hover:bg-[rgba(124,58,237,0.1)] hover:text-[#A78BFA]"
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-[rgba(8,12,28,0.99)] md:hidden flex flex-col border-r border-[rgba(124,58,237,0.2)]"
            >
              <div className="flex items-center justify-between border-b border-[rgba(124,58,237,0.15)] px-5 py-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#4F46E5]">
                    <Timer size={15} className="text-white" />
                  </div>
                  <span className="text-sm font-bold text-[#E2E8F0]">FocusArx</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-1 text-[#6B7280]">
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
              </nav>
              <div className="border-t border-[rgba(124,58,237,0.15)] px-3 py-4">
                {status === "authenticated" && user ? (
                  <button
                    onClick={() => { void signOut(); setMobileOpen(false); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-[#6B7280] hover:bg-[rgba(239,68,68,0.1)] hover:text-[#F87171]"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                ) : (
                  <Link href="/login" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-[#6B7280] hover:text-[#A78BFA]">
                    <LogIn size={14} /> Sign in
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom tab bar (mobile) */}
      <nav className="app-bottom-nav flex items-center justify-around md:hidden">
        {NAV_ITEMS.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return (
            <Link key={href} href={href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${active ? "text-[#A78BFA]" : "text-[#4B5563]"}`}>
              <Icon size={20} />
              <span className="text-[9px] font-medium">{label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="flex-1 md:ml-[240px] pt-14 pb-16 md:pt-0 md:pb-0 min-w-0">
        {children}
      </main>
    </div>
  );
}
