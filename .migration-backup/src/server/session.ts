import { auth } from "@/server/auth";
import { prisma } from "@/server/db";

export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function requireUserOr401(): Promise<string> {
  const id = await requireUserId();
  if (!id) {
    throw new Error("UNAUTHORIZED");
  }
  return id;
}

/** Ensures streak + settings rows exist (e.g. legacy users). */
export async function ensureUserProfile(userId: string) {
  await prisma.studyStreak.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}
