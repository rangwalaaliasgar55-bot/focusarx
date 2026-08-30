import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  Timer,
  Building2,
  Sparkles,
  Brain,
  Flame,
  Users,
  Library,
  Trophy,
  Award,
  ArrowRight,
  CheckCircle2,
  X,
  Volume2,
  Shield,
  Zap,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface FeatureGuideItem {
  id: string;
  category: "focus" | "gamification" | "ai" | "social" | "tools";
  title: string;
  badge: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  tagline: string;
  description: string;
  howToUse: string[];
  ctaText: string;
  href: string;
  accentColor: string;
}

export const PLATFORM_FEATURES: FeatureGuideItem[] = [
  {
    id: "timer",
    category: "focus",
    title: "Adaptive Focus Timer & Binaural Audio",
    badge: "Core OS",
    icon: Timer,
    tagline: "Science-backed Pomodoro & Ultradian Deep Work Blocks",
    description:
      "Precision countdown engine with Web Worker drift-proofing, ambient procedural soundscapes (rain, forest, space drone), and customizable 25m, 50m, or 90m flow intervals.",
    howToUse: [
      "Select your interval (25m classic sprint, 50m deep work, or 90m ultradian flow).",
      "Pick an ambient sound or binaural carrier frequency.",
      "Start the timer and commit to single-task focus.",
    ],
    ctaText: "Launch Focus Timer",
    href: "/",
    accentColor: "from-rose-500/20 to-orange-500/20 border-rose-500/30 text-rose-400",
  },
  {
    id: "city",
    category: "gamification",
    title: "3D Focus Civilization",
    badge: "3D Engine",
    icon: Building2,
    tagline: "Your productivity physically builds a 3D metropolis",
    description:
      "Every completed focus session places procedural architectural landmarks in your personalized 3D city. Progress from a Focus Village to an Enlightened Civilization.",
    howToUse: [
      "Complete focus sessions to earn building permits.",
      "Watch libraries, observatories, and towers spawn in real-time 3D.",
      "Unlock new district tiers at 15, 40, 90, 175, and 350 sessions.",
    ],
    ctaText: "Explore Focus City",
    href: "/city",
    accentColor: "from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400",
  },
  {
    id: "pet",
    category: "gamification",
    title: "3D Companion Pets",
    badge: "Companion",
    icon: Sparkles,
    tagline: "Low-poly procedural study companions that evolve with you",
    description:
      "Adopt an Owl, Fox, Dragon, Robot, Cat, or Phoenix. Your companion gains energy, happiness, and unlocks chromatic aura gems as you maintain daily focus momentum.",
    howToUse: [
      "Choose your companion species in the Pet Sanctuary.",
      "Keep them happy and energized by hitting daily study goals.",
      "Evolve through 4 visual stages as your total focus time increases.",
    ],
    ctaText: "Meet Your Pet",
    href: "/pets",
    accentColor: "from-amber-500/20 to-yellow-500/20 border-amber-500/30 text-amber-400",
  },
  {
    id: "coach",
    category: "ai",
    title: "Arx AI Coach (Gemini Powered)",
    badge: "AI Intelligence",
    icon: Brain,
    tagline: "Neuroscience-based coaching, habit diagnostics & study roadmaps",
    description:
      "Powered by Google Gemini 2.5 Flash, Arx diagnoses distraction patterns, builds tailored multi-day study schedules, and offers real-time coaching before and after sessions.",
    howToUse: [
      "Ask Arx for study roadmaps or cognitive reframing in the coach panel.",
      "Check your weekly AI productivity report on the dashboard.",
      "Receive personalized session tips based on your daily readiness score.",
    ],
    ctaText: "Open AI Coach",
    href: "/ai-insights",
    accentColor: "from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-400",
  },
  {
    id: "forge",
    category: "social",
    title: "Forge Rooms & Virtual Study Halls",
    badge: "Multiplayer",
    icon: Flame,
    tagline: "Live collaborative study rooms with Group Resonance XP multipliers",
    description:
      "Join or create synchronized virtual study rooms. As more members study together simultaneously in active focus mode, the room unlocks up to 2.5× XP resonance multipliers.",
    howToUse: [
      "Join an open public Forge or create a private room with friends.",
      "Synchronize your countdown timer with group study sprints.",
      "Earn bonus XP from the active group resonance multiplier.",
    ],
    ctaText: "Enter Forge Room",
    href: "/forge",
    accentColor: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400",
  },
  {
    id: "study-tools",
    category: "tools",
    title: "Flashcards & Feynman Technique",
    badge: "Study Science",
    icon: Library,
    tagline: "Spaced repetition flashcards & conceptual teaching simulator",
    description:
      "Turn study notes into high-yield flashcard decks with Google Gemini AI. Practice the Feynman technique to identify conceptual blind spots and solidify long-term memory.",
    howToUse: [
      "Paste your lecture notes to auto-generate AI flashcards in seconds.",
      "Review cards using the Leitner spaced repetition schedule.",
      "Practice breaking down difficult topics simply with the Feynman tool.",
    ],
    ctaText: "Open Flashcards",
    href: "/flashcards",
    accentColor: "from-indigo-500/20 to-violet-500/20 border-indigo-500/30 text-indigo-400",
  },
  {
    id: "economy",
    category: "gamification",
    title: "Battle Pass, Quests & Marketplace",
    badge: "Economy",
    icon: Trophy,
    tagline: "Seasonal rewards, daily quests, loot boxes, and cosmetic themes",
    description:
      "Convert your verified focus minutes into Focus Coins and Tokens. Unlock seasonal battle pass tiers, discover rare cosmetic aura skins, and complete daily quests.",
    howToUse: [
      "Check daily and weekly missions for bonus coin rewards.",
      "Level up the seasonal Battle Pass for exclusive banners and titles.",
      "Spend coins in the Marketplace to customize your theme and companion.",
    ],
    ctaText: "View Battle Pass",
    href: "/battle-pass",
    accentColor: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400",
  },
  {
    id: "proof",
    category: "tools",
    title: "Proof of Work & Discipline Resume",
    badge: "Certificates",
    icon: Award,
    tagline: "Verifiable digital certificates showcasing your deep work records",
    description:
      "Export cryptographically verifiable productivity certificates and discipline resumes showcasing total focus hours, subject competencies, and streak history.",
    howToUse: [
      "View your cumulative focus stats, streaks, and level on your Profile.",
      "Generate a public shareable Proof-of-Work badge.",
      "Export clean certificates verifying your preparation and deep work.",
    ],
    ctaText: "View Profile & Proof",
    href: "/profile",
    accentColor: "from-sky-500/20 to-blue-500/20 border-sky-500/30 text-sky-400",
  },
];

