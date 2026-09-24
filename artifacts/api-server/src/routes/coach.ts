import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable, distractionLogsTable, readinessLogsTable, activeSessionsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import { userZone } from "../lib/userZone";
import { dayKeyInZone } from "../lib/timezone";
import { aiCoachLimiter } from "../lib/rateLimiter";
import { premiumStatusMiddleware } from "../lib/premiumCheck";
import { getActivePlans } from "../lib/premiumPlans";
import { getTokenBalance } from "../lib/tokenLedger";
import { userPurposeCalls } from "../lib/aiBudget";
import { generateAi } from "../lib/aiProvider";
import {
  sanitizeAiInput,
  detectPromptInjection,
  validateAiOutput,
  checkIpLimit,
} from "../lib/aiGuardrails";
import {
  COACH_ACTION_CONTRACT,
  MAX_ACTIONS,
  executeCoachActions,
  openTaskTitles,
  parseActionsFromModel,
  parseActionsFromText,
  type CoachAction,
  type ExecutedAction,
} from "../lib/coachActions";
import { z } from "zod";

const router = Router();

const coachChatSchema = z.object({
  message: z.string().min(1).max(1000),
  conversationHistory: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(1000),
  })).max(20).optional(),
});

/**
 * The offline coach.
 *
 * `builtinReply` is what a student gets when every provider is unavailable —
 * no key configured, both budgets spent, or an outage. It used to be a keyword
 * match over seven tips, so "plan my thermodynamics revision" (a *task*) got a
 * motivational quote back, which reads exactly like an AI that ignored the
 * request. If the gateway is down we cannot know the topic, but we can still
 * return the shape of the answer — a plan, a breakdown, a next action — and say
 * that the topic-specific version needs the model. The rule the system prompt
 * enforces is enforced here too: answer, never ask, and name the assumption.
 */
