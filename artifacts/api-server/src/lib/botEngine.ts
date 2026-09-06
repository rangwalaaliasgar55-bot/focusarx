/**
 * AI rival engine v2 — a living community at scale (Workstream A).
 *
 * 12,000+ clearly-labelled AI accounts (role = "bot", 🤖 AI badge on every
 * surface) that don't just post — they hold threads, reply to humans with a
 * natural 1–8h lag, like/react, follow each other and active humans, and
 * banter in study rooms (see socketManager room banter).
 *
 * Everything is lazy + idempotent + throttled (no cron, serverless-safe):
 *  - daily tick: the first leaderboard/feed load of the IST day claims it via
 *    an atomic platform_meta upsert, then runs batched deterministic work.
 *  - human post replies: queued with a future dueAt, materialised by any
 *    later load (they "trickle in" naturally).
 *  - follow graph: built once (versioned flag in platform_meta).
 *
 * Honesty guardrail: bots are always role="bot" and every UI surface badges
 * them. Nothing in this file may pretend a bot is human.
 */

import { db, pool } from "@workspace/db";
import {
  usersTable,
  userWalletsTable,
  studyStreaksTable,
  socialPostsTable,
  postCommentsTable,
  postReactionsTable,
  followsTable,
  focusSessionsTable,
  botPendingRepliesTable,
  platformMetaTable,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { logger } from "./logger";
import { moderateText } from "./moderation";
import { hashString, mulberry32, generatePersona, levelForXp } from "./personas";
import {
  POST_TEMPLATES,
  THREAD_SCRIPTS,
  COMMENT_REPLIES,
  topicForContent,
} from "./botTemplates";

export const BOT_ROLE = "bot";
export const BOT_DOMAIN = "bot.focusarx";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // India = UTC+5:30

// ── legacy 36 personas (admin back-compat; renamed to Indian names on seed) ──

export interface BotPersona {
  slug: string;
  name: string;
  baseXp: number;
  streak: number;
  vibe: "grinder" | "chill" | "scholar" | "sprinter";
}

export const BOT_PERSONAS: BotPersona[] = [
  { slug: "nova", name: "Nova", baseXp: 4820, streak: 41, vibe: "grinder" },
  { slug: "atlas", name: "Atlas", baseXp: 4310, streak: 37, vibe: "scholar" },
  { slug: "juno", name: "Juno", baseXp: 3960, streak: 33, vibe: "chill" },
  { slug: "orion", name: "Orion", baseXp: 3720, streak: 29, vibe: "grinder" },
  { slug: "lyra", name: "Lyra", baseXp: 3480, streak: 27, vibe: "sprinter" },
  { slug: "kai", name: "Kai", baseXp: 3150, streak: 24, vibe: "chill" },
  { slug: "vera", name: "Vera", baseXp: 2940, streak: 22, vibe: "scholar" },
  { slug: "rune", name: "Rune", baseXp: 2710, streak: 21, vibe: "grinder" },
  { slug: "mira", name: "Mira", baseXp: 2530, streak: 19, vibe: "sprinter" },
  { slug: "zen", name: "Zen", baseXp: 2380, streak: 18, vibe: "chill" },
  { slug: "iris", name: "Iris", baseXp: 2210, streak: 16, vibe: "scholar" },
  { slug: "axel", name: "Axel", baseXp: 2050, streak: 15, vibe: "sprinter" },
  { slug: "sage", name: "Sage", baseXp: 1890, streak: 14, vibe: "scholar" },
  { slug: "pixel", name: "Pixel", baseXp: 1740, streak: 13, vibe: "grinder" },
  { slug: "echo", name: "Echo", baseXp: 1610, streak: 12, vibe: "chill" },
  { slug: "theo", name: "Theo", baseXp: 1480, streak: 11, vibe: "scholar" },
  { slug: "luna", name: "Luna", baseXp: 1360, streak: 10, vibe: "chill" },
  { slug: "cyrus", name: "Cyrus", baseXp: 1250, streak: 9, vibe: "grinder" },
  { slug: "ada", name: "Ada", baseXp: 1150, streak: 9, vibe: "scholar" },
  { slug: "finch", name: "Finch", baseXp: 1050, streak: 8, vibe: "sprinter" },
  { slug: "sable", name: "Sable", baseXp: 960, streak: 8, vibe: "grinder" },
  { slug: "rio", name: "Rio", baseXp: 880, streak: 7, vibe: "chill" },
  { slug: "nadia", name: "Nadia", baseXp: 800, streak: 7, vibe: "scholar" },
  { slug: "cobalt", name: "Cobalt", baseXp: 730, streak: 6, vibe: "sprinter" },
  { slug: "wren", name: "Wren", baseXp: 660, streak: 6, vibe: "chill" },
  { slug: "dash", name: "Dash", baseXp: 600, streak: 5, vibe: "sprinter" },
  { slug: "opal", name: "Opal", baseXp: 540, streak: 5, vibe: "scholar" },
  { slug: "bolt", name: "Bolt", baseXp: 490, streak: 4, vibe: "sprinter" },
  { slug: "ivy", name: "Ivy", baseXp: 440, streak: 4, vibe: "grinder" },
  { slug: "ghost", name: "Ghost", baseXp: 390, streak: 3, vibe: "chill" },
  { slug: "amber", name: "Amber", baseXp: 340, streak: 3, vibe: "scholar" },
  { slug: "quill", name: "Quill", baseXp: 300, streak: 2, vibe: "grinder" },
  { slug: "sol", name: "Sol", baseXp: 260, streak: 2, vibe: "sprinter" },
  { slug: "pixel2", name: "Vex", baseXp: 220, streak: 2, vibe: "chill" },
  { slug: "clay", name: "Clay", baseXp: 180, streak: 1, vibe: "grinder" },
  { slug: "mist", name: "Mist", baseXp: 140, streak: 1, vibe: "chill" },
];

const VIBE_GAIN: Record<BotPersona["vibe"], number> = { grinder: 1.0, scholar: 0.85, sprinter: 0.75, chill: 0.6 };
const REACTION_TYPES = ["fire", "insightful", "focused", "legendary", "love"] as const;

// Per-bot daily anti-spam caps (A2 spec).
const CAPS = { post: 1, comment: 3, reaction: 15, follow: 5 } as const;
// Global bot content caps so the feed stays majority-human at 12k scale.
const GLOBAL_POSTS_MIN = 6;
const GLOBAL_POSTS_MAX = 24;
const GLOBAL_COMMENTS_MIN = 5;
const GLOBAL_COMMENTS_MAX = 15;
const GLOBAL_FOLLOWS_MAX = 30;

// ── time helpers ─────────────────────────────────────────────────────────────

/** Today's date key in IST (the community lives on IST). */
export function istDayKey(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Realistic IST hours window for today's content: 06:00 IST → now (never in
 * the future). Early-morning loads (00:00–06:00 IST) fall back to the
 * previous evening so late-night posts still have a valid window.
 */
function contentWindow(now = new Date()): { start: number; end: number } {
  const istNow = now.getTime() + IST_OFFSET_MS;
  const istTodayMidnight = new Date(istNow);
  istTodayMidnight.setUTCHours(0, 0, 0, 0);
  const sixAmUtc = istTodayMidnight.getTime() + 6 * 3600 * 1000 - IST_OFFSET_MS;
  const start = Math.min(Math.max(sixAmUtc, now.getTime() - 19 * 3600 * 1000), now.getTime() - 2 * 60 * 1000 - 60 * 1000);
  const end = now.getTime() - 2 * 60 * 1000;
  return { start, end: Math.max(end, start + 60 * 1000) };
}

// ── daily-tick claim (serverless-safe, exactly once per IST day) ─────────────

/**
 * Atomic once-per-day claim. First instance of the day flips the stored day
 * key and wins; concurrent instances of the SAME day get no row back.
 */
async function claimDailyTick(day: string): Promise<boolean> {
  const res = await pool.query(
    `WITH upsert AS (
       INSERT INTO platform_meta (key, value) VALUES ('bot_tick_day', $1::jsonb)
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = now()
       WHERE platform_meta.value ->> 'day' IS DISTINCT FROM $2
       RETURNING 1
     )
     SELECT count(*) > 0 AS inserted FROM upsert`,
    [JSON.stringify({ day }), day],
  );
  return Boolean(res.rows[0]?.inserted);
}

let lastTickDay = "";
let lastTickAt = 0;

// ── seeding ──────────────────────────────────────────────────────────────────

const LEGACY_RENAME_NS = 100000; // persona namespace for legacy renames

/** Idempotent one-time rename of the original 36 latin-named rivals. */
async function renameLegacyBots(): Promise<void> {
  const reserved = new Set<string>();
  for (let j = 0; j < BOT_PERSONAS.length; j++) {
    const legacy = BOT_PERSONAS[j]!;
    const p = generatePersona(LEGACY_RENAME_NS + j, reserved);
    await db
      .update(usersTable)
      .set({ name: p.name, bio: p.bio, timezone: p.timezone, onboardingData: { botVibe: legacy.vibe } })
      .where(and(eq(usersTable.email, `${legacy.slug}@${BOT_DOMAIN}`), ne(usersTable.name, p.name)));
  }
}

async function ensureLegacyBots(): Promise<number> {
  let created = 0;
  for (const persona of BOT_PERSONAS) {
    const email = `${persona.slug}@${BOT_DOMAIN}`;
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
    if (existing) continue;
    const [user] = await db
      .insert(usersTable)
      .values({
        email,
        name: persona.name,
        role: BOT_ROLE,
        isGuest: false,
        onboardingCompleted: true,
        bio: `AI rival · ${persona.vibe} mode. I train every day — catch me on the leaderboard.`,
        onboardingData: { botVibe: persona.vibe },
      })
      .returning({ id: usersTable.id });
    if (!user) continue;
    created += 1;
    await db.insert(userWalletsTable)
      .values({
        userId: user.id,
        coins: 200 + Math.floor(persona.baseXp / 10),
        totalXp: persona.baseXp,
        weeklyXp: Math.floor(persona.baseXp * 0.08),
        level: levelForXp(persona.baseXp),
      })
      .onConflictDoNothing();
    await db.insert(studyStreaksTable)
      .values({
        userId: user.id,
        currentStreak: persona.streak,
        longestStreak: persona.streak + 3,
        lastStudyDate: istDayKey(),
      })
      .onConflictDoNothing();
  }
  return created;
}

/**
 * Seed the community up to `target` bots (A1). Batched (500/txn), idempotent
 * (ON CONFLICT DO NOTHING on unique email), resumable after interruption
 * (wallets/streaks self-heal by email lookup). 12k seeds in seconds — called
 * from the admin action, never from a user request path.
 */
export async function seedBotsToTarget(target: number): Promise<{ created: number; total: number }> {
  const want = Math.max(36, Math.min(20000, Math.floor(target) || 12000));

  const legacyCreated = await ensureLegacyBots();
  await renameLegacyBots();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable)
    .where(eq(usersTable.role, BOT_ROLE));
  const existing = Number(count ?? 0);
  if (existing >= want) return { created: legacyCreated, total: existing };

  // `created` includes the legacy rivals this call inserted above, so the
  // number reflects every user the call actually created.
  let created = legacyCreated;
  const reserved = new Set<string>();
  for (let i = existing; i < want; i += 500) {
    const chunk: ReturnType<typeof generatePersona>[] = [];
    for (let k = i; k < Math.min(i + 500, want); k++) chunk.push(generatePersona(k, reserved, want));

    await db.transaction(async (txDb) => {
      await txDb
        .insert(usersTable)
        .values(
          chunk.map((p) => ({
            email: p.email,
            name: p.name,
            role: BOT_ROLE,
            isGuest: false,
            onboardingCompleted: true,
            bio: p.bio,
            timezone: p.timezone,
            createdAt: new Date(Date.now() - p.createdAtDaysAgo * 86400000),
            onboardingData: { botVibe: p.vibe },
          })),
        )
        .onConflictDoNothing();

      // Self-heal: whatever of this chunk now exists (fresh or pre-existing),
      // make sure it has a wallet + streak row.
      const emails = chunk.map((p) => p.email);
      const rows = await txDb
        .select({ id: usersTable.id, email: usersTable.email })
        .from(usersTable)
        .where(inArray(usersTable.email, emails));
      const byEmail = new Map(rows.map((r) => [r.email, r.id] as const));

      const walletRows = chunk
        .filter((p) => byEmail.has(p.email))
        .map((p) => ({
          userId: byEmail.get(p.email)!,
          coins: 50 + Math.floor(p.totalXp / 12),
          totalXp: p.totalXp,
          weeklyXp: p.weeklyXp,
          level: levelForXp(p.totalXp),
        }));
      if (walletRows.length) await txDb.insert(userWalletsTable).values(walletRows).onConflictDoNothing();

      const streakRows = chunk
        .filter((p) => byEmail.has(p.email))
        .map((p) => ({
          userId: byEmail.get(p.email)!,
          currentStreak: p.streak,
          longestStreak: p.streak + 3,
          lastStudyDate: p.streak > 0 ? istDayKey() : null,
        }));
      if (streakRows.length) await txDb.insert(studyStreaksTable).values(streakRows).onConflictDoNothing();
    });

    created += chunk.length;
  }

  // Give the fresh crew a first day of content + bootstrap the follow graph.
  lastTickDay = "";
  await ensureDailyBotActivity(true);
  await buildBotFollowGraph();

  const [after] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable)
    .where(eq(usersTable.role, BOT_ROLE));
  return { created, total: Number(after?.count ?? 0) };
}

