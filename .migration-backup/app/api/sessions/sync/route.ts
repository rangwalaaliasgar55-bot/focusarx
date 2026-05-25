import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { serializeActiveSession } from "@/server/active-session";
import { sessionSyncSchema } from "@/lib/validators";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = sessionSyncSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const {
    sessionId,
    activeSeconds,
    secondsLeft,
    timerStatus,
    mode,
    focusScore,
    focusQuality,
    focusState,
    distractionCount,
    lastSeenFaceAt,
    focusTimeline,
    monitorEnabled,
  } = parsed.data;

  const existing = await prisma.focusSession.findFirst({
    where: {
      id: sessionId,
      userId: session.user.id,
      status: "active",
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Active session not found" }, { status: 404 });
  }

  let lastSeenFace: Date | null | undefined;
  if (lastSeenFaceAt !== undefined) {
    if (lastSeenFaceAt === null) {
      lastSeenFace = null;
    } else {
      const d = new Date(lastSeenFaceAt);
      lastSeenFace = Number.isNaN(d.getTime()) ? null : d;
    }
  }

  const updated = await prisma.focusSession.update({
    where: { id: sessionId },
    data: {
      activeSeconds,
      ...(secondsLeft !== undefined ? { secondsLeft } : {}),
      ...(timerStatus !== undefined ? { timerStatus } : {}),
      ...(mode !== undefined ? { mode } : {}),
      ...(focusScore !== undefined ? { focusScore } : {}),
      ...(focusQuality !== undefined ? { focusQuality } : {}),
      ...(focusState !== undefined ? { focusState } : {}),
      ...(distractionCount !== undefined ? { distractionCount } : {}),
      ...(lastSeenFaceAt !== undefined ? { lastSeenFaceAt: lastSeenFace } : {}),
      ...(focusTimeline !== undefined
        ? { focusTimeline: JSON.stringify(focusTimeline) }
        : {}),
      ...(monitorEnabled !== undefined ? { monitorEnabled } : {}),
    },
    select: {
      id: true,
      mode: true,
      status: true,
      activeSeconds: true,
      secondsLeft: true,
      timerStatus: true,
      startedAt: true,
      focusScore: true,
      focusQuality: true,
      focusState: true,
      distractionCount: true,
      lastSeenFaceAt: true,
      focusTimeline: true,
      stabilityRating: true,
      sessionInsights: true,
      monitorEnabled: true,
      durationSec: true,
      taskId: true,
    },
  });

  return NextResponse.json({ session: serializeActiveSession(updated) });
}
