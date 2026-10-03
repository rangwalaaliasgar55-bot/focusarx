/**
 * Pet battle engine — a small, pure, deterministic turn-based fight.
 *
 * Ported from the PR #99 design uploads (`lib/battle.ts`), where the arena was
 * the centrepiece of the redesign. What changed in the port is the *inputs*: the
 * source carried a hand-written species table, and this app's catalog holds
 * ~1,700 slugs that must all be able to fight. So a fighter's numbers are
 * derived from its slug (stably — the same species always fights the same way)
 * plus its level, and the moveset is derived from its body plan and element.
 *
 * Three properties matter more than the numbers themselves:
 *
 *   • **Pure.** `resolveTurn` takes a battle and returns the next one plus the
 *     events that describe what happened. No timers, no animation, no DOM. The
 *     board is a renderer of these events, which is what makes a fight
 *     replayable and testable without a browser.
 *   • **Explicit sides.** The caller names the side that is acting, and the
 *     engine refuses a side acting out of turn. The opening turn goes to the
 *     faster animal, so the arena cannot assume the player moves first — it
 *     reads `state.turn` (and plays the opponent's opening strike) instead of
 *     assuming, which is how a faster opponent used to eat the player's move.
 *   • **Deterministic given a seed.** The client passes a seed so the visuals
 *     can be replayed, and tests pass a fixed one. `Math.random` never appears
 *     below this line.
 *   • **Bounded.** HP can only fall within [0, maxHp], energy within
 *     [0, MAX_ENERGY]; a turn cannot loop forever because every state change
 *     either spends energy, banks the turn's regeneration, or ends the battle —
 *     healing is capped by the maximum, and a setup move adds nothing once the
 *     boost is at `MAX_BOOST`. `petBattle.test.ts` asserts these directly,
 *     including a fuzz run over the whole action space.
 *
 * The fight is client-side by design (see the `pet_battles` comment in
 * `lib/db/src/schema/appearance.ts`): it carries no rewards, so the client is
 * allowed to own it, and the server only logs the result.
 */

export type Side = "player" | "enemy";
export type Difficulty = "easy" | "normal" | "hard";
export type MoveKind = "attack" | "heal" | "guard" | "boost";

export interface Move {
  id: string;
  name: string;
  power: number;
  cost: number;
  kind: MoveKind;
  blurb: string;
}

export interface Fighter {
  side: Side;
  slug: string;
  name: string;
  level: number;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  energy: number;
  guard: boolean;
  /** Damage multiplier stacks gained from a successful guard. */
  /** Damage multiplier stacks (attack damage is `1 + 0.15 × boost`). */
  boost: number;
  moves: Move[];
}

export interface TurnEvent {
  side: Side;
  move: Move;
  hit: boolean;
  dmg: number;
  crit: boolean;
  /** Effectiveness multiplier applied (1 = neutral). */
  eff: number;
  heal: number;
  guarded: boolean;
  targetHp: number;
  selfHp: number;
  fainted: boolean;
  /** Flavour line for the battle log. */
  text: string;
}

export const MAX_ENERGY = 5;
/** Energy a fighter starts with: enough for one heavy move or two cheap ones. */
const START_ENERGY = 2;
/**
 * Energy granted to a fighter at the start of their own next turn.
 *
 * Load-bearing, and it was missing: without it a fighter could spend their
 * opening two points and then never afford anything but the free move again, so
 * the heavy strike, the heal and the brace were dead buttons for the rest of the
 * fight (and the free move's own blurb — "builds energy for the big one" — was a
 * lie). The uploads' `Battle.beginTurn` regenerated one point per turn; this
 * grants the same point at the end of a turn instead, which is the same economy
 * with the advantage that the energy a player *sees* is exactly the energy they
 * can spend when the grid comes back to them.
 */
export const ENERGY_REGEN = 1;

/* ── elements ────────────────────────────────────────────────────────────── */

export type Element = "fire" | "water" | "grass" | "electric" | "psychic" | "dark" | "ice" | "fairy" | "dragon" | "normal";

