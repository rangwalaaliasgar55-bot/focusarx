import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Layers3,
  Library,
  Lock,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  Sparkles,
  Target,
  Timer,
  Users,
  X,
  Zap,
} from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { Reveal, RevealStagger, RevealItem, ScrollScale, HeroScrub, Parallax } from "@/components/motion/Scroll";
import { AdSlot } from "@/components/AdSlot";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import FocusingNow from "@/components/FocusingNow";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const Hero3D = lazy(() => import("@/components/Hero3D"));

const FEATURES = [
  { icon: Timer, title: "A timer that protects the work", description: "Move from Pomodoro to deep-work blocks without losing session history, tasks, or your place." },
  { icon: CheckCircle2, title: "Tasks stay in the same flow", description: "Capture a task, complete it optimistically, and keep every FocusArx view in sync." },
  { icon: Brain, title: "Coaching grounded in your patterns", description: "Turn real session history into practical next steps instead of generic productivity advice." },
  { icon: Library, title: "Study without the clutter", description: "Build decks, review with Leitner scheduling, and enter a focused full-screen study rhythm." },
  { icon: Users, title: "Accountability when you want it", description: "Join study rooms and community spaces without turning focus into a noisy social feed." },
  { icon: ShieldCheck, title: "Privacy built into focus mode", description: "When camera support is enabled, vision processing runs on-device and stays separate from wellness tools." },
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="FocusArx home">
      <span className="brand-mark"><Zap size={17} fill="currentColor" /></span>
      <span className="text-sm font-semibold tracking-tight">FocusArx</span>
    </Link>
  );
}

function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  return (
    <header className="fixed inset-x-0 top-0 z-[var(--z-nav)] border-b border-[var(--border-subtle)] bg-[var(--backdrop)] backdrop-blur-2xl">
      <nav className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-4 sm:px-6" aria-label="Marketing navigation">
        <Brand />
        <div className="hidden items-center gap-7 md:flex">
          <a href="#product" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]">Product</a>
          <a href="#features" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]">Features</a>
          <Link href="/guides" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]">Study guides</Link>
          <Link href="/pricing" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]">Pricing</Link>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <Button asChild variant="ghost"><Link href="/login">Sign in</Link></Button>
          <Button asChild><Link href="/signup">Start focusing <ArrowRight /></Link></Button>
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setOpen((current) => !current)} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X /> : <Menu />}</Button>
        </div>
      </nav>
      {open && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-4 md:hidden">
          <div className="grid gap-1">
            <a href="#product" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-lg px-3 text-sm">Product</a>
            <a href="#features" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-lg px-3 text-sm">Features</a>
            <Link href="/guides" className="flex min-h-11 items-center rounded-lg px-3 text-sm">Study guides</Link>
            <Link href="/pricing" className="flex min-h-11 items-center rounded-lg px-3 text-sm">Pricing</Link>
            <div className="mt-3 grid grid-cols-2 gap-2"><Button asChild variant="outline"><Link href="/login">Sign in</Link></Button><Button asChild><Link href="/signup">Get started</Link></Button></div>
          </div>
        </div>
      )}
    </header>
  );
}

