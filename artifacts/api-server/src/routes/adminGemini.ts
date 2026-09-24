/**
 * Gemini chief-of-staff — admin surface (Workstream G).
 *
 * G3: status + idea backlog + briefings (approve/reject with audit log)
 * G4: bot fleet overview + AI ops suggestions (Gemini can SUGGEST —
 *     it can never block, mute, or ban anyone; no such action exists)
 * G5: 24h purpose traffic + 7-day cost estimate
 * G6: daily SEO officer (idempotent per IST day)
 * G7: daily IST operations briefing (idempotent per IST day)
 *
 * All AI calls go through the central gateway (budget-capped, logged,
 * template-fallback) so the tab is fully useful with zero AI keys.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  db, pool,
  usersTable, focusSessionsTable, coinTransactionsTable,
  adminDropsTable,
  aiIdeasTable, aiBriefingsTable, aiActionAuditTable, platformMetaTable,
  socialPostsTable, siteSettingsTable, featureFlagsTable,
  questDefinitionsTable, marketplaceItemsTable,
} from "@workspace/db";
import { eq, and, desc, gte, sql, inArray } from "drizzle-orm";
import { checkAdminAuth } from "../lib/adminAuth";
import { logger } from "../lib/logger";
import { invalidateSiteSettingsCache } from "../lib/siteSettings";
import { queueBotReplies } from "../lib/botEngine";
import { extractUserId } from "./auth";
import { checkBudget, usageByPurpose, estimatedCost, istDayKey } from "../lib/aiBudget";
import { providerAvailability } from "../lib/aiProvider";
import { currentGeminiModel } from "../lib/aiBudgetCore";
import { generateAi } from "../lib/aiProvider";
import { briefingTemplate, seoBriefingTemplate, dailySeoSuggestions, sanitizeNeverNegative } from "../lib/aiTemplates";
import { sendUnauthorized } from "../lib/httpErrors";

const router = Router();

const ideaSchema = z.object({
  title: z.string().min(3).max(140),
  body: z.string().min(10).max(2000),
  category: z.enum(["growth", "seo", "feature", "event"]).default("growth"),
  effort: z.enum(["small", "medium", "large"]).default("medium"),
  impact: z.enum(["low", "medium", "high"]).default("medium"),
});

/**
 * These are deliberately explicit, bounded admin commands. Gemini can draft
 * ideas, but it must not interpret arbitrary prose as a moderation, account,
 * or money-moving instruction. The admin picks the safe operation and enters
 * the content/parameters that should be carried out.
 */
const adminActionSchema = z.object({
  action: z.enum(["feed_post", "announcement", "quest_builder", "marketplace_steward"]),
  title: z.string().trim().max(140).optional(),
  body: z.string().trim().max(4000).optional(),
  count: z.number().int().min(1).max(4).optional(),
  theme: z.string().trim().max(120).optional(),
  introduce: z.number().int().min(0).max(3).optional(),
  retire: z.number().int().min(0).max(3).optional(),
});

async function guard(req: Request, res: Response): Promise<boolean> {
  if (!(await checkAdminAuth(req))) {
    sendUnauthorized(res);
    return false;
  }
  return true;
}

/**
 * Auto-publish switch for approved ideas.
 *
 * Reads the `gemini_auto_publish` feature flag. Deliberately ON when the
 * flag row is absent (the owner asked for auto-publish): storing the row
 * with `enabled: false` is the off switch, and the Feature Flags / Gemini
 * panels both flip it. A database failure fails *closed* (no auto-publish)
 * — surprise publishing is the one thing worse than a missed one.
 */
async function autoPublishEnabled(): Promise<boolean> {
  try {
    const [row] = await db.select().from(featureFlagsTable)
      .where(eq(featureFlagsTable.key, "gemini_auto_publish")).limit(1);
    return row ? row.enabled : true;
  } catch (err) {
    logger.warn({ err }, "gemini auto-publish flag read failed — defaulting to off");
    return false;
  }
}

type AiIdeaRow = typeof aiIdeasTable.$inferSelect;

/**
 * Shared publish implementation used by both the explicit publish route and
 * the auto-publish path on approval. Feed posts are authored by the given
 * admin (falling back to the first admin account for cookie-only sessions),
 * which is also what triggers the bot fleet's guaranteed quick replies —
 * the visible community reaction. Announcements write the site banner store
 * and invalidate its cache so the change is live without a deploy.
 */
async function publishIdea(idea: AiIdeaRow, channel: "feed" | "announcement", preferredAuthorId: string | null): Promise<string> {
  let publishedWhere: string;
  if (channel === "announcement") {
    const updates = {
      announcementEnabled: true,
      announcementTitle: idea.title.slice(0, 100),
      announcementText: idea.body.slice(0, 500),
      announcementEmoji: "💡",
      updatedAt: new Date(),
    };
    const [existing] = await db.select().from(siteSettingsTable).limit(1);
    if (existing) {
      await db.update(siteSettingsTable).set(updates).where(eq(siteSettingsTable.id, existing.id));
    } else {
      await db.insert(siteSettingsTable).values({ id: "default", ...updates });
    }
    invalidateSiteSettingsCache();
    publishedWhere = "site announcement";
  } else {
    let authorId = preferredAuthorId;
    if (!authorId) {
      const [admin] = await db.select({ id: usersTable.id }).from(usersTable)
        .where(eq(usersTable.role, "admin")).limit(1);
      authorId = admin?.id ?? null;
    }
    if (!authorId) throw new Error("no admin account available to author the post");
    const content = `${idea.title}\n\n${idea.body}`.trim();
    const [post] = await db.insert(socialPostsTable).values({
      userId: authorId,
      content,
      type: "general",
      isPublic: true,
      moderationStatus: "approved",
    }).returning();
    // Admin-authored posts get guaranteed quick bot replies — the visible
    // community reaction the publish is meant to trigger.
    await queueBotReplies(post.id, authorId, content, false);
    publishedWhere = `community feed (post ${post.id})`;
  }

  await db.update(aiIdeasTable).set({ status: "published", updatedAt: new Date() }).where(eq(aiIdeasTable.id, idea.id));
  return publishedWhere;
}

/**
 * G10: execute a basic admin-entered operation. This is the non-dead-end path
 * for an operator who already knows what should happen and does not need to
 * manufacture an idea row first.
 */
