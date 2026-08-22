export type Rank = {
  name: string;
  emoji: string;
  color: string;
  gradient: string;
  shadow: string;
  min: number;
  max: number | null;
};

export const RANKS: Rank[] = [
  { name: "Beginner",     emoji: "🌱", color: "var(--palette-6b7280)", gradient: "from-[var(--palette-gray-500)] to-[var(--palette-gray-600)]",     shadow: "var(--rgba-107-114-128-0_4)",   min: 1,   max: 5   },
  { name: "Apprentice",   emoji: "📚", color: "var(--palette-10b981)", gradient: "from-[var(--palette-emerald-500)] to-[var(--palette-teal-600)]",  shadow: "var(--rgba-16-185-129-0_4)",    min: 6,   max: 15  },
  { name: "Scholar",      emoji: "🎓", color: "var(--color-info)", gradient: "from-[var(--palette-blue-500)] to-[var(--palette-indigo-600)]",   shadow: "var(--rgba-59-130-246-0_4)",    min: 16,  max: 30  },
  { name: "Expert",       emoji: "⭐", color: "var(--color-warning)", gradient: "from-[var(--palette-amber-500)] to-[var(--palette-orange-500)]",  shadow: "var(--rgba-245-158-11-0_4)",    min: 31,  max: 50  },
  { name: "Master",       emoji: "💎", color: "var(--brand-500)", gradient: "from-[var(--palette-violet-500)] to-[var(--palette-purple-600)]", shadow: "var(--rgba-139-92-246-0_4)",    min: 51,  max: 75  },
  { name: "Grandmaster",  emoji: "👑", color: "var(--palette-ec4899)", gradient: "from-[var(--palette-pink-500)] to-[var(--palette-rose-600)]",     shadow: "var(--rgba-236-72-153-0_4)",    min: 76,  max: 100 },
  { name: "Legend",       emoji: "🌟", color: "var(--color-error)", gradient: "from-[var(--palette-red-500)] to-[var(--palette-orange-400)]",    shadow: "var(--rgba-239-68-68-0_5)",     min: 101, max: 150 },
  { name: "Mythic",       emoji: "⚡", color: "var(--brand-400)", gradient: "from-[var(--palette-purple-400)] to-[var(--palette-violet-300)]", shadow: "var(--rgba-167-139-250-0_6)",   min: 151, max: null },
];

export function getRank(level: number): Rank {
  return [...RANKS].reverse().find(r => level >= r.min) ?? RANKS[0]!;
}

export function getNextRank(level: number): Rank | null {
  const curr = getRank(level);
  const idx = RANKS.indexOf(curr);
  return RANKS[idx + 1] ?? null;
}

export function getLevelFromXp(totalXp: number): number {
  return Math.floor(Math.sqrt(totalXp / 100)) + 1;
}
