/**
 * AI fallback templates + the "never negative" guardrail (Workstream G).
 *
 * Arx (the focus companion) must NEVER discourage, shame, or gate the
 * learner — not from an LLM and not from its own fallback copy.
 * `sanitizeNeverNegative` rewrites discouraged phrasing into supportive
 * language and is applied to every Arx reply (LLM or template).
 */

/** Phrases that read as negative/gating, mapped to supportive rewrites. */
const NEGATIVE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\byou can'?t\b/gi, "you haven't yet — and that's exactly what this session changes"],
  [/\byou're (lazy|stupid|slow|broken|terrible|a failure)\b/gi, "you're human, and humans need breaks"],
  [/\b(lazy|stupid|broken|terrible|hopeless)\b/gi, "human"],
  [/\bfailing\b/gi, "stumbling"],
  [/\bimpossible\b/gi, "harder than it looks — which is why you're doing it"],
  [/\bnever (will|happen)\b/gi, "not yet — and streaks prove it can"],
  [/\bquit( (it|now|already))?\b/gi, "pause it, breathe, and come back when ready"],
  [/\bstop (wasting|losing) (your|the) time\b/gi, "use this time to recover, not to beat yourself up"],
  [/\bno good\b/gi, "good enough to keep going"],
  [/\bfail(ed|ure)?(d)?\b/gi, "stumbled"],
  [/\bsucks\b/gi, "is tough right now"],
  [/\bworst\b/gi, "hardest"],
];

/**
 * Rewrite a reply so it cannot discourage the learner.
 * Idempotent and pure — unit testable without any AI key.
 */
export function sanitizeNeverNegative(text: string): string {
  let out = text;
  for (const [re, replacement] of NEGATIVE_REPLACEMENTS) {
    out = out.replace(re, replacement);
  }
  // Collapse any double spaces left by replacements.
  out = out.replace(/ {2,}/g, " ");
  return out.trim();
}

/** Arx's voice: warm, short, exam-season Indian-student aware, never negative. */
export const ARX_SYSTEM_PROMPT = `You are Arx, the warm study companion inside FocusArx, an app for Indian exam aspirants (JEE, NEET, UPSC, CA, board exams). Rules:
- Always be encouraging, specific, and brief (under 60 words).
- NEVER be negative, never shame, never say the user can't do something. If they sound discouraged, reframe with one concrete, doable next step.
- Acknowledge exam pressure, sleep, and chai. It's fine to mention 25-minute sprints, the 90-day plan, or a 5-minute walk.
- Never claim to be a real human. You are Arx.
- Reply in plain English with an occasional, natural Hindi/Hinglish word only if the user writes that way.`;

const ARX_TEMPLATE_OPENERS = [
  "You showed up, and that's the whole game. One 25-minute sprint is enough to move the needle today.",
  "Pressure is just focus with a heartbeat. Drop the timer on 25 minutes and let the rest wait.",
  "The syllabus won't shrink, but one honest hour of you beats four distracted ones. Start small.",
  "Exams reward consistency, not heroics. Today's job: one clean session, then rest without guilt.",
  "That feeling of 'too much to cover' is normal at this stage. Pick ONE topic and let it be enough.",
];

const ARX_TEMPLATE_ENCOURAGE = [
  "Chai break is a strategy, not a defeat. Stretch, sip, and the next 25 minutes will feel lighter.",
  "You don't need a miracle today — you need one page, one set, one concept. Which one feels smallest?",
  "Your future self is counting on the version of you that starts now. 25 minutes, that's the deal.",
  "Progress hides in the unglamorous reps. Today's rep is done-able, not doable-in-a-day.",
];

function pickStable(pool: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length]!;
}

