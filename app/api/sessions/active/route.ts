import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { ensureUserProfile } from "@/server/session";
import {
  ensureActiveFocusSession,
  findActiveFocusSession,
  serializeActiveSession,
} from "@/server/active-session";
import { sessionActiveCreateSchema } from "@/lib/validators";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await findActiveFocusSession(session.user.id);
  if (!row) {
    return NextResponse.json({ session: null });
  }

  return NextResponse.json({ session: serializeActiveSession(row) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  await ensureUserProfile(userId);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = sessionActiveCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const row = await ensureActiveFocusSession(userId, parsed.data);
  return NextResponse.json({ session: serializeActiveSession(row) });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.focusSession.deleteMany({
    where: { userId: session.user.id, status: "active" },
  });

  return NextResponse.json({ ok: true });
}
