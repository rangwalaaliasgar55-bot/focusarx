import { useState } from "react";
import { useLocation } from "wouter";
import {
  BarChart3,
  Brain,
  CheckSquare2,
  Compass,
  Flame,
  Goal,
  LayoutDashboard,
  Library,
  Plus,
  Settings,
  Sparkles,
  Timer,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useToast } from "@/components/Toast";
import { usePremium } from "@/hooks/usePremium";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface Destination {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  keywords: string;
  premium?: boolean;
}

const DESTINATIONS: Destination[] = [
  { label: "Focus timer", href: "/", icon: Timer, keywords: "start session pomodoro" },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: "home overview" },
  { label: "Focus City (3D)", href: "/city", icon: Sparkles, keywords: "civilization 3d buildings world" },
  { label: "Companion Pets (3D)", href: "/pets", icon: Sparkles, keywords: "pet avatar creature evolve" },
  { label: "Tasks", href: "/tasks", icon: CheckSquare2, keywords: "todo work" },
  { label: "Goals", href: "/goals", icon: Goal, keywords: "targets planning" },
  { label: "Flashcards", href: "/flashcards", icon: Library, keywords: "decks study leitner memory" },
  { label: "Feynman Technique", href: "/feynman-technique", icon: Library, keywords: "learn teach simplify" },
  { label: "AI coach", href: "/ai-insights", icon: Brain, keywords: "insights advice gemini coach", premium: true },
  { label: "Forge Study Room", href: "/forge", icon: Flame, keywords: "live room multiplayer resonance" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, keywords: "reports stats", premium: true },
  { label: "Battle Pass", href: "/battle-pass", icon: Trophy, keywords: "season xp tiers rewards" },
  { label: "Achievements", href: "/achievements", icon: Trophy, keywords: "badges rewards" },
  { label: "Missions", href: "/missions", icon: Sparkles, keywords: "quests challenges" },
  { label: "Community", href: "/social", icon: Users, keywords: "friends groups" },
  { label: "Break Free", href: "/break-free", icon: Flame, keywords: "wellbeing mood pledge" },
  { label: "Profile & Proof of Work", href: "/profile", icon: UserRound, keywords: "account xp settings resume certificate" },
  { label: "Settings", href: "/profile?tab=custom", icon: Settings, keywords: "preferences theme account" },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const { addTask } = useTasks();
  const { toast } = useToast();
  const { isPremium } = usePremium();

  const close = () => {
    setQuery("");
    onClose();
  };

  const go = (href: string) => {
    navigate(href);
    close();
  };

  const startFocus = () => {
    navigate("/");
    close();
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("focusarx:start-focus")), 120);
  };

  const openGuide = () => {
    close();
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("focusarx:open-guide")), 120);
  };

  const createTask = async () => {
    const title = query.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      await addTask(title);
      toast(`Task added: ${title}`, "success");
      close();
    } catch {
      toast("The task could not be added. Try again.", "danger");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="top-[16vh] w-[min(calc(100vw-2rem),38rem)] max-w-none translate-y-0 p-0" aria-describedby="command-description">
        <DialogTitle className="sr-only">Search FocusArx</DialogTitle>
        <DialogDescription id="command-description" className="sr-only">Navigate to a page, add a task, or start a focus session.</DialogDescription>
        <Command shouldFilter>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search pages or type a new task…" />
          <CommandList className="max-h-[min(26rem,60vh)] p-2">
            <CommandEmpty>No matching page. You can create this as a task below.</CommandEmpty>
            <CommandGroup heading="Quick actions">
              <CommandItem value="start focus session timer" onSelect={startFocus} className="min-h-11 rounded-[var(--radius-md)]">
                <Timer /> <span>Start focus session</span><CommandShortcut>Enter</CommandShortcut>
              </CommandItem>
              <CommandItem value="feature guide tour compass explore help" onSelect={openGuide} className="min-h-11 rounded-[var(--radius-md)]">
                <Compass className="text-indigo-400" /> <span>Explore FocusArx Features (Interactive Guide)</span>
              </CommandItem>
              {query.trim() && (
                <CommandItem value={`create task ${query}`} onSelect={() => void createTask()} disabled={creating} className="min-h-11 rounded-[var(--radius-md)]">
                  <Plus /> <span className="truncate">Create task "{query.trim()}"</span><CommandShortcut>↵</CommandShortcut>
                </CommandItem>
              )}
            </CommandGroup>
            <CommandSeparator className="my-2" />
            <CommandGroup heading="Go to">
              {DESTINATIONS.map(({ label, href, icon: Icon, keywords, premium }) => (
                <CommandItem key={`${label}-${href}`} value={`${label} ${keywords}`} onSelect={() => go(href)} className="min-h-11 rounded-[var(--radius-md)]">
                  <Icon /> <span>{label}</span>
                  {premium && !isPremium && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[var(--palette-amber-500)]/10 px-2 py-0.5 text-[0.625rem] font-bold text-[var(--palette-amber-400)] border border-[var(--palette-amber-500)]/20">
                      PRO
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center gap-4 border-t border-[var(--border-subtle)] px-4 py-2.5 text-[0.6875rem] text-[var(--foreground-subtle)]">
            <span><kbd>↑↓</kbd> navigate</span><span><kbd>↵</kbd> select</span><span><kbd>esc</kbd> close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
