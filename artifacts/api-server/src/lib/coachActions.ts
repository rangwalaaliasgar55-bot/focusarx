/**
 * The coach's hands.
 *
 * Until now every AI surface in FocusArx could only *talk*. Ask it to "add
 * revising thermodynamics to my tasks for tomorrow" and the best possible
 * outcome was a fluent paragraph telling you to add it yourself — which is
 * exactly the complaint: "gemini doesnt work does not do taks does nto dow hat
 * asked". A coach that describes work while the student does it is a search
 * engine with a personality.
 *
 * This module closes that gap with a closed set of *actions* the model may
 * request, and a server-side executor that validates and performs them:
 *
 *   create_task      → a row in `tasks` (title, estimate, priority, due date)
 *   create_goal      → a row in `goals`
 *   complete_task    → marks the user's best-matching open task done
 *   start_session    → returns a client instruction (the timer starts in the
 *                      browser, never on the server)
 *
 * Three rules make this safe to run on model output:
 *
 *   1. **Closed set.** `parseActionsFromModel` drops anything that is not in the
 *      enum above — a hallucinated `delete_account` or `award_coins` has no
 *      code path to reach, and unknown keys never become SQL.
 *   2. **Bounded values.** Titles are clamped, estimates are 5–480 minutes,
 *      priority is whitelisted, due dates must be real `YYYY-MM-DD` calendar
 *      days, and a single message may request at most `MAX_ACTIONS` actions.
 *   3. **Every action is the student's own.** All writes are scoped to the
 *      authenticated `userId`; nothing here can read or touch another account.
 *
 * It also has a deterministic front door. `parseActionsFromText` recognises the
 * same instructions in plain English, so the feature works with **no AI key at
 * all** — "add task read chapter 4, start a 25 minute session" becomes the same
 * two actions. That path is what makes "the AI does real work" true on a
 * deployment where every provider is down.
 */
import { z } from "zod";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { db, goalsTable, tasksTable } from "@workspace/db";
import { logger } from "./logger";
import { shiftDayKey } from "./timezone";

export const MAX_ACTIONS = 5;

export const COACH_PRIORITIES = ["low", "medium", "high"] as const;
export type CoachPriority = (typeof COACH_PRIORITIES)[number];

const dueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day!));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month! - 1 &&
      date.getUTCDate() === day
    );
  }, "dueDate must be a real calendar day");

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_task"),
    title: z.string().trim().min(1).max(200),
    estimatedMinutes: z.number().int().min(5).max(480).nullable().optional(),
    priority: z.enum(COACH_PRIORITIES).optional(),
    dueDate: dueDateSchema.nullable().optional(),
    category: z.string().trim().min(1).max(50).optional(),
  }),
  z.object({
    type: z.literal("create_goal"),
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(300).nullable().optional(),
  }),
  z.object({
    type: z.literal("complete_task"),
    title: z.string().trim().min(2).max(200),
  }),
  z.object({
    type: z.literal("start_session"),
    minutes: z.number().int().min(5).max(240),
    label: z.string().trim().max(120).nullable().optional(),
  }),
]);

export type CoachAction = z.infer<typeof actionSchema>;

/** What the executor reports back, and what the panel renders as chips. */
export interface ExecutedAction {
  type: CoachAction["type"];
  /** One line a student can read: what actually happened. */
  summary: string;
  ok: boolean;
  /** Set for row-creating actions, so the client can highlight them. */
  id?: string;
  /** Present only for `start_session`: the client starts the timer. */
  client?: { minutes: number; label: string | null };
}

/**
 * The contract handed to the model, in the system prompt.
 *
 * JSON mode is requested on the provider call, and the schema is repeated in
 * prose because models follow a schema they can see far more reliably than one
 * they must infer from the word "JSON". The explicit "never invent an action"
 * line matters: a model that cannot do something must say so, not emit a
 * plausible-looking call the server will silently drop.
 */
