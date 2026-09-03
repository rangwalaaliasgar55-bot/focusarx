import { Link } from "wouter";
import { ArrowRight, Music, ListChecks, Volume2, Headphones, Brain, Ban, Wind } from "lucide-react";
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
    q: "Is listening to music while studying bad?",
    a: "It depends on the task and the music. For memorization and reading comprehension, music with lyrics reliably costs performance for most people. For repetitive, well-practiced, or design/build work, moderate background music often helps by elevating mood and masking distracting noise. Test both on your own work and keep score.",
  },
  {
    q: "Does lo-fi actually help you focus?",
    a: "Lo-fi's real superpower is blandness: no lyrics, no big dynamic shifts, no surprises — it occupies the part of your brain that craves stimulation without demanding attention. Research on 'irrelevant sound' suggests steady, unchanging sound is among the least disruptive backgrounds, which matches millions of students' experience with lo-fi streams.",
  },
  {
    q: "Do binaural beats improve concentration?",
    a: "Evidence is mixed and effects, where found, are small. Binaural beats (slightly different tones in each ear) are harmless and some people enjoy the resulting tone, but treat claims about 'rewiring your brainwaves' with skepticism. If it feels good and keeps you at the desk, use it; if not, silence works too.",
  },
  {
    q: "What about white, pink, or brown noise?",
    a: "Steady noise colors are good at masking unpredictable environmental sound (chatty roommates, cafés). Some small studies suggest moderate background noise can even improve performance for people with ADHD. Brown noise (deeper, softer than white) is the most popular for focus because it's less fatiguing over long sessions.",
  },
  {
    q: "Is silence better for deep work?",
    a: "For maximal cognitive performance on hard tasks, silence usually wins — most studies find any background sound costs a little. The practical caveat: silence in a noisy environment isn't achievable, and a predictable soundtrack you forget you're wearing beats unpredictable interruptions. Choose your battles.",
  },
  {
    q: "How do I build a focus playlist that actually works?",
    a: "Keep four rules: no lyrics (or lyrics in a language you don't speak), steady volume and tempo, 30+ minutes queued so you never break flow to pick the next song, and the same playlist every session — the playlist itself becomes a focus trigger that tells your brain it's work time.",
  },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "The Science of Focus Music: What to Listen to While You Work",
  "description": "What research actually says about study music — lyrics, lo-fi, binaural beats, noise colors, and silence — plus how to build a focus playlist that becomes a concentration trigger.",
  "author": { "@type": "Organization", "name": "FocusArx" },
  "publisher": { "@type": "Organization", "name": "FocusArx", "logo": { "@type": "ImageObject", "url": "https://focusarx.site/logo.png" } },
  "dateModified": "2026-08-24",
  "mainEntityOfPage": "https://focusarx.site/focus-music",
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

