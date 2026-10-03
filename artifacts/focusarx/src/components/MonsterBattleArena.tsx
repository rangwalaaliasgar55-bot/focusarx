/**
 * Monster Battle Arena - 3D Pet vs Monster Combat System
 *
 * Blueprint: Weeks 7-8 3D Gamification
 *
 * When user starts a focus session, a monster appears.
 * If user completes the session: Pet wins, monster defeated, pet grows stronger
 * If user abandons/fails: Monster wins, pet loses HP
 *
 * Visual: 3D arena with pet on left, monster on right, health bars, battle effects
 */

import { useState, useEffect, useRef, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import { Heart, Sword, Zap, Award, X } from "lucide-react";
import { installThreeConsoleFilter, onWebGLContextLost } from "@/lib/threeConsole";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { formatClock } from "@/lib/focusSessionBus";

installThreeConsoleFilter();

/* ─── Combat model ─────────────────────────────────────────────────────────
 *
 * The session *is* the fight. A block is cut into a fixed number of rounds and
 * the pet's progress through the block decides how many swings each side has
 * thrown, so every number on screen — the two bars, the damage readouts, the
 * meshes — is derived from one input and cannot disagree with another. The old
 * version stored HP in state that was re-derived from props, which is how the
 * displayed bar and the 3D aura could end up describing different fights.
 *
 * Deliberately deterministic. The only random number in the component is the
 * monster's level, rolled once per arena in a lazy initialiser, and it never
 * touches a reward — it only decides which of three already-legal fights the
 * user is dropped into.
 */

/** Rounds in a session. Ten keeps a 25-minute block on a legible ~2.5 min beat. */
const ROUNDS_PER_BATTLE = 10;

/** The pet swings first (initiative), so it lands one more blow than it takes. */
const PET_STRIKES_TO_WIN = Math.ceil(ROUNDS_PER_BATTLE / 2);
const MONSTER_STRIKES_PER_BATTLE = Math.floor(ROUNDS_PER_BATTLE / 2);

/** Fraction of the pet's pool a same-level monster chews through in a full
 *  session. Kept well under 1 on purpose: a block the user finishes is always a
 *  win, so the pet can be worn down but never knocked out by the clock. The
 *  only way to lose is to leave. */
const PET_DRAIN_OVER_SESSION = 0.45;

/** How much harder this monster hits for each level it is above the pet. A
 *  monster two levels up swings for half again as much, which is what makes the
 *  level roll matter instead of being a label. */
function levelPressure(petLevel: number, monsterLevel: number) {
  return 1 + Math.max(0, monsterLevel - petLevel) * 0.25;
}

function petMaxHpFor(level: number) {
  return 100 + level * 20;
}

function monsterMaxHpFor(monsterLevel: number) {
  return 80 + monsterLevel * 15;
}

function clampProgress(progress: number) {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, progress));
}

/** Which round the block has reached. Rounded, not floored, so the finishing
 *  blow lands a few seconds before the clock does instead of the monster dying
 *  on the same frame the session ends — and so a block that completes without
 *  ever publishing an exact 100% still reaches the last round. */
function roundFor(progress: number) {
  return Math.round((clampProgress(progress) / 100) * ROUNDS_PER_BATTLE);
}

function strikesAt(round: number) {
  return { pet: Math.ceil(round / 2), monster: Math.floor(round / 2) };
}

/** Whoever threw the last punch: odd rounds are the pet's, even rounds the
 *  monster's counter-attack. Drives the lunge, the damage number and the flash. */
function lastStrikeAt(round: number): "pet" | "monster" | null {
  if (round <= 0) return null;
  return round % 2 === 1 ? "pet" : "monster";
}

interface BattleFrame {
  petHp: number;
  petMaxHp: number;
  monsterHp: number;
  monsterMaxHp: number;
  petLevel: number;
  monsterLevel: number;
  round: number;
  /** Damage the last blow landed, for the combat readout. */
  lastDamage: number;
  striker: "pet" | "monster" | null;
}

