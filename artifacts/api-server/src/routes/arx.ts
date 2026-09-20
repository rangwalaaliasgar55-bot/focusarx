/**
 * Arx — the focus companion (Workstream G, G2).
 *
 * Users start a message with "Arx " (case-insensitive) to ask the
 * companion for guidance. Guardrails:
 *   - ≤30 LLM replies per user per IST day (platform_meta counter,
 *     enforced against ai_call_log) — beyond the cap, Arx still answers,
 *     but from the deterministic template pool (zero cost, zero keys).
 *   - Every reply passes `sanitizeNeverNegative` — the companion cannot
 *     discourage, shame, or gate the learner, LLM or template.
 *   - Zero AI keys → templates only; the feature never 500s.
 */
import { Router, type Response } from "express";
import { z } from "zod";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { generateAi } from "../lib/aiProvider";
import { arxTemplateReply, sanitizeNeverNegative, ARX_SYSTEM_PROMPT } from "../lib/aiTemplates";
import { userPurposeCalls } from "../lib/aiBudget";
import { logger } from "../lib/logger";

const router = Router();

const ARX_DAILY_LLM_CAP = 30;
const MESSAGE_MAX = 500;

const chatSchema = z.object({
  message: z.string().min(3).max(MESSAGE_MAX),
});

function stripArxPrefix(message: string): string {
  const m = message.trim();
  return m.replace(/^arx[\s,:!-]*/i, "").trim();
}

router.post("/arx/chat", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Message must be 3–500 characters" });
    return;
  }
  const raw = parsed.data.message;
  // The "Arx " prefix is the invocation contract (case-insensitive).
  if (!/^arx[\s,:!-]/i.test(raw.trim())) {
    res.status(400).json({ error: "Start your message with “Arx ” to reach the companion" });
    return;
  }

  try {
    const question = stripArxPrefix(raw);
    const llmUsedToday = await userPurposeCalls(req.userId, "arx_reply");
    const underCap = llmUsedToday < ARX_DAILY_LLM_CAP;

    let reply = "";
    let source: "llm" | "template" = "template";
    let llmUsed = false;

    if (underCap) {
      const result = await generateAi({
        purpose: "arx_reply",
        prompt: question,
        system: ARX_SYSTEM_PROMPT,
        maxTokens: 220,
        userId: req.userId,
      });
      if (result && result.source === "llm") {
        reply = result.text;
        source = "llm";
        llmUsed = true; // only a real LLM call counts against the 30/day cap
      }
    }
    if (!reply) {
      reply = arxTemplateReply(question);
      source = "template";
    }

    const safe = sanitizeNeverNegative(reply).slice(0, 600);
    res.json({
      reply: safe,
      source,
      llmUsed,
      llmRemaining: Math.max(0, ARX_DAILY_LLM_CAP - (llmUsed ? llmUsedToday + 1 : llmUsedToday)),
    });
  } catch (err) {
    logger.error({ err }, "arx chat error");
    // Companion degrades to a template rather than erroring.
    res.json({ reply: sanitizeNeverNegative(arxTemplateReply(raw)), source: "template", llmUsed: false, llmRemaining: ARX_DAILY_LLM_CAP });
  }
});

// ── VOICE ────────────────────────────────────────────────────────────────────
/**
 * Speak to Arx, and it answers out loud *and can act*.
 *
 * The transcript arrives from the browser's speech recogniser as plain text, so
 * the server's job is intent, not audio: one model call returns an answer plus
 * an optional action, and the action is validated before anything is written.
 *
 * Guardrails that make this safe to expose:
 *  - the action is a closed enum; unknown or malformed actions become `none`,
 *    so a hallucinated payload can never write to an arbitrary table;
 *  - task/goal titles are length-clamped, priority is whitelisted, and the
 *    estimate is bounded to 5–480 minutes;
 *  - an unrecognised intent still gets a supportive template reply — voice mode
 *    must never answer a human with silence or a 500;
 *  - the same daily LLM cap as text chat applies, and template mode handles
 *    "add task …" phrases by pattern when no key is configured.
 */
const voiceSchema = z.object({
  transcript: z.string().trim().min(2).max(600),
  /** Optional screen context, e.g. "tasks" — lets instruction-style phrasing ("add this") resolve. */
  context: z.string().max(40).optional(),
});

type VoiceAction =
  | { type: "none" }
  | { type: "create_task"; title: string; estimatedMinutes: number | null; priority: "low" | "medium" | "high" }
  | { type: "create_goal"; title: string; description: string | null };

const PRIORITIES = new Set(["low", "medium", "high"]);

