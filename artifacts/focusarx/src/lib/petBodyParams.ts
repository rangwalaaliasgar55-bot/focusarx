/**
 * Body parameters — one description of an animal, shared by the 2D faces and
 * the 3D body.
 *
 * `lib/petSpecies.ts` answers "which glyph and colour is this species" for
 * surfaces that print a picture. This module answers a different question:
 * "what *shape* is this species" — ears, tail, beak, wings, snout, horns,
 * proportions — so a companion can be built rather than pasted.
 *
 * The catalog holds ~1,700 slugs, and before this every one of them that was
 * not one of the original six species rendered as the same owl in the 3D view.
 * A procedural body that only knows six animals is a tax on every future
 * release, so the resolver here works the way `petSpeciesVisual` does: explicit
 * families first (longest match wins), then a **deterministic archetype** — the
 * slug hashes into one of six body plans — so an unknown species still arrives
 * as a plausible animal of its own instead of a placeholder.
 *
 * Colours are hex, not CSS custom properties: the 3D renderer hands them to
 * `THREE.Color`, which cannot parse `var(--palette-amber-400)`. The 2D faces
 * that read these params (the companion trail, the garden) use the same hexes so
 * both renderings of one animal agree.
 */

export type EarKind = "round" | "pointy" | "long" | "tuft" | "none";
export type TailKind = "fluffy" | "long" | "stub" | "none";
export type BodyPlan = "quadruped" | "bird" | "aquatic" | "serpent" | "insect" | "blob";

export interface PetBodyParams {
  /** Body colour (hex). */
  body: string;
  /** Belly / chest colour (hex). */
  belly: string;
  /** Optional marking colour used for patches, masks and limbs (hex). */
  patch?: string;
  ears: EarKind;
  tail: TailKind;
  beak?: boolean;
  wings?: boolean;
  snout?: boolean;
  horns?: boolean;
  /** 1 = normal, <1 flatter (slime), >1 taller. */
  squish?: number;
  /** Overall size multiplier for the 3D stage. */
  scale?: number;
  plan: BodyPlan;
}

const hex = (value: string) => value;

