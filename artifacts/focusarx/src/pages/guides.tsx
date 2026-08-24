import { Link } from "wouter";
import { ArrowRight, Brain, Clock, Flame, Music, Sparkles, Timer, Users, BookOpen, Calculator, HelpCircle, Atom, Layers, Coffee, Wind } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

const COLLECTIONS = [
  {
    title: "Focus fundamentals",
    description: "The core skills: how attention works, how to concentrate for hours, and the science of deep work.",
    guides: [
      { href: "/focus-guide", icon: <Brain size={18} />, label: "How to Focus: The Complete Science-Based Guide", blurb: "Why focus is hard, the neuroscience of attention, and a complete system to rebuild your concentration." },
      { href: "/science-of-deep-work", icon: <Atom size={18} />, label: "The Science of Deep Work", blurb: "What happens in your brain during deep work — myelin, neurotransmitters, and the flow state." },
      { href: "/focus-music", icon: <Music size={18} />, label: "Best Music for Studying & Focus", blurb: "What research actually says about focus music, lo-fi, binaural beats, and silence." },
      { href: "/adhd-focus-tips", icon: <Sparkles size={18} />, label: "How to Focus with ADHD", blurb: "15 strategies engineered for ADHD brains — body doubling, the 10-minute rule, and dopamine-friendly systems." },
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
    ],
  },
];

export default function GuidesPage() {
  return (
    <div className="min-h-screen bg-[var(--rgba-255-255-255-0_02)] text-[var(--foreground)]">
      <PageSEO {...PAGE_SEO.guides} />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[var(--rgba-255-255-255-0_06)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,_var(--rgba-124-58-237-0_18),_transparent_70%)]" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--brand-600)]/30 bg-[var(--brand-600)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--brand-400)]">
            <BookOpen size={12} /> Free guide library · Updated 2026
          </div>
          <h1 className="mb-4 text-3xl font-black leading-tight text-[var(--foreground)] sm:text-5xl">
            Every FocusArx guide,
            <br />
            <span className="bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)] bg-clip-text text-transparent">in one place</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-[var(--foreground-muted)] sm:text-lg">
            Science-backed guides on focus, deep work, studying, ADHD, procrastination, and study music. No fluff, no paywall — just practical systems you can start using today.
          </p>
        </div>
      </div>

      {/* Collections */}
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {COLLECTIONS.map((collection) => (
          <section key={collection.title} className="mb-12">
            <h2 className="mb-1 text-2xl font-black text-[var(--foreground)]">{collection.title}</h2>
            <p className="mb-5 text-sm text-[var(--foreground-muted)]">{collection.description}</p>
            <div className="space-y-3">
              {collection.guides.map((g) => (
                <Link
                  key={g.href}
                  href={g.href}
                  className="group block rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-5 transition-all hover:border-[var(--brand-600)]/40 hover:bg-[var(--rgba-124-58-237-0_06)]"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--rgba-255-255-255-0_08)] bg-[var(--rgba-255-255-255-0_04)] text-[var(--brand-400)]">
                      {g.icon}
                    </div>
                    <div>
                      <p className="font-bold text-[var(--foreground)] group-hover:text-[var(--brand-400)]">{g.label}</p>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--palette-6b7280)]">{g.blurb}</p>
                    </div>
                    <ArrowRight size={16} className="ml-auto mt-1 shrink-0 text-[var(--palette-6b7280)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--brand-400)]" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {/* CTA */}
        <div className="rounded-2xl border border-[var(--brand-600)]/30 bg-gradient-to-br from-[var(--brand-600)]/10 to-transparent p-8 text-center">
          <h3 className="mb-2 text-xl font-black text-[var(--foreground)]">Turn what you read into what you do</h3>
          <p className="mb-6 text-sm text-[var(--foreground-muted)]">
            Every guide works better with a timer, streaks, and an AI coach keeping you honest. FocusArx is free forever.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brand-600)] to-[var(--palette-4f46e5)] px-6 py-3 text-sm font-bold text-[var(--palette-white)] transition-all hover:brightness-110"
          >
            Start focusing free <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
