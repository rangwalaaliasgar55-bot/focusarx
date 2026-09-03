import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Repeat, Layers, PenTool, Eye, Cpu } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Technique = {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  name: string;
  tagline: string;
  when: string;
  how: string;
};

const TECHNIQUES: Technique[] = [
  {
    icon: Repeat,
    name: "Spaced Repetition",
    tagline: "The single most effective learning technique known to science",
    when: "Memorizing facts, vocabulary, formulas, historical dates, anatomy",
    how: "Review material at increasing intervals: 1 day → 3 days → 7 days → 14 days → 30 days. Each review just before forgetting cements it deeply. Use Anki or FocusArx task tagging to schedule reviews.",
  },
  {
    icon: PenTool,
    name: "Active Recall",
    tagline: "Retrieval practice beats re-reading by 2–3×",
    when: "Any subject — especially effective right after learning new material",
    how: "Close your notes and write, speak, or draw everything you remember. Check accuracy. Repeat. The effort of retrieval — not re-reading — is what builds memory. Use the 'blank page' method: one topic, blank sheet, dump everything.",
  },
  {
    icon: Layers,
    name: "Feynman Technique",
    tagline: "If you can't explain it simply, you don't understand it",
    when: "Complex concepts — physics, algorithms, economics, philosophy",
    how: "Pick a concept. Explain it to a 12-year-old in plain language. Find the gaps where you stumble. Go back to the source material. Simplify further. Repeat until the explanation is clean and complete.",
  },
  {
    icon: Eye,
    name: "Mind Mapping",
    tagline: "Visual thinking for connected, non-linear knowledge",
    when: "Summarizing chapters, brainstorming essay structure, understanding systems",
    how: "Start with a central concept. Branch out into main ideas. Branch those into sub-ideas. Use colour and images. The act of creating the map forces you to organize relationships — the map itself is secondary.",
  },
  {
    icon: BookOpen,
    name: "SQ3R Reading",
    tagline: "Active reading that triples retention over passive skimming",
    when: "Dense textbooks, academic papers, long articles",
    how: "Survey (skim headings and summary), Question (turn headings into questions), Read (actively find answers), Recite (close the book, summarise), Review (check notes against text). Each step takes less than 3 minutes per chapter section.",
  },
  {
    icon: Cpu,
    name: "Interleaving",
    tagline: "Mixing topics feels harder but builds deeper mastery",
    when: "Math, science problem sets, language learning",
    how: "Instead of practising 30 calculus problems in a row, alternate: 10 calculus → 10 statistics → 10 algebra → back to calculus. Performance on practice drops, but long-term retention and transfer to new problems dramatically improves.",
  },
];

export default function StudyTechniquesPage() {
  const reduceMotion = useReducedMotion();
  const reveal = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-60px" },
        transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PageSEO {...PAGE_SEO.studyTechniques} />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <header className="relative isolate overflow-hidden border-b border-[var(--border-subtle)]">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[32rem] w-[52rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--brand-soft-hover),transparent_68%)] blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24">
          <motion.div {...reveal}>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--brand-soft)] px-3.5 py-1.5 text-xs font-semibold text-[var(--brand-strong)]">
              <BookOpen size={13} strokeWidth={1.75} aria-hidden="true" /> Evidence-based learning
            </span>
          </motion.div>
          <motion.h1
            {...reveal}
            className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-6xl"
          >
            Study smarter,
            <br />
            <span className="text-[var(--brand-strong)]">not harder.</span>
          </motion.h1>
          <motion.p
            {...reveal}
            className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-[var(--foreground-muted)] sm:text-lg"
          >
            Six science-backed study techniques used by medical students, competitive programmers,
            and top exam scorers — with a practical how-to for each.
          </motion.p>
          <motion.div {...reveal} className="mt-9">
            <Button asChild size="xl">
              <Link href="/signup">
                Track your study sessions free <ArrowRight />
              </Link>
            </Button>
          </motion.div>
        </div>
      </header>

      {/* ── Techniques ────────────────────────────────────────── */}
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <motion.div {...reveal}>
          <p className="page-eyebrow">The six techniques</p>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
            Ranked roughly by evidence strength.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
            Spaced repetition and active recall consistently outperform all other methods in
            randomized controlled studies.
          </p>
        </motion.div>

        <div className="mt-10 space-y-5">
          {TECHNIQUES.map((t, i) => (
            <motion.article
              key={t.name}
              {...reveal}
              className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 transition-[border-color,box-shadow] duration-[var(--duration-normal)] hover:border-[var(--card-border)] hover:shadow-[var(--shadow-sm)] sm:p-7"
            >
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                  <t.icon size={19} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-xs font-semibold tabular-nums text-[var(--foreground-subtle)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-lg font-semibold tracking-tight">{t.name}</h3>
                  </div>
                  <p className="mt-1 text-sm text-[var(--foreground-muted)]">{t.tagline}</p>
                  <dl className="mt-5 space-y-4">
                    <div>
                      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
                        Best for
                      </dt>
                      <dd className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">
                        {t.when}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
                        How to do it
                      </dt>
                      <dd className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">
                        {t.how}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* ── CTA ─────────────────────────────────────────────── */}
        <motion.section
          {...reveal}
          className="mt-14 overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--card-border)] bg-[radial-gradient(circle_at_50%_0%,var(--brand-soft-hover),transparent_65%)] px-6 py-12 text-center shadow-[var(--shadow-violet-sm)] sm:px-10"
        >
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-[var(--radius-lg)] bg-[var(--brand-soft)] text-[var(--brand-strong)]">
            <BookOpen size={22} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 className="mx-auto mt-5 max-w-md text-balance text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Put these techniques into practice
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--foreground-muted)]">
            FocusArx helps you schedule sessions, track focus quality with AI, and stay accountable
            with friends — all free.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">
                Start free <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pomodoro-guide">Pomodoro technique guide</Link>
            </Button>
          </div>
        </motion.section>
      </main>

      {/* Crawlable related links */}
      <nav aria-label="Related pages" className="border-t border-[var(--border-subtle)] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-[var(--foreground-subtle)]">
          <Link href="/" className="transition-colors hover:text-[var(--foreground)]">Home</Link>
          <Link href="/focus-guide" className="transition-colors hover:text-[var(--foreground)]">Focus guide</Link>
          <Link href="/pomodoro-guide" className="transition-colors hover:text-[var(--foreground)]">Pomodoro guide</Link>
          <Link href="/feynman-technique" className="transition-colors hover:text-[var(--foreground)]">Feynman technique</Link>
          <Link href="/study-rooms" className="transition-colors hover:text-[var(--foreground)]">Study rooms</Link>
          <Link href="/guides" className="transition-colors hover:text-[var(--foreground)]">All guides</Link>
        </div>
      </nav>
    </div>
  );
}
