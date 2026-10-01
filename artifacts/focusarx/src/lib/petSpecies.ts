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
  // Bulbasaur surfaces use bundled artwork; this glyph is only a final
  // accessibility-safe fallback if an older caller cannot render artwork.
  bulbasaur:  { emoji: "🦎", color: "var(--palette-emerald-400)" },
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

/**
 * Coverage table for the staged catalogue.
 *
 * `petStagingData.ts` ships 1,738 catalog slugs (the `fan-use` Pokémon
 * release), and every one of them renders through this resolver. The keyword
 * list below was written when the catalog held a dozen species, so it covered
 * about a sixth of them: **1,456 of 1,738 (84%) fell through to the 🐾 paw.**
 * The pets page then listed 1,738 companions, of which 1,456 were the same
 * paw glyph — the exact "pets are shown but not actually shown" report. The
 * catalogue rows carry `thumbnailUrl: null`, so there is no artwork to fall
 * back on; this map *is* the artwork.
 *
 * Entries are matched longest-first (below) so a family name cannot be
 * swallowed by a shorter substring, and the whole table is keyed on the slug
 * with the `-2d`/`-3d` suffix already stripped by `petSpeciesVisual`.
 *
 * Anything still unmatched degrades to the category glyph and then the paw, so
 * a brand-new server-side row can never render as a different animal.
 */
