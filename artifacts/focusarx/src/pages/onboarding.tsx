import { useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, getToken } from "@/lib/auth";
import { Sparkles, Target, Zap, Clock, Rocket, ArrowRight, ArrowLeft } from "lucide-react";
import { BLUR_IN, STAGGER, STAGGER_CHILD } from "@/lib/animations";

const Hero3D = lazy(() => import("@/components/Hero3D"));

type OnboardingData = {
  goal: string;
  challenge: string;
  style: string;
  dailyHours: string;
  focusDuration: number;
};

const GOALS = [
  { id: "exams", label: "Exam Prep", icon: "📚" },
  { id: "deepwork", label: "Research", icon: "🔬" },
  { id: "coding", label: "Coding", icon: "💻" },
  { id: "creative", label: "Creative", icon: "🎨" },
  { id: "language", label: "Languages", icon: "🌍" },
  { id: "other", label: "Other", icon: "✨" },
];

const CHALLENGES = [
  { id: "phone", label: "Distractions", icon: "📱" },
  { id: "procrastination", label: "Procrastination", icon: "⏳" },
  { id: "time", label: "Poor Timing", icon: "⌛" },
  { id: "motivation", label: "Motivation", icon: "🔋" },
  { id: "overwhelmed", label: "Overwhelmed", icon: "📋" },
  { id: "environment", label: "Noise", icon: "🔇" },
];

const STYLES = [
  { id: "sprinter", label: "Sprinter", sub: "25-min bursts", icon: "⚡", duration: 25 },
  { id: "balanced", label: "Balanced", sub: "45-min sessions", icon: "⚖️", duration: 45 },
  { id: "marathoner", label: "Marathoner", sub: "90-min dives", icon: "🏃", duration: 90 },
];

const DAILY_HOURS = [
  { id: "1h", label: "1 hour", sub: "Light" },
  { id: "2h", label: "2 hours", sub: "Solid" },
  { id: "4h", label: "4 hours", sub: "Serious" },
  { id: "6h", label: "6+ hours", sub: "Extreme" },
];

const STEPS = ["intro", "goal", "challenge", "style", "hours", "guide", "ready"] as const;
type Step = typeof STEPS[number];