const ELEMENT_KEYWORDS: Array<[Element, string[]]> = [
  ["fire", ["charmander", "charizard", "torchic", "cyndaquil", "litten", "flareon", "vulpix", "ninetales", "ember", "fire", "phoenix", "moltres", "hooh", "magmar", "heat", "blaze", "sun"]],
  ["water", ["squirtle", "totodile", "mudkip", "piplup", "popplio", "sobble", "vaporeon", "gyarados", "lapras", "magikarp", "water", "aqua", "tide", "rain", "wave", "otter", "seal", "whale"]],
  ["grass", ["bulbasaur", "chikorita", "treecko", "turtwig", "snivy", "rowlet", "grookey", "leafeon", "oddish", "bellossom", "leaf", "grass", "seed", "flower", "garden", "sprout", "vine"]],
  ["electric", ["pikachu", "raichu", "pichu", "zapdos", "jolteon", "voltorb", "electrode", "mareep", "ampharos", "toxtricity", "volt", "spark", "thunder", "zap"]],
  ["psychic", ["abra", "kadabra", "alakazam", "mewtwo", "mew", "espeon", "ralts", "gardevoir", "ralts", "psy", "mind", "dream", "star", "orbit"]],
  ["dark", ["umbreon", "absol", "houndour", "houndoom", "zoroark", "tyranitar", "murkrow", "honchkrow", "shadow", "dark", "night", "moon"]],
  ["ice", ["lapras", "articuno", "glaceon", "vanillite", "snom", "cetoddle", "frost", "ice", "snow", "glacier", "penguin"]],
  ["fairy", ["clefairy", "jigglypuff", "wigglytuff", "sylveon", "togepi", "florges", "mimikyu", "fairy", "pixie", "bloom", "star"]],
  ["dragon", ["dragon", "drake", "dratini", "dragonite", "rayquaza", "salamence", "garchomp", "axew", "haxorus", "goomy", "goodra", "applin", "hydrapple", "charizard", "tyrunt", "tyrantrum"]],
];

/** Strong-against table. Everything unlisted is neutral. */
const STRONG_AGAINST: Partial<Record<Element, Element>> = {
  fire: "grass",
  water: "fire",
  grass: "water",
  electric: "water",
  ice: "grass",
  dragon: "dragon",
  fairy: "dark",
  psychic: "dark",
  dark: "psychic",
};

const WEAK_AGAINST: Partial<Record<Element, Element>> = {
  grass: "fire",
  water: "grass",
  fire: "water",
  ice: "fire",
  dragon: "ice",
  dark: "fairy",
  psychic: "dark",
};

export function elementFor(slug: string): Element {
  const clean = slug.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Longest keyword wins, so "charizard" (fire keyword, dragon-family body)
  // resolves to fire rather than to "char".
  let best: Element = "normal";
  let bestLength = 0;
  for (const [element, keys] of ELEMENT_KEYWORDS) {
    for (const key of keys) {
      if (key.length > bestLength && clean.includes(key)) {
        best = element;
        bestLength = key.length;
      }
    }
  }
  return best;
}

export function effectiveness(attacker: Element, defender: Element): number {
  if (STRONG_AGAINST[attacker] === defender) return 2;
  if (WEAK_AGAINST[attacker] === defender) return 0.5;
  return 1;
}

/* ── deterministic RNG ───────────────────────────────────────────────────── */

/**
 * Mulberry32 — small, fast, and good enough for a cosmetic fight.
 *
 * Seeded on purpose: the same seed always produces the same fight, which is
 * what lets the board replay an animation and what lets the suite assert exact
 * outcomes instead of statistical ones.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── fighters ────────────────────────────────────────────────────────────── */

function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Level → stats. Kept in one place so a "level" means the same thing everywhere. */
export function statsFor(slug: string, level: number): { hp: number; atk: number; def: number; spd: number } {
  const safeLevel = Math.max(1, Math.min(100, Math.floor(level) || 1));
  const variance = 0.9 + (hash(slug) % 21) / 100; // 0.90 – 1.10, stable per species
  return {
    hp: Math.round((58 + safeLevel * 7) * variance),
    atk: Math.round((11 + safeLevel * 1.6) * variance),
    def: Math.round((7 + safeLevel * 1.1) * variance),
    spd: Math.round((9 + safeLevel * 0.6) * variance),
  };
}

