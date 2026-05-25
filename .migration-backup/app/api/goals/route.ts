import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { ensureUserProfile } from "@/server/session";
import { goalCreateSchema } from "@/lib/validators";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureUserProfile(session.user.id);

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const goals = await prisma.goal.findMany({
    where: {
      userId: session.user.id,
      ...(from && to
        ? {
            goalDate: {
              gte: new Date(from),
              lte: new Date(to),
            },
          }
        : {}),
    },
    orderBy: { goalDate: "asc" },
    take: 20,
  });

  return NextResponse.json({ goals });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureUserProfile(session.user.id);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = goalCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const goalDate = new Date(parsed.data.goalDate);
  if (Number.isNaN(goalDate.getTime())) {
    return NextResponse.json({ error: "Invalid goalDate" }, { status: 422 });
  }

  goalDate.setUTCHours(0, 0, 0, 0);

  const goal = await prisma.goal.create({
    data: {
      userId: session.user.id,
      title: parsed.data.title,
      targetSessions: parsed.data.targetSessions,
      goalDate,
    },
  });

  return NextResponse.json({ goal });
}