// Read answers the user may already have given in the mobile welcome flow
// (`focusarx-welcome-prefs`) so onboarding pre-fills and skips those steps.
function readWelcomePrefs(): { goal?: string; challenge?: string; style?: string; focusDuration?: number } {
  try {
    const raw = localStorage.getItem("focusarx-welcome-prefs");
    if (!raw) return {};
    const prefs = JSON.parse(raw) as { goal?: string; challenge?: string; style?: string };
    const style = STYLES.find((s) => s.id === prefs.style);
    return {
      goal: prefs.goal,
      challenge: prefs.challenge,
      style: prefs.style,
      focusDuration: style?.duration,
    };
  } catch {
    return {};
  }
}

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { refresh } = useAuth();
  const prefs = readWelcomePrefs();
  const [step, setStep] = useState<Step>(() => (prefs.goal && prefs.challenge && prefs.style ? "hours" : "intro"));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [data, setData] = useState<Partial<OnboardingData>>(() => ({ ...prefs }));

  const stepIndex = STEPS.indexOf(step);
  const progress = (stepIndex / (STEPS.length - 1)) * 100;

  const next = () => {
    const nextStep = STEPS[stepIndex + 1];
    if (nextStep) setStep(nextStep);
  };

  const back = () => {
    const prevStep = STEPS[stepIndex - 1];
    if (prevStep) setStep(prevStep);
  };

  const pick = (key: keyof OnboardingData, value: string | number) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setTimeout(next, 300);
  };

  const finish = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const token = getToken();
      const response = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ data }),
      });
      if (!response.ok) {
        throw new Error("We could not save your focus setup. Please try again.");
      }
      await refresh();
      localStorage.setItem("onboardingComplete", "true");
      localStorage.removeItem("focusarx-welcome-prefs");
      setLocation("/dashboard");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "We could not save your focus setup. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--background)] text-[var(--palette-white)]">
      {/* 3D Background */}
      <div className="absolute inset-0 z-[var(--z-base)] opacity-40">
        <Suspense fallback={null}>
          <Hero3D />
        </Suspense>
      </div>

      <div className="relative z-[var(--z-content)] w-full max-w-xl px-6">
        <div className="mb-12">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--brand-400)] animate-pulse" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--foreground-subtle)]">System Calibration</p>
            </div>
            <p className="text-[10px] font-bold text-[var(--foreground-subtle)]">{Math.round(progress)}%</p>
          </div>
          <div className="h-1 w-full rounded-full bg-[var(--palette-white)]/5">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-pink)]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "circOut" }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === "intro" && (
            <motion.div key="intro" variants={BLUR_IN} initial="initial" animate="animate" exit="exit" className="text-center">
              <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--brand-600)] to-[var(--brand-pink)] shadow-[0_0_40px_var(--rgba-124-58-237-0_3)]">
                <Rocket size={32} className="text-[var(--palette-white)]" />
              </div>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Initialize Your <br /><span className="text-[var(--brand-400)]">Focus DNA</span></h1>
              <p className="mt-6 text-lg text-[var(--foreground-muted)]">Before we begin, we need to calibrate the environment to your cognitive patterns.</p>
              <button onClick={next} className="mt-12 group flex items-center gap-3 mx-auto rounded-2xl bg-[var(--palette-white)] px-8 py-4 text-lg font-bold text-[var(--palette-black)] hover:scale-105 transition-all">
                Begin Calibration <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          )}

          {step === "goal" && (
            <StepWrapper key="goal" title="Primary Directive" sub="What is your ultimate objective?">
              <div className="grid grid-cols-2 gap-3">
                {GOALS.map((g) => (
                  <OptionButton key={g.id} icon={g.icon} label={g.label} selected={data.goal === g.id} onClick={() => pick("goal", g.id)} />
                ))}
              </div>
            </StepWrapper>
          )}

          {step === "challenge" && (
            <StepWrapper key="challenge" title="Interference Detection" sub="Identify your primary distraction source.">
              <div className="grid grid-cols-2 gap-3">
                {CHALLENGES.map((c) => (
                  <OptionButton key={c.id} icon={c.icon} label={c.label} selected={data.challenge === c.id} onClick={() => pick("challenge", c.id)} />
                ))}
              </div>
            </StepWrapper>
          )}

          {step === "style" && (
            <StepWrapper key="style" title="Flow Architecture" sub="Select your preferred study frequency.">
              <div className="space-y-3">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setData((prev) => ({ ...prev, style: s.id, focusDuration: s.duration }));
                      setTimeout(next, 300);
                    }}
                    className={`group relative w-full flex items-center gap-4 rounded-2xl border px-6 py-5 text-left transition-all ${
                      data.style === s.id
                        ? "border-[var(--brand-400)] bg-[var(--brand-400)]/10"
                        : "border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] hover:bg-[var(--palette-white)]/[0.05]"
                    }`}
                  >
                    <span className="text-3xl">{s.icon}</span>
                    <div>
                      <p className="font-bold text-[var(--palette-white)] text-lg">{s.label}</p>
                      <p className="text-sm text-[var(--foreground-subtle)]">{s.sub}</p>
                    </div>
                    <div className="ml-auto text-right">
                       <span className="text-xs font-semibold text-[var(--brand-400)] uppercase tracking-widest">{s.duration} MIN</span>
                    </div>
                  </button>
                ))}
              </div>
            </StepWrapper>
          )}

          {step === "hours" && (
            <StepWrapper key="hours" title="Capacity Target" sub="Define your daily focus threshold.">
              <div className="grid grid-cols-2 gap-3">
                {DAILY_HOURS.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => pick("dailyHours", h.id)}
                    className={`flex flex-col items-start rounded-2xl border p-6 text-left transition-all ${
                      data.dailyHours === h.id
                        ? "border-[var(--brand-400)] bg-[var(--brand-400)]/10"
                        : "border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] hover:bg-[var(--palette-white)]/[0.05]"
                    }`}
                  >
                    <p className="text-2xl font-semibold text-[var(--palette-white)]">{h.label}</p>
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--foreground-subtle)] mt-1">{h.sub}</p>
                  </button>
                ))}
              </div>
            </StepWrapper>
          )}

          {step === "guide" && (
            <StepWrapper key="guide" title="Your FocusArx Flight Plan" sub="Know exactly what happens after setup.">
              <div className="space-y-3">
                {[
                  ["1", "Choose the next action", "Dashboard recommendations combine your tasks, streak, and time of day."],
                  ["2", "Protect one focus block", "The timer tracks verified elapsed time and keeps your session recoverable."],
                  ["3", "Use AI with context", "The coach and roadmap turn your goal into specific sessions; rule-based fallback is labeled."],
                  ["4", "Review transparent progress", "Analytics shows minutes, time-of-day patterns, streaks, and session replay."],
                  ["5", "Build momentum", "XP, city growth, flashcards, and missions reward completed work—not clicks."],
                ].map(([number, title, text]) => (
                  <div key={number} className="flex gap-3 rounded-2xl border border-[var(--palette-white)]/10 bg-[var(--palette-white)]/[0.03] p-4">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--brand-600)] font-bold">{number}</span>
                    <div><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-[var(--foreground-subtle)]">{text}</p></div>
                  </div>
                ))}
              </div>
              <button onClick={next} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-600)] font-bold">Show my plan <ArrowRight size={18} /></button>
            </StepWrapper>
          )}

          {step === "ready" && (
            <motion.div key="ready" variants={BLUR_IN} initial="initial" animate="animate" className="text-center">
              <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--palette-emerald-500)]/10 border border-[var(--palette-emerald-500)]/20 shadow-[0_0_50px_var(--rgba-16-185-129-0_2)]">
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                  <Sparkles size={40} className="text-[var(--palette-emerald-400)]" />
                </motion.div>
              </div>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Calibration <br /><span className="text-[var(--palette-emerald-400)]">Complete</span></h1>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {data.goal && <CalibrationTag label={GOALS.find(g => g.id === data.goal)?.label ?? data.goal} />}
                {data.style && <CalibrationTag label={`${data.focusDuration}m Loops`} />}
                {data.dailyHours && <CalibrationTag label={`${data.dailyHours}/day`} />}
              </div>
              <p className="mt-8 text-[var(--muted-fg)] max-w-sm mx-auto">Systems are synced. Your academic civilization is ready for expansion.</p>
              {saveError && <p role="alert" className="mt-4 text-sm text-[var(--palette-red-400)]">{saveError}</p>}
              <button
                onClick={() => void finish()}
                disabled={saving}
                className="mt-12 w-full rounded-2xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] py-5 text-lg font-semibold text-[var(--palette-white)] shadow-xl hover:scale-105 transition-all disabled:opacity-50"
              >
                {saving ? "Deploying..." : "Enter Command Center"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {stepIndex > 0 && step !== "ready" && (
          <button
            onClick={back}
            className="mx-auto mt-10 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--foreground-subtle)] hover:text-[var(--palette-white)] transition-colors"
          >
            <ArrowLeft size={10} /> Back
          </button>
        )}
      </div>
    </div>
  );
}

function StepWrapper({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <motion.div variants={STAGGER} initial="initial" animate="animate" exit="exit" className="space-y-8 text-center">
      <motion.div variants={STAGGER_CHILD}>
        <h2 className="text-4xl font-semibold tracking-tight text-[var(--palette-white)]">{title}</h2>
        <p className="mt-2 text-[var(--foreground-muted)] font-medium">{sub}</p>
      </motion.div>
      <motion.div variants={STAGGER_CHILD}>{children}</motion.div>
    </motion.div>
  );
}

function OptionButton({ icon, label, selected, onClick }: { icon: string; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 rounded-2xl border p-5 text-left transition-all ${
        selected
          ? "border-[var(--brand-400)] bg-[var(--brand-400)]/10 shadow-[0_0_30px_var(--rgba-167-139-250-0_15)]"
          : "border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] hover:bg-[var(--palette-white)]/[0.05]"
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-sm font-bold text-[var(--palette-white)]">{label}</span>
    </button>
  );
}

function CalibrationTag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-[var(--palette-white)]/5 border border-[var(--palette-white)]/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--brand-400)] shadow-lg">
      {label}
    </span>
  );
}
