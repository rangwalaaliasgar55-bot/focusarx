import { Link } from "wouter";
import { ArrowRight, Brain, Clock, Target, Zap, CheckCircle, TrendingUp, Users, ListChecks, Moon, Dumbbell, ShieldCheck } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

function Section({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`max-w-3xl mx-auto px-4 sm:px-6 ${className}`}>
      {children}
    </section>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--foreground)] mt-14 mb-4 leading-tight">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xl font-bold text-[var(--foreground)] mt-8 mb-3">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-relaxed text-[var(--foreground-muted)] mb-4">{children}</p>;
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-5">
      <p className="font-semibold text-[var(--foreground)] mb-2">{q}</p>
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">{a}</p>
    </div>
  );
}

const FAQS = [
  {
    q: "How long should a focus session be?",
    a: "Research suggests 25–52 minutes is optimal for most people, followed by a 5–17 minute break. FocusArx defaults to 25-minute Pomodoro sessions, but you can customize them from 10 to 120 minutes based on your attention span and task type.",
  },
  {
    q: "What is the Pomodoro Technique?",
    a: "The Pomodoro Technique, developed by Francesco Cirillo, breaks work into 25-minute focused intervals (pomodoros) separated by short breaks. After 4 pomodoros you take a longer 15–30 minute break. This rhythm prevents mental fatigue and builds sustainable focus habits.",
  },
  {
    q: "Does FocusArx work without internet?",
    a: "The core timer and task tracking work with a local fallback. AI coaching and social features require internet, but your sessions are saved locally first and synced when you reconnect.",
  },
  {
    q: "How does the attention tracking work?",
    a: "FocusArx uses your webcam via MediaPipe to detect gaze direction and posture. The camera never streams or stores footage — all processing happens locally in your browser. You earn bonus XP for maintaining focus during a session.",
  },
  {
    q: "Can I use FocusArx with friends?",
    a: "Yes! Add friends, join live Study Rooms, compete on leaderboards, and cheer each other on via the Social Hub. Accountability is one of the strongest predictors of study consistency.",
  },
  {
    q: "What are Focus Coins and XP?",
    a: "XP (Experience Points) measure your cumulative learning effort and unlock new levels. Focus Coins are earned during sessions and can be spent in the Coin Shop on themes, boosts, title cosmetics, and Premium access.",
  },
  {
    q: "How do I build a lasting focus habit?",
    a: "Start small — one 25-minute session a day is enough to begin. Anchor it to an existing routine (after your morning coffee, for example), track your streak, and let the daily missions keep you consistent. Habits compound: a single daily session becomes over 150 hours of deep work a year.",
  },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Focus: The Complete Science-Based Guide to Deep Work",
  "description": "A comprehensive, research-backed guide to improving focus and entering deep work — covering the science of attention, proven methods like Pomodoro and Deep Work, and a practical system you can start today.",
  "author": { "@type": "Organization", "name": "FocusArx" },
  "publisher": { "@type": "Organization", "name": "FocusArx", "logo": { "@type": "ImageObject", "url": "https://focusarx.site/logo.png" } },
  "dateModified": "2026-08-16",
  "mainEntityOfPage": "https://focusarx.site/focus-guide",
};