/** The whole fight as a pure function. Nothing here can drift from the bars. */
function battleAt(progress: number, petLevel: number, monsterLevel: number): BattleFrame {
  const round = roundFor(progress);
  const { pet: petStrikes, monster: monsterStrikes } = strikesAt(round);

  const petMaxHp = petMaxHpFor(petLevel);
  const monsterMaxHp = monsterMaxHpFor(monsterLevel);

  const petDamage = monsterMaxHp / PET_STRIKES_TO_WIN;
  const monsterDamage =
    (petMaxHp * PET_DRAIN_OVER_SESSION * levelPressure(petLevel, monsterLevel)) /
    MONSTER_STRIKES_PER_BATTLE;

  const petHp = Math.min(petMaxHp, Math.max(0, petMaxHp - monsterStrikes * monsterDamage));
  const monsterHp = Math.min(monsterMaxHp, Math.max(0, monsterMaxHp - petStrikes * petDamage));

  return {
    petHp,
    petMaxHp,
    monsterHp,
    monsterMaxHp,
    petLevel,
    monsterLevel,
    round,
    lastDamage: Math.round(lastStrikeAt(round) === "pet" ? petDamage : monsterDamage),
    striker: lastStrikeAt(round),
  };
}

type Outcome = "none" | "victory" | "defeat";

interface MonsterBattleArenaProps {
  sessionDuration: number; // in seconds
  sessionProgress: number; // 0-100
  isActive: boolean;
  /** The block is still armed but on hold. A pause must not read as an
   *  abandon — the bus reports both as `isActive === false`, so the arena
   *  cannot tell them apart without this. */
  isPaused?: boolean;
  petLevel?: number;
  onComplete?: (outcome: "victory" | "defeat") => void;
  /** Battle board from the design pack (`duel` / `arena` / `retro`). */
  board?: "duel" | "arena" | "retro";
  /** The compact layout: the fight keeps its numbers and loses its scene. */
  compact?: boolean;
}

/** Decay a value from 1 to 0 once per strike, for the 3D lunge. Kept out of
 *  render on purpose: `state.clock` and `delta` belong to the frame loop. */
function useStrikePulse(strikeToken: number, seconds: number) {
  const pulse = useRef(0);
  const token = useRef(strikeToken);

  useEffect(() => {
    if (strikeToken !== token.current) {
      token.current = strikeToken;
      pulse.current = 1;
    }
  }, [strikeToken]);

  useFrame((_, delta) => {
    if (pulse.current > 0) pulse.current = Math.max(0, pulse.current - delta / seconds);
  });

  return pulse;
}

/**
 * 3D Pet Character - Grows with level
 */
function PetCharacter({ level, hp, maxHp, isAttacking, reducedMotion }: { level: number; hp: number; maxHp: number; isAttacking: boolean; reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);
  const scale = 1 + (level - 1) * 0.1; // Pet grows 10% per level
  const pulse = useStrikePulse(isAttacking ? 1 : 0, 0.45);
  const baseX = -2.5;

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();

    // Idle animation
    groupRef.current.position.y = reducedMotion ? 0 : Math.sin(t * 2) * 0.1;
    groupRef.current.rotation.y = reducedMotion ? 0 : Math.sin(t * 0.5) * 0.1;

    // Attack animation. Written every frame on purpose: the old version only
    // assigned position.x while attacking, so the last random offset stuck and
    // the pet walked off its mark for the rest of the page's life.
    const lunge = reducedMotion ? 0 : Math.sin(pulse.current * Math.PI) * 0.55;
    groupRef.current.position.x = baseX + lunge;
  });

  return (
    <group ref={groupRef} position={[baseX, 0, 0]} scale={scale}>
      {/* Body */}
      <mesh>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial color="#7c3aed" metalness={0.3} roughness={0.4} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.25, 0.3, 0.6]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.25, 0.3, 0.6]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Pupils */}
      <mesh position={[-0.25, 0.3, 0.7]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      <mesh position={[0.25, 0.3, 0.7]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#000000" />
      </mesh>

      {/* Aura based on HP */}
      <mesh>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshBasicMaterial
          color={hp / maxHp > 0.5 ? "#10b981" : hp / maxHp > 0.25 ? "#f59e0b" : "#ef4444"}
          transparent
          opacity={0.2}
        />
      </mesh>
    </group>
  );
}