/** Back-compat wrapper used by the original admin route. */
export async function seedBots(): Promise<{ created: number; total: number }> {
  return seedBotsToTarget(36);
}

export async function deleteAllBots(): Promise<number> {
  const deleted = await db.delete(usersTable).where(eq(usersTable.role, BOT_ROLE)).returning({ id: usersTable.id });
  return deleted.length;
}

// ── bot list (explicit projections — no bare selects, ever) ─────────────────

export interface BotRow {
  id: string;
  name: string | null;
  email: string;
  vibe: BotPersona["vibe"];
}

async function loadBots(): Promise<BotRow[]> {
  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      onboardingData: usersTable.onboardingData,
    })
    .from(usersTable)
    .where(eq(usersTable.role, BOT_ROLE));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    vibe: (r.onboardingData as { botVibe?: BotPersona["vibe"] } | null)?.botVibe ?? "chill",
  }));
}

function slugOf(email: string): string {
  return email.split("@")[0] ?? "bot";
}

export interface BotUsage {
  posts: Map<string, number>;
  comments: Map<string, number>;
  reactions: Map<string, number>;
  follows: Map<string, number>;
}

/** Per-bot usage today — one grouped query per surface, never per bot. */
async function botUsageToday(botIds: string[]): Promise<BotUsage> {
  const empty: BotUsage = { posts: new Map(), comments: new Map(), reactions: new Map(), follows: new Map() };
  if (!botIds.length) return empty;
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const idSet = new Set(botIds);

  const [postRows, commentRows, reactionRows, followRows] = await Promise.all([
    db.select({ userId: socialPostsTable.userId, n: sql<number>`count(*)` })
      .from(socialPostsTable)
      .where(gte(socialPostsTable.createdAt, dayStart))
      .groupBy(socialPostsTable.userId),
    db.select({ userId: postCommentsTable.userId, n: sql<number>`count(*)` })
      .from(postCommentsTable)
      .where(gte(postCommentsTable.createdAt, dayStart))
      .groupBy(postCommentsTable.userId),
    db.select({ userId: postReactionsTable.userId, n: sql<number>`count(*)` })
      .from(postReactionsTable)
      .where(gte(postReactionsTable.createdAt, dayStart))
      .groupBy(postReactionsTable.userId),
    db.select({ userId: followsTable.followerId, n: sql<number>`count(*)` })
      .from(followsTable)
      .where(gte(followsTable.createdAt, dayStart))
      .groupBy(followsTable.followerId),
  ]);
  const toMap = (rows: Array<{ userId: string; n: number | null }>) => {
    const m = new Map<string, number>();
    for (const r of rows) if (idSet.has(r.userId)) m.set(r.userId, Number(r.n ?? 0));
    return m;
  };
  return {
    posts: toMap(postRows),
    comments: toMap(commentRows),
    reactions: toMap(reactionRows),
    follows: toMap(followRows),
  };
}

