import { z } from "zod";

/**
 * AI Budget and Abuse Controls — Stronger Enforcement
 */

export const coachResponseSchema = z.object({
  message: z.string().max(2000),
  suggestions: z.array(z.string().max(300)).max(5).optional(),
});

export const aiRoadmapResponseSchema = z.object({
  day: z.number().int().min(1).max(365),
  focusSessions: z.array(z.string().max(200)).max(20),
  tasks: z.array(z.string().max(300)).max(10),
  estimatedTime: z.number().int().min(0).max(1440),
  milestone: z.string().max(500).optional(),
  progressCheck: z.string().max(500).optional(),
  resources: z.array(z.object({
    title: z.string().max(200),
    url: z.string().url().max(500),
    type: z.string().max(50),
  })).max(5).optional(),
});

export const MAX_AI_INPUT_LENGTH = 1000;
export const MAX_AI_OUTPUT_LENGTH = 2000;
export const MAX_DAILY_AI_CALLS_PER_USER = 30;
export const MAX_DAILY_AI_CALLS_PER_IP = 100;

// Prompt injection protection — basic blocklist
const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /ignore\s+all\s+previous/i,
  /system\s*:\s*/i,
  /you\s+are\s+now/i,
  /do\s+anything\s+now/i,
  /DAN\s+mode/i,
  /jailbreak/i,
  /bypass\s+your\s+restrictions/i,
  /reveal\s+your\s+prompt/i,
  /show\s+your\s+system\s+prompt/i,
];

export function detectPromptInjection(input: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

export function sanitizeAiInput(input: string): string {
  // Remove potential injection attempts and trim
  let sanitized = input.trim().slice(0, MAX_AI_INPUT_LENGTH);
  // Remove excessive newlines, control chars
  // eslint-disable-next-line no-control-regex -- stripping C0/DEL control bytes is the point
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Collapse whitespace
  sanitized = sanitized.replace(/\s+/g, " ");
  return sanitized;
}

export function validateAiOutput(output: string, maxLength = MAX_AI_OUTPUT_LENGTH): { valid: boolean; sanitized: string } {
  if (!output || typeof output !== "string") {
    return { valid: false, sanitized: "" };
  }
  if (output.length > maxLength) {
    return { valid: true, sanitized: output.slice(0, maxLength) + "..." };
  }
  // Basic content filtering — no disallowed content
  const sanitized = output.trim();
  return { valid: true, sanitized };
}

// Structured validation helpers
export function validateCoachResponse(data: unknown): { valid: boolean; data?: z.infer<typeof coachResponseSchema>; error?: string } {
  const parsed = coachResponseSchema.safeParse(data);
  if (!parsed.success) {
    return { valid: false, error: parsed.error.errors[0]?.message ?? "Invalid coach response" };
  }
  return { valid: true, data: parsed.data };
}

// Rate limiting helpers — in-memory for per-IP unauthenticated
const ipCallCounts = new Map<string, { count: number; resetAt: number }>();

export function checkIpLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipCallCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    ipCallCounts.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= MAX_DAILY_AI_CALLS_PER_IP) {
    return false;
  }
  entry.count++;
  return true;
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipCallCounts.entries()) {
    if (now > entry.resetAt) ipCallCounts.delete(ip);
  }
}, 60 * 60 * 1000).unref?.();

// Provider fallback — only for safe, known errors
export type SafeFallbackReason = "rate_limited" | "timeout" | "model_overloaded" | "budget_exceeded";

export function isSafeFallbackError(error: unknown): SafeFallbackReason | null {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("429") || message.includes("rate limit") || message.includes("quota")) return "rate_limited";
  if (message.includes("timeout") || message.includes("timed out")) return "timeout";
  if (message.includes("overloaded") || message.includes("503") || message.includes("model")) return "model_overloaded";
  if (message.includes("budget") || message.includes("cap exceeded")) return "budget_exceeded";
  return null;
}