/**
 * 3D Monster Character
 */
function MonsterCharacter({ level, hp, maxHp, isAttacking, reducedMotion }: { level: number; hp: number; maxHp: number; isAttacking: boolean; reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);
  const baseX = 2.5;
  const pulse = useStrikePulse(isAttacking ? 1 : 0, 0.45);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();

    // Menacing idle
    groupRef.current.position.y = reducedMotion ? 0 : Math.sin(t * 1.5) * 0.15;
    groupRef.current.rotation.y = Math.PI + (reducedMotion ? 0 : Math.sin(t * 0.3) * 0.2);

    // Attack animation, written every frame so the monster settles back onto
    // its mark instead of freezing wherever the last swing left it.
    const lunge = reducedMotion ? 0 : Math.sin(pulse.current * Math.PI) * 0.7;
    groupRef.current.position.x = baseX - lunge;
  });

  return (
    <group ref={groupRef} position={[baseX, 0, 0]} scale={1 + (level - 1) * 0.15}>
      {/* Body - Angular/dangerous shape */}
      <mesh rotation={[0, 0, Math.PI / 6]}>
        <coneGeometry args={[0.7, 1.4, 6]} />
        <meshStandardMaterial color="#ef4444" metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Spikes */}
      <mesh position={[0, 0.8, 0]}>
        <coneGeometry args={[0.2, 0.5, 4]} />
        <meshStandardMaterial color="#991b1b" />
      </mesh>
      <mesh position={[-0.5, 0.5, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <coneGeometry args={[0.15, 0.4, 4]} />
        <meshStandardMaterial color="#991b1b" />
      </mesh>
      <mesh position={[0.5, 0.5, 0]} rotation={[0, 0, Math.PI / 4]}>
        <coneGeometry args={[0.15, 0.4, 4]} />
        <meshStandardMaterial color="#991b1b" />
      </mesh>

      {/* Evil eyes */}
      <mesh position={[-0.2, 0.2, 0.5]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.2, 0.2, 0.5]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} />
      </mesh>

      {/* Damage aura */}
      <mesh>
        <sphereGeometry args={[1.1, 16, 16]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={(hp / maxHp) * 0.3} />
      </mesh>
    </group>
  );
}

/**
 * Battle Arena Ground
 */
function ArenaGround() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#1e1b4b" metalness={0.2} roughness={0.8} />
    </mesh>
  );
}

/**
 * Battle Effects
 */