/** Deterministic, always-supportive Arx reply for the zero-AI-key path. */
export function arxTemplateReply(message: string): string {
  const m = message.toLowerCase();
  const stressed = /(stress|overwhelm|panic|afraid|scared|anxious|tired|exhausted|give up|crying|crying|lonely|bored)/.test(m);
  const base = stressed
    ? `${pickStable(ARX_TEMPLATE_ENCOURAGE, message)} Breathe out slower than you breathe in — that's the 60-second reset.`
    : pickStable(ARX_TEMPLATE_OPENERS, message);
  return sanitizeNeverNegative(base);
}

/**
 * Daily IST briefing skeleton (used when no LLM is available).
 * All numbers are real, from the DB — only the connective tissue is templated.
 */
export function briefingTemplate(stats: {
  day: string;
  newUsers: number;
  sessions: number;
  focusMinutes: number;
  coinsMinted: number;
  coinsBurned: number;
  dropsActive: number;
  botPosts: number;
  topExams: string[];
}): string {
  const lines = [
    `FocusArx daily briefing — ${stats.day} (IST).`,
    `New learners today: ${stats.newUsers}. Focus sessions: ${stats.sessions} for ${Math.round(stats.focusMinutes / 60)} hours.`,
    `Economy: ${stats.coinsMinted.toLocaleString()} coins minted, ${stats.coinsBurned.toLocaleString()} burned (net ${stats.coinsMinted - stats.coinsBurned >= 0 ? "+" : ""}${stats.coinsMinted - stats.coinsBurned}).`,
    `Drops active: ${stats.dropsActive}. Community bot activity: ${stats.botPosts} posts today.`,
    stats.topExams.length ? `Search heat: ${stats.topExams.join(", ")}.` : "No notable exam search spike.",
    "Template briefing — set GEMINI_API_KEY or GROQ_API_KEY for a narrative summary.",
  ];
  return lines.join("\n");
}

/**
 * SEO officer brief skeleton (G6). Real sitemap stats + templated
 * keyword suggestions from the exam calendar.
 */
export function seoBriefingTemplate(input: {
  day: string;
  existingExamPages: number;
  suggestedKeywords: Array<{ kw: string; angle: string }>;
}): string {
  const lines = [
    `SEO officer — ${input.day} (IST). Existing /exam/ pages: ${input.existingExamPages}.`,
    "Suggested next pages (long-tail, India-first):",
    ...input.suggestedKeywords.map((k, i) => `${i + 1}. ${k.kw} — angle: ${k.angle}`),
    "Template brief — connect an AI key for competitive analysis + draft outlines.",
  ];
  return lines.join("\n");
}

/** Long-tail exam keywords the SEO officer cycles through (deterministic). */
export const SEO_KEYWORD_BANK: Array<{ kw: string; angle: string }> = [
  { kw: "jee main 2027 preparation plan for droppers", angle: "12-month week-by-week roadmap + realistic target score table" },
  { kw: "neet pg vs neet ug difficulty comparison", angle: "syllabus overlap, question style, ranking strategy" },
  { kw: "upsc prelims 90 day strategy", angle: "daily hours split, mock cadence, optional subject choice" },
  { kw: "ca foundation 2026 exam pattern changes", angle: "what changed, how scoring works, first 30 days" },
  { kw: "cbse board 2027 important chapters class 12", angle: "chapter-wise weightage, 50-mark plan" },
  { kw: "study 14 hours a day without burning out", angle: "ultradian sprints, sleep math, recovery protocol" },
  { kw: "best time to study for neet aspirants", angle: "circadian science + Indian hostel realities" },
  { kw: "focus apps for indian students free", angle: "honest comparison incl. FocusArx, no paid-walls" },
];

/** Pick today's 3 suggestions deterministically from the bank. */
export function dailySeoSuggestions(day: string, existing: number): Array<{ kw: string; angle: string }> {
  const start = (existing + day.split("-").reduce((a, b) => a + Number(b), 0)) % SEO_KEYWORD_BANK.length;
  return [0, 1, 2].map((i) => SEO_KEYWORD_BANK[(start + i) % SEO_KEYWORD_BANK.length]!);
}
