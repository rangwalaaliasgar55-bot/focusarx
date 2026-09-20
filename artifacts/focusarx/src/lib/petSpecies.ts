/**
 * Species visuals for the pet system — the single source of truth shared by
 * the focus-tab companion, the pets page and the battle arena.
 *
 * Why this exists: the 2026-09 pet release moved companions from a fixed
 * 6-species table (`user_pets.petType`) to a catalog (`pet_catalog`) with a
 * dozen species, but every emoji/color map in the UI still listed only the
 * original six. Any newly-released species (capybara, otter, axolotl, …)
 * silently fell back to the default owl on the focus tab and to a paw glyph
 * on the pets page. One map here means a new catalog row can never be
 * forgotten in four places again.
 *
 * Anything unknown still falls back (category glyph, then the paw), so a
 * brand-new catalog entry added server-side degrades gracefully instead of
 * rendering as a different animal.
 */

export interface PetSpeciesVisual {
  emoji: string;
  /** CSS color used for glows, level badges and name text. */
  color: string;
}

/** Keyed by `pet_catalog.slug` (== legacy `user_pets.petType`). */
const SPECIES: Record<string, PetSpeciesVisual> = {
  owl:        { emoji: "🦉", color: "var(--palette-amber-400)" },
  fox:        { emoji: "🦊", color: "var(--color-error)" },
  dragon:     { emoji: "🐲", color: "var(--brand-500)" },
  robot:      { emoji: "🤖", color: "var(--palette-06b6d4)" },
  cat:        { emoji: "🐱", color: "var(--palette-ec4899)" },
  phoenix:    { emoji: "🦅", color: "var(--palette-f97316)" },
  turtle:     { emoji: "🐢", color: "var(--brand-teal)" },
  panda:      { emoji: "🐼", color: "var(--foreground)" },
  unicorn:    { emoji: "🦄", color: "var(--palette-violet-400)" },
  axolotl:    { emoji: "🦎", color: "var(--palette-ec4899)" },
  capybara:   { emoji: "🦫", color: "var(--palette-amber-400)" },
  otter:      { emoji: "🦦", color: "var(--palette-06b6d4)" },
  dog:        { emoji: "🐶", color: "var(--palette-amber-400)" },
  puppy:      { emoji: "🐶", color: "var(--palette-amber-400)" },
  wolf:       { emoji: "🐺", color: "var(--palette-slate-400)" },
  lion:       { emoji: "🦁", color: "var(--palette-amber-400)" },
  tiger:      { emoji: "🐯", color: "var(--palette-orange-400)" },
  bear:       { emoji: "🐻", color: "var(--palette-amber-600)" },
  polarbear:  { emoji: "🐻‍❄️", color: "var(--foreground)" },
  rabbit:     { emoji: "🐰", color: "var(--palette-pink-300)" },
  bunny:      { emoji: "🐰", color: "var(--palette-pink-300)" },
  koala:      { emoji: "🐨", color: "var(--palette-slate-400)" },
  penguin:    { emoji: "🐧", color: "var(--palette-sky-400)" },
  duck:       { emoji: "🦆", color: "var(--palette-amber-400)" },
  bird:       { emoji: "🐦", color: "var(--palette-sky-400)" },
  eagle:      { emoji: "🦅", color: "var(--palette-amber-600)" },
  frog:       { emoji: "🐸", color: "var(--palette-emerald-400)" },
  monkey:     { emoji: "🐵", color: "var(--palette-amber-400)" },
  elephant:   { emoji: "🐘", color: "var(--palette-slate-400)" },
  hamster:    { emoji: "🐹", color: "var(--palette-amber-300)" },
  mouse:      { emoji: "🐭", color: "var(--palette-slate-400)" },
  deer:       { emoji: "🦌", color: "var(--palette-amber-500)" },
  hedgehog:   { emoji: "🦔", color: "var(--palette-amber-500)" },
  sloth:      { emoji: "🦥", color: "var(--palette-amber-600)" },
  dolphin:    { emoji: "🐬", color: "var(--palette-cyan-400)" },
  whale:      { emoji: "🐳", color: "var(--palette-blue-400)" },
  shark:      { emoji: "🦈", color: "var(--palette-slate-400)" },
  octopus:    { emoji: "🐙", color: "var(--palette-pink-500)" },
  jellyfish:  { emoji: "🪼", color: "var(--palette-purple-400)" },
  butterfly:  { emoji: "🦋", color: "var(--palette-violet-400)" },
  bee:        { emoji: "🐝", color: "var(--palette-yellow-400)" },
  dino:       { emoji: "🦖", color: "var(--palette-emerald-500)" },
  pikachu:    { emoji: "⚡", color: "var(--palette-yellow-400)" },
  charmander: { emoji: "🦎", color: "var(--palette-orange-500)" },
  charizard:  { emoji: "🐲", color: "var(--palette-orange-600)" },
  bulbasaur:  { emoji: "🌱", color: "var(--palette-emerald-400)" },
  squirtle:   { emoji: "🐢", color: "var(--palette-cyan-400)" },
  gengar:     { emoji: "👻", color: "var(--palette-purple-500)" },
  eevee:      { emoji: "🦊", color: "var(--palette-amber-400)" },
  snorlax:    { emoji: "🐻", color: "var(--palette-blue-400)" },
  mewtwo:     { emoji: "🔮", color: "var(--palette-purple-400)" },
  mew:        { emoji: "🌸", color: "var(--palette-pink-300)" },
  lucario:    { emoji: "🐺", color: "var(--palette-blue-400)" },
};