/** Hand-written families. Matched longest-first against a normalised slug. */
const FAMILIES: Array<{ keys: string[]; params: Omit<PetBodyParams, "plan"> & { plan?: BodyPlan } }> = [
  {
    keys: ["owl", "hoot", "noctowl", "hoothoot", "rowlet"],
    params: { body: hex("#b98a5c"), belly: hex("#f1e1c4"), patch: hex("#8a6035"), ears: "tuft", tail: "stub", beak: true, wings: true, plan: "bird" },
  },
  {
    keys: ["fox", "vulpix", "ninetales", "zoroark", "zorua", "eevee", "fennekin", "braixen", "delphox"],
    params: { body: hex("#e8793a"), belly: hex("#fbe7cf"), patch: hex("#fff3e3"), ears: "pointy", tail: "fluffy", snout: true },
  },
  {
    keys: ["dog", "puppy", "pup", "hound", "growlithe", "arcanine", "yamper", "rockruff", "fidough", "shiba", "dachsbun", "lillipup", "herdier", "boltund"],
    params: { body: hex("#d9a066"), belly: hex("#fdf3e3"), patch: hex("#8a5a2b"), ears: "pointy", tail: "fluffy", snout: true },
  },
  {
    keys: ["wolf", "lucario", "lycanroc", "zacian", "zamazenta", "poochyena", "mightyena", "maschiff", "mabosstiff", "okidogi"],
    params: { body: hex("#7c8698"), belly: hex("#e9eef5"), patch: hex("#4b5563"), ears: "pointy", tail: "long", snout: true },
  },
  {
    keys: ["cat", "neko", "kitten", "meow", "purr", "litten", "sprigatito", "skitty", "delcatty", "meowth", "persian", "espeon", "umbreon", "sylveon", "glaceon", "leafeon", "flareon", "vaporeon", "jolteon", "eeveelution"],
    params: { body: hex("#4b5563"), belly: hex("#f6f8fb"), patch: hex("#27272b"), ears: "pointy", tail: "long", snout: true },
  },
  {
    keys: ["tiger", "incineroar", "raikou", "growlithe2", "pyroar", "litleo"],
    params: { body: hex("#e0913c"), belly: hex("#fdeacc"), patch: hex("#3b2f22"), ears: "round", tail: "long", snout: true },
  },
  {
    keys: ["lion", "shinx", "luxio", "luxray", "solgaleo", "mane"],
    params: { body: hex("#d8a24a"), belly: hex("#fbf0d8"), patch: hex("#8a5a1e"), ears: "round", tail: "long", snout: true },
  },
  {
    keys: ["bear", "panda", "teddiursa", "ursaring", "ursaluna", "bewear", "kubfu", "urshifu", "snorlax", "stufful", "pancham", "pangoro", "cubchoo"],
    params: { body: hex("#8a6a4b"), belly: hex("#f6ead9"), patch: hex("#3c2d20"), ears: "round", tail: "stub", snout: true, squish: 1.08 },
  },
  {
    keys: ["panda"],
    params: { body: hex("#f4f4f2"), belly: hex("#ffffff"), patch: hex("#27272b"), ears: "round", tail: "stub", snout: true, squish: 1.06 },
  },
  {
    keys: ["capybara", "bidoof", "bibarel", "marmot", "beaver", "patrat", "watchog"],
    params: { body: hex("#a8794c"), belly: hex("#efdcbf"), patch: hex("#6b4a28"), ears: "round", tail: "stub", snout: true, squish: 1.12 },
  },
  {
    keys: ["otter", "oshawott", "buizel", "floatzel", "dewott", "samurott", "lutra"],
    params: { body: hex("#8a6a52"), belly: hex("#f2e4d0"), patch: hex("#5a4330"), ears: "round", tail: "long", snout: true },
  },
  {
    keys: ["rabbit", "bunny", "buneary", "lopunny", "scorbunny", "raboot", "cinderace", "azumarill", "marill", "bunnelby", "diggersby"],
    params: { body: hex("#e8ded2"), belly: hex("#ffffff"), patch: hex("#c9b7a4"), ears: "long", tail: "stub", snout: true, squish: 0.98 },
  },
  {
    keys: ["mouse", "hamster", "rat", "pichu", "pikachu", "raichu", "pawmi", "pawmo", "pawmot", "dedenne", "togedemaru", "minccino", "cinccino", "maushold", "tandemaus", "rattata", "raticate"],
    params: { body: hex("#e7c58a"), belly: hex("#fdf6e6"), patch: hex("#b98a4a"), ears: "round", tail: "long", snout: true, squish: 0.92 },
  },
  {
    keys: ["hedgehog", "hedgehog2", "chespin", "quilladin", "chesnaught", "sandslash", "sandshrew", "cyndaquil", "quilava", "typhlosion"],
    params: { body: hex("#a98253"), belly: hex("#f3e2c4"), patch: hex("#5c452c"), ears: "tuft", tail: "stub", snout: true },
  },
  {
    keys: ["sloth", "slakoth", "vigoroth", "slaking", "komala", "slowpoke", "slowbro", "slowking"],
    params: { body: hex("#b08a63"), belly: hex("#f4e5cf"), patch: hex("#7a5c3e"), ears: "round", tail: "stub", snout: true, squish: 1.1 },
  },
  {
    keys: ["deer", "stag", "xerneas", "deerling", "sawsbuck", "stantler", "girafarig", "farigiraf"],
    params: { body: hex("#c08b52"), belly: hex("#f8ecd8"), patch: hex("#f6f1e6"), ears: "pointy", tail: "stub", horns: true, snout: true },
  },
  {
    keys: ["elephant", "phanpy", "donphan", "cufant", "copperajah", "greattusk"],
    params: { body: hex("#9aa3b2"), belly: hex("#e8ecf3"), patch: hex("#6b7280"), ears: "long", tail: "stub", snout: true, squish: 1.15, scale: 1.12 },
  },
  {
    keys: ["monkey", "mankey", "primeape", "aipom", "ambipom", "chimchar", "monferno", "infernape", "grookey", "thwackey", "rillaboom", "pansage", "simisage", "pansear", "simisear", "panpour", "simipour"],
    params: { body: hex("#a8794c"), belly: hex("#f0dcc0"), patch: hex("#7a5230"), ears: "round", tail: "long", snout: true },
  },
  {
    keys: ["unicorn", "ponyta", "rapidash", "keldeo", "mudsdale", "mudbray", "pony", "zebstrika", "blitzle"],
    params: { body: hex("#d9c8f0"), belly: hex("#f7f1ff"), patch: hex("#a98bd6"), ears: "pointy", tail: "long", horns: true, snout: true, scale: 1.08 },
  },
  {
    keys: ["penguin", "piplup", "prinplup", "empoleon", "eiscue", "spheal", "sealeo", "walrein"],
    params: { body: hex("#33465f"), belly: hex("#f6f8fb"), patch: hex("#f2b33d"), ears: "none", tail: "stub", beak: true, wings: true, plan: "bird" },
  },
  {
    keys: ["duck", "psyduck", "golduck", "ducklett", "swanna", "quaxly", "quaxwell", "quaquaval", "farfetchd", "sirfetchd", "wingull", "pelipper"],
    params: { body: hex("#e5c76b"), belly: hex("#fdf6dd"), patch: hex("#d08c2e"), ears: "none", tail: "stub", beak: true, wings: true, plan: "bird" },
  },
  {
    keys: ["bird", "pidgey", "pidgeotto", "pidgeot", "fletchling", "fletchinder", "talonflame", "rookidee", "corvisquire", "corviknight", "starly", "staravia", "staraptor", "chatot", "pidove", "tranquill", "unfezant", "squawkabilly", "flamigo", "swablu", "altaria", "noibat", "noivern", "woobat", "swoobat", "zubat", "golbat", "crobat"],
    params: { body: hex("#8fb4d9"), belly: hex("#eef5fb"), patch: hex("#5b7fa6"), ears: "none", tail: "stub", beak: true, wings: true, plan: "bird" },
  },
  {
    keys: ["phoenix", "moltres", "hooh", "ho-oh", "talonflame2", "blaziken", "torchic", "combusken", "fletchling2", "oricorio"],
    params: { body: hex("#e8703a"), belly: hex("#ffe0b8"), patch: hex("#ffd166"), ears: "tuft", tail: "fluffy", beak: true, wings: true, plan: "bird", scale: 1.06 },
  },
  {
    keys: ["eagle", "braviary", "rufflet", "hawlucha", "mandibuzz", "vullaby", "honchkrow", "murkrow", "skarmory", "archeops", "archen"],
    params: { body: hex("#7a6a58"), belly: hex("#f0e6d8"), patch: hex("#d9c07a"), ears: "none", tail: "fluffy", beak: true, wings: true, plan: "bird", scale: 1.05 },
  },
  {
    keys: ["turtle", "tortoise", "squirtle", "wartortle", "blastoise", "torkoal", "turtwig", "grotle", "torterra", "turtonator", "chewtle", "drednaw", "squirtle2"],
    params: { body: hex("#6fae7c"), belly: hex("#eef7e6"), patch: hex("#c8952f"), ears: "none", tail: "stub", snout: true, squish: 0.94 },
  },
  {
    keys: ["dragon", "drake", "charizard", "charmander", "charmeleon", "dratini", "dragonair", "dragonite", "rayquaza", "salamence", "garchomp", "gible", "gabite", "axew", "fraxure", "haxorus", "goomy", "sliggoo", "goodra", "dreepy", "drakloak", "dragapult", "applin", "dipplin", "hydrapple", "cyclizar", "tatsugiri", "duraludon", "archaludon", "baxcalibur", "tyrunt", "tyrantrum"],
    params: { body: hex("#7a62d9"), belly: hex("#e8dfff"), patch: hex("#f2b33d"), ears: "none", tail: "long", wings: true, horns: true, snout: true, scale: 1.1 },
  },
  {
    keys: ["frog", "toad", "poliwag", "poliwhirl", "poliwrath", "froakie", "frogadier", "greninja", "croagunk", "toxicroak", "seismitoad", "bellibolt", "tadbulb"],
    params: { body: hex("#6fbf73"), belly: hex("#eafbe4"), patch: hex("#3f8f4a"), ears: "none", tail: "none", snout: true, squish: 0.88 },
  },
  {
    keys: ["axolotl", "wooper", "quagsire", "mudkip", "marshtomp", "swampert", "salamander"],
    params: { body: hex("#e39ac1"), belly: hex("#ffe9f4"), patch: hex("#b76a97"), ears: "tuft", tail: "long", snout: true, squish: 0.9 },
  },
  {
    keys: ["dolphin", "finizen", "palafin", "gorebyss", "lumineon"],
    params: { body: hex("#63b7d8"), belly: hex("#eaf7fd"), patch: hex("#2f7d9e"), ears: "none", tail: "long", plan: "aquatic" },
  },
  {
    keys: ["whale", "wailmer", "wailord", "kyogre", "dondozo", "lapras", "mantine", "mantyke", "alomomola"],
    params: { body: hex("#4f7fd8"), belly: hex("#eaf1fd"), patch: hex("#2c4f9e"), ears: "none", tail: "long", scale: 1.2, plan: "aquatic" },
  },
  {
    keys: ["shark", "sharpedo", "gible2", "barraskewda", "wiglett", "wugtrio", "dracovish", "arctovish"],
    params: { body: hex("#7f8fa6"), belly: hex("#eef2f7"), patch: hex("#41506b"), ears: "none", tail: "long", plan: "aquatic" },
  },
  {
    keys: ["octopus", "octillery", "clobbopus", "grapploct", "omanyte", "omastar"],
    params: { body: hex("#d97f9e"), belly: hex("#ffe6ef"), patch: hex("#a24f70"), ears: "none", tail: "none", squish: 0.86, plan: "aquatic" },
  },
  {
    keys: ["jellyfish", "tentacool", "tentacruel", "frillish", "jellicent", "nihilwjelly", "naganadel"],
    params: { body: hex("#9a7fe0"), belly: hex("#f0e9ff"), patch: hex("#6a4fb0"), ears: "none", tail: "none", squish: 0.8, plan: "aquatic" },
  },
  {
    keys: ["snake", "ekans", "arbok", "snivy", "servine", "serperior", "seviper", "onix", "steelix", "dratini2", "sandaconda", "silicobra", "dunsparce"],
    params: { body: hex("#6fbf73"), belly: hex("#f1fbe9"), patch: hex("#3d8a4a"), ears: "none", tail: "long", snout: true, plan: "serpent" },
  },
  {
    keys: ["butterfly", "butterfree", "beautifly", "vivillon", "mothim", "dustox", "venomoth", "frosmoth", "volcarona", "larvesta"],
    params: { body: hex("#9a7fe0"), belly: hex("#f3eeff"), patch: hex("#ffd166"), ears: "none", tail: "none", wings: true, squish: 0.84, plan: "insect" },
  },
  {
    keys: ["bee", "beedrill", "combee", "vespiquen", "ribombee", "cutiefly", "heracross", "pinsir"],
    params: { body: hex("#e5c76b"), belly: hex("#fff6da"), patch: hex("#3b2f22"), ears: "none", tail: "none", wings: true, squish: 0.88, plan: "insect" },
  },
  {
    keys: ["spider", "ariados", "galvantula", "joltik", "dewpiders", "dewpider", "araquanid", "tarountula", "spidops"],
    params: { body: hex("#5b6470"), belly: hex("#dfe5ee"), patch: hex("#f2b33d"), ears: "none", tail: "none", squish: 0.82, plan: "insect" },
  },
  {
    keys: ["slime", "slimey", "goomy2", "ditto", "solosis", "duosion", "reuniclus", "gulpin", "swalot", "grimer", "muk", "wigglytuff", "jigglypuff", "clefairy", "clefable", "chansey", "blissey", "happiny"],
    params: { body: hex("#8fd4c1"), belly: hex("#dbfff3"), patch: hex("#5aa894"), ears: "round", tail: "none", squish: 0.82, plan: "blob" },
  },
  {
    keys: ["robot", "bot", "porygon", "porygon2", "porygonz", "klink", "klang", "klinklang", "magnemite", "magneton", "magnezone", "beldum", "metang", "metagross", "varoom", "revavroom", "gimmighoul", "gholdengo"],
    params: { body: hex("#6f8fb0"), belly: hex("#e6eef7"), patch: hex("#06b6d4"), ears: "none", tail: "stub", squish: 1, scale: 1.02 },
  },
  {
    keys: ["ghost", "gastly", "haunter", "gengar", "mimikyu", "drifloon", "drifblim", "litwick", "lampent", "chandelure", "phantump", "trevenant", "pumpkaboo", "gourgeist", "shuppet", "banette", "duskull", "dusclops", "dusknoir", "yamask", "cofagrigus", "spiritomb", "sableye"],
    params: { body: hex("#6f5aa8"), belly: hex("#e6dcff"), patch: hex("#b39ddb"), ears: "tuft", tail: "none", squish: 0.9, plan: "blob" },
  },
  {
    keys: ["dino", "saur", "tyrunt2", "tyrantrum2", "bastiodon", "shieldon", "rampardos", "cranidos", "torterra2"],
    params: { body: hex("#6fa87c"), belly: hex("#eaf7e6"), patch: hex("#456b4f"), ears: "none", tail: "long", horns: true, snout: true, scale: 1.14 },
  },
  {
    keys: ["seal", "seel", "dewgong", "spheal2", "popplio", "brionne", "primarina"],
    params: { body: hex("#9fc6dd"), belly: hex("#f1f8fc"), patch: hex("#6c9dbb"), ears: "none", tail: "stub", plan: "aquatic" },
  },
  {
    keys: ["koala", "komala2", "gumshoos"],
    params: { body: hex("#9aa3b2"), belly: hex("#eef1f6"), patch: hex("#6b7280"), ears: "round", tail: "stub", snout: true },
  },
  {
    keys: ["bat", "zubat2", "golbat2", "gliscor", "gligar"],
    params: { body: hex("#7a6ca8"), belly: hex("#e9e3f7"), patch: hex("#4c3f78"), ears: "long", tail: "stub", wings: true, snout: true, scale: 0.96 },
  },
];

