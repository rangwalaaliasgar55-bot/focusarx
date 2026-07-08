import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, BarChart2, Target, Heart,
  Database, ShoppingBag, Star, Gift, Zap, MessageSquare,
  Building2, Sparkles, Shield, ChevronRight, Lock, Settings,
  Bell, Coins, Mail, Crown
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ADMIN_SECTIONS = [
  { id: "overview",     label: "Overview",        icon: LayoutDashboard, group: "core" },
  { id: "analytics",   label: "Analytics",        icon: BarChart2,       group: "core" },
  { id: "users",       label: "User Management",  icon: Users,           group: "core" },
  { id: "missions",    label: "Missions",         icon: Target,          group: "core" },
  { id: "retention",   label: "Retention",        icon: Heart,           group: "core" },
  { id: "marketplace", label: "Marketplace CMS",  icon: ShoppingBag,     group: "cms" },
  { id: "pets",        label: "Pet CMS",          icon: Star,            group: "cms" },
  { id: "lootboxes",   label: "Loot Box CMS",     icon: Gift,            group: "cms" },
  { id: "battlepass",  label: "Battle Pass",      icon: Zap,             group: "cms" },
  { id: "quests",      label: "Quest Builder",    icon: Sparkles,        group: "cms" },
  { id: "city",        label: "Focus City CMS",   icon: Building2,       group: "cms" },
  { id: "email",       label: "Email System",     icon: Mail,            group: "tools" },
  { id: "premium",     label: "Premium Mgmt",     icon: Crown,           group: "tools" },
  { id: "notify",      label: "Notification Blast",icon: Bell,           group: "tools" },
  { id: "coins",       label: "Coin Grants",      icon: Coins,           group: "tools" },
  { id: "sql",         label: "SQL Editor",       icon: Database,        group: "tools" },
];

const GROUPS = [
  { id: "core", label: "Platform" },
  { id: "cms",  label: "Content Management" },
  { id: "tools", label: "Admin Tools" },
];

interface AdminShellProps {
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function AdminShell({ children, activeTab, onTabChange }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const logout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE", credentials: "include" });
    window.location.reload();
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-14"} shrink-0 flex flex-col border-r border-zinc-800/80 bg-zinc-950 transition-all duration-200 sticky top-0 h-[100dvh]`}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-4 border-b border-zinc-800/80">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 border border-rose-500/30">
            <Shield size={14} className="text-rose-400" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-zinc-100 truncate">Admin Panel</p>
              <p className="text-[9px] text-zinc-500 truncate">FocusArx Command</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition"
          >
            <ChevronRight size={12} className={`transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {GROUPS.map(group => {
            const items = ADMIN_SECTIONS.filter(s => s.group === group.id);
            return (
              <div key={group.id}>
                {sidebarOpen && (
                  <p className="px-2 mb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">{group.label}</p>
                )}
                <div className="space-y-0.5">
                  {items.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onTabChange?.(item.id)}
                        title={!sidebarOpen ? item.label : undefined}
                        className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs transition ${
                          isActive
                            ? "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60"
                        }`}
                      >
                        <Icon size={13} className="shrink-0" />
                        {sidebarOpen && <span className="truncate font-medium">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-zinc-800/80 px-2 py-3 space-y-1">
          <Link href="/dashboard">
            <a className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition">
              <LayoutDashboard size={13} className="shrink-0" />
              {sidebarOpen && <span>Back to App</span>}
            </a>
          </Link>
          <button
            onClick={() => void logout()}
            className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
          >
            <Lock size={13} className="shrink-0" />
            {sidebarOpen && <span>Lock Admin</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={16} className="text-rose-400" />
            <h1 className="text-sm font-bold text-zinc-100">
              FocusArx <span className="text-rose-400">Command Center</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              ● Admin
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
