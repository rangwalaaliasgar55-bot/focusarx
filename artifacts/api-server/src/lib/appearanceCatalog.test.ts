import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BATTLE_DESIGNS,
  DEFAULT_APPEARANCE,
  LAYOUTS,
  PET_DESIGNS,
  SHELLS,
  TIMER_FACE_IDS,
  TIMER_FACE_LABELS,
  isKnownId,
  sanitizeAppearancePatch,
  sanitizeBattleReport,
  MAX_ARENA_CUP,
} from "./appearanceCatalog";

/**
 * The design-pack catalog is written down in four places: this file (validation
 * and labels), the client registry (`artifacts/focusarx/src/lib/designPacks.ts`,
 * which owns the descriptions), the client's timer registry
 * (`lib/timerTheme.ts`), and the CHECK constraints in
 * `lib/db/src/schema/appearance.ts`. They cannot be one file — the client does
 * not import server code — so they are asserted against each other instead.
 *
 * The failure this prevents is invisible from either side alone: an id the API
 * accepts but the client does not know renders as an empty stage (reported as
 * "my pet disappeared"), and an id the client offers but the API rejects saves
 * nothing while looking like it worked.
 */

const client = readFileSync(new URL("../../../focusarx/src/lib/designPacks.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../../../../lib/db/src/schema/appearance.ts", import.meta.url), "utf8");

/** Pull a `export const NAME = [...] as const;` array out of a source file. */
function clientIds(name: string): string[] {
  const match = new RegExp(`export const ${name} = \\[([^\\]]*)\\]`, "s").exec(client);
  if (!match) throw new Error(`${name} not found in designPacks.ts`);
  return [...match[1]!.matchAll(/"([a-z0-9]+)"/g)].map((m) => m[1]!);
}

/** Pull the id list out of a `CHECK (... IN ('a','b'))` constraint. */
function checkIds(constraint: string): string[] {
  const match = new RegExp(`${constraint}[^)]*IN \\(([^)]*)\\)`, "s").exec(schema);
  if (!match) throw new Error(`${constraint} not found in the schema`);
  return [...match[1]!.matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]!);
}

describe("catalog parity", () => {
  it("has the same timer faces as the client registry, in the same order", () => {
    expect(TIMER_FACE_IDS).toEqual(clientIds("TIMER_FACE_IDS"));
  });

  it("has the same pet, battle, layout and shell ids as the client", () => {
    expect(PET_DESIGNS.map((d) => d.id)).toEqual(clientIds("PET_DESIGN_IDS"));
    expect(BATTLE_DESIGNS.map((d) => d.id)).toEqual(clientIds("BATTLE_DESIGN_IDS"));
    expect(LAYOUTS.map((l) => l.id)).toEqual(clientIds("LAYOUT_IDS"));
    expect(SHELLS.map((sh) => sh.id)).toEqual(clientIds("SHELL_IDS"));
  });

  it("has the same timer faces as the client's timer registry", () => {
    const themeSource = readFileSync(new URL("../../../focusarx/src/lib/timerTheme.ts", import.meta.url), "utf8");
    const union = /export type TimerTheme =([\s\S]*?);/.exec(themeSource)?.[1] ?? "";
    const ids = [...union.matchAll(/"([a-z0-9]+)"/g)].map((m) => m[1]!);
    expect(ids.sort()).toEqual([...TIMER_FACE_IDS].sort());
  });

  it("has the same ids as the database CHECK constraints", () => {
    // Four copies of the same list is only safe when the drift is loud.
    expect(checkIds("user_appearance_timer_face_known").sort()).toEqual([...TIMER_FACE_IDS].sort());
    expect(checkIds("user_appearance_pet_design_known").sort()).toEqual(PET_DESIGNS.map((d) => d.id).sort());
    expect(checkIds("user_appearance_battle_design_known").sort()).toEqual(BATTLE_DESIGNS.map((d) => d.id).sort());
    expect(checkIds("user_appearance_layout_known").sort()).toEqual(LAYOUTS.map((l) => l.id).sort());
    expect(checkIds("user_appearance_shell_known").sort()).toEqual(SHELLS.map((sh) => sh.id).sort());
  });

  it("labels every id, and defaults to ids that exist", () => {
    for (const id of TIMER_FACE_IDS) {
      expect(TIMER_FACE_LABELS[id], `${id} has no label`).toBeTruthy();
    }
    for (const [field, id] of Object.entries(DEFAULT_APPEARANCE)) {
      expect(isKnownId(field as keyof typeof DEFAULT_APPEARANCE, id), `${field} default ${id} is unknown`).toBe(true);
    }
  });
});

