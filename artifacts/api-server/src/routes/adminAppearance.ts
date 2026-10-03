import { Router, type Response } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, petBattlesTable, userAppearanceTable, usersTable } from "@workspace/db";
import { checkAdminAuth } from "../lib/adminAuth";
import { auditLog, getClientIp } from "../lib/auditLog";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";
import {
  DEFAULT_APPEARANCE,
  LAYOUT_LABELS,
  SHELL_LABELS,
  BATTLE_DESIGN_LABELS,
  PET_DESIGN_LABELS,
  TIMER_FACE_LABELS,
  sanitizeAppearancePatch,
  type TimerFaceId,
  type PetDesignId,
  type BattleDesignId,
  type LayoutId,
  type ShellId,
} from "../lib/appearanceCatalog";

/**
 * Admin console endpoints for the design packs.
 *
 * The question this answers is the one the console could not previously ask:
 * *which design is each account actually on* — and the two writes that follow
 * from it, "pin this account to that design" and "move this cohort, now".
 *
 * Because a user can also write their own row, every admin write records who
 * did it (`updated_by`) and sets `source = 'admin'`; the user-facing route
 * refuses while `locked` is set, so the console is never racing a live tab for
 * the same row. Unlocking is a separate, explicit flag in the same request —
 * "set the design but leave the user free to change it" is a legitimate and
 * common intent (an A/B cohort), so it must not be the accidental result of
 * omitting a field.
 */

const router = Router();
const checkAuth = checkAdminAuth;

/** Label lookups so the console never prints a raw id. */
function labelFor(field: "timerFace" | "petDesign" | "battleDesign" | "layout" | "shell", value: string): string {
  switch (field) {
    case "timerFace":
      return TIMER_FACE_LABELS[value as TimerFaceId] ?? value;
    case "petDesign":
      return PET_DESIGN_LABELS[value as PetDesignId] ?? value;
    case "battleDesign":
      return BATTLE_DESIGN_LABELS[value as BattleDesignId] ?? value;
    case "layout":
      return LAYOUT_LABELS[value as LayoutId] ?? value;
    case "shell":
      return SHELL_LABELS[value as ShellId] ?? value;
  }
}

