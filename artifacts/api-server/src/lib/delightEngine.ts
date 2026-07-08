type DelightReward =
  | { type: "coin_bonus"; amount: number; message: string }
  | { type: "xp_boost"; multiplier: number; durationMin: number; message: string }
  | { type: "loot_box"; rarity: string; message: string }
  | { type: "motivational"; message: string };

const MOTIVATIONAL_MESSAGES = [
  "Every session is a brick in your empire. Keep building. 🏛️",
  "You showed up when it mattered. That's the whole game. 💪",
  "Consistency is the rarest superpower. You have it. 🔥",
  "Your future self is cheering you on right now. ⚡",
  "Deep work is a competitive advantage. You're ahead. 🚀",
  "The compound effect of your sessions is extraordinary. 📈",
  "Focus is a muscle. You just made it stronger. 💎",
  "One session closer to your dream. Keep going. 🌟",
];

function randomMotivationalMessage(): string {
  return MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)]!;
}

const DELIGHT_EVENTS: { chance: number; fn: () => DelightReward }[] = [
  { chance: 0.03,  fn: () => ({ type: "coin_bonus", amount: 50, message: "🎉 Lucky Find! +50 bonus coins!" }) },
  { chance: 0.02,  fn: () => ({ type: "xp_boost", multiplier: 2, durationMin: 30, message: "⚡ 2× XP activated for 30 minutes!" }) },
  { chance: 0.015, fn: () => ({ type: "loot_box", rarity: "rare", message: "📦 A Rare Box just dropped for you!" }) },
  { chance: 0.001, fn: () => ({ type: "loot_box", rarity: "legendary", message: "👑 LEGENDARY DROP — You are unstoppable!" }) },
  { chance: 0.12,  fn: () => ({ type: "motivational", message: randomMotivationalMessage() }) },
];

export function runDelightCheck(): DelightReward | null {
  for (const event of DELIGHT_EVENTS) {
    if (Math.random() < event.chance) return event.fn();
  }
  return null;
}
