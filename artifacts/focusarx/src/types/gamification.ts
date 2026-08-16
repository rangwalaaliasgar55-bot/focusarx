export interface Wallet {
  coins: number;
  totalXp: number;
  level: number;
  currentXp: number;
  nextLevelXp: number;
  streak: number;
  freezeTokens: number;
}

export interface Building {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  coinCost: number;
  unlockLevel: number;
  populationBonus: number;
  xpBonusPerSession: number;
  coinBonusPerSession: number;
  _owned?: boolean;
}

export interface City {
  tier: 'hamlet' | 'village' | 'town' | 'city' | 'metropolis' | 'civilization';
  population: number;
  totalBuildings: number;
  weather: 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'wind' | 'rainbow';
  buildings: Record<string, boolean>;
}

export interface Mission {
  key: string;
  title: string;
  description: string;
  type: "daily" | "weekly";
  category: string;
  xpReward: number;
  coinReward: number;
  targetValue: number;
  unit: string;
  icon: string;
  difficulty: "easy" | "medium" | "hard" | "epic";
  currentValue: number;
  completed: boolean;
  completedAt: string | null;
  rewardClaimed: boolean;
  periodStart: string;
}

export interface ShopItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon?: string;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  price: number;
  priceType: 'coins' | 'xp';
  unlockedAtLevel?: number;
  limitedEdition?: boolean;
}

export interface BattlePassTier {
  tier: number;
  xpRequired: number;
  freeReward: { type: string; value: number; icon: string; name: string };
  premiumReward: { type: string; value: number; icon: string; name: string };
}

export interface BattlePassData {
  currentXp: number;
  seasonName: string;
  endsAt: string;
  premiumUnlocked: boolean;
  claimedFreeTiers: number[];
  claimedPremiumTiers: number[];
  tiers: BattlePassTier[];
}
