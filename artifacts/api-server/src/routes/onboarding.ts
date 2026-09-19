/**
 * First-run personalisation — one common flow, a plan that is yours.
 *
 * Everybody answers the same questions (what are you chasing, how much time do
 * you have, when do you study), and the generator turns those answers into the
 * things a new account is otherwise completely empty of: a dream with its
 * system, the first week of tasks, three goals to aim at, and a starter
 * flashcard deck. A brand-new learner should land on a dashboard that already
 * looks like theirs, not on four empty states.
 *
 * Design rules, in order of importance:
 *
 *  1. **Never a blank account.** Every step has a deterministic template
 *     fallback, so the plan is generated with zero AI keys configured. Gemini
 *     is an upgrade on top of the templates, not a dependency.
 *  2. **Idempotent.** The plan is keyed `onboarding_plan_<userId>` in
 *     `platform_meta`. Pressing "generate" twice returns the plan that already
 *     exists instead of stacking duplicate tasks and decks on top of it.
 *  3. **Honest about what it is.** Every generated row is tagged
 *     (`category: "Kickoff"`, `tags: ["onboarding"]`, deck description) so the
 *     learner can tell what they asked for from what we made up on their behalf.
 *  4. **Never destructive.** If the account already has tasks, goals or decks,
 *     those are left alone and reported as `skipped` — onboarding must not
 *     overwrite the state of an account that is already in use.
 */
import { Router, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db, pool, tasksTable, goalsTable, flashcardDecksTable, flashcardsTable,
  userDreamsTable, notificationsTable, platformMetaTable, usersTable,
} from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { generateAi } from "../lib/aiProvider";
import { dayKeyInZone, resolveUserZone } from "../lib/timezone";
import { DREAM_TYPES, DREAM_SYSTEMS } from "../lib/dreamSystems";
import {
  MIN_AI_TASKS, normalizeTasks, planBody, templateCards, templateWeek,
  type KickoffTask,
} from "../lib/onboardingPlan";

export const onboardingRouter = Router();

const PLAN_KEY = (userId: string) => `onboarding_plan_${userId}`;

/**
 * Gemini's version of the template week: concrete to the learner's subject and
 * deadline. Everything it returns is clamped — a hallucinated 900-minute task
 * cannot land in someone's list on day one.
 */
async function generateWeek(dreamType: string, dailyMinutes: number, targetDate: string | null, context: string): Promise<{ tasks: KickoffTask[]; source: string }> {
  const system = DREAM_SYSTEMS[dreamType] ?? DREAM_SYSTEMS.custom!;
  const fallback = { tasks: templateWeek(dreamType, dailyMinutes), source: "template" };
  try {
    const result = await generateAi({
      purpose: "onboarding_plan",
      prompt: `A new FocusArx learner just signed up and told us this: ${context}
Their dream: ${DREAM_TYPES.find(d => d.id === dreamType)?.label ?? dreamType}. Daily study target: ${dailyMinutes} minutes${targetDate ? `. Target date: ${targetDate}` : ""}.
Their plan's shape: ${system.blocks.map(b => `${b.minutes}m ${b.label}`).join(" · ")}.
Write their FIRST WEEK as 6–7 tasks — one per day, each achievable in a single sitting.
Return ONLY a JSON array: [{"text": string (<=140 chars, imperative, specific to their subject/dream), "minutes": number, "priority": "low"|"medium"|"high"}]
Rules: day 1 must be something that can be done today in under an hour; no task longer than ${Math.min(180, dailyMinutes)} minutes; no generic filler like "study hard".`,
      maxTokens: 700,
    });
    if (!result) return fallback;
    const tasks = normalizeTasks(result.text);
    return tasks.length >= MIN_AI_TASKS ? { tasks, source: result.provider } : fallback;
  } catch (err) {
    logger.warn({ err }, "onboarding plan generation failed; using the template week");
    return fallback;
  }
}

/**
 * POST /api/onboarding/personalize
 *
 * Body: dreamType, dailyTargetMinutes, studyWindow, targetDate?, subjects?.
 * Returns the plan it created (or the one that already exists).
 */
