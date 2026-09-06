import { Fragment } from "react";
import { Link } from "wouter";
import { Reveal, RevealStagger, RevealItem } from "@/components/motion/Scroll";
import { ArrowRight, Brain, Clock, Flame, Music, Sparkles, Timer, Users, BookOpen, Calculator, HelpCircle, Atom, Layers, Coffee, Wind, GraduationCap } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { AdSlot } from "@/components/AdSlot";

const COLLECTIONS = [
  {
    title: "Exam preparation",
    description: "India-first prep guides — JEE, NEET, UPSC, SSC, GATE, CAT, CBSE boards, NDA, CTET, IBPS — plus exam anxiety and last-minute revision.",
    guides: [
      { href: "/exam", icon: <GraduationCap size={18} />, label: "All Exam Prep Guides", blurb: "14 practical guides: exam patterns, study plans, daily focus routines, mock protocols, and FAQ — from JEE Main to CBSE Class 10." },
    ],
  },
  {
    title: "Focus fundamentals",
    description: "The core skills: how attention works, how to concentrate for hours, and the science of deep work.",
    guides: [
      { href: "/focus-guide", icon: <Brain size={18} />, label: "How to Focus: The Complete Science-Based Guide", blurb: "Why focus is hard, the neuroscience of attention, and a complete system to rebuild your concentration." },
      { href: "/science-of-deep-work", icon: <Atom size={18} />, label: "The Science of Deep Work", blurb: "What happens in your brain during deep work — myelin, neurotransmitters, and the flow state." },
      { href: "/focus-music", icon: <Music size={18} />, label: "Best Music for Studying & Focus", blurb: "What research actually says about focus music, lo-fi, binaural beats, and silence." },
      { href: "/adhd-focus-tips", icon: <Sparkles size={18} />, label: "How to Focus with ADHD", blurb: "15 strategies engineered for ADHD brains — body doubling, the 10-minute rule, and dopamine-friendly systems." },
      { href: "/deep-work-guide", icon: <Atom size={18} />, label: "Deep Work: A Practical Guide", blurb: "What deep work is, the four scheduling patterns, and how to protect a block once it has started." },
      { href: "/how-to-focus-while-studying", icon: <BookOpen size={18} />, label: "How to Focus While Studying", blurb: "Nine changes ordered by impact and effort — phone placement, session length, retrieval, spacing." },
      { href: "/body-doubling", icon: <Users size={18} />, label: "Body Doubling Explained", blurb: "Why working alongside someone else makes starting easier, and how to use it online." },
    ],
  },
  {
    title: "Study methods",
    description: "Evidence-backed techniques for learning faster and remembering more.",
    guides: [
      { href: "/study-techniques", icon: <Layers size={18} />, label: "Best Study Techniques, Ranked by Evidence", blurb: "Active recall, spaced repetition, interleaving — which methods work and how to combine them." },
      { href: "/pomodoro-guide", icon: <Timer size={18} />, label: "The Pomodoro Technique: Complete Guide", blurb: "How to run 25/5 focus sprints correctly, and when to use longer deep-work intervals instead." },
      { href: "/two-hour-study-method", icon: <Clock size={18} />, label: "The 2-Hour Study Method", blurb: "A structured two-hour block — warm-up, deep study, retrieval, review — that beats scattered hours." },
      { href: "/deep-study-guide", icon: <BookOpen size={18} />, label: "Deep Study Guide", blurb: "Sustained concentration, memory retention, and peak academic performance in one playbook." },
      { href: "/feynman-technique", icon: <HelpCircle size={18} />, label: "The Feynman Technique", blurb: "Learn anything deeply by explaining it in plain language and attacking the gaps." },
    ],
  },
  {
    title: "Motivation & habits",
    description: "Starting is the hardest part. These guides make it easier.",
    guides: [
      { href: "/stop-procrastinating", icon: <Flame size={18} />, label: "How to Stop Procrastinating", blurb: "Why you procrastinate (it's not laziness) and 12 proven methods to stop — starting today." },
      { href: "/stop-scrolling", icon: <Coffee size={18} />, label: "How to Stop Scrolling", blurb: "Why the loop is hard to break, and a 60-second reset that works when willpower does not." },
      { href: "/virtual-study-room", icon: <Users size={18} />, label: "Virtual Study Rooms", blurb: "Study alongside other learners live — accountability and the body-doubling effect." },
      { href: "/study-with-me", icon: <Coffee size={18} />, label: "Study With Me: Live Sessions", blurb: "How live study-with-me sessions work and why they make focusing feel effortless." },
      { href: "/breathe", icon: <Wind size={18} />, label: "2-Minute Breathing Reset", blurb: "A guided breathing tool to reset your nervous system between study blocks." },
    ],
  },
  {
    title: "Free tools",
    description: "Interactive tools that turn the theory into a plan.",
    guides: [
      { href: "/study-method-quiz", icon: <Sparkles size={18} />, label: "Study Method Quiz", blurb: "Two minutes to find which study method fits your brain, schedule, and goals." },
      { href: "/study-calculator", icon: <Calculator size={18} />, label: "Study Time Calculator", blurb: "Enter your exam date and topics — get a personalized, retention-optimized schedule." },
      { href: "/pomodoro-timer", icon: <Timer size={18} />, label: "Pomodoro Timer", blurb: "Free 25/5 timer in your browser. Custom intervals, session history, streaks — no signup to start." },
      { href: "/study-timer", icon: <Clock size={18} />, label: "Study Timer", blurb: "Timed study blocks tied to subjects, so revision progress is measurable rather than a feeling." },
      { href: "/adhd-focus-tools", icon: <Sparkles size={18} />, label: "ADHD-Friendly Focus Tools", blurb: "Visual timers, body doubling rooms and recovery-friendly streaks. Free, no diagnosis required." },
    ],
  },
];

