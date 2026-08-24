/**
 * AI rival engine.
 *
 * Keeps the community and leaderboard alive with a crew of clearly-labelled
 * AI accounts (role = "bot", every UI shows an "AI" badge next to them).
 * They earn XP daily, keep streaks, and post study-themed content — giving
 * new users someone to compete with from day one.
 *
 * All activity is generated lazily: whoever first loads the leaderboard or
 * the community feed on a given day triggers (at most once) that day's
 * bot activity. No cron jobs needed.
 */

import { db } from "@workspace/db";
import {
  usersTable,
  userWalletsTable,
  studyStreaksTable,
  socialPostsTable,
  postCommentsTable,
} from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { logger } from "./logger";

export const BOT_ROLE = "bot";
const BOT_DOMAIN = "bot.focusarx";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** In-memory throttle — run the daily tick at most every 10 minutes. */
let lastTickAt = 0;
let lastTickDay = "";

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

const POST_TEMPLATES: Array<(name: string) => string> = [
  () => `Day ${20 + Math.floor(Math.random() * 60)} of deep work before sunrise. The 5am club is undefeated ☀️`,
  () => `Just finished a 90-minute focus block. Phone in another room, noise cancelling on, one task only. That's the whole secret 🎯`,
  () => `Reminder: a 25-minute session you actually start beats the perfect 2-hour session you keep planning 📚`,
  () => `Beat my best focus streak today — ${35 + Math.floor(Math.random() * 50)} minutes unbroken. Small wins compound 🔥`,
  () => `Studying with the rain sound + brown noise combo tonight. Absolute game changer 🌧️`,
  () => `Progress > perfection. Even 10 focused minutes counts. Show up tomorrow and do it again 💪`,
  () => `Exam prep log: 3 sessions done before lunch. The leaderboard pressure is real 😅 Who's climbing with me?`,
  () => `Tried the 2-hour deep study method for a week. Verdict: brutal but effective. Report coming after my session 🧠`,
  () => `Consistency update: showing up daily even when motivation is missing. Motivation follows action, not the other way around ✨`,
  () => `My desk setup is finally done — plants, warm lamp, zero notifications. Focus score jumped 12 points 🪴`,
  () => `Lost my 40-day streak last month. Rebuilt from zero. If I can, you can. Keep going 🌱`,
  () => `Flashcards + focus timer + a cup of tea. Simple routine, scary results 🍵`,
];

const COMMENT_TEMPLATES = [
  "This is the energy we need 🔥",
  "Solid session! Keep stacking those blocks 💪",
  "You're climbing the board — see you up there 🏆",
  "Great mindset. Consistency beats intensity 🎯",
  "Love this. Saving it for my next slump-day 📌",
  "Huge! The unbroken streak is where the growth is ✨",
  "Same here — deep work before the world wakes up is unmatched ☀️",
  "Respect. See you on tomorrow's leaderboard 👀",
];

// ── deterministic RNG (seeded by date + slug) ────────────────────────────────

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
}

// ── seeding ───────────────────────────────────────────────────────────────────

export async function seedBots(): Promise<{ created: number; total: number }> {
  let created = 0;
  for (const persona of BOT_PERSONAS) {
    const email = `${persona.slug}@${BOT_DOMAIN}`;
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
    if (existing) continue;

    const [user] = await db.insert(usersTable).values({
      email,
      name: persona.name,
      role: BOT_ROLE,
      isGuest: false,
      onboardingCompleted: true,
      bio: `AI rival · ${persona.vibe} mode. I train every day — catch me on the leaderboard.`,
    }).returning({ id: usersTable.id });

    if (!user) continue;
    created++;

    await db.insert(userWalletsTable).values({
      userId: user.id,
      coins: 200 + Math.floor(persona.baseXp / 10),
      totalXp: persona.baseXp,
      weeklyXp: Math.floor(persona.baseXp * 0.08),
      level: levelForXp(persona.baseXp),
    }).onConflictDoNothing();

    await db.insert(studyStreaksTable).values({
      userId: user.id,
      currentStreak: persona.streak,
      longestStreak: persona.streak + 3,
      lastStudyDate: todayKey(),
    }).onConflictDoNothing();
  }

  // Give the fresh crew a first day of content.
  lastTickDay = "";
  await ensureDailyBotActivity(true);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.role, BOT_ROLE));
  return { created, total: Number(count) };
}

export async function deleteAllBots(): Promise<number> {
  const deleted = await db.delete(usersTable).where(eq(usersTable.role, BOT_ROLE)).returning({ id: usersTable.id });
  return deleted.length;
}

// ── daily activity ────────────────────────────────────────────────────────────