/**
 * Move names by element.
 *
 * The names are the PR #99 uploads' own ("Inferno Comet", "Tidal Crash",
 * "Thunder Spark", "Solar Beam", "Draco Meteor", "Photosynthesis", "Charge Up",
 * "Dragon Rage", "Healing Mist", "Cinder Guard"…), which is the part of that
 * design that makes a fight feel like *this animal* rather than like a generic
 * stat exchange. The upload carried a hand-written moveset per species; here the
 * species comes from the catalog (~1,700 slugs), so the moveset is chosen by the
 * element the species names — a fire companion gets the fire register.
 *
 * Elements the uploads never wrote for (psychic, dark, ice, fairy, and plain
 * normal) are written in the same register rather than left generic: the point
 * of the table is that no move is called "Normal burst".
 */
interface MoveNames {
  jab: string;
  sig: string;
  heavy: string;
  recover: string;
  guard: string;
  boost: string;
}

const MOVE_NAMES: Record<Element, MoveNames> = {
  fire: { jab: "Quick Pounce", sig: "Ember Burst", heavy: "Inferno Comet", recover: "Warm Up", guard: "Cinder Guard", boost: "Stoke the Coals" },
  water: { jab: "Bubble Bonk", sig: "Aqua Jet", heavy: "Tidal Crash", recover: "Healing Mist", guard: "Undertow", boost: "Tide Focus" },
  grass: { jab: "Leaf Tackle", sig: "Razor Leaf", heavy: "Solar Beam", recover: "Morning Dew", guard: "Bark Guard", boost: "Photosynthesis" },
  electric: { jab: "Zip Strike", sig: "Thunder Spark", heavy: "Storm Surge", recover: "Recharge", guard: "Insulate", boost: "Charge Up" },
  psychic: { jab: "Ponder Tap", sig: "Mind Pulse", heavy: "Starfall", recover: "Deep Breath", guard: "Ward", boost: "Meditate" },
  dark: { jab: "Shadow Nip", sig: "Night Shade", heavy: "Eclipse", recover: "Steady Nerves", guard: "Void Veil", boost: "Sharpen" },
  ice: { jab: "Frost Nudge", sig: "Frost Bite", heavy: "Avalanche", recover: "Cool Down", guard: "Ice Shell", boost: "Cold Focus" },
  fairy: { jab: "Pixie Poke", sig: "Pixie Dust", heavy: "Supernova", recover: "Wish", guard: "Charm", boost: "Star Wish" },
  dragon: { jab: "Claw Swipe", sig: "Dragon Breath", heavy: "Draco Meteor", recover: "Hoard Strength", guard: "Scale Wall", boost: "Dragon Rage" },
  normal: { jab: "Comet Nudge", sig: "Claw Swipe", heavy: "Meteor Smash", recover: "Catch Breath", guard: "Brace", boost: "Tune In" },
};

/**
 * The moveset: one free jab, one signature, one heavy, a heal, a brace and a
 * boost — the same six shapes for every animal, in its own element's language.
 *
 * Six rather than the uploads' four because this engine has to model every
 * catalog species at every level without a hand-written table: the shapes carry
 * the strategy (cheap/free, steady, expensive, sustain, defence, setup) and the
 * numbers are level-scaled, so a level-1 axolotl and a level-60 dragon both have
 * a real decision on every turn.
 */
export function movesFor(slug: string): Move[] {
  const element = elementFor(slug);
  const names = MOVE_NAMES[element];
  return [
    { id: "jab", name: names.jab, power: 10, cost: 0, kind: "attack", blurb: "Free and reliable — and it regenerates a point of energy every turn." },
    { id: "sig", name: names.sig, power: 22, cost: 2, kind: "attack", blurb: `A steady ${element} blow.` },
    { id: "heavy", name: names.heavy, power: 38, cost: 4, kind: "attack", blurb: `The heavy ${element} strike — spends everything, lands about four times in five.` },
    { id: "recover", name: names.recover, power: 0, cost: 3, kind: "heal", blurb: "Restore about a third of your health." },
    { id: "guard", name: names.guard, power: 0, cost: 1, kind: "guard", blurb: "Take half damage next turn and gain a boost stack." },
    { id: "boost", name: names.boost, power: 0, cost: 2, kind: "boost", blurb: "Set up: two boost stacks (max three), then hit harder." },
  ];
}

