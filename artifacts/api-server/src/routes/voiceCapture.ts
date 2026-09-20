import { Router, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, goalsTable, tasksTable, voiceCaptureBatchesTable } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { dayKeyInZone } from "../lib/timezone";
import { userZone } from "../lib/userZone";
import { logger } from "../lib/logger";
import { parseVoiceCapture } from "../lib/voiceCapture";

export const voiceCaptureRouter = Router();

const transcriptSchema = z.object({ transcript: z.string().trim().min(1).max(2_000) });
const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}, "Invalid due date");
const draftSchema = z.object({
  kind: z.enum(["task", "goal"]),
  title: z.string().trim().min(1).max(500),
  dueDate: dateKeySchema.nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(1_440).nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  category: z.string().trim().min(1).max(50).default("General"),
  recurring: z.string().trim().max(20).nullable().optional(),
  description: z.string().trim().max(300).nullable().optional(),
});
const commitSchema = transcriptSchema.extend({
  idempotencyKey: z.string().trim().min(12).max(100),
  items: z.array(draftSchema).min(1).max(12),
});

voiceCaptureRouter.post("/voice-capture/parse", authMiddleware, async (req: AuthRequest, res: Response) => {
  const parsed = transcriptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Say or type something to plan (maximum 2,000 characters)." } });
    return;
  }
  try {
    const zone = await userZone(req.userId);
    const today = dayKeyInZone(Date.now(), zone);
    const items = parseVoiceCapture(parsed.data.transcript, today);
    res.json({ transcript: parsed.data.transcript, today, timezone: zone, items });
  } catch (err) {
    logger.error({ err }, "voice capture parse error");
    res.status(500).json({ error: { code: "PARSE_FAILED", message: "FocusArx could not structure that plan. Your transcript has not been saved." } });
  }
});

voiceCaptureRouter.post("/voice-capture/commit", authMiddleware, async (req: AuthRequest, res: Response) => {
  const parsed = commitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Review the items and try again." } });
    return;
  }
  const { transcript, idempotencyKey, items } = parsed.data;
  if (items.some((item) => item.kind === "goal" && item.title.length > 100)) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Goal titles must be 100 characters or fewer." } });
    return;
  }

  try {
    const outcome = await db.transaction(async (tx) => {
      const batchId = crypto.randomUUID();
      const [claimed] = await tx.insert(voiceCaptureBatchesTable).values({
        id: batchId,
        userId: req.userId,
        idempotencyKey,
        transcript,
        result: { taskIds: [], goalIds: [], createdCount: 0 },
      }).onConflictDoNothing({
        target: [voiceCaptureBatchesTable.userId, voiceCaptureBatchesTable.idempotencyKey],
      }).returning({ id: voiceCaptureBatchesTable.id });

      if (!claimed) {
        const [previous] = await tx.select().from(voiceCaptureBatchesTable).where(and(
          eq(voiceCaptureBatchesTable.userId, req.userId),
          eq(voiceCaptureBatchesTable.idempotencyKey, idempotencyKey),
        )).limit(1);
        if (!previous) throw new Error("Idempotency batch conflict did not resolve");
        return { ...previous.result, replayed: true };
      }

      const taskRows = items.filter((item) => item.kind === "task").map((item) => ({
        id: crypto.randomUUID(), userId: req.userId, text: item.title, completed: false,
        estimatedMinutes: item.estimatedMinutes ?? null, category: item.category,
        priority: item.priority, tags: ["voice-capture"], dueDate: item.dueDate ?? null,
        recurring: item.recurring ?? null, status: "active",
      }));
      const goalRows = items.filter((item) => item.kind === "goal").map((item) => ({
        id: crypto.randomUUID(), userId: req.userId, title: item.title,
        description: item.description ?? null, completed: false,
      }));
      if (taskRows.length) await tx.insert(tasksTable).values(taskRows);
      if (goalRows.length) await tx.insert(goalsTable).values(goalRows);
      const result = { taskIds: taskRows.map((row) => row.id), goalIds: goalRows.map((row) => row.id), createdCount: items.length };
      await tx.update(voiceCaptureBatchesTable).set({ result }).where(eq(voiceCaptureBatchesTable.id, batchId));
      return { ...result, replayed: false };
    });
    res.status(outcome.replayed ? 200 : 201).json(outcome);
  } catch (err) {
    logger.error({ err }, "voice capture commit error");
    res.status(500).json({ error: { code: "COMMIT_FAILED", message: "Nothing was saved. Review your connection and try again—the same retry will not create duplicates." } });
  }
});