onboardingRouter.post("/onboarding/personalize", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const body = (req.body ?? {}) as {
    dreamType?: unknown; dailyTargetMinutes?: unknown; studyWindow?: unknown;
    targetDate?: unknown; subjects?: unknown;
  };

  const { dreamType, dailyTargetMinutes, studyWindow, targetDate, subjects } = planBody(body);

  try {
    // 1. Already generated? Return it. Re-running onboarding is not a second plan.
    const [existingPlan] = await db.select({ value: platformMetaTable.value })
      .from(platformMetaTable).where(eq(platformMetaTable.key, PLAN_KEY(userId))).limit(1);
    if (existingPlan?.value) {
      return res.json({ ok: true, alreadyGenerated: true, plan: existingPlan.value });
    }

    const zone = resolveUserZone((await db.select({ timezone: usersTable.timezone }).from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0]?.timezone);
    const today = dayKeyInZone(Date.now(), zone);
    const type = DREAM_TYPES.find(d => d.id === dreamType) ?? DREAM_TYPES[DREAM_TYPES.length - 1]!;
    const system = DREAM_SYSTEMS[dreamType] ?? DREAM_SYSTEMS.custom!;
    const skipped: string[] = [];

    // 2. The dream itself (upsert — one per user by schema).
    const dreamValues = {
      dreamType,
      targetDate,
      dailyTargetMinutes,
      emoji: type.emoji,
      startDate: today,
      updatedAt: new Date(),
    };
    const [dreamRow] = await db.insert(userDreamsTable)
      .values({ userId, ...dreamValues })
      .onConflictDoUpdate({ target: userDreamsTable.userId, set: dreamValues })
      .returning();

    // 3. Week-one tasks — only if the account has no tasks yet.
    const context = `dream ${dreamType}, ${dailyTargetMinutes} minutes/day, prefers ${studyWindow} sessions${subjects.length ? `, subjects: ${subjects.join(", ")}` : ""}`;
    const existingTasks = await db.select({ value: sql<number>`count(*)::int` }).from(tasksTable).where(eq(tasksTable.userId, userId));
    const week = await generateWeek(dreamType, dailyTargetMinutes, targetDate, context);
    let createdTasks: Array<{ id: string; text: string; estimatedMinutes: number | null }> = [];
    if (Number(existingTasks[0]?.value ?? 0) > 0) {
      skipped.push("tasks");
    } else {
      createdTasks = await db.insert(tasksTable).values(week.tasks.map((t, index) => ({
        userId,
        text: t.text,
        completed: false,
        order: index,
        estimatedMinutes: t.minutes,
        category: t.category,
        priority: t.priority,
        tags: ["onboarding"],
        status: "active",
      }))).returning({ id: tasksTable.id, text: tasksTable.text, estimatedMinutes: tasksTable.estimatedMinutes });
    }

    // 4. Goals from the first milestones of the dream's own system.
    const existingGoals = await db.select({ value: sql<number>`count(*)::int` }).from(goalsTable).where(eq(goalsTable.userId, userId));
    let createdGoals: Array<{ id: string; title: string }> = [];
    if (Number(existingGoals[0]?.value ?? 0) > 0) {
      skipped.push("goals");
    } else {
      createdGoals = await db.insert(goalsTable).values(
        system.milestones.slice(0, 3).map(milestone => ({
          userId,
          title: milestone.slice(0, 160),
          description: `Milestone on the ${type.label} path — ${system.tagline}`,
          completed: false,
        }))
      ).returning({ id: goalsTable.id, title: goalsTable.title });
    }

    // 5. Starter deck.
    const existingDecks = await db.select({ value: sql<number>`count(*)::int` }).from(flashcardDecksTable).where(eq(flashcardDecksTable.userId, userId));
    let createdDeck: { id: string; title: string; cardCount: number } | null = null;
    if (Number(existingDecks[0]?.value ?? 0) > 0) {
      skipped.push("flashcards");
    } else {
      const deckTitle = `${type.label} · Getting started`;
      const [deck] = await db.insert(flashcardDecksTable).values({
        userId,
        title: deckTitle,
        description: `Auto-built during setup: the habits and structure behind your ${type.label} plan.`,
        category: "Kickoff",
      }).returning({ id: flashcardDecksTable.id, title: flashcardDecksTable.title });
      if (deck) {
        const cards = await db.insert(flashcardsTable).values(
          templateCards(dreamType, dailyTargetMinutes).map(card => ({ deckId: deck.id, front: card.front.slice(0, 500), back: card.back.slice(0, 1000) }))
        ).returning({ id: flashcardsTable.id });
        createdDeck = { id: deck.id, title: deck.title, cardCount: cards.length };
      }
    }

    // 6. A welcome that names the plan, so the notification is useful rather
    //    than decorative.
    await db.insert(notificationsTable).values({
      userId,
      type: "system",
      title: `Your ${type.label} plan is ready`,
      message: `Week one: ${createdTasks.length || week.tasks.length} tasks, ${createdGoals.length} milestones, and a starter deck. Today's target is ${dailyTargetMinutes} minutes — start with the first task.`,
    }).catch(() => { /* the plan matters more than the announcement */ });

    const plan = {
      generatedAt: new Date().toISOString(),
      dreamType,
      dreamLabel: type.label,
      emoji: type.emoji,
      dailyTargetMinutes,
      studyWindow,
      subjects: subjects.length > 0 ? subjects : system.subjects.map(s => s.name),
      targetDate,
      source: week.source,
      skipped,
      tasks: createdTasks.map(t => ({ id: t.id, text: t.text, minutes: t.estimatedMinutes })),
      goals: createdGoals,
      deck: createdDeck,
      system: {
        tagline: system.tagline,
        blocks: system.blocks,
        dailyHabit: system.dailyHabit,
        checkIn: system.checkIn,
        nextMilestone: system.milestones[0] ?? null,
      },
      dreamId: dreamRow?.id ?? null,
    };

    await db.insert(platformMetaTable)
      .values({ key: PLAN_KEY(userId), value: plan })
      .onConflictDoUpdate({ target: platformMetaTable.key, set: { value: plan, updatedAt: new Date() } });

    res.status(201).json({ ok: true, alreadyGenerated: false, plan });
  } catch (err) {
    logger.error({ err }, "onboarding personalize error");
    res.status(500).json({ error: "Could not build your plan right now — you can generate it later from the dashboard." });
  }
});