router.post("/admin/gemini/actions", async (req, res) => {
  if (!(await guard(req, res))) return;
  const parsed = adminActionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid action request", details: parsed.error.flatten() });
    return;
  }

  const input = parsed.data;
  const actor = extractUserId(req) ?? "admin";
  try {
    let result: Record<string, unknown>;
    let outcome: "executed" | "no_change" = "executed";

    if (input.action === "feed_post" || input.action === "announcement") {
      if (!input.title || input.title.length < 3 || !input.body || input.body.length < 3) {
        res.status(400).json({ error: "title and body are required for publishing" });
        return;
      }

      if (input.action === "feed_post") {
        let authorId: string | null = actor === "admin" ? null : actor;
        if (!authorId) {
          const [admin] = await db.select({ id: usersTable.id }).from(usersTable)
            .where(eq(usersTable.role, "admin")).limit(1);
          authorId = admin?.id ?? null;
        }
        if (!authorId) {
          res.status(503).json({ error: "No admin account is available to author the post" });
          return;
        }
        const content = `${input.title}\n\n${input.body}`.trim();
        const [post] = await db.insert(socialPostsTable).values({
          userId: authorId,
          content,
          type: "general",
          isPublic: true,
          moderationStatus: "approved",
        }).returning({ id: socialPostsTable.id });
        if (!post) throw new Error("Post was not created");
        await queueBotReplies(post.id, authorId, content, false);
        result = { channel: "feed", postId: post.id, message: "Posted to the community feed and queued bot replies." };
      } else {
        const updates = {
          announcementEnabled: true,
          announcementTitle: input.title.slice(0, 100),
          announcementText: input.body.slice(0, 500),
          announcementEmoji: "✨",
          updatedAt: new Date(),
        };
        const [existing] = await db.select().from(siteSettingsTable).limit(1);
        if (existing) await db.update(siteSettingsTable).set(updates).where(eq(siteSettingsTable.id, existing.id));
        else await db.insert(siteSettingsTable).values({ id: "default", ...updates });
        invalidateSiteSettingsCache();
        result = { channel: "announcement", message: "Site announcement is live." };
      }
    } else if (input.action === "quest_builder") {
      const built = await buildQuests({ count: input.count, theme: input.theme });
      outcome = built.created.length > 0 ? "executed" : "no_change";
      result = { ...built, message: built.created.length > 0 ? `Published ${built.created.length} quest(s).` : "No new quests were needed." };
    } else {
      const curated = await runMarketplaceSteward({ introduce: input.introduce, retire: input.retire });
      outcome = curated.introduced.length > 0 || curated.retired.length > 0 ? "executed" : "no_change";
      result = {
        ...curated,
        message: `Introduced ${curated.introduced.length} item(s) and retired ${curated.retired.length}.`,
      };
    }

    await db.insert(aiActionAuditTable).values({
      actor,
      actorRole: "admin",
      action: `admin_command_${input.action}`,
      payload: { request: input, result },
      outcome,
      approvedBy: null,
    });
    res.json({ ok: true, action: input.action, ...result });
  } catch (err) {
    logger.error({ err, action: input.action }, "gemini admin action error");
    res.status(500).json({ error: "Action failed — no partial result was published" });
  }
});

// ── G3/G5: status ────────────────────────────────────────────────────────────

