/**
 * The design ids are shared by four places — the database CHECKs, the server
 * catalog, this registry, and the cache each browser keeps — and only three of
 * them ship together. The fourth is whatever a user's browser stored the last
 * time they signed in, in a build that may be older (an id since removed) or
 * newer (an id this bundle has never heard of, after a rollback).
 *
 * So the interesting question is not "does it accept the good values" but "what
 * happens at the edges", and those edges have no visible failure mode: an
 * uncoerced id does not throw, it renders an empty timer face or a blank
 * companion stage. These tests pin the coercion itself, the cache read that uses
 * it, and the write that keeps a bad value from ever entering the store.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APPEARANCE_FIELDS,
  BATTLE_DESIGN_IDS,
  DEFAULT_APPEARANCE,
  LAYOUT_IDS,
  PET_DESIGN_IDS,
  SHELL_IDS,
  TIMER_FACE_IDS,
  coerceAppearance,
  designLabel,
} from "./designPacks";

const CACHE_KEY = "focusarx:appearance:v1";

describe("coerceAppearance", () => {
  it("keeps every known id and always answers with the full shape", () => {
    const chosen = {
      timerFace: "analog",
      petDesign: "wild3d",
      battleDesign: "retro",
      layout: "compact",
      shell: "topbar",
    } as const;
    expect(coerceAppearance(chosen)).toEqual(chosen);

    // The shape is what renderers destructure, so a partial payload must still
    // produce all four keys rather than leaving some undefined.
    const partial = coerceAppearance({ timerFace: "zen" });
    expect(Object.keys(partial).sort()).toEqual([...APPEARANCE_FIELDS].sort());
    expect(partial).toEqual({ ...DEFAULT_APPEARANCE, timerFace: "zen" });
  });

  it("drops a stale id per field instead of giving up on the whole payload", () => {
    // The realistic case: the browser cached this months ago, one face was
    // retired since, and the other three choices are still valid. Dropping all
    // four would silently reset a user's companion and layout because of an
    // unrelated removal.
    const coerced = coerceAppearance({
      timerFace: "hologram", // never existed in any build
      petDesign: "wild3d",
      battleDesign: "arena",
      layout: "studio",
      shell: "drawer", // a frame that was considered and never shipped
    });
    expect(coerced).toEqual({
      timerFace: DEFAULT_APPEARANCE.timerFace,
      petDesign: "wild3d",
      battleDesign: "arena",
      layout: "studio",
      shell: DEFAULT_APPEARANCE.shell,
    });
  });

  it("ignores values that are not strings at all", () => {
    // JSON round-tripped through localStorage can carry anything: a number from
    // an early build, an array from a hand-edited entry, an object from a
    // different app writing the same key.
    expect(
      coerceAppearance({
        timerFace: 7,
        petDesign: null,
        battleDesign: ["retro"],
        layout: { id: "studio" },
        shell: 3,
      }),
    ).toEqual(DEFAULT_APPEARANCE);

    expect(coerceAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(coerceAppearance(undefined)).toEqual(DEFAULT_APPEARANCE);

    // Unknown extra keys are not copied through either.
    const extra = coerceAppearance({ timerFace: "garden", madeUpField: "sneaky" } as never);
    expect(Object.keys(extra).sort()).toEqual([...APPEARANCE_FIELDS].sort());
  });

  it("accepts every id the app ships, so the registry is the whole truth", () => {
    // Guards the reverse slip: a face added to the registry but never accepted
    // here would fall back to Classic the moment it was saved.
    expect(TIMER_FACE_IDS.every((id) => coerceAppearance({ timerFace: id }).timerFace === id)).toBe(true);
    expect(PET_DESIGN_IDS.every((id) => coerceAppearance({ petDesign: id }).petDesign === id)).toBe(true);
    expect(BATTLE_DESIGN_IDS.every((id) => coerceAppearance({ battleDesign: id }).battleDesign === id)).toBe(true);
    expect(LAYOUT_IDS.every((id) => coerceAppearance({ layout: id }).layout === id)).toBe(true);
    expect(SHELL_IDS.every((id) => coerceAppearance({ shell: id }).shell === id)).toBe(true);
  });
});

describe("designLabel", () => {
  it("prefers the human label and falls back to the raw id", () => {
    expect(designLabel("timerFace", "analog")).toBe("Analog clock");
    expect(designLabel("layout", "compact")).toBe("Compact");
    // An id the console does not know (a newer server, a hand-written row) is
    // shown as itself — a blank cell in the admin table hides the problem.
    expect(designLabel("battleDesign", "hologram-board")).toBe("hologram-board");
  });
});

describe("the cached assignment", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("paints the account's own design before the server answers", async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ timerFace: "garden", petDesign: "sprite", battleDesign: "retro", layout: "studio", shell: "tabs" }),
    );
    const { getAppearanceFields } = await import("./appearance");
    expect(getAppearanceFields()).toEqual({
      timerFace: "garden",
      petDesign: "sprite",
      battleDesign: "retro",
      layout: "studio",
      shell: "tabs",
    });
  });

  it("degrades a poisoned cache to defaults rather than to a broken screen", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timerFace: "hologram", petDesign: 42, layout: "studio" }));
    const { getAppearanceFields } = await import("./appearance");
    expect(getAppearanceFields()).toEqual({ ...DEFAULT_APPEARANCE, layout: "studio" });

    vi.resetModules();
    localStorage.setItem(CACHE_KEY, "{ not json at all");
    const corrupted = await import("./appearance");
    expect(corrupted.getAppearanceFields()).toEqual(DEFAULT_APPEARANCE);
  });

  it("coerces a write, so a stale value cannot enter the store and spread", async () => {
    const { getAppearanceFields, setAppearanceState, __resetAppearanceStateForTests } = await import("./appearance");
    __resetAppearanceStateForTests();
    setAppearanceState({
      fields: { timerFace: "hologram", petDesign: "wild3d", battleDesign: "retro", layout: "quiet" } as never,
    });
    expect(getAppearanceFields()).toEqual({ ...DEFAULT_APPEARANCE, petDesign: "wild3d", battleDesign: "retro" });
  });
});
