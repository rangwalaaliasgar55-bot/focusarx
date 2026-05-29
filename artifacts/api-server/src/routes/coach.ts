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

// Tiered AI response system
async function getAIReply(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string
): Promise<{ reply: string; source: string }> {
  
  // Option 1: Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 300,
          system: systemPrompt,
          messages: [...messages, { role: "user", content: userMessage }],
        }),
      });
      if (response.ok) {
        const data = await response.json() as { content?: Array<{ text?: string }> };
        const reply = data.content?.[0]?.text;
        if (reply) return { reply, source: "anthropic" };
      }
    } catch { /* fall through */ }
  }

  // Option 2: Ollama (free, local)
  const ollamaUrl = process.env.OLLAMA_URL;
  if (ollamaUrl) {
    try {
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL ?? "llama3",
          messages: [{ role: "system", content: systemPrompt }, ...messages, { role: "user", content: userMessage }],
          stream: false,
        }),
      });
      if (response.ok) {
        const data = await response.json() as { message?: { content?: string } };
        const reply = data.message?.content;
        if (reply) return { reply, source: "ollama" };
      }
    } catch { /* fall through */ }
  }

  // Option 3: Smart built-in fallback based on message content
  const msg = userMessage.toLowerCase();
  const tips = [
    "Break your work into 25-minute focused blocks with 5-minute breaks. Consistency beats intensity.",
    "The best time to start was yesterday. The second best time is now. Start your next focus block.",
    "Eliminate distractions before they happen — phone in another room, notifications off, water nearby.",
    "Review what you accomplished today, not what you didn't. Progress compounds over time.",
    "Energy management matters more than time management. Match hard tasks to your peak energy hours.",
    "One focused hour beats three distracted hours. Close all tabs except what you need right now.",
    "Your brain needs recovery. A proper 5-minute break (walk, stretch, breathe) makes the next session sharper.",
  ];
  
  let reply: string;
  if (msg.includes("distract") || msg.includes("focus")) {
    reply = "Close everything except the one thing you're working on. Set a 25-minute timer and commit fully. Distractions get easier to resist once you start.";
  } else if (msg.includes("tired") || msg.includes("energy") || msg.includes("exhausted")) {
    reply = "Take a real 10-minute break — walk outside if you can. Tired focus sessions waste more time than they save. Rest is productive.";
  } else if (msg.includes("motivat") || msg.includes("stuck") || msg.includes("procrastinat")) {
    reply = "Start with the smallest possible version of the task. Open the file. Write one sentence. Momentum builds from tiny actions, not big decisions.";
  } else if (msg.includes("plan") || msg.includes("schedule") || msg.includes("priorit")) {
    reply = "Pick your 3 most important tasks for today. Do the hardest one first while your willpower is highest. Everything else is a bonus.";
  } else if (msg.includes("break") || msg.includes("rest")) {
    reply = "Breaks aren't laziness — they're strategic recovery. Step away completely: no screens, move your body, let your mind wander. You'll return sharper.";
  } else if (msg.includes("overwhelm") || msg.includes("stress") || msg.includes("anxious")) {
    reply = "When everything feels urgent, nothing is. Take 3 deep breaths, then pick ONE thing to do in the next 25 minutes. Just one.";
  } else {
    reply = tips[Math.floor(Date.now() / 1000) % tips.length]!;
  }
  
  return { reply, source: "builtin" };
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
    if (od?.goal) context.push(`Focus goal: ${od.goal}`);
    if (readiness) context.push(`Today's readiness score: ${readiness.score}/100 (recommended session: ${readiness.sessionLengthRec}min)`);
    if (activeSession?.timerStatus === "running") {
      const minsLeft = Math.floor((activeSession.secondsLeft ?? 0) / 60);
      context.push(`Currently in a ${activeSession.mode} session with ${minsLeft} minutes left`);
    }
    if (recentDistractions.length > 0) {
      context.push(`Recent distractions: ${recentDistractions.map(d => d.reason).join(", ")}`);
    }

    const systemPrompt = `You are FocusArx Coach, an expert productivity and neuroscience coach. You have access to the user's context below. Be warm, sharp, and motivating. Under 80 words unless asked for more.

User context:
${context.length > 0 ? context.join("\n") : "No context available yet."}`;

    const history = (conversationHistory ?? []).slice(-8);
    const { reply, source } = await getAIReply(systemPrompt, history, message);
    
    res.json({ reply, fallback: source === "builtin" });
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

    const systemPrompt = "You are a focus coach. Give one ultra-concise focus tip (max 2 sentences, no bullet points).";
    const userMessage = `Give a tip for a user about to start a focus session.${readiness ? ` Their readiness score is ${readiness.score}/100.` : ""}`;

    const { reply, source } = await getAIReply(systemPrompt, [], userMessage);
    res.json({ tip: reply, fallback: source === "builtin" });
  } catch {
    res.json({ tip: null });
  }
});

export { router as coachRouter };
