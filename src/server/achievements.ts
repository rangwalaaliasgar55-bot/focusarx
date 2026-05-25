import { prisma } from "@/server/db";

const FIRST_FOCUS = "first_focus";

export async function grantAchievementIfNew(
  userId: string,
  slug: string
): Promise<boolean> {
  const achievement = await prisma.achievement.findUnique({ where: { slug } });
  if (!achievement) return false;

  try {
    await prisma.userAchievement.create({
      data: {
        userId,
        achievementId: achievement.id,
      },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: achievement.xpReward } },
    });
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true },
    });
    if (u) {
      await prisma.user.update({
        where: { id: userId },
        data: { level: Math.min(99, Math.floor(u.xp / 200) + 1) },
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function ensureAchievementSeeds() {
  await prisma.achievement.upsert({
    where: { slug: FIRST_FOCUS },
    create: {
      slug: FIRST_FOCUS,
      title: "First focus",
      description: "Complete your first focus session.",
      xpReward: 25,
    },
    update: {},
  });
}

export async function onFocusSessionRecorded(userId: string) {
  await ensureAchievementSeeds();
  await grantAchievementIfNew(userId, FIRST_FOCUS);
}
