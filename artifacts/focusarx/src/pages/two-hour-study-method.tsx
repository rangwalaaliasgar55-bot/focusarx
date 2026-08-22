import { motion, type Variants } from "framer-motion";
import { useEffect } from "react";
import { Link } from "wouter";
import { Clock, TrendingUp, Target, BarChart3, BookOpen, ArrowRight, Lightbulb } from "lucide-react";
import { PageSEO } from "@/components/PageSEO";
import { track, scrollDepthEffect } from "@/lib/analytics";

// Analytics: track blog page views
// Event: blog_view { article: "two-hour-study-method", source: document.referrer }
// Event: blog_scroll_50 { article: "two-hour-study-method" } — fire at 50% scroll depth
// Event: blog_cta_click { article: "two-hour-study-method", cta: "start-free" }

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.08, ease: EASE },
  }),
};

const MYTHS = [
  { myth: "More hours = better results", truth: "Cognitive performance degrades sharply after 4 focused hours per day. Hours 8–12 produce negligible learning gains." },
  { myth: "Multitasking helps cover more ground", truth: "Task-switching costs 23 minutes of refocus time. Attempting to 'cover more' through multitasking achieves less." },
  { myth: "Studying at night before an exam works", truth: "Sleep consolidates memory. Staying up to cram destroys the consolidation process and tanks exam performance." },
  { myth: "Highlighters and re-reading = studying", truth: "Passive review is one of the least effective learning strategies. Active recall and spaced repetition outperform it by 300%." },
];

const SCHEDULE = [
  { time: "6:30 AM", label: "Wake + No screens (30 min)", desc: "Protect your morning cortisol peak — the brain's natural high-focus window", color: "text-[var(--palette-amber-300)]" },
  { time: "7:00 AM", label: "Deep Block 1 (50 min)", desc: "Hardest subject or problem set. Peak cognitive window. Zero interruptions.", color: "text-[var(--palette-violet-300)]" },
  { time: "7:50 AM", label: "Active Break (10 min)", desc: "Walk, stretch, hydrate. No phone. Let your brain consolidate.", color: "text-[var(--palette-teal-300)]" },
  { time: "8:00 AM", label: "Deep Block 2 (50 min)", desc: "Second subject or continue first. Switch topics to benefit from interleaving.", color: "text-[var(--palette-violet-300)]" },
  { time: "8:50 AM", label: "Session Debrief (10 min)", desc: "Log what you covered, rate your focus, identify what to revisit.", color: "text-[var(--palette-emerald-300)]" },
  { time: "9:00 AM", label: "Rest of morning — lighter tasks", desc: "Review notes, watch lecture videos, admin tasks. Not deep work.", color: "text-[var(--palette-6b7280)]" },
];