/** Boost stacks a setup move grants, and the cap every source shares. */
export const BOOST_MOVE_STACKS = 2;
export const MAX_BOOST = 3;

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function makeFighter(side: Side, slug: string, level: number, name?: string): Fighter {
  const stats = statsFor(slug, level);
  return {
    side,
    slug,
    name: name?.trim() || cap(slug.replace(/[-_]/g, " ")),
    level: Math.max(1, Math.min(100, Math.floor(level) || 1)),
    maxHp: stats.hp,
    hp: stats.hp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    energy: START_ENERGY,
    guard: false,
    boost: 0,
    moves: movesFor(slug),
  };
}

/* ── the fight ───────────────────────────────────────────────────────────── */

export interface BattleState {
  player: Fighter;
  enemy: Fighter;
  turn: Side;
  winner: Side | null;
  round: number;
  log: string[];
  /** RNG state carried with the battle so the whole fight is one seed. */
  seed: number;
  /** Total damage each side has dealt, for the log the server stores. */
  dealt: Record<Side, number>;
}

export function startBattle(player: Fighter, enemy: Fighter, seed = Date.now()): BattleState {
  return {
    player,
    enemy,
    turn: player.spd >= enemy.spd ? "player" : "enemy",
    winner: null,
    round: 1,
    log: [`${enemy.name} (Lv ${enemy.level}) blocks the path.`],
    seed: seed >>> 0,
    dealt: { player: 0, enemy: 0 },
  };
}

export function fighterOf(state: BattleState, side: Side): Fighter {
  return side === "player" ? state.player : state.enemy;
}

function other(side: Side): Side {
  return side === "player" ? "enemy" : "player";
}

/** AI move choice. Deterministic from the seeded RNG and the current state. */
export function chooseEnemyMove(state: BattleState): number {
  const me = state.enemy;
  const foe = state.player;
  const rng = makeRng(state.seed + state.round * 7919);
  const roll = rng();
  const hpPct = me.hp / me.maxHp;
  const foePct = foe.hp / foe.maxHp;

  // Heal when hurt and able.
  if (hpPct < 0.35 && me.energy >= 3 && roll < 0.6) return me.moves.findIndex((m) => m.kind === "heal");
  // Wind up early, while healthy — the uploads' AI did the same, and it is what
  // makes a heavy move land at the end of a fight instead of never.
  if (hpPct > 0.5 && me.boost === 0 && me.energy >= 2 && roll > 0.7) return me.moves.findIndex((m) => m.kind === "boost");
  // Finish when the heavy move is affordable.
  if (me.energy >= 4 && foePct < 0.4 && roll < 0.75) return me.moves.findIndex((m) => m.id === "heavy");
  if (me.energy >= 2 && roll < 0.55) return me.moves.findIndex((m) => m.id === "sig");
  if (me.energy >= 1 && roll > 0.85) return me.moves.findIndex((m) => m.kind === "guard");
  return me.moves.findIndex((m) => m.id === "jab");
}

/**
 * Apply one move and hand the turn over.
 *
 * Returns a **new** state (structuredClone of the fighters, not a mutation) and
 * the event describing it, so a caller can render the event before committing
 * the state — which is what lets the board animate a hit and only then move the
 * bar.
 */
