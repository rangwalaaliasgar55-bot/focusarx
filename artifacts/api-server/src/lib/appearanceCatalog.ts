/**
 * The design-pack catalog, server side.
 *
 * One list, three readers:
 *
 *   • the user endpoints, to validate a write (`sanitizeAppearancePatch`) and to
 *     render the pickers' options (`catalogPayload`);
 *   • the admin endpoints, for the labels its tables print and for the same
 *     write validation;
 *   • the CHECK constraints in `lib/db/src/schema/appearance.ts`, which list
 *     every legal id a third time — on purpose, because the database is the
 *     last line and a bad id there is a blank stage on someone's screen.
 *
 * The four id lists below are the contract. `designPacks.test.ts` (client, which
 * owns the descriptions) asserts that its registry and this file's ids are the
 * same set, so a face added on one side fails on the other until both move.
 *
 * Ids are frozen once shipped: the schema's CHECKs and rows already in the
 * table name them.
 */

export type TimerFaceId =
  | "classic"
  | "neon"
  | "zen"
  | "flip"
  | "segments"
  | "bars"
  | "dots"
  | "rounds"
  | "aurora"
  | "orbit"
  | "hourglass"
  | "companion"
  | "garden"
  | "analog"
  | "wave"
  | "candle"
  | "seven";

export type PetDesignId = "classic" | "wild3d" | "sprite";
export type BattleDesignId = "duel" | "arena" | "retro";
export type LayoutId = "quiet" | "studio" | "compact";

/** The app frame: rail, top bar, or bottom tabs. Mirrors the client's SHELLS. */
export type ShellId = "sidebar" | "topbar" | "tabs";

/** Order is the picker's order: ring faces, then layouts, house before ported. */
export const TIMER_FACE_IDS: TimerFaceId[] = [
  "classic",
  "neon",
  "zen",
  "flip",
  "segments",
  "bars",
  "dots",
  "rounds",
  "aurora",
  "orbit",
  "hourglass",
  "companion",
  "garden",
  "analog",
  "wave",
  "candle",
  "seven",
];

export const SHELL_IDS: ShellId[] = ["sidebar", "topbar", "tabs"];

export const SHELLS: Array<DesignOption<ShellId>> = [
  { id: "sidebar", label: "Sidebar", blurb: "Destinations in a rail on the left, the page header across the top, tabs on phones." },
  { id: "topbar", label: "Top bar", blurb: "No rail: a horizontal row of destinations under the header, and the full width for content." },
  { id: "tabs", label: "Bottom tabs", blurb: "One row of tabs along the bottom at every width, and nothing beside the content." },
];

export const SHELL_LABELS: Record<ShellId, string> = {
  sidebar: "Sidebar",
  topbar: "Top bar",
  tabs: "Bottom tabs",
};

export const TIMER_FACE_LABELS: Record<TimerFaceId, string> = {
  classic: "Classic",
  neon: "Neon",
  zen: "Zen",
  flip: "Flip Clock",
  segments: "Segments",
  bars: "Minute bars",
  dots: "Block grid",
  rounds: "Pomodoro rounds",
  aurora: "Aurora",
  orbit: "Orbit",
  hourglass: "Hourglass",
  companion: "Companion trail",
  garden: "Garden",
  analog: "Analog clock",
  wave: "Wave",
  candle: "Candle",
  seven: "Seven-segment",
};

export interface DesignOption<T extends string> {
  id: T;
  label: string;
  blurb: string;
}

export const PET_DESIGNS: Array<DesignOption<PetDesignId>> = [
  { id: "classic", label: "Studio rig", blurb: "The original posed 3D companion." },
  { id: "wild3d", label: "Wild 3D", blurb: "A procedural body built from the species: ears, tail, wings and colours." },
  { id: "sprite", label: "Sprite only", blurb: "No 3D at all — the flat animated sprite, on every device and every quality setting." },
];

export const PET_DESIGN_LABELS: Record<PetDesignId, string> = {
  classic: "Studio rig",
  wild3d: "Wild 3D",
  sprite: "Sprite only",
};

