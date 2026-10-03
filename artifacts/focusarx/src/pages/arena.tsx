import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, Coins, Crown, Flag, Heart, RotateCcw, Shield, Sparkles, Swords, Trophy, Zap } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/Toast";
import { useActivePet } from "@/hooks/useActivePet";
import { getToken, hasSessionHint } from "@/lib/auth";
import { apiJson } from "@/lib/api";
import { useAppearanceFields, useAppearance } from "@/lib/appearance";
import { BATTLE_DESIGNS } from "@/lib/designPacks";
import {
  MAX_ENERGY,
  chooseEnemyMove,
  elementFor,
  makeFighter,
  resolveTurn,
  rivalLevelFor,
  rivalNameFor,
  startBattle,
  type BattleState,
  type Difficulty,
  type TurnEvent,
} from "@/lib/petBattle";
import {
  ARENA_CUPS,
  clearedCups,
  cupLockReason,
  cupUnlocked,
  nextCup,
} from "@/lib/arenaLadder";
import { AnimalGlyph } from "@/components/pets/AnimalGlyph";
import { petBodyParams } from "@/lib/petBodyParams";
import { is3DCapable } from "@/lib/webglCapability";
import { cn } from "@/lib/utils";

/**
 * The Arena — turn-based pet battles.
 *
 * The board is a renderer of `lib/petBattle.ts`, which owns every rule and every
 * number. That split is the whole design: the engine is pure and can be tested
 * without a browser, and this file only decides what the fight *looks* like.
 *
 * Three things the console cares about, all visible here:
 *
 *   • the **battle design pack** (`duel` / `arena` / `retro`) comes from the
 *     account's assignment, so an admin pin changes this page;
 *   • the **result is reported** to `POST /api/appearance/battles`, which is how
 *     "which board is actually played" is answered without trusting the client
 *     for anything that carries value;
 *   • `arena` is honest about what it is — the focus-session arena, not this
 *     board — and hands the user to it rather than pretending to be it.
 *
 * The layout pack shapes the page: `studio` puts the stage beside the log in a
 * wide two-column arrangement, `compact` collapses to one column with the log
 * behind a toggle, and `quiet` is the default two-panel card layout.
 */

interface Rival {
  slug: string;
  name: string;
  rarity?: string;
  category?: string;
}

const FALLBACK_RIVALS: Rival[] = [
  { slug: "fox", name: "Focus Fox" },
  { slug: "owl", name: "Sage Owl" },
  { slug: "dragon", name: "Study Dragon" },
  { slug: "otter", name: "River Otter" },
  { slug: "capybara", name: "Calm Capybara" },
  { slug: "penguin", name: "Steady Penguin" },
];

