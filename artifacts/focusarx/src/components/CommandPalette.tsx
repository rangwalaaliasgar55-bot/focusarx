import { useState } from "react";
import { useLocation } from "wouter";
import {
  BarChart3,
  Brain,
  CheckSquare2,
  Flame,
  Goal,
  LayoutDashboard,
  Library,
  Plus,
  Search,
  Settings,
  Sparkles,
  Timer,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useToast } from "@/components/Toast";
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

const DESTINATIONS = [
  { label: "Focus timer", href: "/", icon: Timer, keywords: "start session pomodoro" },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: "home overview" },
  { label: "Tasks", href: "/tasks", icon: CheckSquare2, keywords: "todo work" },
  { label: "Goals", href: "/goals", icon: Goal, keywords: "targets planning" },
  { label: "Flashcards", href: "/flashcards", icon: Library, keywords: "decks study leitner" },
  { label: "AI coach", href: "/ai-insights", icon: Brain, keywords: "insights advice" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, keywords: "reports stats" },
  { label: "Achievements", href: "/achievements", icon: Trophy, keywords: "badges rewards" },
  { label: "Missions", href: "/missions", icon: Sparkles, keywords: "quests challenges" },
  { label: "Community", href: "/social", icon: Users, keywords: "friends groups" },
  { label: "Break Free", href: "/break-free", icon: Flame, keywords: "wellbeing mood pledge" },
  { label: "Profile", href: "/profile", icon: UserRound, keywords: "account xp settings" },
  { label: "Settings", href: "/profile", icon: Settings, keywords: "preferences theme account" },
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
              {query.trim() && (
                <CommandItem value={`create task ${query}`} onSelect={() => void createTask()} disabled={creating} className="min-h-11 rounded-[var(--radius-md)]">
                  <Plus /> <span className="truncate">Create task “{query.trim()}”</span><CommandShortcut>↵</CommandShortcut>
                </CommandItem>
              )}
            </CommandGroup>
            <CommandSeparator className="my-2" />
            <CommandGroup heading="Go to">
              {DESTINATIONS.map(({ label, href, icon: Icon, keywords }) => (
                <CommandItem key={`${label}-${href}`} value={`${label} ${keywords}`} onSelect={() => go(href)} className="min-h-11 rounded-[var(--radius-md)]">
                  <Icon /> <span>{label}</span>
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
