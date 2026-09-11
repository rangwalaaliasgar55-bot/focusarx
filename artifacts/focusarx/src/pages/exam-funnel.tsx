import { Suspense, useEffect } from "react";
import { Link, useParams } from "wouter";
import { PageSEO } from "@/components/PageSEO";
import { EXAM_SLUG_ORDER, examDisplayName } from "@/content/exam/derive.mjs";
import { FUNNEL_ANGLES, getFunnelAngle } from "@/content/exam-funnel.mjs";
import { useExamGuide } from "@/lib/examGuideLoader";
import { dispatchFocusDeepLink } from "@/lib/focusDeepLink";
import { FocusTimerMobileFirst } from "@/components/mobile/FocusTimerMobileFirst";

/**
 * Programmatic exam funnel (Phase 4.2): /pomodoro-timer-for/:exam.
 * The page IS the tool — a live, usable timer above the fold — followed by
 * the exam-specific angle and the full guide content. Extend via
 * src/content/exam-funnel.mjs (angle) + src/content/exam/*.mjs (guide).
 *
 * The guide body loads one slug at a time through src/lib/examGuideLoader.ts,
 * so this route ships its own exam's prose instead of the whole cluster. The
 * deep-link dispatch lives inside the suspended body on purpose: the timer
 * subscribes to the event in its own effect, and child effects run before
 * parent effects, so dispatching here still lands after the listener exists.
 * Dispatching from outside the boundary would fire before the timer chunk had
 * rendered and silently lose the pre-armed duration.
 */

function FunnelSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-12 sm:px-6 space-y-4" aria-hidden="true">
      <div className="h-4 w-40 rounded-lg bg-[var(--surface-1)] animate-pulse" />
      <div className="h-9 w-2/3 rounded-lg bg-[var(--surface-1)] animate-pulse" />
      <div className="h-64 w-full max-w-sm rounded-2xl bg-[var(--surface-1)] animate-pulse" />
    </div>
  );
}

function ExamFunnelBody({ exam }: { exam: string }) {
  const guide = useExamGuide(exam);
  const funnel = getFunnelAngle(exam);

  useEffect(() => {
    if (funnel) {
      dispatchFocusDeepLink({ durationSeconds: funnel.minutes * 60, task: null, src: null, armed: true });
    }
  }, [exam, funnel]);

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

  const examName = examDisplayName(guide.slug);
  const siblings = EXAM_SLUG_ORDER.filter((slug) => FUNNEL_ANGLES[slug] && slug !== guide.slug).slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-12 sm:px-6">
      <PageSEO
        // No brand suffix and no tagline here on purpose: PageSEO appends `| FocusArx`
        // and clamps both fields to what search results actually render.
        title={`Pomodoro timer for ${examName}`}
        description={`Free Pomodoro timer tuned for ${examName}: ${funnel.angle} No account needed to start.`}
        canonical={`/pomodoro-timer-for/${guide.slug}`}
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

      {/* Sibling timer pages. These are real navigation, not filler: every
          /pomodoro-timer-for/<exam> page used to link out to its guide and the
          hub, but nothing linked back in, so the whole cluster was reachable
          only from the sitemap. Cross-linking the set both ways is what makes
          the pages crawlable and gives a student one click to the next exam.
          Names come from the derived slug → name map, so this list costs no
          guide-body bytes. */}
      <nav aria-label="Pomodoro timers for other exams" className="mt-12 max-w-2xl">
        <h2 className="text-h4 text-[var(--foreground-subtle)]">Pomodoro timer for another exam</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {siblings.map((slug) => (
            <li key={slug}>
              <Link
                href={`/pomodoro-timer-for/${slug}`}
                className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--brand-strong)] hover:underline"
              >
                {examDisplayName(slug)}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/exam" className="mt-4 inline-block text-sm font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
          All exam prep guides →
        </Link>
      </nav>
    </div>
  );
}

export default function ExamFunnelPage() {
  const { exam } = useParams<{ exam: string }>();
  return (
    <Suspense fallback={<FunnelSkeleton />}>
      <ExamFunnelBody exam={exam ?? ""} />
    </Suspense>
  );
}
