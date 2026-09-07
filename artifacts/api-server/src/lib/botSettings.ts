/**
 * Admin-tunable knobs for the AI-rival engine ("bot talking" controls).
 *
 * Stored as one JSON document in `platform_meta` under `bot_settings` so it
 * survives cold starts and is shared by every serverless instance. Reads are
 * cached in-process for 60 s (the daily tick and reply queueing call this on
 * hot paths); admin writes invalidate the local cache immediately — other
 * instances pick the change up within a minute.
 *
 * Every field has a safe default, so a missing/partial document (fresh DB,
 * older deploy) behaves exactly like the previous hard-coded engine.
 */

import { db, platformMetaTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { logger } from "./logger";

export const BOT_SETTINGS_KEY = "bot_settings";

const chance = z.number().min(0).max(1);
const count = (max: number) => z.number().int().min(0).max(max);

export const botSettingsSchema = z.object({
  /** Master switch — off = bots never post, comment, react, follow or banter. */
  enabled: z.boolean(),

  // ── Daily rhythm (global, per IST day) ──────────────────────────────────
  dailyPostsMin: count(200),
  dailyPostsMax: count(500),
  dailyThreadsMax: count(10),
  dailyCommentsMin: count(500),
  dailyCommentsMax: count(1000),
  reactionBurstsMin: count(500),
  reactionBurstsMax: count(1000),
  dailyFollowsMax: count(500),

  // ── Per-bot anti-spam caps (per IST day) ────────────────────────────────
  perBotPosts: count(10),
  perBotComments: count(50),
  perBotReactions: count(100),
  perBotFollows: count(50),

  // ── Talking to humans ───────────────────────────────────────────────────
  /** Probability a fresh human post gets bot replies at all. */
  replyChanceHuman: chance,
  /** Max replies queued under one human post (1st fast, rest slow). */
  repliesPerHumanPostMax: z.number().int().min(1).max(6),
  /** Probability a human comment gets one threaded bot reply. */
  commentReplyChance: chance,
  replyFastMinMinutes: z.number().min(0).max(240),
  replyFastMaxMinutes: z.number().min(0).max(240),
  replySlowMinHours: z.number().min(0).max(48),
  replySlowMaxHours: z.number().min(0).max(48),
  /** Probability a bot post gets a bot reply (keeps bot threads alive). */
  replyChanceBotPost: chance,

  // ── Admin posts always get love ─────────────────────────────────────────
  adminRepliesMin: count(10),
  adminRepliesMax: count(10),
  adminReactionsMin: count(30),
  adminReactionsMax: count(30),
  adminReplyDelayMaxMinutes: z.number().min(0).max(240),

  // ── Following humans ────────────────────────────────────────────────────
  /** Bots that follow a brand-new human right after sign-up (0 = off). */
  followsPerNewHuman: count(25),

  // ── Study rooms ─────────────────────────────────────────────────────────
  /** Bot banter in non-silent study rooms. */
  roomBanter: z.boolean(),
  /** Share of 12-minute slots in which a room gets a banter exchange. */
  roomBanterChance: chance,
});

export type BotSettings = z.infer<typeof botSettingsSchema>;

/** Matches the engine's historical hard-coded behaviour exactly. */
export const DEFAULT_BOT_SETTINGS: BotSettings = {
  enabled: true,
  dailyPostsMin: 6,
  dailyPostsMax: 24,
  dailyThreadsMax: 2,
  dailyCommentsMin: 5,
  dailyCommentsMax: 15,
  reactionBurstsMin: 15,
  reactionBurstsMax: 30,
  dailyFollowsMax: 30,
  perBotPosts: 1,
  perBotComments: 3,
  perBotReactions: 15,
  perBotFollows: 5,
  replyChanceHuman: 0.85,
  repliesPerHumanPostMax: 2,
  commentReplyChance: 0.35,
  replyFastMinMinutes: 5,
  replyFastMaxMinutes: 25,
  replySlowMinHours: 1,
  replySlowMaxHours: 8,
  replyChanceBotPost: 0.25,
  adminRepliesMin: 2,
  adminRepliesMax: 4,
  adminReactionsMin: 3,
  adminReactionsMax: 6,
  adminReplyDelayMaxMinutes: 30,
  followsPerNewHuman: 3,
  roomBanter: true,
  roomBanterChance: 0.4,
};

/** Partial update schema for PUT /admin/bots/settings. */
export const botSettingsPatchSchema = botSettingsSchema.partial().strict();

const CACHE_TTL_MS = 60 * 1000;
let cached: { value: BotSettings; at: number } | null = null;

/** Clamp min/max pairs so a typo in admin can never produce a negative range. */
function normalise(s: BotSettings): BotSettings {
  const pair = (min: number, max: number): [number, number] => (max < min ? [max, min] : [min, max]);
  const [dailyPostsMin, dailyPostsMax] = pair(s.dailyPostsMin, s.dailyPostsMax);
  const [dailyCommentsMin, dailyCommentsMax] = pair(s.dailyCommentsMin, s.dailyCommentsMax);
  const [reactionBurstsMin, reactionBurstsMax] = pair(s.reactionBurstsMin, s.reactionBurstsMax);
  const [replyFastMinMinutes, replyFastMaxMinutes] = pair(s.replyFastMinMinutes, s.replyFastMaxMinutes);
  const [replySlowMinHours, replySlowMaxHours] = pair(s.replySlowMinHours, s.replySlowMaxHours);
  const [adminRepliesMin, adminRepliesMax] = pair(s.adminRepliesMin, s.adminRepliesMax);
  const [adminReactionsMin, adminReactionsMax] = pair(s.adminReactionsMin, s.adminReactionsMax);
  return {
    ...s,
    dailyPostsMin, dailyPostsMax, dailyCommentsMin, dailyCommentsMax, reactionBurstsMin, reactionBurstsMax,
    replyFastMinMinutes, replyFastMaxMinutes, replySlowMinHours, replySlowMaxHours,
    adminRepliesMin, adminRepliesMax, adminReactionsMin, adminReactionsMax,
  };
}

/** Merge an arbitrary stored document over the defaults, dropping bad fields. */
export function mergeBotSettings(stored: unknown): BotSettings {
  if (!stored || typeof stored !== "object") return DEFAULT_BOT_SETTINGS;
  const merged: Record<string, unknown> = { ...DEFAULT_BOT_SETTINGS };
  const partial = botSettingsPatchSchema.safeParse(stored);
  if (partial.success) {
    Object.assign(merged, partial.data);
  } else {
    // Keep whatever fields are individually valid instead of discarding all.
    for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
      const field = (botSettingsSchema.shape as Record<string, z.ZodTypeAny>)[key];
      if (field && field.safeParse(value).success) merged[key] = value;
    }
  }
  return normalise(merged as BotSettings);
}