/** Fallback glyph per catalog category, mirroring the pets-page filter chips. */
const CATEGORY_EMOJI: Record<string, string> = {
  starter: "🌱",
  free: "🐾",
  achievement: "🏆",
  premium: "👑",
  seasonal: "🍂",
  event: "🎉",
  legendary: "🌟",
  exclusive: "💎",
  admin_drop: "🛡️",
};

const DEFAULT_VISUAL: PetSpeciesVisual = { emoji: "🐾", color: "var(--brand-400)" };

function matchSlugKeyword(slug: string): PetSpeciesVisual | undefined {
  const s = slug.toLowerCase().replace(/[^a-z]/g, "");
  if (s.includes("owl") || s.includes("noctowl") || s.includes("hoothoot")) return { emoji: "🦉", color: "var(--palette-amber-400)" };
  if (s.includes("fox") || s.includes("vulpix") || s.includes("ninetales") || s.includes("zoroark") || s.includes("zorua")) return { emoji: "🦊", color: "var(--color-error)" };
  if (s.includes("dragon") || s.includes("drake") || s.includes("charizard") || s.includes("rayquaza") || s.includes("salamence") || s.includes("garchomp")) return { emoji: "🐲", color: "var(--brand-500)" };
  if (s.includes("bot") || s.includes("robot") || s.includes("porygon") || s.includes("klink") || s.includes("magnemite") || s.includes("beldum")) return { emoji: "🤖", color: "var(--palette-06b6d4)" };
  if (s.includes("cat") || s.includes("neko") || s.includes("meow") || s.includes("purr") || s.includes("kitten") || s.includes("litten") || s.includes("sprigatito")) return { emoji: "🐱", color: "var(--palette-ec4899)" };
  if (s.includes("phoenix") || s.includes("moltres") || s.includes("hooh") || s.includes("talonflame")) return { emoji: "🦅", color: "var(--palette-f97316)" };
  if (s.includes("turtle") || s.includes("tortoise") || s.includes("squirtle") || s.includes("torkoal") || s.includes("turtwig")) return { emoji: "🐢", color: "var(--brand-teal)" };
  if (s.includes("panda") || s.includes("pancham") || s.includes("pangoro")) return { emoji: "🐼", color: "var(--foreground)" };
  if (s.includes("unicorn") || s.includes("rapidash") || s.includes("ponyta") || s.includes("keldeo")) return { emoji: "🦄", color: "var(--palette-violet-400)" };
  if (s.includes("axolotl") || s.includes("wooper") || s.includes("mudkip")) return { emoji: "🦎", color: "var(--palette-ec4899)" };
  if (s.includes("capybara") || s.includes("bidoof") || s.includes("bibarel")) return { emoji: "🦫", color: "var(--palette-amber-400)" };
  if (s.includes("otter") || s.includes("oshawott") || s.includes("buizel")) return { emoji: "🦦", color: "var(--palette-06b6d4)" };
  if (s.includes("dog") || s.includes("hound") || s.includes("pup") || s.includes("growlithe") || s.includes("arcanine") || s.includes("yamper") || s.includes("rockruff") || s.includes("fidough")) return { emoji: "🐶", color: "var(--palette-amber-400)" };
  if (s.includes("wolf") || s.includes("lucario") || s.includes("lycanroc") || s.includes("zacian") || s.includes("zamazenta")) return { emoji: "🐺", color: "var(--palette-blue-400)" };
  if (s.includes("lion") || s.includes("pyroar") || s.includes("shinx") || s.includes("luxray") || s.includes("solgaleo")) return { emoji: "🦁", color: "var(--palette-amber-400)" };
  if (s.includes("tiger") || s.includes("incineroar") || s.includes("raikou")) return { emoji: "🐯", color: "var(--palette-orange-400)" };
  if (s.includes("bear") || s.includes("teddiursa") || s.includes("ursaring") || s.includes("ursaluna") || s.includes("bewear") || s.includes("kubfu") || s.includes("urshifu")) return { emoji: "🐻", color: "var(--palette-amber-600)" };
  if (s.includes("rabbit") || s.includes("bunny") || s.includes("scorbunny") || s.includes("buneary") || s.includes("cinderace")) return { emoji: "🐰", color: "var(--palette-pink-300)" };
  if (s.includes("penguin") || s.includes("piplup") || s.includes("prinplup") || s.includes("empoleon") || s.includes("eiscue")) return { emoji: "🐧", color: "var(--palette-sky-400)" };
  if (s.includes("duck") || s.includes("psyduck") || s.includes("golduck") || s.includes("ducklett") || s.includes("quaxly")) return { emoji: "🦆", color: "var(--palette-amber-400)" };
  if (s.includes("bird") || s.includes("pidgey") || s.includes("fletchling") || s.includes("rookidee") || s.includes("rowlet") || s.includes("articuno") || s.includes("zapdos")) return { emoji: "🐦", color: "var(--palette-sky-400)" };
  if (s.includes("frog") || s.includes("toad") || s.includes("poliwag") || s.includes("froakie") || s.includes("greninja") || s.includes("croagunk")) return { emoji: "🐸", color: "var(--palette-emerald-400)" };
  if (s.includes("monkey") || s.includes("mankey") || s.includes("chimchar") || s.includes("infernape") || s.includes("grookey") || s.includes("aipom")) return { emoji: "🐵", color: "var(--palette-amber-400)" };
  if (s.includes("snake") || s.includes("ekans") || s.includes("arbok") || s.includes("snivy") || s.includes("serperior") || s.includes("seviper")) return { emoji: "🐍", color: "var(--palette-emerald-500)" };
  if (s.includes("dolphin") || s.includes("finizen") || s.includes("palafin")) return { emoji: "🐬", color: "var(--palette-cyan-400)" };
  if (s.includes("whale") || s.includes("wailmer") || s.includes("wailord") || s.includes("kyogre")) return { emoji: "🐳", color: "var(--palette-blue-400)" };
  if (s.includes("shark") || s.includes("sharpedo") || s.includes("gible")) return { emoji: "🦈", color: "var(--palette-slate-400)" };
  if (s.includes("octopus") || s.includes("octillery") || s.includes("clobbopus") || s.includes("grapploct")) return { emoji: "🐙", color: "var(--palette-pink-500)" };
  if (s.includes("butterfly") || s.includes("butterfree") || s.includes("beautifly") || s.includes("vivillon")) return { emoji: "🦋", color: "var(--palette-violet-400)" };
  if (s.includes("bee") || s.includes("beedrill") || s.includes("combee") || s.includes("vespiquen") || s.includes("ribombee")) return { emoji: "🐝", color: "var(--palette-yellow-400)" };
  if (s.includes("dino") || s.includes("saur") || s.includes("tyrantrum") || s.includes("tyrunt") || s.includes("baxcalibur")) return { emoji: "🦖", color: "var(--palette-emerald-500)" };
  if (s.includes("ghost") || s.includes("gastly") || s.includes("haunter") || s.includes("gengar") || s.includes("mimikyu") || s.includes("drifloon") || s.includes("litwick")) return { emoji: "👻", color: "var(--palette-purple-400)" };
  if (s.includes("star") || s.includes("staryu") || s.includes("starmie") || s.includes("jirachi") || s.includes("cosmog")) return { emoji: "⭐", color: "var(--palette-yellow-300)" };
  if (s.includes("pika") || s.includes("raichu") || s.includes("pichu") || s.includes("plusle") || s.includes("minun") || s.includes("pawmi") || s.includes("morpeko") || s.includes("dedenne")) return { emoji: "⚡", color: "var(--palette-yellow-400)" };
  return undefined;
}

