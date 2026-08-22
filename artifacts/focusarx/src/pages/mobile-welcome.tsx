import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

const GOALS = [
  { id: "exams", label: "Exam prep", icon: "📚" },
  { id: "deepwork", label: "Deep work", icon: "🔬" },
  { id: "coding", label: "Coding", icon: "💻" },
  { id: "creative", label: "Creative", icon: "🎨" },
  { id: "language", label: "Languages", icon: "🌍" },
  { id: "other", label: "Other", icon: "✨" },
];

const CHALLENGES = [
  { id: "phone", label: "Phone distractions", icon: "📱" },
  { id: "procrastination", label: "Procrastination", icon: "⏳" },
  { id: "time", label: "Losing track of time", icon: "⌛" },
  { id: "motivation", label: "Low motivation", icon: "🔋" },
  { id: "overwhelmed", label: "Too many tasks", icon: "📋" },
  { id: "environment", label: "Noisy surroundings", icon: "🔇" },
];

const STYLES = [
  { id: "sprinter", label: "Sprinter", sub: "Short 25-min bursts", icon: "⚡", duration: 25 },
  { id: "balanced", label: "Balanced", sub: "Classic 45-min sessions", icon: "⚖️", duration: 45 },
  { id: "marathoner", label: "Marathoner", sub: "Deep 90-min dives", icon: "🏃", duration: 90 },
];

const STEPS = ["goal", "challenge", "style", "auth"] as const;
type Step = typeof STEPS[number];

const WELCOME_DONE_KEY = "focusarx-mobile-welcome-done";

export function markMobileWelcomeDone() {
  localStorage.setItem(WELCOME_DONE_KEY, "1");
}

export function hasDoneMobileWelcome() {
  return localStorage.getItem(WELCOME_DONE_KEY) === "1";
}

