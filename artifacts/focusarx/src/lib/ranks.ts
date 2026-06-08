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
  { name: "Beginner",     emoji: "🌱", color: "#6B7280", gradient: "from-gray-500 to-gray-600",     shadow: "rgba(107,114,128,0.4)",   min: 1,   max: 5   },
  { name: "Apprentice",   emoji: "📚", color: "#10B981", gradient: "from-emerald-500 to-teal-600",  shadow: "rgba(16,185,129,0.4)",    min: 6,   max: 15  },
  { name: "Scholar",      emoji: "🎓", color: "#3B82F6", gradient: "from-blue-500 to-indigo-600",   shadow: "rgba(59,130,246,0.4)",    min: 16,  max: 30  },
  { name: "Expert",       emoji: "⭐", color: "#F59E0B", gradient: "from-amber-500 to-orange-500",  shadow: "rgba(245,158,11,0.4)",    min: 31,  max: 50  },
  { name: "Master",       emoji: "💎", color: "#8B5CF6", gradient: "from-violet-500 to-purple-600", shadow: "rgba(139,92,246,0.4)",    min: 51,  max: 75  },
  { name: "Grandmaster",  emoji: "👑", color: "#EC4899", gradient: "from-pink-500 to-rose-600",     shadow: "rgba(236,72,153,0.4)",    min: 76,  max: 100 },
  { name: "Legend",       emoji: "🌟", color: "#EF4444", gradient: "from-red-500 to-orange-400",    shadow: "rgba(239,68,68,0.5)",     min: 101, max: 150 },
  { name: "Mythic",       emoji: "⚡", color: "#A78BFA", gradient: "from-purple-400 to-violet-300", shadow: "rgba(167,139,250,0.6)",   min: 151, max: null },
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
