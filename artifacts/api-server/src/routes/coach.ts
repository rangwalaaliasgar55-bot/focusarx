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

// Groq API — Llama 3.1 8B Instant (feels near-instant for users)
async function callGroq(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
  maxTokens = 300,
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: maxTokens,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
          { role: "user", content: userMessage },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

// Smart built-in fallback (no API key required)
function builtinReply(userMessage: string): string {
  const msg = userMessage.toLowerCase();
  const tips = [
    "Break your work into 25-minute focused blocks with 5-minute breaks. Consistency beats intensity.",
    "The best time to start was yesterday. The second best time is now.",
    "Eliminate distractions before they happen — phone in another room, notifications off, water nearby.",
    "Review what you accomplished today, not what you didn't. Progress compounds over time.",
    "Energy management matters more than time management. Match hard tasks to your peak energy hours.",
    "One focused hour beats three distracted hours. Close all tabs except what you need right now.",
    "Your brain needs recovery. A proper 5-minute break makes the next session sharper.",
  ];
  if (msg.includes("distract") || msg.includes("focus"))
    return "Close everything except the one thing you're working on. Set a 25-minute timer and commit fully.";
  if (msg.includes("tired") || msg.includes("energy") || msg.includes("exhausted"))
    return "Take a real 10-minute break — walk outside if you can. Tired focus sessions waste more time than they save.";
  if (msg.includes("motivat") || msg.includes("stuck") || msg.includes("procrastinat"))
    return "Start with the smallest possible version of the task. Open the file. Write one sentence. Momentum builds from tiny actions.";
  if (msg.includes("plan") || msg.includes("priorit"))
    return "Pick your 3 most important tasks. Do the hardest one first while your willpower is highest.";
  if (msg.includes("overwhelm") || msg.includes("stress") || msg.includes("anxious"))
    return "When everything feels urgent, nothing is. Take 3 deep breaths, then pick ONE thing to do in the next 25 minutes.";
  return tips[Math.floor(Date.now() / 1000) % tips.length]!;
}

router.post("/coach/chat", auth, async (req: any, res) => {
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
    if (od?.goal) {
      const safeGoal = (od.goal as string)
        .replace(/[\r\n`"]/g, " ")
        .trim()
        .slice(0, 200);
      context.push(`Focus goal: ${safeGoal}`);
    }
    if (readiness) context.push(`Today's readiness: ${readiness.score}/100 (recommended session: ${readiness.sessionLengthRec}min)`);
    if (activeSession?.timerStatus === "running") {
      const minsLeft = Math.floor((activeSession.secondsLeft ?? 0) / 60);
      context.push(`Currently in a ${activeSession.mode} session, ${minsLeft}min left`);
    }
    if (recentDistractions.length > 0) {
      context.push(`Recent distractions: ${recentDistractions.map(d => d.reason).join(", ")}`);
    }

    const systemPrompt = `You are FocusArx Coach — an expert productivity and deep-work coach powered by neuroscience. You have real-time context about this user below. Be warm, sharp, direct. Under 80 words unless the user asks for more. Never use bullet points.

User context:
${context.length > 0 ? context.join("\n") : "No context available yet."}`;

    const history = (conversationHistory ?? []).slice(-8);
    const reply = await callGroq(systemPrompt, history, message)
      ?? builtinReply(message);

    res.json({ reply, fallback: !process.env.GROQ_API_KEY });
  } catch (err) {
    logger.error({ err }, "coach chat error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/coach/session-tip", auth, async (req: any, res) => {
  try {
    const today = new Date().toISOString().split("T")[0]!;
    const [readiness] = await db.select({ score: readinessLogsTable.score })
      .from(readinessLogsTable)
      .where(and(eq(readinessLogsTable.userId, req.userId), eq(readinessLogsTable.date, today)));

    const systemPrompt = "You are a focus coach. Give ONE ultra-concise focus tip (max 2 sentences, plain text, no bullet points).";
    const userMessage = `Quick tip for a user about to start a focus session.${readiness ? ` Readiness: ${readiness.score}/100.` : ""}`;

    const tip = await callGroq(systemPrompt, [], userMessage, 80)
      ?? "Start your timer, close every other tab. The hardest part is always the first 2 minutes.";

    res.json({ tip, fallback: !process.env.GROQ_API_KEY });
  } catch {
    res.json({ tip: "Start your timer, close every other tab." });
  }
});

export { router as coachRouter };
