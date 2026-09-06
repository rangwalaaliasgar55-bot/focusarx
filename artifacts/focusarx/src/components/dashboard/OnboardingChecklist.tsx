import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Check, ChevronRight, X } from "lucide-react";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type OnboardingSignals = {
  totalSessions: number;
  taskCount: number;
  studyRoomCount: number;
  profileComplete: boolean;
  onboardingQuizDone: boolean;
};

const DISMISS_KEY = "focusarx-onboarding-dismissed";
const DAILY_GOAL_KEY = "focusarx-daily-goal-minutes";

/**
 * Dashboard onboarding checklist (audit Gap 5). Each step maps to a real
 * signal (server-side counters or a local setting) so ticks always reflect
 * reality. Hides itself once all steps are done or the user dismisses it.
 */
export default function OnboardingChecklist() {
  const { status } = useAuth();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  const query = useQuery<OnboardingSignals>({
    queryKey: ["stats-onboarding"],
    queryFn: () => apiJson<OnboardingSignals>("/api/stats/onboarding"),
    enabled: status === "authenticated",
    staleTime: 30_000,
  });

  const signals = query.data;

  const steps = useMemo(() => {
    if (!signals) return [];
    const goalSet = localStorage.getItem(DAILY_GOAL_KEY) !== null;
    return [
      { id: "account", label: "Create your account", href: null as string | null, done: true },
      { id: "session", label: "Complete your first focus session", href: "/", done: signals.totalSessions > 0 },
      { id: "task", label: "Add your first task", href: "/tasks", done: signals.taskCount > 0 },
      { id: "goal", label: "Set a daily goal", href: "/", done: goalSet },
      { id: "quiz", label: "Personalize your setup", href: "/onboarding", done: signals.onboardingQuizDone },
      { id: "room", label: "Join a study room", href: "/study-rooms", done: signals.studyRoomCount > 0 },
      { id: "profile", label: "Customize your profile", href: "/profile", done: signals.profileComplete },
    ];
  }, [signals]);

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = steps.length > 0 && doneCount === steps.length;

  useEffect(() => {
    if (allDone) localStorage.setItem(DISMISS_KEY, "1");
  }, [allDone]);

  if (status !== "authenticated" || !signals || dismissed || allDone) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      aria-labelledby="onboarding-title"
    >
      <Card elevation="glow" className="border-[var(--brand-500)]/30">
        <CardContent className="py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-lg)] bg-[var(--brand-soft)] text-lg" aria-hidden="true">🚀</span>
              <div>
                <h2 id="onboarding-title" className="text-base font-semibold leading-tight">Getting started</h2>
                <p className="text-xs text-[var(--foreground-muted)]">{doneCount} of {steps.length} complete — unlock the full FocusArx loop.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold tabular-nums text-[var(--brand-strong)]">{Math.round((doneCount / steps.length) * 100)}%</span>
              <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Hide getting started checklist" className="size-8">
                <X />
              </Button>
            </div>
          </div>

          <Progress value={(doneCount / steps.length) * 100} className="mt-4" />

          <ul className="mt-4 grid gap-1 sm:grid-cols-2">
            {steps.map((step, index) => {
              const body = (
                <>
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                      step.done
                        ? "border-[var(--success)] bg-[var(--success)] text-[var(--palette-white)]"
                        : "border-[var(--border-strong)] text-transparent"
                    }`}
                  >
                    <Check className="size-3" />
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-sm ${step.done ? "text-[var(--foreground-subtle)] line-through" : "font-medium text-[var(--foreground-muted)]"}`}>
                    {step.label}
                  </span>
                  {!step.done && step.href && <ChevronRight className="size-4 shrink-0 text-[var(--foreground-subtle)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--brand-strong)]" />}
                </>
              );
              return (
                <motion.li key={step.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }}>
                  {step.done || !step.href ? (
                    <div className="flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2">{body}</div>
                  ) : (
                    <Link href={step.href} className="group flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 hover:bg-[var(--surface-hover)]">
                      {body}
                    </Link>
                  )}
                </motion.li>
              );
            })}
          </ul>

          {doneCount >= 4 && !allDone && (
            <p className="mt-4 rounded-[var(--radius-md)] bg-[var(--brand-soft)] px-3 py-2 text-xs font-medium text-[var(--brand-strong)]">
              Almost there — {steps.length - doneCount} step{steps.length - doneCount === 1 ? "" : "s"} left to complete your setup.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.section>
  );
}