// ── batched XP/streak tick (500 rows per statement) ──────────────────────────

interface TickPlan {
  studyIds: string[];
  gains: number[]; // aligned with studyIds
  restIds: string[];
}

function planDay(bots: BotRow[], day: string): TickPlan {
  const plan: TickPlan = { studyIds: [], gains: [], restIds: [] };
  for (const bot of bots) {
    const rng = mulberry32(hashString(`tick:${slugOf(bot.email)}:${day}`));
    if (rng() < 0.1) {
      plan.restIds.push(bot.id);
      continue;
    }
    const gain = Math.round((120 + rng() * 260) * VIBE_GAIN[bot.vibe] * (rng() < 0.12 ? 0.4 : 1));
    plan.studyIds.push(bot.id);
    plan.gains.push(gain);
  }
  return plan;
}

/**
 * Wallet + level update in 500-row batches. Level is recomputed in SQL with
 * the canonical sqrt formula so it can never drift from the frontend, and
 * weekly XP resets server-side after 7 days.
 */
async function batchWalletTick(plan: TickPlan): Promise<void> {
  for (let i = 0; i < plan.studyIds.length; i += 500) {
    const ids = plan.studyIds.slice(i, i + 500);
    const gains = plan.gains.slice(i, i + 500);
    // Interleaved params: $1=id, $2=gain, $3=id, $4=gain, …
    const params: unknown[] = [];
    const valueTuples = ids.map((_, k) => {
      params.push(ids[k], gains[k]);
      return `($${k * 2 + 1}::text, $${k * 2 + 2}::int)`;
    });
    await pool.query(
      `UPDATE user_wallets w
       SET total_xp = w.total_xp + g.gain,
           weekly_xp = CASE WHEN w.weekly_xp_reset_at < now() - interval '7 days'
                            THEN 0 ELSE w.weekly_xp END + g.gain,
           weekly_xp_reset_at = CASE WHEN w.weekly_xp_reset_at < now() - interval '7 days'
                                     THEN now() ELSE w.weekly_xp_reset_at END,
           level = GREATEST(1, floor(sqrt((w.total_xp + g.gain) / 100.0)) + 1),
           coins = w.coins + g.gain / 6,
           updated_at = now()
       FROM (VALUES ${valueTuples.join(", ")}) AS g(id, gain)
       WHERE w.user_id = g.id AND g.gain > 0`,
      params,
    );
  }
}