export default function MobileWelcomePage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("goal");
  const [goal, setGoal] = useState("");
  const [challenge, setChallenge] = useState("");
  const [style, setStyle] = useState("");

  const stepIndex = STEPS.indexOf(step);
  const progress = (stepIndex / (STEPS.length - 1)) * 100;

  const pick = (setter: (v: string) => void, value: string) => {
    setter(value);
    const next = STEPS[stepIndex + 1];
    if (next) setTimeout(() => setStep(next), 220);
  };

  const handleAuth = (path: "login" | "signup") => {
    // save answers to localStorage for post-auth onboarding
    const prefs = { goal, challenge, style };
    localStorage.setItem("focusarx-welcome-prefs", JSON.stringify(prefs));
    markMobileWelcomeDone();
    setLocation(`/${path}?redirect=/onboarding`);
  };

  const handleGuest = () => {
    markMobileWelcomeDone();
    setLocation("/");
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--palette-zinc-950)] px-5 py-8 overflow-hidden">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[var(--palette-rose-500)] to-[var(--palette-violet-600)] flex items-center justify-center text-xs font-black text-[var(--palette-white)]">F</div>
        <span className="text-sm font-bold text-[var(--palette-zinc-200)] tracking-tight">FocusArx</span>
      </div>

      {/* Progress bar */}
      {step !== "auth" && (
        <div className="mb-8">
          <div className="h-1 w-full rounded-full bg-[var(--palette-zinc-800)]/80">
            <motion.div
              className="h-full rounded-full bg-[var(--palette-rose-500)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <p className="mt-2 text-[10px] text-[var(--palette-zinc-600)] text-right">{stepIndex + 1} of {STEPS.length - 1}</p>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          {step === "goal" && (
            <StepSlide key="goal">
              <h2 className="text-2xl font-bold text-[var(--palette-zinc-100)] mb-1">What's your main goal?</h2>
              <p className="text-sm text-[var(--palette-zinc-500)] mb-6">We'll personalise your experience.</p>
              <div className="grid grid-cols-2 gap-2.5">
                {GOALS.map((g) => (
                  <OptionBtn
                    key={g.id} icon={g.icon} label={g.label}
                    selected={goal === g.id}
                    onClick={() => pick(setGoal, g.id)}
                  />
                ))}
              </div>
            </StepSlide>
          )}

          {step === "challenge" && (
            <StepSlide key="challenge">
              <h2 className="text-2xl font-bold text-[var(--palette-zinc-100)] mb-1">Biggest focus challenge?</h2>
              <p className="text-sm text-[var(--palette-zinc-500)] mb-6">Be honest — we've all been there.</p>
              <div className="grid grid-cols-2 gap-2.5">
                {CHALLENGES.map((c) => (
                  <OptionBtn
                    key={c.id} icon={c.icon} label={c.label}
                    selected={challenge === c.id}
                    onClick={() => pick(setChallenge, c.id)}
                  />
                ))}
              </div>
            </StepSlide>
          )}

          {step === "style" && (
            <StepSlide key="style">
              <h2 className="text-2xl font-bold text-[var(--palette-zinc-100)] mb-1">Your focus style?</h2>
              <p className="text-sm text-[var(--palette-zinc-500)] mb-6">Sets your default session length.</p>
              <div className="flex flex-col gap-3">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => pick(setStyle, s.id)}
                    className={`flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all ${
                      style === s.id
                        ? "border-[var(--palette-rose-500)]/60 bg-[var(--palette-rose-950)]/30 ring-1 ring-[var(--palette-rose-500)]/30"
                        : "border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 hover:border-[var(--palette-zinc-700)]"
                    }`}
                  >
                    <span className="text-2xl">{s.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-[var(--palette-zinc-100)]">{s.label}</p>
                      <p className="text-sm text-[var(--palette-zinc-500)]">{s.sub}</p>
                    </div>
                    <span className="rounded-full bg-[var(--palette-zinc-800)] px-2 py-0.5 text-xs text-[var(--palette-zinc-400)]">{s.duration}m</span>
                  </button>
                ))}
              </div>
            </StepSlide>
          )}

          {step === "auth" && (
            <StepSlide key="auth">
              <div className="flex flex-col items-center text-center pt-4">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[var(--palette-rose-500)]/20 to-[var(--palette-violet-600)]/20 text-3xl ring-1 ring-[var(--palette-rose-500)]/30">
                  🎯
                </div>
                <h2 className="text-2xl font-bold text-[var(--palette-zinc-100)] mb-2">You're ready to focus.</h2>
                <p className="text-sm text-[var(--palette-zinc-500)] mb-2 max-w-xs">
                  Create a free account to save your progress, streaks, and AI insights.
                </p>

                {/* Summary tags */}
                <div className="flex flex-wrap justify-center gap-2 mb-8 mt-3">
                  {goal && <Tag label={GOALS.find(g => g.id === goal)?.label ?? goal} />}
                  {challenge && <Tag label={CHALLENGES.find(c => c.id === challenge)?.label ?? challenge} />}
                  {style && <Tag label={STYLES.find(s => s.id === style)?.label ?? style} />}
                </div>

                <div className="w-full space-y-3">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleAuth("signup")}
                    className="w-full rounded-2xl bg-[var(--palette-rose-600)] py-3.5 text-base font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-rose-500)] transition-colors"
                  >
                    Create free account →
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleAuth("login")}
                    className="w-full rounded-2xl border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-900)]/60 py-3.5 text-base font-semibold text-[var(--palette-zinc-300)] hover:border-[var(--palette-zinc-600)] hover:text-[var(--palette-zinc-100)] transition-colors"
                  >
                    I already have an account
                  </motion.button>
                  <button
                    onClick={handleGuest}
                    className="w-full py-2.5 text-sm text-[var(--palette-zinc-600)] hover:text-[var(--palette-zinc-400)] transition-colors"
                  >
                    Continue as guest →
                  </button>
                </div>

                <p className="mt-6 text-[11px] text-[var(--palette-zinc-700)]">
                  Free forever · No credit card required
                </p>
              </div>
            </StepSlide>
          )}
        </AnimatePresence>
      </div>

      {/* Back button */}
      {stepIndex > 0 && step !== "auth" && (
        <button
          onClick={() => setStep(STEPS[stepIndex - 1]!)}
          className="mt-6 flex items-center gap-1.5 text-xs text-[var(--palette-zinc-600)] hover:text-[var(--palette-zinc-400)] transition"
        >
          ← Back
        </button>
      )}
    </div>
  );
}

function StepSlide({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -28 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function OptionBtn({ icon, label, selected, onClick }: {
  icon: string; label: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3.5 text-left transition-all active:scale-95 ${
        selected
          ? "border-[var(--palette-rose-500)]/60 bg-[var(--palette-rose-950)]/30 ring-1 ring-[var(--palette-rose-500)]/30"
          : "border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-medium text-[var(--palette-zinc-200)] leading-snug">{label}</span>
    </button>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-[var(--palette-zinc-800)] px-3 py-1 text-xs text-[var(--palette-zinc-300)]">{label}</span>
  );
}
