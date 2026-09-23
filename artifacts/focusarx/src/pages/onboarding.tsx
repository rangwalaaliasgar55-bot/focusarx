import { useEffect, useState, lazy, Suspense } from "react";
import { ArrowLeft, ArrowRight, BatteryFull, BookOpen, ClipboardList, Footprints, Globe, Laptop, Microscope, Palette, Rocket, Smartphone, Sparkles, VolumeX, Zap } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, getToken } from "@/lib/auth";

import { BLUR_IN, STAGGER, STAGGER_CHILD } from "@/lib/animations";

const Hero3D = lazy(() => import("@/components/Hero3D"));

/**
 * What the first-run generator hands back. The shapes mirror the server's
 * `/api/onboarding/personalize` response — the plan is created on the server
 * (tasks, goals, starter deck, dream) and this step is the reveal.
 */
type GeneratedPlan = {
  dreamLabel: string;
  emoji: string;
  dailyTargetMinutes: number;
  source: string;
  skipped: string[];
  tasks: Array<{ id: string; text: string; minutes: number | null }>;
  goals: Array<{ id: string; title: string }>;
  deck: { id: string; title: string; cardCount: number } | null;
  system: {
    tagline: string;
    blocks: Array<{ label: string; minutes: number; kind: string }>;
    dailyHabit: string;
    checkIn: string;
    nextMilestone: string | null;
  };
};

type DreamOption = { id: string; label: string; emoji: string; desc: string; suggestedMinutes: number; tagline: string | null };

const DAILY_MINUTES: Record<string, number> = { "1h": 60, "2h": 120, "4h": 240, "6h": 360 };

const STUDY_WINDOWS = [
  { id: "morning", label: "Early morning", sub: "Before the house wakes up" },
  { id: "afternoon", label: "Afternoon", sub: "Between classes and evening" },
  { id: "night", label: "Late night", sub: "After everything else is done" },
] as const;

type OnboardingData = {
  goal: string;
  challenge: string;
  style: string;
  dailyHours: string;
  focusDuration: number;
};

const GOALS = [
  { id: "exams", label: "Exam Prep", icon: <BookOpen size={16} aria-hidden="true" /> },
  { id: "deepwork", label: "Research", icon: <Microscope size={16} aria-hidden="true" /> },
  { id: "coding", label: "Coding", icon: <Laptop size={16} aria-hidden="true" /> },
  { id: "creative", label: "Creative", icon: <Palette size={16} aria-hidden="true" /> },
  { id: "language", label: "Languages", icon: <Globe size={16} aria-hidden="true" /> },
  { id: "other", label: "Other", icon: <Sparkles size={16} aria-hidden="true" /> },
];

const CHALLENGES = [
  { id: "phone", label: "Distractions", icon: <Smartphone size={16} aria-hidden="true" /> },
  { id: "procrastination", label: "Procrastination", icon: "⏳" },
  { id: "time", label: "Poor Timing", icon: "⌛" },
  { id: "motivation", label: "Motivation", icon: <BatteryFull size={16} aria-hidden="true" /> },
  { id: "overwhelmed", label: "Overwhelmed", icon: <ClipboardList size={16} aria-hidden="true" /> },
  { id: "environment", label: "Noise", icon: <VolumeX size={16} aria-hidden="true" /> },
];

const STYLES = [
  { id: "sprinter", label: "Sprinter", sub: "25-min bursts", icon: <Zap size={16} aria-hidden="true" />, duration: 25 },
  { id: "balanced", label: "Balanced", sub: "45-min sessions", icon: "⚖️", duration: 45 },
  { id: "marathoner", label: "Marathoner", sub: "90-min dives", icon: <Footprints size={16} aria-hidden="true" />, duration: 90 },
];

const DAILY_HOURS = [
  { id: "1h", label: "1 hour", sub: "Light" },
  { id: "2h", label: "2 hours", sub: "Solid" },
  { id: "4h", label: "4 hours", sub: "Serious" },
  { id: "6h", label: "6+ hours", sub: "Extreme" },
];

