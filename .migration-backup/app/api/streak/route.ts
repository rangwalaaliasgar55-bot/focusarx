import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { ensureUserProfile } from "@/server/session";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureUserProfile(session.user.id);

  const streak = await prisma.studyStreak.findUnique({
    where: { userId: session.user.id },
  });

  if (!streak) {
    return NextResponse.json({
      streak: {
        userId: session.user.id,
        currentStreak: 0,
        longestStreak: 0,
        totalStudyDays: 0,
        lastStudyDate: null,
      }
    });
  }

  return NextResponse.json({ streak });
}

/** Idempotent refresh — returns current streak row (reserved for recomputation). */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureUserProfile(session.user.id);

  const streak = await prisma.studyStreak.findUnique({
    where: { userId: session.user.id },
  });

  if (!streak) {
    return NextResponse.json({
      streak: {
        userId: session.user.id,
        currentStreak: 0,
        longestStreak: 0,
        totalStudyDays: 0,
        lastStudyDate: null,
      }
    });
  }

  return NextResponse.json({ streak });
}