export const BATTLE_DESIGNS: Array<DesignOption<BattleDesignId>> = [
  { id: "duel", label: "Duel board", blurb: "Two fighters, two bars, a move grid and a battle log." },
  { id: "arena", label: "Session arena", blurb: "The fight is fought on the focus session: the minutes you focus are the damage." },
  { id: "retro", label: "Retro LCD", blurb: "A handheld-console board: monospaced and two-tone, with almost no animation." },
];

export const BATTLE_DESIGN_LABELS: Record<BattleDesignId, string> = {
  duel: "Duel board",
  arena: "Session arena",
  retro: "Retro LCD",
};

export const LAYOUTS: Array<DesignOption<LayoutId>> = [
  { id: "quiet", label: "Quiet", blurb: "One column, nothing crowded: the timer and the companion." },
  { id: "studio", label: "Studio", blurb: "Two columns — workspace on the left, companion and battle board on the right." },
  { id: "compact", label: "Compact", blurb: "The smallest footprint: numbers, no rails, no battle log." },
];

export const LAYOUT_LABELS: Record<LayoutId, string> = {
  quiet: "Quiet",
  studio: "Studio",
  compact: "Compact",
};

export const DEFAULT_APPEARANCE = {
  timerFace: "classic" as TimerFaceId,
  petDesign: "classic" as PetDesignId,
  battleDesign: "duel" as BattleDesignId,
  layout: "quiet" as LayoutId,
  shell: "sidebar" as ShellId,
};

export const APPEARANCE_FIELDS = ["timerFace", "petDesign", "battleDesign", "layout", "shell"] as const;
export type AppearanceField = (typeof APPEARANCE_FIELDS)[number];

export interface AppearanceFields {
  timerFace: TimerFaceId;
  petDesign: PetDesignId;
  battleDesign: BattleDesignId;
  layout: LayoutId;
  shell: ShellId;
}

const IDS: Record<AppearanceField, readonly string[]> = {
  timerFace: TIMER_FACE_IDS,
  petDesign: PET_DESIGNS.map((d) => d.id),
  battleDesign: BATTLE_DESIGNS.map((d) => d.id),
  layout: LAYOUTS.map((l) => l.id),
  shell: SHELL_IDS,
};

export function isAppearanceField(value: string): value is AppearanceField {
  return (APPEARANCE_FIELDS as readonly string[]).includes(value);
}

/** Is `id` a legal value for `field` in *this* build? */
export function isKnownId(field: AppearanceField, id: unknown): boolean {
  return typeof id === "string" && IDS[field].includes(id);
}

export interface SanitizeResult {
  patch: Partial<AppearanceFields>;
  /** Fields that were present with a value this build cannot store. */
  invalid: string[];
}

/**
 * Validate a client patch. Unknown *fields* are ignored (a newer client may send
 * something this build does not know, and that must not fail the whole write);
 * a known field with an unknown *value* is reported instead of silently
 * dropped, because "I picked a face and nothing happened" is the bug that
 * hidden-drop would create.
 */
export function sanitizeAppearancePatch(input: unknown): SanitizeResult {
  const patch: Partial<AppearanceFields> = {};
  const invalid: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { patch, invalid };
  }
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!isAppearanceField(key)) continue;
    if (value === undefined || value === null) continue;
    if (isKnownId(key, value)) {
      (patch as Record<string, string>)[key] = value as string;
    } else {
      invalid.push(key);
    }
  }
  return { patch, invalid };
}

/* ── battle reports ──────────────────────────────────────────────────────── */

export type BattleDifficulty = "easy" | "normal" | "hard";
export type BattleResult = "win" | "loss" | "flee";

/** A validated fight, ready to insert (minus the user id, which is the session's). */
export interface BattleReport {
  petSlug: string;
  petName: string | null;
  petLevel: number;
  rivalSlug: string;
  rivalName: string;
  rivalLevel: number;
  difficulty: BattleDifficulty;
  design: BattleDesignId;
  /** Arena cup, 1–6, or null for a pick-up fight. Mirrors `MAX_ARENA_CUP`. */
  stage: number | null;
  result: BattleResult;
  rounds: number;
  damageDealt: number;
  damageTaken: number;
}