async function batchStreakTick(plan: TickPlan, day: string): Promise<void> {
  for (let i = 0; i < plan.studyIds.length; i += 500) {
    const ids = plan.studyIds.slice(i, i + 500);
    const values = ids.map((id, k) => `($${k + 1}::text)`).join(", ");
    const params = ids;
    // Insert missing streak rows (fresh bots), then advance existing ones.
    await pool.query(
      `INSERT INTO study_streaks (id, user_id, current_streak, longest_streak, last_study_date, updated_at)
       SELECT gen_random_uuid(), g.id, 1, 1, $${ids.length + 1}, now()
       FROM (VALUES ${values}) AS g(id)
       WHERE NOT EXISTS (SELECT 1 FROM study_streaks s WHERE s.user_id = g.id)`,
      [...params, day],
    );
    await pool.query(
      `UPDATE study_streaks s
       SET current_streak = s.current_streak + 1,
           longest_streak = GREATEST(s.longest_streak, s.current_streak + 1),
           last_study_date = $${ids.length + 1},
           updated_at = now()
       FROM (VALUES ${values}) AS g(id)
       WHERE s.user_id = g.id AND s.last_study_date IS DISTINCT FROM $${ids.length + 1}`,
      [...params, day],
    );
  }
  // Resting bots: streak resets to 0 (visible movement on the board).
  for (let i = 0; i < plan.restIds.length; i += 500) {
    const ids = plan.restIds.slice(i, i + 500);
    const values = ids.map((id, k) => `($${k + 1}::text)`).join(", ");
    await pool.query(
      `UPDATE study_streaks s
       SET current_streak = 0, updated_at = now()
       FROM (VALUES ${values}) AS g(id)
       WHERE s.user_id = g.id AND s.current_streak > 2`,
      ids,
    );
  }
}

// ── content generation (posts, threads, comments, reactions, follows) ────────

function firstName(name: string | null): string {
  return (name ?? "Rival").split(" ")[0] ?? "Rival";
}

/**
 * Template lines repeat across bots/days, so moderation verdicts are cached
 * per unique string — every unique piece of bot content passes moderateText
 * exactly once (spec), without burning the free Groq tier on repeats.
 */
const moderationCache = new Map<string, boolean>();
async function safeContent(content: string): Promise<boolean> {
  const cached = moderationCache.get(content);
  if (cached !== undefined) return cached;
  let ok: boolean;
  try {
    const result = await moderateText(content);
    ok = result.status !== "rejected" && result.status !== "flagged";
  } catch {
    ok = true; // moderation is best-effort; all templates are pre-screened
  }
  if (moderationCache.size > 2000) moderationCache.clear();
  moderationCache.set(content, ok);
  return ok;
}

interface ContentCtx {
  bots: BotRow[];
  day: string;
  usage: BotUsage;
  window: { start: number; end: number };
}