function DashboardMockup() {
  return (
    <div className="texture-grain relative mx-auto w-full max-w-5xl overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border-strong)] bg-[var(--surface)] p-2 shadow-[var(--shadow-xl),var(--shadow-violet-md)] sm:p-3">
      <div className="flex h-10 items-center gap-1.5 border-b border-[var(--border-subtle)] px-3" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-[var(--danger)]" /><span className="h-2 w-2 rounded-full bg-[var(--warning)]" /><span className="h-2 w-2 rounded-full bg-[var(--success)]" />
        <span className="ml-3 text-[0.625rem] text-[var(--foreground-subtle)]">FocusArx · Today</span>
      </div>
      <div className="grid min-h-[28rem] md:grid-cols-[11rem_1fr]">
        <aside className="hidden border-r border-[var(--border-subtle)] p-3 md:block">
          <div className="mb-5 flex items-center gap-2 px-2"><span className="brand-mark h-7 w-7 rounded-lg"><Zap size={12} /></span><span className="text-xs font-semibold">FocusArx</span></div>
          {["Dashboard", "Tasks", "Focus", "Flashcards", "Analytics"].map((item, index) => <div key={item} className={cn("mb-1 flex min-h-9 items-center rounded-lg px-3 text-[0.6875rem] text-[var(--foreground-subtle)]", index === 0 && "bg-[var(--brand-soft)] text-[var(--brand-strong)]")}>{item}</div>)}
        </aside>
        <div className="p-3 sm:p-5">
          <div><p className="text-[0.625rem] uppercase tracking-widest text-[var(--brand-strong)]">Tuesday · Your workspace</p><p className="mt-1 text-xl font-semibold">Good morning, Alex</p><p className="mt-1 text-xs text-[var(--foreground-muted)]">One clear plan for your focus and momentum.</p></div>
          <div className="mt-5 grid gap-3 lg:grid-cols-[1.25fr_.75fr]">
            <div className="grid min-h-64 place-items-center rounded-[var(--radius-xl)] border border-[var(--card-border)] bg-[radial-gradient(circle_at_center,var(--brand-soft),transparent_66%)] p-5 text-center">
              <div><div className="relative mx-auto grid h-32 w-32 place-items-center rounded-full" style={{ background: "conic-gradient(var(--brand-500) 0deg 252deg, var(--brand-soft) 252deg 360deg)" }}><div className="absolute inset-1.5 rounded-full bg-[var(--surface)] shadow-[var(--shadow-sm)]" /><span className="relative font-mono text-3xl font-semibold tabular-nums">25:00</span></div><p className="mt-4 text-xs font-semibold">Protect the next 25 minutes.</p><span className="mt-3 inline-flex min-h-8 items-center rounded-lg bg-[var(--brand-600)] px-4 text-[0.6875rem] font-semibold text-[var(--neutral-0)]">Start focusing</span></div>
            </div>
            <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold">Next up</p><PlusMock /></div>
              <div className="mt-4 space-y-2">{["Review chapter notes", "Build biology deck", "Submit project outline"].map((task, index) => <div key={task} className="flex min-h-10 items-center gap-2 rounded-lg bg-[var(--surface-hover)] px-2"><span className={cn("h-4 w-4 rounded-full border border-[var(--border-strong)]", index === 0 && "border-[var(--success)] bg-[var(--success)]")} /> <span className="truncate text-[0.6875rem] text-[var(--foreground-muted)]">{task}</span></div>)}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">{[["Streak", "12 days"], ["XP", "2,480"], ["Tasks", "3 active"]].map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3"><p className="text-[0.5625rem] uppercase tracking-wider text-[var(--foreground-subtle)]">{label}</p><p className="mt-1 text-xs font-semibold">{value}</p></div>)}</div>
        </div>
      </div>
    </div>
  );
}

function PlusMock() { return <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--brand-soft)] text-[var(--brand-strong)]"><Check size={12} /></span>; }

function LazyAtmosphere() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current || visible) return;
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && setVisible(true), { rootMargin: "240px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);
  return (
    <div ref={ref} className="relative h-72 overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border-subtle)] bg-[var(--surface)] sm:h-96">
      {visible ? <Suspense fallback={<div className="h-full animate-pulse bg-[var(--surface-hover)] motion-reduce:animate-none" />}><Hero3D /></Suspense> : <div className="grid h-full place-items-center text-sm text-[var(--foreground-subtle)]">Visual preview loads as you scroll</div>}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-center"><Badge><Layers3 /> Focus atmosphere</Badge><p className="mx-auto mt-3 max-w-lg text-sm text-[var(--foreground-muted)]">A calm visual layer when you want immersion—lazy-loaded so it never slows down the first view.</p></div>
    </div>
  );
}