export default function GuidesPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PageSEO {...PAGE_SEO.guides} />

      {/* Hero */}
      <div className="relative isolate overflow-hidden border-b border-[var(--border-subtle)]">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[30rem] w-[52rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--brand-soft-hover),transparent_68%)] blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--brand-soft)] px-3.5 py-1.5 text-xs font-semibold text-[var(--brand-strong)]">
            <BookOpen size={12} /> Free guide library · Updated 2026
          </div>
          <h1 className="mb-4 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.045em] text-[var(--foreground)] sm:text-6xl">
            Every FocusArx guide,
            <br />
            <span className="text-[var(--brand-strong)]">in one place.</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-[var(--foreground-muted)] sm:text-lg">
            Science-backed guides on focus, deep work, studying, ADHD, procrastination, and study music. No fluff, no paywall — just practical systems you can start using today.
          </p>
        </div>
      </div>

      {/* Collections */}
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {COLLECTIONS.map((collection, collectionIdx) => (
          <Fragment key={collection.title}>
          {/* In-feed ad every second collection — never the first, so the page
              opens on content rather than an ad. */}
          {collectionIdx > 0 && collectionIdx % 2 === 0 && <AdSlot name="guidesInFeed" minHeight={120} />}
          <section className="mb-12">
            <Reveal distance={18}>
              <h2 className="mb-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">{collection.title}</h2>
              <p className="mb-5 text-sm text-[var(--foreground-muted)]">{collection.description}</p>
            </Reveal>
            <RevealStagger className="space-y-3">
              {collection.guides.map((g) => (
                <RevealItem key={g.href}>
                <Link
                  href={g.href}
                  className="group block rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 transition-[border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[var(--card-border)] hover:shadow-[var(--shadow-sm)] motion-reduce:hover:translate-y-0"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                      {g.icon}
                    </div>
                    <div>
                      <p className="font-semibold tracking-tight text-[var(--foreground)] transition-colors group-hover:text-[var(--brand-strong)]">{g.label}</p>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">{g.blurb}</p>
                    </div>
                    <ArrowRight size={16} className="ml-auto mt-1 shrink-0 text-[var(--foreground-subtle)] transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5 group-hover:text-[var(--brand-strong)] motion-reduce:group-hover:translate-x-0" />
                  </div>
                </Link>
                </RevealItem>
              ))}
            </RevealStagger>
          </section>
          </Fragment>
        ))}

        {/* CTA */}
        <div className="rounded-[var(--radius-2xl)] border border-[var(--card-border)] bg-[radial-gradient(circle_at_50%_0%,var(--brand-soft-hover),transparent_65%)] p-8 text-center shadow-[var(--shadow-violet-sm)]">
          <h3 className="mb-2 text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">Turn what you read into what you do</h3>
          <p className="mb-6 text-sm text-[var(--foreground-muted)]">
            Every guide works better with a timer, streaks, and an AI coach keeping you honest. FocusArx is free forever.
          </p>
          <Link
            href="/signup"
            className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--brand-600)] px-6 text-sm font-semibold text-[var(--neutral-0)] shadow-[var(--shadow-violet-sm)] transition-[background-color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[var(--brand-700)] hover:shadow-[var(--shadow-violet-md)] active:scale-[0.98]"
          >
            Start focusing free <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