describe("sanitizeAppearancePatch", () => {
  it("accepts every id the catalog offers, per field", () => {
    for (const id of TIMER_FACE_IDS) {
      const { patch, invalid } = sanitizeAppearancePatch({ timerFace: id });
      expect(invalid).toEqual([]);
      expect(patch).toEqual({ timerFace: id });
    }
    for (const design of PET_DESIGNS) {
      expect(sanitizeAppearancePatch({ petDesign: design.id }).patch).toEqual({ petDesign: design.id });
    }
    for (const design of BATTLE_DESIGNS) {
      expect(sanitizeAppearancePatch({ battleDesign: design.id }).patch).toEqual({ battleDesign: design.id });
    }
    for (const layout of LAYOUTS) {
      expect(sanitizeAppearancePatch({ layout: layout.id }).patch).toEqual({ layout: layout.id });
    }
    for (const shell of SHELLS) {
      expect(sanitizeAppearancePatch({ shell: shell.id }).patch).toEqual({ shell: shell.id });
    }
  });

  it("reports a known field with an unknown value instead of dropping it", () => {
    const { patch, invalid } = sanitizeAppearancePatch({ timerFace: "sparkle-unicorn", layout: "quiet" });
    expect(invalid).toEqual(["timerFace"]);
    expect(patch).toEqual({ layout: "quiet" });
  });

  it("ignores unknown fields and unusable bodies", () => {
    expect(sanitizeAppearancePatch({ petDesign: "wild3d", theme: "dark" }).patch).toEqual({ petDesign: "wild3d" });
    expect(sanitizeAppearancePatch(null)).toEqual({ patch: {}, invalid: [] });
    expect(sanitizeAppearancePatch([{ layout: "quiet" }])).toEqual({ patch: {}, invalid: [] });
    expect(sanitizeAppearancePatch({ layout: 7 }).invalid).toEqual(["layout"]);
  });

  it("takes the whole patch when several fields are legal at once", () => {
    const { patch, invalid } = sanitizeAppearancePatch({
      timerFace: "aurora",
      petDesign: "wild3d",
      battleDesign: "retro",
      layout: "studio",
    });
    expect(invalid).toEqual([]);
    expect(patch).toEqual({ timerFace: "aurora", petDesign: "wild3d", battleDesign: "retro", layout: "studio" });
  });
});

describe("sanitizeBattleReport", () => {
  const good = {
    petSlug: "fox",
    petName: "Rusty",
    petLevel: 5,
    rivalSlug: "owl",
    rivalName: "Wild Owl",
    rivalLevel: 6,
    difficulty: "hard",
    design: "retro",
    result: "win",
    rounds: 7,
    damageDealt: 118,
    damageTaken: 42,
  };

  it("accepts a report the arena actually sends", () => {
    const { report, error } = sanitizeBattleReport(good);
    expect(error).toBeNull();
    // `stage` is always present on the parsed report — null when the fight was
    // not a cup — so a consumer never has to tell "absent" from "no cup".
    expect(report).toEqual({ ...good, stage: null });
  });

  it("defaults the optional edges rather than rejecting them", () => {
    const { report, error } = sanitizeBattleReport({ petSlug: "fox", rivalSlug: "owl", rivalName: "Wild Owl", result: "loss" });
    expect(error).toBeNull();
    expect(report).toMatchObject({ petLevel: 1, rivalLevel: 1, difficulty: "normal", design: "duel", rounds: 0 });
  });

  it("rejects a slug that is not a slug, and names the field", () => {
    expect(sanitizeBattleReport({ ...good, petSlug: "Fox With Spaces" }).error).toBe("petSlug");
    expect(sanitizeBattleReport({ ...good, rivalSlug: "" }).error).toBe("rivalSlug");
    expect(sanitizeBattleReport({ ...good, rivalName: "   " }).error).toBe("rivalName");
  });

  it("rejects the three enums the database would reject", () => {
    expect(sanitizeBattleReport({ ...good, result: "draw" }).error).toBe("result");
    expect(sanitizeBattleReport({ ...good, difficulty: "brutal" }).error).toBe("difficulty");
    expect(sanitizeBattleReport({ ...good, design: "hologram" }).error).toBe("design");
  });

  it("clamps the numbers into what the schema can store", () => {
    const { report } = sanitizeBattleReport({ ...good, petLevel: 999, rivalLevel: 0.4, rounds: -3, damageDealt: 5e9 });
    expect(report?.petLevel).toBe(100);
    expect(report?.rivalLevel).toBe(1);
    expect(report?.rounds).toBe(0);
    expect(report?.damageDealt).toBe(1_000_000);
  });

  it("truncates a long name instead of failing the insert", () => {
    const { report } = sanitizeBattleReport({ ...good, petName: "x".repeat(200) });
    expect(report?.petName).toHaveLength(60);
  });

  it("carries the arena cup, including the last one, and null for a pick-up fight", () => {
    // The stage is the one field that is optional *and* nullable: a pick-up
    // fight is not a cup, and a row written before the ladder existed has none.
    expect(sanitizeBattleReport({ ...good, stage: 3 }).report?.stage).toBe(3);
    expect(sanitizeBattleReport({ ...good, stage: MAX_ARENA_CUP }).report?.stage).toBe(MAX_ARENA_CUP);
    expect(sanitizeBattleReport({ ...good, stage: null }).report?.stage).toBeNull();
    expect(sanitizeBattleReport(good).report?.stage).toBeNull();
    // A form-encoded caller sends the digit as a string; that is still cup 4.
    expect(sanitizeBattleReport({ ...good, stage: "4" }).report?.stage).toBe(4);
  });

  it("refuses a cup outside the ladder instead of rounding it into one", () => {
    // `rounds` and the levels clamp — a cosmetic number is not worth a 500. A
    // cup is different: 2.5 or 7 would be stored as a stage the client cannot
    // look up, or rejected by the column's CHECK as a 500.
    for (const bad of [0, -1, MAX_ARENA_CUP + 1, 2.5, "three", "", [], {}]) {
      expect(sanitizeBattleReport({ ...good, stage: bad }).error, `stage ${JSON.stringify(bad)}`).toBe("stage");
    }
  });

  it("rejects bodies that are not objects", () => {
    expect(sanitizeBattleReport(null).report).toBeNull();
    expect(sanitizeBattleReport("win").report).toBeNull();
    expect(sanitizeBattleReport([good]).report).toBeNull();
  });
});
