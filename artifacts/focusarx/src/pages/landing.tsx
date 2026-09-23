import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Library,
  Lock,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  Target,
  Timer,
  Users,
  X,
} from "lucide-react";
import { BrandMark, BrandWordmark } from "@/components/ui/brand";
import { LandingTimerPreview } from "@/components/landing/LandingTimerPreview";
import { LandingMobileCta } from "@/components/landing/LandingMobileCta";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { Reveal, RevealStagger, RevealItem } from "@/components/motion/Scroll";
import { AdSlot } from "@/components/AdSlot";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Homepage.
 *
 * v5 rewrote the *presentation* of this page and none of its promises. The
 * page used to open with an aurora wash, a dot grid, a cursor spotlight, a
 * gradient headline and a 3D "atmosphere" panel — five decorative layers that
 * between them said "AI startup template" louder than the product said
 * anything. What is left is the product: a headline you can read, the timer
 * running on the page, and the claims the app can actually support.
 *
 * Editorial rules this file follows (see docs/DESIGN.md):
 *   • one accent, used on the primary action and nothing else;
 *   • hairline separators instead of shadows and glows;
 *   • sections divided by a single rule line at most;
 *   • a left-aligned measure — centred hero copy is a costume, not a design.
 */

const FEATURES = [
  { icon: Timer, title: "A timer that protects the work", description: "Move from Pomodoro to deep-work blocks without losing session history, tasks, or your place." },
  { icon: CheckCircle2, title: "Tasks stay in the same flow", description: "Capture a task, complete it optimistically, and keep every FocusArx view in sync." },
  { icon: Brain, title: "Coaching grounded in your patterns", description: "Turn real session history into practical next steps instead of generic productivity advice." },
  { icon: Library, title: "Study without the clutter", description: "Build decks, review with Leitner scheduling, and enter a focused full-screen study rhythm." },
  { icon: Users, title: "Accountability when you want it", description: "Join study rooms and community spaces without turning focus into a noisy social feed." },
  { icon: ShieldCheck, title: "Privacy built into focus mode", description: "When camera support is enabled, vision processing runs on-device and stays separate from wellness tools." },
];

const HOW_IT_WORKS = [
  { step: "01", icon: Timer, title: "Set your session", text: "Pick a task, choose your duration, and start a Pomodoro or deep-work block." },
  { step: "02", icon: Brain, title: "The timer holds the line", text: "Coaching reads your session history — drop-off points, peak hours — and adapts, not generic tips." },
  { step: "03", icon: Flame, title: "Build your streak", text: "Earn XP, collect coins, and watch your focus streak grow every day you show up." },
];

const COACHING_POINTS = [
  { icon: Brain, title: "Personalized insights", text: "AI learns your patterns and suggests the optimal session length, time of day, and break schedule." },
  { icon: BarChart3, title: "Focus analytics", text: "See your focus quality over time — not just minutes logged, but how effectively you used them." },
  { icon: Clock3, title: "Coached sessions", text: "Get real-time nudges during sessions based on your historical drop-off points." },
];

const MOMENTUM_POINTS = [
  { icon: Flame, title: "Streaks that encourage, not punish", text: "See consistency in context and return without shame after a missed day." },
  { icon: Target, title: "Tasks beside the timer", text: "Keep the current priority close enough to act on, never close enough to distract." },
  { icon: BarChart3, title: "Review patterns, not vanity metrics", text: "Use session history and focus quality to make tomorrow's plan more realistic." },
];

const EXAM_GUIDES = [
  { name: "JEE Main", note: "90 seconds a question", href: "/exam/jee-main" },
  { name: "NEET UG", note: "200 questions of NCERT recall", href: "/exam/neet-ug" },
  { name: "CBSE Class 12", note: "Step marks and presentation", href: "/exam/cbse-class-12" },
  { name: "UPSC CSE", note: "Daily answer writing", href: "/exam/upsc-cse" },
  { name: "BITSAT", note: "Speed over depth", href: "/exam/bitsat" },
  { name: "CLAT", note: "120 questions, one passage each", href: "/exam/clat" },
  { name: "CA Foundation", note: "Your weakest paper decides it", href: "/exam/ca-foundation" },
  { name: "GRE", note: "Section-adaptive, under two hours", href: "/exam/gre" },
];

