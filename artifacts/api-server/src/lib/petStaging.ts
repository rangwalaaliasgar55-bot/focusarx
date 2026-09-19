/**
 * Pet release staging — the holding area between "found in the wild" and
 * "live in the catalog".
 *
 * The team reviews external pet sources and stages candidates here; admins
 * release them into `pet_catalog` from the admin panel when there is time.
 * Three rules make that safe:
 *
 *  1. Metadata only. Sprite/model binaries never enter this repo — preview
 *     URLs are derived from the upstream sprite conventions, so the admin
 *     panel can show a candidate without us redistributing assets.
 *  2. Every entry keeps its upstream license tag. The release route refuses
 *     to publish a "fan-use" entry without an explicit IP-review
 *     confirmation, so staged content can reach users only through a
 *     deliberate, logged act.
 *  3. The staging set is code (generated, reviewed, versioned). Adding or
 *     dropping candidates is a normal PR, not a database migration.
 */
import { STAGED_PETS, type StagedPet } from "./petStagingData";

export type { StagedPet };

/** Where the candidates come from, and the verdict on each source. */
export const PET_SOURCES = [
  {
    id: "codex-pokepets",
    title: "Codex PokéPets",
    url: "https://github.com/dnnyngyen/codex-pokepets",
    verdict: "staged",
    stagedCount: STAGED_PETS.length,
    license: "fan-use",
    summary:
      "Every Pokémon as an animated pet: 734 Gen 1–5 pixel-art sprites (incl. 85 forms) + 1,004 Gen 1–9 animated variants. Imported as metadata only; sprites are © Nintendo / Game Freak / Creatures Inc. and must pass IP review before any release.",
  },
  {
    id: "cop3d",
    title: "COP3D — Common Pets in 3D (Meta)",
    url: "https://github.com/facebookresearch/cop3d",
    verdict: "rejected",
    stagedCount: 0,
    license: "research dataset",
    summary:
      "A 322 GB research dataset of 4,200 real cat/dog videos for 3D reconstruction — no characters, sprites or models to import. Not a pet catalog; rejected at review.",
  },
  {
    id: "tamagotchi",
    title: "bsawyer/tamagotchi",
    url: "https://github.com/bsawyer/tamagotchi",
    verdict: "mechanics-reference",
    stagedCount: 0,
    license: "ISC",
    summary:
      "An SVG-rig Tamagotchi clone. No catalog entries — one character, Bandai's IP. Extracted idea: its action→mood→animation mapping (feed/play/sleep flip the rig's face and posture classes). Worth revisiting if pets ever gain care actions; FocusArx keeps XP session-earned either way.",
  },
] as const;

export type PetSource = (typeof PET_SOURCES)[number];

/** 2D base species: PokeAPI's Gen-5 Black/White animated sprites, by dex id. */
const POKEAPI_BW_ANIMATED =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated";
/** Forms and 3D variants: Pokémon Showdown's animated sprites, by slug. */
const SHOWDOWN_ANI = "https://play.pokemonshowdown.com/sprites/ani";

/**
 * Preview artwork for the admin panel. Best-effort by upstream convention —
 * a missing file upstream just shows a broken preview to admins, never to
 * users (released rows carry whatever URL the admin confirmed).
 */
export function spriteUrlFor(entry: StagedPet): string {
  if (entry.style === "2d" && entry.kind === "species") {
    return `${POKEAPI_BW_ANIMATED}/${entry.dex}.gif`;
  }
  if (entry.style === "3d") {
    return `${SHOWDOWN_ANI}/${entry.species ?? entry.slug.replace(/-3d$/, "")}.gif`;
  }
  return `${SHOWDOWN_ANI}/${entry.slug}.gif`;
}

const stagedBySlug = new Map(STAGED_PETS.map((p) => [p.slug, p]));

export function findStagedPet(slug: string): StagedPet | undefined {
  return stagedBySlug.get(slug);
}

export interface StagedQuery {
  q?: string;
  gen?: number;
  style?: "2d" | "3d";
  kind?: "species" | "form";
  /** When provided, filter to released / unreleased entries. */
  released?: boolean;
  page?: number;
  pageSize?: number;
}

export interface StagedEntryView extends StagedPet {
  spriteUrl: string;
  released: boolean;
}

export const STAGED_PAGE_SIZE_DEFAULT = 48;
export const STAGED_PAGE_SIZE_MAX = 200;

/** Filter + paginate the staging manifest. Pure — released slugs come from
   the caller (a `pet_catalog` lookup), keeping this unit-testable. */
export function queryStagedPets(
  query: StagedQuery,
  releasedSlugs: ReadonlySet<string>,
): { total: number; page: number; pageSize: number; entries: StagedEntryView[] } {
  const q = query.q?.trim().toLowerCase();
  let list: StagedPet[] = STAGED_PETS;
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.slug.includes(q));
  if (query.gen != null) list = list.filter((p) => p.gen === query.gen);
  if (query.style) list = list.filter((p) => p.style === query.style);
  if (query.kind) list = list.filter((p) => p.kind === query.kind);
  if (query.released != null) {
    list = list.filter((p) => releasedSlugs.has(p.slug) === query.released);
  }

  const pageSize = Math.min(Math.max(query.pageSize ?? STAGED_PAGE_SIZE_DEFAULT, 1), STAGED_PAGE_SIZE_MAX);
  const page = Math.max(query.page ?? 1, 1);
  const start = (page - 1) * pageSize;

  return {
    total: list.length,
    page,
    pageSize,
    entries: list.slice(start, start + pageSize).map((p) => ({
      ...p,
      spriteUrl: spriteUrlFor(p),
      released: releasedSlugs.has(p.slug),
    })),
  };
}

/** All staged slugs — used to scope catalog lookups and pulls. */
export function stagedSlugs(): string[] {
  return STAGED_PETS.map((p) => p.slug);
}