// GET /api/admin/appearance — every account and the design it is on.
router.get("/admin/appearance", async (req, res: Response) => {
  if (!(await checkAuth(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const pattern = search ? `%${search.replace(/[%_]/g, (m) => `\\${m}`)}%` : null;

  try {
    // Guests and bot personas are excluded the same way /admin/users excludes
    // them, so "unassigned accounts" means real accounts.
    const visible = and(
      eq(usersTable.isGuest, false),
      sql`coalesce(${usersTable.role}, 'user') <> 'bot'`,
      pattern ? sql`(${usersTable.name} ilike ${pattern} or ${usersTable.email} ilike ${pattern})` : sql`true`,
    );

    const [{ value: total }] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(visible);

    const rows = await db
      .select({
        userId: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        timerFace: userAppearanceTable.timerFace,
        petDesign: userAppearanceTable.petDesign,
        battleDesign: userAppearanceTable.battleDesign,
        layout: userAppearanceTable.layout,
        shell: userAppearanceTable.shell,
        locked: userAppearanceTable.locked,
        source: userAppearanceTable.source,
        updatedBy: userAppearanceTable.updatedBy,
        updatedAt: userAppearanceTable.updatedAt,
      })
      .from(usersTable)
      .leftJoin(userAppearanceTable, eq(userAppearanceTable.userId, usersTable.id))
      .where(visible)
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset);

    /**
     * The assignment view: what the account renders, whether or not a row
     * exists. `assigned` is false for accounts still on the catalog defaults —
     * the console draws that distinction because "nobody has chosen" and
     * "someone chose Classic" are different facts.
     */
    const users = rows.map((row) => ({
      userId: row.userId,
      name: row.name,
      email: row.email,
      assigned: row.timerFace !== null,
      locked: row.locked ?? false,
      source: row.source ?? "default",
      updatedBy: row.updatedBy ?? null,
      updatedAt: row.updatedAt ?? null,
      appearance: {
        timerFace: row.timerFace ?? DEFAULT_APPEARANCE.timerFace,
        petDesign: row.petDesign ?? DEFAULT_APPEARANCE.petDesign,
        battleDesign: row.battleDesign ?? DEFAULT_APPEARANCE.battleDesign,
        layout: row.layout ?? DEFAULT_APPEARANCE.layout,
        shell: row.shell ?? DEFAULT_APPEARANCE.shell,
      },
      labels: {
        timerFace: labelFor("timerFace", row.timerFace ?? DEFAULT_APPEARANCE.timerFace),
        petDesign: labelFor("petDesign", row.petDesign ?? DEFAULT_APPEARANCE.petDesign),
        battleDesign: labelFor("battleDesign", row.battleDesign ?? DEFAULT_APPEARANCE.battleDesign),
        layout: labelFor("layout", row.layout ?? DEFAULT_APPEARANCE.layout),
        shell: labelFor("shell", row.shell ?? DEFAULT_APPEARANCE.shell),
      },
    }));

    // Distribution across the visible window's page — cheap and exact for the
    // page being rendered; the console labels it as such rather than implying
    // a whole-table census.
    const distribution = {
      timerFace: countBy(users.map((u) => u.appearance.timerFace)),
      petDesign: countBy(users.map((u) => u.appearance.petDesign)),
      battleDesign: countBy(users.map((u) => u.appearance.battleDesign)),
      layout: countBy(users.map((u) => u.appearance.layout)),
      shell: countBy(users.map((u) => u.appearance.shell)),
      locked: users.filter((u) => u.locked).length,
      unassigned: users.filter((u) => !u.assigned).length,
    };

    // Battle usage, grouped by design, so "which board is actually played"
    // is answerable without reading the per-user rows.
    const battleUsage = await db
      .select({
        design: petBattlesTable.design,
        battles: sql<number>`count(*)::int`,
        wins: sql<number>`count(*) filter (where ${petBattlesTable.result} = 'win')::int`,
        players: sql<number>`count(distinct ${petBattlesTable.userId})::int`,
      })
      .from(petBattlesTable)
      .groupBy(petBattlesTable.design);

    res.json({ users, total, page, limit, distribution, battleUsage });
  } catch (err) {
    logger.error({ err }, "admin appearance list error");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/admin/appearance/battles — the cross-account battle log.
router.get("/admin/appearance/battles", async (req, res: Response) => {
  if (!(await checkAuth(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  try {
    const battles = await db
      .select({
        id: petBattlesTable.id,
        userId: petBattlesTable.userId,
        userName: usersTable.name,
        petSlug: petBattlesTable.petSlug,
        petName: petBattlesTable.petName,
        petLevel: petBattlesTable.petLevel,
        rivalSlug: petBattlesTable.rivalSlug,
        rivalName: petBattlesTable.rivalName,
        rivalLevel: petBattlesTable.rivalLevel,
        difficulty: petBattlesTable.difficulty,
        design: petBattlesTable.design,
        // The ladder cup, when the fight was one — the console prints the cup's
        // name from the client's ladder, so this stays a plain number here.
        stage: petBattlesTable.stage,
        result: petBattlesTable.result,
        rounds: petBattlesTable.rounds,
        damageDealt: petBattlesTable.damageDealt,
        damageTaken: petBattlesTable.damageTaken,
        createdAt: petBattlesTable.createdAt,
      })
      .from(petBattlesTable)
      .leftJoin(usersTable, eq(usersTable.id, petBattlesTable.userId))
      .orderBy(desc(petBattlesTable.createdAt))
      .limit(limit);

    res.json({ battles });
  } catch (err) {
    logger.error({ err }, "admin battles error");
    res.status(500).json({ error: "Internal error" });
  }
});

// PUT /api/admin/appearance/:userId — pin one account's design.
router.put("/admin/appearance/:userId", async (req, res: Response) => {
  if (!(await checkAuth(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { userId } = req.params;
  const { patch, invalid } = sanitizeAppearancePatch(req.body);
  if (invalid.length > 0) {
    res.status(400).json({ error: "Invalid value", fields: invalid });
    return;
  }
  // `locked` is tri-state on purpose: absent keeps the current pin, true pins,
  // false releases. "Assign but leave them free" must be something the caller
  // says out loud.
  const rawLocked = (req.body as { locked?: unknown })?.locked;
  if (rawLocked !== undefined && typeof rawLocked !== "boolean") {
    res.status(400).json({ error: "Invalid value", fields: ["locked"] });
    return;
  }
  const wantsLock = typeof rawLocked === "boolean" ? rawLocked : null;

  try {
    const [target] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [existing] = await db
      .select()
      .from(userAppearanceTable)
      .where(eq(userAppearanceTable.userId, userId))
      .limit(1);

    const locked = wantsLock ?? existing?.locked ?? false;
    const [row] = await db
      .insert(userAppearanceTable)
      .values({
        userId,
        timerFace: patch.timerFace ?? existing?.timerFace ?? DEFAULT_APPEARANCE.timerFace,
        petDesign: patch.petDesign ?? existing?.petDesign ?? DEFAULT_APPEARANCE.petDesign,
        battleDesign: patch.battleDesign ?? existing?.battleDesign ?? DEFAULT_APPEARANCE.battleDesign,
        layout: patch.layout ?? existing?.layout ?? DEFAULT_APPEARANCE.layout,
        shell: patch.shell ?? existing?.shell ?? DEFAULT_APPEARANCE.shell,
        locked,
        source: "admin",
        updatedBy: extractUserId(req) ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userAppearanceTable.userId,
        set: { ...patch, locked, source: "admin", updatedBy: extractUserId(req) ?? null, updatedAt: new Date() },
      })
      .returning();

    auditLog({
      action: "admin_design_assign",
      userId,
      ip: getClientIp(req),
      details: { patch, locked, actor: extractUserId(req) },
    });

    res.json({
      user: { userId, locked: row.locked, source: row.source, updatedAt: row.updatedAt },
      appearance: {
        timerFace: row.timerFace,
        petDesign: row.petDesign,
        battleDesign: row.battleDesign,
        layout: row.layout,
        shell: row.shell,
      },
      labels: {
        timerFace: labelFor("timerFace", row.timerFace),
        petDesign: labelFor("petDesign", row.petDesign),
        battleDesign: labelFor("battleDesign", row.battleDesign),
        layout: labelFor("layout", row.layout),
        shell: labelFor("shell", row.shell),
      },
    });
  } catch (err) {
    logger.error({ err }, "admin appearance update error");
    res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /api/admin/appearance/:userId — release an account back to defaults.
router.delete("/admin/appearance/:userId", async (req, res: Response) => {
  if (!(await checkAuth(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { userId } = req.params;
  try {
    const deleted = await db
      .delete(userAppearanceTable)
      .where(eq(userAppearanceTable.userId, userId))
      .returning({ userId: userAppearanceTable.userId });
    auditLog({
      action: "admin_design_reset",
      userId,
      ip: getClientIp(req),
      details: { existed: deleted.length > 0, actor: extractUserId(req) },
    });
    res.json({ ok: true, cleared: deleted.length > 0 });
  } catch (err) {
    logger.error({ err }, "admin appearance delete error");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /api/admin/appearance/bulk — move a cohort at once.
router.post("/admin/appearance/bulk", async (req, res: Response) => {
  if (!(await checkAuth(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const body = (req.body ?? {}) as { userIds?: unknown; all?: unknown; locked?: unknown; dryRun?: unknown };
  const { patch, invalid } = sanitizeAppearancePatch(req.body);
  if (invalid.length > 0) {
    res.status(400).json({ error: "Invalid value", fields: invalid });
    return;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No known fields to update" });
    return;
  }
  if (body.locked !== undefined && typeof body.locked !== "boolean") {
    res.status(400).json({ error: "Invalid value", fields: ["locked"] });
    return;
  }

  const applyToAll = body.all === true;
  const requestedIds = Array.isArray(body.userIds)
    ? body.userIds.filter((v): v is string => typeof v === "string")
    : [];
  if (!applyToAll && requestedIds.length === 0) {
    res.status(400).json({ error: "Provide userIds or all: true" });
    return;
  }
  if (requestedIds.length > 5000) {
    res.status(400).json({ error: "Too many userIds (max 5000)" });
    return;
  }

  try {
    // Guests and bot personas are excluded for `all`, the same way the list
    // endpoint excludes them: an admin sweeping "everyone" does not mean the
    // seeded personas, and their rows would only pollute the distribution
    // charts.
    const targetWhere = applyToAll
      ? and(eq(usersTable.isGuest, false), sql`coalesce(${usersTable.role}, 'user') <> 'bot'`)
      : inArray(usersTable.id, requestedIds);

    const targets = await db.select({ id: usersTable.id }).from(usersTable).where(targetWhere).limit(20_000);
    const ids = targets.map((t) => t.id);
    const affected = ids.length;

    // "All users" is one click away from a mistake, so the console shows the
    // blast radius first: a dry run counts the real targets and writes nothing.
    if (body.dryRun === true) {
      res.json({ ok: true, dryRun: true, affected, patch });
      return;
    }
    if (affected === 0) {
      res.json({ ok: true, affected: 0, patch });
      return;
    }

    // Read the existing rows so a partial patch keeps each account's other
    // choices. Doing it per chunk rather than one giant IN keeps every query
    // inside the parameter limits a proxy will allow.
    const existing = new Map<string, typeof userAppearanceTable.$inferSelect>();
    for (const chunk of chunked(ids, 500)) {
      const rows = await db.select().from(userAppearanceTable).where(inArray(userAppearanceTable.userId, chunk));
      for (const row of rows) existing.set(row.userId, row);
    }

    const actor = extractUserId(req) ?? null;
    const lockedFor = (userId: string) =>
      typeof body.locked === "boolean" ? body.locked : existing.get(userId)?.locked ?? false;

    const values = ids.map((userId) => {
      const current = existing.get(userId);
      return {
        userId,
        timerFace: patch.timerFace ?? current?.timerFace ?? DEFAULT_APPEARANCE.timerFace,
        petDesign: patch.petDesign ?? current?.petDesign ?? DEFAULT_APPEARANCE.petDesign,
        battleDesign: patch.battleDesign ?? current?.battleDesign ?? DEFAULT_APPEARANCE.battleDesign,
        layout: patch.layout ?? current?.layout ?? DEFAULT_APPEARANCE.layout,
        shell: patch.shell ?? current?.shell ?? DEFAULT_APPEARANCE.shell,
        locked: lockedFor(userId),
        source: "admin",
        updatedBy: actor,
        updatedAt: new Date(),
      };
    });

    for (const chunk of chunked(values, 200)) {
      await db
        .insert(userAppearanceTable)
        .values(chunk)
        .onConflictDoUpdate({
          target: userAppearanceTable.userId,
          set: {
            timerFace: sql`excluded.timer_face`,
            petDesign: sql`excluded.pet_design`,
            battleDesign: sql`excluded.battle_design`,
            layout: sql`excluded.layout`,
            shell: sql`excluded.shell`,
            locked: sql`excluded.locked`,
            source: sql`excluded.source`,
            updatedBy: sql`excluded.updated_by`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }

    auditLog({
      action: "admin_design_bulk",
      ip: getClientIp(req),
      details: { patch, locked: body.locked ?? null, all: applyToAll, requested: requestedIds.length, affected, actor },
    });

    res.json({ ok: true, affected, patch });
  } catch (err) {
    logger.error({ err }, "admin appearance bulk error");
    res.status(500).json({ error: "Internal error" });
  }
});

function chunked<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
}

export { router as adminAppearanceRouter };