export const COACH_ACTION_CONTRACT = [
  "You may also DO things for the user, not only advise. Reply as strict JSON:",
  '{"reply": "<your answer, plain text>", "actions": [ ... ]}',
  "Allowed actions (0 to 5, omit the array or leave it empty for a normal answer):",
  '{"type":"create_task","title":"...","estimatedMinutes":25,"priority":"low|medium|high","dueDate":"YYYY-MM-DD"}',
  '{"type":"create_goal","title":"...","description":"..."}',
  '{"type":"complete_task","title":"<exact title from the user\'s open tasks>"}',
  '{"type":"start_session","minutes":25,"label":"what they will work on"}',
  "Use `start_session` only when the user asks to start/focus now. Use `complete_task`",
  "only with a title that appears in the OPEN TASKS list below — never guess a title.",
  "Never invent an action type. If the request needs something outside this list, do it",
  "in `reply` prose instead. The `reply` must still answer the question on its own.",
].join("\n");

/**
 * Parse the model's JSON reply.
 *
 * Models wrap JSON in prose and code fences even when told not to, so the
 * extraction is tolerant (first `{` to last `}`) and the failure mode is
 * graceful: unparsable output is an answer with no actions, never an error. A
 * partially valid array keeps the actions that validate — losing the good ones
 * because one was malformed would reintroduce "it ignored what I asked".
 */
export function parseActionsFromModel(raw: string): { reply: string; actions: CoachAction[] } {
  const fallbackReply = raw.trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return { reply: fallbackReply, actions: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { reply: fallbackReply, actions: [] };
  }
  if (!parsed || typeof parsed !== "object") return { reply: fallbackReply, actions: [] };

  const record = parsed as { reply?: unknown; actions?: unknown };
  const reply =
    typeof record.reply === "string" && record.reply.trim() ? record.reply.trim() : fallbackReply;
  const requested = Array.isArray(record.actions) ? record.actions : [];
  const actions: CoachAction[] = [];
  for (const candidate of requested.slice(0, MAX_ACTIONS * 2)) {
    const result = actionSchema.safeParse(candidate);
    if (result.success) actions.push(result.data);
    else logger.warn({ candidate }, "coach action rejected by validation");
    if (actions.length >= MAX_ACTIONS) break;
  }
  return { reply: reply || "Done.", actions };
}

/**
 * The deterministic reader: plain English in, the same actions out.
 *
 * This is the guarantee that survives a dead model, an exhausted budget or a
 * deployment with no keys. It is intentionally narrow — an explicit imperative
 * plus a recognisable object ("add task …", "create a goal …", "start a 25
 * minute session", "mark … done") — because a loose parser that guesses at
 * ambiguous sentences would create tasks nobody asked for.
 *
 * `today` is the student's local day key, used to resolve "tomorrow" and "on
 * friday" the way they would say it.
 */
