import { logger } from "./logger";

/**
 * Automated content moderation for social posts and comments.
 *
 * Two layers:
 *   1. Keyword heuristic (always on, zero latency, zero cost) — catches the
 *      obvious cases: profanity, slurs, spam patterns, suspicious links, and
 *      self-harm / violence escalation words.
 *   2. Groq LLM (when GROQ_API_KEY is set) — catches the subtle stuff the
 *      keyword list can't (harassment, veiled threats, hate speech, scams).
 *
 * Returns a verdict plus a human-readable reason so admins can review flagged
 * content in the moderation queue without reading every word.
 */

export type ModerationStatus = "approved" | "flagged" | "rejected";

export interface ModerationResult {
  status: ModerationStatus;
  reason: string;
  method: "keyword" | "ai" | "ai-fallback" | "none";
}

const BLOCKED_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  // Hard profanity & slurs — immediate rejection.
  { re: /\b(fuck|shit|bitch|cunt|dick|pussy|whore|slut)\b/i, reason: "Profanity" },
  { re: /\b(nigger|nigga|faggot|fag|retard|spic|chink|kike)\b/i, reason: "Hate speech / slur" },
  { re: /\b(kill yourself|kys|suicide|end it all|self[- ]harm)\b/i, reason: "Self-harm / suicide reference" },
  { re: /\b(shoot (up|them|you)|bomb (them|you)|i will kill)\b/i, reason: "Threat of violence" },
  // Scam / spam / phishing signals.
  { re: /\b(crypto|bitcoin|forex|investment).{0,40}\b(guaranteed|doubl|100%|free money|earn money)\b/i, reason: "Potential scam / spam" },
  { re: /(telegram|whatsapp|discord)[\s.\-]?(me|gg|com)\/[a-z0-9]+/i, reason: "Off-platform link (spam)" },
  { re: /\b(win (a |an )?(free )?(iphone|gift|prize))\b/i, reason: "Prize / giveaway scam" },
  // Contact farming.
  { re: /\b(call me at|text me at|add me on snap|follow my onlyfans)\b/i, reason: "Contact farming" },
];

// Strong signals → flag for human review rather than hard-block.
const FLAG_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /\b(drug|weed|cocaine|heroin|meth|pill)\b/i, reason: "Substance reference" },
  { re: /\b(hack|cheat|exploit|bot)\b.{0,30}\b(account|leaderboard|coins|xp)\b/i, reason: "Possible cheating / exploitation" },
  { re: /https?:\/\/(?!focusarx\.(site|app|vercel\.app))[^\s]+/i, reason: "External link" },
  { re: /\b(click here|check out my|dm me|follow me back)\b.{0,40}\b(link|page|profile|channel)\b/i, reason: "Promotional / self-promotion" },
];

function keywordModerate(text: string): ModerationResult | null {
  const trimmed = text.trim();

  for (const { re, reason } of BLOCKED_PATTERNS) {
    if (re.test(trimmed)) {
      return { status: "rejected", reason, method: "keyword" };
    }
  }
  for (const { re, reason } of FLAG_PATTERNS) {
    if (re.test(trimmed)) {
      return { status: "flagged", reason, method: "keyword" };
    }
  }
  return null;
}

async function aiModerate(text: string): Promise<ModerationResult | null> {
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
        max_tokens: 60,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You are a content moderator for a student productivity app. " +
              "Classify the user's message as one of: APPROVED, FLAGGED, or REJECTED. " +
              "REJECTED = clear profanity, hate speech, threats, self-harm, scams, spam, or links to outside platforms. " +
              "FLAGGED = borderline/ambiguous content that a human should review. " +
              "APPROVED = everything else (normal study talk, encouragement, questions). " +
              "Reply with ONLY the verdict word followed by a short reason after a colon, e.g. \"REJECTED: hate speech\".",
          },
          { role: "user", content: text },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
    const verdict = raw.split(":")[0]?.trim().toUpperCase();
    const reason = raw.split(":")[1]?.trim() || "Flagged by AI moderator";
    if (verdict === "REJECTED") return { status: "rejected", reason, method: "ai" };
    if (verdict === "FLAGGED") return { status: "flagged", reason, method: "ai" };
    if (verdict === "APPROVED") return { status: "approved", reason: "Clean", method: "ai" };
    return null;
  } catch (err) {
    logger.warn({ err }, "AI moderation call failed");
    return null;
  }
}

/**
 * Moderate a piece of user-generated text.
 * Order: keyword first (fast + authoritative for obvious violations), then AI
 * for subtler cases. If neither fires, the content is approved.
 */
export async function moderateText(text: string): Promise<ModerationResult> {
  const keywordVerdict = keywordModerate(text);
  if (keywordVerdict) return keywordVerdict;

  const aiVerdict = await aiModerate(text);
  if (aiVerdict) return aiVerdict;

  // No AI key → no verdict from AI; keyword already passed, so approve.
  return { status: "approved", reason: "No violations detected", method: process.env.GROQ_API_KEY ? "ai-fallback" : "none" };
}
