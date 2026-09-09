import { Link } from "wouter";
import {
  BarChart2,
  Bell,
  Bot,
  Building2,
  ChevronRight,
  Coins,
  Crown,
  Database,
  Flame,
  Gift,
  Heart,
  LayoutDashboard,
  Lock,
  Mail,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { BrandLockup } from "@/components/ui/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { adminFetch } from "./AdminHelpers";

/**
 * Admin console navigation model. Group order and ids are part of the console
 * contract (pages/admin.tsx maps Tab ids onto panels) — rename labels freely,
 * never the ids.
 */
const ADMIN_SECTIONS: {
  id: string;
  label: string;
  icon: typeof Users;
  group: "Platform" | "Content" | "Operations";
  hint?: string;
}[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "Platform", hint: "Platform pulse at a glance" },
  { id: "analytics", label: "Analytics", icon: BarChart2, group: "Platform", hint: "Events and visitor data" },
  { id: "users", label: "Users", icon: Users, group: "Platform", hint: "Accounts, wallets, actions" },
  { id: "moderation", label: "Moderation", icon: ShieldCheck, group: "Platform", hint: "Reports and safety" },
  { id: "rivals", label: "AI rivals", icon: Bot, group: "Platform" },
  { id: "missions", label: "Missions", icon: Target, group: "Platform" },
  { id: "retention", label: "Retention", icon: Heart, group: "Platform" },
  { id: "breakfree", label: "Break Free", icon: Sparkles, group: "Platform" },
  { id: "marketplace", label: "Marketplace", icon: ShoppingBag, group: "Content" },
  { id: "pets", label: "Pets", icon: Star, group: "Content" },
  { id: "lootboxes", label: "Loot boxes", icon: Gift, group: "Content" },
  { id: "battlepass", label: "Battle pass", icon: Zap, group: "Content" },
  { id: "quests", label: "Quests", icon: Sparkles, group: "Content" },
  { id: "city", label: "Focus City", icon: Building2, group: "Content" },
  { id: "tokens", label: "Tokens", icon: Coins, group: "Operations" },
  { id: "flags", label: "Feature Flags", icon: Settings, group: "Operations" },
  { id: "email", label: "Email", icon: Mail, group: "Operations" },
  { id: "premium", label: "Premium", icon: Crown, group: "Operations" },
  { id: "drops", label: "Drops", icon: Flame, group: "Operations" },
  { id: "notify", label: "Notifications", icon: Bell, group: "Operations" },
  { id: "coins", label: "Coin grants", icon: Coins, group: "Operations" },
  { id: "economy", label: "Economy", icon: TrendingUp, group: "Operations" },
  { id: "gemini", label: "Gemini", icon: Sparkles, group: "Operations" },
  { id: "sql", label: "SQL editor", icon: Database, group: "Operations" },
  { id: "site", label: "Site settings", icon: Settings, group: "Operations" },
];

const GROUPS = ["Platform", "Content", "Operations"] as const;

interface AdminShellProps {
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

function AdminNavigation({
  activeTab,
  onTabChange,
  onNavigate,
  query,
}: Pick<AdminShellProps, "activeTab" | "onTabChange"> & { onNavigate?: () => void; query: string }) {
  const q = query.trim().toLowerCase();
  const groups = GROUPS
    .map((group) => ({
      group,
      sections: ADMIN_SECTIONS.filter(
        (section) => section.group === group && (!q || section.label.toLowerCase().includes(q)),
      ),
    }))
    .filter((entry) => entry.sections.length > 0);

  if (!groups.length) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm font-medium text-[var(--foreground-muted)]">No console sections match “{query.trim()}”.</p>
        <p className="mt-1 text-xs text-[var(--foreground-subtle)]">Try “users”, “economy” or “sql”.</p>
      </div>
    );
  }

  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-6" aria-label="Admin navigation">
      {groups.map(({ group, sections }) => (
        <section key={group} className="mb-6" aria-labelledby={`admin-group-${group.toLowerCase()}`}>
          <h2
            id={`admin-group-${group.toLowerCase()}`}
            className="mb-1.5 px-3 pt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]"
          >
            {group}
          </h2>
          <div className="space-y-0.5">
            {sections.map((section) => {
              const Icon = section.icon;
              const active = activeTab === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    onTabChange?.(section.id);
                    onNavigate?.();
                  }}
                  aria-current={active ? "page" : undefined}
                  className={cn("nav-item w-full text-left", active && "nav-item-active")}
                >
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.9} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{section.label}</span>
                  {active && <ChevronRight size={14} className="text-[var(--brand-strong)] opacity-70" aria-hidden />}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

export function AdminShell({ children, activeTab, onTabChange }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const active = useMemo(
    () => ADMIN_SECTIONS.find((section) => section.id === activeTab) ?? ADMIN_SECTIONS[0],
    [activeTab],
  );

  const logout = async () => {
    await adminFetch("/api/admin/auth", { method: "DELETE", credentials: "include" });
    window.location.reload();
  };

  const sidebarContent = (
    <>
      <div className="flex min-h-[4.25rem] shrink-0 items-center border-b border-[var(--border-subtle)] px-5">
        <BrandLockup
          href="/dashboard"
          tagline="Console"
          compact
          ariaLabel="FocusArx admin console"
          className="gap-2.5"
          markClassName="h-8 w-8"
        />
      </div>
      <div className="shrink-0 px-3 pt-3">
        <label className="relative block">
          <span className="sr-only">Filter console sections</span>
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)]"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a section…"
            className="min-h-9 w-full rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-hover)] pl-8 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:border-[var(--ring)] focus:outline-none"
          />
        </label>
      </div>
      <AdminNavigation
        activeTab={activeTab}
        onTabChange={(tab) => {
          onTabChange?.(tab);
          setQuery("");
        }}
        query={query}
      />
      <div className="shrink-0 space-y-0.5 border-t border-[var(--border-subtle)] p-3">
        <Button asChild variant="ghost" className="w-full justify-start gap-2.5 px-3">
          <Link href="/dashboard">
            <LayoutDashboard size={16} aria-hidden /> Back to app
          </Link>
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2.5 px-3 text-[var(--danger)] hover:text-[var(--danger)]"
          onClick={() => void logout()}
        >
          <Lock size={15} aria-hidden /> Lock console
        </Button>
      </div>
    </>
  );

  return (
    <div className="admin-shell flex min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      {/* Desktop sidebar */}
      <aside className="app-sidebar fixed inset-y-0 left-0 z-[var(--z-nav)] hidden w-64 flex-col border-r border-[var(--border-subtle)] lg:flex">
        {sidebarContent}
      </aside>

      <div className="min-w-0 flex-1 lg:ml-64">
        {/* Content header */}
        <header className="glass-chrome sticky top-0 z-[var(--z-sticky)] flex min-h-[4.25rem] items-center gap-3 px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open admin console navigation"
          >
            <Menu />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[0.9375rem] font-semibold tracking-tight text-[var(--foreground)]">
                {active.label}
              </h1>
              {active.hint && (
                <span className="hidden truncate text-[0.8125rem] text-[var(--foreground-subtle)] sm:inline">
                  — {active.hint}
                </span>
              )}
            </div>
          </div>
          <Badge variant="outline" className="hidden shrink-0 gap-1.5 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" aria-hidden />
            Console active
          </Badge>
        </header>

        <main className="min-w-0 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-[min(90vw,22rem)] flex-col p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin console</SheetTitle>
            <SheetDescription>FocusArx console navigation</SheetDescription>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>
    </div>
  );
}
