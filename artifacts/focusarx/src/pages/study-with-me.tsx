import { Link } from "wouter";
import { ArrowRight, Users, Timer, Globe, Flame, ListChecks, CheckCircle, Video } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

function Section({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) {
  return <section id={id} className={`mx-auto max-w-3xl px-4 sm:px-6 ${className}`}>{children}</section>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-14 mb-4 text-2xl font-black leading-tight text-[var(--foreground)] sm:text-3xl">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-8 mb-3 text-xl font-bold text-[var(--foreground)]">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-[15px] leading-relaxed text-[var(--foreground-muted)]">{children}</p>;
}
function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-5">
      <p className="mb-2 font-semibold text-[var(--foreground)]">{q}</p>
      <p className="text-sm leading-relaxed text-[var(--palette-6b7280)]">{a}</p>
    </div>
  );
}

const FAQS = [
  {
    q: "What does 'study with me' mean?",
    a: "A study-with-me session is focused work done alongside at least one other person — in the same room, on a video call, or in a virtual study room. Nobody teaches or talks; you simply work in parallel, often with synchronized Pomodoro timers. The quiet presence of others makes starting and continuing easier.",
  },
  {
    q: "Does studying with others actually help?",
    a: "For most people, yes. Social presence creates mild, useful accountability (you're less likely to open social media when others can 'see' you working), and structured co-working applies the body-doubling effect that's especially powerful for people with ADHD. The key is silent, focused companions — not chatty study groups.",
  },
  {
    q: "Are study-with-me rooms free on FocusArx?",
    a: "Yes. FocusArx's virtual study rooms are free to join, run 24/7, and sync Pomodoro timers across everyone in the room. You can join a public room or create a private one for your friends — no credit card or subscription required.",
  },
  {
    q: "Should my camera be on in a study room?",
    a: "Only if you want it on. FocusArx works fully camera-optional — presence in the room is what matters. If you do enable a camera, FocusArx's optional attention monitoring processes everything locally in your browser; no video is ever uploaded.",
  },
  {
    q: "How long should a study-with-me session be?",
    a: "Most rooms run synchronized Pomodoro cycles: 25 minutes of silent work, a 5-minute break, repeated — with a longer break every fourth cycle. If you're building up from zero, start with two cycles and add one per week.",
  },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Study With Me: Why Live Virtual Study Sessions Work (and How to Start)",
  "description": "How study-with-me sessions and virtual study rooms use the body-doubling effect and synchronized Pomodoro timers to make focusing easier — plus how to join free 24/7 rooms.",
  "author": { "@type": "Organization", "name": "FocusArx" },
  "publisher": { "@type": "Organization", "name": "FocusArx", "logo": { "@type": "ImageObject", "url": "https://www.focusarx.site/logo.png" } },
  "dateModified": "2026-08-24",
  "mainEntityOfPage": "https://www.focusarx.site/study-with-me",
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

export default function StudyWithMePage() {
  return (
    <div className="min-h-screen bg-[var(--rgba-255-255-255-0_02)] text-[var(--foreground)]">
      <PageSEO {...PAGE_SEO.studyWithMe} structuredData={[articleSchema, faqSchema]} />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[var(--rgba-255-255-255-0_06)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,_var(--rgba-124-58-237-0_18),_transparent_70%)]" />
        <Section className="relative py-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--brand-600)]/30 bg-[var(--brand-600)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--brand-400)]">
            <Users size={12} /> Free Guide · Updated 2026
          </div>
          <h1 className="mb-4 text-3xl font-black leading-tight text-[var(--foreground)] sm:text-5xl">
            Study With Me:
            <br />
            <span className="bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)] bg-clip-text text-transparent">Why Focusing Together Works</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-[var(--foreground-muted)] sm:text-lg">
            Millions of students now study alongside strangers online. It's not a trend gimmick — it's the easiest accountability system ever discovered.
          </p>
        </Section>
      </div>

      <Section className="py-8">
        <nav aria-label="Table of contents" className="rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-124-58-237-0_04)] p-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--brand-400)]"><ListChecks size={14} /> In this guide</p>
          <ol className="grid gap-x-6 gap-y-2 text-sm text-[var(--foreground-muted)] sm:grid-cols-2">
            {[["#body-doubling", "1. The body-doubling effect"], ["#why-it-works", "2. Four reasons it works"], ["#etiquette", "3. Session etiquette"], ["#start", "4. How to start today"], ["#faq", "5. FAQ"]].map(([href, label]) => (
              <li key={href}><a href={href} className="transition-colors hover:text-[var(--brand-400)]">{label}</a></li>
            ))}
          </ol>
        </nav>
      </Section>

      <Section id="body-doubling">
        <H2>The body-doubling effect</H2>
        <P>
          <strong className="text-[var(--foreground)]">Body doubling</strong> is doing a task in the presence of another person. No help, no teaching, no conversation — just parallel work. The effect was first widely reported in ADHD communities, where people noticed they could finally tackle boring tasks simply because someone else was in the room. Productivity researchers describe it as a form of <em>social facilitation</em>: being observed (even passively) improves performance on well-practiced tasks and suppresses the impulse to drift away.
        </P>
        <P>
          The mechanism is simple. Most focus failures are <em>quiet</em> — you open your phone and nobody knows, including (thanks to rationalization) future you. In a shared session, drift becomes visible. Not because anyone calls you out, but because you know the room is working, and that knowledge is enough. The result for most people: sessions start on time, run longer, and end with something actually finished.
        </P>
      </Section>

      <Section id="why-it-works">
        <H2>Four reasons study-with-me sessions work</H2>
        <H3><span className="flex items-center gap-2"><CheckCircle size={18} className="text-[var(--brand-400)]" /> 1. Starting stops being a solo battle</span></H3>
        <P>Task initiation is the hardest step — see our guide on <Link href="/stop-procrastinating" className="text-[var(--brand-400)] hover:underline">how to stop procrastinating</Link>. A session that starts at a fixed time with other people in it removes the negotiation entirely. You don't decide to start; the room starts.</P>
        <H3><span className="flex items-center gap-2"><Timer size={18} className="text-[var(--brand-400)]" /> 2. Synchronized timers create rhythm</span></H3>
        <P>Rooms that run shared <Link href="/pomodoro-guide" className="text-[var(--brand-400)] hover:underline">Pomodoro cycles</Link> — 25 on, 5 off — give your session structure you didn't have to invent. Breaks happen because the room takes them, which also prevents the other failure mode: skipping breaks until you burn out at minute 70.</P>
        <H3><span className="flex items-center gap-2"><Flame size={18} className="text-[var(--brand-400)]" /> 3. Streaks become social</span></H3>
        <P>When your session count and streak are visible to a room or friends, consistency acquires a social layer. Missing a day feels different when your study buddy notices — and celebrating a 30-day streak together is far stickier than a private checkbox.</P>
        <H3><span className="flex items-center gap-2"><Globe size={18} className="text-[var(--brand-400)]" /> 4. Any hour, someone's awake</span></H3>
        <P>Late-night crammers and early risers both benefit from 24/7 rooms. Whatever your schedule or timezone, there's a desk with a light on — useful for students in far-flung time zones and anyone who focuses better at odd hours.</P>
      </Section>

      <Section id="etiquette">
        <H2>Study-with-me etiquette (the short version)</H2>
        <div className="my-6 space-y-3 rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-6">
          {[
            ["Silence is the feature", "No talking in work cycles — use the chat or wait for a break. If you need to speak, step out of the room."],
            ["Camera optional", "Presence matters, video doesn't. Join with or without your camera; nobody should pressure you either way."],
            ["Respect the timer", "Don't derail the room's shared Pomodoro rhythm. If you want a different structure, start your own room."],
            ["Bring real work", "The room works when everyone is genuinely working. Pick your task before you join, not after."],
          ].map(([t, d]) => (
            <div key={t} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
              <span className="w-40 shrink-0 font-bold text-[var(--brand-400)]">{t}</span>
              <span className="text-sm leading-relaxed text-[var(--foreground-muted)]">{d}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="start">
        <H2>How to start today</H2>
        <P>
          The simplest version: pick the task you've been avoiding, open a <Link href="/virtual-study-room" className="text-[var(--brand-400)] hover:underline">virtual study room</Link>, and do one synchronized 25-minute cycle. That's it. If you want a template for longer sessions, our <Link href="/two-hour-study-method" className="text-[var(--brand-400)] hover:underline">2-hour study method</Link> shows how to stack cycles into a complete deep-study block.
        </P>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--palette-white)]/10 bg-[var(--palette-white)]/5 text-[var(--palette-pink-400)]"><Video size={16} /></div>
            <p className="mb-1 font-bold text-[var(--foreground)]">Live rooms, 24/7</p>
            <p className="text-sm leading-relaxed text-[var(--palette-6b7280)]">Join public FocusArx study rooms any hour — synced Pomodoro timers, live presence, zero scheduling.</p>
          </div>
          <div className="rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--palette-white)]/10 bg-[var(--palette-white)]/5 text-[var(--palette-purple-400)]"><Users size={16} /></div>
            <p className="mb-1 font-bold text-[var(--foreground)]">Private rooms for your group</p>
            <p className="text-sm leading-relaxed text-[var(--palette-6b7280)]">Create a room, share the link with classmates, and keep your own cohort's streak alive.</p>
          </div>
        </div>
        <div className="mt-8 rounded-2xl border border-[var(--brand-600)]/30 bg-gradient-to-br from-[var(--brand-600)]/10 to-transparent p-8 text-center">
          <h3 className="mb-2 text-xl font-black text-[var(--foreground)]">Pull up a chair</h3>
          <p className="mb-6 text-sm text-[var(--foreground-muted)]">Free forever. Join a live study room in under a minute and run your first cycle with us.</p>
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brand-600)] to-[var(--palette-4f46e5)] px-6 py-3 text-sm font-bold text-[var(--palette-white)] transition-all hover:brightness-110">
            Join a study room free <ArrowRight size={16} />
          </Link>
        </div>
      </Section>

      <Section id="faq" className="pb-20">
        <H2>Frequently asked questions</H2>
        <div className="space-y-4">
          {FAQS.map((f) => <FAQ key={f.q} {...f} />)}
        </div>
        <p className="mt-10 text-sm text-[var(--palette-6b7280)]">
          More in the <Link href="/guides" className="text-[var(--brand-400)] hover:underline">FocusArx guide library</Link> — including <Link href="/adhd-focus-tips" className="text-[var(--brand-400)] hover:underline">focusing with ADHD</Link> and <Link href="/focus-music" className="text-[var(--brand-400)] hover:underline">what to listen to while you work</Link>.
        </p>
      </Section>
    </div>
  );
}
