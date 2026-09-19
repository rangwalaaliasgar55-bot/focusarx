import { describe, expect, it } from "vitest";
import {
  PET_SOURCES,
  STAGED_PAGE_SIZE_MAX,
  findStagedPet,
  queryStagedPets,
  spriteUrlFor,
  stagedSlugs,
} from "./petStaging";
import { STAGED_PETS } from "./petStagingData";

/**
 * The staging manifest is how external pet candidates reach the release
 * pipeline, so its invariants are worth pinning:
 *   - every entry keeps its upstream license (the release gate depends on it);
 *   - slugs are unique (they become pet_catalog slugs on release);
 *   - preview URLs follow the upstream sprite conventions;
 *   - filters and pagination behave, and the released filter matches the
 *     caller's set exactly.
 */

const none = new Set<string>();

describe("staged manifest", () => {
  it("imports the full upstream catalog with licenses intact", () => {
    expect(STAGED_PETS.length).toBe(1738);
    for (const pet of STAGED_PETS) {
      expect(pet.license, pet.slug).toBe("fan-use");
      expect(pet.slug).toBeTruthy();
      expect(pet.name).toBeTruthy();
      expect(pet.dex).toBeGreaterThanOrEqual(1);
      expect(["2d", "3d"]).toContain(pet.style);
    }
  });

  it("has unique slugs — they become catalog slugs on release", () => {
    expect(new Set(stagedSlugs()).size).toBe(STAGED_PETS.length);
  });

  it("records the verdict on every reviewed source", () => {
    const ids = PET_SOURCES.map((s) => s.id);
    expect(ids).toEqual(["codex-pokepets", "cop3d", "tamagotchi"]);
    const pokepets = PET_SOURCES.find((s) => s.id === "codex-pokepets")!;
    expect(pokepets.stagedCount).toBe(STAGED_PETS.length);
  });
});

describe("spriteUrlFor", () => {
  it("points 2D base species at PokeAPI's Gen-5 animated sprites by dex id", () => {
    const bulbasaur = findStagedPet("bulbasaur")!;
    expect(spriteUrlFor(bulbasaur)).toBe(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/1.gif",
    );
  });

  it("points 3D variants at Showdown by species slug", () => {
    const charizard3d = findStagedPet("charizard-3d")!;
    expect(spriteUrlFor(charizard3d)).toBe("https://play.pokemonshowdown.com/sprites/ani/charizard.gif");
  });

  it("points forms at Showdown by form slug", () => {
    const unownB = findStagedPet("unown-b")!;
    expect(spriteUrlFor(unownB)).toBe("https://play.pokemonshowdown.com/sprites/ani/unown-b.gif");
  });
});

describe("queryStagedPets", () => {
  it("paginates and never overlaps pages", () => {
    const page1 = queryStagedPets({ page: 1, pageSize: 100 }, none);
    const page2 = queryStagedPets({ page: 2, pageSize: 100 }, none);
    expect(page1.entries).toHaveLength(100);
    expect(page2.entries[0]!.slug).not.toBe(page1.entries[0]!.slug);
    expect(page1.total).toBe(STAGED_PETS.length);
  });

  it("caps page size so a bad query cannot dump the manifest", () => {
    const r = queryStagedPets({ pageSize: 100_000 }, none);
    expect(r.pageSize).toBe(STAGED_PAGE_SIZE_MAX);
  });

  it("filters by search, gen, style and kind", () => {
    expect(queryStagedPets({ q: "charizard" }, none).total).toBeGreaterThan(1);
    const gen1 = queryStagedPets({ gen: 1 }, none);
    expect(gen1.entries.every((e) => e.gen === 1)).toBe(true);
    const only3d = queryStagedPets({ style: "3d" }, none);
    expect(only3d.entries.every((e) => e.style === "3d")).toBe(true);
    const forms = queryStagedPets({ kind: "form" }, none);
    expect(forms.entries.every((e) => e.kind === "form")).toBe(true);
  });

  it("marks released entries and filters on them using the caller's set", () => {
    const released = new Set(["bulbasaur", "mewtwo-3d"]);
    const all = queryStagedPets({ q: "bulbasaur" }, released);
    const hit = all.entries.find((e) => e.slug === "bulbasaur")!;
    expect(hit.released).toBe(true);
    expect(all.entries.find((e) => e.slug === "bulbasaur-3d")?.released ?? false).toBe(false);

    const onlyReleased = queryStagedPets({ released: true }, released);
    expect(onlyReleased.total).toBe(2);
    const onlyStaged = queryStagedPets({ released: false }, released);
    expect(onlyStaged.total).toBe(STAGED_PETS.length - 2);
  });
});
