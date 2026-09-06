import { db, userPetInventoryTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { earnTokens } from "./tokenLedger";
import { logger } from "./logger";

export const PET_MAX_LEVEL = 20;
export const PET_MILESTONE_LEVELS = [3, 5, 8, 10, 15, 20] as const;

/** Bond XP curve: level n → n+1 needs n*100 XP. Pure, for tests. */
export function applyBondXp(level: number, bondXp: number, gain: number): { level: number; bondXp: number; unlocks: number[] } {
  let newXp = bondXp + Math.max(0, Math.floor(gain));
  let newLevel = level;
  const unlocks: number[] = [];
  while (newLevel < PET_MAX_LEVEL) {
    const needed = newLevel * 100;
    if (newXp < needed) break;
    newXp -= needed;
    newLevel++;
    unlocks.push(newLevel);
  }
  if (newLevel >= PET_MAX_LEVEL) newXp = 0;
  return { level: newLevel, bondXp: newXp, unlocks };
}

/**
 * Credit bond XP to the user's *active* companion. Only the server calls
 * this, from verified session completion — the old public `/bond` route let
 * any client POST `xp: 1000` in a loop and farm milestone tokens.
 */
export async function awardBondXpToActivePet(userId: string, gain: number) {
  if (gain <= 0) return null;
  try {
    const [inv] = await db.select().from(userPetInventoryTable)
      .where(and(eq(userPetInventoryTable.userId, userId), eq(userPetInventoryTable.isActive, true)))
      .limit(1);
    if (!inv) return null;
    const next = applyBondXp(inv.level, inv.bondXp, gain);
    const [updated] = await db.update(userPetInventoryTable)
      .set({ level: next.level, bondXp: next.bondXp, mood: "happy", updatedAt: new Date() })
      .where(eq(userPetInventoryTable.id, inv.id))
      .returning();
    const earnedMilestones = next.unlocks.filter((l) => (PET_MILESTONE_LEVELS as readonly number[]).includes(l));
    for (const lvl of earnedMilestones) {
      // Idempotency key per pet+level: a re-run can never pay the same milestone twice.
      await earnTokens(userId, "pet_milestone", `pet_${inv.id}_lvl_${lvl}`, { description: `pet ${inv.petId} lvl ${lvl}` }, 50 + lvl * 10)
        .catch((err) => logger.warn({ err, userId, lvl }, "pet milestone token grant failed"));
    }
    return { inventory: updated, leveledUp: next.unlocks, earnedMilestones };
  } catch (err) {
    logger.warn({ err, userId }, "pet bond xp failed (non-fatal)");
    return null;
  }
}
