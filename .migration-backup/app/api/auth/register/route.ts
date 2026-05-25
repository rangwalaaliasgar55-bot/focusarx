import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = registerSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, name } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists with that email" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        hashedPassword,
        name: name || null,
        isGuest: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    await prisma.studyStreak.create({
      data: {
        userId: user.id,
      },
    });

    await prisma.userSettings.create({
      data: {
        userId: user.id,
      },
    });

    return NextResponse.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/auth/register]", message, err);
    return NextResponse.json(
      { error: "Internal server error", message: process.env.NODE_ENV !== "production" ? message : undefined },
      { status: 500 }
    );
  }
}
