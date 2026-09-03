import { Link } from "wouter";
import { ArrowRight, Flame, CheckCircle, ListChecks, Clock, Zap, Brain, Users, Ban, Scale } from "lucide-react";
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
    q: "What is the main cause of procrastination?",
    a: "Research points primarily to emotion regulation, not time management. We procrastinate to avoid negative feelings attached to a task — boredom, anxiety, self-doubt, resentment, or overwhelm. The fix is reducing the emotional friction of starting (smaller steps, self-compassion, clarity) rather than tightening your schedule.",
  },
  {
    q: "How do I stop procrastinating right now?",
    a: "Pick the single task you're avoiding, define a 2-minute version of it, set a timer, and do only that. Starting is the bottleneck; momentum usually follows. If it doesn't, you still started — which weakens the avoidance habit more than a productive-sounding planning session.",
  },
  {
    q: "Is procrastination laziness?",
    a: "No. Lazy people don't care about not working; procrastinators usually care intensely and suffer for the delay — that anxiety is what fuels the avoidance in the first place. Studies even show self-compassion reduces future procrastination, while self-criticism increases it.",
  },
  {
    q: "Why do I procrastinate even on things I want to do?",
    a: "Any task with an ambiguous first step, a delayed reward, or a threat to your self-image (what if it's bad?) can trigger avoidance — even enjoyable ones. The same toolkit applies: shrink the first step, make progress visible, and lower the stakes of the first attempt.",
  },
  {
    q: "Does the Pomodoro technique help with procrastination?",
    a: "Yes — a 25-minute commitment is small enough to slip under the avoidance reflex. Once you're 25 minutes in, task-related worry typically drops and continuing is easier. FocusArx's timer, streaks, and rewards add the immediate payoff that delayed task rewards can't provide.",
  },
  {
    q: "How long does it take to stop procrastinating?",
    a: "You never fully 'stop' — even prolific people procrastinate; they just recover faster and have systems that make starting cheap. Expect the habit of recovering quickly to build over a few weeks of deliberate practice with tools like the 2-minute rule and implementation intentions.",
  },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Stop Procrastinating: 12 Methods That Actually Work",
  "description": "A science-based guide to beating procrastination — why it's an emotion-regulation problem, and 12 proven methods including the 2-minute rule, temptation bundling, and implementation intentions.",
  "author": { "@type": "Organization", "name": "FocusArx" },
  "publisher": { "@type": "Organization", "name": "FocusArx", "logo": { "@type": "ImageObject", "url": "https://focusarx.site/logo.png" } },
  "dateModified": "2026-08-24",
  "mainEntityOfPage": "https://focusarx.site/stop-procrastinating",
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

