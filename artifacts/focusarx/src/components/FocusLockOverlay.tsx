import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type LockMode = "none" | "soft" | "hard" | "beast";

interface Props {
  mode: LockMode;
  exitPhrase: string;
  secondsLeft: number;
  totalSeconds: number;
  taskName: string;
  onExit: () => void;
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(660, now + 0.15);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.setValueAtTime(0, now + 0.35);
    osc.start(now); osc.stop(now + 0.35);
  } catch {}
}

function MathPuzzle({ onSolved }: { onSolved: () => void }) {
  const [puzzles] = useState(() => {
    const make = () => {
      const a = Math.floor(Math.random() * 20) + 5;
      const b = Math.floor(Math.random() * 20) + 5;
      const ops = ["+", "-", "×"] as const;
      const op = ops[Math.floor(Math.random() * 3)]!;
      const answer = op === "+" ? a + b : op === "-" ? a - b : a * b;
      return { q: `${a} ${op} ${b} = ?`, answer };
    };
    return [make(), make(), make()];
  });
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);

  const check = () => {
    if (parseInt(input) === puzzles[step]!.answer) {
      if (step === 2) { onSolved(); } else { setStep(s => s + 1); setInput(""); }
    } else {
      setShake(true); setTimeout(() => setShake(false), 400); setInput("");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-[var(--foreground-muted)]">Step {step + 1}/3</p>
      <p className="text-center text-2xl font-bold text-[var(--palette-white)]">{puzzles[step]!.q}</p>
      <motion.input
        animate={shake ? { x: [-6, 6, -6, 6, 0] } : {}}
        transition={{ duration: 0.25 }}
        type="number"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && check()}
        placeholder="Your answer"
        className="w-full rounded-xl border border-[var(--rgba-239-68-68-0_4)] bg-[var(--rgba-239-68-68-0_05)] px-4 py-3 text-center text-lg font-bold text-[var(--palette-white)] focus:border-[var(--color-error)] focus:outline-none"
        autoFocus
      />
      <button onClick={check} className="w-full rounded-xl bg-[var(--rgba-239-68-68-0_2)] py-2.5 text-sm font-semibold text-[var(--palette-red-300)] transition hover:bg-[var(--rgba-239-68-68-0_35)]">
        Confirm
      </button>
    </div>
  );
}

