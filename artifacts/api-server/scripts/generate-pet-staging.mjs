#!/usr/bin/env node
/**
 * Generates src/lib/petStagingData.ts — the staged-pet catalog for the admin
 * release pipeline — from the upstream codex-pokepets manifest (pets.json).
 *
 * Usage:
 *   node scripts/generate-pet-staging.mjs <path-or-url to pets.json>
 *
 * Only *metadata* is imported (slug, name, description, style, gen, dex id,
 * form info, license). Sprite binaries stay upstream; the server derives a
 * preview URL per entry (see lib/petStaging.ts), so nothing binary ever
 * enters this repo. The import is a staging manifest for internal release
 * planning — entries keep their upstream license tag ("fan-use") and the
 * release API refuses to publish one without an explicit IP-review
 * confirmation.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../src/lib/petStagingData.ts");

async function loadManifest(source) {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    return res.json();
  }
  return JSON.parse(readFileSync(source, "utf8"));
}

function js(value) {
  return JSON.stringify(value);
}

const source = process.argv[2];
if (!source) {
  console.error("usage: generate-pet-staging.mjs <pets.json path or url>");
  process.exit(1);
}

const manifest = await loadManifest(source);
const pets = manifest.pets;
if (!Array.isArray(pets) || pets.length === 0) {
  throw new Error("manifest has no pets array");
}

const lines = pets.map((p) => {
  const parts = [
    `slug:${js(p.slug)}`,
    `name:${js(p.name)}`,
    `description:${js(p.description ?? "")}`,
    `style:${js(p.style)}`,
    `gen:${Number(p.gen)}`,
    `dex:${Number(p.pokedex_id)}`,
    `kind:${js(p.category === "pokemon-form" ? "form" : "species")}`,
  ];
  if (p.species_slug) parts.push(`species:${js(p.species_slug)}`);
  if (p.form) parts.push(`form:${js(p.form)}`);
  parts.push(`license:${js(p.license ?? "fan-use")}`);
  return `  { ${parts.join(",")} },`;
});

/* One 1738-entry literal overflows TypeScript's union-complexity budget, so
   the data ships as annotated chunks that are concatenated. */
const CHUNK = 400;
const chunks = [];
for (let i = 0; i < lines.length; i += CHUNK) {
  chunks.push(`const CHUNK_${chunks.length + 1}: StagedPet[] = [\n${lines.slice(i, i + CHUNK).join("\n")}\n];`);
}

const output = `/* GENERATED FILE — do not edit by hand.
 * Regenerate with:
 *   node scripts/generate-pet-staging.mjs <pets.json path or url>
 *
 * Staged-pet metadata imported from ${js(manifest.sources ?? {})} on
 * ${new Date().toISOString().slice(0, 10)}. Metadata only: sprite binaries
 * stay upstream and are referenced by derived preview URLs (lib/petStaging.ts).
 *
 * LICENSE NOTE: these entries are Pokémon characters — © Nintendo /
 * Game Freak / Creatures Inc., tagged "fan-use" upstream. They are staged
 * for internal release planning only; the release API blocks publication
 * without an explicit IP-review confirmation.
 */

export interface StagedPet {
  slug: string;
  name: string;
  description: string;
  /** Sprite lineage: PokeAPI Gen-5 pixel art ("2d") or Showdown-style animation ("3d"). */
  style: "2d" | "3d";
  gen: number;
  /** National Pokédex number of the species. */
  dex: number;
  kind: "species" | "form";
  /** Present on forms and 3d variants: the base species slug. */
  species?: string;
  /** Present on forms: the form letter/name. */
  form?: string;
  license: string;
}

${chunks.join("\n\n")}

export const STAGED_PETS: StagedPet[] = [${chunks.map((_, i) => `...CHUNK_${i + 1}`).join(", ")}];
`;

writeFileSync(OUT, output);
console.log(`wrote ${pets.length} staged pets → ${OUT}`);
