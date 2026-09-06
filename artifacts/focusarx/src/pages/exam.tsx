import { useState } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Clock,
  Flame,
  GraduationCap,
  HelpCircle,
  ListChecks,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";
import { PageSEO } from "@/components/PageSEO";
import { EXAM_GUIDES, EXAM_HUB, findExamGuide } from "@/content/exam/index.mjs";

const BASE_URL = (import.meta.env.VITE_APP_URL || "https://focusarx.site").replace(/\/+$/, "");

/** Serverless OG card for this guide (Workstream E OG automation). */
function ogCardUrl(title: string, subtitle: string): string {
  return `${BASE_URL}/api/og?tag=${encodeURIComponent("EXAM GUIDE")}&title=${encodeURIComponent(
    title.replace(/\s*\|\s*FocusArx.*$/i, "")
  )}&subtitle=${encodeURIComponent(subtitle)}&accent=${encodeURIComponent("#a78bfa")}`;
}

function articleSchema(guide: { h1: string; description: string; slug: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.h1,
    description: guide.description,
    author: { "@type": "Organization", name: "FocusArx" },
    publisher: {
      "@type": "Organization",
      name: "FocusArx",
      logo: { "@type": "ImageObject", url: `${BASE_URL}/logo.png` },
    },
    dateModified: new Date().toISOString().slice(0, 10),
    mainEntityOfPage: `${BASE_URL}/exam/${guide.slug}`,
  };
}