export function parseActionsFromText(text: string, today: string): CoachAction[] {
  const actions: CoachAction[] = [];
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return actions;

  /**
   * Split *only* where the next clause begins with its own instruction verb.
   *
   * "add task read chapter 4 and start a 25 minute session" is two requests, but
   * "add task revise physics and chemistry" is one task whose title contains
   * "and" — a naive `split(" and ")` silently truncates the second one. Requiring
   * an imperative verb after the conjunction keeps both readings correct.
   */
  const clauses = cleaned.split(
    /\s+(?:and then|then|and|also)\s+(?=(?:add|create|new|set up|set|note|remind me to|remember to|start|begin|run|mark|complete|finish|tick off)\b)/i,
  );

  const minutePattern = /(\d{1,3})\s*(?:-|\s)?\s*(?:min|minute|minutes)\b/i;
  const hourPattern = /(\d{1,2})\s*(?:-|\s)?\s*(?:hour|hours|hr|hrs)\b/i;

  /** A duration the rest of the product would accept, or null. */
  const readingOf = (chunk: string): number | null => {
    const mins = minutePattern.exec(chunk);
    if (mins) {
      const value = Number(mins[1]);
      if (value >= 5 && value <= 240) return value;
    }
    const hours = hourPattern.exec(chunk);
    if (hours) {
      const value = Number(hours[1]) * 60;
      if (value >= 5 && value <= 240) return value;
    }
    return null;
  };

  const dueDateOf = (chunk: string): string | null => {
    if (/\btomorrow\b/i.test(chunk)) return shiftDayKey(today, 1);
    if (/\btoday\b/i.test(chunk)) return today;
    if (/\bnext week\b/i.test(chunk)) return shiftDayKey(today, 7);
    const weekday = /\b(?:on|by|due)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.exec(chunk);
    if (weekday) {
      const names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const target = names.indexOf(weekday[1]!.toLowerCase());
      const [year, month, day] = today.split("-").map(Number);
      const current = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
      const offset = ((target - current + 7) % 7) || 7;
      return shiftDayKey(today, offset);
    }
    return null;
  };

  /** Remove the scheduling words from a title so "Revise physics for 45 minutes tomorrow" reads like a task. */
  const stripTail = (value: string): string =>
    value
      .replace(/\b(?:for|in)\s+\d{1,3}\s*(?:min|minute|minutes|hour|hours|hr|hrs)\b/gi, " ")
      .replace(/\b(?:today|tomorrow|next week)\b/gi, " ")
      .replace(/\b(?:on|by|due)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, " ")
      .replace(/\b(?:low|medium|high)\s+priority\b/gi, " ")
      .replace(/[\s,;]+$/, "")
      .replace(/\s+/g, " ")
      .trim();

  for (const clause of clauses) {
    if (actions.length >= MAX_ACTIONS) break;

    // 1. An explicit instruction to start focusing.
    const sessionMatch = /\b(?:start|begin|run|do)\s+(?:a|an|another)?\s*([a-z0-9\s-]{0,40}?)\s*(?:focus\s*)?(?:session|block|timer|pomodoro)\b([^.;]*)/i.exec(clause);
    if (sessionMatch) {
      const label = (sessionMatch[2] ?? "").replace(/^\s*(?:on|for|about|to)\s+/i, "").trim();
      actions.push({
        type: "start_session",
        minutes: readingOf(clause) ?? 25,
        label: label ? label.slice(0, 120) : null,
      });
      continue;
    }

    // 2. A goal — checked before tasks, because "create a goal to revise" also
    //    matches the task pattern ("create" + an object) and used to be filed as
    //    a task named "goal to revise…".
    const goalMatch = /\b(?:(?:create|add|set)\s+(?:a\s+)?goal|my goal is)\s*(?:to\s+|called\s+|named\s+)?([^.;]+)/i.exec(clause);
    if (goalMatch) {
      const title = stripTail(goalMatch[1]!);
      if (title.length >= 2 && title.length <= 100) {
        actions.push({ type: "create_goal", title });
        continue;
      }
    }

    // 3. Marking something done.
    // Anchored: "add task finish the essay on friday" begins with "add", so it
    // is a task to create, not a task to close. Only a clause that *opens* with
    // the marking verb (optionally after "I"/"I've") means done.
    const doneMatch = /^\s*(?:i\s+|i've\s+|i have\s+|please\s+)?(?:mark|completed?|finish(?:ed)?|done with|tick off)\s+(?:the\s+|task\s+|my\s+)?([^.;]+?)\s*(?:as\s+)?(?:done|complete|finished)?\b\s*$/i.exec(clause);
    if (doneMatch) {
      const title = stripTail(doneMatch[1]!).replace(/^["“']|["”']$/g, "").trim();
      if (title.length >= 2 && !/^(?:it|that|this|good|great)$/i.test(title)) {
        actions.push({ type: "complete_task", title: title.slice(0, 200) });
        continue;
      }
    }

    // 4. A task. Requires an explicit task noun or a reminder verb, so advice
    //    ("make a plan for tomorrow") does not silently create rows.
    const taskMatch = /\b(?:add|create|new|set up|note|remind me to|remember to)\s*(?:a\s+)?(?:task|todo|to-do|reminder)\b\s*(?:to\s+|called\s+|named\s+)?([^.;]+)/i.exec(clause)
      ?? /\b(?:remind me to|remember to)\s+([^.;]+)/i.exec(clause);
    if (taskMatch) {
      const title = stripTail(taskMatch[1]!);
      if (title.length >= 2) {
        actions.push({
          type: "create_task",
          title: title.slice(0, 200),
          estimatedMinutes: readingOf(taskMatch[1]!),
          priority: /\bhigh priority\b/i.test(clause) ? "high" : /\blow priority\b/i.test(clause) ? "low" : "medium",
          dueDate: dueDateOf(taskMatch[1]!) ?? dueDateOf(clause),
          category: "General",
        });
      }
    }
  }

  return actions.slice(0, MAX_ACTIONS);
}

/**
 * Perform the actions. Returns what actually happened, never a claim.
 *
 * A failure here is reported per-action (`ok: false` plus a sentence) rather
 * than thrown: one bad title must not lose the other four actions, and the
 * reply the student already received stays valid.
 */
export async function executeCoachActions(
  userId: string,
  actions: CoachAction[],
): Promise<ExecutedAction[]> {
  const results: ExecutedAction[] = [];
  for (const action of actions) {
    try {
      switch (action.type) {
        case "create_task": {
          const [row] = await db
            .insert(tasksTable)
            .values({
              userId,
              text: action.title,
              completed: false,
              order: 0,
              estimatedMinutes: action.estimatedMinutes ?? null,
              category: action.category ?? "General",
              priority: action.priority ?? "medium",
              tags: ["coach"],
              dueDate: action.dueDate ?? null,
              status: "active",
            })
            .returning({ id: tasksTable.id });
          results.push({
            type: action.type,
            ok: true,
            id: row?.id,
            summary: action.dueDate
              ? `Added “${action.title}” for ${action.dueDate}`
              : `Added task “${action.title}”`,
          });
          break;
        }
        case "create_goal": {
          const [row] = await db
            .insert(goalsTable)
            .values({ userId, title: action.title, description: action.description ?? null, completed: false })
            .returning({ id: goalsTable.id });
          results.push({ type: action.type, ok: true, id: row?.id, summary: `Created goal “${action.title}”` });
          break;
        }
        case "complete_task": {
          const open = await db
            .select({ id: tasksTable.id, text: tasksTable.text })
            .from(tasksTable)
            .where(and(eq(tasksTable.userId, userId), eq(tasksTable.completed, false)))
            .orderBy(desc(tasksTable.createdAt))
            .limit(200);
          const needle = action.title.toLowerCase();
          const exact = open.filter((task) => task.text.toLowerCase() === needle);
          const partial = exact.length
            ? exact
            : open.filter((task) => task.text.toLowerCase().includes(needle) || needle.includes(task.text.toLowerCase()));
          if (partial.length === 0) {
            results.push({
              type: action.type,
              ok: false,
              summary: `No open task matched “${action.title}” — nothing was changed`,
            });
          } else if (partial.length > 1) {
            // Ambiguity is reported, not guessed at: silently closing the wrong
            // task is worse than asking which one.
            results.push({
              type: action.type,
              ok: false,
              summary: `“${action.title}” matches ${partial.length} open tasks — say which one`,
            });
          } else {
            const target = partial[0]!;
            await db
              .update(tasksTable)
              .set({ completed: true, completedAt: new Date(), status: "completed" })
              .where(and(eq(tasksTable.id, target.id), eq(tasksTable.userId, userId)));
            results.push({ type: action.type, ok: true, id: target.id, summary: `Marked “${target.text}” done` });
          }
          break;
        }
        case "start_session": {
          results.push({
            type: action.type,
            ok: true,
            summary: `Starting a ${action.minutes}-minute block`,
            client: { minutes: action.minutes, label: action.label ?? null },
          });
          break;
        }
      }
    } catch (err) {
      logger.error({ err, type: action.type }, "coach action failed");
      results.push({ type: action.type, ok: false, summary: `Could not finish “${action.type}” — try again` });
    }
  }
  return results;
}

/**
 * The student's own open tasks, for the model's context.
 *
 * Without this the model cannot resolve "mark the physics one done" — it would
 * have to invent a title, and the executor would (correctly) refuse to act on a
 * guess. Titles only: ids are not needed to match, and a model has no business
 * holding database keys.
 */
export async function openTaskTitles(userId: string, limit = 12): Promise<string[]> {
  const rows = await db
    .select({ text: tasksTable.text })
    .from(tasksTable)
    .where(and(eq(tasksTable.userId, userId), eq(tasksTable.completed, false)))
    .orderBy(desc(tasksTable.createdAt))
    .limit(limit);
  return rows.map((row) => row.text);
}

/** Count of open tasks — used by tests and by the "nothing to do" copy path. */
export async function openTaskCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasksTable)
    .where(and(eq(tasksTable.userId, userId), eq(tasksTable.completed, false)));
  return row?.count ?? 0;
}

/** Case-insensitive title search, used by the "did you mean" path. */
export async function findTaskByTitle(userId: string, title: string): Promise<{ id: string; text: string } | null> {
  const [row] = await db
    .select({ id: tasksTable.id, text: tasksTable.text })
    .from(tasksTable)
    .where(and(eq(tasksTable.userId, userId), ilike(tasksTable.text, `%${title}%`)))
    .limit(1);
  return row ?? null;
}
