import { Link } from "wouter";
import { BarChart2, Bell, Bot, Building2, Coins, Crown, Database, Flame, Gift, Heart, TrendingUp, LayoutDashboard, Lock, Mail, Menu, Settings, Shield, ShieldCheck, ShoppingBag, Sparkles, Star, Target, Users, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { adminFetch } from "./AdminHelpers";

const ADMIN_SECTIONS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "Platform" },
  { id: "analytics", label: "Analytics", icon: BarChart2, group: "Platform" },
  { id: "users", label: "Users", icon: Users, group: "Platform" },
  { id: "moderation", label: "Moderation", icon: ShieldCheck, group: "Platform" },
  { id: "rivals", label: "AI rivals", icon: Bot, group: "Platform" },
  { id: "missions", label: "Missions", icon: Target, group: "Platform" },
  { id: "retention", label: "Retention", icon: Heart, group: "Platform" },
  { id: "marketplace", label: "Marketplace", icon: ShoppingBag, group: "Content" },
  { id: "pets", label: "Pets", icon: Star, group: "Content" },
  { id: "lootboxes", label: "Loot boxes", icon: Gift, group: "Content" },
  { id: "battlepass", label: "Battle pass", icon: Zap, group: "Content" },
  { id: "quests", label: "Quests", icon: Sparkles, group: "Content" },
  { id: "city", label: "Focus City", icon: Building2, group: "Content" },
  { id: "tokens", label: "Tokens", icon: Coins, group: "Operations" },
  { id: "flags", label: "Feature Flags", icon: Sparkles, group: "Operations" },
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

interface AdminShellProps {
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

function AdminNavigation({ activeTab, onTabChange, onNavigate }: Pick<AdminShellProps, "activeTab" | "onTabChange"> & { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto p-3" aria-label="Admin navigation">
      {["Platform", "Content", "Operations"].map((group) => (
        <section key={group} className="mb-6">
          <h2 className="mb-2 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">{group}</h2>
          <div className="space-y-1">
            {ADMIN_SECTIONS.filter((section) => section.group === group).map((section) => {
              const Icon = section.icon;
              return <button key={section.id} onClick={() => { onTabChange?.(section.id); onNavigate?.(); }} className={cn("nav-item w-full", activeTab === section.id && "nav-item-active")} aria-current={activeTab === section.id ? "page" : undefined}><Icon /><span>{section.label}</span></button>;
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

export function AdminShell({ children, activeTab, onTabChange }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = ADMIN_SECTIONS.find((section) => section.id === activeTab);

  const logout = async () => {
    await adminFetch("/api/admin/auth", { method: "DELETE", credentials: "include" });
    window.location.reload();
  };

  return (
    <div className="admin-shell flex min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface)] lg:flex">
        <div className="flex min-h-[4.5rem] items-center gap-3 border-b border-[var(--border-subtle)] px-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]"><Shield /></span><div><p className="text-sm font-semibold">FocusArx Admin</p><p className="text-xs text-[var(--foreground-subtle)]">Command center</p></div></div>
        <AdminNavigation activeTab={activeTab} onTabChange={onTabChange} />
        <div className="space-y-1 border-t border-[var(--border-subtle)] p-3"><Button asChild variant="ghost" className="w-full justify-start"><Link href="/dashboard"><LayoutDashboard /> Back to app</Link></Button><Button variant="ghost" className="w-full justify-start text-[var(--danger)]" onClick={() => void logout()}><Lock /> Lock admin</Button></div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-64">
        <header className="sticky top-0 z-[var(--z-sticky)] flex min-h-[4.5rem] items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--backdrop)] px-4 backdrop-blur-xl sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open admin navigation"><Menu /></Button>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]"><Shield size={17} /></span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{active?.label ?? "Command center"}</p><p className="hidden text-xs text-[var(--foreground-subtle)] sm:block">Manage FocusArx operations and content</p></div>
          <Badge variant="success">Admin active</Badge>
        </header>
        <main className="min-w-0 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-[min(90vw,22rem)] flex-col p-0">
          <SheetHeader className="border-b border-[var(--border-subtle)] p-5 text-left"><SheetTitle className="flex items-center gap-2"><Shield className="text-[var(--danger)]" /> FocusArx Admin</SheetTitle><SheetDescription>Command center navigation</SheetDescription></SheetHeader>
          <AdminNavigation activeTab={activeTab} onTabChange={onTabChange} onNavigate={() => setMobileOpen(false)} />
          <div className="border-t border-[var(--border-subtle)] p-3"><Button asChild variant="ghost" className="w-full justify-start"><Link href="/dashboard"><LayoutDashboard /> Back to app</Link></Button><Button variant="ghost" className="w-full justify-start text-[var(--danger)]" onClick={() => void logout()}><Lock /> Lock admin</Button></div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