const STEPS = ["intro", "goal", "challenge", "style", "hours", "plan", "ready"] as const;
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
  // `?step=plan` is how the dashboard's kickoff card brings an existing account
  // straight to the generator instead of replaying the whole wizard.
  const search = useSearch();
  const wantsPlanStep = new URLSearchParams(search).get("step") === "plan";
  const [step, setStep] = useState<Step>(() => {
    if (wantsPlanStep) return "plan";
    return prefs.goal && prefs.challenge && prefs.style ? "hours" : "intro";
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [data, setData] = useState<Partial<OnboardingData>>(() => ({ ...prefs }));

  /* First-run generator state: what we asked, what it built, and whether the
     learner chose to skip the reveal. */
  const [dreamOptions, setDreamOptions] = useState<DreamOption[]>([]);
  const [dreamType, setDreamType] = useState<string>("iit");
  const [studyWindow, setStudyWindow] = useState<string>("morning");
  const [targetDate, setTargetDate] = useState<string>("");
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  // Dream options come from the server (admin-editable), with a built-in list
  // as the safety net. If the read fails we say so instead of quietly showing
  // a list the learner might assume is the real catalogue.
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/dream-options");
        if (!res.ok) {
          if (!cancelled) setFetchError("Couldn't load your dream catalogue, so we're showing the standard list.");
          return;
        }
        const json = await res.json();
        if (!cancelled && Array.isArray(json.types) && json.types.length > 0) {
          setDreamOptions(json.types as DreamOption[]);
          // Start on the dream that matches the goal they already picked, so the
          // generator's default is a continuation of their answers, not a reset.
          const guess: Record<string, string> = { exams: "iit", coding: "coding", creative: "creative", language: "language", deepwork: "research" };
          const suggested = guess[String(data.goal ?? "")];
          if (suggested) setDreamType(suggested);
        }
      } catch {
        // Fall back to the built-in list — but tell the learner why it looks
        // like the generic one, so a network blip never masquerades as a
        // catalogue with only five dreams in it.
        if (!cancelled) setFetchError("Couldn't reach the server — showing the standard dream list for now.");
      }
    })();
    return () => { cancelled = true; };
    // `data.goal` is read once, when the options arrive — re-running would
    // overwrite a dream the learner has since chosen by hand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Build the plan on the server. This is the one step of onboarding that
   * *creates* things — a dream, a week of tasks, three goals and a starter
   * deck — so the failure path must stay useful: if it fails, the learner can
   * still finish setup and generate later from the dashboard.
   */
  const generatePlan = async () => {
    setPlanBusy(true);
    setPlanError(null);
    try {
      const token = getToken();
      const res = await fetch("/api/onboarding/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          dreamType,
          dailyTargetMinutes: DAILY_MINUTES[String(data.dailyHours)] ?? data.focusDuration ?? 120,
          studyWindow,
          ...(targetDate ? { targetDate } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setPlanError(json.error ?? "Could not build the plan right now."); return; }
      setPlan(json.plan as GeneratedPlan);
    } catch {
      setPlanError("Could not reach the server — you can generate the plan later from your dashboard.");
    } finally {
      setPlanBusy(false);
    }
  };

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
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--foreground-subtle)]">System Calibration</p>
            </div>
            <p className="text-[11px] font-bold text-[var(--foreground-subtle)]">{Math.round(progress)}%</p>
          </div>
          <div className="h-1 w-full rounded-full bg-[var(--palette-white)]/5">
            <motion.div
              className="h-full rounded-full bg-[var(--brand-600)]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.25, ease: "circOut" }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === "intro" && (
            <motion.div key="intro" variants={BLUR_IN} initial="initial" animate="animate" exit="exit" className="text-center">
              <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--brand-600)]">
                <Rocket size={32} className="text-[var(--palette-white)]" />
              </div>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Initialize Your <br /><span className="text-[var(--brand-400)]">Focus DNA</span></h1>
              <p className="mt-6 text-lg text-[var(--foreground-muted)]">Before we begin, we need to calibrate the environment to your cognitive patterns.</p>
              <button onClick={next} className="mt-12 group flex items-center gap-3 mx-auto rounded-2xl bg-[var(--palette-white)] px-8 py-4 text-lg font-bold text-[var(--palette-black)] transition-all">
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
                    className={`group relative w-full flex items-center gap-4 rounded-2xl border px-6 py-5 text-left transition-all ${ data.style === s.id ? "border-[var(--brand-400)] bg-[var(--brand-400)]/10" : "border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] hover:bg-[var(--palette-white)]/[0.05]" }`}
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
                    className={`flex flex-col items-start rounded-2xl border p-6 text-left transition-all ${ data.dailyHours === h.id ? "border-[var(--brand-400)] bg-[var(--brand-400)]/10" : "border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] hover:bg-[var(--palette-white)]/[0.05]" }`}
                  >
                    <p className="text-2xl font-semibold text-[var(--palette-white)]">{h.label}</p>
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--foreground-subtle)] mt-1">{h.sub}</p>
                  </button>
                ))}
              </div>
            </StepWrapper>
          )}

          {step === "plan" && (
            <StepWrapper key="plan" title="Your Personal Setup" sub="Pick the dream — we'll build the plan around it.">
              {!plan ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {fetchError && (
                      <p role="status" className="col-span-full mb-1 text-[11px] text-[var(--palette-amber-400)]">{fetchError}</p>
                    )}
                    {(dreamOptions.length > 0 ? dreamOptions : FALLBACK_DREAMS).map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setDreamType(option.id)}
                        className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all ${ dreamType === option.id ? "border-[var(--brand-400)] bg-[var(--brand-400)]/10" : "border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] hover:bg-[var(--palette-white)]/[0.05]" }`}
                      >
                        <span className="text-2xl" aria-hidden="true">{option.emoji}</span>
                        <span className="text-sm font-bold text-[var(--palette-white)]">{option.label}</span>
                        <span className="text-[11px] leading-snug text-[var(--foreground-subtle)]">{option.desc}</span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-[var(--palette-white)]/10 bg-[var(--palette-white)]/[0.03] p-4 text-left">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">When do you study best?</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {STUDY_WINDOWS.map((w) => (
                        <button
                          key={w.id}
                          onClick={() => setStudyWindow(w.id)}
                          className={`rounded-xl border px-3 py-2 text-left transition-all ${ studyWindow === w.id ? "border-[var(--brand-400)] bg-[var(--brand-400)]/10" : "border-[var(--palette-white)]/10 hover:bg-[var(--palette-white)]/[0.04]" }`}
                        >
                          <span className="block text-xs font-semibold text-[var(--palette-white)]">{w.label}</span>
                          <span className="block text-[11px] text-[var(--foreground-subtle)]">{w.sub}</span>
                        </button>
                      ))}
                    </div>
                    <label className="mt-3 block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--foreground-subtle)]" htmlFor="onboarding-target-date">
                      Target date (optional)
                    </label>
                    <input
                      id="onboarding-target-date"
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--palette-white)]/10 bg-[var(--palette-white)]/[0.03] px-3 py-2 text-sm text-[var(--palette-white)] outline-none focus:border-[var(--brand-400)] sm:max-w-xs"
                    />
                  </div>

                  {planError && <p role="alert" className="mt-3 text-sm text-[var(--palette-red-400)]">{planError}</p>}

                  <button
                    onClick={() => void generatePlan()}
                    disabled={planBusy}
                    className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-600)] font-bold text-[var(--palette-white)] transition-all hover:bg-[var(--brand-700)] disabled:opacity-50"
                  >
                    {planBusy ? "Building your plan…" : "Generate my plan"} {!planBusy && <Sparkles size={18} />}
                  </button>
                  <button
                    onClick={() => setStep("ready")}
                    className="mx-auto mt-4 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--foreground-subtle)] transition-colors hover:text-[var(--palette-white)]"
                  >
                    Skip — I'll set it up myself
                  </button>
                </>
              ) : (
                <motion.div variants={BLUR_IN} initial="initial" animate="animate" className="text-left">
                  <div className="rounded-[var(--radius-xl)] border border-[var(--palette-emerald-500)]/25 bg-[var(--palette-emerald-500)]/[0.06] p-5">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl" aria-hidden="true">{plan.emoji}</span>
                      <div>
                        <p className="text-lg font-semibold text-[var(--palette-white)]">{plan.dreamLabel}</p>
                        <p className="text-xs text-[var(--foreground-muted)]">{plan.system.tagline}</p>
                      </div>
                      <span className="ml-auto rounded-full border border-[var(--palette-emerald-500)]/30 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--palette-emerald-400)]">
                        {plan.dailyTargetMinutes}m/day
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <PlanCounter label="Tasks created" value={plan.tasks.length} note="your first week" />
                      <PlanCounter label="Goals set" value={plan.goals.length} note="from your milestones" />
                      <PlanCounter label="Flashcards" value={plan.deck?.cardCount ?? 0} note={plan.deck?.title ?? "habit deck"} />
                    </div>

                    {plan.tasks.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">Start here</p>
                        <ul className="mt-2 space-y-1.5">
                          {plan.tasks.slice(0, 3).map((task) => (
                            <li key={task.id} className="flex items-start gap-2 rounded-xl border border-[var(--palette-white)]/10 bg-[var(--palette-white)]/[0.03] px-3 py-2">
                              <span aria-hidden="true" className="mt-0.5 text-[var(--brand-400)]">◆</span>
                              <span className="text-xs text-[var(--foreground-muted)]">{task.text}</span>
                              {task.minutes && <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[var(--foreground-subtle)]">{task.minutes}m</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[var(--palette-white)]/10 bg-[var(--palette-white)]/[0.02] p-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">Daily habit</p>
                        <p className="mt-1 text-xs text-[var(--foreground-muted)]">{plan.system.dailyHabit}</p>
                      </div>
                      <div className="rounded-2xl border border-[var(--palette-white)]/10 bg-[var(--palette-white)]/[0.02] p-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">Next milestone</p>
                        <p className="mt-1 text-xs text-[var(--foreground-muted)]">{plan.system.nextMilestone ?? "Keep the streak alive for a week."}</p>
                      </div>
                    </div>

                    {plan.skipped.length > 0 && (
                      <p className="mt-3 text-[11px] text-[var(--foreground-subtle)]">
                        Your existing {plan.skipped.join(", ")} were left untouched — setup never overwrites work you already have.
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-[var(--foreground-subtle)]">
                      Plan source: {plan.source === "template" ? "built-in templates" : plan.source}. Regenerate any time from your dashboard.
                    </p>
                  </div>

                  <button
                    onClick={next}
                    className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-600)] font-bold text-[var(--palette-white)] transition-all hover:bg-[var(--brand-700)]"
                  >
                    Looks good <ArrowRight size={18} />
                  </button>
                  <button
                    onClick={() => { setPlan(null); }}
                    className="mx-auto mt-4 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--foreground-subtle)] transition-colors hover:text-[var(--palette-white)]"
                  >
                    Change my answers
                  </button>
                </motion.div>
              )}
            </StepWrapper>
          )}

          {step === "ready" && (
            <motion.div key="ready" variants={BLUR_IN} initial="initial" animate="animate" className="text-center">
              <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--palette-emerald-500)]/10 border border-[var(--palette-emerald-500)]/20">
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                  <Sparkles size={40} className="text-[var(--palette-emerald-400)]" />
                </motion.div>
              </div>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Calibration <br /><span className="text-[var(--palette-emerald-400)]">Complete</span></h1>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {data.goal && <CalibrationTag label={GOALS.find(g => g.id === data.goal)?.label ?? data.goal} />}
                {data.style && <CalibrationTag label={`${data.focusDuration}m Loops`} />}
                {data.dailyHours && <CalibrationTag label={`${data.dailyHours}/day`} />}
                {plan && <CalibrationTag label={`${plan.tasks.length} tasks ready`} />}
                {plan?.deck && <CalibrationTag label={`${plan.deck.cardCount} cards`} />}
              </div>
              <p className="mt-8 text-[var(--muted-fg)] max-w-sm mx-auto">Systems are synced. Your academic civilization is ready for expansion.</p>
              {saveError && <p role="alert" className="mt-4 text-sm text-[var(--palette-red-400)]">{saveError}</p>}
              <button
                onClick={() => void finish()}
                disabled={saving}
                className="mt-12 w-full rounded-2xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] py-5 text-lg font-semibold text-[var(--palette-white)] shadow-[var(--shadow-lg)] transition-all disabled:opacity-50"
              >
                {saving ? "Deploying..." : "Enter Command Center"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {stepIndex > 0 && step !== "ready" && (
          <button
            onClick={back}
            className="mx-auto mt-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--foreground-subtle)] hover:text-[var(--palette-white)] transition-colors"
          >
            <ArrowLeft size={10} /> Back
          </button>
        )}
      </div>
    </div>
  );
}

/** Used until (or instead of) the server's list, so the step never renders empty. */
const FALLBACK_DREAMS: DreamOption[] = [
  { id: "iit", label: "IIT/JEE", emoji: "⚙️", desc: "Engineering entrance", suggestedMinutes: 360, tagline: null },
  { id: "neet", label: "NEET", emoji: "🩺", desc: "Medical entrance", suggestedMinutes: 360, tagline: null },
  { id: "upsc", label: "UPSC/IAS", emoji: "🏛️", desc: "Civil services", suggestedMinutes: 300, tagline: null },
  { id: "cat", label: "CAT/MBA", emoji: "💼", desc: "Management entrance", suggestedMinutes: 240, tagline: null },
  { id: "coding", label: "Coding interviews", emoji: "💻", desc: "Land the tech job", suggestedMinutes: 240, tagline: null },
  { id: "custom", label: "My own dream", emoji: "✨", desc: "Define your own path", suggestedMinutes: 180, tagline: null },
];

function PlanCounter({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-2xl border border-[var(--palette-white)]/10 bg-[var(--palette-white)]/[0.03] p-3">
      <p className="text-2xl font-semibold tabular-nums text-[var(--palette-white)]">{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--brand-400)]">{label}</p>
      <p className="mt-0.5 truncate text-[11px] text-[var(--foreground-subtle)]">{note}</p>
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

function OptionButton({ icon, label, selected, onClick }: { icon: React.ReactNode; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 rounded-2xl border p-5 text-left transition-all ${ selected ? "border-[var(--brand-400)] bg-[var(--brand-400)]/10" : "border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] hover:bg-[var(--palette-white)]/[0.05]" }`}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-sm font-bold text-[var(--palette-white)]">{label}</span>
    </button>
  );
}

function CalibrationTag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-[var(--palette-white)]/5 border border-[var(--palette-white)]/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--brand-400)] shadow-lg">
      {label}
    </span>
  );
}