const DIFFICULTIES: { id: Difficulty; label: string; hint: string }[] = [
  { id: "easy", label: "Easy", hint: "Two levels below your companion" },
  { id: "normal", label: "Even", hint: "Matched level" },
  { id: "hard", label: "Hard", hint: "Two levels above — a real fight" },
];

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function FighterCard({
  title,
  subtitle,
  slug,
  category,
  hp,
  max,
  energy,
  accent,
  guard,
  boost,
  align,
}: {
  title: string;
  subtitle: string;
  /** Species slug — the card draws the animal from it, not a generic avatar. */
  slug: string;
  category?: string;
  hp: number;
  max: number;
  energy: number;
  accent: string;
  guard: boolean;
  boost: number;
  align: "left" | "right";
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const reduced = !!useReducedMotion();
  return (
    <Card className={cn("flex-1", align === "right" && "text-right")}>
      <CardContent className="p-3">
        <div className={cn("flex items-center justify-between gap-2", align === "right" && "flex-row-reverse")}>
          {/* The same animal the companion stages draw (petBodyParams → glyph),
              mirrored for the right-hand fighter so the two face each other. */}
          <AnimalGlyph params={petBodyParams(slug, category)} size={40} flip={align === "right"} />
          <span className="flex min-w-0 flex-col items-start gap-0.5" style={align === "right" ? { alignItems: "flex-end" } : undefined}>
            <span className="w-full truncate font-display text-sm font-semibold text-[var(--foreground)]">{title}</span>
            <span className="text-[11px] font-semibold text-[var(--foreground-subtle)]">{subtitle}</span>
          </span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: pct > 0.5 ? accent : pct > 0.25 ? "var(--brand-gold)" : "var(--color-error)" }}
            initial={false}
            animate={{ width: `${pct * 100}%` }}
            transition={reduced ? { duration: 0 } : { duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={hp}
            aria-label={`${title} health`}
          />
        </div>
        <div className={cn("mt-1 flex items-center justify-between text-[11px] font-semibold tabular-nums text-[var(--foreground-subtle)]", align === "right" && "flex-row-reverse")}>
          <span>
            {hp} / {max} HP
          </span>
          <span className="flex items-center gap-2">
            {guard && (
              <span className="inline-flex items-center gap-1 text-[var(--brand-400)]">
                <Shield size={11} aria-hidden="true" /> braced
              </span>
            )}
            {boost > 0 && (
              <span className="inline-flex items-center gap-1 text-[var(--brand-gold)]">
                <Zap size={11} aria-hidden="true" /> +{boost}
              </span>
            )}
            <span className="flex items-center gap-[3px]" aria-label={`${energy} of ${MAX_ENERGY} energy`}>
              {Array.from({ length: MAX_ENERGY }, (_, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 rounded-[2px]"
                  style={{ background: i < energy ? accent : "var(--surface-3)" }}
                />
              ))}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ArenaPage() {
  const { data: activePet } = useActivePet();
  const { battleDesign, layout } = useAppearanceFields();
  // Hydrates the account's assignment (deduped with the timer and settings).
  useAppearance();
  const { toast } = useToast();

  const petSlug = activePet?.slug ?? "bulbasaur";
  const petName = activePet?.name ?? "Your companion";
  const petLevel = activePet?.level ?? 1;
  const petCategory = activePet?.category;

  const [rivals, setRivals] = useState<Rival[]>(FALLBACK_RIVALS);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [rivalIndex, setRivalIndex] = useState(0);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [lastEvent, setLastEvent] = useState<TurnEvent | null>(null);

  const [summary, setSummary] = useState<{ total: number; wins: number; losses: number } | null>(null);
  /** Cups the log says have been won. */
  const [cleared, setCleared] = useState<number[]>([]);
  /** The cup being entered, or null for a pick-up fight against a chosen rival. */
  const [cupId, setCupId] = useState<number | null>(null);
  const reportedRef = useRef(false);
  /**
   * The stage of the *current* fight, captured when it started.
   *
   * The cup selector stays live during a fight, so reading `cupId` at report
   * time would file the win under whatever cup the user had wandered to. The
   * fight's own stage is what the log must record.
   */
  const stageRef = useRef<number | null>(null);

  // Rivals come from the live catalog (so new releases are opponents); the local
  // list keeps the page usable offline and for guests.
  useEffect(() => {
    if (!hasSessionHint()) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiJson<{ rivals?: Rival[] }>("/api/appearance/rivals", { credentials: "include" });
        if (!cancelled && data.rivals && data.rivals.length >= 3) setRivals(data.rivals);
      } catch {
        /* offline or guest — the fallback list stands */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasSessionHint()) return;
    void (async () => {
      try {
        const data = await apiJson<{
          summary?: { total: number; wins: number; losses: number };
          battles?: { stage?: unknown; result?: unknown }[];
        }>("/api/appearance/battles?limit=50", { credentials: "include" });
        if (data.summary) setSummary(data.summary);
        // The ladder's progress is not a column anywhere: it is read back out of
        // the battle log, which is the same record the console reads.
        if (Array.isArray(data.battles)) setCleared(clearedCups(data.battles));
      } catch {
        /* no history yet */
      }
    })();
  }, []);

  const rival = rivals[Math.min(rivalIndex, Math.max(0, rivals.length - 1))] ?? FALLBACK_RIVALS[0]!;
  const cup = cupId === null ? null : ARENA_CUPS.find((c) => c.id === cupId) ?? null;
  // A cup sets the stakes: its own level and difficulty, not the free-fight
  // controls. Everything downstream (the fight button, the report) reads these.
  const fightDifficulty = cup?.difficulty ?? difficulty;
  const rivalLevel = cup ? cup.level : rivalLevelFor(petLevel, difficulty);
  const suggested = nextCup(petLevel, cleared);

  const start = useCallback(() => {
    const player = makeFighter("player", petSlug, petLevel, petName);
    const enemy = makeFighter("enemy", rival.slug, rivalLevel, rivalNameFor(rival.slug, fightDifficulty));
    reportedRef.current = false;
    stageRef.current = cup?.id ?? null;
    setLastEvent(null);
    setBattle(startBattle(player, enemy, Date.now() >>> 0));
  }, [petSlug, petLevel, petName, rival.slug, rivalLevel, fightDifficulty, cup]);

  const report = useCallback(
    async (state: BattleState, result: "win" | "loss" | "flee") => {
      if (reportedRef.current || !hasSessionHint()) return;
      reportedRef.current = true;
      try {
        await apiJson("/api/appearance/battles", {
          method: "POST",
          credentials: "include",
          headers: authHeaders(),
          body: JSON.stringify({
            petSlug: state.player.slug,
            petName: state.player.name,
            petLevel: state.player.level,
            rivalSlug: state.enemy.slug,
            rivalName: state.enemy.name,
            rivalLevel: state.enemy.level,
            difficulty: fightDifficulty,
            design: battleDesign,
            stage: stageRef.current,
            result,
            rounds: state.round,
            damageDealt: state.dealt.player,
            damageTaken: state.dealt.enemy,
          }),
        });
        if (result !== "flee") {
          setSummary((prev) =>
            prev
              ? {
                  total: prev.total + 1,
                  wins: prev.wins + (result === "win" ? 1 : 0),
                  losses: prev.losses + (result === "loss" ? 1 : 0),
                }
              : prev,
          );
        }
        // Winning a cup advances the ladder immediately, without waiting for a
        // refetch: the log read is the authority on the next visit, but a user
        // who has just won must not be told the cup is still locked.
        const won = stageRef.current;
        if (result === "win" && won !== null) {
          setCleared((prev) => (prev.includes(won) ? prev : [...prev, won].sort((a, b) => a - b)));
        }
      } catch {
        // The log is a nice-to-have: a failed report must never interrupt the
        // fight or look like the battle itself failed.
      }
    },
    [battleDesign, fightDifficulty],
  );

  const act = useCallback(
    (moveIndex: number) => {
      // `battle.turn` is the authority, not the click: a fast animal can hold
      // the opening turn, and a stale click must not resolve out of order.
      if (!battle || battle.winner || battle.turn !== "player") return;
      const turn = resolveTurn(battle, moveIndex, "player");
      setBattle(turn.state);
      setLastEvent(turn.event);
      if (turn.state.winner) {
        void report(turn.state, turn.state.winner === "player" ? "win" : "loss");
      }
    },
    [battle, report],
  );

  /**
   * The opponent answers on its own beat, driven by whose turn the state says
   * it is. That is what makes the faster-animal opening work: the fight can
   * start on the enemy's turn, the strike plays after this beat, and only then
   * does the move grid come back to the player. The cleanup cancels the beat,
   * so a re-render (or StrictMode's double effect) still resolves exactly once.
   */
  useEffect(() => {
    if (!battle || battle.winner || battle.turn !== "enemy") return;
    const timer = window.setTimeout(() => {
      const reply = resolveTurn(battle, chooseEnemyMove(battle), "enemy");
      setBattle(reply.state);
      setLastEvent(reply.event);
      if (reply.state.winner) {
        void report(reply.state, reply.state.winner === "player" ? "win" : "loss");
      }
    }, 620);
    return () => window.clearTimeout(timer);
  }, [battle, report]);



  const flee = useCallback(() => {
    if (!battle || battle.winner) return;
    void report(battle, "flee");
    setBattle(null);
    toast("You left the fight — no harm done, your companion keeps their health.", "info");
  }, [battle, report, toast]);

  const winner = battle?.winner ?? null;
  const retro = battleDesign === "retro";
  const studio = layout === "studio";
  const compact = layout === "compact";

  const designNote = useMemo(() => BATTLE_DESIGNS.find((d) => d.id === battleDesign)?.blurb ?? "", [battleDesign]);

  return (
    <PageTransition>
      <PageSEO {...PAGE_SEO.arena} />
      <div className={cn("mx-auto w-full px-4 py-6", studio ? "max-w-6xl" : "max-w-3xl")}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/pets" className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
              <ArrowLeft size={12} aria-hidden="true" /> Companions
            </Link>
            <h1 className="font-display text-2xl font-semibold text-[var(--foreground)]">Arena</h1>
            <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
              {designNote || "Turn-based pet battles."} Your board: <span className="font-semibold text-[var(--foreground-muted)]">{BATTLE_DESIGNS.find((d) => d.id === battleDesign)?.label}</span>
              {summary && summary.total > 0 && <span> · {summary.wins}W / {summary.losses}L</span>}
            </p>
          </div>
          {battleDesign === "arena" ? (
            <Link href="/focus" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground-muted)] hover:border-[var(--border-strong)]">
              <Swords size={13} aria-hidden="true" /> Fight beside a focus block
            </Link>
          ) : null}
        </div>

        {battleDesign === "arena" && !battle ? (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-sm">Session arena</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-[var(--foreground-subtle)]">
              Your board is the <strong>session arena</strong>: a monster appears when a focus block starts and the block decides the fight —
              finishing a session always wins. Start a session on the focus page to play it. The turn-based board is still available below
              whenever you want a fight on purpose; an admin can change your board from the console.
            </CardContent>
          </Card>
        ) : null}

        <div className={cn("grid gap-4", studio && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
          <div className="space-y-4">
            {/* The ladder — the uploads' six cups, unlocked in order. */}
            <Card data-cup-ladder="true">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Trophy size={14} className="text-[var(--brand-gold)]" aria-hidden="true" />
                  The ladder
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0">
                <p className="text-xs text-[var(--foreground-subtle)]">
                  {cleared.length === 0
                    ? "Six cups, unlocked in order. Winning one opens the next."
                    : `${cleared.length} of ${ARENA_CUPS.length} cups cleared — ${suggested.name} is next.`}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ARENA_CUPS.map((c) => {
                    const open = cupUnlocked(c, petLevel, cleared);
                    const won = cleared.includes(c.id);
                    const reason = cupLockReason(c, petLevel, cleared);
                    const chosen = cupId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={!open}
                        aria-pressed={chosen}
                        onClick={() => {
                          setCupId(chosen ? null : c.id);
                          setBattle(null);
                        }}
                        className={cn(
                          "flex min-h-[52px] flex-col gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors",
                          chosen
                            ? "border-[var(--brand-400)]/60 bg-[var(--rgba-124-58-237-0_15)]"
                            : "border-[var(--border-subtle)] bg-[var(--surface-1)]",
                          open ? "hover:border-[var(--border-strong)]" : "opacity-60",
                        )}
                      >
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--foreground)]">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: c.palette[2] }}
                          />
                          {c.name}
                          {won && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[var(--brand-gold)]">
                              <Check size={10} aria-hidden="true" /> cleared
                            </span>
                          )}
                          <span className="ml-auto text-[11px] font-semibold text-[var(--foreground-subtle)]">Lv {c.level}</span>
                        </span>
                        <span className="text-[11px] text-[var(--foreground-subtle)]">{open ? c.blurb : reason}</span>
                      </button>
                    );
                  })}
                </div>
                {cup && (
                  <button
                    type="button"
                    onClick={() => setCupId(null)}
                    className="text-[11px] font-semibold text-[var(--foreground-muted)] underline"
                  >
                    Leave the cup and fight any rival
                  </button>
                )}
              </CardContent>
            </Card>

            {/* Stage */}
            <Card data-cup={cup?.id ?? undefined} style={cup ? { borderColor: cup.palette[2] } : undefined}>
              <CardContent className="p-4">
                {!battle ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className="grid h-12 w-12 place-items-center overflow-hidden rounded-full"
                        style={{ background: "var(--surface-2)" }}
                      >
                        <AnimalGlyph params={petBodyParams(petSlug, petCategory)} size={44} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{petName}</p>
                        <p className="text-xs text-[var(--foreground-subtle)]">
                          Lv {petLevel} · {elementFor(petSlug)} type
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-[var(--foreground-muted)]">Opponent</p>
                      <div className="flex flex-wrap gap-2">
                        {rivals.slice(0, 8).map((r, index) => {
                          const active = index === Math.min(rivalIndex, rivals.length - 1);
                          return (
                            <button
                              key={`${r.slug}-${index}`}
                              type="button"
                              onClick={() => setRivalIndex(index)}
                              aria-pressed={active}
                              className={cn(
                                "flex min-h-[36px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                                active
                                  ? "border-[var(--brand-400)]/60 bg-[var(--rgba-124-58-237-0_15)] text-[var(--brand-400)]"
                                  : "border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-subtle)] hover:border-[var(--border-strong)]",
                              )}
                            >
                              <AnimalGlyph params={petBodyParams(r.slug, r.category)} size={20} />
                              {r.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {cup && (
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2">
                        <p className="text-xs font-bold text-[var(--foreground)]">
                          Cup {cup.id} · {cup.name}
                        </p>
                        <p className="text-[11px] text-[var(--foreground-subtle)]">
                          {cup.blurb} Level {cup.level} opponent, {cup.difficulty} band — the cup sets both.
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-[var(--foreground-muted)]">Difficulty</p>
                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Battle difficulty">
                        {DIFFICULTIES.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            role="radio"
                            aria-checked={fightDifficulty === d.id}
                            disabled={!!cup}
                            onClick={() => setDifficulty(d.id)}
                            title={cup ? "The cup sets the difficulty" : d.hint}
                            className={cn(
                              "min-h-[32px] rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                              fightDifficulty === d.id
                                ? "border-[var(--brand-400)]/60 bg-[var(--rgba-124-58-237-0_15)] text-[var(--brand-400)]"
                                : "border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-subtle)] hover:border-[var(--border-strong)]",
                              cup && "opacity-50",
                            )}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button onClick={start} className="w-full sm:w-auto">
                      <Swords size={14} aria-hidden="true" />
                      {cup
                        ? ` Fight for the ${cup.name} (Lv ${rivalLevel})`
                        : ` Fight ${rivalNameFor(rival.slug, difficulty)} (Lv ${rivalLevel})`}
                    </Button>
                    {!is3DCapable() && (
                      <p className="text-[11px] text-[var(--foreground-subtle)]">
                        This device renders the flat board (no WebGL) — every rule is identical.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className={cn("space-y-3", retro && "font-mono")}>
                    <div className={cn("flex flex-col gap-2 sm:flex-row", !retro && "sm:items-stretch")}>
                      <FighterCard
                        title={battle.player.name}
                        subtitle={`Lv ${battle.player.level} · ${elementFor(battle.player.slug)}`}
                        slug={battle.player.slug}
                        category={petCategory}
                        hp={battle.player.hp}
                        max={battle.player.maxHp}
                        energy={battle.player.energy}
                        accent={retro ? "var(--brand-500)" : "var(--brand-500)"}
                        guard={battle.player.guard}
                        boost={battle.player.boost}
                        align="left"
                      />
                      <FighterCard
                        title={battle.enemy.name}
                        subtitle={`Lv ${battle.enemy.level} · ${elementFor(battle.enemy.slug)}`}
                        slug={battle.enemy.slug}
                        category={rival.category}
                        hp={battle.enemy.hp}
                        max={battle.enemy.maxHp}
                        energy={battle.enemy.energy}
                        accent="var(--color-error)"
                        guard={battle.enemy.guard}
                        boost={battle.enemy.boost}
                        align="right"
                      />
                    </div>

                    {cup && (
                      <p className="text-[11px] font-semibold text-[var(--foreground-subtle)]">
                        Cup {cup.id} · {cup.name}
                      </p>
                    )}
                    <p
                      className="min-h-[32px] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--foreground-muted)]"
                      aria-live="polite"
                    >
                      {lastEvent?.text ?? battle.log[battle.log.length - 1]}
                    </p>

                    {winner ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)]">
                          {winner === "player" ? (
                            <>
                              <Crown size={15} className="text-[var(--brand-gold)]" aria-hidden="true" /> {battle.player.name} wins
                            </>
                          ) : (
                            <>
                              <Flag size={15} className="text-[var(--color-error)]" aria-hidden="true" /> {battle.enemy.name} wins
                            </>
                          )}
                        </span>
                        <Button variant="secondary" onClick={start}>
                          <RotateCcw size={13} aria-hidden="true" /> Rematch
                        </Button>
                        <Button variant="ghost" onClick={() => setBattle(null)}>
                          Back to the board
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {battle.player.moves.map((move, index) => {
                          const affordable = battle.player.energy >= move.cost;
                          return (
                            <button
                              key={move.id}
                              type="button"
                              onClick={() => act(index)}
                              disabled={!affordable || battle.turn !== "player"}
                              title={move.blurb}
                              className={cn(
                                "rounded-xl border px-3 py-2 text-left transition-colors",
                                affordable && battle.turn === "player"
                                  ? "border-[var(--border-subtle)] bg-[var(--surface-1)] hover:border-[var(--brand-400)]/60"
                                  : "border-[var(--border-subtle)] bg-[var(--surface-1)] opacity-50",
                              )}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-[var(--foreground)]">{move.name}</span>
                                <span className="text-[11px] font-semibold text-[var(--foreground-subtle)]">
                                  {move.kind === "attack"
                                    ? `${move.power} pow`
                                    : move.kind === "heal"
                                      ? "heal"
                                      : move.kind === "boost"
                                        ? "set up"
                                        : "guard"}
                                  {move.cost > 0 ? ` · ${move.cost}⚡` : " · free"}
                                </span>
                              </span>
                              <span className="mt-0.5 block text-[11px] text-[var(--foreground-subtle)]">{move.blurb}</span>
                            </button>
                          );
                        })}
                        <Button variant="ghost" onClick={flee} className="sm:col-span-2">
                          <Heart size={13} aria-hidden="true" /> Leave the fight
                        </Button>
                      </div>
                    )}
                    {battle.turn === "enemy" && !battle.winner && (
                      <p className="flex items-center gap-1.5 text-[11px] text-[var(--foreground-subtle)]">
                        <Sparkles size={11} aria-hidden="true" /> {battle.enemy.name} is winding up…
                      </p>
                    )}
                    {/* Only true on the opening beat, when the rival's speed
                        held the first turn — mid-fight the enemy acting is just
                        the normal reply. */}
                    {battle.turn === "enemy" && battle.round === 1 && battle.log.length <= 2 && (
                      <p className="text-[11px] text-[var(--foreground-subtle)]">
                        {battle.enemy.name} is faster — they swing first.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {!compact && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Battle log</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-1 text-xs text-[var(--foreground-subtle)]">
                    {(battle?.log ?? ["No fight yet — pick an opponent and start one."]).map((line, index) => (
                      <li key={index} className={cn(index === (battle?.log.length ?? 0) - 1 && battle && "font-semibold text-[var(--foreground-muted)]")}>
                        {line}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Rail — the studio layout's second column, and the place the pack
              credits live. Compact folds it away entirely. */}
          {!compact && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Your board</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-[var(--foreground-subtle)]">
                  {BATTLE_DESIGNS.map((d) => (
                    <div key={d.id} className={cn("rounded-lg border px-2.5 py-2", d.id === battleDesign ? "border-[var(--brand-400)]/50 bg-[var(--surface-2)]" : "border-[var(--border-subtle)]")}>
                      <p className="font-semibold text-[var(--foreground-muted)]">{d.label}</p>
                      <p className="mt-0.5">{d.blurb}</p>
                    </div>
                  ))}
                  <p className="pt-1">
                    Changed from <Link href="/profile?tab=custom" className="font-semibold underline">settings</Link>, or pinned for your account by an admin.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Journey progress</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-[var(--foreground-subtle)]">
                  <p className="flex items-center gap-1.5">
                    <Coins size={12} aria-hidden="true" /> Battles are for sport: they never cost or grant tokens, so a loss costs you nothing but time.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