function BattleEffects({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const particlesRef = useRef<THREE.Points>(null!);

  useEffect(() => {
    if (!particlesRef.current || !active) return;
    const positions = new Float32Array(300);
    for (let i = 0; i < 300; i++) {
      positions[i] = (Math.random() - 0.5) * 10;
    }
    // Replaces rather than accumulates: the old code pushed a new BufferAttribute
    // on every activation and never released the previous one, so a user who
    // ran several sessions in a row leaked 300 vertices per session to the GPU.
    particlesRef.current.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
  }, [active]);

  useFrame((state) => {
    if (!particlesRef.current || !active || reducedMotion) return;
    const t = state.clock.getElapsedTime();
    particlesRef.current.rotation.y = t * 0.5;
  });

  if (!active) return null;

  return (
    <points ref={particlesRef}>
      <bufferGeometry />
      <pointsMaterial size={0.1} color="#fbbf24" transparent opacity={0.6} />
    </points>
  );
}

/** Hoisted: this used to allocate a Vector3 every single frame. */
const CAMERA_HOME = new THREE.Vector3(0, 2, 8);

/**
 * Battle Scene
 */
function BattleScene({ frame, reducedMotion }: { frame: BattleFrame; reducedMotion: boolean }) {
  const { camera } = useThree();

  useFrame(() => {
    camera.position.lerp(CAMERA_HOME, 0.05);
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ef4444" />

      <ArenaGround />
      <PetCharacter
        level={frame.petLevel}
        hp={frame.petHp}
        maxHp={frame.petMaxHp}
        isAttacking={frame.striker === "pet"}
        reducedMotion={reducedMotion}
      />
      <MonsterCharacter
        level={frame.monsterLevel}
        hp={frame.monsterHp}
        maxHp={frame.monsterMaxHp}
        isAttacking={frame.striker === "monster"}
        reducedMotion={reducedMotion}
      />
      <BattleEffects active={frame.round > 0} reducedMotion={reducedMotion} />
    </>
  );
}

type HpTone = "healthy" | "hurt" | "critical";

/** One bar's worth of severity. Cut points rather than per-side colours so a
 *  hurt pet and a hurt monster read the same way. */
function toneFor(ratio: number): HpTone {
  if (ratio <= 0.25) return "critical";
  if (ratio <= 0.6) return "hurt";
  return "healthy";
}

const TONE_COLOR: Record<HpTone, string> = {
  healthy: "var(--success)",
  hurt: "var(--warning)",
  critical: "var(--danger)",
};

/**
 * Health Bar Component
 *
 * Exposed as a real progressbar: the arena is the only place a user can tell
 * how a fight is going, and a bar drawn with divs alone is invisible to a
 * screen reader and to anything else reading the DOM.
 */
function HealthBar({
  current,
  max,
  label,
  tone,
  reducedMotion,
}: {
  current: number;
  max: number;
  label: string;
  tone: HpTone;
  reducedMotion: boolean;
}) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.min(1, Math.max(0, current / safeMax));
  const percentage = ratio * 100;
  const rounded = Math.round(ratio * 100);
  const color = TONE_COLOR[tone];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-bold" style={{ color }}>
          {label}
        </span>
        <span className="shrink-0 tabular-nums text-[var(--foreground-subtle)]">
          {Math.round(current)}/{Math.round(safeMax)} HP
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label} health`}
        aria-valuemin={0}
        aria-valuemax={Math.round(safeMax)}
        aria-valuenow={Math.round(current)}
        aria-valuetext={`${Math.round(current)} of ${Math.round(safeMax)} health, ${rounded} percent`}
        className="h-3 w-full overflow-hidden rounded-full border border-[var(--forge-border)] bg-[var(--surface-2)]"
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={false}
          animate={{ width: `${percentage}%` }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/** Initiative readout — which side swings next, and how far into the fight we
 *  are. Without it the two meshes animate at once and the battle has no shape. */
function RoundStrip({ round, striker }: { round: number; striker: "pet" | "monster" | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-xs font-bold text-[var(--foreground-muted)]">
        Round {Math.max(1, round)}/{ROUNDS_PER_BATTLE}
      </span>
      <div className="flex flex-1 items-center gap-1" aria-hidden="true">
        {Array.from({ length: ROUNDS_PER_BATTLE }, (_, i) => {
          const done = i < round;
          const current = i === round - 1;
          return (
            <span
              key={i}
              className={
                current
                  ? "h-2 flex-1 rounded-full bg-[var(--brand-400)]"
                  : done
                    ? "h-2 flex-1 rounded-full bg-[var(--brand-soft)]"
                    : "h-2 flex-1 rounded-full bg-[var(--surface-2)]"
              }
            />
          );
        })}
      </div>
      <span className="shrink-0 text-xs text-[var(--foreground-subtle)]">
        {striker === null ? "Waiting" : striker === "monster" ? "Monster's turn" : "Pet's turn"}
      </span>
    </div>
  );
}

export default function MonsterBattleArena({
  sessionDuration,
  sessionProgress,
  isActive,
  isPaused = false,
  petLevel = 1,
  onComplete,
  board = "duel",
  compact = false,
}: MonsterBattleArenaProps) {
  /* Level comes from the pet inventory over the network, so it lands after the
     first render. Reading it live instead of freezing it into the initial state
     is what keeps the bars, the labels and the 3D scale describing the same
     pet — the old version built both HP pools from whatever level happened to
     be on the mount and then ignored the real one forever. Clamped because the
     legacy `user_pets.pet_level` column has no lower bound, and a zero there
     used to render a negative-width bar. */
  const safeLevel = Number.isFinite(petLevel) ? Math.max(1, Math.floor(petLevel)) : 1;

  /* Rolled in the lazy initializer: Math.random may not run during render. The
     roll only picks which of three fights the user gets — every one of them is
     winnable, because the monster is never more than a level above the pet. */
  const [monsterLevel] = useState(() =>
    Math.max(1, safeLevel - 1 + Math.floor(Math.random() * 3)),
  );

  const [outcome, setOutcome] = useState<Outcome>("none");
  const [showResult, setShowResult] = useState(false);
  /* The fight as it stood when the block ended. The live frame is useless in
     the modal: by the time the result shows, the parent has already reported
     the block as over and progress is back at zero. */
  const [result, setResult] = useState<{ progress: number; round: number }>({
    progress: 0,
    round: 0,
  });
  const reducedMotion = !!useReducedMotion();

  const frame = battleAt(sessionProgress, safeLevel, monsterLevel);

  /* Peak progress, because the block can end on the same commit that reports
     it finished: the timer flips to its break phase, the bus reports
     `active:false` and zeroes progress, and the render where the fight was
     still standing is gone. Latching the high-water mark means a block that ran
     to the end is still scored as a win, and a paused block — which reports
     `active:false` too — is not scored at all. */
  const peakProgressRef = useRef(0);
  const settledRef = useRef(false);
  /* Whether a block has actually been armed yet. Without it the arena settles
     on mount — it mounts with `isActive:false`, which is indistinguishable
     from a block that just ended, and it would fire a defeat for a session the
     user never started. */
  const engagedRef = useRef(false);

  /* New block, new fight. Declared first on purpose: effects flush in source
     order, so this clears the latch before the effect below folds the current
     progress back into it, and before the resolver can see a stale peak.
     Without it the previous outcome stuck to the arena for the rest of the
     page's life and the "Ready" state was unreachable after the first session. */
  /* eslint-disable react-hooks/set-state-in-effect -- see the note above */
  useEffect(() => {
    if (!isActive) return;
    engagedRef.current = true;
    peakProgressRef.current = 0;
    settledRef.current = false;
    setOutcome("none");
    setShowResult(false);
  }, [isActive]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (isActive && sessionProgress > peakProgressRef.current) {
      peakProgressRef.current = sessionProgress;
    }
  }, [isActive, sessionProgress]);

  /* Resolve once per battle. `onComplete` is in the dependency list because a
     caller may hand us a fresh closure every render, and it gates a reward, so
     the latch is a ref rather than a state comparison — the old effect re-fired
     victory on every parent render and would have paid the bonus that many
     times.

     A block that was never announced as having a length is not over, it is not
     reporting. Resizing across the 768px breakpoint unmounts one timer and
     mounts the other, and the outgoing one resets the bus to its unmounted
     snapshot — `active:false`, `status:"idle"`, `totalSeconds:0` — on its way
     out. Scoring that frame ends a session that is still running. */
  useEffect(() => {
    if (isActive || isPaused) return;
    if (sessionDuration <= 0) return;
    if (!engagedRef.current || settledRef.current) return;
    settledRef.current = true;

    // Scored from the peak, not from whatever the parent is passing on the
    // final render — by then the progress is already back to zero.
    const finalProgress = peakProgressRef.current;
    const final = battleAt(finalProgress, safeLevel, monsterLevel);
    const won = final.monsterHp <= 0 || finalProgress >= 100;

    setOutcome(won ? "victory" : "defeat");
    setResult({ progress: finalProgress, round: final.round });
    setShowResult(true);
    onComplete?.(won ? "victory" : "defeat");
  }, [isActive, isPaused, sessionDuration, onComplete, safeLevel, monsterLevel]);

  const handleClose = useCallback(() => {
    setShowResult(false);
  }, []);

  /* Focus has to move into the dialog and come back out of it, or the result
     is announced by nothing and Escape does not work. */
  const titleId = useId();
  const continueRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!showResult) return;
    restoreFocusRef.current = document.activeElement;
    continueRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (restoreFocusRef.current instanceof HTMLElement) restoreFocusRef.current.focus();
    };
  }, [showResult, handleClose]);

  if (!isActive && !isPaused && !showResult) return null;

  /* Once the result is up the live props are worthless — the parent has
     already reported the block as over and zeroed progress — so the header,
     the countdown and the bars all read the settled fight instead. Otherwise
     the card behind the modal would say 0% next to a modal that says 100%. */
  const shownProgress = showResult ? result.progress : clampProgress(sessionProgress);
  const shownFrame = showResult ? battleAt(result.progress, safeLevel, monsterLevel) : frame;
  const secondsLeft = Math.max(
    0,
    Math.ceil((sessionDuration * (100 - shownProgress)) / 100),
  );
  const statusText = showResult
    ? outcome === "victory"
      ? "Victory! The monster is defeated."
      : "Defeated. You left the fight early."
    : isPaused
      ? "Battle paused."
      : isActive
        ? "Battle in progress."
        : "Ready.";

  // `retro` is the handheld-console reading of whichever board is on: the same
  // fight, monospaced and two-tone. `compact` is the layout pack's smallest
  // footprint — the scene is what goes, never a number or a bar, because the
  // fight's *result* must not depend on which layout is on screen.
  const retro = board === "retro";

  return (
    <div
      data-board={board}
      data-compact={compact ? "true" : undefined}
      className={`w-full overflow-hidden rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] ${
        retro ? "font-mono [--brand-400:var(--palette-emerald-400)]" : ""
      }`}
    >
      {/* Battle Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--forge-border)] bg-[var(--surface-1)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sword size={18} className="shrink-0 text-[var(--brand-400)]" />
          <h3 className="truncate text-sm font-bold">Pet vs Monster Battle</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 font-bold tabular-nums text-[var(--brand-400)]">
            Session {Math.round(shownProgress)}%
          </span>
          <span className="rounded-full bg-[var(--surface-2)] px-2 py-1 font-bold tabular-nums text-[var(--foreground-muted)]">
            {formatClock(secondsLeft)} left
          </span>
        </div>
      </div>

      {/* 3D Arena — dropped in the compact layout, where a 256px scene is the
          whole screen on a phone. */}
      {!compact && (
      <div className="relative h-64 w-full">
        <Canvas
          camera={{ position: [0, 2, 8], fov: 50 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => { onWebGLContextLost(gl.domElement); }}
        >
          <Suspense fallback={null}>
            <BattleScene frame={frame} reducedMotion={reducedMotion} />
          </Suspense>
        </Canvas>

        {/* Combat feedback. The old arena changed HP silently — the only tell
            was a bar creeping left, which at 1 HP per tick is invisible. */}
        <AnimatePresence>
          {frame.striker && isActive ? (
            <motion.div
              key={frame.round}
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 0, scale: 0.9 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: -28, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
              aria-hidden="true"
              className={
                frame.striker === "pet"
                  ? "absolute right-6 top-16 text-2xl font-bold tabular-nums text-[var(--danger)]"
                  : "absolute left-6 top-16 text-2xl font-bold tabular-nums text-[var(--danger)]"
              }
            >
              -{frame.lastDamage}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      )}

      {/* Health Bars + turn order.
          Out of the absolutely-positioned overlay and into flow: two fixed
          12rem bars pinned to opposite corners overlapped each other on a
          320px screen, and neither had room for its own label. */}
      <div className="flex flex-col gap-3 border-t border-[var(--forge-border)] bg-[var(--surface-1)] px-4 py-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <HealthBar
            current={shownFrame.petHp}
            max={shownFrame.petMaxHp}
            label={`Your Pet (Lv.${safeLevel})`}
            tone={toneFor(shownFrame.petHp / shownFrame.petMaxHp)}
            reducedMotion={reducedMotion}
          />
          <HealthBar
            current={shownFrame.monsterHp}
            max={shownFrame.monsterMaxHp}
            label={`Monster (Lv.${monsterLevel})`}
            tone={toneFor(shownFrame.monsterHp / shownFrame.monsterMaxHp)}
            reducedMotion={reducedMotion}
          />
        </div>

        {!compact && <RoundStrip round={shownFrame.round} striker={shownFrame.striker} />}

        {/* One polite live region for the whole fight, so the bars, the round
            counter and the countdown have one narrated source instead of three
            that read out independently and out of step. */}
        <p className="sr-only" role="status" aria-live="polite">
          {statusText} Round {Math.max(1, shownFrame.round)} of {ROUNDS_PER_BATTLE}.{" "}
          {formatClock(secondsLeft)} remaining. Pet {Math.round(shownFrame.petHp)} of{" "}
          {shownFrame.petMaxHp} health, monster {Math.round(shownFrame.monsterHp)} of{" "}
          {shownFrame.monsterMaxHp}.
        </p>

        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Heart size={14} className="shrink-0 text-[var(--brand-400)]" />
            <span className="text-[var(--foreground-subtle)]">{statusText}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={14} className="shrink-0 text-[var(--palette-amber-400)]" />
            <span className="font-bold text-[var(--foreground)]">
              {isPaused ? "Paused" : outcome === "victory" ? "Monster defeated!" : "Keep focusing!"}
            </span>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            className="fixed inset-0 z-[var(--z-modal)] grid place-items-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label="Dismiss result"
              onClick={handleClose}
              className="absolute inset-0 cursor-default bg-black/80"
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              initial={reducedMotion ? { opacity: 0 } : { scale: 0.9, y: 20 }}
              animate={reducedMotion ? { opacity: 1 } : { scale: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
              className="relative w-full max-w-md rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-6"
            >
              {outcome === "victory" ? (
                <>
                  <div className="text-center">
                    <Award size={48} className="mx-auto text-[var(--palette-amber-400)]" />
                    <h3 id={titleId} className="mt-4 text-2xl font-bold text-[var(--palette-amber-400)]">
                      Victory!
                    </h3>
                    <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                      Your pet defeated the monster after {result.round} rounds.
                    </p>
                    <div className="mt-4 rounded-xl bg-[var(--surface-1)] p-4">
                      <p className="text-xs text-[var(--foreground-subtle)]">Pet Level</p>
                      <p className="text-3xl font-bold text-[var(--brand-400)]">{safeLevel}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center">
                    <X size={48} className="mx-auto text-[var(--danger)]" />
                    <h3 id={titleId} className="mt-4 text-2xl font-bold text-[var(--danger)]">
                      Defeated
                    </h3>
                    <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                      The monster survived this one. Complete more sessions to grow stronger!
                    </p>
                    <div className="mt-4 rounded-xl bg-[var(--surface-1)] p-4">
                      <p className="text-xs text-[var(--foreground-subtle)]">Progress</p>
                      <p className="text-3xl font-bold tabular-nums text-[var(--foreground)]">
                        {Math.round(result.progress)}%
                      </p>
                    </div>
                  </div>
                </>
              )}
              <button
                ref={continueRef}
                onClick={handleClose}
                className="mt-6 min-h-[44px] w-full rounded-xl bg-[var(--brand-600)] py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--brand-700)]"
              >
                Continue
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}