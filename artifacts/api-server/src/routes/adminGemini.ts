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
} from "@workspace/db";
import { eq, and, desc, gte, sql, inArray } from "drizzle-orm";
import { checkAdminAuth } from "../lib/adminAuth";
import { logger } from "../lib/logger";
import { checkBudget, usageByPurpose, estimatedCost, istDayKey } from "../lib/aiBudget";
import { providerAvailability } from "../lib/aiProvider";
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

async function guard(req: Request, res: Response): Promise<boolean> {
  if (!(await checkAdminAuth(req))) {
    sendUnauthorized(res);
    return false;
  }
  return true;
}

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
    res.json({ ok: true, status });
  } catch (err) {
    logger.error({ err }, "gemini idea decision error");
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
  };
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
  let summary = briefingTemplate(stats);
  let source = "template";

  const result = await generateAi({
    purpose: "briefing",
    prompt: `Write a 6-line morning operations briefing for the FocusArx founder from these REAL numbers (no invention, no fluff, IST context, exam-season aware):\n${JSON.stringify(stats, null, 1)}`,
    maxTokens: 300,
  });
  if (result) {
    summary = sanitizeNeverNegative(result.text);
    source = result.provider;
  }

  await db.insert(aiBriefingsTable).values({
    day,
    kind: "daily",
    data: { ...stats, source },
    summary,
  }).onConflictDoNothing();
  await pool.query(
    `INSERT INTO platform_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
    [metaKey, JSON.stringify({ at: new Date().toISOString(), source })]
  );
  return { ok: true as const, briefing: { day, kind: "daily", summary, data: stats, source } };
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

export { router as adminGeminiRouter };