/** GET — the dashboard reads the plan it was given (404-ish shape when absent). */
onboardingRouter.get("/onboarding/plan", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [row] = await db.select({ value: platformMetaTable.value })
      .from(platformMetaTable).where(eq(platformMetaTable.key, PLAN_KEY(req.userId!))).limit(1);
    res.json({ plan: row?.value ?? null });
  } catch (err) {
    logger.error({ err }, "onboarding plan read error");
    res.json({ plan: null });
  }
});

/** Which dream types the generator supports — single source of truth for the UI. */
onboardingRouter.get("/onboarding/dream-options", async (_req, res: Response) => {
  try {
    // Sanity check that the systems map and the type list have not drifted.
    const drift = DREAM_TYPES.filter(t => !DREAM_SYSTEMS[t.id]).map(t => t.id);
    if (drift.length > 0) logger.warn({ drift }, "dream types without a system");
    res.json({
      types: DREAM_TYPES.map(t => ({
        id: t.id,
        label: t.label,
        emoji: t.emoji,
        desc: t.desc,
        suggestedMinutes: t.targetMinutes,
        tagline: DREAM_SYSTEMS[t.id]?.tagline ?? null,
      })),
    });
  } catch {
    res.json({ types: [] });
  }
});

/** Counts for the "your account is still empty" nudge on the dashboard. */
onboardingRouter.get("/onboarding/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const [[tasks], [goals], [decks], [dream]] = await Promise.all([
      db.select({ value: sql<number>`count(*)::int` }).from(tasksTable).where(eq(tasksTable.userId, userId)),
      db.select({ value: sql<number>`count(*)::int` }).from(goalsTable).where(eq(goalsTable.userId, userId)),
      db.select({ value: sql<number>`count(*)::int` }).from(flashcardDecksTable).where(eq(flashcardDecksTable.userId, userId)),
      db.select({ value: sql<number>`count(*)::int` }).from(userDreamsTable).where(eq(userDreamsTable.userId, userId)),
    ]);
    const [plan] = await db.select({ value: platformMetaTable.value })
      .from(platformMetaTable).where(eq(platformMetaTable.key, PLAN_KEY(userId))).limit(1);
    res.json({
      hasPlan: Boolean(plan?.value),
      tasks: Number(tasks?.value ?? 0),
      goals: Number(goals?.value ?? 0),
      decks: Number(decks?.value ?? 0),
      hasDream: Number(dream?.value ?? 0) > 0,
      // "Empty" is the state worth prompting about: nothing to do and no plan yet.
      needsKickoff: !plan?.value && Number(tasks?.value ?? 0) === 0 && Number(goals?.value ?? 0) === 0,
    });
  } catch (err) {
    logger.warn({ err }, "onboarding status error");
    res.json({ hasPlan: false, tasks: 0, goals: 0, decks: 0, hasDream: false, needsKickoff: false });
  }
});

/** Test seam: count rows the generator owns, for the route contract tests. */
export async function countOnboardingRows(userId: string): Promise<number> {
  const r = await pool.query(
    `SELECT count(*)::int AS n FROM tasks WHERE user_id = $1 AND tags @> '["onboarding"]'::jsonb`,
    [userId]
  );
  return Number((r.rows[0] as { n?: number } | undefined)?.n ?? 0);
}
