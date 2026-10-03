/**
 * Design packs — the client's copy of "which designs exist".
 *
 * These are the four choices a user (or an admin, per account) can make about
 * how FocusArx looks. They are deliberately *not* feature flags: a design pack
 * changes what is drawn, never what is true — the countdown, the pet's level and
 * the battle maths are identical in every pack, so switching one cannot change a
 * result.
 *
 * The ids here must match `api-server/lib/appearanceCatalog.ts` (which also
 * holds the database check constraints) and `appearanceCatalog.test.ts` fails if
 * the two drift. That test exists because the failure mode is invisible: an id
 * the API accepts but this file does not know renders as an empty stage, which
 * people report as "my pet disappeared", never as a bad id.
 *
 * `TIMER_FACE_IDS` mirrors `lib/timerTheme.ts`; the face *descriptions* live
 * there because that registry also drives the picker inside the timer.
 */

export const TIMER_FACE_IDS = [
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
] as const;
export type TimerFaceId = (typeof TIMER_FACE_IDS)[number];

export const PET_DESIGN_IDS = ["classic", "wild3d", "sprite"] as const;
export type PetDesignId = (typeof PET_DESIGN_IDS)[number];

export interface DesignOption<T extends string> {
  id: T;
  label: string;
  blurb: string;
  /** One line the admin table can print without a tooltip. */
  short: string;
}

export const PET_DESIGNS: DesignOption<PetDesignId>[] = [
  {
    id: "classic",
    label: "Studio rig",
    short: "Six-species 3D rig",
    blurb: "The original six-species 3D rig, with the glyph stage on devices without WebGL.",
  },
  {
    id: "wild3d",
    label: "Wild 3D",
    short: "Every species, as itself",
    blurb:
      "Every catalog species built as its own animal — ears, tail, beak, wings and all — from one procedural body. A capybara is a capybara, not a recoloured owl.",
  },
  {
    id: "sprite",
    label: "Sprite only",
    short: "2D art, no canvas",
    blurb: "2D first: the catalog artwork (or bundled illustration) with no 3D canvas at all — the lightest option, and the fastest on old phones.",
  },
];

export const BATTLE_DESIGN_IDS = ["duel", "arena", "retro"] as const;
export type BattleDesignId = (typeof BATTLE_DESIGN_IDS)[number];

export const BATTLE_DESIGNS: DesignOption<BattleDesignId>[] = [
  {
    id: "duel",
    label: "Duel board",
    short: "Turn-based, you choose",
    blurb: "Turn-based board: pick a move, spend energy, guard or recover. The full fight, on purpose.",
  },
  {
    id: "arena",
    label: "Session arena",
    short: "Plays out beside a focus block",
    blurb: "The deterministic arena that plays out beside a focus session — the block is the fight, so finishing always wins.",
  },
  {
    id: "retro",
    label: "Retro LCD",
    short: "Flat high-contrast readout",
    blurb: "The same duel with a flat, high-contrast readout. Fastest to read, lightest to run.",
  },
];

export const LAYOUT_IDS = ["quiet", "studio", "compact"] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

export const LAYOUTS: DesignOption<LayoutId>[] = [
  {
    id: "quiet",
    label: "Quiet",
    short: "Timer first",
    blurb: "The default workspace: timer first, companion beside it, secondary panels collapsed.",
  },
  {
    id: "studio",
    label: "Studio",
    short: "Large stage + rail",
    blurb: "One large stage with a companion rail — for people who want the animal on screen while they work.",
  },
  {
    id: "compact",
    label: "Compact",
    short: "Single column",
    blurb: "Art-first and single column: the stage, the clock, the controls, nothing else.",
  },
];

export const PET_DESIGN_LABELS: Record<PetDesignId, string> = {
  classic: "Studio rig",
  wild3d: "Wild 3D",
  sprite: "Sprite only",
};

export const BATTLE_DESIGN_LABELS: Record<BattleDesignId, string> = {
  duel: "Duel board",
  arena: "Session arena",
  retro: "Retro LCD",
};

export const LAYOUT_LABELS: Record<LayoutId, string> = {
  quiet: "Quiet",
  studio: "Studio",
  compact: "Compact",
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
};

export interface AppearanceFields {
  timerFace: TimerFaceId;
  petDesign: PetDesignId;
  battleDesign: BattleDesignId;
  layout: LayoutId;
}

export const APPEARANCE_FIELDS = ["timerFace", "petDesign", "battleDesign", "layout"] as const;
export type AppearanceField = (typeof APPEARANCE_FIELDS)[number];

export const DEFAULT_APPEARANCE: AppearanceFields = {
  timerFace: "classic",
  petDesign: "classic",
  battleDesign: "duel",
  layout: "quiet",
};

const VALID: Record<AppearanceField, readonly string[]> = {
  timerFace: TIMER_FACE_IDS,
  petDesign: PET_DESIGN_IDS,
  battleDesign: BATTLE_DESIGN_IDS,
  layout: LAYOUT_IDS,
};

/**
 * Coerce a value that came from the network or from `localStorage` (both are
 * untrusted as far as this module is concerned) into a known design id.
 *
 * A stale cached id — the face a user picked in a build that had it, since
 * removed — must degrade to the default rather than render nothing. This is the
 * same reasoning `timerTheme.getStoredTimerTheme` already applies to the stored
 * timer face.
 */
export function coerceAppearance(input: Partial<Record<AppearanceField, unknown>> | null | undefined): AppearanceFields {
  const out: AppearanceFields = { ...DEFAULT_APPEARANCE };
  if (!input) return out;
  for (const field of APPEARANCE_FIELDS) {
    const value = input[field];
    if (typeof value === "string" && VALID[field].includes(value)) {
      out[field] = value as never;
    }
  }
  return out;
}

/** Human label for a design id, for the admin table and the settings summary. */
export function designLabel(field: AppearanceField, id: string): string {
  switch (field) {
    case "timerFace":
      return TIMER_FACE_LABELS[id as TimerFaceId] ?? id;
    case "petDesign":
      return PET_DESIGN_LABELS[id as PetDesignId] ?? id;
    case "battleDesign":
      return BATTLE_DESIGN_LABELS[id as BattleDesignId] ?? id;
    case "layout":
      return LAYOUT_LABELS[id as LayoutId] ?? id;
  }
}