/**
 * Resolve the visual for a pet. `slug` is the catalog slug (legacy pets store
 * it in `petType`); `category` is the catalog category, used only when the
 * slug is unknown (e.g. a Gemini-seeded catalog entry the UI has never seen).
 */
export function petSpeciesVisual(
  slug?: string | null,
  category?: string | null,
): PetSpeciesVisual {
  const cleanSlug = (slug ?? "").trim().toLowerCase().replace(/-3d$/, "").replace(/-2d$/, "");
  const bySlug = cleanSlug ? SPECIES[cleanSlug] : undefined;
  if (bySlug) return bySlug;

  const byKeyword = cleanSlug ? matchSlugKeyword(cleanSlug) : undefined;
  if (byKeyword) return byKeyword;

  const byCategory = category ? CATEGORY_EMOJI[category] : undefined;
  if (byCategory) return { emoji: byCategory, color: DEFAULT_VISUAL.color };
  return DEFAULT_VISUAL;
}

/** Emoji only — the common case. */
export function petSpeciesEmoji(slug?: string | null, category?: string | null): string {
  return petSpeciesVisual(slug, category).emoji;
}

/** Category chip glyph — shared with the pets page filters. */
export function petCategoryEmoji(category?: string | null): string {
  return (category ? CATEGORY_EMOJI[category] : undefined) ?? "🐾";
}