export default function FocusLockOverlay({ mode, exitPhrase, secondsLeft, totalSeconds, taskName, onExit }: Props) {
  const [showExit, setShowExit] = useState(false);
  const [softCountdown, setSoftCountdown] = useState(10);
  const [phraseInput, setPhraseInput] = useState("");
  const [beastWait, setBeastWait] = useState(30);
  const [beastPuzzleDone, setBeastPuzzleDone] = useState(false);
  const [redBorder, setRedBorder] = useState(false);
  const softRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beastRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const r = 80;
  const circ = 2 * Math.PI * r;
  const dash = progress * circ;

  const m = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const s = (secondsLeft % 60).toString().padStart(2, "0");

  useEffect(() => {
    const onBlur = () => {
      playChime();
      setRedBorder(true);
      setTimeout(() => setRedBorder(false), 2500);
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) onBlur();
    });
    return () => {
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const startExitFlow = () => {
    setShowExit(true);
    if (mode === "soft") {
      setSoftCountdown(10);
      softRef.current = setInterval(() => {
        setSoftCountdown(c => {
          if (c <= 1) {
            clearInterval(softRef.current!);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    if (mode === "beast") {
      setBeastWait(30);
      beastRef.current = setInterval(() => {
        setBeastWait(c => {
          if (c <= 1) { clearInterval(beastRef.current!); return 0; }
          return c - 1;
        });
      }, 1000);
    }
  };

  useEffect(() => () => {
    if (softRef.current) clearInterval(softRef.current);
    if (beastRef.current) clearInterval(beastRef.current);
  }, []);

  const canSoftExit = mode === "soft" && softCountdown === 0;
  const canHardExit = mode === "hard" && phraseInput.trim().toLowerCase() === exitPhrase.trim().toLowerCase();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[var(--z-max)] flex flex-col items-center justify-center bg-[var(--rgba-4-6-14-0_97)] backdrop-blur-xl"
      style={{ border: redBorder ? "3px solid var(--color-error)" : "none", transition: "border 0.2s" }}
    >
      <AnimatePresence>
        {redBorder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[var(--z-content)] pointer-events-none ring-4 ring-[var(--palette-red-500)]/80"
          >
            <p className="absolute top-8 left-1/2 -translate-x-1/2 text-sm font-semibold text-[var(--palette-red-400)] drop-shadow-md">
              Stay present. You've got this.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!showExit ? (
        <div className="relative z-[var(--z-sticky)] flex flex-col items-center gap-8 px-6 text-center">
          <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-subtle)]">Focus Session</p>

          <div className="relative flex h-[200px] w-[200px] items-center justify-center">
            <svg width="200" height="200" className="absolute -rotate-90">
              <circle cx="100" cy="100" r={r} fill="none" stroke="var(--rgba-124-58-237-0_12)" strokeWidth="8" />
              <motion.circle cx="100" cy="100" r={r} fill="none" stroke="var(--brand-600)" strokeWidth="8"
                strokeLinecap="round" strokeDasharray={circ}
                animate={{ strokeDashoffset: circ - dash }}
                transition={{ duration: 0.4, ease: "linear" }}
              />
            </svg>
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full bg-[radial-gradient(circle,var(--rgba-124-58-237-0_08),transparent_70%)]"
            />
            <div className="relative z-[var(--z-content)] flex flex-col items-center">
              <span className="text-5xl font-bold tabular-nums text-[var(--palette-white)]">{m}:{s}</span>
              <span className="mt-1 text-xs text-[var(--foreground-subtle)]">remaining</span>
            </div>
          </div>

          {taskName && (
            <div className="max-w-xs">
              <p className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-widest mb-1">Working on</p>
              <p className="text-xl font-semibold text-[var(--foreground)]">{taskName}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${
              mode === "soft" ? "bg-[var(--palette-yellow-900)]/30 text-[var(--palette-yellow-400)]" :
              mode === "hard" ? "bg-[var(--palette-red-900)]/30 text-[var(--palette-red-400)]" :
              "bg-[var(--palette-zinc-900)] text-[var(--palette-zinc-300)]"
            }`}>
              {mode === "soft" ? "🟡 Soft Lock" : mode === "hard" ? "🔴 Hard Lock" : "⚫ Beast Mode"}
            </span>
          </div>

          <button
            onClick={startExitFlow}
            className="mt-4 text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors"
          >
            Request exit →
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="z-[var(--z-sticky)] w-full max-w-sm rounded-2xl border border-[var(--rgba-239-68-68-0_3)] bg-[var(--rgba-20-8-8-0_95)] p-7 shadow-2xl"
        >
          <h3 className="mb-5 text-center text-lg font-bold text-[var(--palette-red-400)]">Exit Focus Session?</h3>

          {mode === "soft" && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-[var(--foreground-muted)]">Take a breath. Exit unlocks in:</p>
              <p className="text-5xl font-bold text-[var(--palette-yellow-400)]">{softCountdown}</p>
              <button disabled={!canSoftExit} onClick={onExit}
                className="w-full rounded-xl bg-[var(--palette-yellow-900)]/30 py-3 text-sm font-semibold text-[var(--palette-yellow-300)] disabled:opacity-40 transition hover:bg-[var(--palette-yellow-900)]/50 disabled:cursor-not-allowed"
              >
                {canSoftExit ? "Exit session" : `Wait ${softCountdown}s…`}
              </button>
            </div>
          )}

          {mode === "hard" && (
            <div className="space-y-4">
              <p className="text-center text-sm text-[var(--foreground-muted)]">Type your exit phrase to leave:</p>
              <p className="text-center text-xs font-mono text-[var(--palette-red-400)] italic">"{exitPhrase}"</p>
              <input
                type="text"
                value={phraseInput}
                onChange={e => setPhraseInput(e.target.value)}
                placeholder="Type the phrase…"
                className="w-full rounded-xl border border-[var(--rgba-239-68-68-0_3)] bg-[var(--rgba-239-68-68-0_05)] px-4 py-3 text-sm text-[var(--palette-white)] focus:border-[var(--palette-red-400)] focus:outline-none"
                autoFocus
              />
              <button disabled={!canHardExit} onClick={onExit}
                className="w-full rounded-xl bg-[var(--palette-red-900)]/30 py-3 text-sm font-semibold text-[var(--palette-red-300)] disabled:opacity-40 transition hover:bg-[var(--palette-red-900)]/50 disabled:cursor-not-allowed"
              >
                Exit session
              </button>
            </div>
          )}

          {mode === "beast" && (
            <div className="space-y-4">
              {!beastPuzzleDone ? (
                <>
                  <p className="text-center text-sm text-[var(--foreground-muted)]">Solve 3 math puzzles to exit:</p>
                  <MathPuzzle onSolved={() => { setBeastPuzzleDone(true); }} />
                </>
              ) : beastWait > 0 ? (
                <div className="text-center space-y-2">
                  <p className="text-sm text-[var(--foreground-muted)]">Puzzles done. Now wait:</p>
                  <p className="text-4xl font-bold text-[var(--palette-zinc-300)]">{beastWait}s</p>
                </div>
              ) : (
                <button onClick={onExit}
                  className="w-full rounded-xl bg-[var(--palette-zinc-800)] py-3 text-sm font-semibold text-[var(--palette-zinc-300)] transition hover:bg-[var(--palette-zinc-700)]"
                >
                  Exit session
                </button>
              )}
            </div>
          )}

          <button onClick={() => { setShowExit(false); setPhraseInput(""); }}
            className="mt-4 w-full text-center text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors"
          >
            ← Stay focused
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

export function LockModePicker({
  onConfirm,
  onCancel,
}: {
  onConfirm: (mode: LockMode, exitPhrase: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<LockMode>("none");
  const [phrase, setPhrase] = useState("");

  const modes = [
    { id: "none" as LockMode, emoji: "⬜", label: "No lock", sub: "Normal session — exit anytime" },
    { id: "soft" as LockMode, emoji: "🟡", label: "Soft Lock", sub: "10-second delay before cancel" },
    { id: "hard" as LockMode, emoji: "🔴", label: "Hard Lock", sub: "Type your exit phrase to leave" },
    { id: "beast" as LockMode, emoji: "⚫", label: "Beast Mode", sub: "3 math puzzles + 30-second wait" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--palette-black)]/60 px-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.93, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl border border-[var(--rgba-124-58-237-0_3)] bg-[var(--rgba-8-12-28-0_98)] p-6 shadow-2xl"
      >
        <h3 className="mb-1 text-base font-bold text-[var(--foreground)]">Commitment level</h3>
        <p className="mb-5 text-xs text-[var(--foreground-subtle)]">How locked in do you want to be?</p>
        <div className="space-y-2.5">
          {modes.map(m => (
            <button key={m.id} onClick={() => setSelected(m.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                selected === m.id
                  ? "border-[var(--brand-600)] bg-[var(--rgba-124-58-237-0_15)]"
                  : "border-[var(--rgba-124-58-237-0_12)] hover:border-[var(--rgba-124-58-237-0_3)]"
              }`}
            >
              <span className="text-lg">{m.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{m.label}</p>
                <p className="text-[11px] text-[var(--foreground-subtle)]">{m.sub}</p>
              </div>
            </button>
          ))}
        </div>

        {selected === "hard" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4">
            <input
              type="text"
              placeholder='Your exit phrase, e.g. "I give up today"'
              value={phrase}
              onChange={e => setPhrase(e.target.value)}
              className="w-full rounded-xl border border-[var(--rgba-124-58-237-0_3)] bg-[var(--rgba-124-58-237-0_05)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:border-[var(--brand-600)] focus:outline-none"
            />
          </motion.div>
        )}

        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-[var(--rgba-124-58-237-0_2)] py-2.5 text-sm text-[var(--palette-6b7280)] transition hover:text-[var(--foreground-muted)]">
            Cancel
          </button>
          <button
            disabled={selected === "hard" && !phrase.trim()}
            onClick={() => onConfirm(selected, phrase)}
            className="flex-1 rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] py-2.5 text-sm font-semibold text-[var(--palette-white)] transition hover:opacity-90 disabled:opacity-40"
          >
            Start session
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
