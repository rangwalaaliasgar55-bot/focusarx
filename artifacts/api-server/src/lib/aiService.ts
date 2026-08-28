/**
 * Provider-independent AI service interface (§6 of the production-readiness
 * plan).
 *
 * `defaultAiProvider` adapts the platform's unified gateway
 * (`aiProvider.generateAi` — budget checks, Gemini→Groq fallback, call logging,
 * zero-key degradation) and the two-layer moderator (`moderation.moderateText`
 * — keyword heuristics + AI review) to a stable contract:
 *
 *   interface AiProvider {
 *     generateText(request: AiTextRequest): Promise<AiTextResponse | null>;
 *     moderate(request: ModerationRequest): Promise<ModerationResponse>;
 *   }
 *
 * New features must depend on this interface, not on a concrete vendor. Tests
 * inject a fake `AiProvider` — no keys, no network, deterministic.
 *
 * Contract notes:
 *  - `generateText` resolves `null` when no provider can serve (no keys,
 *    budgets exhausted, timeouts) — callers degrade to templates; it never
 *    throws for provider outages.
 *  - `moderate` ALWAYS resolves with a verdict (heuristic layer is always on),
 *    so moderation has no failure mode that can leave content unreviewed.
 */

export interface AiTextRequest {
  /** Coarse caller identity, used for per-purpose budgets + call logs. */
  purpose: string;
  prompt: string;
  system?: string;
  /** Ask the provider for strict JSON output. */
  json?: boolean;
  maxTokens?: number;
  /** End user the call is attributed to (per-user caps / audit trails). */
  userId?: string | null;
  /** Skip the LLM entirely (template-only caller). */
  forceTemplate?: boolean;
}

export interface AiTextResponse {
  text: string;
  provider: "gemini" | "groq";
  model: string;
  /** "llm" when a model produced it, "template" when fallback content. */
  source: "llm" | "template";
  fallbackUsed: boolean;
  tokensIn?: number;
  tokensOut?: number;
}

export interface ModerationRequest {
  text: string;
  /** Optional hint about where the text appears (post, comment, chat…). */
  context?: string;
}

export interface ModerationResponse {
  status: "approved" | "flagged" | "rejected";
  reason: string;
  method: "keyword" | "ai" | "ai-fallback" | "none";
}

export interface AiProvider {
  generateText(request: AiTextRequest): Promise<AiTextResponse | null>;
  moderate(request: ModerationRequest): Promise<ModerationResponse>;
}

import { generateAi } from "./aiProvider";
import { moderateText } from "./moderation";

export const defaultAiProvider: AiProvider = {
  async generateText(request: AiTextRequest): Promise<AiTextResponse | null> {
    return generateAi({
      purpose: request.purpose,
      prompt: request.prompt,
      system: request.system,
      json: request.json,
      maxTokens: request.maxTokens,
      userId: request.userId,
      forceTemplate: request.forceTemplate,
    });
  },

  async moderate(request: ModerationRequest): Promise<ModerationResponse> {
    const result = await moderateText(request.text);
    return { status: result.status, reason: result.reason, method: result.method };
  },
};