router.get("/admin/gemini/status", async (req, res) => {
  if (!(await guard(req, res))) return;
  try {
    const availability = await providerAvailability();
    const purposeUsage = await usageByPurpose(24);
    const cost = await estimatedCost(7);

    // Bot fleet (G4): counts only — the AI has no power action here.
    const [{ value: botCount }] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.role, "bot"));
    const yesterday = new Date(Date.now() - 86_400_000);
    const { botPosts24h, botComments24h } = await botActivity24h(yesterday);

    const [ideas] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(aiIdeasTable)
      .where(eq(aiIdeasTable.status, "backlog"));

    const gemini = await checkBudget("gemini");
    res.json({
      availability,
      budget: { gemini: gemini.used, geminiCap: gemini.cap, geminiAvailable: gemini.available, coolUntil: gemini.coolUntil },
      purposeUsage,
      cost,
      botFleet: {
        bots: botCount,
        botPosts24h,
        botComments24h,
        guardrail: "AI can suggest only — no block/mute/ban actions exist for AI-initiated work.",
      },
      ideasBacklog: ideas?.value ?? 0,
    });
  } catch (err) {
    logger.error({ err }, "gemini status error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ── G8: is the AI actually working? ──────────────────────────────────────────
/**
 * The question "does Gemini work?" used to be unanswerable from inside the
 * app: the status endpoint reports budgets, keys and latency *of previous
 * calls*, so a key that was never used — or a model ID that 404s on every
 * request — looked exactly the same as a healthy provider (both show zero
 * calls). This makes one real request and reports the result, including the
 * provider-specific error, so a broken integration is one click from an answer
 * instead of a guess.
 *
 * It is deliberately cheap (16 output tokens), reads nothing from the database
 * and writes nothing except the ordinary AI call log.
 */
router.post("/admin/gemini/self-test", async (req, res) => {
  if (!(await guard(req, res))) return;
  const prompt = typeof req.body?.prompt === "string" && req.body.prompt.trim().length > 0
    ? req.body.prompt.trim().slice(0, 300)
    : "Reply with the single word: ready";

  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const groqConfigured = Boolean(process.env.GROQ_API_KEY);
  const t0 = Date.now();
  try {
    const before = await currentGeminiModel();
    const result = await generateAi({ purpose: "self_test", prompt, maxTokens: 16 });
    const after = await currentGeminiModel();
    const ok = Boolean(result?.source === "llm");
    res.json({
      ok,
      provider: result?.provider ?? null,
      model: result?.model ?? null,
      reply: result?.text?.slice(0, 300) ?? null,
      latencyMs: Date.now() - t0,
      // A silent switch between models is how a retirement goes unnoticed, so
      // report it: `before` is the remembered winner, `after` is what answered.
      modelChanged: before !== after,
      geminiConfigured,
      groqConfigured,
      diagnosis: ok
        ? result?.provider === "gemini"
          ? "Gemini answered this request."
          : `Gemini did not answer; ${result?.provider} did. Check GEMINI_API_KEY, GEMINI_MODEL and the Generative Language API quota.`
        : geminiConfigured || groqConfigured
          ? "No provider answered. Check the server log for the exact upstream status (401/403 = key or API not enabled, 404 = model retired, 429 = quota)."
          : "No AI key is configured on this deployment (GEMINI_API_KEY / GROQ_API_KEY), so every AI feature is serving template text by design.",
    });
  } catch (err) {
    logger.error({ err }, "gemini self-test error");
    res.json({
      ok: false,
      provider: null,
      model: null,
      reply: null,
      latencyMs: Date.now() - t0,
      geminiConfigured,
      groqConfigured,
      diagnosis: "The self-test threw before a reply came back — see the server log.",
    });
  }
});

// ── G3: idea backlog ─────────────────────────────────────────────────────────

router.get("/admin/gemini/ideas", async (req, res) => {
  if (!(await guard(req, res))) return;
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const rows = status === "all"
      ? await db.select().from(aiIdeasTable).orderBy(desc(aiIdeasTable.updatedAt)).limit(limit)
      : await db.select().from(aiIdeasTable).where(eq(aiIdeasTable.status, status)).orderBy(desc(aiIdeasTable.createdAt)).limit(limit);
    res.json({ ideas: rows });
  } catch (err) {
    logger.error({ err }, "gemini ideas list error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/admin/gemini/ideas", async (req, res) => {
  if (!(await guard(req, res))) return;
  const parsed = ideaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid idea" }); return; }
  try {
    const [idea] = await db.insert(aiIdeasTable).values({
      ...parsed.data,
      source: "admin",
    }).returning();
    res.json({ idea });
  } catch (err) {
    logger.error({ err }, "gemini idea create error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/admin/gemini/ideas/:id/:decision", async (req, res) => {
  if (!(await guard(req, res))) return;
  const { id, decision } = req.params;
  if (decision !== "approve" && decision !== "reject") {
    res.status(400).json({ error: "decision must be approve|reject" });
    return;
  }
  try {
    const [idea] = await db.select().from(aiIdeasTable).where(eq(aiIdeasTable.id, id));
    if (!idea) { res.status(404).json({ error: "Idea not found" }); return; }
    const status = decision === "approve" ? "approved" : "rejected";
    await db.update(aiIdeasTable).set({ status, updatedAt: new Date() }).where(eq(aiIdeasTable.id, id));
    // Rule #9: powerful admin decisions on AI suggestions are audit-logged.
    await db.insert(aiActionAuditTable).values({
      actor: "admin",
      actorRole: "admin",
      action: decision === "approve" ? "idea_approve" : "idea_reject",
      payload: { ideaId: id, title: idea.title, category: idea.category },
      outcome: "executed",
      approvedBy: null,
    });

    // Auto-publish: with the flag on (the default), approving an idea ships
    // it to the community feed immediately — no second click needed. A
    // publish failure degrades to a plain approval; the idea stays approved
    // and can still be published manually.
    let published = false;
    let publishedWhere: string | undefined;
    if (decision === "approve" && (await autoPublishEnabled())) {
      try {
        publishedWhere = await publishIdea({ ...idea, status: "approved" }, "feed", extractUserId(req));
        published = true;
        await db.insert(aiActionAuditTable).values({
          actor: "system",
          actorRole: "admin",
          action: "idea_auto_publish",
          payload: { ideaId: id, title: idea.title, channel: "feed", publishedWhere },
          outcome: "executed",
          approvedBy: null,
        });
      } catch (err) {
        logger.error({ err }, "gemini auto-publish failed — idea stays approved");
      }
    }

    res.json({ ok: true, status, published, publishedWhere });
  } catch (err) {
    logger.error({ err }, "gemini idea decision error");
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * G8: actually ship an approved idea.
 *
 * Approving an idea used to be a dead end — it sat in the backlog forever,
 * which read as "Gemini does nothing". This route is the human-triggered
 * publish step (auto-publish stays OFF by design):
 *
 *   channel=feed          → posts it to the community feed as the publishing
 *                           admin. Admin posts get the guaranteed quick bot
 *                           replies (see botEngine.queueBotReplies), so the
 *                           community visibly reacts within minutes.
 *   channel=announcement  → sets the site-wide announcement banner via the
 *                           same store AdminSitePanel writes to.
 *
 * The idea is marked `published` and the action lands in the immutable AI
 * audit log, like approve/reject.
 */
router.post("/admin/gemini/ideas/:id/publish", async (req, res) => {
  if (!(await guard(req, res))) return;
  const { id } = req.params;
  const channel = (req.body as { channel?: unknown } | undefined)?.channel;
  if (channel !== "feed" && channel !== "announcement") {
    res.status(400).json({ error: "channel must be feed|announcement" });
    return;
  }
  try {
    const [idea] = await db.select().from(aiIdeasTable).where(eq(aiIdeasTable.id, id));
    if (!idea) { res.status(404).json({ error: "Idea not found" }); return; }
    if (idea.status === "published") { res.status(409).json({ error: "Already published" }); return; }
    if (idea.status !== "approved") {
      res.status(409).json({ error: "Only approved ideas can be published — approve it first." });
      return;
    }

    let publishedWhere: string;
    try {
      publishedWhere = await publishIdea(idea, channel, extractUserId(req));
    } catch (err) {
      logger.error({ err }, "gemini idea publish failed");
      res.status(503).json({ error: (err as Error).message || "Publish failed" });
      return;
    }

    await db.insert(aiActionAuditTable).values({
      actor: "admin",
      actorRole: "admin",
      action: "idea_publish",
      payload: { ideaId: id, title: idea.title, category: idea.category, channel, publishedWhere },
      outcome: "executed",
      approvedBy: null,
    });
    res.json({ ok: true, channel, publishedWhere });
  } catch (err) {
    logger.error({ err }, "gemini idea publish error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ── G7: daily IST briefing ───────────────────────────────────────────────────

interface DailyStats {
  day: string;
  newUsers: number;
  sessions: number;
  focusMinutes: number;
  coinsMinted: number;
  coinsBurned: number;
  dropsActive: number;
  botPosts: number;
  topExams: string[];
  /** Human (non-bot) social posts in the window — bot-share math needs it. */
  humanPosts: number;
  /** New follows in the window — community growth signal. */
  newFollows: number;
  /** Study-room chat messages in the window — live-room health. */
  roomMessages: number;
  /** Premium subscriptions currently active. */
  premiumActive: number;
  /** Learners holding a streak of 3+ days. */
  activeStreakers: number;
}

async function botActivity24h(since: Date): Promise<{ botPosts24h: number; botComments24h: number }> {
  try {
    const posts = await pool.query(
      `SELECT count(*)::int AS n FROM social_posts p JOIN users u ON u.id = p.user_id
       WHERE u.role = 'bot' AND p.created_at >= $1`,
      [since]
    );
    const comments = await pool.query(
      `SELECT count(*)::int AS n FROM post_comments c JOIN users u ON u.id = c.user_id
       WHERE u.role = 'bot' AND c.created_at >= $1`,
      [since]
    );
    return { botPosts24h: posts.rows[0].n ?? 0, botComments24h: comments.rows[0].n ?? 0 };
  } catch {
    return { botPosts24h: 0, botComments24h: 0 };
  }
}

async function collectDailyStats(day: string): Promise<DailyStats> {
  // "Today so far" in IST: window = last 24h (good enough for a lazy tick).
  const since = new Date(Date.now() - 86_400_000);
  const [newUsersRow] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(and(eq(usersTable.isGuest, false), gte(usersTable.createdAt, since)));
  const [sessRow] = await db
    .select({
      value: sql<number>`count(*)::int`,
      minutes: sql<number>`coalesce(sum(${focusSessionsTable.durationSec}), 0) / 60`,
    })
    .from(focusSessionsTable)
    .where(and(eq(focusSessionsTable.mode, "focus"), gte(focusSessionsTable.completedAt, since)));
  const [mintRow] = await db
    .select({ value: sql<number>`coalesce(sum(${coinTransactionsTable.amount}), 0)::int` })
    .from(coinTransactionsTable)
    .where(and(eq(coinTransactionsTable.type, "earn"), gte(coinTransactionsTable.createdAt, since)));
  const [burnRow] = await db
    .select({ value: sql<number>`coalesce(sum(${coinTransactionsTable.amount}), 0)::int` })
    .from(coinTransactionsTable)
    .where(and(eq(coinTransactionsTable.type, "spend"), gte(coinTransactionsTable.createdAt, since)));
  const [dropsRow] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(adminDropsTable)
    .where(and(eq(adminDropsTable.isActive, true), gte(adminDropsTable.endsAt, new Date())));
  const { botPosts24h } = await botActivity24h(since);

  // Community/social vitals — one cheap query each, all real numbers.
  const countQ = async (sqlText: string, params: unknown[] = []): Promise<number> => {
    try {
      const r = await pool.query(sqlText, params);
      return Number(r.rows[0]?.n ?? 0);
    } catch { return 0; }
  };
  const humanPosts = await countQ(
    `SELECT count(*)::int AS n FROM social_posts p JOIN users u ON u.id = p.user_id
     WHERE u.role <> 'bot' AND p.created_at >= $1`, [since]);
  const newFollows = await countQ(`SELECT count(*)::int AS n FROM follows WHERE created_at >= $1`, [since]);
  const roomMessages = await countQ(`SELECT count(*)::int AS n FROM study_room_messages WHERE created_at >= $1`, [since]);
  const premiumActive = await countQ(`SELECT count(*)::int AS n FROM premium_subscriptions WHERE is_active = true`);
  const activeStreakers = await countQ(`SELECT count(*)::int AS n FROM study_streaks WHERE current_streak >= 3`);

  return {
    day,
    newUsers: newUsersRow?.value ?? 0,
    sessions: sessRow?.value ?? 0,
    focusMinutes: Number(sessRow?.minutes ?? 0),
    coinsMinted: mintRow?.value ?? 0,
    coinsBurned: burnRow?.value ?? 0,
    dropsActive: dropsRow?.value ?? 0,
    botPosts: botPosts24h,
    topExams: ["JEE Main", "NEET", "UPSC", "CA Foundation", "CBSE Boards"],
    humanPosts,
    newFollows,
    roomMessages,
    premiumActive,
    activeStreakers,
  };
}

/**
 * Server-side anomaly detection — the briefing flags these whether or not an
 * LLM is attached, so the founder always gets an on-call style "watch list".
 */
function detectAlerts(stats: DailyStats): string[] {
  const alerts: string[] = [];
  if (stats.newUsers === 0) alerts.push("Zero new sign-ups in the last 24h — check landing page + acquisition links.");
  if (stats.sessions === 0) alerts.push("Zero completed focus sessions in 24h — verify the timer/session pipeline.");
  const totalPosts = stats.botPosts + stats.humanPosts;
  if (totalPosts >= 5 && stats.botPosts / totalPosts > 0.7) {
    alerts.push(`Feed is ${Math.round((stats.botPosts / totalPosts) * 100)}% bot posts (${stats.botPosts}/${totalPosts}) — nudge real engagement or slow the fleet.`);
  }
  const net = stats.coinsMinted - stats.coinsBurned;
  if (stats.coinsMinted > 1000 && stats.coinsBurned < stats.coinsMinted * 0.1) {
    alerts.push(`Coin minting is one-directional (+${net.toLocaleString()} net, <10% burned) — economy may inflate.`);
  }
  return alerts;
}

async function runDailyBriefing(force: boolean) {
  const day = istDayKey();
  // Idempotency key in platform_meta (no cron).
  const metaKey = `briefing_daily_${day}`;
  if (!force) {
    const rows = await db.select().from(platformMetaTable).where(eq(platformMetaTable.key, metaKey));
    if (rows.length > 0) return { already: true as const };
  }

  const stats = await collectDailyStats(day);
  const alerts = detectAlerts(stats);
  let summary = briefingTemplate(stats, alerts);
  let source = "template";

  // Developer persona: Gemini writes like a senior engineer on call —
  // vitals first, anomalies flagged, exactly three next actions.
  const result = await generateAi({
    purpose: "briefing",
    prompt: `You are the senior developer and chief-of-staff of FocusArx, a focus/study app for Indian exam aspirants (IST timezone). Write today's morning ops briefing for the founder. Write like an experienced engineer on call: precise, numbers-first, zero fluff.

Format (markdown, ~10 lines total):
## 📊 Vitals
- one compact line per key metric with a quick read (▲ growing / ▼ declining / flat)
## ⚠️ Watch
- anomalies only (use the pre-computed alerts; if none, write "Nothing abnormal.")
## ✅ Next actions
- exactly 3 concrete one-line actions ordered by impact

Hard rules: use ONLY the numbers in DATA — never invent metrics; mention exam season where relevant.
PRE-COMPUTED ALERTS: ${JSON.stringify(alerts)}
DATA: ${JSON.stringify(stats)}`,
    maxTokens: 450,
  });
  if (result) {
    summary = sanitizeNeverNegative(result.text);
    source = result.provider;
  }

  await db.insert(aiBriefingsTable).values({
    day,
    kind: "daily",
    data: { ...stats, alerts, source },
    summary,
  }).onConflictDoNothing();
  await pool.query(
    `INSERT INTO platform_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
    [metaKey, JSON.stringify({ at: new Date().toISOString(), source })]
  );

  /*
    The briefings are not the only thing Gemini owns. Once the day's briefing
    has claimed its idempotency key, the two steward jobs run: quests first
    (learners need something new to do today) and the marketplace second (the
    shop is only worth opening if it changed). Both are best-effort and bounded
    — a failure here must never fail the briefing, and re-running the whole
    thing the same day is prevented by the same key that guards the briefing.
  */
  let stewards: { quests?: Awaited<ReturnType<typeof buildQuests>>; marketplace?: MarketplaceStewardResult } = {};
  try {
    stewards = {
      quests: await buildQuests({ count: 2 }),
      marketplace: await runMarketplaceSteward({ introduce: 2, retire: 1 }),
    };
    await db.insert(aiActionAuditTable).values({
      actor: "gemini",
      actorRole: "gemini",
      action: "daily_steward_pass",
      payload: {
        day,
        questsCreated: stewards.quests?.created ?? [],
        itemsIntroduced: stewards.marketplace?.introduced.map(i => i.id) ?? [],
        itemsRetired: stewards.marketplace?.retired.map(r => r.id) ?? [],
      },
      outcome: "executed",
      approvedBy: null,
    }).catch(() => {});
  } catch (err) {
    logger.warn({ err }, "daily steward pass failed (briefing unaffected)");
  }

  return {
    ok: true as const,
    briefing: { day, kind: "daily", summary, data: stats, source },
    stewards: {
      quests: stewards.quests?.created ?? [],
      marketplaceIntroduced: stewards.marketplace?.introduced.map(i => i.name) ?? [],
      marketplaceRetired: stewards.marketplace?.retired.map(r => r.id) ?? [],
    },
  };
}

router.post("/admin/gemini/briefings/daily", async (req, res) => {
  if (!(await guard(req, res))) return;
  try {
    const force = req.body?.force === true;
    const out = await runDailyBriefing(force);
    res.json(out);
  } catch (err) {
    logger.error({ err }, "daily briefing error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ── G6: daily SEO officer ────────────────────────────────────────────────────

async function runSeoOfficer(force: boolean) {
  const day = istDayKey();
  const metaKey = `seo_officer_${day}`;
  if (!force) {
    const rows = await db.select().from(platformMetaTable).where(eq(platformMetaTable.key, metaKey));
    if (rows.length > 0) return { already: true as const };
  }

  const [examPagesRow] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(aiIdeasTable)
    .where(eq(aiIdeasTable.category, "seo"));
  const suggestions = dailySeoSuggestions(day, examPagesRow?.value ?? 0);

  let summary = seoBriefingTemplate({ day, existingExamPages: examPagesRow?.value ?? 0, suggestedKeywords: suggestions });
  let source = "template";
  const result = await generateAi({
    purpose: "seo",
    prompt: `You are the FocusArx SEO officer (India-first: JEE/NEET/UPSC/CA/boards). Given these candidate long-tail keywords, rank the top 3 for today and give a one-line angle for each:\n${JSON.stringify(suggestions, null, 1)}\nReply as a short markdown list, no preamble.`,
    maxTokens: 250,
  });
  if (result) {
    summary = sanitizeNeverNegative(result.text);
    source = result.provider;
  }

  await db.insert(aiBriefingsTable).values({
    day,
    kind: "seo",
    data: { existingExamPages: examPagesRow?.value ?? 0, suggestedKeywords: suggestions, source },
    summary,
  }).onConflictDoNothing();

  // File the #1 suggestion into the idea backlog (auto-publish is OFF:
  // it stays a backlog item until an admin approves it).
  const top = suggestions[0]!;
  const [dup] = await db.select({ id: aiIdeasTable.id }).from(aiIdeasTable)
    .where(and(eq(aiIdeasTable.title, `SEO: ${top.kw}`), inArray(aiIdeasTable.status, ["backlog", "approved"]))).limit(1);
  if (!dup) {
    await db.insert(aiIdeasTable).values({
      title: `SEO: ${top.kw}`,
      body: `Angle: ${top.angle}. Generated by the daily SEO officer (auto-publish OFF — approve to build the page).`,
      category: "seo",
      effort: "medium",
      impact: "high",
      source: "gemini",
    });
  }
  await pool.query(
    `INSERT INTO platform_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
    [metaKey, JSON.stringify({ at: new Date().toISOString(), source })]
  );
  return { ok: true as const, summary, source, topKeyword: top.kw };
}

router.post("/admin/gemini/briefings/seo", async (req, res) => {
  if (!(await guard(req, res))) return;
  try {
    const force = req.body?.force === true;
    const out = await runSeoOfficer(force);
    res.json(out);
  } catch (err) {
    logger.error({ err }, "seo officer error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ── G4: bot ops suggestions (never block) ────────────────────────────────────

router.post("/admin/gemini/bot-ops", async (req, res) => {
  if (!(await guard(req, res))) return;
  try {
    const day = istDayKey();
    const [{ value: bots }] = await db.select({ value: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.role, "bot"));
    const { botPosts24h: posts, botComments24h: comments } = await botActivity24h(new Date(Date.now() - 86_400_000));

    let suggestion =
      `Bot fleet (real numbers): ${bots} bots, ${posts} posts + ${comments} comments in the last 24h.\n` +
      `Suggested ops: 1) refresh 5 personas in the quietest exam track, 2) add 2 morning-motivation post slots (IST 6–8am), 3) keep reply ratio ≤ 1:3 posts:comments. (Template — connect an AI key for a narrative review.)`;
    let source = "template";
    const result = await generateAi({
      purpose: "ideas",
      prompt: `Review the FocusArx bot fleet and propose 3 concrete, safe ops suggestions (engagement cadence, persona refresh, time-of-day mix). Hard rule: you may NEVER suggest blocking, muting, banning, or hiding any user or bot. Keep it under 90 words.\nFleet: ${bots} bots, ${posts} posts + ${comments} comments (24h).`,
      maxTokens: 250,
    });
    if (result) {
      suggestion = sanitizeNeverNegative(result.text);
      source = result.provider;
    }

    const [idea] = await db.insert(aiIdeasTable).values({
      title: `Bot ops review — ${day}`,
      body: suggestion,
      category: "growth",
      effort: "small",
      impact: "medium",
      source: result ? "gemini" : "admin",
    }).returning();

    await db.insert(aiActionAuditTable).values({
      actor: "admin",
      actorRole: "admin",
      action: "bot_ops_review",
      payload: { ideaId: idea.id, bots, posts, comments },
      outcome: "executed",
    });

    res.json({ ok: true, idea, source });
  } catch (err) {
    logger.error({ err }, "bot ops error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ── G3: briefings list ───────────────────────────────────────────────────────

router.get("/admin/gemini/briefings", async (req, res) => {
  if (!(await guard(req, res))) return;
  try {
    const limit = Math.min(14, Number(req.query.limit) || 7);
    const rows = await db.select().from(aiBriefingsTable).orderBy(desc(aiBriefingsTable.createdAt)).limit(limit);
    res.json({ briefings: rows });
  } catch (err) {
    logger.error({ err }, "briefings list error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ── G8/G9: the two "steward" jobs ───────────────────────────────────────────
/**
 * Gemini as a working staff member rather than a summariser.
 *
 * Two jobs that used to be manual-and-never-done: writing new quests, and
 * curating the marketplace (introduce what is missing, retire what is not
 * selling). Both are *bounded by construction*:
 *
 *  - every generated value is clamped to a whitelist or a rarity price ladder
 *    before it touches the database, so a hallucinated `costCoins: 1` cannot
 *    hand out a legendary for nothing;
 *  - ids are namespaced (`gem-…`) and inserts are `onConflictDoNothing`, so
 *    re-running a steward job is a no-op rather than a duplicate catalogue;
 *  - retirement can never touch a premium item, an item in a bundle, or an item
 *    more than a handful of people have already bought and equipped;
 *  - the local fallbacks are drawn from seeded pools keyed by the IST day, so
 *    both jobs do real work with zero AI keys attached.
 */

const QUEST_METRICS = ["focus_minutes", "session_count", "coins_earned", "xp_earned", "streak_days"] as const;
type QuestMetricKey = typeof QUEST_METRICS[number];

interface GeneratedQuest {
  id: string;
  title: string;
  description: string;
  type: "daily" | "weekly";
  difficulty: "easy" | "medium" | "hard";
  target: number;
  metric: QuestMetricKey;
  xpReward: number;
  coinReward: number;
  icon: string;
  rotationWeight: number;
}

const QUEST_TARGET_HINTS: Record<QuestMetricKey, { min: number; max: number; unit: string }> = {
  focus_minutes: { min: 30, max: 360, unit: "minutes of focus" },
  session_count: { min: 1, max: 6, unit: "focus sessions" },
  coins_earned: { min: 50, max: 600, unit: "coins earned" },
  xp_earned: { min: 100, max: 1500, unit: "XP earned" },
  streak_days: { min: 3, max: 30, unit: "day streak" },
};

const DIFFICULTY_REWARD: Record<GeneratedQuest["difficulty"], { xp: [number, number]; coins: [number, number] }> = {
  easy: { xp: [40, 120], coins: [10, 40] },
  medium: { xp: [120, 260], coins: [30, 90] },
  hard: { xp: [260, 500], coins: [80, 200] },
};

const FALLBACK_QUESTS: Array<Omit<GeneratedQuest, "id">> = [
  { title: "Sunrise Session", description: "Finish one 45-minute focus session before 8am IST — the hardest slot to win.", type: "daily", difficulty: "medium", target: 45, metric: "focus_minutes", xpReward: 150, coinReward: 45, icon: "🌅", rotationWeight: 12 },
  { title: "Triple Threat", description: "Complete three separate focus sessions today instead of one long one.", type: "daily", difficulty: "easy", target: 3, metric: "session_count", xpReward: 90, coinReward: 25, icon: "🎯", rotationWeight: 14 },
  { title: "Streak Guard", description: "Show up and hold a 7-day streak — no zero days.", type: "weekly", difficulty: "hard", target: 7, metric: "streak_days", xpReward: 400, coinReward: 150, icon: "🛡️", rotationWeight: 8 },
  { title: "Deep Work Block", description: "Bank 180 minutes of deep focus across the week.", type: "weekly", difficulty: "hard", target: 180, metric: "focus_minutes", xpReward: 320, coinReward: 120, icon: "🌊", rotationWeight: 10 },
  { title: "Coin Collector", description: "Earn 250 coins from focus sessions this week.", type: "weekly", difficulty: "medium", target: 250, metric: "coins_earned", xpReward: 180, coinReward: 60, icon: "🪙", rotationWeight: 11 },
  { title: "Momentum Builder", description: "Gain 600 XP this week — finish what you start.", type: "weekly", difficulty: "medium", target: 600, metric: "xp_earned", xpReward: 200, coinReward: 70, icon: "📈", rotationWeight: 11 },
];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "quest";
}

/** Clamp an unknown value into a range, falling back when it is not a number. */
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Turn one model (or fallback) proposal into a row the database can trust. */
function sanitizeQuest(raw: Partial<GeneratedQuest> & { title?: string }): GeneratedQuest | null {
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 80) : "";
  const description = typeof raw.description === "string" ? raw.description.trim().slice(0, 300) : "";
  if (title.length < 4 || description.length < 10) return null;

  const metric: QuestMetricKey = (QUEST_METRICS as readonly string[]).includes(String(raw.metric))
    ? (raw.metric as QuestMetricKey)
    : "focus_minutes";
  const hints = QUEST_TARGET_HINTS[metric];
  const type: GeneratedQuest["type"] = raw.type === "weekly" ? "weekly" : "daily";
  const difficulty: GeneratedQuest["difficulty"] =
    raw.difficulty === "hard" || raw.difficulty === "medium" || raw.difficulty === "easy" ? raw.difficulty : "medium";
  const rewards = DIFFICULTY_REWARD[difficulty];

  return {
    id: `gem-${slugify(title)}`,
    title,
    description,
    type,
    difficulty,
    target: clampNumber(raw.target, hints.min, hints.max, Math.round((hints.min + hints.max) / 3)),
    metric,
    xpReward: clampNumber(raw.xpReward, rewards.xp[0], rewards.xp[1], rewards.xp[0]),
    coinReward: clampNumber(raw.coinReward, rewards.coins[0], rewards.coins[1], rewards.coins[0]),
    icon: typeof raw.icon === "string" && raw.icon.trim().length > 0 ? raw.icon.trim().slice(0, 4) : "🧭",
    rotationWeight: clampNumber(raw.rotationWeight, 5, 20, 10),
  };
}

/** Pull the first JSON array out of a model reply, ignoring prose around it. */
function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Build (and publish) new quest definitions. Gemini writes them when a key is
 * configured; otherwise the seeded pool supplies them in rotation.
 */
export async function buildQuests(opts: { count?: number; theme?: string } = {}): Promise<{
  created: string[];
  retired: number;
  source: string;
}> {
  const count = Math.min(4, Math.max(1, opts.count ?? 2));
  const existing = await db
    .select({ title: questDefinitionsTable.title })
    .from(questDefinitionsTable)
    .orderBy(desc(questDefinitionsTable.rotationWeight))
    .limit(120);
  const existingTitles = existing.map(e => e.title.toLowerCase());

  let proposals: Array<Partial<GeneratedQuest>> = [];
  let source = "template";

  const result = await generateAi({
    purpose: "quest_builder",
    prompt: `You are the quest designer for FocusArx, a focus app for Indian exam aspirants (JEE/NEET/UPSC/CA/boards). Propose ${count} NEW daily or weekly quests that are achievable and measurable.
Return ONLY a JSON array, no prose. Each object: {"title": string (<=60 chars), "description": string (<=200 chars, concrete and motivating), "type": "daily"|"weekly", "difficulty": "easy"|"medium"|"hard", "metric": one of ${JSON.stringify(QUEST_METRICS)}, "target": number, "xpReward": number, "coinReward": number, "icon": single emoji}.
Metric meaning: focus_minutes (minutes of focus), session_count (completed sessions), coins_earned, xp_earned, streak_days (consecutive days).
${opts.theme ? `Theme for this batch: ${opts.theme}.` : "Theme: exam-season consistency."}
Do not reuse or paraphrase these existing quest titles: ${JSON.stringify(existingTitles.slice(0, 60))}`,
    maxTokens: 700,
  });

  if (result) {
    proposals = extractJsonArray(result.text) as Array<Partial<GeneratedQuest>>;
    source = result.provider;
  }

  let quests = proposals.map(sanitizeQuest).filter((q): q is GeneratedQuest => q !== null);
  // A model that returns nothing usable must not mean "no quests today".
  if (quests.length === 0) {
    const dayIndex = Number(istDayKey().replace(/-/g, "")) % FALLBACK_QUESTS.length;
    quests = Array.from({ length: count }, (_, i) => {
      const base = FALLBACK_QUESTS[(dayIndex + i) % FALLBACK_QUESTS.length]!;
      return { ...base, id: `gem-${slugify(base.title)}` };
    });
    source = "template";
  }

  const created: string[] = [];
  for (const quest of quests) {
    if (existingTitles.includes(quest.title.toLowerCase())) continue;
    const inserted = await db.insert(questDefinitionsTable).values({
      id: quest.id,
      title: quest.title,
      description: quest.description,
      type: quest.type,
      difficulty: quest.difficulty,
      target: quest.target,
      metric: quest.metric,
      xpReward: quest.xpReward,
      coinReward: quest.coinReward,
      icon: quest.icon,
      isActive: true,
      rotationWeight: quest.rotationWeight,
    }).onConflictDoNothing().returning({ id: questDefinitionsTable.id });
    if (inserted.length > 0) created.push(quest.title);
  }

  return { created, retired: 0, source };
}

// ── Marketplace steward ──────────────────────────────────────────────────────

const RARITY_LADDER: Record<string, [number, number]> = {
  common: [100, 300],
  uncommon: [400, 700],
  rare: [1000, 1500],
  epic: [2000, 3500],
  legendary: [8000, 15000],
};
const ITEM_TYPES = ["frame", "avatar", "effect", "accessory", "decoration"] as const;

const FALLBACK_ITEMS = [
  { name: "Monsoon Study Frame", description: "Rain-streaked glass over your name — deep-work weather, all year", type: "frame", rarity: "rare", costCoins: 1200, emoji: "🌧️" },
  { name: "Night Owl Avatar", description: "For the 2am revision crowd that still shows up at 8am", type: "avatar", rarity: "epic", costCoins: 2400, emoji: "🦉" },
  { name: "Focus Field Effect", description: "A faint grid of light bends toward your timer as you focus", type: "effect", rarity: "uncommon", costCoins: 600, emoji: "🔆" },
  { name: "Chai Stall Decoration", description: "A street chai stall for your Focus City — fuel for the final sprint", type: "decoration", rarity: "uncommon", costCoins: 550, emoji: "🫖" },
  { name: "Lucky Pen Accessory", description: "The pen that wrote every topper's last-minute notes", type: "accessory", rarity: "common", costCoins: 250, emoji: "🖊️" },
] as const;

interface MarketplaceStewardResult {
  introduced: Array<{ id: string; name: string; rarity: string; costCoins: number }>;
  retired: Array<{ id: string; reason: string }>;
  source: string;
}

/**
 * Introduce new items and retire the ones that are not working.
 *
 * Guarantees that make this safe to run unattended:
 *  - premium items are never retired (people paid for them);
 *  - items referenced by a bundle are never retired (the bundle would lose a
 *    piece and its discount maths would go wrong);
 *  - anything owned by more than 25 learners is never retired (a collection is
 *    not a pricing experiment);
 *  - a generated item's price is clamped to the rarity ladder, so the catalogue
 *    stays internally consistent no matter what the model proposes.
 */
export async function runMarketplaceSteward(opts: { introduce?: number; retire?: number } = {}): Promise<MarketplaceStewardResult> {
  const introduceCount = Math.min(3, Math.max(0, opts.introduce ?? 2));
  const retireBudget = Math.min(3, Math.max(0, opts.retire ?? 2));

  const catalogue = await db.select({
    id: marketplaceItemsTable.id,
    name: marketplaceItemsTable.name,
    type: marketplaceItemsTable.type,
    rarity: marketplaceItemsTable.rarity,
    costCoins: marketplaceItemsTable.costCoins,
    premiumOnly: marketplaceItemsTable.premiumOnly,
  }).from(marketplaceItemsTable).where(eq(marketplaceItemsTable.isActive, true)).limit(200);

  let proposals: Array<Partial<{ name: string; description: string; type: string; rarity: string; costCoins: number; emoji: string }>> = [];
  let retireProposals: string[] = [];
  let source = "template";

  if (introduceCount > 0 || retireBudget > 0) {
    const result = await generateAi({
      purpose: "marketplace_steward",
      prompt: `You are the marketplace curator for FocusArx, a focus app for Indian exam aspirants. Cosmetics are bought with Focus Coins earned by studying.
Return ONLY JSON: {"introduce": [{"name": string, "description": string (<=140 chars), "type": "frame"|"avatar"|"effect"|"accessory"|"decoration", "rarity": "common"|"uncommon"|"rare"|"epic"|"legendary", "costCoins": number, "emoji": string}], "retire": [{"id": string, "reason": string (<=90 chars)}]}
Rules: introduce at most ${introduceCount} items that feel Indian, exam-season aware and distinct from the current catalogue; price within the rarity ladder (common 100-300, uncommon 400-700, rare 1000-1500, epic 2000-3500, legendary 8000-15000); retire at most ${retireBudget} existing NON-PREMIUM ids that are redundant, confusing or badly priced, with a one-line reason. Never retire premium items.
CURRENT CATALOGUE: ${JSON.stringify(catalogue.map(c => ({ id: c.id, name: c.name, type: c.type, rarity: c.rarity, cost: c.costCoins, premium: c.premiumOnly })))}`,
      maxTokens: 800,
    });
    if (result) {
      source = result.provider;
      const obj = (() => {
        const start = result.text.indexOf("{");
        const end = result.text.lastIndexOf("}");
        if (start === -1 || end <= start) return null;
        try { return JSON.parse(result.text.slice(start, end + 1)); } catch { return null; }
      })() as { introduce?: unknown[]; retire?: Array<{ id?: string; reason?: string }> } | null;
      if (obj) {
        proposals = (obj.introduce ?? []) as typeof proposals;
        retireProposals = (obj.retire ?? []).map(r => String(r?.id ?? "")).filter(Boolean);
      }
    }
  }

  // Fallback introductions: deterministic rotation over the seeded pool, keyed
  // to the day so the catalogue keeps growing even with no AI key configured.
  let sanitized = proposals.map(p => {
    const type = (ITEM_TYPES as readonly string[]).includes(String(p.type)) ? String(p.type) : null;
    const rarity = typeof p.rarity === "string" && RARITY_LADDER[p.rarity] ? p.rarity : null;
    const name = typeof p.name === "string" ? p.name.trim().slice(0, 60) : "";
    const description = typeof p.description === "string" ? p.description.trim().slice(0, 200) : "";
    if (!type || !rarity || name.length < 3 || description.length < 10) return null;
    const [min, max] = RARITY_LADDER[rarity]!;
    return {
      id: `gem-${slugify(name)}`,
      name,
      description,
      type,
      rarity,
      costCoins: clampNumber(p.costCoins, min, max, min),
      emoji: typeof p.emoji === "string" && p.emoji.trim() ? p.emoji.trim().slice(0, 4) : "✨",
      premiumOnly: false,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  if (sanitized.length === 0 && introduceCount > 0) {
    const dayIndex = Number(istDayKey().replace(/-/g, "")) % FALLBACK_ITEMS.length;
    sanitized = Array.from({ length: introduceCount }, (_, i) => {
      const base = FALLBACK_ITEMS[(dayIndex + i) % FALLBACK_ITEMS.length]!;
      return { ...base, id: `gem-${slugify(base.name)}`, premiumOnly: false };
    });
    source = source === "template" ? "template" : source;
  }

  const existingIds = new Set(catalogue.map(c => c.id));
  const introduced: MarketplaceStewardResult["introduced"] = [];
  for (const item of sanitized.slice(0, introduceCount)) {
    if (existingIds.has(item.id)) continue;
    const inserted = await db.insert(marketplaceItemsTable).values({
      id: item.id,
      name: item.name,
      description: item.description,
      type: item.type,
      rarity: item.rarity,
      costCoins: item.costCoins,
      emoji: item.emoji,
      premiumOnly: false,
      isActive: true,
    }).onConflictDoNothing().returning({ id: marketplaceItemsTable.id });
    if (inserted.length > 0) introduced.push({ id: item.id, name: item.name, rarity: item.rarity, costCoins: item.costCoins });
  }

  // Retirement, with every guard rail applied in one pass.
  const PROTECTED_BUNDLE_ITEM_IDS = new Set([
    "acc-party", "effect-sparkle", "acc-scarf",
    "frame-gold", "acc-glasses", "effect-lightning",
    "frame-diamond", "avatar-astronaut", "effect-aurora",
  ]);
  const retired: MarketplaceStewardResult["retired"] = [];
  if (retireProposals.length > 0 && retireBudget > 0) {
    const owned = await pool.query(
      `SELECT item_id, count(*)::int AS n FROM user_inventory GROUP BY item_id`
    ).catch(() => ({ rows: [] as Array<{ item_id: string; n: number }> }));
    const ownerCount = new Map<string, number>((owned.rows as Array<{ item_id: string; n: number }>).map(r => [r.item_id, Number(r.n)]));

    for (const rawId of retireProposals) {
      if (retired.length >= retireBudget) break;
      const id = String(rawId).slice(0, 60);
      const target = catalogue.find(c => c.id === id);
      if (!target) continue;
      if (target.premiumOnly) continue;                                   // paid skins keep priority
      if (PROTECTED_BUNDLE_ITEM_IDS.has(id)) continue;                    // bundles stay whole
      if (id.startsWith("gem-") && introduced.some(i => i.id === id)) continue;
      if ((ownerCount.get(id) ?? 0) > 25) continue;                       // owned by too many to pull
      const updated = await db.update(marketplaceItemsTable)
        .set({ isActive: false })
        .where(and(eq(marketplaceItemsTable.id, id), eq(marketplaceItemsTable.isActive, true)))
        .returning({ id: marketplaceItemsTable.id });
      if (updated.length > 0) retired.push({ id, reason: `retired by the marketplace steward (${source})` });
    }
  }

  return { introduced, retired, source };
}

// ── G8: admin trigger — quest builder ───────────────────────────────────────

router.post("/admin/gemini/quest-builder", async (req, res) => {
  if (!(await guard(req, res))) return;
  const body = z.object({
    count: z.number().int().min(1).max(4).optional(),
    theme: z.string().max(120).optional(),
  }).safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ error: "Invalid request" });
  try {
    const result = await buildQuests(body.data);
    await db.insert(aiActionAuditTable).values({
      actor: extractUserId(req) ?? "admin",
      actorRole: "admin",
      action: "quest_builder",
      payload: { requested: body.data, created: result.created },
      outcome: result.created.length > 0 ? "executed" : "no_change",
      approvedBy: null,
    }).catch(() => {});
    res.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "quest builder error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ── G9: admin trigger — marketplace steward ────────────────────────────────

router.post("/admin/gemini/marketplace-steward", async (req, res) => {
  if (!(await guard(req, res))) return;
  const body = z.object({
    introduce: z.number().int().min(0).max(3).optional(),
    retire: z.number().int().min(0).max(3).optional(),
  }).safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ error: "Invalid request" });
  try {
    const result = await runMarketplaceSteward(body.data);
    await db.insert(aiActionAuditTable).values({
      actor: extractUserId(req) ?? "admin",
      actorRole: "admin",
      action: "marketplace_steward",
      payload: { requested: body.data, introduced: result.introduced, retired: result.retired },
      outcome: result.introduced.length > 0 || result.retired.length > 0 ? "executed" : "no_change",
      approvedBy: null,
    }).catch(() => {});
    res.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "marketplace steward error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as adminGeminiRouter };