async function runDailyPosts(ctx: ContentCtx): Promise<void> {
  const dayRng = mulberry32(hashString(`day:${ctx.day}`));
  const pickTime = () => new Date(ctx.window.start + dayRng() * (ctx.window.end - ctx.window.start));

  const [{ count: humanPosts24h }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(socialPostsTable)
    .innerJoin(usersTable, eq(usersTable.id, socialPostsTable.userId))
    .where(and(ne(usersTable.role, BOT_ROLE), gte(socialPostsTable.createdAt, new Date(Date.now() - 24 * 3600 * 1000))));

  // Global cap scales with human activity: the feed stays majority-human.
  const globalCap = Math.max(GLOBAL_POSTS_MIN, Math.min(GLOBAL_POSTS_MAX, 6 + Math.floor(Number(humanPosts24h ?? 0) / 2)));
  const alreadyPosted = [...ctx.usage.posts.values()].reduce((a, b) => a + b, 0);
  const want = Math.max(0, Math.min(3 + Math.floor(dayRng() * 6), globalCap - alreadyPosted)); // 3–8

  const candidates = ctx.bots.filter((b) => (ctx.usage.posts.get(b.id) ?? 0) < CAPS.post);
  const used = new Set<string>();
  for (let p = 0; p < want && candidates.length; p++) {
    const bot = candidates[Math.floor(dayRng() * candidates.length)]!;
    if (used.has(bot.id)) continue;
    const rng = mulberry32(hashString(`post:${slugOf(bot.email)}:${ctx.day}`));
    const topics = Object.keys(POST_TEMPLATES);
    const topic = topics[Math.floor(rng() * topics.length)]!;
    const family = POST_TEMPLATES[topic]!;
    const content = family[Math.floor(rng() * family.length)]!(firstName(bot.name), rng);
    if (!(await safeContent(content))) continue;
    await db.insert(socialPostsTable).values({
      userId: bot.id,
      content,
      type: "status",
      isPublic: true,
      moderationStatus: "approved",
      createdAt: pickTime(),
    });
    ctx.usage.posts.set(bot.id, (ctx.usage.posts.get(bot.id) ?? 0) + 1);
    used.add(bot.id);
  }
}

async function runDailyThreads(ctx: ContentCtx): Promise<void> {
  const dayRng = mulberry32(hashString(`threads:${ctx.day}`));
  const threadCount = 1 + Math.floor(dayRng() * 2); // 1–2 per day

  for (let t = 0; t < threadCount; t++) {
    const tRng = mulberry32(hashString(`thread:${ctx.day}:${t}`));
    const script = THREAD_SCRIPTS[Math.floor(tRng() * THREAD_SCRIPTS.length)]!;
    const lineCount = Math.min(script.lines.length, 4 + Math.floor(tRng() * 2)); // thread cap 8

    // Pick distinct speakers (deterministic shuffle).
    const speakers: BotRow[] = [];
    const poolBots = [...ctx.bots];
    for (let k = 0; k < lineCount && poolBots.length; k++) {
      const idx = Math.floor(mulberry32(hashString(`spk:${ctx.day}:${t}:${k}`))() * poolBots.length);
      const b = poolBots.splice(idx, 1)[0]!;
      if ((ctx.usage.posts.get(b.id) ?? 0) < CAPS.post) speakers.push(b);
    }
    if (speakers.length < 2) continue;

    const base = ctx.window.start + tRng() * (ctx.window.end - ctx.window.start) * 0.6;
    let postId: string | null = null;
    let lastCommentId: string | null = null;

    for (let li = 0; li < speakers.length; li++) {
      const speaker = speakers[li]!;
      const content = script.lines[li]!;
      if (!(await safeContent(content))) break;
      const at = new Date(Math.min(base + li * (25 + tRng() * 65) * 60 * 1000, ctx.window.end));
      if (li === 0) {
        const [post] = await db.insert(socialPostsTable)
          .values({
            userId: speaker.id,
            content,
            type: "discussion",
            isPublic: true,
            moderationStatus: "approved",
            createdAt: at,
            metadata: { thread: script.topic },
          })
          .returning({ id: socialPostsTable.id });
        if (!post) break;
        postId = post.id;
        ctx.usage.posts.set(speaker.id, (ctx.usage.posts.get(speaker.id) ?? 0) + 1);
      } else {
        if (!postId) break;
        if ((ctx.usage.comments.get(speaker.id) ?? 0) >= CAPS.comment) break;
        // Local consts: loop-carried lets in .values() confuse drizzle's
        // generic inference (circular type), so snapshot them first.
        const pid: string = postId;
        const parent: string | null = lastCommentId;
        const insertedComment: Array<{ id: string }> = await db.insert(postCommentsTable)
          .values({ postId: pid, userId: speaker.id, parentId: parent, content, createdAt: at })
          .returning({ id: postCommentsTable.id });
        const commentRow = insertedComment[0];
        if (!commentRow) break;
        lastCommentId = commentRow.id;
        ctx.usage.comments.set(speaker.id, (ctx.usage.comments.get(speaker.id) ?? 0) + 1);
      }
    }
  }
}

async function runDailyComments(ctx: ContentCtx): Promise<void> {
  const dayRng = mulberry32(hashString(`comments:${ctx.day}`));
  const want = Math.max(GLOBAL_COMMENTS_MIN, Math.min(GLOBAL_COMMENTS_MAX, GLOBAL_COMMENTS_MIN + Math.floor(dayRng() * (GLOBAL_COMMENTS_MAX - GLOBAL_COMMENTS_MIN))));

  const recentPosts = await db
    .select({
      id: socialPostsTable.id,
      userId: socialPostsTable.userId,
      content: socialPostsTable.content,
      createdAt: socialPostsTable.createdAt,
    })
    .from(socialPostsTable)
    .where(and(
      eq(socialPostsTable.isPublic, true),
      eq(socialPostsTable.moderationStatus, "approved"),
      gte(socialPostsTable.createdAt, new Date(Date.now() - 24 * 3600 * 1000)),
    ))
    .orderBy(desc(socialPostsTable.createdAt))
    .limit(400);

  const shuffled = [...recentPosts].sort(() => dayRng() - 0.5);
  let added = 0;
  for (const post of shuffled) {
    if (added >= want) break;
    const postRng = mulberry32(hashString(`cmt:${post.id}:${ctx.day}`));
    const topic = topicForContent(post.content);
    const family = COMMENT_REPLIES[topic] ?? COMMENT_REPLIES.general!;
    const content = family[Math.floor(postRng() * family.length)]!;
    if (!(await safeContent(content))) continue;
    const commenter = ctx.bots[Math.floor(postRng() * ctx.bots.length)]!;
    if (commenter.id === post.userId) continue;
    if ((ctx.usage.comments.get(commenter.id) ?? 0) >= CAPS.comment) continue;
    // Comment lands after the post, never in the future.
    const at = new Date(Math.min(post.createdAt.getTime() + (10 + postRng() * 200) * 60 * 1000, ctx.window.end));
    if (at.getTime() < post.createdAt.getTime()) continue;
    await db.insert(postCommentsTable).values({
      postId: post.id,
      userId: commenter.id,
      content,
      createdAt: at,
    });
    ctx.usage.comments.set(commenter.id, (ctx.usage.comments.get(commenter.id) ?? 0) + 1);
    added++;
  }
}

async function runDailyReactions(ctx: ContentCtx): Promise<void> {
  const dayRng = mulberry32(hashString(`reactions:${ctx.day}`));
  const bursts = 15 + Math.floor(dayRng() * 16); // 15–30 reaction events

  // Find admin for prioritized reactions.
  const [adminRow] = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"))
    .limit(1);
  const adminId = adminRow?.id;

  const recentPosts = await db
    .select({ id: socialPostsTable.id, userId: socialPostsTable.userId })
    .from(socialPostsTable)
    .where(and(
      eq(socialPostsTable.isPublic, true),
      eq(socialPostsTable.moderationStatus, "approved"),
      gte(socialPostsTable.createdAt, new Date(Date.now() - 48 * 3600 * 1000)),
    ))
    .orderBy(desc(socialPostsTable.createdAt))
    .limit(120);
  if (!recentPosts.length) return;

  // Admin posts get extra reactions (3–6 bots each) for liveliness.
  const adminPosts = adminId ? recentPosts.filter(p => p.userId === adminId) : [];
  for (const post of adminPosts) {
    const botsForPost = 3 + Math.floor(dayRng() * 4);
    for (let k = 0; k < botsForPost; k++) {
      const bot = ctx.bots[Math.floor(dayRng() * ctx.bots.length)]!;
      if (bot.id === post.userId) continue;
      if ((ctx.usage.reactions.get(bot.id) ?? 0) >= CAPS.reaction) continue;
      const type = REACTION_TYPES[Math.floor(dayRng() * REACTION_TYPES.length)]!;
      try {
        await db.insert(postReactionsTable).values({ postId: post.id, userId: bot.id, reaction: type });
        ctx.usage.reactions.set(bot.id, (ctx.usage.reactions.get(bot.id) ?? 0) + 1);
      } catch { /* skip */ }
    }
  }

  for (let r = 0; r < bursts; r++) {
    const post = recentPosts[Math.floor(dayRng() * recentPosts.length)]!;
    const botsForPost = 1 + Math.floor(dayRng() * 4);
    for (let k = 0; k < botsForPost; k++) {
      const bot = ctx.bots[Math.floor(dayRng() * ctx.bots.length)]!;
      if (bot.id === post.userId) continue;
      if ((ctx.usage.reactions.get(bot.id) ?? 0) >= CAPS.reaction) continue;
      const type = REACTION_TYPES[Math.floor(dayRng() * REACTION_TYPES.length)]!;
      try {
        await db.insert(postReactionsTable).values({ postId: post.id, userId: bot.id, reaction: type });
        ctx.usage.reactions.set(bot.id, (ctx.usage.reactions.get(bot.id) ?? 0) + 1);
      } catch {
        // duplicate reaction races are harmless
      }
    }
  }
}

async function runDailyFollows(ctx: ContentCtx): Promise<void> {
  const dayRng = mulberry32(hashString(`follows:${ctx.day}`));
  const alreadyToday = [...ctx.usage.follows.values()].reduce((a, b) => a + b, 0);
  const want = Math.max(0, Math.min(GLOBAL_FOLLOWS_MAX, GLOBAL_FOLLOWS_MAX - alreadyToday));
  if (!want) return;

  // Find the admin user (role='admin') — bots should always follow the admin.
  const [adminRow] = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"))
    .limit(1);
  const adminId = adminRow?.id;

  // Targets: active humans (studied in last 72h) + high-XP bots.
  const [activeHumans, topBots] = await Promise.all([
    db.select({ id: usersTable.id })
      .from(usersTable)
      .innerJoin(focusSessionsTable, eq(focusSessionsTable.userId, usersTable.id))
      .where(and(
        eq(usersTable.isGuest, false),
        ne(usersTable.role, BOT_ROLE),
        gte(focusSessionsTable.completedAt, new Date(Date.now() - 3 * 86400000)),
      ))
      .orderBy(desc(focusSessionsTable.completedAt))
      .limit(60),
    db.select({ userId: userWalletsTable.userId })
      .from(userWalletsTable)
      .innerJoin(usersTable, eq(usersTable.id, userWalletsTable.userId))
      .where(eq(usersTable.role, BOT_ROLE))
      .orderBy(sql`total_xp DESC`)
      .limit(300),
  ]);

  const targetIds: string[] = [];
  // Admin always first in the follow target list.
  if (adminId) targetIds.push(adminId);
  for (const h of activeHumans) if (!targetIds.includes(h.id)) targetIds.push(h.id);
  for (const b of topBots) if (!targetIds.includes(b.userId)) targetIds.push(b.userId);
  if (!targetIds.length) return;

  let added = 0;
  const usedTargets = new Set<string>();
  let guard = 0;
  while (added < want && usedTargets.size < targetIds.length && guard < want * 6) {
    guard++;
    const bot = ctx.bots[Math.floor(dayRng() * ctx.bots.length)]!;
    if ((ctx.usage.follows.get(bot.id) ?? 0) >= CAPS.follow) continue;
    const targetId = targetIds[Math.floor(dayRng() * targetIds.length)]!;
    if (targetId === bot.id || usedTargets.has(targetId)) continue;
    try {
      await db.insert(followsTable).values({ followerId: bot.id, followingId: targetId });
      ctx.usage.follows.set(bot.id, (ctx.usage.follows.get(bot.id) ?? 0) + 1);
      usedTargets.add(targetId);
      added++;
    } catch {
      /* skip */
    }
  }
}

// ── public daily tick ────────────────────────────────────────────────────────

/**
 * Runs at most once per IST day (atomic DB claim) with a 10-minute
 * in-memory throttle. Never throws — bot upkeep must not break a user route.
 */
export async function ensureDailyBotActivity(force = false): Promise<void> {
  const day = istDayKey();
  const now = Date.now();
  if (!force) {
    if (day === lastTickDay) return;
    if (now - lastTickAt < 10 * 60 * 1000) return;
  }
  lastTickAt = now;
  if (!force && !(await claimDailyTick(day))) return; // another instance already ran today
  lastTickDay = day;

  try {
    const bots = await loadBots();
    if (bots.length === 0) return;

    await materializeDueBotReplies();

    const usage = await botUsageToday(bots.map((b) => b.id));
    const plan = planDay(bots, day);
    await batchWalletTick(plan);
    await batchStreakTick(plan, day);

    const ctx: ContentCtx = { bots, day, usage, window: contentWindow() };
    await runDailyPosts(ctx);
    await runDailyThreads(ctx);
    await runDailyComments(ctx);
    await runDailyReactions(ctx);
    await runDailyFollows(ctx);
  } catch (err) {
    logger.warn({ err }, "bot daily activity failed (non-fatal)");
  }
}

// ── staggered replies to fresh posts ─────────────────────────────────────────

/**
 * When a HUMAN posts, queue 0–2 topic-matched bot replies that land 5min–8h
 * later (one fast for liveness, one slow). Bot posts get replies ~25% of the
 * time. Deterministic per post id; replies pass moderation on enqueue.
 */
export async function queueBotReplies(postId: string, authorId: string, content: string, authorIsBot = false): Promise<void> {
  try {
    const rng = mulberry32(hashString(`replyq:${postId}`));
    if (authorIsBot && rng() > 0.25) return; // bot posts: 25% get a bot reply
    if (!authorIsBot && rng() < 0.35) return; // human posts: 65% get replies

    const bots = await loadBots();
    if (bots.length < 2) return;
    const topic = topicForContent(content);
    const family = COMMENT_REPLIES[topic] ?? COMMENT_REPLIES.general!;

    const count = 1 + (rng() < 0.45 ? 1 : 0); // 1–2
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const bot = bots[Math.floor(rng() * bots.length)]!;
      if (bot.id === authorId) continue;
      const line = family[Math.floor(rng() * family.length)]!;
      if (!(await safeContent(line))) continue;
      // One reply fast (5–25 min), the other slow (1–8h) — natural trickle.
      const delayMs = i === 0 ? (5 + rng() * 20) * 60 * 1000 : (1 + rng() * 7) * 3600 * 1000;
      await db.insert(botPendingRepliesTable).values({
        postId,
        botId: bot.id,
        content: line,
        dueAt: new Date(now + delayMs),
      });
    }
  } catch (err) {
    logger.warn({ err }, "queue bot replies failed (non-fatal)");
  }
}

