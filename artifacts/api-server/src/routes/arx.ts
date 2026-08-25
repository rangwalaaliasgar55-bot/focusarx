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
import { Router } from "express";
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

export { router as arxRouter, ARX_DAILY_LLM_CAP };