async function botPostCountToday(): Promise<number> {
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  const [row] = await db.select({ count: sql<number>`count(*)` })
    .from(socialPostsTable)
    .innerJoin(usersTable, eq(usersTable.id, socialPostsTable.userId))
    .where(and(eq(usersTable.role, BOT_ROLE), gte(socialPostsTable.createdAt, midnight)));
  return Number(row?.count ?? 0);
}

/**
 * Runs at most once per day (plus a 10-minute in-memory throttle so bursts of
 * requests don't spam the DB). For each bot: earn daily XP, advance streak,
 * and have a few of them publish a post. Everything is deterministic per
 * (day, persona) so restarts never double-apply.
 */
export async function ensureDailyBotActivity(force = false): Promise<void> {
  const today = todayKey();
  const now = Date.now();
  if (!force) {
    if (today === lastTickDay) return;
    if (now - lastTickAt < 10 * 60 * 1000) return;
  }
  lastTickAt = now;
  lastTickDay = today;

  try {
    const bots = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
    }).from(usersTable).where(eq(usersTable.role, BOT_ROLE));
    if (bots.length === 0) return;

    const posted = await botPostCountToday();
    let postsToday = posted;

    for (const bot of bots) {
      const slug = bot.email.split("@")[0] ?? bot.id;
      const rng = mulberry32(hashString(`${slug}:${today}`));
      const persona = BOT_PERSONAS.find(p => p.slug === slug);

      // Daily XP — grinders earn most, everyone has an off-ish day sometimes.
      const vibeGain: Record<BotPersona["vibe"], number> = { grinder: 1.0, scholar: 0.85, sprinter: 0.75, chill: 0.6 };
      const gain = Math.round((120 + rng() * 260) * (vibeGain[persona?.vibe ?? "chill"]) * (rng() < 0.12 ? 0.4 : 1));

      const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, bot.id));
      if (wallet) {
        const weeklyAge = wallet.weeklyXpResetAt ? Date.now() - new Date(wallet.weeklyXpResetAt).getTime() : Infinity;
        const weeklyBase = weeklyAge > WEEK_MS ? 0 : wallet.weeklyXp;
        const totalXp = wallet.totalXp + gain;
        await db.update(userWalletsTable).set({
          totalXp,
          weeklyXp: weeklyBase + gain,
          level: levelForXp(totalXp),
          coins: wallet.coins + Math.round(gain / 6),
          weeklyXpResetAt: weeklyAge > WEEK_MS ? new Date() : wallet.weeklyXpResetAt,
          updatedAt: new Date(),
        }).where(eq(userWalletsTable.userId, bot.id));
      } else {
        await db.insert(userWalletsTable).values({
          userId: bot.id,
          coins: Math.round(gain / 6),
          totalXp: gain,
          weeklyXp: gain,
          level: levelForXp(gain),
        });
      }

      // Streak — every bot studies daily; ~10% have a rest day.
      if (rng() > 0.1) {
        const [streak] = await db.select().from(studyStreaksTable).where(eq(studyStreaksTable.userId, bot.id));
        if (streak) {
          if (streak.lastStudyDate !== today) {
            const current = streak.currentStreak + 1;
            await db.update(studyStreaksTable).set({
              currentStreak: current,
              longestStreak: Math.max(streak.longestStreak, current),
              lastStudyDate: today,
              updatedAt: new Date(),
            }).where(eq(studyStreaksTable.userId, bot.id));
          }
        } else {
          await db.insert(studyStreaksTable).values({
            userId: bot.id, currentStreak: 1, longestStreak: 1, lastStudyDate: today,
          });
        }
      }

      // Posts — cap at 4/day total so the feed stays natural.
      if (postsToday < 4 && rng() < 0.16) {
        const template = POST_TEMPLATES[Math.floor(rng() * POST_TEMPLATES.length)]!;
        await db.insert(socialPostsTable).values({
          userId: bot.id,
          content: template(bot.name ?? "A rival"),
          type: "status",
          isPublic: true,
          moderationStatus: "approved",
        });
        postsToday++;
      }
    }
  } catch (err) {
    // Never let bot upkeep break a user-facing route.
    logger.warn({ err }, "bot daily activity failed (non-fatal)");
  }
}

/**
 * Occasionally (deterministically per post id) have an AI rival drop a
 * supportive comment under a fresh human post.
 */
export async function maybeBotReply(postId: string, authorId: string): Promise<void> {
  try {
    const rng = mulberry32(hashString(`reply:${postId}`));
    if (rng() > 0.45) return;

    const bots = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, BOT_ROLE));
    if (bots.length === 0) return;
    const bot = bots[Math.floor(rng() * bots.length)]!;
    if (bot.id === authorId) return;

    const content = COMMENT_TEMPLATES[Math.floor(rng() * COMMENT_TEMPLATES.length)]!;
    await db.insert(postCommentsTable).values({ postId, userId: bot.id, content });
  } catch (err) {
    logger.warn({ err }, "bot reply failed (non-fatal)");
  }
}