const PLANS: BodyPlan[] = ["quadruped", "bird", "aquatic", "serpent", "insect", "blob"];

const DEFAULT_PARAMS: PetBodyParams = {
  body: "#8a8f98",
  belly: "#e9edf3",
  patch: "#5b6470",
  ears: "round",
  tail: "stub",
  snout: true,
  plan: "quadruped",
};

/** FNV-1a — small, stable, and dependency-free. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Category hints the emoji resolver also honours, expressed as body plans. */
const CATEGORY_PLAN: Record<string, BodyPlan> = {
  starter: "quadruped",
  free: "quadruped",
  achievement: "bird",
  premium: "quadruped",
  seasonal: "bird",
  event: "blob",
  legendary: "serpent",
  exclusive: "quadruped",
  admin_drop: "insect",
};

/** Palette used for the deterministic fallback — hue varies, tone stays sane. */
const FALLBACK_PALETTE: Array<{ body: string; belly: string; patch: string }> = [
  { body: "#c58a4c", belly: "#fbeedb", patch: "#8a5a2b" },
  { body: "#7f9ec4", belly: "#eaf1fb", patch: "#4c6b93" },
  { body: "#8fbf8a", belly: "#eef9ea", patch: "#547a52" },
  { body: "#b58ac4", belly: "#f5eafa", patch: "#7a4f8a" },
  { body: "#c98f9f", belly: "#fdeef3", patch: "#8a4f60" },
  { body: "#8fc4bd", belly: "#e9f9f6", patch: "#4f7f79" },
  { body: "#b8a06a", belly: "#f9f2df", patch: "#7a6338" },
  { body: "#9a9ab0", belly: "#f0f0f6", patch: "#5f5f78" },
];

