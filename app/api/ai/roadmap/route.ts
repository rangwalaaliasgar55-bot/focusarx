import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { ensureUserProfile } from "@/server/session";
import { aiRoadmapSchema } from "@/lib/validators";

type RoadmapDay = {
  day: number;
  focusSessions: string[];
  tasks: string[];
  estimatedTime: number;
};

function buildMockRoadmap(input: {
  goal: string;
  dailyHours: number;
  level: string;
  deadline?: string;
  currentProgress?: string;
}): RoadmapDay[] {
  const blocks = Math.max(2, Math.min(8, Math.round(input.dailyHours * 2)));
  const est = blocks * 25;
  return Array.from({ length: 7 }).map((_, i) => ({
    day: i + 1,
    focusSessions: [
      `${input.goal.slice(0, 48)}${input.goal.length > 48 ? "…" : ""} — core study block ${i + 1}a`,
      `Deliberate practice + recall (${input.level})`,
      ...(blocks > 4 ? ["Light review + notes tidy-up"] : []),
    ],
    tasks: [
      "25m focused read or video (no multitasking)",
      "10m active recall / flashcards",
      "5m plan tomorrow’s first session",
    ],
    estimatedTime: est,
  }));
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

  const parsed = aiRoadmapSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const body = parsed.data;
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    return NextResponse.json({
      roadmap: buildMockRoadmap(body),
      model: "mock",
    });
  }

  const prompt = `You are an expert learning planner. Create a 7-day roadmap as JSON array "roadmap" with objects { day:number, focusSessions:string[], tasks:string[], estimatedTime:number minutes }. User goal: ${body.goal}. Daily hours: ${body.dailyHours}. Level: ${body.level}. Deadline: ${body.deadline ?? "none"}. Progress: ${body.currentProgress ?? "unspecified"}. Rules: Pomodoro-sized blocks, include revision days, avoid overload.`;

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
          { role: "system", content: "Return strict JSON: { roadmap: RoadmapDay[] } only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({
        roadmap: buildMockRoadmap(body),
        model: "mock-fallback",
      });
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({
        roadmap: buildMockRoadmap(body),
        model: "mock-fallback",
      });
    }
    const parsedJson = JSON.parse(raw) as { roadmap?: RoadmapDay[] };
    return NextResponse.json({
      roadmap: parsedJson.roadmap ?? buildMockRoadmap(body),
      model: "gpt-4o-mini",
    });
  } catch {
    return NextResponse.json({
      roadmap: buildMockRoadmap(body),
      model: "mock-fallback",
    });
  }
}