const COMPARISONS = [
  { name: "Forest", note: "Tree-planting gamification", href: "/comparison/focusarx-vs-forest" },
  { name: "Focusmate", note: "1-on-1 video coworking", href: "/comparison/focusarx-vs-focusmate" },
  { name: "Pomofocus", note: "Minimal web Pomodoro timer", href: "/comparison/focusarx-vs-pomofocus" },
];

const FOOTER_GROUPS = [
  { title: "Product", links: [["Dashboard", "/dashboard"], ["Virtual study rooms", "/virtual-study-room"], ["Live study rooms", "/study-rooms"], ["Flashcards", "/flashcards"], ["Pricing", "/pricing"]] },
  { title: "Learn", links: [["All guides", "/guides"], ["Exam prep hub", "/exam"], ["Focus guide", "/focus-guide"], ["Pomodoro guide", "/pomodoro-guide"], ["ADHD focus tips", "/adhd-focus-tips"], ["Stop procrastinating", "/stop-procrastinating"], ["Focus music", "/focus-music"]] },
  { title: "Timers", links: [["Pomodoro timer", "/pomodoro-timer"], ["5 minute timer", "/5-minute-timer"], ["15 minute timer", "/15-minute-timer"], ["30 minute timer", "/30-minute-timer"], ["45 minute timer", "/45-minute-timer"]] },
  { title: "Company", links: [["About", "/about"], ["Contact", "/contact"], ["Support", "/support"]] },
];