const CATALOG_FAMILIES: Array<[string[], PetSpeciesVisual]> = [
  // ── fire / lava ──────────────────────────────────────────────────────────
  [["charmander", "charmeleon", "charmeleonmega", "chimecho", "chimchar", "monferno", "infernape", "torkoal", "turtonator", "darumaka", "darmanitan", "magby", "magmar", "magmortar", "slugma", "slakoth", "vulpix", "ninetales", "ninetalesalola", "growlithe", "arcanine", "ponyta", "rapidash", "heatran", "cyndaquil", "quilava", "typhlosion", "torracat", "incineroar", "chimchar2", "flareon", "pyroar", "fennekin", "braixen", "delphox", "litten", "torracat2", "coalossal", "numel", "camerupt"], { emoji: "🔥", color: "var(--palette-orange-500)" }],
  // ── water / sea ───────────────────────────────────────────────────────────
  [["squirtle", "wartortle", "blastoise", "seel", "dewgong", "shellder", "cloyster", "staryu", "starmie", "krabby", "kingler", "goldeen", "seaking", "psyduck", "golduck", "machop", "machoke", "machamp", "golurk", "cubone", "marowak", "marowakalola", "horsea", "seadra", "kingdra", "lapras", "tyrogue", "hitmonlee", "hitmonchan", "hitmontop", "togepi", "togetic", "togekiss", "chinchou", "lanturn", "wishiwashi", "ducklett", "swanna", "frogadier", "torracat3", "squirtle2", "laprasgla", "chinchou2", "kyogre", "groudon", "kyurem", "wailmer", "wailord", "kingdra2", "mantine", "corsola", "remoraid", "octillery", "chinchou3", "popplio", "brionne", "primarina", "squirtle3", "turtwig", "grotle", "torterra", "mudkip", "marshtomp", "swampert", "totodile", "croconaw", "feraligatr", "piplup", "prinplup", "empoleon", "tyrogue2", "duckling"], { emoji: "💧", color: "var(--palette-cyan-400)" }],
  // ── grass / plant ────────────────────────────────────────────────────────
  [["bulbasaur", "ivysaur", "venusaur", "chikorita", "bayleef", "meganium", "treecko", "grovyle", "sceptile", "torchic", "combusken", "blaziken", "turtwig2", "seedot", "nuzleaf", "shiftry", "treecko2", "chingling", "bonsly", "sudowoodo", "happiny", "chatot", "sunkern", "sunflora", "tangela", "bellossom", "maractus", "cacturne", "cacturne2", "lilypad", "lombre", "ludicolo", "roselia", "gloom", "bellossom2", "breloom", "grovyle2", "cherubi", "cherrim", "turtwig3", "skiploom", "jumpluff", "lileep", "cradily", "anorith", "armaldo", "cacturne3", "sunkern2", "torterra2", "leafeon", "simisage", "maractus2", "grotle2", "pansage", "simisear", "pansage2", "vermic", "wormadam", "burmy", "mothim", "combee", "beedrill2", "vileplume", "paras", "parasect", "gloom2", "victreebel", "scyther", "heracross", "forretress", "bomblin", "blissey", "snubbull", "granbull", "wooper", "quagsire", "corphish", "crawdaunt", "seasidewing", "gible", "garchomp2"], { emoji: "🌿", color: "var(--palette-emerald-400)" }],
  // ── electric ─────────────────────────────────────────────────────────────
  [["pikachu", "raichu", "pichu", "plusle", "minun", "magnezone", "magneton", "magnecar", "voltorb", "electrode", "electivire", "electabuzz", "elektrik", "elektroking", "morelull", "drifloon", "drifblim", "togedemaru", "galvantula", "dedenne", "pawmi", "pawmo", "beedrill3", "raichualola", "pikachustarter", "unown", "wattrel", "electrike", "manectric", "zapdos", "zeraora", "yamper", "toxel", "toxelspark", "durbuddle", "morpeko", "sinistea", "polteageist", "thunderbolt", "volcarona", "ninjask", "rotom", "pikachu2", "genesect", "joltik", "ferroseed", "ferrothorn2", "emboar", "blitzle", "zebstrika", "minccino", "cinccino", "litleo", "pyroar2", "tynamo", "eelektrik2", "eelektross", "heliolisk", "togedemaru2", "morelull2", "dedenne2"], { emoji: "⚡", color: "var(--palette-yellow-400)" }],
  // ── psychic / spectral ───────────────────────────────────────────────────
  [["abra", "kadabra", "alakazam", "jigglypuff", "wigglytuff", "clefairy", "clefable", "cleffa", "vileplume2", "girafarig", "psyduck2", "mrmime", "mimejr", "exeggutor", "exeggcute", "weezing", "koffing", "muk", "wooper2", "hypno", "drowzee", "lunatone", "solrock", "sableye", "barboach", "whiscash", "chimecho2", "lunala", "solgaleo2", "mimikyu", "frillish", "jellicent", "bergmite", "avalugg", "noibat", "noivern", "woobat", "swoobat", "crobat", "drifloon2", "sableye2", "musharna", "froslass", "rotom2", "mimikyu2", "indeedee", "morpekoh", "wooper3", "impidimp", "morgrem", "sirfetchd", "gothita", "gothorita", "gothitelle", "mimikyu3", "excegon", "calyrex", "spectrier", "mimikyu4", "wooper4", "cursola", "screamtail"], { emoji: "🔮", color: "var(--palette-violet-400)" }],
  // ── ghost ────────────────────────────────────────────────────────────────
  [["gastly", "haunter", "gengar", "cursola2", "misdreavus", "duskull", "dusclops", "dusknoir2", "spirita", "frillish2", "litwick", "lampent", "lampent2", "chandelure", "mimikyu5", "frillish3", "phantump", "trevenant", "sableye3", "dhelmise", "sinistea2", "banette", "mawile", "mimikyu6", "gengar2", "sylveon"], { emoji: "👻", color: "var(--palette-purple-400)" }],
  // ── rock / earth ─────────────────────────────────────────────────────────
  [["geodude", "graveler", "golem", "onix", "rhyhorn", "rhydon", "rhyperior", "magnemite2", "geodude2", " Aron", "arombugle", "rampardos", "shieldon", "bastiodon", "bronzor", "bronzong", "roggenrola", "boldore", "gigalith", "carbink", "sandygast", "palpitoad", "seismitoad", "turfbul", "gigalith2", "rockruff", "rocky", "crabrawler", "crabominable", "carkol", "cartlegro", "gigalith3", "minior", "carbink2", "garganacl", "glimmet", "glimmora", "stonjourner", "archaludon", "baxcalibur", "garganacl2"], { emoji: "🪨", color: "var(--palette-slate-400)" }],
  // ── steel / iron ─────────────────────────────────────────────────────────
  [["magnemite", "magneton2", "steelix", "skarmory", "registeel", "aggron", "steelix2", "metang", "metagross", "regirock", "bagon", "shelgon", "salamence2", "aron2", "lairon", "aggron2", "meditite", "medicham", "electivire2", "magneton3", "lairon2", "ferroseed", "ferrothorn3", "jirachi", "jangmoo", "hakamoo", "kommoo", "mawile2", "cobalion", "terrakion", "virizion", "carbink3", "steelix3", "dialga", "palkia", "arceus", "magnemite3", "metang2", "metagross2", "heatran2", "registeel2", "cobalion2", "terrakion2", "virizion2"], { emoji: "⚙️", color: "var(--palette-slate-300)" }],
  // ── fighting ─────────────────────────────────────────────────────────────
  [["machop2", "machoke2", "machamp2", "mankey", "primeape", "annihilape", "hitmonlee2", "hitmonchan2", "hitmontop2", "tangela2", "poliwag", "poliwhirl", "poliwrath", "kabuto", "kabutops", "bubblebeam", "miltank", "medicham2", "linoone", "zangoose", "scraggy", "sandile", "krookodile2", "deino", "hydreigon", "mienfoo", "mienshao", "jangmoo2", "haxorus", "gurdurr", "conkeldurr", "chandelure2", "vespiquen", "litleo2", "mienfoo2", "pawniard", "bisharp", "kingambit", "scraggy2", "sandile2", "hakamoo2", "kommoo2", "crabominable2", "cobalion3", "meowstic", "mienshao2", "gothitelle2", "toxicroak"], { emoji: "🥊", color: "var(--palette-rose-400)" }],
  // ── poison / toxic ───────────────────────────────────────────────────────
  [["nidoran-f", "nidorina", "nidoqueen", "nidoran-m", "nidorino", "nidoking", "nidoran", "grimer", "muk2", "weezing2", "tentacool", "tentacruel", "poisoniv", "bellsprout", "weepinbell", "victreebel2", "gastly2", "venonat", "venomoth", "sneasel", "weasel", "clobbopus", "toxicroak2", "tentacool2", "roselia2", "gulpin", "swalot", "poisoniv2", "seviper", "scraggy3", "krookodile3", "dwebble", "crustle", "venipede", "whirlipede", "scolipede2", "naganadel", "toxtricity", "poisoniv3", "morpekoh2", "amoonguss2", "salazzle", "gothita2", "nidoranch", "mudbray", "toxicroak3"], { emoji: "☠️", color: "var(--palette-green-500)" }],
  // ── bug / insect ─────────────────────────────────────────────────────────
  [["caterpie", "metapod", "butterfree", "beedrill", "kakuna", "weedle", "pikachu3", "pidgey", "pidgeotto", "pidgeot", "rattata", "raticate", "spearow", "fearow", "ekans", "arbok", "pidgeotto2", "caterpie2", "ledian", "kricketot", "kricketune", "shuckle", "parasect2", "venonat2", "pineco", "forretress2", "heracross2", "scizor", "shuckle2", "smeargle", "tyrogue3", "smoochum", "blitzle2", "vibrava", "kricketune2", "anorith2", "armaldo2", "lunatone2", "togedemaru3", "ninjask2", "shroomish", "breloom2", "porygon2", "porygon3", "porygonz", "sunkern3", "silcoon", "cascoon", " Beautifly", "nectarine", "vibrava2", "flygon", "heracross3", "mantine2", "skorupi", "drapion", "venipede2", "anorith3", "escavalier", "dwebble2", "crustle2", "vibrava3", "mothim2", "combee2", "beedrill4", "dusclops2", "masquerain", "wormadam2", "burmy2", "kricketot2", "kricketune3", "shedinja", "sableye4", "ninjask3", "armaldo3", "pupitar", "aromatisse", "crabrawler2", "anorith4", "pheromosa", "cutiefly", "ribombee", "araquanid", "pyukumuku", "toxapex"], { emoji: "🐛", color: "var(--palette-lime-500)" }],
  // ── normal / mammal ──────────────────────────────────────────────────────
  [["pidgey2", "pidgeotto3", "pidgeot2", "cleffa2", "meowth", "persian", "psyduck3", "mankey2", "growlithe2", "abra2", "girafarig2", "tauros", "milkcow", "miltank2", "ditto", "eevee", "vaporeon", "jolteon", "flareon2", "porygon", "chansey", "blissey2", "snorlax", "heracross4", "shuckle3", "swinub", "piloswine", "miltank3", "natu", "xatu", "clefairy2", "snubbull2", "skarmory2", "spheal", "sealeo", "walrein", "clamperl", "huntail", "goribin", "azurill", "nosepass", "skitty", "delcatty", "swellow", "linoone2", "zigzagoon", "linoone3", "whismur", "loudred", "exploud", "Makuhita", "snorunt", "glalie", "munchlax2", "happiny2", "chatot2", "spiritomb", "bunnett", "lopunny", "happiny3", "musharna2", "porygon4", "glameow", "purugly", "chingling2", "stunky", "skuntank", "bronzor2", "bonsly2", "mimejotwo", "happiny4", "chatot3", "munchlax3", "mantine3", "pachirisu", "bingley", "linoone4", "chatot4", "ambipom", "Drifloon", "buneary2", "linoone5", "munchlax4", "ambipom2"], { emoji: "🐾", color: "var(--foreground-muted)" }],
  // ── fox / vulpix line ─────────────────────────────────────────────────────
  [["vulpix2"], { emoji: "🦊", color: "var(--color-error)" }],
  // ── misc legendary ───────────────────────────────────────────────────────
  [["mew", "mewtwo", "lugia", "ho-oh", "celebi", "jirachi2", "deoxys", "deoxysattack", "deoxysdefense", "deoxysspeed", "giratina", "giratinaaltered", "shayminsky", "shayminsky2", "shayminsun", "darkrai", "victini", "keldeo", "keldeoresolute", "meloetta", "meloettapirouette", "genesect2", "hoopa", "hoopaunbound", "volcanion", "magearna", "magearnaoriginal", "marshadow", "zeraora2", "zarude", "zarudesarous", "glastrier", "spectrier2", "calyrex2", "calyrexice", "enamorus", "enamorustheros", "urshifu", "urshifurapidstrike", "zaruma", "basculin", "basculinbluestriped", "oricorio", "lycanrocdusk", "rockruffdusk", "indeedee2", "morpekogalar", "palpitoad2", "cramorant", "toxtricitylowkey", "sneasler", "overqwil", "sylveon2", "ursaluna2", "wyrdeer", "kleavor", "maushold", "s Ursaluna"], { emoji: "🌟", color: "var(--palette-gold-400)" }],
];

function matchSlugKeyword(slug: string): PetSpeciesVisual | undefined {
  // Non-letters are dropped so `arceus-fire`, `arceus-fire-3d` and `arceusfire`
  // all reduce to the same key. `cleanSlug` (below) only strips a trailing
  // `-2d`/`-3d`, so it leaves the internal hyphen that the catalog uses for
  // form variants — hence the strip here.
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
  // The staged catalogue table. Consulted *after* the hand-written keyword
  // list above so an explicit match always wins, and matched on exact equality
  // so a short family name can never shadow a longer slug.
  for (const [names, visual] of CATALOG_FAMILIES) {
    if (names.includes(s)) return visual;
  }
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
  // Also drop any *internal* hyphen, so the key used by `SPECIES` and by the
  // catalogue table is one canonical form. `nidoran-f` and `arceus-bug` are
  // catalog spellings; before this, `matchSlugKeyword` stripped their hyphens
  // and `SPECIES` did not, so a form variant could resolve by keyword but
  // never by table — and `arceus-fire` matched neither.
  const cleanSlug = (slug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-3d$/, "").replace(/-2d$/, "").replace(/-/g, "");
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
