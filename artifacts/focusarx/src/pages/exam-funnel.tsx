import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { PageSEO } from "@/components/PageSEO";
import { findExamGuide } from "@/content/exam/index.mjs";
import { getFunnelAngle } from "@/content/exam-funnel.mjs";
import { dispatchFocusDeepLink } from "@/lib/focusDeepLink";
import { FocusTimerMobileFirst } from "@/components/mobile/FocusTimerMobileFirst";

/**
 * Programmatic exam funnel (Phase 4.2): /pomodoro-timer-for/:exam.
 * The page IS the tool — a live, usable timer above the fold — followed by
 * the exam-specific angle and the full guide content. Extend via
 * src/content/exam-funnel.mjs (angle) + src/content/exam/*.mjs (guide).
 */
export default function ExamFunnelPage() {
  const { exam } = useParams<{ exam: string }>();
  const guide = findExamGuide(exam ?? "");
  const funnel = getFunnelAngle(exam ?? "");

  useEffect(() => {
    if (funnel) {
      dispatchFocusDeepLink({ durationSeconds: funnel.minutes * 60, task: null, src: null, armed: true });
    }
  }, [exam]);

  if (!guide || !funnel) {
    return (
      <div className="mx-auto w-full max-w-[980px] px-4 py-16 sm:px-6">
        <PageSEO title="Exam timer not found | FocusArx" description="That exam timer does not exist." noindex />
        <h1 className="text-h1">Exam timer not found</h1>
        <p className="text-body mt-3 text-[var(--foreground-muted)]">Try the exam hub instead.</p>
        <Link href="/exam" className="mt-6 inline-block font-semibold text-[var(--brand-strong)]">← Exam prep hub</Link>
      </div>
    );
  }

  const examName = guide.exam?.name ?? guide.h1;
  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-12 sm:px-6">
      <PageSEO
        title={`Pomodoro Timer for ${examName} | Focus Sessions That Count`}
        description={`Free Pomodoro timer tuned for ${examName}: ${funnel.angle} No account needed to start.`}
        canonical={`https://focusarx.site/pomodoro-timer-for/${guide.slug}`}
      />
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
        Pomodoro timer · {examName}
      </p>
      <h1 className="text-h1 mt-2">Pomodoro timer for {examName}</h1>
      <p className="text-body mt-3 max-w-2xl text-[17px] text-[var(--foreground-muted)]">{funnel.angle}</p>

      <div className="mt-8 w-full max-w-sm">
        <FocusTimerMobileFirst />
      </div>

      <div className="mt-12 max-w-2xl">
        <h2 className="text-h3">How to use it for {examName}</h2>
        <p className="text-body mt-2 text-[var(--foreground-muted)]">{guide.lead}</p>
        {guide.sections.slice(0, 3).map((s) => (
          <section key={s.h} className="mt-6">
            <h3 className="text-h4">{s.h}</h3>
            <p className="text-body mt-2 text-[var(--foreground-muted)]">{s.p}</p>
          </section>
        ))}
        <Link
          href={`/exam/${guide.slug}`}
          className="mt-6 inline-block font-semibold text-[var(--brand-strong)]"
        >
          Read the full {examName} guide →
        </Link>
      </div>
    </div>
  );
}