/** Back-compat alias (posts.ts imports this name). */
export async function maybeBotReply(postId: string, authorId: string): Promise<void> {
  try {
    const [post] = await db
      .select({ content: socialPostsTable.content, userId: socialPostsTable.userId })
      .from(socialPostsTable)
      .where(eq(socialPostsTable.id, postId))
      .limit(1);
    const [author] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, post?.userId ?? "")).limit(1);
    await queueBotReplies(postId, authorId, post?.content ?? "", (author?.role ?? "").toLowerCase() === BOT_ROLE);
  } catch {
    await queueBotReplies(postId, authorId, "");
  }
}

/**
 * Bots reply to HUMAN comments too (thread continuation) — ~35% of human
 * comments get one supportive bot reply, threaded under the comment.
 */
export async function queueBotCommentReply(commentId: string, postId: string, authorId: string): Promise<void> {
  try {
    const rng = mulberry32(hashString(`replyc:${commentId}`));
    if (rng() > 0.35) return;
    const bots = await loadBots();
    if (bots.length < 2) return;
    const bot = bots[Math.floor(rng() * bots.length)]!;
    if (bot.id === authorId) return;
    const line = COMMENT_REPLIES.general![Math.floor(rng() * COMMENT_REPLIES.general!.length)]!;
    if (!(await safeContent(line))) return;
    const delayMs = (1 + rng() * 7) * 3600 * 1000;
    await db.insert(botPendingRepliesTable).values({
      postId,
      botId: bot.id,
      parentId: commentId,
      content: line,
      dueAt: new Date(Date.now() + delayMs),
    });
  } catch (err) {
    logger.warn({ err }, "queue bot comment reply failed (non-fatal)");
  }
}