export default function TwoHourStudyMethodPage() {
  // Analytics: page view + scroll depth tracking
  useEffect(() => {
    track("blog_view", { article: "two-hour-study-method", source: document.referrer || "direct" });
    return scrollDepthEffect("two-hour-study-method");
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--palette-white)]">
      <PageSEO
        title="The 2-Hour Study Method: Focused Sessions Always Win | FocusArx"
        description="Discover why 2 focused hours beats 12 distracted ones. A practical, science-backed study method for JEE, NEET, UPSC, and college students in India who want real results without burnout."
        canonical="https://focusarx.site/two-hour-study-method"
        keywords="2 hour study method, focused study, pomodoro technique india, study efficiently, jee study schedule, neet preparation tips, upsc study plan, deep work students"
        ogType="article"
      />

      {/* Nav */}
      <nav className="sticky top-0 z-[var(--z-modal)] border-b border-[var(--palette-white)]/5 bg-[var(--background)]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-600)] to-[var(--palette-e879f9)]">
                <svg viewBox="0 0 24 24" fill="var(--palette-white)" className="h-3.5 w-3.5"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <span className="text-sm font-bold">FocusArx</span>
            </div>
          </Link>
          <Link href="/signup">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-xl bg-gradient-to-r from-[var(--brand-600)] to-[var(--palette-e879f9)] px-4 py-1.5 text-xs font-semibold text-[var(--palette-white)]"
            >
              Try FocusArx Free →
            </motion.button>
          </Link>
        </div>
      </nav>

      <article className="mx-auto max-w-4xl px-6 py-16">
        {/* Header */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--palette-teal-500)]/30 bg-[var(--palette-teal-500)]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--palette-teal-300)]">
            <TrendingUp size={11} /> Productivity Method
          </div>
          <h1 className="mb-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            The{" "}
            <span className="bg-gradient-to-r from-[var(--brand-teal)] to-[var(--brand-400)] bg-clip-text text-transparent">
              2-Hour Study Method:
            </span>{" "}
            Focused Sessions Always Win
          </h1>
          <p className="text-[15px] leading-relaxed text-[var(--foreground-muted)]">
            Stop glorifying marathon study sessions. The most successful students — JEE toppers, IAS rankers,
            university gold medalists — share one habit that has nothing to do with how long they study.
            Here's what they actually do, and how you can copy it starting today.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-[var(--foreground-subtle)]">
            <span className="flex items-center gap-1.5"><Clock size={12} /> 8 min read</span>
            <span className="flex items-center gap-1.5"><BarChart3 size={12} /> Research-backed</span>
            <span>Updated July 2026</span>
          </div>
        </motion.div>

        {/* Opening story */}
        <motion.section custom={1} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-10">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-[var(--palette-white)]">
            The Student Who Studied 4 Hours and Topped the Exam
          </h2>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            Consider two students preparing for the same competitive exam. Student A studies 12 hours a day,
            phone nearby, switching between YouTube videos, WhatsApp chats, and textbook pages. Student B
            studies 4 hours a day — two 50-minute deep blocks in the morning, and two in the evening.
            No phone. No notifications. Total focus.
          </p>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            Who scores higher? If you've seen IIT-JEE or NEET toppers' interviews, you already know the
            answer. Student B — almost every time.
          </p>
          <p className="text-[15px] leading-7 text-[var(--foreground-muted)]">
            This isn't an inspirational story. It's cognitive science. The brain has a fixed capacity for
            high-quality focused work per day. Exceeding it doesn't produce more learning — it produces
            more time-logging with less return. The 2-Hour Study Method is about maximising the quality
            of your best cognitive hours, not minimising total study time.
          </p>
        </motion.section>

        {/* Key insight callout */}
        <motion.div
          custom={2}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-10 rounded-2xl border border-[var(--palette-teal-500)]/20 bg-[var(--palette-teal-500)]/5 p-6"
        >
          <div className="flex items-start gap-3">
            <Lightbulb size={20} className="mt-0.5 shrink-0 text-[var(--palette-teal-300)]" />
            <div>
              <p className="mb-2 text-sm font-bold text-[var(--palette-teal-300)]">The Core Principle</p>
              <p className="text-[15px] leading-relaxed text-[var(--foreground-muted)]">
                Quality of attention × hours studied = actual learning. Most students optimise only the
                second variable and ignore the first. The 2-Hour Study Method inverts this: maximise
                attention quality first, then add hours as your capacity builds.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Myths section */}
        <motion.section custom={3} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-10">
          <h2 className="mb-6 text-2xl font-bold tracking-tight text-[var(--palette-white)]">
            4 Study Myths That Are Holding You Back
          </h2>
          <div className="space-y-4">
            {MYTHS.map((item, i) => (
              <motion.div
                key={i}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="rounded-xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-5"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-[var(--palette-red-500)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--palette-red-400)]">MYTH</span>
                  <span className="text-sm font-bold text-[var(--palette-white)]">{item.myth}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="rounded-full bg-[var(--palette-emerald-500)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--palette-emerald-400)] shrink-0">TRUTH</span>
                  <span className="text-[13px] leading-relaxed text-[var(--foreground-muted)]">{item.truth}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* The method */}
        <motion.section custom={4} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-10">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-[var(--palette-white)]">
            The Method: Two Blocks, Maximum Depth
          </h2>
          <p className="mb-6 text-[15px] leading-7 text-[var(--foreground-muted)]">
            The 2-Hour Study Method is simple: two 50-minute focused study blocks, separated by a 10-minute
            active break, done in your peak cognitive window (typically morning for most people). That's it.
            No complexity, no special equipment, no expensive coaching required.
          </p>

          <div className="mb-6 rounded-2xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] overflow-hidden">
            <div className="border-b border-[var(--palette-white)]/5 p-4">
              <p className="text-sm font-bold text-[var(--palette-white)]">Sample Morning Schedule (2-Hour Method)</p>
            </div>
            <div className="divide-y divide-white/5">
              {SCHEDULE.map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-4">
                  <span className={`shrink-0 font-mono text-xs font-bold ${item.color}`}>{item.time}</span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--palette-white)]">{item.label}</p>
                    <p className="mt-0.5 text-xs text-[var(--foreground-subtle)]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[15px] leading-7 text-[var(--foreground-muted)]">
            The rest of your day can include lighter study tasks: watching lecture videos, reviewing
            solved examples, organising notes, or doing practice questions at a comfortable pace.
            But your two deep blocks are protected, non-negotiable, and executed with maximum focus.
          </p>
        </motion.section>

        {/* Why it works scientifically */}
        <motion.section custom={5} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-10">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-[var(--palette-white)]">
            Why This Works: The Neuroscience Explained Simply
          </h2>
          <div className="space-y-6">
            {[
              {
                title: "Ultradian Rhythms",
                text: "Your brain naturally cycles through high and low activity states every 90–120 minutes. The 50-minute block aligns with the peak phase of this cycle, capturing maximum cognitive performance before natural fatigue sets in.",
                icon: "🧠",
              },
              {
                title: "Attention Restoration Theory",
                text: "Directed attention — the kind used for focused study — depletes like a resource. Unfocused rest (walking, nature, light conversation) restores it within 10–15 minutes. This is exactly what the active break accomplishes.",
                icon: "⚡",
              },
              {
                title: "Interleaving Effect",
                text: "Switching between related topics (e.g., Physics Block 1, Chemistry Block 2) increases long-term retention compared to studying the same subject for hours. The slight difficulty of switching forces deeper processing.",
                icon: "🔄",
              },
              {
                title: "Memory Consolidation Window",
                text: "The first hour after a study block is a critical consolidation window. Avoid screen time or heavy new learning. A walk, review in your head, or light conversation allows consolidation to proceed efficiently.",
                icon: "💾",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.03] text-xl">
                  {item.icon}
                </div>
                <div>
                  <h3 className="mb-1.5 text-[15px] font-bold text-[var(--palette-white)]">{item.title}</h3>
                  <p className="text-[13px] leading-relaxed text-[var(--foreground-muted)]">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Measuring success */}
        <motion.section custom={6} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-10">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-[var(--palette-white)]">
            How to Know If It's Working: Measuring Deep Study Quality
          </h2>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            The most common mistake students make after adopting this method is evaluating it by hours alone.
            Instead, measure these four indicators:
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { metric: "Focus Score", desc: "How many minutes of your 50-minute block were genuinely distraction-free? Target: 80%+ of session time", icon: <Target size={16} className="text-[var(--palette-violet-400)]" /> },
              { metric: "Retention Rate", desc: "Can you recall the key concepts 24 hours later without reviewing? Test yourself daily.", icon: <BookOpen size={16} className="text-[var(--palette-pink-400)]" /> },
              { metric: "Problem-Solving Speed", desc: "Are you solving the same type of problem faster week-over-week? Track average time per problem.", icon: <BarChart3 size={16} className="text-[var(--palette-teal-400)]" /> },
              { metric: "Streak Consistency", desc: "Did you complete both deep blocks today? Yesterday? This week? Consistency outranks intensity.", icon: <TrendingUp size={16} className="text-[var(--palette-amber-400)]" /> },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-5">
                <div className="mb-2 flex items-center gap-2">
                  {item.icon}
                  <p className="text-sm font-bold text-[var(--palette-white)]">{item.metric}</p>
                </div>
                <p className="text-[13px] leading-relaxed text-[var(--palette-6b7280)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Scaling up */}
        <motion.section custom={7} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-12">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-[var(--palette-white)]">
            Scaling Up: From 2 Hours to 4 Hours (When You're Ready)
          </h2>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            The 2-Hour Study Method is not a limit — it's a foundation. Once you consistently achieve
            80%+ focus scores across both morning blocks for 3 continuous weeks, you're ready to add
            an evening pair of blocks.
          </p>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            This gives you 4 deep work hours per day — which is near the physiological maximum for
            sustained high-quality cognitive work. Many JEE and NEET toppers operate in this range:
            4 genuine deep hours plus lighter review time, rather than 10–12 hours of mixed intensity.
          </p>
          <p className="text-[15px] leading-7 text-[var(--foreground-muted)]">
            The key insight: don't add hours until you've mastered the quality of the first two.
            Building capacity too fast collapses focus quality and defeats the purpose. Patience with
            the process accelerates the outcome.
          </p>
        </motion.section>

        {/* CTA */}
        <motion.div
          custom={8}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="rounded-2xl border border-[var(--palette-teal-500)]/20 bg-gradient-to-br from-[var(--palette-teal-500)]/10 to-[var(--palette-violet-500)]/5 p-8 text-center"
        >
          <div className="mb-2 text-2xl">🎯</div>
          <h3 className="mb-3 text-xl font-bold text-[var(--palette-white)]">
            Start your first 2-hour session today
          </h3>
          <p className="mb-6 text-sm leading-relaxed text-[var(--foreground-muted)]">
            FocusArx tracks your session quality, calculates your real Focus Score, builds streaks,
            and gives you AI coaching — so the 2-Hour Study Method becomes automatic, not effortful.
          </p>
          <Link href="/signup">
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: "0 0 30px 8px var(--rgba-6-214-160-0_25)" }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--brand-teal)] to-[var(--brand-600)] px-8 py-3.5 text-[15px] font-bold text-[var(--palette-white)] shadow-lg"
            >
              Start Free — No Credit Card <ArrowRight size={16} />
            </motion.button>
          </Link>
          <p className="mt-3 text-xs text-[var(--foreground-subtle)]">Free forever · No credit card required</p>
        </motion.div>

        {/* Related */}
        <motion.div
          custom={9}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mt-12 border-t border-[var(--palette-white)]/5 pt-10"
        >
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--foreground-subtle)]">Related Articles</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { href: "/deep-study-guide", title: "2 Hours vs 12 Hours", desc: "Why depth beats duration" },
              { href: "/focus-guide", title: "5 Laws of Deep Focus", desc: "The principles behind deep work" },
              { href: "/study-techniques", title: "Top Study Techniques", desc: "Active recall, spaced repetition, and more" },
            ].map((article, i) => (
              <Link key={i} href={article.href}>
                <div className="cursor-pointer rounded-xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-4 transition-colors hover:border-[var(--palette-teal-500)]/20 hover:bg-[var(--palette-teal-500)]/5">
                  <p className="mb-1 text-sm font-semibold text-[var(--palette-white)]">{article.title}</p>
                  <p className="text-xs text-[var(--foreground-subtle)]">{article.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      </article>
    </div>
  );
}