/** Deterministic intent parsing — the path with no AI key, and the safety net. */
function templateVoiceIntent(transcript: string): { reply: string; action: VoiceAction } {
  const text = transcript.trim();
  const taskMatch = text.match(/^(?:please\s+)?(?:add|create|new)\s+(?:a\s+)?task(?:\s*(?:to|:)?\s*)(.+)$/i)
    ?? text.match(/^(?:remind me to|i need to|todo)\s+(.+)$/i);
  const goalMatch = text.match(/^(?:please\s+)?(?:add|create|new|set)\s+(?:a\s+)?goal(?:\s*(?:to|:)?\s*)(.+)$/i);
  const minutesMatch = text.match(/(\d{1,3})\s*(?:min|minutes)/i);

  if (goalMatch?.[1]?.trim()) {
    const title = goalMatch[1].trim().slice(0, 120);
    return { reply: `Goal added: “${title}”. I'll keep it next to your focus time.`, action: { type: "create_goal", title, description: null } };
  }
  if (taskMatch?.[1]?.trim()) {
    const title = taskMatch[1].trim().replace(/\s+by\s+.*$/i, "").slice(0, 120);
    const minutes = minutesMatch ? Math.min(480, Math.max(5, Number(minutesMatch[1]))) : null;
    return {
      reply: minutes ? `Task added: “${title}” for about ${minutes} minutes.` : `Task added: “${title}”.`,
      action: { type: "create_task", title, estimatedMinutes: minutes, priority: "medium" },
    };
  }
  return { reply: sanitizeNeverNegative(arxTemplateReply(text)), action: { type: "none" } };
}

function parseVoiceAction(raw: unknown): VoiceAction {
  if (!raw || typeof raw !== "object") return { type: "none" };
  const candidate = raw as Record<string, unknown>;
  const type = typeof candidate.type === "string" ? candidate.type : "none";
  if (type === "create_task") {
    const title = typeof candidate.title === "string" ? candidate.title.trim().slice(0, 120) : "";
    if (title.length < 2) return { type: "none" };
    const estimate = Number(candidate.estimatedMinutes);
    const priority = typeof candidate.priority === "string" && PRIORITIES.has(candidate.priority) ? candidate.priority as "low" | "medium" | "high" : "medium";
    return {
      type: "create_task",
      title,
      estimatedMinutes: Number.isFinite(estimate) ? Math.min(480, Math.max(5, Math.round(estimate))) : null,
      priority,
    };
  }
  if (type === "create_goal") {
    const title = typeof candidate.title === "string" ? candidate.title.trim().slice(0, 120) : "";
    if (title.length < 2) return { type: "none" };
    const description = typeof candidate.description === "string" ? candidate.description.trim().slice(0, 300) : null;
    return { type: "create_goal", title, description };
  }
  return { type: "none" };
}

router.post("/arx/voice", authMiddleware, async (req: AuthRequest, res: Response) => {
  const parsed = voiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Say something a little longer (2–600 characters)" });
  const transcript = parsed.data.transcript;

  try {
    const llmUsedToday = await userPurposeCalls(req.userId, "arx_voice");
    const underCap = llmUsedToday < ARX_DAILY_LLM_CAP;

    let reply = "";
    let action: VoiceAction = { type: "none" };
    let source: "llm" | "template" = "template";

    if (underCap) {
      const result = await generateAi({
        purpose: "arx_voice",
        prompt: transcript,
        system: `${ARX_SYSTEM_PROMPT}

You are being spoken to. Reply in at most two sentences of plain spoken English (no markdown, no emoji, no lists) — the answer is read aloud.
If — and only if — the person is asking you to remember something, also propose an action.
Return ONLY JSON: {"reply": "<spoken answer>", "action": {"type": "none"} | {"type": "create_task", "title": "...", "estimatedMinutes": 25, "priority": "low|medium|high"} | {"type": "create_goal", "title": "...", "description": "..."}}
Context on the current screen: ${parsed.data.context ?? "unknown"}.`,
        maxTokens: 300,
        userId: req.userId,
      });
      if (result && result.source === "llm") {
        try {
          const text = result.text;
          const start = text.indexOf("{");
          const end = text.lastIndexOf("}");
          const obj = start !== -1 && end > start ? JSON.parse(text.slice(start, end + 1)) : null;
          if (obj && typeof obj.reply === "string" && obj.reply.trim()) {
            reply = sanitizeNeverNegative(obj.reply.trim().slice(0, 600));
            action = parseVoiceAction(obj.action);
            source = "llm";
          }
        } catch { /* fall through to the template path below */ }
      }
    }

    if (!reply) {
      const fallback = templateVoiceIntent(transcript);
      reply = fallback.reply;
      action = fallback.action;
      source = "template";
    }

    // Arx may propose planning intent, but never writes from an uncertain speech
    // transcript. The client hands proposals to the editable voice planner.
    const needsReview = action.type !== "none";
    const safeReply = needsReview ? `${reply} Review the draft before saving it.` : reply;
    res.json({
      reply: safeReply,
      transcript,
      source,
      action,
      created: null,
      needsReview,
      spoken: safeReply,
      llmUsed: source === "llm",
      llmRemaining: Math.max(0, ARX_DAILY_LLM_CAP - (source === "llm" ? llmUsedToday + 1 : llmUsedToday)),
    });
  } catch (err) {
    logger.error({ err }, "arx voice error");
    const fallback = templateVoiceIntent(transcript);
    res.json({ reply: fallback.reply, spoken: fallback.reply, transcript, source: "template", action: fallback.action, created: null, llmUsed: false, llmRemaining: ARX_DAILY_LLM_CAP });
  }
});

export { router as arxRouter, ARX_DAILY_LLM_CAP };