export default function StopProcrastinatingPage() {
  return (
    <div className="min-h-screen bg-[var(--muted)] text-[var(--foreground)]">
      <PageSEO {...PAGE_SEO.stopProcrastinating} structuredData={[articleSchema, faqSchema]} />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[var(--border-subtle)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,_var(--rgba-124-58-237-0_18),_transparent_70%)]" />
        <Section className="relative py-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--brand-600)]/30 bg-[var(--brand-600)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--brand-400)]">
            <Flame size={12} /> Free Guide · Updated 2026
          </div>
          <h1 className="mb-4 text-3xl font-semibold leading-tight text-[var(--foreground)] sm:text-5xl">
            How to Stop Procrastinating:
            <br />
            <span className="text-[var(--brand-strong)]">12 Methods That Actually Work</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-[var(--foreground-muted)] sm:text-lg">
            Procrastination isn't laziness or a time-management glitch — it's your brain avoiding an emotion. Here's the science, and the toolkit.
          </p>
        </Section>
      </div>

      {/* TOC */}
      <Section className="py-8">
        <nav aria-label="Table of contents" className="rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-124-58-237-0_04)] p-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--brand-400)]"><ListChecks size={14} /> In this guide</p>
          <ol className="grid gap-x-6 gap-y-2 text-sm text-[var(--foreground-muted)] sm:grid-cols-2">
            {[["#why", "1. Why you really procrastinate"], ["#methods", "2. The 12 methods"], ["#system", "3. The daily anti-procrastination system"], ["#faq", "4. FAQ"]].map(([href, label]) => (
              <li key={href}><a href={href} className="transition-colors hover:text-[var(--brand-400)]">{label}</a></li>
            ))}
          </ol>
        </nav>
      </Section>

      {/* 1. Why */}
      <Section id="why">
        <H2>Why you really procrastinate</H2>
        <P>
          The most useful finding in procrastination research is this: <strong className="text-[var(--foreground)]">procrastination is an emotion-regulation problem, not a time-management problem.</strong> When a task feels boring, overwhelming, ambiguous, or threatening (what if my work isn't good enough?), your brain seeks relief — and relief is one click away. Scrolling isn't the disease; it's the anesthetic.
        </P>
        <P>
          This explains three puzzling facts. Why you procrastinate on <em>important</em> tasks but not fun ones (importance raises the emotional stakes). Why tighter deadlines sometimes make it worse (more anxiety → more avoidance). And why beating yourself up backfires: shame adds a <em>new</em> negative emotion to the task, making it even more avoidable. In studies, <Link href="/focus-guide" className="text-[var(--brand-400)] hover:underline">students who forgave themselves</Link> for procrastinating procrastinated less on the next exam.
        </P>
        <P>
          The escape from the loop is counterintuitive: make starting <em>ridiculously easy</em>, make progress <em>visible</em>, and make the reward <em>immediate</em>. Every method below is one of those three in disguise.
        </P>
      </Section>

      {/* 2. Methods */}
      <Section id="methods">
        <H2>The 12 methods</H2>

        <H3><span className="flex items-center gap-2"><Zap size={18} className="text-[var(--brand-400)]" /> 1. The 2-minute rule</span></H3>
        <P>Shrink any task until its first step takes two minutes: "open the document," "write one ugly sentence," "put on shoes." The rule isn't about finishing in 2 minutes — it's about making starting so cheap that avoidance has nothing to push against.</P>

        <H3><span className="flex items-center gap-2"><Clock size={18} className="text-[var(--brand-400)]" /> 2. Timebox, don't task-box</span></H3>
        <P>Commit to <em>time</em>, not outcomes: "25 minutes on the essay" instead of "finish the essay." A time commitment is always achievable, which keeps your brain from negotiating, and it's exactly how the <Link href="/pomodoro-guide" className="text-[var(--brand-400)] hover:underline">Pomodoro technique</Link> works.</P>

        <H3><span className="flex items-center gap-2"><Brain size={18} className="text-[var(--brand-400)]" /> 3. Implementation intentions</span></H3>
        <P>Pre-decide the trigger: <strong className="text-[var(--foreground)]">"When X happens, I will do Y."</strong> "When I sit down at my desk at 9am, I start my first 25-minute session on chapter 3." Deciding once, in advance, removes the in-the-moment negotiation where procrastination wins. This is one of the most replicated findings in behavioral science.</P>

        <H3><span className="flex items-center gap-2"><Scale size={18} className="text-[var(--brand-400)]" /> 4. Temptation bundling</span></H3>
        <P>Pair something you <em>must</em> do with something you <em>want</em> do: your favorite drink only during work blocks, your best playlist only during study sessions. You're hijacking the dopamine that normally pulls you away and pointing it at the task.</P>

        <H3><span className="flex items-center gap-2"><Ban size={18} className="text-[var(--brand-400)]" /> 5. Design the environment, don't fight it</span></H3>
        <P>Add friction to distractions and remove it from the task: phone in another room, social apps logged out, task document open and waiting. Every decision you don't have to make at the desk is one procrastination can't win.</P>

        <H3><span className="flex items-center gap-2"><ListChecks size={18} className="text-[var(--brand-400)]" /> 6. Make the next action physical</span></H3>
        <P>"Work on project" is ambiguous, and ambiguity is fuel for avoidance. Rewrite every to-do as the next <em>physical</em> action: "email Dr. Rao the draft," "solve problems 4–7," "write the intro outline." If you can't picture yourself doing it in 10 seconds, it's not defined yet.</P>

        <H3><span className="flex items-center gap-2"><Users size={18} className="text-[var(--brand-400)]" /> 7. Body doubling and accountability</span></H3>
        <P>Work beside someone — a friend, a <Link href="/virtual-study-room" className="text-[var(--brand-400)] hover:underline">virtual study room</Link>, a coworker on a call. Being observed quietly suppresses the impulse to tab-swap, and a promised check-in converts a vague intention into a social commitment.</P>

        <H3><span className="flex items-center gap-2"><CheckCircle size={18} className="text-[var(--brand-400)]" /> 8. Make progress visible</span></H3>
        <P>Done-lists, streaks, session counts — visible progress triggers the "don't break the chain" effect. Crossing off a session feels small, but streak psychology is powerful enough to pull you to the desk on low-motivation days. (This is why FocusArx is built around streaks and XP.)</P>

        <H3><span className="flex items-center gap-2"><Clock size={18} className="text-[var(--brand-400)]" /> 9. Eat the frog (or warm up with a win)</span></H3>
        <P>Two valid strategies — know yourself. Frog-first: do the scariest task in your first block, while willpower is highest, and everything after feels lighter. Warm-up-first: start with a 10-minute easy task to build momentum, then pivot into the hard thing. Try both for a week and keep the one that works.</P>

        <H3><span className="flex items-center gap-2"><Brain size={18} className="text-[var(--brand-400)]" /> 10. Scheduled worry — and scheduled starts</span></H3>
        <P>If anxiety is the engine of your avoidance, don't suppress it; schedule it. Write the worry down, give it 10 minutes of genuine attention at a fixed time, then close the loop and start a 25-minute block. You're not ignoring the emotion — you're refusing to negotiate with it at the desk.</P>

        <H3><span className="flex items-center gap-2"><Zap size={18} className="text-[var(--brand-400)]" /> 11. Lower the quality bar for version one</span></H3>
        <P>Perfectionism is procrastination wearing a tuxedo. Give yourself explicit permission to produce a bad first draft — you can't edit a blank page. Set a timer and race it: a messy 25-minute version beats an imaginary perfect one that never starts.</P>

        <H3><span className="flex items-center gap-2"><CheckCircle size={18} className="text-[var(--brand-400)]" /> 12. Reward the start, not the finish</span></H3>
        <P>Delayed rewards ("I'll relax when it's done") don't beat immediate relief (scrolling now). Flip the order: small reward right after starting — after the first session, not after the project. Gamified tools make this automatic: every session pays out XP and coins immediately.</P>
      </Section>

      {/* 3. System */}
      <Section id="system">
        <H2>The daily anti-procrastination system</H2>
        <div className="my-6 space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-6">
          {[
            ["Night before", "Choose tomorrow's ONE important task and write its 2-minute first step. Decide when and where you'll start."],
            ["First block", "Do the 2-minute version immediately — before email, before messages. Extend into a full 25-minute session if momentum shows up (it usually does)."],
            ["During the day", "Timebox everything. Visible timer, one tab, phone elsewhere. Log each completed session so the streak stays alive."],
            ["End of day", "Review the done-list, forgive anything missed (genuinely — it reduces tomorrow's procrastination), and set the next first step."],
          ].map(([t, d]) => (
            <div key={t} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
              <span className="w-28 shrink-0 font-bold text-[var(--brand-400)]">{t}</span>
              <span className="text-sm leading-relaxed text-[var(--foreground-muted)]">{d}</span>
            </div>
          ))}
        </div>
        <P>
          Want to go deeper on structuring the blocks themselves? Read the <Link href="/two-hour-study-method" className="text-[var(--brand-400)] hover:underline">2-hour study method</Link>, the <Link href="/focus-guide" className="text-[var(--brand-400)] hover:underline">complete focus guide</Link>, or — if avoidance feels deeper than normal, with intense restlessness or attention swings — our guide on <Link href="/adhd-focus-tips" className="text-[var(--brand-400)] hover:underline">focusing with ADHD</Link>.
        </P>
        <div className="mt-8 rounded-2xl border border-[var(--brand-600)]/30 bg-gradient-to-br from-[var(--brand-600)]/10 to-transparent p-8 text-center">
          <h3 className="mb-2 text-xl font-semibold text-[var(--foreground)]">Beat avoidance with a 2-minute start</h3>
          <p className="mb-6 text-sm text-[var(--foreground-muted)]">Open FocusArx, run one 25-minute session on the thing you're avoiding. Free forever.</p>
          <Link href="/signup" className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--brand-600)] px-6 text-sm font-semibold text-[var(--neutral-0)] shadow-[var(--shadow-violet-sm)] transition-[background-color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[var(--brand-500)] hover:shadow-[var(--shadow-violet-md)] active:scale-[0.98]">
            Start free <ArrowRight size={16} />
          </Link>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="pb-20">
        <H2>Frequently asked questions</H2>
        <div className="space-y-4">
          {FAQS.map((f) => <FAQ key={f.q} {...f} />)}
        </div>
        <p className="mt-10 text-sm text-[var(--foreground-muted)]">
          More in the <Link href="/guides" className="text-[var(--brand-400)] hover:underline">FocusArx guide library</Link>: <Link href="/study-techniques" className="text-[var(--brand-400)] hover:underline">best study techniques</Link>, <Link href="/science-of-deep-work" className="text-[var(--brand-400)] hover:underline">the science of deep work</Link>, and <Link href="/focus-music" className="text-[var(--brand-400)] hover:underline">the truth about focus music</Link>.
        </p>
      </Section>
    </div>
  );
}
