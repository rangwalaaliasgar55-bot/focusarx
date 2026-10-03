import { pgTable, text, boolean, integer, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable as users } from "./focusarx";

/**
 * Per-user design assignment (the "which design does this account see" record).
 *
 * The redesign workstream shipped several variants of the same surfaces — timer
 * faces, companion art, battle boards — and the choice belongs to the account,
 * not to a build flag: a user picks their own, and an admin can pin one for a
 * user (support, an A/B cohort, a classroom, a screenshot). Two writers on one
 * row is exactly the kind of thing that silently loses data, so the contract is
 * explicit in the columns rather than in the clients:
 *
 *   • `source` says who wrote last ("user" | "admin" | "default").
 *   • `locked` is the admin's pin: while true, the user's own PUT is refused
 *     with a 409 instead of being accepted and then overwritten.
 *
 * Every value is validated against the server catalog in
 * `api-server/lib/appearanceCatalog.ts` before it reaches this table, so an
 * unknown id can never be stored — a bad id would otherwise only surface as a
 * blank stage on the user's screen.
 *
 * No row means "no explicit choice": readers fall back to the catalog default,
 * which keeps the table small (only accounts that changed something) and means
 * adding a field later does not need a backfill.
 */
export const userAppearanceTable = pgTable("user_appearance", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  /** Timer face id — see TIMER_FACE_IDS in the api-server catalog. */
  timerFace: text("timer_face").notNull().default("classic"),
  /** Companion art pack: classic | wild3d | sprite. */
  petDesign: text("pet_design").notNull().default("classic"),
  /** Battle board design: duel | arena | retro. */
  battleDesign: text("battle_design").notNull().default("duel"),
  /** Workspace layout: quiet | studio | compact. */
  layout: text("layout").notNull().default("quiet"),
  /** App frame: sidebar | topbar | tabs — the shell the whole UI is built in. */
  shell: text("shell").notNull().default("sidebar"),
  /** Admin pin. While true the user's own PUT returns 409. */
  locked: boolean("locked").notNull().default(false),
  /** Who wrote the row last. */
  source: text("source").notNull().default("user"),
  /** Admin user id, when the last write came from the console. */
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("user_appearance_locked_idx").on(t.locked),
  check("user_appearance_timer_face_known", sql`${t.timerFace} IN ('classic', 'neon', 'zen', 'flip', 'segments', 'bars', 'dots', 'rounds', 'aurora', 'orbit', 'hourglass', 'companion', 'garden', 'analog', 'wave', 'candle', 'seven')`),
  check("user_appearance_pet_design_known", sql`${t.petDesign} IN ('classic', 'wild3d', 'sprite')`),
  check("user_appearance_battle_design_known", sql`${t.battleDesign} IN ('duel', 'arena', 'retro')`),
  check("user_appearance_layout_known", sql`${t.layout} IN ('quiet', 'studio', 'compact')`),
  check("user_appearance_shell_known", sql`${t.shell} IN ('sidebar', 'topbar', 'tabs')`),
  check("user_appearance_source_known", sql`${t.source} IN ('user', 'admin', 'default')`),
]);

export type UserAppearance = typeof userAppearanceTable.$inferSelect;

/**
 * Pet battle log.
 *
 * The arena is a client-side simulation (it has to be: it is animated, it is
 * pausable, and it never touches another account), so the row written here is
 * the *result* of a fight, not its authority. That shapes the columns: they
 * record what the board showed — species, levels, the design pack in play and
 * the outcome — so the admin console can answer "which battle design is
 * actually being used, and is anyone winning" without trusting a client for
 * anything that carries value. No currency, XP or inventory is derived from
 * this table; it is a log.
 */
export const petBattlesTable = pgTable("pet_battles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** Player side. */
  petSlug: text("pet_slug").notNull(),
  petName: text("pet_name"),
  petLevel: integer("pet_level").notNull().default(1),
  /** Opponent side. */
  rivalSlug: text("rival_slug").notNull(),
  rivalName: text("rival_name").notNull(),
  rivalLevel: integer("rival_level").notNull().default(1),
  /** Difficulty band the rival was drawn from: easy | normal | hard. */
  difficulty: text("difficulty").notNull().default("normal"),
  /** Battle board design in play when the fight was fought. */
  design: text("design").notNull().default("duel"),
  /**
   * Arena cup fought, 1–6 (the ladder ported from the PR #99 uploads), or null
   * for a pick-up fight. Nothing is derived from this column — it exists so the
   * console can say *which cup* a fight was, not only that one happened.
   */
  stage: integer("stage"),
  /** win | loss | flee */
  result: text("result").notNull(),
  rounds: integer("rounds").notNull().default(0),
  damageDealt: integer("damage_dealt").notNull().default(0),
  damageTaken: integer("damage_taken").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("pet_battles_user_idx").on(t.userId, t.createdAt),
  index("pet_battles_design_idx").on(t.design),
  check("pet_battles_result_known", sql`${t.result} IN ('win', 'loss', 'flee')`),
  check("pet_battles_design_known", sql`${t.design} IN ('duel', 'arena', 'retro')`),
  check("pet_battles_difficulty_known", sql`${t.difficulty} IN ('easy', 'normal', 'hard')`),
  check("pet_battles_levels_sane", sql`${t.petLevel} >= 1 AND ${t.rivalLevel} >= 1`),
  check("pet_battles_rounds_non_negative", sql`${t.rounds} >= 0`),
  check("pet_battles_stage_known", sql`${t.stage} IS NULL OR (${t.stage} >= 1 AND ${t.stage} <= 6)`),
]);

export type PetBattle = typeof petBattlesTable.$inferSelect;
export type NewPetBattle = typeof petBattlesTable.$inferInsert;
