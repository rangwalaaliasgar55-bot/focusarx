import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Timer, LayoutDashboard, TrendingUp, Trophy, Star, Users, Sparkles, X,
  Wind, UserCircle, Shield, BookOpen, Dna, Ghost, Sword, Radio,
} from "lucide-react";

const COMMANDS = [
  { id: "timer",        label: "Go to Timer",          icon: Timer,           href: "/",             shortcut: "1" },
  { id: "dashboard",    label: "Go to Dashboard",      icon: LayoutDashboard, href: "/dashboard",    shortcut: "2" },
  { id: "analytics",    label: "Go to Analytics",      icon: TrendingUp,      href: "/analytics",    shortcut: "3" },
  { id: "leaderboard",  label: "Go to Leaderboard",    icon: Trophy,          href: "/leaderboard",  shortcut: "4" },
  { id: "achievements", label: "Go to Achievements",   icon: Star,            href: "/achievements", shortcut: "5" },
  { id: "forge",        label: "Go to Forge Room",     icon: Users,           href: "/forge",        shortcut: "6" },
  { id: "roadmap",      label: "Go to AI Roadmap",     icon: Sparkles,        href: "/roadmap",      shortcut: "7" },
  { id: "breathe",      label: "Go to Breathe",        icon: Wind,            href: "/breathe",      shortcut: "" },
  { id: "profile",      label: "Go to Profile",        icon: UserCircle,      href: "/profile",      shortcut: "" },
  { id: "profiles",     label: "Go to Profiles",       icon: Shield,          href: "/profiles",     shortcut: "8" },
  { id: "distractions", label: "Go to Focus Journal",  icon: BookOpen,        href: "/distractions", shortcut: "9" },
  { id: "focus-dna",    label: "Go to Focus DNA",      icon: Dna,             href: "/focus-dna",    shortcut: "0" },
  { id: "ghosts",       label: "Go to Ghost Mode",     icon: Ghost,           href: "/ghosts",       shortcut: "" },
  { id: "consequences", label: "Go to Consequences",   icon: Sword,           href: "/consequences", shortcut: "" },
  { id: "replay",       label: "Go to Session Replay", icon: Radio,           href: "/replay",       shortcut: "" },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [, navigate] = useLocation();

  const filtered = COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const execute = useCallback((href: string) => {
    navigate(href);
    onClose();
    setQuery("");
    setSelected(0);
  }, [navigate, onClose]);

  useEffect(() => {
    if (!open) { setQuery(""); setSelected(0); }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter") { const cmd = filtered[selected]; if (cmd) execute(cmd.href); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, selected, execute, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -16 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-[20vh] z-[101] w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-[rgba(124,58,237,0.3)] bg-[rgba(12,17,40,0.98)] shadow-[0_32px_64px_rgba(0,0,0,0.6),0_0_0_1px_rgba(124,58,237,0.1)] backdrop-blur-2xl"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-[rgba(124,58,237,0.15)] px-4 py-3.5">
              <Search size={16} className="shrink-0 text-[#4B5563]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
                placeholder="Search commands…"
                className="flex-1 bg-transparent text-sm text-[#E2E8F0] placeholder-[#4B5563] outline-none"
              />
              <button onClick={onClose} className="p-1 text-[#4B5563] hover:text-[#94A3B8]">
                <X size={14} />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-[#4B5563]">No commands found.</p>
              ) : (
                filtered.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => execute(cmd.href)}
                      onMouseEnter={() => setSelected(idx)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                        idx === selected
                          ? "bg-[rgba(124,58,237,0.15)] text-[#E2E8F0]"
                          : "text-[#94A3B8] hover:bg-[rgba(124,58,237,0.08)]"
                      }`}
                    >
                      <Icon size={15} className={idx === selected ? "text-[#A78BFA]" : "text-[#4B5563]"} />
                      <span className="flex-1">{cmd.label}</span>
                      <kbd className="rounded bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 text-[10px] text-[#4B5563]">{cmd.shortcut}</kbd>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[rgba(124,58,237,0.1)] px-4 py-2 text-[10px] text-[#4B5563]">
              <span>↑↓ Navigate &nbsp;↵ Select &nbsp;Esc Close</span>
              <span>⌘K to open</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