export default function FocusMusicPage() {
  return (
    <div className="min-h-screen bg-[var(--rgba-255-255-255-0_02)] text-[var(--foreground)]">
      <PageSEO {...PAGE_SEO.focusMusic} structuredData={[articleSchema, faqSchema]} />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[var(--rgba-255-255-255-0_06)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,_var(--rgba-124-58-237-0_18),_transparent_70%)]" />
        <Section className="relative py-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--brand-600)]/30 bg-[var(--brand-600)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--brand-400)]">
            <Music size={12} /> Free Guide · Updated 2026
          </div>
          <h1 className="mb-4 text-3xl font-black leading-tight text-[var(--foreground)] sm:text-5xl">
            Focus Music:
            <br />
            <span className="bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)] bg-clip-text text-transparent">What Science Actually Says</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-[var(--foreground-muted)] sm:text-lg">
            "Study music" is a billion-stream genre — but does it help? Here's the honest research verdict, and how to use sound to go deeper.
          </p>
        </Section>
      </div>

      <Section className="py-8">
        <nav aria-label="Table of contents" className="rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-124-58-237-0_04)] p-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--brand-400)]"><ListChecks size={14} /> In this guide</p>
          <ol className="grid gap-x-6 gap-y-2 text-sm text-[var(--foreground-muted)] sm:grid-cols-2">
            {[["#verdict", "1. The honest verdict"], ["#options", "2. Your sound options, ranked"], ["#playlist", "3. Building the playlist"], ["#protocol", "4. A sound protocol for deep work"], ["#faq", "5. FAQ"]].map(([href, label]) => (
              <li key={href}><a href={href} className="transition-colors hover:text-[var(--brand-400)]">{label}</a></li>
            ))}
          </ol>
        </nav>
      </Section>

      <Section id="verdict">
        <H2>The honest verdict on study music</H2>
        <P>
          The research, summarized in one paragraph: <strong className="text-[var(--foreground)]">for hard cognitive work, silence usually wins; for everything else, the right background sound beats a noisy environment — and sometimes beats silence.</strong> Music's biggest proven effect isn't on attention directly — it's on <em>mood and arousal</em>. A track that makes a boring task slightly more pleasant keeps you at the desk longer, and time-at-desk is the raw material of everything else.
        </P>
        <P>
          The biggest cost is <strong className="text-[var(--foreground)]">lyrics</strong>. Language centers in your brain process speech and reading with the same hardware, so songs with words measurably interfere with reading comprehension, writing, and memorization. Instrumental music shows much smaller — sometimes negligible — costs, and steady noise (lo-fi, brown noise) is gentler still. This mirrors the broader <Link href="/focus-guide" className="text-[var(--brand-400)] hover:underline">science of attention</Link>: every sound that changes unexpectedly steals focus; every sound that stays predictable fades into the background.
        </P>
        <P>
          One more effect worth knowing: <strong className="text-[var(--foreground)]">the same music, used consistently, becomes a focus trigger.</strong> Pair one playlist exclusively with work sessions and your brain learns the association — the opening bars start shutting out the world. Athletes call it a pre-performance routine; you can build one out of sound.
        </P>
      </Section>

      <Section id="options">
        <H2>Your sound options, ranked</H2>
        <div className="my-6 space-y-3">
          {[
            { icon: <Ban size={16} />, rank: "Best for hardest work", label: "Silence (or earplugs)", blurb: "Maximum cognitive performance for reading, writing, memorizing. If your environment allows it, this is the ceiling." },
            { icon: <Volume2 size={16} />, rank: "Best for noisy spaces", label: "Brown / pink noise", blurb: "Masks unpredictable environmental sound with a steady wall. Deeper and less fatigating than white noise over long sessions." },
            { icon: <Headphones size={16} />, rank: "Best compromise", label: "Lo-fi & ambient", blurb: "No lyrics, no dynamic surprises, endless streams. Occupies your craving-for-stimulation without demanding attention." },
            { icon: <Music size={16} />, rank: "Use carefully", label: "Classical / instrumental", blurb: "Works for many, but watch for dynamic swings and emotionally gripping passages — they pull attention." },
            { icon: <Brain size={16} />, rank: "Mixed evidence", label: "Binaural beats", blurb: "Harmless; small effects at best in current research. Fine if you enjoy the tone — just don't expect miracles." },
            { icon: <Ban size={16} />, rank: "Avoid during study", label: "Music with lyrics", blurb: "Reliably interferes with reading, writing, and memorization. Save songs with words for breaks and workouts." },
          ].map((o) => (
            <div key={o.label} className="rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-5">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-[var(--brand-400)]">{o.icon}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--palette-6b7280)]">{o.rank}</span>
              </div>
              <p className="font-bold text-[var(--foreground)]">{o.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--palette-6b7280)]">{o.blurb}</p>
            </div>
          ))}
        </div>
        <P>
          People with ADHD often sit at a different starting line: for some, moderate background sound (noise, familiar instrumental loops) genuinely improves regulation — see our <Link href="/adhd-focus-tips" className="text-[var(--brand-400)] hover:underline">ADHD focus guide</Link>. Experiment; your data beats the averages.
        </P>
      </Section>

      <Section id="playlist">
        <H2>Building a playlist that becomes a focus trigger</H2>
        <div className="my-6 space-y-3 rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-6">
          {[
            ["1. No words", "Instrumental only — or lyrics in a language you don't speak. Your language centers need to be free."],
            ["2. Flat dynamics", "Steady tempo and volume across the whole queue. You want a floor, not a rollercoaster."],
            ["3. 30+ minutes, pre-queued", "Never break flow mid-session to pick the next track. Autoplay from a full queue."],
            ["4. Same playlist, every session", "Consistency builds the trigger effect — opening track becomes the dinner bell for deep work."],
            ["5. Volume as a dimmer, not a blaster", "Loud enough to mask the room, quiet enough to forget. If you're nodding along, turn it down."],
          ].map(([t, d]) => (
            <div key={t} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
              <span className="w-44 shrink-0 font-bold text-[var(--brand-400)]">{t}</span>
              <span className="text-sm leading-relaxed text-[var(--foreground-muted)]">{d}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="protocol">
        <H2>A sound protocol for deep-work sessions</H2>
        <P>
          Put it all together with a <Link href="/pomodoro-guide" className="text-[var(--brand-400)] hover:underline">Pomodoro-style session</Link>: press play on your focus playlist <em>before</em> the timer starts (the sound cues "work mode"), keep it running through the work interval, and kill it during breaks — silence or a <Link href="/breathe" className="text-[var(--brand-400)] hover:underline">two-minute breathing reset</Link> — so the contrast between work and rest stays sharp. Over a couple of weeks, the playlist does half the focusing for you: it's the cue that tells your nervous system it's time to go deep. For structuring the sessions themselves, see the <Link href="/two-hour-study-method" className="text-[var(--brand-400)] hover:underline">2-hour study method</Link>.
        </P>
        <div className="mt-8 rounded-2xl border border-[var(--brand-600)]/30 bg-gradient-to-br from-[var(--brand-600)]/10 to-transparent p-8 text-center">
          <h3 className="mb-2 text-xl font-black text-[var(--foreground)]">Press play, start the timer</h3>
          <p className="mb-6 text-sm text-[var(--foreground-muted)]">FocusArx pairs your sessions with streaks, scores, and an AI coach. Free forever.</p>
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brand-600)] to-[var(--palette-4f46e5)] px-6 py-3 text-sm font-bold text-[var(--palette-white)] transition-all hover:brightness-110">
            Start focusing free <ArrowRight size={16} />
          </Link>
        </div>
      </Section>

      <Section id="faq" className="pb-20">
        <H2>Frequently asked questions</H2>
        <div className="space-y-4">
          {FAQS.map((f) => <FAQ key={f.q} {...f} />)}
        </div>
        <p className="mt-10 flex items-center gap-2 text-sm text-[var(--palette-6b7280)]">
          <Wind size={14} /> More free guides in the <Link href="/guides" className="text-[var(--brand-400)] hover:underline">FocusArx library</Link>.
        </p>
      </Section>
    </div>
  );
}
