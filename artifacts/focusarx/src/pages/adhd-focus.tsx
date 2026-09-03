import { Link } from "wouter";
import { ArrowRight, Brain, CheckCircle, Sparkles, Timer, Users, Zap, Moon, ListChecks, Monitor, Trophy, Bell, Flag } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

function Section({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) {
  return <section id={id} className={`mx-auto max-w-3xl px-4 sm:px-6 ${className}`}>{children}</section>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-14 mb-4 text-2xl font-semibold leading-tight text-[var(--foreground)] sm:text-3xl">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-8 mb-3 text-xl font-bold text-[var(--foreground)]">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-[15px] leading-relaxed text-[var(--foreground-muted)]">{children}</p>;
}
function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-5">
      <p className="mb-2 font-semibold text-[var(--foreground)]">{q}</p>
      <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">{a}</p>
    </div>
  );
}

const FAQS = [
  {
    q: "Can people with ADHD do deep work?",
    a: "Yes — but usually in shorter blocks and with more external structure. Many people with ADHD hyperfocus intensely on engaging tasks and struggle only with boring or ambiguous ones. The goal isn't to force a neurotypical 90-minute block; it's to find your workable interval (often 10–25 minutes), protect it from distractions, and repeat it with real breaks.",
  },
  {
    q: "What is body doubling and why does it help ADHD?",
    a: "Body doubling is working alongside another person, in person or virtually. Research on ADHD and widespread anecdotal evidence suggest the quiet social pressure of being 'seen' working helps regulate attention and task initiation. FocusArx's live study rooms are built exactly for this.",
  },
  {
    q: "How long should a Pomodoro be with ADHD?",
    a: "Start with 10–15 minutes — short enough that starting feels safe — and extend gradually toward 25. If a session is going well, momentum often carries you past the timer, which is fine. The timer's job is to get you started, not to stop you.",
  },
  {
    q: "Why do I procrastinate so much with ADHD?",
    a: "ADHD procrastination is mostly a dopamine and task-initiation problem, not laziness. Boring tasks don't produce enough neurological 'pull' to overcome the activation energy of starting. Solutions lower the activation energy (tiny first steps, 2-minute rule) or add dopamine (rewards, novelty, urgency, accountability).",
  },
  {
    q: "Is a timer app actually useful for ADHD focus?",
    a: "An external timer transfers the job of tracking time from your brain (which struggles with it) to the environment. Visible countdowns, session streaks, and rewards add the urgency and dopamine that ADHD brains run on. FocusArx combines adaptive timers, gamified rewards, and AI coaching in one free app.",
  },
  {
    q: "What is time blindness and how do I manage it?",
    a: "Time blindness is the difficulty sensing how much time has passed or how long a task will take. Externalize time: visible timers, alarms as bookends, time blocking on a calendar, and shorter commitments. Treat your sense of time as untrustworthy and give it tools instead.",
  },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Focus with ADHD: 15 Science-Backed Strategies That Actually Work",
  "description": "Practical, science-backed focus strategies for ADHD brains — body doubling, the 10-minute rule, dopamine-friendly rewards, external timers, and habit systems that stick.",
  "author": { "@type": "Organization", "name": "FocusArx" },
  "publisher": { "@type": "Organization", "name": "FocusArx", "logo": { "@type": "ImageObject", "url": "https://focusarx.site/logo.png" } },
  "dateModified": "2026-08-24",
  "mainEntityOfPage": "https://focusarx.site/adhd-focus-tips",
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function AdhdFocusPage() {
  return (
    <div className="min-h-screen bg-[var(--muted)] text-[var(--foreground)]">
      <PageSEO {...PAGE_SEO.adhdFocus} structuredData={[articleSchema, faqSchema]} />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[var(--border-subtle)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,_var(--rgba-124-58-237-0_18),_transparent_70%)]" />
        <Section className="relative py-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--brand-600)]/30 bg-[var(--brand-600)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--brand-400)]">
            <Sparkles size={12} /> Free Guide · Updated 2026
          </div>
          <h1 className="mb-4 text-3xl font-semibold leading-tight text-[var(--foreground)] sm:text-5xl">
            How to Focus with ADHD:
            <br />
            <span className="text-[var(--brand-strong)]">15 Strategies That Work</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-[var(--foreground-muted)] sm:text-lg">
            ADHD isn't a willpower problem — it's a dopamine and attention-regulation difference. These strategies work <em>with</em> your brain instead of against it.
          </p>
        </Section>
      </div>

      {/* TOC */}
      <Section className="py-8">
        <nav aria-label="Table of contents" className="rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-124-58-237-0_04)] p-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--brand-400)]"><ListChecks size={14} /> In this guide</p>
          <ol className="grid gap-x-6 gap-y-2 text-sm text-[var(--foreground-muted)] sm:grid-cols-2">
            {[["#why", "1. Why ADHD focus feels different"], ["#strategies", "2. The 15 strategies"], ["#systems", "3. Building a daily system"], ["#tools", "4. Tools that carry the load"], ["#myths", "5. Myths to drop"], ["#faq", "6. FAQ"]].map(([href, label]) => (
              <li key={href}><a href={href} className="transition-colors hover:text-[var(--brand-400)]">{label}</a></li>
            ))}
          </ol>
        </nav>
      </Section>

      {/* 1. Why */}
      <Section id="why">
        <H2>Why ADHD focus feels different</H2>
        <P>
          ADHD affects the brain's executive functions — task initiation, working memory, time perception, and the regulation of attention and motivation. Two things follow from this. First, <strong className="text-[var(--foreground)]">interest, novelty, urgency, and challenge</strong> are what engage the ADHD brain, not importance. A boring-but-critical task can feel neurologically impossible to start, while a fascinating one can absorb you for hours (hyperfocus).
        </P>
        <P>
          Second, the ADHD brain typically runs low on <strong className="text-[var(--foreground)]">dopamine signaling</strong>, which makes the "reward" for starting a tedious task feel distant and weak. This is why shame-based motivation backfires: the problem was never effort or character. The solution is engineering — building an environment and a system where starting is easy, stimulation is managed, and finishing is rewarded.
        </P>
        <P>
          That's exactly what the strategies below do. For the general foundations (sleep, movement, single-tasking), read our <Link href="/focus-guide" className="text-[var(--brand-400)] hover:underline">complete focus guide</Link> first — then apply the ADHD-specific layers here.
        </P>
      </Section>

      {/* 2. Strategies */}
      <Section id="strategies">
        <H2>The 15 strategies</H2>

        <H3><span className="flex items-center gap-2"><Users size={18} className="text-[var(--brand-400)]" /> 1. Body doubling</span></H3>
        <P>
          Working alongside another person — even a stranger on a video call or in a <Link href="/virtual-study-room" className="text-[var(--brand-400)] hover:underline">virtual study room</Link> — provides gentle external accountability that helps the ADHD brain initiate and sustain tasks. It's one of the most consistently reported-effective ADHD strategies. Read more in our <Link href="/study-with-me" className="text-[var(--brand-400)] hover:underline">study with me</Link> guide.
        </P>

        <H3><span className="flex items-center gap-2"><Timer size={18} className="text-[var(--brand-400)]" /> 2. The 10-minute rule</span></H3>
        <P>
          Commit to just 10 minutes. Not "do the whole assignment" — just 10 minutes, with permission to stop after. This shrinks task initiation to something your brain doesn't need to fear. Most of the time, starting generates its own momentum; if it doesn't, you still did 10 minutes more than zero.
        </P>

        <H3><span className="flex items-center gap-2"><Bell size={18} className="text-[var(--brand-400)]" /> 3. Externalize time — timers everywhere</span></H3>
        <P>
          Time blindness means your internal clock can't be trusted. A visible countdown timer moves time into your environment. Use the <Link href="/pomodoro-guide" className="text-[var(--brand-400)] hover:underline">Pomodoro technique</Link> with a shortened 10–15 minute interval, and keep the timer visible at all times.
        </P>

        <H3><span className="flex items-center gap-2"><Trophy size={18} className="text-[var(--brand-400)]" /> 4. Make rewards immediate</span></H3>
        <P>
          Delayed rewards ("a good grade in 6 weeks") don't motivate the ADHD brain; immediate ones do. Attach a small, real reward to the end of every session — a coffee, one song, 5 minutes of a game, a streak badge. Gamified tools like FocusArx exist precisely because XP, coins, and streaks deliver the immediate dopamine payoff.
        </P>

        <H3><span className="flex items-center gap-2"><Monitor size={18} className="text-[var(--brand-400)]" /> 5. One-tab, one-task environments</span></H3>
        <P>
          The ADHD brain is a novelty-seeking system; every open tab is a possible dopamine detour. During work blocks: one tab, one window, phone in another room (not face-down on the desk — another room). Use full-screen mode to make the task the only visible thing.
        </P>

        <H3><span className="flex items-center gap-2"><Flag size={18} className="text-[var(--brand-400)]" /> 6. Shrink the first step until it's laughable</span></H3>
        <P>
          "Write essay" is not a task; it's a project. "Open the document and write one ugly sentence" is a task. ADHD task paralysis usually melts when the next action requires zero decisions. Define the next physical action, not the outcome.
        </P>

        <H3><span className="flex items-center gap-2"><Zap size={18} className="text-[var(--brand-400)]" /> 7. Use urgency on purpose — carefully</span></H3>
        <P>
          Deadlines create the urgency that engages ADHD focus, which is why so many people with ADHD work brilliantly at the last minute. Manufacture healthy urgency instead of riding panic: artificial deadlines with a body double, a scheduled "delivery" to a friend, or a countdown timer you honor. Panic-deadlines work but tax your health; designed urgency works nearly as well without the crash.
        </P>

        <H3><span className="flex items-center gap-2"><Brain size={18} className="text-[var(--brand-400)]" /> 8. Capture, don't trust, your memory</span></H3>
        <P>
          Working memory is the ADHD bottleneck. Every "I'll remember that" is a leak. Keep one capture list (a single notes app or notebook), write everything down the second it appears, and process the list at fixed times. Your brain is for thinking, not storage.
        </P>

        <H3><span className="flex items-center gap-2"><Moon size={18} className="text-[var(--brand-400)]" /> 9. Protect sleep like it's medication</span></H3>
        <P>
          Sleep deprivation amplifies every ADHD symptom — impulsivity, emotional volatility, inattention. A consistent wake time is the single strongest anchor for your circadian rhythm. Late-night hyperfocus is the enemy: set an alarm one hour before bed as a hard "wind-down" trigger.
        </P>

        <H3><span className="flex items-center gap-2"><Zap size={18} className="text-[var(--brand-400)]" /> 10. Movement before focus blocks</span></H3>
        <P>
          Exercise transiently improves attention, working memory, and impulse control — especially in ADHD brains. A brisk 10-minute walk before a study block is a legitimate focus strategy, not procrastination.
        </P>

        <H3><span className="flex items-center gap-2"><CheckCircle size={18} className="text-[var(--brand-400)]" /> 11. Implementation intentions</span></H3>
        <P>
          Vague plans ("study more") fail; specific ones survive contact with ADHD. Use the format: <strong className="text-[var(--foreground)]">"After [cue], I will [action] at [place] for [duration]."</strong> Example: "After I pour my morning coffee, I will do one 15-minute FocusArx session at my desk." The pre-decided cue removes the initiation tax.
        </P>

        <H3><span className="flex items-center gap-2"><Timer size={18} className="text-[var(--brand-400)]" /> 12. Real breaks — not phone breaks</span></H3>
        <P>
          Scrolling during a break doesn't rest the attention system; it stimulates it. Real breaks: stand up, stretch, water, look out a window, breathe. Try the <Link href="/breathe" className="text-[var(--brand-400)] hover:underline">2-minute breathing reset</Link> between sessions. Your next session starts with whatever state your break left you in.
        </P>

        <H3><span className="flex items-center gap-2"><Sparkles size={18} className="text-[var(--brand-400)]" /> 13. Match task difficulty to energy</span></H3>
        <P>
          Track your energy for a week and schedule accordingly: hard, boring tasks at your peak hours; routine tasks at your troughs. Your <Link href="/focus-guide" className="text-[var(--brand-400)] hover:underline">focus system</Link> should bend around your biology, not the clock.
        </P>

        <H3><span className="flex items-center gap-2"><Users size={18} className="text-[var(--brand-400)]" /> 14. Accountability partners and study groups</span></H3>
        <P>
          Social accountability is external motivation you don't have to generate. A weekly check-in with a friend, a <Link href="/study-rooms" className="text-[var(--brand-400)] hover:underline">study room</Link> streak, or a public goal dramatically increases follow-through.
        </P>

        <H3><span className="flex items-center gap-2"><Brain size={18} className="text-[var(--brand-400)]" /> 15. Consider professional support</span></H3>
        <P>
          Strategies help everyone, but they're not a substitute for treatment. Medication and ADHD-informed therapy meaningfully improve outcomes for many people. Talk to a qualified professional — using tools <em>and</em> treatment is not cheating, it's sense.
        </P>
      </Section>

      {/* 3. System */}
      <Section id="systems">
        <H2>A daily ADHD focus system in 4 steps</H2>
        <P>Individual tactics fade; a system compounds. Here's a minimal daily loop:</P>
        <div className="my-6 space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-6">
          {[
            ["Morning", "Pick ONE most-important task. Shrink its first step to something laughable. One 10-minute session before anything else."],
            ["Work blocks", "10–25 minute timer visible at all times, one tab, phone in another room. After each block: stand up, move, water."],
            ["Breaks", "5 minutes, no phone. Breathe, stretch, or stare out a window. The break is part of the method, not a reward for finishing it."],
            ["Evening", "Two-minute review: what got done? Set tomorrow's one task. Same wake time tomorrow — sleep is the foundation."],
          ].map(([t, d]) => (
            <div key={t} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
              <span className="w-24 shrink-0 font-bold text-[var(--brand-400)]">{t}</span>
              <span className="text-sm leading-relaxed text-[var(--foreground-muted)]">{d}</span>
            </div>
          ))}
        </div>
        <P>
          The exact lengths matter less than the loop. Start with one 10-minute session a day for a week, then grow. Our <Link href="/two-hour-study-method" className="text-[var(--brand-400)] hover:underline">2-hour study method</Link> shows how these blocks scale up.
        </P>
      </Section>

      {/* 4. Tools */}
      <Section id="tools">
        <H2>How FocusArx is built for ADHD brains</H2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            { icon: <Timer className="text-[var(--palette-purple-400)]" />, t: "Flexible short sessions", d: "Start at 10 minutes and grow. The timer is visible, external, and judgment-free." },
            { icon: <Trophy className="text-[var(--palette-amber-400)]" />, t: "Instant rewards", d: "XP, coins, and streaks deliver the immediate dopamine payoff ADHD brains need." },
            { icon: <Users className="text-[var(--palette-pink-400)]" />, t: "Body doubling built in", d: "Live study rooms with real people focusing beside you, any hour." },
            { icon: <Brain className="text-[var(--palette-emerald-400)]" />, t: "AI coach, zero shame", d: "Your data becomes gentle, specific nudges — not lectures." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--palette-white)]/10 bg-[var(--palette-white)]/5">{f.icon}</div>
              <p className="mb-1 font-bold text-[var(--foreground)]">{f.t}</p>
              <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">{f.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-[var(--brand-600)]/30 bg-gradient-to-br from-[var(--brand-600)]/10 to-transparent p-8 text-center">
          <h3 className="mb-2 text-xl font-semibold text-[var(--foreground)]">One 10-minute session. Today.</h3>
          <p className="mb-6 text-sm text-[var(--foreground-muted)]">Free forever, no credit card. Start absurdly small — that's the strategy.</p>
          <Link href="/signup" className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--brand-600)] px-6 text-sm font-semibold text-[var(--neutral-0)] shadow-[var(--shadow-violet-sm)] transition-[background-color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[var(--brand-500)] hover:shadow-[var(--shadow-violet-md)] active:scale-[0.98]">
            Start focusing free <ArrowRight size={16} />
          </Link>
        </div>
      </Section>

      {/* 5. Myths */}
      <Section id="myths">
        <H2>ADHD focus myths to drop</H2>
        <P>
          <strong className="text-[var(--foreground)]">"Try harder."</strong> Effort isn't the missing ingredient; structure and dopamine are. Systems beat willpower, every time. <strong className="text-[var(--foreground)]">"You just need discipline."</strong> Discipline is a finite resource in every brain, and ADHD taxes it doubly — the goal is to need less of it. <strong className="text-[var(--foreground)]">"Hyperfocus means you can focus when you want to."</strong> Hyperfocus is interest-driven and involuntary; it can't be aimed at boring tasks, and it burns you out when it swallows your evening. <strong className="text-[var(--foreground)]">"Music/videos always distract."</strong> For some ADHD brains, the right level of background stimulation (like <Link href="/focus-music" className="text-[var(--brand-400)] hover:underline">certain focus music</Link>) actually improves regulation — experiment and measure.
        </P>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="pb-20">
        <H2>Frequently asked questions</H2>
        <div className="space-y-4">
          {FAQS.map((f) => <FAQ key={f.q} {...f} />)}
        </div>
        <p className="mt-10 text-sm text-[var(--foreground-muted)]">
          Looking for more? Browse every guide in the <Link href="/guides" className="text-[var(--brand-400)] hover:underline">FocusArx guide library</Link>, or read our guides on <Link href="/stop-procrastinating" className="text-[var(--brand-400)] hover:underline">how to stop procrastinating</Link> and <Link href="/study-techniques" className="text-[var(--brand-400)] hover:underline">the best study techniques</Link>.
        </p>
      </Section>
    </div>
  );
}