/**
 * Resolve a species to body parameters.
 *
 * Order, and why: an explicit family match always wins (a "penguin" must never
 * be drawn as a generic quadruped); otherwise the category hint seeds the body
 * plan and the slug hash picks the palette and a couple of details. The hash is
 * what makes two unknown species look like *different* animals — the same
 * species always resolves identically, so a companion does not change shape on
 * reload.
 */
export function petBodyParams(slug?: string | null, category?: string | null): PetBodyParams {
  const clean = (slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-3d$/, "")
    .replace(/-2d$/, "")
    .replace(/-/g, "");

  if (clean) {
    // Longest key first: "polarbear" must not be answered by "bear2", and a
    // family name must not be swallowed by a shorter substring of another.
    let match: (typeof FAMILIES)[number] | undefined;
    let matchLength = 0;
    for (const family of FAMILIES) {
      for (const key of family.keys) {
        // Longest keyword wins, so a species whose name contains a broader
        // family's keyword (a "capybara" containing "bear", say) resolves to the
        // family that names it most precisely rather than to the first match.
        if (key.length > matchLength && clean.includes(key)) {
          match = family;
          matchLength = key.length;
        }
      }
    }
    if (match) {
      // An exact family word (one hit) is stronger evidence than a substring
      // shared by several families; either way the longest key wins.
      return { plan: match.params.plan ?? DEFAULT_PARAMS.plan, ...match.params };
    }
  }

  const seed = hash(clean || category || "companion");
  const palette = FALLBACK_PALETTE[seed % FALLBACK_PALETTE.length]!;
  const plan = (category && CATEGORY_PLAN[category]) || PLANS[seed % PLANS.length]!;
  const ears: EarKind =
    plan === "bird" || plan === "aquatic" || plan === "serpent" ? "none" : (["round", "pointy", "tuft", "long"] as EarKind[])[(seed >> 3) % 4]!;
  const tail: TailKind = plan === "insect" || plan === "blob" ? "none" : (["fluffy", "long", "stub"] as TailKind[])[(seed >> 7) % 3]!;

  return {
    body: palette.body,
    belly: palette.belly,
    patch: palette.patch,
    ears,
    tail,
    beak: plan === "bird",
    wings: plan === "bird" || plan === "insect",
    snout: plan === "quadruped" || plan === "aquatic",
    horns: plan === "serpent" && seed % 3 === 0,
    squish: plan === "blob" ? 0.84 : 1,
    plan,
  };
}