function builtinReply(userMessage: string): string {
  const msg = userMessage.toLowerCase();
  const asksForPlan = /\b(plan|schedule|timetable|routine|revise|revision|prepare|prepare for|study for)\b/.test(msg);
  const asksForBreakdown = /\b(break|split|chunk|decompose|steps|subtask|outline|structure)\b/.test(msg);
  const asksWhat = /\b(what should i|where do i start|which one|prioriti[sz]e|pick)\b/.test(msg);
  const asksForNotes = /\b(notes|summar|flashcard|mind ?map|explain)\b/.test(msg);

  if (asksForBreakdown) {
    return "Take the task and cap it at four steps, each small enough to finish in one 25-minute block: (1) gather what you already have — files, notes, references; (2) produce the ugliest possible first version; (3) fix the part that is most wrong; (4) check it against the requirement and stop. I assumed one 25-minute block per step; tell me the deadline and I will compress it.";
  }
  if (asksForPlan) {
    return "Assumed you have tonight. Three 50-minute blocks with 10-minute breaks: first block the topic you understand least, second block past questions on it, third block recall with the book shut. Write the block's one deliverable on paper before you start. Give me the subject and days left and I will lay this out across the week.";
  }
  if (asksForNotes) {
    return "Make the notes you would want an hour before the exam: one page per topic, headings only, and every line phrased as a question you must be able to answer. Anything you cannot phrase as a question is not a note yet, it is a copy. I assumed one page per topic; give me the syllabus and I will order them by weightage.";
  }
  if (asksWhat) {
    return "Pick by cost of delay, not by size: the item whose deadline moves first is the one to start. Write the three candidates down, give each a deadline, and begin the earliest one for 25 minutes. If two share a deadline, start the one you are least prepared for. Tell me the three and I will rank them for you.";
  }
  if (/\b(distract|phone|scroll|instagram|youtube)\b/.test(msg)) {
    return "Move the phone to another room — not face-down, another room — and write the one sentence you will have finished before you look at it again. Then start a 25-minute block on that sentence.";
  }
  if (/\b(tired|energy|exhaust|sleep)\b/.test(msg)) {
    return "Take 20 minutes lying down with no screen, then one 25-minute block on the easiest real task on your list. Tired focus on an easy task beats wide-awake focus on nothing.";
  }
  if (/\b(motivat|stuck|procrastinat|can'?t start|overwhelm|stress|anxious)\b/.test(msg)) {
    return "Open the file and write one bad sentence. Momentum comes after starting, not before it. The first 2 minutes are the whole fight — commit to those and stop if you still want to.";
  }
  return "Start a 25-minute block on the single thing that would make today count, and put the phone in another room. I am in offline mode right now, so give me the specific task and I will break it into blocks as soon as the model is back.";
}

/** Per-tier daily coach allowance — the entitlement, in one place. */
export const COACH_DAILY_FREE = 10;
export const COACH_DAILY_PREMIUM = 60;

function coachDailyLimit(isPremium: boolean): number {
  return isPremium ? COACH_DAILY_PREMIUM : COACH_DAILY_FREE;
}

/**
 * The coach is deliberately NOT premium-only any more.
 *
 * It used to be `requirePremium` on the server *and* a hard `isLocked` check in
 * the panel on the client, so a free student never sent a request and never saw
 * a model. Every complaint of the form "the AI does not do what I ask" is this
 * wall: the only text they could reach was a canned reply or a lock screen.
 * The entitlement now lives in the daily allowance below — free students get
 * enough messages to feel the product work, premium removes the ceiling — while
 * the per-IP guardrails, input sanitisation, injection detection and budget caps
 * all stay exactly as they were.
 */
router.post("/coach/chat", authMiddleware, premiumStatusMiddleware, aiCoachLimiter, async (req: AuthRequest, res) => {
  const ip = req.ip ?? "unknown";
  if (!checkIpLimit(ip)) {
    res.status(429).json({ error: { code: "RATE_LIMITED", message: "Daily AI limit for this IP reached" } });
    return;
  }

  const parsed = coachChatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", details: parsed.error.errors } });
    return;
  }

  const rawMessage = parsed.data.message;
  const sanitized = sanitizeAiInput(rawMessage);

  if (detectPromptInjection(rawMessage)) {
    logger.warn({ userId: req.userId, rawMessage: rawMessage.slice(0, 100) }, "prompt injection detected");
    res.status(400).json({ error: { code: "INVALID_INPUT", message: "Message contains disallowed content" } });
    return;
  }

  if (sanitized.length === 0) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Message is empty after sanitization" } });
    return;
  }

  // Per-user daily allowance, by tier. Checked before any model call, and the
  // count is taken from the AI call log, so it survives restarts and is shared
  // with every other AI feature that logs the same purpose.
  let coachUsed = 0;
  try {
    coachUsed = await userPurposeCalls(req.userId, "coach_chat");
    const limit = coachDailyLimit(Boolean(req.isPremium));
    if (coachUsed >= limit) {
      res.status(429).json({
        error: {
          code: "BUDGET_EXCEEDED",
          message: `That is all ${limit} coach messages for today — the count resets at midnight IST. Premium removes the daily limit.`,
        },
        allowance: { used: coachUsed, limit, remaining: 0, isPremium: Boolean(req.isPremium) },
      });
      return;
    }
  } catch (err) {
    logger.warn({ err }, "budget check failed, continuing with fallback allowed");
  }

  try {
    const [user] = await db.select({ name: usersTable.name, onboardingData: usersTable.onboardingData })
      .from(usersTable).where(eq(usersTable.id, req.userId));

    const today = dayKeyInZone(Date.now(), await userZone(req.userId));
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
    const od = user?.onboardingData as Record<string, unknown> | null | undefined;
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

    // The closing instruction is doing real work: asked "make me a plan for
    // thermodynamics", a model with a coach persona tends to reply "Sure! How
    // many hours a day do you have?" — a question back instead of the thing the
    // user asked for. Users read that as the AI not doing the task. There is no
    // second turn unless the user chooses to send one, so the coach answers with
    // the artefact, states any assumption it had to make, and offers to adjust.
    const systemPrompt = `You are FocusArx Coach — an expert productivity and deep-work coach powered by neuroscience and Google Gemini. You have real-time context about this user below. Be warm, sharp, direct. Under 80 words unless the user asks for more. Never use bullet points.\n\nWhen the user asks you to DO something — plan a session, break down a task, decide what to study next — do it in this reply using your best assumption and say what you assumed. Never ask a clarifying question, never end with "let me know if…" as a substitute for an answer, and never reply with only a question. If the request is genuinely ambiguous, pick the most likely reading and complete it.\n\nUser context:\n${context.length > 0 ? context.join("\n") : "No context available yet."}`;

    const history = (parsed.data.conversationHistory ?? []).slice(-6);
    const historyFormatted = history.map(h => `${h.role === "user" ? "User" : "Coach"}: ${h.content}`).join("\n");
    const fullPrompt = historyFormatted ? `${historyFormatted}\nUser: ${sanitized}\nCoach:` : sanitized;

    // The coach can act, so it needs to know what the student already has open
    // ("mark the physics revision done" is only resolvable against a real list)
    // and it needs to be told the action contract in the same breath as its
    // persona. `openTaskTitles` fails soft: an empty list just means the model
    // may create tasks but must not complete any.
    const openTasks = await openTaskTitles(req.userId!).catch(() => [] as string[]);
    const actionContext = [
      "",
      COACH_ACTION_CONTRACT,
      "",
      `Today is ${today}.`,
      openTasks.length
        ? `OPEN TASKS (the only titles you may pass to complete_task):\n${openTasks.map((title) => `- ${title}`).join("\n")}`
        : "OPEN TASKS: none — do not use complete_task.",
    ].join("\n");

    const aiResult = await generateAi({
      purpose: "coach_chat",
      prompt: fullPrompt,
      system: `${systemPrompt}\n${actionContext}`,
      // JSON mode: the reply and its actions arrive together, so a request that
      // names a task lands in the database rather than in a paragraph.
      json: true,
      maxTokens: 600,
      userId: req.userId,
    });

    let reply: string;
    let actions: CoachAction[] = [];
    let isFallback = false;

    if (aiResult && aiResult.text) {
      const parsedReply = parseActionsFromModel(aiResult.text);
      const validated = validateAiOutput(parsedReply.reply, 2000);
      reply = validated.sanitized;
      actions = parsedReply.actions;
    } else {
      isFallback = true;
      reply = builtinReply(sanitized);
    }

    // The deterministic reader is not only the offline path — it is also a
    // safety net for the common, unambiguous imperative. A model that answers
    // "sure, I have noted that" in prose while emitting no action has still
    // failed the student; if the sentence is an explicit instruction, do it.
    if (actions.length === 0) {
      actions = parseActionsFromText(sanitized, today);
    }

    let executed: ExecutedAction[] = [];
    if (actions.length > 0) {
      executed = await executeCoachActions(req.userId!, actions.slice(0, MAX_ACTIONS));
      // A task created from the offline reader should not be double-created by
      // a following "add it again" retry within the same second; the executor
      // is the only writer and each call is a single insert, so no dedupe key
      // is needed beyond the student's own words.

      // If the model produced no usable sentence but we did act, say what we did
      // rather than showing an empty bubble.
      if (!reply.trim() && executed.length > 0) reply = "Done.";
    }

    const limit = coachDailyLimit(Boolean(req.isPremium));
    res.json({
      reply,
      // What the coach actually did, in the student's words. The panel renders
      // these as chips and refreshes the task list — a claim of work that did
      // not happen is worse than no action at all.
      actions: executed,
      fallback: isFallback,
      provider: aiResult?.provider ?? "template",
      // The panel shows this, so a student can see the allowance rather than
      // discovering it by being refused.
      allowance: { used: coachUsed + 1, limit, remaining: Math.max(0, limit - coachUsed - 1), isPremium: Boolean(req.isPremium) },
    });
  } catch (err) {
    logger.error({ err }, "coach chat error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

router.get("/coach/status", authMiddleware, premiumStatusMiddleware, async (req: AuthRequest, res) => {
  try {
    const isPremium = Boolean(req.isPremium);
    const limit = coachDailyLimit(isPremium);
    const used = await userPurposeCalls(req.userId!, "coach_chat").catch(() => 0);
    const allowance = { used, limit, remaining: Math.max(0, limit - used), isPremium };

    if (isPremium) {
      res.json({ isPremium: true, allowance });
      return;
    }
    // Free student with messages left: open the chat. Showing a lock screen to
    // someone who still has an allowance is how the coach became "broken".
    if (allowance.remaining > 0) {
      res.json({ isPremium: false, allowance, lockScreen: null });
      return;
    }
    // Allowance spent — now the upgrade copy is honest and useful.
    const [plans, balance] = await Promise.all([
      getActivePlans().catch(() => []),
      getTokenBalance(req.userId!).catch(() => 0),
    ]);
    const cheapest = [...plans].sort((a, b) => a.tokenCost - b.tokenCost)[0];
    const required = cheapest?.tokenCost ?? 10000;
    const needed = Math.max(0, required - balance);
    res.json({
      isPremium: false,
      allowance,
      lockScreen: {
        title: `That is all ${limit} coach messages for today`,
        description: "Your daily messages reset at midnight IST. Premium removes the limit and adds session analysis and weekly reviews.",
        benefits: [
          "Personalized focus plan",
          "Session reflection & analysis",
          "Weekly productivity summary",
          "Distraction pattern analysis",
          "Suggested session lengths",
          "Study plan generation",
          "Recovery suggestions after missed streaks",
        ],
        currentBalance: balance,
        requiredTokens: required,
        tokensNeeded: needed,
        plan: cheapest ? { name: cheapest.name, durationDays: cheapest.durationDays, tokenCost: cheapest.tokenCost } : null,
      },
    });
  } catch {
    // Never fail closed on the entitlement read: an unknown state opens the
    // chat and lets the request itself decide.
    res.json({ isPremium: false, allowance: { used: 0, limit: COACH_DAILY_FREE, remaining: COACH_DAILY_FREE, isPremium: false } });
  }
});

const sessionTipHandler = async (req: AuthRequest, res: Response) => {
  try {
    const today = dayKeyInZone(Date.now(), await userZone(req.userId));
    const [readiness] = await db.select({ score: readinessLogsTable.score })
      .from(readinessLogsTable)
      .where(and(eq(readinessLogsTable.userId, req.userId), eq(readinessLogsTable.date, today)));

    // No vendor name here: whichever provider the gateway picks answers this
    // (Gemini when it is up, Groq otherwise), and the AI policy page tells
    // users which providers receive their text. Claiming "Google Gemini" in
    // a prompt does not make it true.
    const systemPrompt = "You are a focus coach grounded in neuroscience. Give ONE ultra-concise focus tip (max 2 sentences, plain text, no bullet points). Do not ask a question — give the tip.";
    const userMessage = `Quick tip for a user about to start a focus session.${readiness ? ` Readiness: ${readiness.score}/100.` : ""}`;

    const aiResult = await generateAi({
      purpose: "session_tip",
      prompt: userMessage,
      system: systemPrompt,
      maxTokens: 100,
      userId: req.userId,
    });

    const tip = aiResult?.text
      ? validateAiOutput(aiResult.text, 300).sanitized
      : "Start your timer, close every other tab. The hardest part is always the first 2 minutes.";

    res.json({ tip, fallback: !aiResult?.text, provider: aiResult?.provider ?? "template" });
  } catch {
    res.json({ tip: "Start your timer, close every other tab." });
  }
};
router.get("/coach/session-tip", authMiddleware, premiumStatusMiddleware, sessionTipHandler);
router.post("/coach/session-tip", authMiddleware, premiumStatusMiddleware, sessionTipHandler);

export { router as coachRouter };