export default function FocusGuidePage() {
  return (
    <div className="min-h-screen bg-[var(--muted)] text-[var(--foreground)]">
      <PageSEO {...PAGE_SEO.focusGuide} structuredData={articleSchema} />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[var(--border-subtle)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,_var(--rgba-124-58-237-0_18),_transparent_70%)]" />
        <Section className="relative py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-600)]/30 bg-[var(--brand-600)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--brand-400)] mb-6">
            <Brain size={12} /> Free Guide · Updated 2026
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold text-[var(--foreground)] mb-4 leading-tight">
            How to Focus: The Complete<br />
            <span className="text-[var(--brand-strong)]">Science-Based Guide</span>
          </h1>
          <p className="max-w-2xl mx-auto text-[var(--foreground-muted)] text-base sm:text-lg">
            Attention is the most valuable resource you own — and the one most under attack. This guide explains why focus is hard, the science behind it, and a practical system to master deep work.
          </p>
        </Section>
      </div>

      {/* Table of contents */}
      <Section className="py-8">
        <nav aria-label="Table of contents" className="rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-124-58-237-0_04)] p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-400)] mb-3 flex items-center gap-2"><ListChecks size={14} /> In this guide</p>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-[var(--foreground-muted)]">
            {[
              ["#why-focus-is-hard", "1. Why focus is so hard"],
              ["#science-of-focus", "2. The science of attention"],
              ["#proven-methods", "3. Proven focus methods"],
              ["#focus-system", "4. Building your focus system"],
              ["#focus-mistakes", "5. Seven focus mistakes"],
              ["#who-for", "6. Strategies for your goal"],
              ["#sample-day", "7. A sample deep-work day"],
              ["#measure", "8. Measuring real progress"],
              ["#focusarx", "9. How FocusArx helps"],
              ["#faq", "10. FAQ"],
            ].map(([href, label]) => (
              <li key={href}><a href={href} className="hover:text-[var(--brand-400)] transition-colors">{label}</a></li>
            ))}
          </ol>
        </nav>
      </Section>

      {/* 1. Why focus is hard */}
      <Section id="why-focus-is-hard">
        <H2>Why focus is so hard in the modern world</H2>
        <P>
          If you feel like you can't concentrate the way you used to, it's not a personal failing — it's a predictable consequence of how modern technology is engineered. The average knowledge worker now checks email and messaging apps constantly, and every notification is a small dopamine hit designed to pull you back. The result is what psychologist Dr. Sophie Leroy calls <strong className="text-[var(--foreground)]">attention residue</strong>: when you switch from one task to another, part of your attention stays stuck on the previous task, degrading your performance on the next one.
        </P>
        <P>
          Every time you glance at your phone during a work block, you don't just lose the seconds you spent looking — you lose the minutes it takes your brain to fully re-engage. Research on task-switching shows that even brief interruptions can measurably increase error rates and slow you down. This is why "I'll just check this one thing" is the single most expensive sentence in productivity.
        </P>
        <P>
          The good news: focus is a trainable skill, not a fixed trait. The same neuroplasticity that makes your brain adaptable to distraction also lets you rebuild your attention span. It takes a system, not just willpower.
        </P>
      </Section>

      {/* 2. Science of focus */}
      <Section id="science-of-focus">
        <H2>The science of attention</H2>
        <H3>Your brain's two attention systems</H3>
        <P>
          Cognitive scientists describe attention as having two complementary modes. The <strong className="text-[var(--foreground)]">top-down (goal-directed) system</strong> is what you use when you deliberately decide to read, write, or solve a problem. The <strong className="text-[var(--foreground)]">bottom-up (stimulus-driven) system</strong> is what yanks your eyes toward a notification, a moving object, or a loud noise. Deep work is simply the state where your top-down system stays in control for an extended period.
        </P>
        <P>
          Distraction isn't the enemy of focus — <em>the switch between systems</em> is. Each time your bottom-up system interrupts, your brain pays a "re-focus tax." The goal of every focus technique is the same: reduce the number of times that switch happens.
        </P>
        <H3>Ultradian rhythms and energy cycles</H3>
        <P>
          Your alertness naturally rises and falls in roughly 90-minute cycles called <strong className="text-[var(--foreground)]">ultradian rhythms</strong>. Trying to grind through eight straight hours of "productivity" fights your biology. The most effective deep workers ride these waves — working hard during the peak of a cycle and recovering during the trough — rather than maintaining a flat, exhausted pace all day.
        </P>
        <H3>The role of dopamine</H3>
        <P>
          Dopamine isn't the "pleasure chemical" — it's the "wanting" chemical that drives anticipation and motivation. Cheap, instant dopamine (endless scrolling, notifications, junk food) raises your baseline to the point where slower, more effortful rewards (finishing a hard chapter, solving a problem) feel unrewarding by comparison. A focus system works partly by <em>protecting your dopamine baseline</em> — keeping low-effort, high-stimulation inputs out of your environment so that real work feels rewarding again.
        </P>
      </Section>

      {/* 3. Proven methods */}
      <Section id="proven-methods">
        <H2>Proven focus methods</H2>

        <H3>The Pomodoro Technique</H3>
        <P>
          Developed by Francesco Cirillo in the late 1980s, Pomodoro breaks work into 25-minute sprints ("pomodoros") separated by 5-minute breaks, with a longer 15–30 minute break after every four. Its power is psychological: a 25-minute commitment feels achievable, which lowers the activation energy to start. For deep, creative work, many people extend the work interval to 45–52 minutes. See our full <Link href="/pomodoro-guide" className="text-[var(--brand-400)] hover:underline">Pomodoro guide</Link>.
        </P>

        <H3>Deep Work (Cal Newport)</H3>
        <P>
          Author Cal Newport defines <em>deep work</em> as "professional activities performed in a state of distraction-free concentration that push your cognitive capabilities to their limit." His core argument: in an economy that rewards rare, valuable skills, the ability to focus intensely is a superpower that's becoming rarer precisely because it's hard. Newport recommends scheduling dedicated deep-work blocks, embracing boredom (resisting the urge to fill every idle moment with stimulation), and quitting shallow work. Read our <Link href="/science-of-deep-work" className="text-[var(--brand-400)] hover:underline">science of deep work</Link> explainer.
        </P>

        <H3>Time blocking</H3>
        <P>
          Instead of a to-do list, plan your day on a calendar. Assign each task a specific, bounded time slot. This removes the "what should I do next?" decision (a hidden source of procrastination) and creates a realistic picture of what actually fits in a day. Pair time blocking with a buffer between blocks to absorb overruns.
        </P>

        <H3>Flow state</H3>
        <P>
          Psychologist Mihaly Csikszentmihalyi described <em>flow</em> as the state of complete absorption where time seems to disappear. Flow emerges when a task's challenge is just slightly above your current skill level — too easy and you're bored, too hard and you're anxious. You can engineer flow by matching difficulty to ability, removing interruptions, and setting a clear goal with immediate feedback.
        </P>

        <H3>The 2-hour study method</H3>
        <P>
          For exam prep and deep learning, a structured two-hour block (warm-up → intense focused study → retrieval practice → review) outperforms scattered, unfocused hours. We break it down in our <Link href="/two-hour-study-method" className="text-[var(--brand-400)] hover:underline">2-hour study method</Link> guide.
        </P>

        <H3>Spaced repetition & the Feynman technique</H3>
        <P>
          Focus isn't just about staying seated — it's about how you encode information. <strong className="text-[var(--foreground)]">Spaced repetition</strong> (reviewing material at increasing intervals) exploits the forgetting curve, while the <strong className="text-[var(--foreground)]">Feynman technique</strong> (explain a concept in plain language, find the gaps, fill them) turns passive reading into active understanding. Learn more in our <Link href="/feynman-technique" className="text-[var(--brand-400)] hover:underline">Feynman technique</Link> and <Link href="/study-techniques" className="text-[var(--brand-400)] hover:underline">study techniques</Link> guides.
        </P>
      </Section>

      {/* 4. Focus system */}
      <Section id="focus-system">
        <H2>Building your focus system</H2>
        <P>Techniques only work inside a system. Here's the foundation that makes everything else stick.</P>

        <H3><span className="flex items-center gap-2"><Moon size={18} className="text-[var(--brand-400)]" /> 1. Protect your sleep</span></H3>
        <P>
          Sleep is the bedrock of attention. Sleep deprivation measurably impairs working memory, reaction time, and the prefrontal cortex — the exact regions responsible for sustained focus. One night of poor sleep degrades next-day concentration; chronic poor sleep compounds it. Aim for consistent sleep and wake times, not just "enough hours."
        </P>

        <H3><span className="flex items-center gap-2"><Dumbbell size={18} className="text-[var(--brand-400)]" /> 2. Move your body</span></H3>
        <P>
          Aerobic exercise increases blood flow to the brain and stimulates the release of BDNF (brain-derived neurotrophic factor), a protein that supports learning and neuroplasticity. Even a 20-minute walk improves focus for hours afterward. Think of exercise as a cognitive performance enhancer, not just a health chore.
        </P>

        <H3><span className="flex items-center gap-2"><ShieldCheck size={18} className="text-[var(--brand-400)]" /> 3. Design a distraction-proof environment</span></H3>
        <P>
          Your environment is a bigger factor than your willpower. Put your phone in another room (research shows its mere presence — even face-down and silenced — reduces available working memory). Close unrelated browser tabs. Use noise-canceling headphones or ambient sound. The goal is to make focus the path of least resistance, not an act of daily heroism.
        </P>

        <H3><span className="flex items-center gap-2"><Clock size={18} className="text-[var(--brand-400)]" /> 4. Anchor to a routine</span></H3>
        <P>
          Habits form when a behavior is triggered by a consistent cue. Anchor your first session to something you already do every day — "after my first coffee" or "right after lunch." Once the cue fires, start a session immediately; don't negotiate. Over weeks, the friction of starting drops toward zero.
        </P>

        <H3><span className="flex items-center gap-2"><Zap size={18} className="text-[var(--brand-400)]" /> 5. Start embarrassingly small</span></H3>
        <P>
          The biggest mistake is trying to go from zero to four-hour deep-work days. Start with a single 25-minute session daily. Consistency matters more than duration — a 25-minute daily habit is worth far more than a heroic once-a-week marathon, because it builds the identity of "someone who focuses."
        </P>
      </Section>

      {/* Common mistakes */}
      <Section id="focus-mistakes">
        <H2>Seven focus mistakes that silently kill your productivity</H2>
        <P>
          Most people don't fail at focus because they lack discipline — they fail because they make predictable, fixable mistakes. Here are the most common ones and how to correct them.
        </P>
        <H3>1. Multitasking</H3>
        <P>
          True multitasking is a myth for anything that requires thought. What we call "multitasking" is actually rapid task-switching, and each switch incurs the attention-residue tax. Studies consistently show that juggling tasks reduces both speed and accuracy. The fix: single-task. One tab, one task, one session.
        </P>
        <H3>2. Starting with easy, low-value work</H3>
        <P>
          Many people begin the day with email and small administrative tasks because they're easy wins — but this spends your peak cognitive energy on shallow work. The fix: do your single most important, cognitively demanding task during your first deep-work block, when your willpower and focus are freshest. This is the essence of "eating the frog."
        </P>
        <H3>3. Working without a clear finish line</H3>
        <P>
          An open-ended task ("work on the report") invites procrastination because there's no clear definition of done. A specific, time-boxed goal ("draft the introduction in this 45-minute block") gives your brain a target. The fix: define a concrete output for every session before you start.
        </P>
        <H3>4. Skipping breaks</H3>
        <P>
          Working through fatigue feels productive but backfires. Your focus is a resource that depletes and must be recharged. Skipping breaks leads to diminishing returns and burnout. The fix: treat breaks as part of the work — schedule them, stand up, move, and look at something 20 feet away to rest your eyes.
        </P>
        <H3>5. Optimizing the plan instead of executing</H3>
        <P>
          "Productivity porn" — endlessly researching the perfect app, notebook, or system — is a sophisticated form of procrastination that feels like progress. The fix: pick one simple system and run it for 30 days before changing anything. Execution beats optimization.
        </P>
        <H3>6. Measuring hours instead of depth</H3>
        <P>
          Sitting at a desk for eight hours while half-present is not the same as four hours of genuine deep work. The fix: track depth, not just duration. A focus score, streak consistency, and distraction count tell you far more than a clock.
        </P>
        <H3>7. Punishing yourself for off days</H3>
        <P>
          Perfectionism kills habits. One missed day is a blip; two missed days is the start of a new (bad) habit. The fix: adopt a "never miss twice" rule. Miss a session? Fine — but you do the next one no matter what. Self-compassion is a focus strategy, not a weakness.
        </P>
      </Section>

      {/* Who it's for */}
      <Section id="who-for">
        <H2>Focus strategies for different goals</H2>
        <H3>For students</H3>
        <P>
          Students face a unique challenge: large volumes of information that must be both understood and retained. Pair deep-work blocks with <strong className="text-[var(--foreground)]">active recall</strong> (test yourself instead of re-reading) and <strong className="text-[var(--foreground)]">spaced repetition</strong>. A proven structure is the 2-hour study method: warm-up, focused study, retrieval practice, and review — which we detail in our <Link href="/two-hour-study-method" className="text-[var(--brand-400)] hover:underline">2-hour study method</Link> guide. Exam season rewards the student who has built consistent focus weeks earlier, not the one cramming.
        </P>
        <H3>For professionals & developers</H3>
        <P>
          Knowledge workers fight an inbox and a calendar. The single highest-leverage habit is <strong className="text-[var(--foreground)]">batching communication</strong> — check email and messages at set times (e.g. 11:00 and 16:00) instead of continuously. Protect your mornings for deep work, and let your team know when you're in a focus block. For developers, a distraction-free focus session with the phone in another room can mean the difference between shipping in an afternoon and wrestling one bug all week.
        </P>
        <H3>For creatives</H3>
        <P>
          Creative work — writing, design, music — requires getting into flow, which typically takes 15–20 minutes of uninterrupted ramp-up. Protect longer blocks (60–90 minutes) and guard against interruptions that break the spell. Capture ideas quickly when they strike (a note is fine), but return immediately to the work rather than following the thread down a rabbit hole.
        </P>
      </Section>

      {/* Sample day */}
      <Section id="sample-day">
        <H2>A sample deep-work day</H2>
        <P>Here's a realistic template you can adapt. The exact times matter less than the structure: protect your peak hours, batch shallow work, and recharge deliberately.</P>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-6 space-y-3 font-mono text-sm">
          {[
            ["07:30", "Wake, hydrate, move (20-min walk or stretch)"],
            ["08:30", "Deep-work block #1 — your hardest task (90 min)"],
            ["10:00", "Break, then shallow work: email + messages (30 min)"],
            ["11:00", "Deep-work block #2 (60 min)"],
            ["12:00", "Lunch + full mental break"],
            ["13:30", "Deep-work block #3 (60 min)"],
            ["14:30", "Break, then meetings / collaboration"],
            ["16:00", "Shallow work: email + admin batch"],
            ["17:00", "Review day, plan tomorrow's #1 task"],
            ["21:00", "Wind down — no screens in bed"],
          ].map(([t, a]) => (
            <div key={t} className="flex gap-4">
              <span className="text-[var(--brand-400)] font-bold shrink-0 w-14">{t}</span>
              <span className="text-[var(--foreground-muted)]">{a}</span>
            </div>
          ))}
        </div>
        <P>
          Notice what's missing: no morning social media, no endless email checking, and a clearly defined "most important task" every day. This is what a focus-first day looks like in practice.
        </P>
      </Section>

      {/* 5. Measure */}
      <Section id="measure">
        <H2>Measuring real progress</H2>
        <P>
          "Hours worked" is a vanity metric. Two people can sit at a desk for the same time with wildly different output. What matters is <strong className="text-[var(--foreground)]">depth</strong>: how long you stayed genuinely engaged, how few distractions interrupted you, and how consistently you showed up.
        </P>
        <P>
          FocusArx turns this into a measurable <strong className="text-[var(--foreground)]">Focus Score</strong> (0–100) derived from session completion, attention consistency, and distraction events — so you can see whether you're actually getting deeper, not just busier. Track streaks, review your weekly chart, and use your Focus DNA to find the hours when your brain is sharpest. What gets measured gets improved.
        </P>
      </Section>

      {/* 6. How FocusArx helps */}
      <Section id="focusarx">
        <H2>How FocusArx helps you focus</H2>
        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          {[
            { icon: <Target className="text-[var(--palette-purple-400)]" />, t: "Adaptive timer", d: "Pomodoro, deep-work, and flow sessions tuned to your energy." },
            { icon: <Zap className="text-[var(--palette-emerald-400)]" />, t: "AI coach", d: "Context-aware tips and a personalized study roadmap." },
            { icon: <ShieldCheck className="text-[var(--palette-blue-400)]" />, t: "Private attention tracking", d: "On-device MediaPipe vision — no video ever leaves your browser." },
            { icon: <TrendingUp className="text-[var(--palette-amber-400)]" />, t: "Real analytics", d: "Focus Score, streaks, and Focus DNA to measure depth." },
            { icon: <Users className="text-[var(--palette-pink-400)]" />, t: "Study together", d: "Live study rooms and leaderboards for accountability." },
            { icon: <CheckCircle className="text-[var(--palette-cyan-400)]" />, t: "Gamified growth", d: "XP, coins, a pet companion, and a city that grows as you do." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--palette-white)]/5 border border-[var(--palette-white)]/10">{f.icon}</div>
              <p className="font-bold text-[var(--foreground)] mb-1">{f.t}</p>
              <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-[var(--brand-600)]/30 bg-gradient-to-br from-[var(--brand-600)]/10 to-transparent p-8 text-center">
          <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">Start your first deep-work session today</h3>
          <p className="text-sm text-[var(--foreground-muted)] mb-6">Free forever. No credit card. One 25-minute session is all it takes to begin.</p>
          <Link href="/signup" className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--brand-600)] px-6 text-sm font-semibold text-[var(--neutral-0)] shadow-[var(--shadow-violet-sm)] transition-[background-color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[var(--brand-700)] hover:shadow-[var(--shadow-violet-md)] active:scale-[0.98]">
            Begin Launch Sequence <ArrowRight size={16} />
          </Link>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="pb-20">
        <H2>Frequently asked questions</H2>
        <div className="space-y-4">
          {FAQS.map((f) => <FAQ key={f.q} {...f} />)}
        </div>
      </Section>
    </div>
  );
}
