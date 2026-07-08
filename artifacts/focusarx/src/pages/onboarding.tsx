import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { getToken } from "@/lib/auth";

type OnboardingData = {
  goal: string;
  challenge: string;
  style: string;
  dailyHours: string;
  focusDuration: number;
};

const GOALS = [
  { id: "exams", label: "Exam preparation", icon: "📚" },
  { id: "deepwork", label: "Deep work & research", icon: "🔬" },
  { id: "coding", label: "Coding & building", icon: "💻" },
  { id: "creative", label: "Creative projects", icon: "🎨" },
  { id: "language", label: "Language learning", icon: "🌍" },
  { id: "other", label: "Something else", icon: "✨" },
];

const CHALLENGES = [
  { id: "phone", label: "Phone & social media", icon: "📱" },
  { id: "procrastination", label: "Procrastination", icon: "⏳" },
  { id: "time", label: "Losing track of time", icon: "⌛" },
  { id: "motivation", label: "Staying motivated", icon: "🔋" },
  { id: "overwhelmed", label: "Too many tasks", icon: "📋" },
  { id: "environment", label: "Noisy environment", icon: "🔇" },
];

const STYLES = [
  { id: "sprinter", label: "Sprinter", sub: "Short, intense 25-min bursts", icon: "⚡", duration: 25 },
  { id: "balanced", label: "Balanced", sub: "Classic 45-min sessions", icon: "⚖️", duration: 45 },
  { id: "marathoner", label: "Marathoner", sub: "Deep 90-min+ dives", icon: "🏃", duration: 90 },
];

const DAILY_HOURS = [
  { id: "1h", label: "1 hour", sub: "Light & consistent" },
  { id: "2h", label: "2 hours", sub: "Solid daily habit" },
  { id: "4h", label: "4 hours", sub: "Serious focus" },
  { id: "6h", label: "6+ hours", sub: "Full deep work mode" },
];

const STEPS = ["goal", "challenge", "style", "hours", "ready"] as const;
type Step = typeof STEPS[number];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { refresh } = useAuth();
  const [step, setStep] = useState<Step>("goal");
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Partial<OnboardingData>>({});

  const stepIndex = STEPS.indexOf(step);
  const progress = (stepIndex / (STEPS.length - 1)) * 100;

  const pick = (key: keyof OnboardingData, value: string | number) => {
    setData((prev) => ({ ...prev, [key]: value }));
    const nextStep = STEPS[stepIndex + 1];
    if (nextStep) setTimeout(() => setStep(nextStep), 220);
  };

  const finish = async () => {
    setSaving(true);
    try {
      const token = getToken();
      await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ data }),
      });
      await refresh();
      setLocation("/dashboard");
    } catch {
      setLocation("/dashboard");
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              FocusArx Setup
            </p>
            <p className="text-xs text-zinc-600">
              {stepIndex + 1} / {STEPS.length}
            </p>
          </div>
          <div className="h-1 w-full rounded-full bg-zinc-800">
            <motion.div
              className="h-full rounded-full bg-rose-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === "goal" && (
            <StepCard key="goal" title="What's your main focus goal?" sub="We'll personalise your experience around this.">
              <div className="grid grid-cols-2 gap-2.5">
                {GOALS.map((g) => (
                  <OptionButton key={g.id} icon={g.icon} label={g.label} selected={data.goal === g.id} onClick={() => pick("goal", g.id)} />
                ))}
              </div>
            </StepCard>
          )}

          {step === "challenge" && (
            <StepCard key="challenge" title="What's your biggest focus challenge?" sub="Be honest — we've all been there.">
              <div className="grid grid-cols-2 gap-2.5">
                {CHALLENGES.map((c) => (
                  <OptionButton key={c.id} icon={c.icon} label={c.label} selected={data.challenge === c.id} onClick={() => pick("challenge", c.id)} />
                ))}
              </div>
            </StepCard>
          )}

          {step === "style" && (
            <StepCard key="style" title="What's your focus style?" sub="This sets your default session length.">
              <div className="flex flex-col gap-3">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setData((prev) => ({ ...prev, style: s.id, focusDuration: s.duration }));
                      const nextStep = STEPS[stepIndex + 1];
                      if (nextStep) setTimeout(() => setStep(nextStep), 220);
                    }}
                    className={`flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all ${
                      data.style === s.id
                        ? "border-rose-500/60 bg-rose-950/30 ring-1 ring-rose-500/30"
                        : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/60"
                    }`}
                  >
                    <span className="text-2xl">{s.icon}</span>
                    <div>
                      <p className="font-semibold text-zinc-100">{s.label}</p>
                      <p className="text-sm text-zinc-500">{s.sub}</p>
                    </div>
                    <span className="ml-auto rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{s.duration}m</span>
                  </button>
                ))}
              </div>
            </StepCard>
          )}

          {step === "hours" && (
            <StepCard key="hours" title="How many hours do you want to focus daily?" sub="Set a target you can actually hit.">
              <div className="grid grid-cols-2 gap-2.5">
                {DAILY_HOURS.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => pick("dailyHours", h.id)}
                    className={`flex flex-col items-start rounded-2xl border px-4 py-4 text-left transition-all ${
                      data.dailyHours === h.id
                        ? "border-rose-500/60 bg-rose-950/30 ring-1 ring-rose-500/30"
                        : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/60"
                    }`}
                  >
                    <p className="text-lg font-bold text-zinc-100">{h.label}</p>
                    <p className="text-xs text-zinc-500">{h.sub}</p>
                  </button>
                ))}
              </div>
            </StepCard>
          )}

          {step === "ready" && (
            <StepCard key="ready" title="You're all set." sub="">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-6 py-4 text-center"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-950 text-3xl">
                  🎯
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-300">Here's your setup:</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {data.goal && <Tag label={GOALS.find(g => g.id === data.goal)?.label ?? data.goal} />}
                    {data.style && <Tag label={`${STYLES.find(s => s.id === data.style)?.label ?? ""} · ${data.focusDuration}m sessions`} />}
                    {data.dailyHours && <Tag label={`${DAILY_HOURS.find(h => h.id === data.dailyHours)?.label ?? ""}/day`} />}
                  </div>
                </div>
                <p className="text-sm text-zinc-500 max-w-xs">
                  Your timer and goals are ready. You can change these anytime in settings.
                </p>
                <motion.button
                  onClick={() => void finish()}
                  disabled={saving}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full rounded-2xl bg-rose-600 py-3.5 text-base font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Start focusing →"}
                </motion.button>
              </motion.div>
            </StepCard>
          )}
        </AnimatePresence>

        {stepIndex > 0 && step !== "ready" && (
          <button
            onClick={() => setStep(STEPS[stepIndex - 1]!)}
            className="mx-auto mt-6 flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

function StepCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-100">{title}</h2>
        {sub && <p className="mt-1.5 text-sm text-zinc-500">{sub}</p>}
      </div>
      {children}
    </motion.div>
  );
}

function OptionButton({ icon, label, selected, onClick }: { icon: string; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all ${
        selected
          ? "border-rose-500/60 bg-rose-950/30 ring-1 ring-rose-500/30"
          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/60"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-medium text-zinc-200">{label}</span>
    </button>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">{label}</span>
  );
}