/**
 * Materialise queued replies whose due time has passed. Called from every
 * load path (feed, leaderboard, post creation) — idempotent via status.
 */
export async function materializeDueBotReplies(): Promise<void> {
  try {
    const due = await db
      .select()
      .from(botPendingRepliesTable)
      .where(and(eq(botPendingRepliesTable.status, "pending"), lte(botPendingRepliesTable.dueAt, new Date())))
      .orderBy(botPendingRepliesTable.dueAt)
      .limit(50);
    if (!due.length) return;

    for (const reply of due) {
      const usage = await botUsageToday([reply.botId]);
      if ((usage.comments.get(reply.botId) ?? 0) >= CAPS.comment) {
        await db.update(botPendingRepliesTable).set({ status: "skipped" }).where(eq(botPendingRepliesTable.id, reply.id));
        continue;
      }
      try {
        await db.insert(postCommentsTable).values({
          postId: reply.postId,
          userId: reply.botId,
          parentId: reply.parentId,
          content: reply.content,
        });
        await db.update(botPendingRepliesTable).set({ status: "sent", sentAt: new Date() }).where(eq(botPendingRepliesTable.id, reply.id));
      } catch {
        // post may have been deleted (cascade would have removed the row,
        // but a race can still happen) — mark skipped so we don't retry forever
        await db.update(botPendingRepliesTable).set({ status: "skipped" }).where(eq(botPendingRepliesTable.id, reply.id));
      }
    }
  } catch (err) {
    logger.warn({ err }, "materialize bot replies failed (non-fatal)");
  }
}