export default function LandingPage() {
  const reduceMotion = useReducedMotion();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "FocusArx",
    operatingSystem: "Web, Android, iOS",
    applicationCategory: "ProductivityApplication",
    description: "A deep-work workspace for focus sessions, tasks, flashcards, progress, and accountable study.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  const entrance = reduceMotion ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: "easeOut" as const } };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <PageSEO {...PAGE_SEO.home} structuredData={structuredData} />
      <MarketingNav />
      <main id="main-content">
        <section className="relative isolate overflow-hidden px-4 pb-20 pt-36 sm:px-6 sm:pb-28 sm:pt-44">
          {/* Retro dot-grid field, masked so it fades toward the edges. */}
          <div className="texture-dotgrid pointer-events-none absolute inset-0 -z-[var(--z-content)]" aria-hidden="true" />
          <Parallax amount={120} className="pointer-events-none absolute left-1/2 top-0 -z-[var(--z-content)] -translate-x-1/2">
            <div className="h-[44rem] w-[64rem] rounded-full bg-[radial-gradient(circle,var(--brand-soft-hover),transparent_68%)] blur-3xl" />
            <div className="glow-aurora absolute left-1/2 top-24 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full opacity-40" aria-hidden="true" />
          </Parallax>
          {/* Hero softly recedes as you scroll past — Apple-style scrub. */}
          <HeroScrub className="mx-auto max-w-5xl text-center">
            <motion.div {...entrance}>
              <Badge className="mb-6"><Sparkles /> AI-powered deep work coaching</Badge>
            </motion.div>
            <motion.h1 {...entrance} className="mx-auto max-w-4xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-7xl lg:text-[5.5rem]">
              The AI focus timer that builds<br className="hidden sm:block" /> <span className="text-[var(--brand-strong)]">real deep work habits.</span>
            </motion.h1>
            <motion.p {...entrance} className="mx-auto mt-7 max-w-2xl text-balance text-base leading-relaxed text-[var(--foreground-muted)] sm:text-xl">
              Pomodoro sessions, AI coaching, and streaks that keep you focused — free, no credit card required.
            </motion.p>
            <motion.div {...entrance} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="xl"><Link href="/signup">Start Focusing Free <ArrowRight /></Link></Button>
              <Button asChild size="xl" variant="outline"><a href="#product">See how it works <ChevronRight /></a></Button>
            </motion.div>
            <motion.p {...entrance} className="mt-3 text-xs text-[var(--foreground-subtle)]">
              No signup friction — start your first session in 10 seconds
            </motion.p>
            <motion.div {...entrance} className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-[var(--foreground-muted)]">
              <span className="inline-flex items-center gap-2"><Check size={16} className="text-[var(--success)]" /> Free forever tier</span>
              <span className="inline-flex items-center gap-2"><Lock size={15} className="text-[var(--success)]" /> Privacy-first by design</span>
              <FocusingNow />
            </motion.div>
          </HeroScrub>
        </section>

        <section id="product" className="px-4 pb-28 sm:px-6">
          {/* Product shot rises and flattens as it scrolls into view —
              scrubbed by scroll position like an Apple device reveal. */}
          <ScrollScale className="mx-auto max-w-7xl"><DashboardMockup /></ScrollScale>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────── */}
        <section className="px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-5xl text-center">
            <Reveal>
              <p className="page-eyebrow">How it works</p>
              <h2 className="text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">Three steps to focused work.</h2>
            </Reveal>
            <RevealStagger className="mt-14 grid gap-8 sm:grid-cols-3">
              {[
                { step: "1", icon: Timer, title: "Set your session", text: "Pick a task, choose your duration, and start a Pomodoro or deep-work block." },
                { step: "2", icon: Brain, title: "AI coaches you", text: "Real-time guidance adapts to your focus patterns, not generic productivity tips." },
                { step: "3", icon: Flame, title: "Build your streak", text: "Earn XP, collect coins, and watch your focus streak grow every day you show up." },
              ].map(({ step, icon: Icon, title, text }) => (
                <RevealItem key={step} className="relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-8 text-center transition-[border-color,box-shadow] duration-[var(--duration-normal)] hover:border-[var(--card-border)] hover:shadow-[var(--shadow-md)]">
                  <span className="absolute -top-4 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full bg-[var(--brand-600)] text-xs font-bold text-[var(--neutral-0)]">{step}</span>
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)]"><Icon size={24} /></span>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{text}</p>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </section>

        {/* ── AI COACHING DIFFERENTIATOR ────────────────────────── */}
        <section className="border-y border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
            <Reveal>
              <p className="page-eyebrow">Why AI coaching beats a plain timer</p>
              <h2 className="text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">Forest grows trees. FocusArx grows <span className="text-[var(--brand-strong)]">your focus.</span></h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--foreground-muted)]">Most focus timers count down. FocusArx analyzes your session history, identifies your peak hours, and coaches you toward better habits — not just longer sessions.</p>
              <div className="mt-8 space-y-5">
                {[
                  { icon: Brain, title: "Personalized insights", text: "AI learns your patterns and suggests the optimal session length, time of day, and break schedule." },
                  { icon: BarChart3, title: "Focus analytics", text: "See your focus quality over time — not just minutes logged, but how effectively you used them." },
                  { icon: Sparkles, title: "Coached sessions", text: "Get real-time nudges during sessions based on your historical drop-off points." },
                ].map(({ icon: Icon, title, text }) => (
                  <div key={title} className="flex gap-4">
                    <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-raised)] text-[var(--brand-strong)]"><Icon size={18} /></span>
                    <div>
                      <h3 className="text-sm font-semibold">{title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-8">
              <div className="grid gap-4">
                {[
                  { label: "Sessions with AI coaching", value: "92% completion rate", color: "var(--success)" },
                  { label: "Sessions without coaching", value: "67% completion rate", color: "var(--foreground-muted)" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
                    <p className="text-xs text-[var(--foreground-subtle)]">{label}</p>
                    <p className="mt-1 text-lg font-bold" style={{ color }}>{value}</p>
                  </div>
                ))}
                {/* Substantiated claim. Previously read "Based on FocusArx
                    user data — 50,000+ sessions analyzed", which had no
                    definition, period or sample anyone could check. The
                    definition and review date are now inline, and the
                    underlying figure is tracked on the public claim ledger. */}
                <p className="text-center text-[10px] leading-relaxed text-[var(--foreground-subtle)]">
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
        </section>

        {/* ── FEATURES GRID ─────────────────────────────────────── */}
        <section id="features" className="px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-7xl">
            <Reveal className="max-w-2xl">
              <p className="page-eyebrow">Everything you need</p>
              <h2 className="text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">A complete focus loop.</h2>
              <p className="mt-5 text-base leading-relaxed text-[var(--foreground-muted)]">FocusArx keeps planning, doing, reviewing, and learning in one visual language.</p>
            </Reveal>
            <RevealStagger className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border-subtle)] bg-[var(--border-subtle)] md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <RevealItem key={title} className="group bg-[var(--surface)] p-6 transition-colors duration-[var(--duration-normal)] hover:bg-[var(--surface-raised)] sm:p-8">
                  <span className="grid h-11 w-11 place-items-center rounded-[var(--radius-lg)] bg-[var(--brand-soft)] text-[var(--brand-strong)] transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] group-hover:scale-105 motion-reduce:group-hover:scale-100"><Icon size={20} /></span>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{description}</p>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </section>

        <section className="px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
            <Reveal>
              <p className="page-eyebrow">Designed for the next action</p>
              <h2 className="text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">Your momentum, visible at a glance.</h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--foreground-muted)]">Today&apos;s Pulse connects streak, XP, active work, and session quality without turning your dashboard into a scoreboard.</p>
              <div className="mt-8 space-y-5">
                {[{ icon: Flame, title: "Streaks that encourage, not punish", text: "See consistency in context and return without shame after a missed day." }, { icon: Target, title: "Tasks beside the timer", text: "Keep the current priority close enough to act on, never close enough to distract." }, { icon: BarChart3, title: "Review patterns, not vanity metrics", text: "Use session history and focus quality to make tomorrow's plan more realistic." }].map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4"><span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-raised)] text-[var(--brand-strong)]"><Icon size={18} /></span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">{text}</p></div></div>)}
              </div>
            </Reveal>
            <Reveal delay={0.1}><LazyAtmosphere /></Reveal>
          </div>
        </section>

        {/* ── AD SLOT: mid-landing ─────────────────────────────────
            Placed between two full-height content sections, far from any
            CTA, so it satisfies AdSense's accidental-click policy. */}
        <section className="px-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <AdSlot name="landingMid" />
          </div>
        </section>

        {/* ── COMPARISON TEASER ─────────────────────────────────── */}
        <section className="border-y border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-5xl text-center">
            <Reveal>
              <p className="page-eyebrow">See how we compare</p>
              <h2 className="text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">FocusArx vs Forest, Focusmate & Pomofocus.</h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--foreground-muted)]">We break down what each app does best — and where FocusArx goes further with AI coaching, analytics, and gamification.</p>
            </Reveal>
            <RevealStagger className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {[
                { name: "Forest", note: "Tree-planting gamification", href: "/comparison/focusarx-vs-forest" },
                { name: "Focusmate", note: "1-on-1 video coworking", href: "/comparison/focusarx-vs-focusmate" },
                { name: "Pomofocus", note: "Minimal web Pomodoro timer", href: "/comparison/focusarx-vs-pomofocus" },
              ].map(({ name, note, href }) => (
                <RevealItem key={name}>
                  <Link href={href} className="block rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-5 py-3 text-left transition-[border-color,box-shadow] duration-[var(--duration-fast)] hover:border-[var(--card-border)] hover:shadow-[var(--shadow-xs)]">
                    <p className="text-sm font-semibold">FocusArx vs {name}</p>
                    <p className="text-xs text-[var(--foreground-subtle)]">{note}</p>
                  </Link>
                </RevealItem>
              ))}
            </RevealStagger>
            <Button asChild variant="outline" className="mt-8"><Link href="/comparison/focusarx-vs-forest">See full comparison <ChevronRight /></Link></Button>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────────── */}
        <section className="px-4 pb-24 sm:px-6 sm:pb-32">
          <Reveal className="texture-grain mx-auto max-w-5xl overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--card-border)] bg-[radial-gradient(circle_at_50%_0%,var(--brand-soft-hover),transparent_65%)] px-6 py-16 text-center shadow-[var(--shadow-violet-md)] sm:px-12 sm:py-20">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-[var(--radius-lg)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"><Clock3 /></span>
            <h2 className="mx-auto mt-6 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Your next focused hour starts now.</h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-[var(--foreground-muted)]">Create a free account, choose one task, and begin with a single focus block. No credit card required.</p>
            <Button asChild size="xl" className="mt-8"><Link href="/signup">Start Focusing Free <ArrowRight /></Link></Button>
            <p className="mt-4 text-xs text-[var(--foreground-subtle)]">Free forever — Premium activated with coins you earn by focusing</p>
          </Reveal>
        </section>

        {/* ── AD SLOT: above the footer ─────────────────────────── */}
        <section className="px-4 pb-16 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <AdSlot name="landingFooter" />
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border-subtle)] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2"><Brand /><p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--foreground-muted)]">A calm operating system for focused work, deliberate study, and sustainable momentum.</p></div>
            {[{ title: "Product", links: [["Dashboard", "/dashboard"], ["Virtual study rooms", "/virtual-study-room"], ["Live study rooms", "/study-rooms"], ["Flashcards", "/flashcards"], ["Pricing", "/pricing"]] }, { title: "Learn", links: [["All guides", "/guides"], ["Focus guide", "/focus-guide"], ["Pomodoro guide", "/pomodoro-guide"], ["ADHD focus tips", "/adhd-focus-tips"], ["Stop procrastinating", "/stop-procrastinating"], ["Focus music", "/focus-music"]] }, { title: "Company", links: [["About", "/about"], ["Contact", "/contact"], ["Support", "/support"]] }].map((group) => <div key={group.title}><h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">{group.title}</h2><ul className="mt-4 space-y-3">{group.links.map(([label, href]) => <li key={href}><Link href={href} className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]">{label}</Link></li>)}</ul></div>)}
          </div>
          {/* Footer. Real crawlable <a>/<Link> elements — not buttons with
              click handlers — because a crawler that does not execute
              JavaScript discovers the site through this block. Every page
              here is in the sitemap. */}
          <div className="mt-12 border-t border-[var(--border-subtle)] pt-8">
            <div className="grid gap-8 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="mb-3 font-bold uppercase tracking-widest text-[var(--foreground-muted)]">Tools</p>
                <ul className="space-y-2 text-[var(--foreground-subtle)]">
                  <li><Link href="/pomodoro-timer" className="hover:text-[var(--foreground)]">Pomodoro timer</Link></li>
                  <li><Link href="/focus-timer" className="hover:text-[var(--foreground)]">Focus timer</Link></li>
                  <li><Link href="/study-timer" className="hover:text-[var(--foreground)]">Study timer</Link></li>
                  <li><Link href="/study-calculator" className="hover:text-[var(--foreground)]">Study time calculator</Link></li>
                  <li><Link href="/break-free" className="hover:text-[var(--foreground)]">60-second scroll reset</Link></li>
                </ul>
              </div>
              <div>
                <p className="mb-3 font-bold uppercase tracking-widest text-[var(--foreground-muted)]">Guides</p>
                <ul className="space-y-2 text-[var(--foreground-subtle)]">
                  <li><Link href="/guides" className="hover:text-[var(--foreground)]">All guides</Link></li>
                  <li><Link href="/focus-guide" className="hover:text-[var(--foreground)]">How to focus</Link></li>
                  <li><Link href="/deep-work-guide" className="hover:text-[var(--foreground)]">Deep work guide</Link></li>
                  <li><Link href="/body-doubling" className="hover:text-[var(--foreground)]">Body doubling</Link></li>
                  <li><Link href="/exam" className="hover:text-[var(--foreground)]">Exam prep</Link></li>
                </ul>
              </div>
              <div>
                <p className="mb-3 font-bold uppercase tracking-widest text-[var(--foreground-muted)]">Compare</p>
                <ul className="space-y-2 text-[var(--foreground-subtle)]">
                  <li><Link href="/comparison/focusarx-vs-forest" className="hover:text-[var(--foreground)]">vs Forest</Link></li>
                  <li><Link href="/comparison/focusarx-vs-focusmate" className="hover:text-[var(--foreground)]">vs Focusmate</Link></li>
                  <li><Link href="/comparison/focusarx-vs-pomofocus" className="hover:text-[var(--foreground)]">vs Pomofocus</Link></li>
                  <li><Link href="/comparison/focusarx-vs-freedom" className="hover:text-[var(--foreground)]">vs Freedom</Link></li>
                  <li><Link href="/comparison/focusarx-vs-stayfocusd" className="hover:text-[var(--foreground)]">vs StayFocusd</Link></li>
                </ul>
              </div>
              <div>
                <p className="mb-3 font-bold uppercase tracking-widest text-[var(--foreground-muted)]">Company &amp; trust</p>
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