interface FeatureCompassModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeatureCompassModal({ open, onClose }: FeatureCompassModalProps) {
  const [, navigate] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeItem, setActiveItem] = useState<FeatureGuideItem>(PLATFORM_FEATURES[0]!);

  const filtered =
    selectedCategory === "all"
      ? PLATFORM_FEATURES
      : PLATFORM_FEATURES.filter((item) => item.category === selectedCategory);

  const handleLaunch = (href: string) => {
    onClose();
    navigate(href);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-[var(--background-card,#0f1117)] border border-[var(--border-subtle,#232736)] rounded-2xl shadow-2xl">
        <DialogTitle className="sr-only">FocusArx Feature Explorer</DialogTitle>
        <DialogDescription className="sr-only">
          Explore all features, gamification systems, AI tools, and focus modes on FocusArx.
        </DialogDescription>

        {/* Header banner */}
        <div className="relative p-6 border-b border-[var(--border-subtle,#232736)] bg-gradient-to-r from-[var(--brand-900,#1e1b4b)]/40 via-[var(--surface-1,#12141f)] to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg text-white">
                <Compass className="h-6 w-6 animate-spin-slow" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  FocusArx Compass & Feature Guide
                  <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-300 border-indigo-500/30">
                    Interactive Tour
                  </Badge>
                </h2>
                <p className="text-sm text-[var(--foreground-muted,#94a3b8)]">
                  Everything you need to master your cognitive workflow, gamify your study, and stay in flow.
                </p>
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "all", label: "All Features" },
              { id: "focus", label: "⏱️ Focus Core" },
              { id: "gamification", label: "🏙️ 3D & Gamification" },
              { id: "ai", label: "🧠 AI Intelligence" },
              { id: "social", label: "⚔️ Multiplayer" },
              { id: "tools", label: "🎴 Study Tools" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedCategory === tab.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-[var(--surface-2,#181b29)] text-[var(--foreground-muted,#94a3b8)] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Split view content */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[420px] max-h-[60vh] overflow-hidden">
          {/* List column */}
          <div className="md:col-span-5 border-r border-[var(--border-subtle,#232736)] overflow-y-auto p-3 space-y-2 bg-[var(--surface-1,#12141f)]/50">
            {filtered.map((item) => {
              const Icon = item.icon;
              const isSelected = activeItem.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveItem(item)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                    isSelected
                      ? "bg-indigo-950/40 border-indigo-500/40 shadow-sm"
                      : "bg-[var(--surface-1,#141724)] border-[var(--border-subtle,#232736)] hover:border-indigo-500/20 text-[var(--foreground-muted,#94a3b8)] hover:text-white"
                  }`}
                >
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${item.accentColor} shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-white truncate">{item.title}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-2,#1c2033)] text-indigo-300">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--foreground-muted,#94a3b8)] line-clamp-1 mt-0.5">
                      {item.tagline}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Details column */}
          <div className="md:col-span-7 p-6 overflow-y-auto flex flex-col justify-between bg-[var(--surface-1,#141724)]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${activeItem.accentColor}`}>
                  <activeItem.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{activeItem.title}</h3>
                  <p className="text-xs text-indigo-300 font-medium">{activeItem.tagline}</p>
                </div>
              </div>

              <p className="text-sm text-[var(--foreground-muted,#cbd5e1)] leading-relaxed">
                {activeItem.description}
              </p>

              <div className="rounded-xl border border-[var(--border-subtle,#232736)] bg-[var(--surface-2,#1a1d2e)] p-4 space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> How to use this feature:
                </h4>
                <ul className="space-y-2 text-xs text-[var(--foreground-muted,#94a3b8)]">
                  {activeItem.howToUse.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--border-subtle,#232736)] flex items-center justify-between">
              <span className="text-xs text-[var(--foreground-muted,#64748b)]">
                Ready to level up your focus?
              </span>
              <Button
                onClick={() => handleLaunch(activeItem.href)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md flex items-center gap-2 text-sm"
              >
                <span>{activeItem.ctaText}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