/** Section wrapper: one measure, one rhythm, for every band on the page. */
function Section({
  id,
  children,
  className,
  bordered = false,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  bordered?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn( "px-5 py-20 sm:px-8 sm:py-28",
        bordered && "border-y border-[var(--border-subtle)]",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="FocusArx home">
      <BrandMark className="h-7 w-7" />
      <BrandWordmark className="text-[0.9375rem]" />
    </Link>
  );
}

function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const links = [
    { label: "Product", href: "#product" },
    { label: "Features", href: "#features" },
    { label: "Study guides", href: "/guides" },
    { label: "Pricing", href: "/pricing" },
  ];
  return (
    <header className="sticky top-0 z-[var(--z-nav)] border-b border-[var(--border-subtle)] bg-[var(--background)]">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8" aria-label="Marketing navigation">
        <Brand />
        <div className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a key={link.label} href={link.href} className="text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]">
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          {/* Points at the timer, not the signup form. /focus is public and
              guest-first (see the route comment in App.tsx), so the promise on
              the button — "start focusing" — is one click true. Sending this to
              /signup asked for an account before showing the product, which is
              the leak behind the 0.2-0.7% landing-to-timer rate. */}
          <Button asChild>
            <Link href="/focus">Start focusing <ArrowRight /></Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((current) => !current)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </nav>
      {open && (
        <div className="border-t border-[var(--border-subtle)] px-5 pb-5 md:hidden">
          <div className="grid pt-2">
            {links.map((link) => (
              <a key={link.label} href={link.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center text-sm text-[var(--foreground-muted)]">
                {link.label}
              </a>
            ))}
            <Link href="/login" className="flex min-h-11 items-center text-sm text-[var(--foreground-muted)]">Sign in</Link>
          </div>
        </div>
      )}
    </header>
  );
}

/**
 * A still of the real interface.
 *
 * Not a screenshot and not a mock of a feature that does not exist: every
 * element here is in the product (timer ring, next-up list, streak/XP/task
 * counters). The previous version framed this in a fake browser chrome bar
 * with traffic-light dots and painted a brand shadow under it — costume
 * again. Now it is a hairline panel, which is what the product actually uses.
 */
function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-1)]">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
        <p className="text-xs font-semibold text-[var(--foreground)]">Today</p>
        <p className="text-xs text-[var(--foreground-subtle)]">Focus workspace</p>
      </div>
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1.1fr_0.9fr]">
        <div className="grid place-items-center rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-6 text-center">
          <div>
            <div
              className="relative mx-auto grid h-32 w-32 place-items-center rounded-full"
              style={{ background: "conic-gradient(var(--brand-500) 0deg 252deg, var(--surface-3) 252deg 360deg)" }}
            >
              <div className="absolute inset-[6px] rounded-full bg-[var(--surface-1)]" />
              <span className="relative font-mono text-3xl font-semibold tabular-nums text-[var(--foreground)]">25:00</span>
            </div>
            <p className="mt-5 text-sm font-semibold text-[var(--foreground)]">Protect the next 25 minutes.</p>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">Review chapter notes</p>
          </div>
        </div>
        <div className="grid content-start gap-3">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3.5">
            <p className="text-xs font-semibold text-[var(--foreground)]">Next up</p>
            <div className="mt-3 space-y-1.5">
              {[
                { task: "Review chapter notes", done: true },
                { task: "Build biology deck", done: false },
                { task: "Submit project outline", done: false },
              ].map(({ task, done }) => (
                <div key={task} className="flex items-center gap-2.5">
                  <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full border", done ? "border-[var(--success)] bg-[var(--success)]" : "border-[var(--border-strong)]")}>
                    {done ? <Check size={10} className="text-[var(--surface-1)]" /> : null}
                  </span>
                  <span className={cn("truncate text-xs", done ? "text-[var(--foreground-subtle)] line-through" : "text-[var(--foreground-muted)]")}>{task}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {[["Streak", "12 days"], ["XP this week", "2,480"], ["Sessions today", "3"]].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3.5 py-2.5">
                <span className="text-xs text-[var(--foreground-subtle)]">{label}</span>
                <span className="font-metric text-sm font-semibold text-[var(--foreground)]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A three-step explanation rendered as a numbered list, not three cards. */
function Steps() {
  return (
    <RevealStagger className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-3">
      {HOW_IT_WORKS.map(({ step, icon: Icon, title, text }) => (
        <RevealItem key={step} className="border-t border-[var(--border-subtle)] pt-5">
          <div className="flex items-center gap-3">
            <span className="font-metric text-xs font-semibold text-[var(--foreground-subtle)]">{step}</span>
            <Icon size={15} className="text-[var(--foreground-subtle)]" aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-[var(--foreground)]">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{text}</p>
        </RevealItem>
      ))}
    </RevealStagger>
  );
}

/** Icon + copy rows used by the two "why" sections. */
function PointList({ points }: { points: typeof COACHING_POINTS }) {
  return (
    <div className="mt-8 space-y-6">
      {points.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex gap-4">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--foreground-muted)]">
            <Icon size={16} aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Session anatomy.
 *
 * Replaces the 3D "focus atmosphere" panel. That panel was three.js — ~890 kB
 * of payload behind an IntersectionObserver — to render a decorative scene
 * that told the reader nothing about the product. A diagram of what a focused
 * hour is actually made of does the same amount of visual work at zero cost,
 * and it is the thing a first-time visitor needs to understand.
 */
function SessionAnatomy() {
  const blocks = [
    { label: "Focus", minutes: 25, tone: "var(--brand-500)", width: "52%" },
    { label: "Break", minutes: 5, tone: "var(--success)", width: "10%" },
    { label: "Focus", minutes: 25, tone: "var(--brand-500)", width: "52%" },
    { label: "Long break", minutes: 15, tone: "var(--info)", width: "22%" },
  ];
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-[var(--foreground)]">One focused hour</p>
        <p className="text-xs text-[var(--foreground-subtle)]">2 sessions · 1 break · 1 reset</p>
      </div>
      <div className="mt-5 space-y-3">
        {blocks.map((block, index) => (
          <div key={`${block.label}-${index}`} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3">
            <span className="text-xs text-[var(--foreground-muted)]">{block.label}</span>
            <span className="h-2 overflow-hidden rounded-[var(--radius-full)] bg-[var(--surface-3)]">
              <span className="block h-full rounded-[var(--radius-full)]" style={{ width: block.width, background: block.tone }} />
            </span>
            <span className="text-right font-metric text-xs tabular-nums text-[var(--foreground-subtle)]">{block.minutes}m</span>
          </div>
        ))}
      </div>
      <p className="mt-5 border-t border-[var(--border-subtle)] pt-4 text-xs leading-relaxed text-[var(--foreground-subtle)]">
        Every block is logged, so the next plan is built from what you actually did — not from what you meant to do.
      </p>
    </div>
  );
}

export default function LandingPage() {
  const structuredData = { "@context": "https://schema.org", "@type": "SoftwareApplication",
    name: "FocusArx",
    operatingSystem: "Web, Android, iOS",
    applicationCategory: "ProductivityApplication",
    description: "A deep-work workspace for focus sessions, tasks, flashcards, progress, and accountable study.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <PageSEO {...PAGE_SEO.home} structuredData={structuredData} />
      <LandingMobileCta />
      <MarketingNav />
      <main id="main-content">
        {/* ── HERO ──────────────────────────────────────────────────────
            Copy and a running timer, side by side. The timer is the argument. */}
        <section className="px-5 pb-20 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <Reveal>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
                  Focus timer · Study tracker · Coaching
                </p>
                <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.035em] text-[var(--foreground)] sm:text-5xl lg:text-[3.5rem]">
                  The AI focus timer that builds real deep work habits.
                </h1>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--foreground-muted)] sm:text-lg">
                  Pomodoro sessions, coaching from your own history, and streaks that keep you
                  focused — free, no credit card required.
                </p>
              </Reveal>
              <Reveal delay={0.05}>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button asChild size="lg">
                    <Link href="/focus">Start focusing free <ArrowRight /></Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <a href="#product">See how it works <ChevronRight /></a>
                  </Button>
                </div>
                <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--foreground-subtle)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Check size={14} className="text-[var(--success)]" aria-hidden="true" /> Free forever tier
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Lock size={13} className="text-[var(--success)]" aria-hidden="true" /> Privacy-first by design
                  </span>
                  <span>No signup to start your first session</span>
                </p>
              </Reveal>
            </div>
            <Reveal delay={0.1}>
              {/* The product, live on the page: a working timer preview instead
                  of a screenshot. Every reviewed design proposal centered the
                  hero on running the timer before signup; this is that idea,
                  wired to the real /focus deep-link contract. */}
              <LandingTimerPreview />
            </Reveal>
          </div>
        </section>

        {/* ── PRODUCT ─────────────────────────────────────────────────── */}
        <Section id="product" bordered>
          <Reveal className="max-w-2xl">
            <p className="page-eyebrow">The workspace</p>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-4xl">
              One screen for the work, the plan, and the proof.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[var(--foreground-muted)]">
              The timer sits in the middle because the work does. Tasks, streaks and session
              history stay one glance away, never one tab away.
            </p>
          </Reveal>
          <Reveal delay={0.05} className="mt-10">
            <ProductPreview />
          </Reveal>
        </Section>

        {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
        <Section>
          <Reveal className="max-w-2xl">
            <p className="page-eyebrow">How it works</p>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-4xl">
              Three steps to focused work.
            </h2>
          </Reveal>
          <Steps />
        </Section>

        {/* ── AI COACHING DIFFERENTIATOR ──────────────────────────────── */}
        <Section bordered>
          <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <p className="page-eyebrow">Why coaching beats a plain timer</p>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-4xl">
                Forest grows trees. FocusArx grows your focus.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--foreground-muted)]">
                Most focus timers count down. FocusArx reads your session history, finds your
                peak hours, and coaches you toward better habits — not just longer sessions.
              </p>
              <PointList points={COACHING_POINTS} />
            </Reveal>
            <Reveal delay={0.05} className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 sm:p-6">
              <div className="grid gap-3">
                {[
                  { label: "Sessions with coaching", value: "92% completion rate", color: "var(--success)" },
                  { label: "Sessions without coaching", value: "67% completion rate", color: "var(--foreground-muted)" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
                    <p className="text-xs text-[var(--foreground-subtle)]">{label}</p>
                    <p className="mt-1.5 font-metric text-lg font-semibold" style={{ color }}>{value}</p>
                  </div>
                ))}
                {/* Substantiated claim. Previously read "Based on FocusArx
                    user data — 50,000+ sessions analyzed", which had no
                    definition, period or sample anyone could check. The
                    definition and review date are now inline, and the
                    underlying figure is tracked on the public claim ledger. */}
                <p className="text-xs leading-relaxed text-[var(--foreground-subtle)]">
                  FocusArx internal product analytics. "Completion" = a session
                  that ran to its scheduled end without being abandoned.
                  Self-selected users, not a controlled comparison — coaching
                  users also tend to be more engaged to begin with.{" "}
                  <Link href="/evidence" className="underline underline-offset-2 hover:text-[var(--foreground-muted)]">
                    See our claim ledger
                  </Link>
                  .
                </p>
              </div>
            </Reveal>
          </div>
        </Section>

        {/* ── FEATURES GRID ───────────────────────────────────────────── */}
        <Section id="features">
          <Reveal className="max-w-2xl">
            <p className="page-eyebrow">Everything you need</p>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-4xl">
              A complete focus loop.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[var(--foreground-muted)]">
              FocusArx keeps planning, doing, reviewing, and learning in one visual language.
            </p>
          </Reveal>
          {/* Hairline grid: the 1px gaps *are* the separators, so no card needs
              a border or a shadow of its own. */}
          <RevealStagger className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--border-subtle)] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <RevealItem key={title} className="bg-[var(--surface-1)] p-6 transition-colors duration-[var(--duration-fast)] hover:bg-[var(--surface-2)]">
                <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--foreground-muted)]">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-base font-semibold tracking-[-0.01em] text-[var(--foreground)]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{description}</p>
              </RevealItem>
            ))}
          </RevealStagger>
        </Section>

        {/* ── MOMENTUM ────────────────────────────────────────────────── */}
        <Section bordered>
          <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <p className="page-eyebrow">Designed for the next action</p>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-4xl">
                Your momentum, visible at a glance.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--foreground-muted)]">
                The dashboard connects streak, XP, active work, and session quality without
                turning it into a scoreboard.
              </p>
              <PointList points={MOMENTUM_POINTS} />
            </Reveal>
            <Reveal delay={0.05}>
              <SessionAnatomy />
            </Reveal>
          </div>
        </Section>

        {/* ── AD SLOT: mid-landing ─────────────────────────────────
            Placed between two full-height content sections, far from any
            CTA, so it satisfies AdSense's accidental-click policy. */}
        <section className="px-5 py-10 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <AdSlot name="landingMid" />
          </div>
        </section>

        {/* ── EXAM GUIDES ────────────────────────────────────────
            Most FocusArx visitors are students with a specific paper and a
            date. Naming the exams they are actually sitting is the honest way
            to say "this is built for you" — and it links the homepage into the
            exam cluster instead of leaving 23 guides two clicks deep. */}
        <Section>
          <Reveal className="max-w-2xl">
            <p className="page-eyebrow">Exam prep</p>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-4xl">
              Built for the paper you are actually sitting.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[var(--foreground-muted)]">
              Twenty-three exam guides written from the official bulletins — paper pattern, marking
              rules, a dated plan, and the section timing that decides the rank. Each one comes with
              a timer set to the length that paper rewards. Free, like everything else here.
            </p>
          </Reveal>
          <RevealStagger className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {EXAM_GUIDES.map(({ name, note, href }) => (
              <RevealItem key={name}>
                <Link
                  href={href}
                  className="block h-full rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3.5 transition-colors duration-[var(--duration-fast)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
                >
                  <p className="text-sm font-semibold text-[var(--foreground)]">{name}</p>
                  <p className="mt-0.5 text-xs text-[var(--foreground-subtle)]">{note}</p>
                </Link>
              </RevealItem>
            ))}
          </RevealStagger>
          <div className="mt-8">
            <Button asChild variant="outline">
              <Link href="/exam">Browse all exam guides <ChevronRight /></Link>
            </Button>
          </div>
        </Section>

        {/* ── COMPARISON ────────────────────────────────────────── */}
        <Section bordered className="text-center">
          <Reveal className="mx-auto max-w-2xl">
            <p className="page-eyebrow">See how we compare</p>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-4xl">
              FocusArx vs Forest, Focusmate &amp; Pomofocus.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[var(--foreground-muted)]">
              We break down what each app does best — and where FocusArx goes further with
              coaching, analytics, and gamification.
            </p>
          </Reveal>
          <RevealStagger className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {COMPARISONS.map(({ name, note, href }) => (
              <RevealItem key={name}>
                <Link
                  href={href}
                  className="block rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] px-5 py-3 text-left transition-colors duration-[var(--duration-fast)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
                >
                  <p className="text-sm font-semibold text-[var(--foreground)]">FocusArx vs {name}</p>
                  <p className="text-xs text-[var(--foreground-subtle)]">{note}</p>
                </Link>
              </RevealItem>
            ))}
          </RevealStagger>
          <div className="mt-8">
            <Button asChild variant="outline">
              <Link href="/comparison/focusarx-vs-forest">See full comparison <ChevronRight /></Link>
            </Button>
          </div>
        </Section>

        {/* ── FINAL CTA ─────────────────────────────────────────── */}
        <Section>
          <Reveal className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-1)] px-6 py-14 sm:px-12 sm:py-16">
            <div className="mx-auto max-w-2xl text-center">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--foreground-muted)]">
                <Clock3 size={18} aria-hidden="true" />
              </span>
              <h2 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-4xl">
                Your next focused hour starts now.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--foreground-muted)]">
                Choose one task and begin with a single focus block. No account and no credit card
                required — save your streak later if you want to.
              </p>
              <Button asChild size="lg" className="mt-8">
                <Link href="/focus">Start focusing free <ArrowRight /></Link>
              </Button>
              <p className="mt-4 text-xs text-[var(--foreground-subtle)]">
                Free forever — Premium activated with coins you earn by focusing
              </p>
            </div>
          </Reveal>
        </Section>

        {/* ── AD SLOT: above the footer ─────────────────────────── */}
        <section className="px-5 pb-16 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <AdSlot name="landingFooter" />
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border-subtle)] px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Brand />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--foreground-muted)]">
                A calm operating system for focused work, deliberate study, and sustainable momentum.
              </p>
            </div>
            {FOOTER_GROUPS.map((group) => (
              <div key={group.title}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--foreground-subtle)]">{group.title}</h2>
                <ul className="mt-4 space-y-3">
                  {group.links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href} className="text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]">{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {/* Footer. Real crawlable <a>/<Link> elements — not buttons with
              click handlers — because a crawler that does not execute
              JavaScript discovers the site through this block. Every page
              here is in the sitemap. */}
          <div className="mt-12 border-t border-[var(--border-subtle)] pt-8">
            <div className="grid gap-8 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--foreground-muted)]">Tools</p>
                <ul className="space-y-2 text-[var(--foreground-subtle)]">
                  <li><Link href="/pomodoro-timer" className="hover:text-[var(--foreground)]">Pomodoro timer</Link></li>
                  <li><Link href="/focus-timer" className="hover:text-[var(--foreground)]">Focus timer</Link></li>
                  <li><Link href="/study-timer" className="hover:text-[var(--foreground)]">Study timer</Link></li>
                  <li><Link href="/study-calculator" className="hover:text-[var(--foreground)]">Study time calculator</Link></li>
                  <li><Link href="/break-free" className="hover:text-[var(--foreground)]">60-second scroll reset</Link></li>
                </ul>
              </div>
              <div>
                <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--foreground-muted)]">Guides</p>
                <ul className="space-y-2 text-[var(--foreground-subtle)]">
                  <li><Link href="/guides" className="hover:text-[var(--foreground)]">All guides</Link></li>
                  <li><Link href="/focus-guide" className="hover:text-[var(--foreground)]">How to focus</Link></li>
                  <li><Link href="/deep-work-guide" className="hover:text-[var(--foreground)]">Deep work guide</Link></li>
                  <li><Link href="/body-doubling" className="hover:text-[var(--foreground)]">Body doubling</Link></li>
                  <li><Link href="/exam" className="hover:text-[var(--foreground)]">Exam prep</Link></li>
                </ul>
              </div>
              <div>
                <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--foreground-muted)]">Compare</p>
                <ul className="space-y-2 text-[var(--foreground-subtle)]">
                  <li><Link href="/comparison/focusarx-vs-forest" className="hover:text-[var(--foreground)]">vs Forest</Link></li>
                  <li><Link href="/comparison/focusarx-vs-focusmate" className="hover:text-[var(--foreground)]">vs Focusmate</Link></li>
                  <li><Link href="/comparison/focusarx-vs-pomofocus" className="hover:text-[var(--foreground)]">vs Pomofocus</Link></li>
                  <li><Link href="/comparison/focusarx-vs-freedom" className="hover:text-[var(--foreground)]">vs Freedom</Link></li>
                  <li><Link href="/comparison/focusarx-vs-stayfocusd" className="hover:text-[var(--foreground)]">vs StayFocusd</Link></li>
                </ul>
              </div>
              <div>
                <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--foreground-muted)]">Company &amp; trust</p>
                <ul className="space-y-2 text-[var(--foreground-subtle)]">
                  <li><Link href="/about" className="hover:text-[var(--foreground)]">About</Link></li>
                  <li><Link href="/evidence" className="hover:text-[var(--foreground)]">Evidence &amp; claims</Link></li>
                  <li><Link href="/camera-data" className="hover:text-[var(--foreground)]">Camera data</Link></li>
                  <li><Link href="/safety" className="hover:text-[var(--foreground)]">Room safety</Link></li>
                  <li><Link href="/accessibility" className="hover:text-[var(--foreground)]">Accessibility</Link></li>
                  <li><Link href="/privacy" className="hover:text-[var(--foreground)]">Privacy</Link></li>
                  <li><Link href="/terms" className="hover:text-[var(--foreground)]">Terms</Link></li>
                  <li><Link href="/contact" className="hover:text-[var(--foreground)]">Contact</Link></li>
                  <li><Link href="/press" className="hover:text-[var(--foreground)]">Press</Link></li>
                </ul>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-6 text-xs text-[var(--foreground-subtle)] sm:flex-row sm:items-center sm:justify-between">
              <p>© 2026 FocusArx. Built for deliberate work.</p>
              <div className="flex flex-wrap gap-4">
                <Link href="/cookie-policy">Cookies</Link>
                <Link href="/acceptable-use">Acceptable use</Link>
                <Link href="/ai-policy">AI policy</Link>
                <Link href="/data-deletion">Data deletion</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