export function resolveTurn(
  state: BattleState,
  moveIndex: number,
  side: Side = state.turn,
): { state: BattleState; event: TurnEvent } {
  if (side !== state.turn) {
    throw new Error(
      `petBattle: ${side} tried to act on ${state.turn}'s turn — the arena drives turns from state.turn so one side cannot move twice in a row.`,
    );
  }
  const actorSide = side;
  const actor = fighterOf(state, actorSide);
  const target = fighterOf(state, other(actorSide));
  const move = actor.moves[Math.max(0, Math.min(actor.moves.length - 1, moveIndex))]!;
  const rng = makeRng(state.seed + state.round * 104729 + moveIndex * 31);
  const next: BattleState = {
    ...state,
    player: { ...state.player },
    enemy: { ...state.enemy },
    dealt: { ...state.dealt },
    log: [...state.log, ""],
  };
  const nextActor = fighterOf(next, actorSide);
  const nextTarget = fighterOf(next, other(actorSide));

  // Spend the cost, then bank this turn's regeneration for their next turn —
  // one point, so the free move nets +1 and the expensive ones come round again.
  nextActor.energy = clamp(nextActor.energy - move.cost + ENERGY_REGEN, 0, MAX_ENERGY);

  let dmg = 0;
  let heal = 0;
  let crit = false;
  let eff = 1;
  let hit = true;
  let wasGuarded = false;
  let text: string;

  if (move.kind === "attack") {
    eff = effectiveness(elementFor(actor.slug), elementFor(target.slug));
    // Accuracy falls as the move gets heavier, so a heavy strike is a decision.
    const accuracy = move.power >= 38 ? 0.78 : move.power >= 22 ? 0.9 : 0.98;
    hit = rng() < accuracy;
    if (hit) {
      crit = rng() < 0.1;
      const raw = (actor.atk * move.power) / 18 * eff * (crit ? 1.6 : 1) * (1 + actor.boost * 0.15);
      wasGuarded = nextTarget.guard;
      const guardFactor = wasGuarded ? 0.5 : 1;
      dmg = Math.max(1, Math.round((raw / (1 + nextTarget.def / 45)) * guardFactor));
      nextTarget.hp = clamp(nextTarget.hp - dmg, 0, nextTarget.maxHp);
      next.dealt[actorSide] += dmg;
      text = `${actor.name} lands ${move.name} for ${dmg}${crit ? " (critical)" : ""}${eff > 1 ? " — super effective!" : eff < 1 ? " — not very effective." : "."}`;
    } else {
      text = `${actor.name} swings ${move.name} and misses.`;
    }
    if (nextActor.boost > 0 && rng() < 0.5) nextActor.boost -= 1;
  } else if (move.kind === "heal") {
    heal = Math.min(nextActor.maxHp - nextActor.hp, Math.round(nextActor.maxHp * 0.32));
    nextActor.hp += heal;
    text = heal > 0 ? `${actor.name} catches their breath (+${heal}).` : `${actor.name} is already at full strength.`;
  } else if (move.kind === "boost") {
    const before = nextActor.boost;
    nextActor.boost = Math.min(MAX_BOOST, nextActor.boost + BOOST_MOVE_STACKS);
    text =
      nextActor.boost > before
        ? `${actor.name} winds up ${move.name} (+${nextActor.boost} power).`
        : `${actor.name} is already wound up as far as it goes.`;
  } else {
    nextActor.guard = true;
    nextActor.boost = Math.min(MAX_BOOST, nextActor.boost + 1);
    text = `${actor.name} braces for the next hit.`;
  }

  // The guard flag protects until the guarded side's next turn begins.
  if (actorSide === "player") next.enemy.guard = false;
  else next.player.guard = false;

  const fainted = nextTarget.hp <= 0;
  const event: TurnEvent = {
    side: actorSide,
    move,
    hit,
    dmg,
    crit,
    eff,
    heal,
    guarded: wasGuarded,
    targetHp: nextTarget.hp,
    selfHp: nextActor.hp,
    fainted,
    text,
  };
  next.log[next.log.length - 1] = text;

  if (fainted) {
    next.winner = actorSide;
    next.log.push(actorSide === "player" ? `${target.name} is down. You win.` : `${actor.name} is down. ${target.name} wins.`);
    return { state: next, event };
  }

  next.turn = other(actorSide);
  if (next.turn === "player") next.round += 1;
  return { state: next, event };
}

/** The AI's whole turn, so a caller can drive both sides from one place. */
export function resolveEnemyTurn(state: BattleState): { state: BattleState; event: TurnEvent } {
  return resolveTurn(state, chooseEnemyMove(state), "enemy");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Opponent scaling: the level band the arena offers for a given pet level.
 * Bands are ±2 levels, and the difficulty only moves the enemy's level — its
 * stats are never inflated, so a "hard" fight is a fair fight against a
 * stronger animal rather than a cheat.
 */
export function rivalLevelFor(petLevel: number, difficulty: Difficulty): number {
  const delta = difficulty === "easy" ? -2 : difficulty === "hard" ? 2 : 0;
  return Math.max(1, Math.min(100, petLevel + delta));
}

/** A plausible name for a wild opponent of a species. */
export function rivalNameFor(slug: string, difficulty: Difficulty): string {
  const clean = slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const prefix = difficulty === "hard" ? "Elder" : difficulty === "easy" ? "Young" : "Wild";
  return `${prefix} ${clean}`;
}