// ── follow graph bootstrap (one-shot, versioned) ─────────────────────────────

export async function buildBotFollowGraph(): Promise<{ followsCreated: number }> {
  const FLAG = "bot_follow_graph_v1";
  const [flag] = await db.select({ value: platformMetaTable.value }).from(platformMetaTable).where(eq(platformMetaTable.key, FLAG)).limit(1);
  if (flag) return { followsCreated: 0 };

  const bots = await loadBots();
  if (!bots.length) return { followsCreated: 0 };

  const [topBots, activeHumans] = await Promise.all([
    db.select({ userId: userWalletsTable.userId })
      .from(userWalletsTable)
      .innerJoin(usersTable, eq(usersTable.id, userWalletsTable.userId))
      .where(eq(usersTable.role, BOT_ROLE))
      .orderBy(sql`total_xp DESC`)
      .limit(500),
    db.select({ id: usersTable.id })
      .from(usersTable)
      .innerJoin(focusSessionsTable, eq(focusSessionsTable.userId, usersTable.id))
      .where(and(
        eq(usersTable.isGuest, false),
        ne(usersTable.role, BOT_ROLE),
        gte(focusSessionsTable.completedAt, new Date(Date.now() - 7 * 86400000)),
      ))
      .limit(200),
  ]);

  const humanIds = activeHumans.map((h) => h.id);
  const botIds = bots.map((b) => b.id);
  const topBotIds = topBots.map((b) => b.userId);

  // Generate the whole graph in JS (deterministic per bot), then insert in
  // bulk — 12k bots × ~22 follows would be ~264k round-trips if done one by
  // one, which takes minutes. Bulk VALUES keeps it under a second.
  const pairs = new Set<string>();
  for (const bot of bots) {
    const rng = mulberry32(hashString(`graph:${bot.id}`));
    const n = 5 + Math.floor(rng() * 36); // 5–40 follows per bot
    // Weight: ~50% high-XP bots, ~35% random bots, ~15% active humans.
    for (let k = 0; k < n; k++) {
      const roll = rng();
      let target: string | undefined;
      if (roll < 0.5 && topBotIds.length) target = topBotIds[Math.floor(rng() * topBotIds.length)];
      else if (roll < 0.85) target = botIds[Math.floor(rng() * botIds.length)];
      else if (humanIds.length) target = humanIds[Math.floor(rng() * humanIds.length)];
      if (!target || target === bot.id) continue;
      pairs.add(`${bot.id}\u0000${target}`);
    }
  }

  const all = [...pairs];
  let followsCreated = 0;
  for (let i = 0; i < all.length; i += 1000) {
    const chunk = all.slice(i, i + 1000);
    const params: unknown[] = [];
    for (const pair of chunk) {
      const [f, s] = pair.split("\u0000");
      params.push(f, s);
    }
    // `id` has no DB default (client-side $defaultFn in drizzle), so the raw
    // insert generates UUIDs server-side.
    const res = await pool.query(
      `INSERT INTO follows (id, follower_id, following_id)
       VALUES ${chunk.map((_, k) => `(gen_random_uuid(), $${k * 2 + 1}::text, $${k * 2 + 2}::text)`).join(", ")}`,
      params,
    );
    followsCreated += res.rowCount ?? 0;
  }

  await db.insert(platformMetaTable)
    .values({ key: FLAG, value: { follows: followsCreated, at: new Date().toISOString() } })
    .onConflictDoNothing();
  return { followsCreated };
}

// ── admin stats ──────────────────────────────────────────────────────────────

export interface BotActivityStats {
  total: number;
  today: { posts: number; comments: number; reactions: number; follows: number; pendingReplies: number };
}

export async function botActivityStats(): Promise<BotActivityStats> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [totalArr, postsArr, commentsArr, reactionsArr, followsArr, pendingArr] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.role, BOT_ROLE)),
    db.select({ n: sql<number>`count(*)` })
      .from(socialPostsTable)
      .innerJoin(usersTable, eq(usersTable.id, socialPostsTable.userId))
      .where(and(eq(usersTable.role, BOT_ROLE), gte(socialPostsTable.createdAt, dayStart))),
    db.select({ n: sql<number>`count(*)` })
      .from(postCommentsTable)
      .innerJoin(usersTable, eq(usersTable.id, postCommentsTable.userId))
      .where(and(eq(usersTable.role, BOT_ROLE), gte(postCommentsTable.createdAt, dayStart))),
    db.select({ n: sql<number>`count(*)` })
      .from(postReactionsTable)
      .innerJoin(usersTable, eq(usersTable.id, postReactionsTable.userId))
      .where(and(eq(usersTable.role, BOT_ROLE), gte(postReactionsTable.createdAt, dayStart))),
    db.select({ n: sql<number>`count(*)` })
      .from(followsTable)
      .innerJoin(usersTable, eq(usersTable.id, followsTable.followerId))
      .where(and(eq(usersTable.role, BOT_ROLE), gte(followsTable.createdAt, dayStart))),
    db.select({ n: sql<number>`count(*)` }).from(botPendingRepliesTable).where(eq(botPendingRepliesTable.status, "pending")),
  ]);
  return {
    total: Number(totalArr[0]?.n ?? 0),
    today: {
      posts: Number(postsArr[0]?.n ?? 0),
      comments: Number(commentsArr[0]?.n ?? 0),
      reactions: Number(reactionsArr[0]?.n ?? 0),
      follows: Number(followsArr[0]?.n ?? 0),
      pendingReplies: Number(pendingArr[0]?.n ?? 0),
    },
  };
}
