import { motion, type Variants } from "framer-motion";
import { useEffect } from "react";
import { Link } from "wouter";
import { Clock, Brain, Target, Zap, BookOpen, CheckCircle, ArrowRight } from "lucide-react";
import { PageSEO } from "@/components/PageSEO";
import { track, scrollDepthEffect } from "@/lib/analytics";

// Analytics: track blog page views and scroll depth
// Event: blog_view { article: "deep-study-guide", source: document.referrer }
// Event: blog_scroll_50 { article: "deep-study-guide" } — fire when 50% scroll depth
// Event: blog_cta_click { article: "deep-study-guide", cta: "start-free" }

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.08, ease: EASE },
  }),
};

export default function DeepStudyGuidePage() {
  // Analytics: page view + scroll depth tracking
  useEffect(() => {
    track("blog_view", { article: "deep-study-guide", source: document.referrer || "direct" });
    return scrollDepthEffect("deep-study-guide");
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--palette-white)]">
      <PageSEO
        title="How to Study 2 Hours Deeply Instead of 12 Hours Distracted | FocusArx"
        description="India's most practical guide to deep work for students. Learn the science behind focused study sessions, eliminate distractions, and achieve more in 2 hours than most students do in an entire day."
        canonical="https://focusarx.site/deep-study-guide"
        keywords="deep study, focused study sessions, how to study effectively, study tips india, jee preparation, neet study tips, upsc focus, deep work students"
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
              className="rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] px-4 py-1.5 text-xs font-semibold text-[var(--palette-white)]"
              // Analytics: blog_cta_click
            >
              Try FocusArx Free →
            </motion.button>
          </Link>
        </div>
      </nav>

      <article className="mx-auto max-w-4xl px-6 py-16">
        {/* Header */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mb-12"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--palette-purple-500)]/30 bg-[var(--palette-purple-500)]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--palette-purple-300)]">
            <BookOpen size={11} /> Study Science
          </div>
          <h1 className="mb-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            How to Study{" "}
            <span className="text-[var(--brand-strong)]">
              2 Hours Deeply
            </span>{" "}
            Instead of 12 Hours Distracted
          </h1>
          <p className="text-[15px] leading-relaxed text-[var(--foreground-muted)]">
            Most Indian students spend 10–12 hours "studying" every day — and still feel they haven't done enough.
            The real problem isn't time. It's attention. This guide shows you how 2 focused hours can outperform
            a full day of scattered effort.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-[var(--foreground-subtle)]">
            <span className="flex items-center gap-1.5"><Clock size={12} /> 9 min read</span>
            <span className="flex items-center gap-1.5"><Brain size={12} /> Evidence-based</span>
            <span>Updated July 2026</span>
          </div>
        </motion.div>

        {/* Quick-answer box */}
        <motion.div
          custom={1}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-12 rounded-2xl border border-[var(--palette-purple-500)]/20 bg-[var(--palette-purple-500)]/5 p-6"
        >
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--palette-purple-300)]">The Core Insight</p>
          <p className="text-[15px] leading-relaxed text-[var(--foreground-muted)]">
            Deep work — fully focused, cognitively demanding work with zero distraction — is 4–5× more productive
            per hour than shallow, interrupted study. Two hours of deep work produces better results than eight hours
            of distracted studying. The math doesn't lie.
          </p>
        </motion.div>

        {/* Section 1 */}
        <motion.section custom={2} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-10">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-[var(--palette-white)]">
            Why 12 Hours of Studying Fails
          </h2>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            Walk into any coaching institute in Kota, Hyderabad, or Delhi and you'll see the same scene: students
            hunched over textbooks for 10, 12, sometimes 14 hours a day. Their phones are nearby. Notifications
            pop up. WhatsApp groups buzz with "important" study material. YouTube auto-plays the next video after
            every "quick break."
          </p>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            The result? Mental fatigue by 2pm, declining retention, and a growing anxiety that "I'm not doing
            enough" — even while doing too much of the wrong kind of work.
          </p>
          <p className="text-[15px] leading-7 text-[var(--foreground-muted)]">
            Neuroscience is clear: the human brain cannot sustain deep cognitive focus for more than 4 hours in
            a day, broken into sessions. After that, you're going through the motions. Time logged is not the
            same as learning achieved.
          </p>
        </motion.section>

        {/* Stats callout */}
        <motion.div
          custom={3}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {[
            { value: "4×", label: "more learning per hour in deep focus vs. distracted study", color: "from-[var(--palette-violet-500)] to-[var(--palette-purple-600)]" },
            { value: "23 min", label: "average time to regain focus after a single phone notification", color: "from-[var(--palette-pink-500)] to-[var(--palette-rose-600)]" },
            { value: "↑ 40%", label: "better retention with spaced, focused sessions vs. marathon cramming", color: "from-[var(--palette-teal-500)] to-[var(--palette-emerald-600)]" },
          ].map((stat, i) => (
            <div key={i} className="rounded-2xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.03] p-5 text-center">
              <div className={`mb-2 text-3xl font-semibold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</div>
              <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Section 2 */}
        <motion.section custom={4} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-10">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-[var(--palette-white)]">
            The Science Behind Deep Study
          </h2>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            Dr. Cal Newport, in his landmark book <em className="text-[var(--palette-white)]">Deep Work</em>, defines the concept simply:
            "Professional activities performed in a state of distraction-free concentration that push your cognitive
            capabilities to their limit. These efforts create new value, improve your skill, and are hard to replicate."
          </p>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            For students preparing for JEE, NEET, UPSC, or any competitive exam, this is the most important skill
            you can develop — more important than the notes you take or the coaching institute you attend.
          </p>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            Here's what happens in your brain during genuine deep study:
          </p>
          <ul className="mb-4 space-y-3">
            {[
              "Working memory consolidates — new concepts get linked to existing knowledge networks",
              "Myelin wraps neural pathways, making skills and recall permanently faster",
              "The prefrontal cortex strengthens attention circuits with each focused session",
              "Dopamine releases on task completion, reinforcing the habit of focused work",
            ].map((point, i) => (
              <li key={i} className="flex items-start gap-3 text-[14px] text-[var(--foreground-muted)]">
                <CheckCircle size={16} className="mt-0.5 shrink-0 text-[var(--palette-emerald-400)]" />
                {point}
              </li>
            ))}
          </ul>
          <p className="text-[15px] leading-7 text-[var(--foreground-muted)]">
            None of this happens during distracted study. Switching between tasks, checking notifications,
            or studying while half-watching videos prevents the deep encoding that produces lasting learning.
          </p>
        </motion.section>

        {/* Section 3 — The 2-Hour Method */}
        <motion.section custom={5} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-10">
          <h2 className="mb-6 text-2xl font-bold tracking-tight text-[var(--palette-white)]">
            The 2-Hour Deep Study Framework
          </h2>
          <p className="mb-6 text-[15px] leading-7 text-[var(--foreground-muted)]">
            This is not a new technique invented by an influencer. It's a synthesis of research from cognitive
            neuroscience, deliberate practice theory, and ultradian rhythm biology. Here's how to structure
            your most productive study blocks:
          </p>

          {[
            {
              time: "5 min",
              phase: "Phase 1: Pre-Session Ritual",
              icon: <Target size={18} />,
              color: "border-[var(--palette-violet-500)]/30 bg-[var(--palette-violet-500)]/5",
              accent: "text-[var(--palette-violet-300)]",
              steps: [
                "Write down exactly ONE thing you will accomplish in this session",
                "Phone on airplane mode, placed in a different room or in a bag",
                "One glass of water, nothing else on your desk",
                "Tell yourself: 'For the next 50 minutes, this is the only thing that exists'",
              ],
            },
            {
              time: "50 min",
              phase: "Phase 2: The Deep Block",
              icon: <Brain size={18} />,
              color: "border-[var(--palette-pink-500)]/30 bg-[var(--palette-pink-500)]/5",
              accent: "text-[var(--palette-pink-300)]",
              steps: [
                "Work on ONE task only — no task-switching, no 'quick' message checks",
                "When your mind wanders (it will), gently redirect attention back — this is the exercise",
                "If a thought interrupts, write it in a 'parking lot' notepad and return immediately",
                "Track every minute of real focus — dishonesty with yourself is the main failure mode",
              ],
            },
            {
              time: "10 min",
              phase: "Phase 3: Active Rest",
              icon: <Zap size={18} />,
              color: "border-[var(--palette-teal-500)]/30 bg-[var(--palette-teal-500)]/5",
              accent: "text-[var(--palette-teal-300)]",
              steps: [
                "Walk around — physical movement increases BDNF (brain growth protein)",
                "No screens, no social media — this is active rest, not passive entertainment",
                "Review what you just learned in your head — spaced recall begins here",
                "Hydrate and eat light if needed. Your brain runs on glucose",
              ],
            },
            {
              time: "50 min",
              phase: "Phase 4: The Second Deep Block",
              icon: <Brain size={18} />,
              color: "border-[var(--palette-pink-500)]/30 bg-[var(--palette-pink-500)]/5",
              accent: "text-[var(--palette-pink-300)]",
              steps: [
                "Tackle a different aspect of the same subject, or a related second subject",
                "Apply interleaving: mixing related topics increases long-term retention",
                "Stay with difficulty — the frustrated feeling of 'I don't get this yet' is learning",
                "Use active recall (close the book, write what you remember) over passive re-reading",
              ],
            },
            {
              time: "5 min",
              phase: "Phase 5: Session Debrief",
              icon: <CheckCircle size={18} />,
              color: "border-[var(--palette-amber-500)]/30 bg-[var(--palette-amber-500)]/5",
              accent: "text-[var(--palette-amber-300)]",
              steps: [
                "Write what you learned, any gaps you identified, what to revisit tomorrow",
                "Log your session: topics covered, honest focus rating (1–10), distractions noted",
                "Celebrate the completion. This programs your reward system to want more sessions",
                "Schedule your next session — decision fatigue is eliminated when it's pre-planned",
              ],
            },
          ].map((phase, i) => (
            <motion.div
              key={i}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className={`mb-4 rounded-2xl border p-6 ${phase.color}`}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--palette-white)]/5 ${phase.accent}`}>
                  {phase.icon}
                </div>
                <div>
                  <p className={`text-[11px] font-bold uppercase tracking-wider ${phase.accent}`}>{phase.time}</p>
                  <h3 className="text-[15px] font-bold text-[var(--palette-white)]">{phase.phase}</h3>
                </div>
              </div>
              <ul className="space-y-2.5">
                {phase.steps.map((step, j) => (
                  <li key={j} className="flex items-start gap-3 text-[13px] leading-relaxed text-[var(--foreground-muted)]">
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current ${phase.accent}`} />
                    {step}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.section>

        {/* Section 4 — JEE/NEET/UPSC application */}
        <motion.section custom={6} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-10">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-[var(--palette-white)]">
            Applying This for JEE, NEET, UPSC, and College Exams
          </h2>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            India's competitive exam preparation culture often romanticises long hours. Toppers don't share how
            many hours they studied — they share how well they studied. Understand this distinction, and your
            entire preparation strategy changes.
          </p>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            For JEE and NEET, where problem-solving speed and conceptual clarity matter most, two daily blocks
            of deep work (morning + evening) with proper rest between them outperform 12 hours of mixed activity.
            Solve problems during deep blocks. Review theory during lighter periods.
          </p>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            For UPSC, where the breadth of syllabus is enormous, deep study means: one topic per session,
            active note-making (not copying), and mandatory retrieval practice at the end of each block.
            Reading with full attention beats reading twice at half attention.
          </p>
          <p className="text-[15px] leading-7 text-[var(--foreground-muted)]">
            For college students balancing multiple subjects: use subject-specific deep blocks. Monday morning
            is Physics. Monday evening is Chemistry. Mixing subjects within the same block reduces the cognitive
            depth you can achieve in either.
          </p>
        </motion.section>

        {/* Section 5 — The distraction trap */}
        <motion.section custom={7} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-10">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-[var(--palette-white)]">
            The Distraction Trap: Why Your Environment Is Winning
          </h2>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            Instagram, YouTube, and WhatsApp are engineered by teams of thousands of engineers and psychologists
            to capture and hold your attention. They have infinite resources optimising for your engagement.
            Willpower alone cannot win this fight.
          </p>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            The solution is environmental design, not willpower. Make deep study the path of least resistance
            and distraction the difficult option. Practically, this means:
          </p>
          <ul className="mb-4 space-y-3">
            {[
              "Delete social apps from your phone during preparation periods (not just mute — delete)",
              "Use a dedicated study location with no entertainment associations (library, not bedroom)",
              "Tell family members about your focus hours — social accountability works better than willpower",
              "Use tools like FocusArx that lock your browser, track attention, and alert you when you drift",
              "Schedule your 'allowed' entertainment time — giving your brain something to look forward to reduces urges during sessions",
            ].map((point, i) => (
              <li key={i} className="flex items-start gap-3 text-[14px] text-[var(--foreground-muted)]">
                <ArrowRight size={14} className="mt-1 shrink-0 text-[var(--palette-violet-400)]" />
                {point}
              </li>
            ))}
          </ul>
        </motion.section>

        {/* Section 6 — Building the habit */}
        <motion.section custom={8} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-12">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-[var(--palette-white)]">
            Building the Deep Study Habit (The First 21 Days)
          </h2>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            You won't achieve deep focus on Day 1. Attention is a muscle, and most students have trained their
            attention for distraction. Rebuilding it takes deliberate practice over 2–3 weeks.
          </p>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            Start with one 25-minute Pomodoro session per day. Make it non-negotiable regardless of how short it
            feels. The habit of sitting down and starting is more important than session length in week one.
            Add a second session in week two. Add the full 2-hour framework in week three.
          </p>
          <p className="mb-4 text-[15px] leading-7 text-[var(--foreground-muted)]">
            Track every session. The progress data is motivating in itself — seeing 18 consecutive days of focus
            creates powerful psychological momentum. This is why apps like FocusArx combine Pomodoro timers
            with streak tracking, XP, and analytics: the feedback loop reinforces the behaviour you want to build.
          </p>
          <p className="text-[15px] leading-7 text-[var(--foreground-muted)]">
            Remember: the goal is not 2 hours of studying. The goal is 2 hours of the highest-quality cognitive
            work you can produce today. That goal compounds. A student who does this for 300 days covers more
            ground, retains more, and develops better problem-solving skills than one who "studies" 12 hours a
            day for the same period.
          </p>
        </motion.section>

        {/* CTA */}
        <motion.div
          custom={9}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="rounded-2xl border border-[var(--palette-purple-500)]/20 bg-gradient-to-br from-[var(--palette-purple-500)]/10 to-[var(--palette-pink-500)]/5 p-8 text-center"
        >
          <div className="mb-2 text-2xl">⚡</div>
          <h3 className="mb-3 text-xl font-bold text-[var(--palette-white)]">
            Ready to build your first deep work habit?
          </h3>
          <p className="mb-6 text-sm leading-relaxed text-[var(--foreground-muted)]">
            FocusArx combines Pomodoro timers, attention tracking, AI coaching, and streak gamification
            to make 2-hour deep work sessions your daily default — not a rare achievement.
          </p>
          <Link href="/signup">
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: "0 0 30px 8px var(--rgba-124-58-237-0_4)" }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--brand-600)] px-6 text-sm font-semibold text-[var(--neutral-0)] shadow-[var(--shadow-violet-sm)] transition-[background-color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[var(--brand-700)] hover:shadow-[var(--shadow-violet-md)] active:scale-[0.98]"
              // Analytics: blog_cta_click { article: "deep-study-guide", cta: "start-free" }
            >
              Start Your First Session Free <ArrowRight size={16} />
            </motion.button>
          </Link>
          <p className="mt-3 text-xs text-[var(--foreground-subtle)]">No credit card · Completely free · Takes 30 seconds</p>
        </motion.div>

        {/* Related articles */}
        <motion.div
          custom={10}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mt-12 border-t border-[var(--palette-white)]/5 pt-10"
        >
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--foreground-subtle)]">Related Articles</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { href: "/two-hour-study-method", title: "The 2-Hour Study Method", desc: "Focused sessions always win" },
              { href: "/pomodoro-guide", title: "Complete Pomodoro Guide", desc: "The science of 25-minute blocks" },
              { href: "/study-techniques", title: "Top Study Techniques", desc: "Evidence-based methods for retention" },
            ].map((article, i) => (
              <Link key={i} href={article.href}>
                <div className="cursor-pointer rounded-xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-4 transition-colors hover:border-[var(--palette-purple-500)]/20 hover:bg-[var(--palette-purple-500)]/5">
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