function faqSchema(faq: [string, string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

function RelatedLinks({ related }: { related: string[] }) {
  if (!related.length) return null;
  return (
    <div className="mt-16 border-t border-[var(--border)] pt-8">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--foreground-subtle)] mb-4">Keep reading</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {related.map((pair) => {
          const [href, label] = pair.split("|");
          return (
            <Link
              key={href}
              href={href}
              className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground-muted)] transition-colors hover:border-[var(--card-border)] hover:text-[var(--foreground)]"
            >
              <span>{label || href}</span>
              <ArrowRight size={14} className="shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function FaqAccordion({ faq }: { faq: [string, string][] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mt-16">
      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
        <HelpCircle size={20} className="text-[var(--palette-violet-400)]" />
        Frequently asked questions
      </h2>
      <div className="space-y-3">
        {faq.map(([q, a], i) => (
          <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold"
              aria-expanded={open === i}
            >
              {q}
              <ChevronDown size={16} className={`shrink-0 text-[var(--foreground-subtle)] transition-transform ${open === i ? "rotate-180" : ""}`} />
            </button>
            {open === i && <p className="px-5 pb-5 text-sm leading-relaxed text-[var(--foreground-muted)]">{a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function CtaBlock() {
  return (
    <div className="mt-16 rounded-3xl border border-[var(--card-border)] bg-gradient-to-br from-[var(--palette-violet-500)]/10 to-[var(--palette-indigo-500)]/10 p-8 text-center">
      <Timer size={28} className="mx-auto mb-4 text-[var(--palette-violet-400)]" />
      <h3 className="text-2xl font-semibold mb-2">Turn the plan into focused hours</h3>
      <p className="text-sm text-[var(--foreground-muted)] max-w-md mx-auto mb-6">
        The plan only works if the sessions happen. FocusArx's free timer runs 25/5 sprints, 90-minute deep blocks, and
        full exam-length mock simulations — and scores every one.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/signup"
          className="rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02]"
        >
          Start focusing free
        </Link>
        <Link href="/study-calculator" className="rounded-xl border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]">
          Study time calculator
        </Link>
      </div>
    </div>
  );
}

// ── Single exam guide (/exam/:slug) ─────────────────────────────────
export function ExamGuidePage() {
  const { slug } = useParams<{ slug: string }>();
  const guide = findExamGuide(slug || "");

  if (!guide) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <PageSEO title="Exam guide not found | FocusArx" description="This exam guide doesn't exist — browse the full exam guide library instead." canonical="/exam" noindex />
        <div className="max-w-3xl mx-auto px-6 py-32 text-center">
          <h1 className="text-4xl font-semibold mb-4">Guide not found</h1>
          <p className="text-[var(--foreground-muted)] mb-8">No exam guide at this address. The full library is one click away.</p>
          <Link href="/exam" className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--brand-600)] px-6 text-sm font-semibold text-[var(--neutral-0)] shadow-[var(--shadow-violet-sm)] transition-[background-color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[var(--brand-700)] hover:shadow-[var(--shadow-violet-md)] active:scale-[0.98]">
            <ArrowLeft size={15} /> All exam guides
          </Link>
        </div>
      </div>
    );
  }

  const title = guide.title;
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PageSEO
        title={title}
        description={guide.description}
        canonical={`/exam/${guide.slug}`}
        keywords={guide.keywords}
        ogImage={ogCardUrl(guide.title, guide.lead)}
        ogType="article"
        structuredData={[articleSchema(guide), faqSchema(guide.faq)]}
      />

      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        <Link href="/exam" className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--foreground-subtle)] hover:text-[var(--foreground)] mb-8">
          <ArrowLeft size={14} /> All exam guides
        </Link>

        <header className="mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--palette-violet-500)]/30 bg-[var(--palette-violet-500)]/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--palette-violet-300)] mb-6">
            <GraduationCap size={12} /> {guide.exam ? guide.exam.name : "Universal exam strategy"}
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-tight mb-5">{guide.h1}</h1>
          <p className="text-lg text-[var(--foreground-muted)] leading-relaxed">{guide.lead}</p>
        </header>

        {guide.exam && (
          <div className="mb-14 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--foreground-subtle)] mb-4">Exam at a glance</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <Target size={16} className="mt-0.5 shrink-0 text-[var(--palette-violet-400)]" />
                <div>
                  <p className="text-[11px] text-[var(--foreground-subtle)] uppercase tracking-wider">Conducted by</p>
                  <p className="text-sm font-semibold">{guide.exam.authority}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ListChecks size={16} className="mt-0.5 shrink-0 text-[var(--palette-violet-400)]" />
                <div>
                  <p className="text-[11px] text-[var(--foreground-subtle)] uppercase tracking-wider">Format</p>
                  <p className="text-sm font-semibold">{guide.exam.mode}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={16} className="mt-0.5 shrink-0 text-[var(--palette-violet-400)]" />
                <div>
                  <p className="text-[11px] text-[var(--foreground-subtle)] uppercase tracking-wider">Frequency</p>
                  <p className="text-sm font-semibold">{guide.exam.frequency}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Flame size={16} className="mt-0.5 shrink-0 text-[var(--palette-violet-400)]" />
                <div>
                  <p className="text-[11px] text-[var(--foreground-subtle)] uppercase tracking-wider">The short version</p>
                  <p className="text-sm font-semibold">{guide.exam.tagline}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <article className="space-y-12">
          {guide.sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-2xl font-semibold mb-4 tracking-tight">{s.h}</h2>
              {(Array.isArray(s.p) ? s.p : [s.p]).map((p, j) => (
                <p key={j} className="mb-4 leading-relaxed text-[var(--foreground-muted)] last:mb-0">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </article>

        <FaqAccordion faq={guide.faq} />
        <CtaBlock />
        <RelatedLinks related={guide.related} />
      </div>
    </div>
  );
}

// ── Exam hub (/exam) ───────────────────────────────────────────────
export function ExamHubPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PageSEO
        title={EXAM_HUB.title}
        description={EXAM_HUB.description}
        canonical="/exam"
        keywords="exam preparation india jee neet upsc ssc cbse boards cgl gate cat nda ctet ibps study plan"
        ogImage={ogCardUrl(EXAM_HUB.title, EXAM_HUB.lead)}
        structuredData={[faqSchema(EXAM_HUB.faq)]}
      />

      <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        <header className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--palette-violet-500)]/30 bg-[var(--palette-violet-500)]/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--palette-violet-300)] mb-8">
            <Sparkles size={12} /> Exam guide library
          </div>
          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight mb-6">{EXAM_HUB.h1}</h1>
          <p className="text-lg text-[var(--foreground-muted)] max-w-2xl mx-auto leading-relaxed">{EXAM_HUB.lead}</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-16">
          {EXAM_GUIDES.map((g) => (
            <Link
              key={g.slug}
              href={`/exam/${g.slug}`}
              className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 transition-all hover:border-[var(--card-border)] hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={14} className="text-[var(--palette-violet-400)]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-subtle)]">
                  {g.exam ? g.exam.name : "Universal"}
                </span>
              </div>
              <h2 className="text-base font-bold mb-2 group-hover:text-[var(--palette-violet-300)] transition-colors leading-snug">
                {g.h1}
              </h2>
              <p className="text-xs leading-relaxed text-[var(--foreground-muted)] line-clamp-3">{g.lead}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--palette-violet-400)]">
                Read the guide <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>

        {EXAM_HUB.sections.map((s, i) => (
          <section key={i} className="mb-10 max-w-3xl mx-auto">
            <h2 className="text-xl font-semibold mb-3 tracking-tight">{s.h}</h2>
            {(Array.isArray(s.p) ? s.p : [s.p]).map((p, j) => (
              <p key={j} className="leading-relaxed text-[var(--foreground-muted)] last:mb-0">
                {p}
              </p>
            ))}
          </section>
        ))}

        <FaqAccordion faq={EXAM_HUB.faq} />
        <CtaBlock />
      </div>
    </div>
  );
}

export default ExamGuidePage;