/** Current settings (cached ≤60 s). Never throws — falls back to defaults. */
export async function getBotSettings(): Promise<BotSettings> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;
  try {
    const [row] = await db.select({ value: platformMetaTable.value })
      .from(platformMetaTable)
      .where(eq(platformMetaTable.key, BOT_SETTINGS_KEY))
      .limit(1);
    const value = mergeBotSettings(row?.value);
    cached = { value, at: now };
    return value;
  } catch (err) {
    logger.warn({ err }, "bot settings load failed — using defaults");
    return cached?.value ?? DEFAULT_BOT_SETTINGS;
  }
}

/** Persist a partial update; returns the full effective settings. */
export async function saveBotSettings(patch: Partial<BotSettings>): Promise<BotSettings> {
  const current = await getBotSettings();
  const next = normalise(botSettingsSchema.parse({ ...current, ...patch }));
  await db.insert(platformMetaTable)
    .values({ key: BOT_SETTINGS_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformMetaTable.key, set: { value: next, updatedAt: new Date() } });
  cached = { value: next, at: Date.now() };
  return next;
}

/** Reset to defaults (admin "restore defaults"). */
export async function resetBotSettings(): Promise<BotSettings> {
  await db.delete(platformMetaTable).where(eq(platformMetaTable.key, BOT_SETTINGS_KEY));
  cached = { value: DEFAULT_BOT_SETTINGS, at: Date.now() };
  return DEFAULT_BOT_SETTINGS;
}

/** Test hook / after external writes. */
export function invalidateBotSettingsCache(): void {
  cached = null;
}
