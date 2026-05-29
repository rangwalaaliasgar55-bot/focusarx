import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, distractionLogsTable, readinessLogsTable, activeSessionsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

router.post("/coach/chat", auth, async (req: any, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const fallbackReplies = [
      "Focus on one task at a time — multitasking reduces efficiency by up to 40%.",
      "Try the 2-minute rule: if something takes less than 2 minutes, do it now.",
      "Your next Pomodoro session is your most important one. Start it.",
      "Break your goal into the smallest possible next step and do just that.",
      "Deep work requires uninterrupted blocks. Protect your focus time fiercely.",
      "Review what you accomplished today — recognizing progress fuels motivation.",
    ];
    const reply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)]!;
    res.json({ reply, fallback: true });
    return;
  }

  const { message, conversationHistory } = req.body as {
    message?: string;
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  };
  if (!message?.trim()) { res.status(400).json({ error: "message required" }); return; }

  try {
    const [user] = await db.select({ name: usersTable.name, onboardingData: usersTable.onboardingData })
      .from(usersTable).where(eq(usersTable.id, req.userId));

    const today = new Date().toISOString().split("T")[0]!;
    const [readiness] = await db.select({ score: readinessLogsTable.score, sessionLengthRec: readinessLogsTable.sessionLengthRec })
      .from(readinessLogsTable)
      .where(and(eq(readinessLogsTable.userId, req.userId), eq(readinessLogsTable.date, today)));

    const recentDistractions = await db.select({ reason: distractionLogsTable.reason })
      .from(distractionLogsTable)
      .where(eq(distractionLogsTable.userId, req.userId))
      .orderBy(desc(distractionLogsTable.createdAt))
      .limit(3);

    const [activeSession] = await db.select({ mode: activeSessionsTable.mode, secondsLeft: activeSessionsTable.secondsLeft, timerStatus: activeSessionsTable.timerStatus })
      .from(activeSessionsTable)
      .where(eq(activeSessionsTable.userId, req.userId));

    const context: string[] = [];
    if (user?.name) context.push(`User's name: ${user.name}`);
    const od = user?.onboardingData as any;
    if (od?.goal) context.push(`Focus goal: ${od.goal}`);
    if (readiness) context.push(`Today's readiness score: ${readiness.score}/100 (recommended session: ${readiness.sessionLengthRec}min)`);
    if (activeSession?.timerStatus === "running") {
      const minsLeft = Math.floor((activeSession.secondsLeft ?? 0) / 60);
      context.push(`Currently in a ${activeSession.mode} session with ${minsLeft} minutes left`);
    }
    if (recentDistractions.length > 0) {
      context.push(`Recent distractions: ${recentDistractions.map(d => d.reason).join(", ")}`);
    }

    const systemPrompt = `You are FocusArx Coach, an expert productivity and neuroscience coach. You have access to the user's context below. Be warm, sharp, and motivating. Under 100 words unless asked for more.

User context:
${context.length > 0 ? context.join("\n") : "No context available yet."}`;

    const history = (conversationHistory ?? []).slice(-10);
    const messages = [...history, { role: "user" as const, content: message }];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 300,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error({ status: response.status, errText }, "Anthropic API error");
      res.status(502).json({ error: "AI service error" });
      return;
    }

    const data = await response.json() as { content?: Array<{ text?: string }> };
    const reply = data.content?.[0]?.text ?? "Stay focused — you've got this!";
    res.json({ reply });
  } catch (err) {
    logger.error({ err }, "coach chat error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/coach/session-tip", auth, async (req: any, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.json({ tip: null }); return; }

  try {
    const today = new Date().toISOString().split("T")[0]!;
    const [readiness] = await db.select({ score: readinessLogsTable.score })
      .from(readinessLogsTable)
      .where(and(eq(readinessLogsTable.userId, req.userId), eq(readinessLogsTable.date, today)));

    const prompt = `Give one ultra-concise focus tip (max 2 sentences, no bullet points) for a user about to start a focus session.${readiness ? ` Their readiness score is ${readiness.score}/100.` : ""}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 100,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json() as { content?: Array<{ text?: string }> };
    res.json({ tip: data.content?.[0]?.text ?? null });
  } catch {
    res.json({ tip: null });
  }
});

export { router as coachRouter };