/**
 * Cups in the arena ladder (see the client's `lib/arenaLadder.ts`). The database
 * column's CHECK allows exactly this range, so the route refuses anything else
 * rather than letting Postgres turn a bad payload into a 500.
 */
export const MAX_ARENA_CUP = 6;

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function count(value: unknown, max: number): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.round(n), max);
}

/**
 * Validate what the arena sends after a fight.
 *
 * The fight itself is client-side (it carries no rewards — see the `pet_battles`
 * comment in the schema), so this is not an anti-cheat boundary; it is a
 * *storage* boundary. The row is read back in the admin console and typed into a
 * table, so the contract is: species must look like slugs from our own catalog,
 * levels must be sane against the schema's CHECKs, and the two enums (`result`,
 * `design`) must be members or the insert would be rejected by the database.
 */
export function sanitizeBattleReport(input: unknown): { report: BattleReport | null; error: string | null } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { report: null, error: "body must be an object" };
  }
  const body = input as Record<string, unknown>;

  const petSlug = text(body.petSlug, 64);
  if (!petSlug || !SLUG_RE.test(petSlug)) return { report: null, error: "petSlug" };
  const rivalSlug = text(body.rivalSlug, 64);
  if (!rivalSlug || !SLUG_RE.test(rivalSlug)) return { report: null, error: "rivalSlug" };

  const rivalName = text(body.rivalName, 60);
  if (!rivalName) return { report: null, error: "rivalName" };

  // A level of 0 is clamped up rather than rejected: the schema's CHECK is
  // `>= 1`, and a log of a cosmetic fight is not worth failing a request over —
  // but a non-number is still a bad payload.
  const petLevel = count(body.petLevel ?? 1, 100);
  const rivalLevel = count(body.rivalLevel ?? 1, 100);
  if (petLevel === null) return { report: null, error: "petLevel" };
  if (rivalLevel === null) return { report: null, error: "rivalLevel" };

  const difficulty = body.difficulty ?? "normal";
  if (difficulty !== "easy" && difficulty !== "normal" && difficulty !== "hard") {
    return { report: null, error: "difficulty" };
  }

  const design = body.design ?? DEFAULT_APPEARANCE.battleDesign;
  if (!isKnownId("battleDesign", design)) return { report: null, error: "design" };

  // `stage` is optional and may be null: a pick-up fight is not a cup. Anything
  // else must be a whole number inside the ladder — the column's CHECK would
  // reject it anyway, and a rejected insert surfaces as a 500.
  let stage: number | null = null;
  if (body.stage !== undefined && body.stage !== null) {
    // Strict on purpose — unlike a level, a stage has no sensible clamp. The
    // round-trip through JSON can hand this a number, and a form-encoded caller
    // a digit string; a fraction or an out-of-ladder number is a bad payload and
    // is named as one, not silently rounded into a different cup.
    const raw =
      typeof body.stage === "number"
        ? body.stage
        : typeof body.stage === "string" && /^\d+$/.test(body.stage.trim())
          ? Number(body.stage.trim())
          : NaN;
    if (!Number.isInteger(raw) || raw < 1 || raw > MAX_ARENA_CUP) return { report: null, error: "stage" };
    stage = raw;
  }

  const result = body.result;
  if (result !== "win" && result !== "loss" && result !== "flee") {
    return { report: null, error: "result" };
  }

  return {
    report: {
      petSlug,
      petName: text(body.petName, 60),
      petLevel: Math.max(1, petLevel),
      rivalSlug,
      rivalName,
      rivalLevel: Math.max(1, rivalLevel),
      difficulty,
      design: design as BattleDesignId,
      stage,
      result,
      rounds: count(body.rounds ?? 0, 999) ?? 0,
      damageDealt: count(body.damageDealt ?? 0, 1_000_000) ?? 0,
      damageTaken: count(body.damageTaken ?? 0, 1_000_000) ?? 0,
    },
    error: null,
  };
}
