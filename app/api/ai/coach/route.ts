import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { ensureUserProfile } from "@/server/session";
import { aiCoachSchema } from "@/lib/validators";

function mockCoach(message?: string) {
  return {
    summary:
      "You are building momentum. Keep sessions bounded, hydrate, and end breaks on time.",
    tips: [
      "Try a 2-minute pre-focus ritual: close tabs, silence phone, one deep breath.",
      "After three deep-work blocks, take a longer reset (walk, stretch, daylight).",
      "Ship something tiny each day — progress beats perfect plans.",
    ],
    nudge: message
      ? `Related to “${message.slice(0, 80)}${message.length > 80 ? "…" : ""}”: anchor the next step to a single concrete artifact (doc, PR, flashcards).`
      : "Pick the next physical step you can finish in one Pomodoro.",
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureUserProfile(session.user.id);

  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    json = {};
  }

  const parsed = aiCoachSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { message, context } = parsed.data;

  const streak = await prisma.studyStreak.findUnique({
    where: { userId: session.user.id },
  });

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({
      coach: mockCoach(message),
      streakSnapshot: streak,
      model: "mock",
    });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are Focusarx AI coach: concise, motivating, evidence-based productivity advice. Output strict JSON with keys summary (string), tips (string array max 5), nudge (string).",
          },
          {
            role: "user",
            content: JSON.stringify({
              message: message ?? null,
              context: context ?? null,
              streak,
            }),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({
        coach: mockCoach(message),
        streakSnapshot: streak,
        model: "mock-fallback",
      });
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content;
    const coach = raw ? JSON.parse(raw) : mockCoach(message);
    return NextResponse.json({ coach, streakSnapshot: streak, model: "gpt-4o-mini" });
  } catch {
    return NextResponse.json({
      coach: mockCoach(message),
      streakSnapshot: streak,
      model: "mock-fallback",
    });
  }
}
