import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Atom,
  BookOpen,
  Code2,
  GraduationCap,
  HeartPulse,
  Landmark,
  Languages,
  Radio,
  ShieldCheck,
  Timer,
  Users,
  Video,
} from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/useReducedMotion";

async function fetchPublicRooms() {
  const res = await fetch("/api/study-rooms");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/* One icon system (lucide), one stroke weight, consistent soft tiles. */
const FEATURED_CATEGORIES = [
  { icon: Atom, name: "JEE / Engineering", desc: "Mathematics, Physics, Chemistry — IIT-JEE prep" },
  { icon: HeartPulse, name: "NEET / Medical", desc: "Biology, Organic Chemistry — NEET aspirants" },
  { icon: Landmark, name: "UPSC / Civil Services", desc: "General Studies, Current Affairs, Essay" },
  { icon: Code2, name: "Coding & CS", desc: "DSA, Web Dev, Competitive Programming" },
  { icon: BookOpen, name: "General Study", desc: "All subjects — open for everyone" },
  { icon: Languages, name: "Language Learning", desc: "English, Spanish, French, Japanese" },
];

const HOW_IT_WORKS = [
  {
    icon: Radio,
    title: "Pick a live room",
    text: "Browse public rooms by subject, see who's focusing right now, and join in one click — no download, it runs in your browser.",
  },
  {
    icon: Timer,
    title: "Focus on a shared timer",
    text: "Every room runs a synchronized Pomodoro timer. Everyone focuses together and breaks together, which makes drifting off much harder.",
  },
  {
    icon: Users,
    title: "Stay accountable",
    text: "Live presence means people can see you're working — the quiet social pressure of body doubling, without anyone watching over your shoulder.",
  },
];

/* Visible FAQ — the same questions are emitted as FAQPage JSON-LD by the
   prerenderer (scripts/prerender-data.mjs), so structured data always
   matches what a reader can actually see on this page. */
const FAQ: Array<[string, string]> = [
  [
    "What is a virtual study room?",
    "A virtual study room is an online space where people study at the same time with a shared timer and live presence. You see that others are working, they see that you are — that mutual visibility (often called body doubling) makes it easier to start and to keep going.",
  ],
  [
    "Do I need my camera on?",
    "No. Cameras are optional and off by default in FocusArx rooms. Most people study with cameras off — presence and the shared timer do the work.",
  ],
  [
    "Is it free?",
    "Yes. Browsing rooms is free without an account, and joining rooms is free with a free account. There is no trial countdown and no credit card.",
  ],
  [
    "Who are the rooms for?",
    "Students preparing for exams (JEE, NEET, UPSC, GATE, board exams), university students, self-learners, and remote workers who focus better with company. Rooms are organized by subject so you can study alongside people working on the same thing.",
  ],
  [
    "Is it safe?",
    "Rooms are moderated, reporting is one tap away, and cameras are off by default. Read the full moderation and safety policy on our room safety page.",
  ],
];

export default function VirtualStudyRoomPage() {
  const reduceMotion = useReducedMotion();
  const { data: rooms = [] } = useQuery({
    queryKey: ["public-rooms-landing"],
    queryFn: fetchPublicRooms,
    staleTime: 60_000,
  });

  const totalStudying = rooms.reduce(
    (acc: number, r: any) => acc + (r.participantCount ?? r.activeCount ?? 0),
    0,
  );

  const reveal = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-60px" },
        transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PageSEO {...PAGE_SEO.virtualStudyRoom} />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <header className="relative isolate overflow-hidden border-b border-[var(--border-subtle)]">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[36rem] w-[56rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--brand-soft-hover),transparent_68%)] blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <motion.div {...reveal}>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--brand-soft)] px-3.5 py-1.5 text-xs font-semibold text-[var(--brand-strong)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]" />
              </span>
              {totalStudying > 0 ? `${totalStudying} people studying now` : "Rooms open 24/7"}
            </span>
          </motion.div>
          <motion.h1
            {...reveal}
            className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-6xl"
          >
            Virtual study rooms.
            <br />
            <span className="text-[var(--brand-strong)]">Study together, online.</span>
          </motion.h1>
          <motion.p
            {...reveal}
            className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-[var(--foreground-muted)] sm:text-lg"
          >
            Join a live room, keep your camera on or off, and focus in synchronized silence with
            learners around the world. Free to browse — free account to join and chat.
          </motion.p>
          <motion.div {...reveal} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="xl">
              <Link href="/study-rooms">
                <Radio /> Browse live rooms
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link href="/signup">
                Create free account <ArrowRight />
              </Link>
            </Button>
          </motion.div>
          <motion.p {...reveal} className="mt-4 text-xs text-[var(--foreground-subtle)]">
            No download. Cameras optional and off by default.
          </motion.p>
        </div>
      </header>

      <main>
        {/* ── How it works ────────────────────────────────────── */}
        <section className="px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="how-heading">
          <div className="mx-auto max-w-5xl">
            <motion.div {...reveal} className="text-center">
              <p className="page-eyebrow">How it works</p>
              <h2 id="how-heading" className="text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                Three steps from opening a tab to deep focus.
              </h2>
            </motion.div>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {HOW_IT_WORKS.map(({ icon: Icon, title, text }, i) => (
                <motion.div
                  key={title}
                  {...reveal}
                  transition={
                    reduceMotion
                      ? undefined
                      : { duration: 0.45, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] as const }
                  }
                  className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-7 transition-shadow duration-[var(--duration-normal)] hover:shadow-[var(--shadow-md)]"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-[var(--radius-lg)] bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                    <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Live rooms ──────────────────────────────────────── */}
        {rooms.length > 0 && (
          <section
            className="border-y border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-16 sm:px-6 sm:py-20"
            aria-labelledby="live-heading"
          >
            <div className="mx-auto max-w-3xl">
              <motion.div {...reveal}>
                <p className="page-eyebrow">Happening now</p>
                <h2 id="live-heading" className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                  Live rooms right now
                </h2>
                <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                  Click to preview — sign in to join and chat.
                </p>
              </motion.div>
              <div className="mt-8 space-y-3">
                {rooms.slice(0, 6).map((room: any) => (
                  <Link
                    key={room.id}
                    href="/study-rooms"
                    className="group flex min-h-[4.25rem] items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 transition-[border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[var(--card-border)] hover:shadow-[var(--shadow-sm)] motion-reduce:hover:translate-y-0"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                      <Radio size={18} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{room.name}</span>
                      {room.description && (
                        <span className="block truncate text-xs text-[var(--foreground-subtle)]">
                          {room.description}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-[var(--success)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                      {room.participantCount ?? room.activeCount ?? 0} online
                    </span>
                    <ArrowRight
                      size={15}
                      className="shrink-0 text-[var(--foreground-subtle)] transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5 group-hover:text-[var(--brand-strong)] motion-reduce:group-hover:translate-x-0"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
              {rooms.length > 6 && (
                <Button asChild variant="outline" className="mt-6 w-full">
                  <Link href="/study-rooms">
                    View all {rooms.length} rooms <ArrowRight />
                  </Link>
                </Button>
              )}
            </div>
          </section>
        )}

        {/* ── Categories ──────────────────────────────────────── */}
        <section className="px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="categories-heading">
          <div className="mx-auto max-w-5xl">
            <motion.div {...reveal} className="text-center">
              <p className="page-eyebrow">Find your people</p>
              <h2 id="categories-heading" className="text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                Rooms for every subject.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--foreground-muted)]">
                Browse by subject or create your own themed room in seconds.
              </p>
            </motion.div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURED_CATEGORIES.map(({ icon: Icon, name, desc }, i) => (
                <motion.div
                  key={name}
                  {...reveal}
                  transition={
                    reduceMotion
                      ? undefined
                      : { duration: 0.4, delay: (i % 3) * 0.06, ease: [0.16, 1, 0.3, 1] as const }
                  }
                >
                  <Link
                    href="/study-rooms"
                    className="group flex h-full items-start gap-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 transition-[border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[var(--card-border)] hover:shadow-[var(--shadow-sm)] motion-reduce:hover:translate-y-0"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--brand-soft)] text-[var(--brand-strong)] transition-transform duration-[var(--duration-fast)] group-hover:scale-105 motion-reduce:group-hover:scale-100">
                      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block font-semibold tracking-tight transition-colors group-hover:text-[var(--brand-strong)]">
                        {name}
                      </span>
                      <span className="mt-0.5 block text-sm leading-relaxed text-[var(--foreground-muted)]">
                        {desc}
                      </span>
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why it helps ────────────────────────────────────── */}
        <section
          className="border-y border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-16 sm:px-6 sm:py-24"
          aria-labelledby="why-heading"
        >
          <div className="mx-auto grid max-w-5xl items-start gap-12 lg:grid-cols-2">
            <motion.div {...reveal}>
              <p className="page-eyebrow">Why study together</p>
              <h2 id="why-heading" className="text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                Body doubling makes starting easier — and drifting rarer.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-[var(--foreground-muted)]">
                Working alongside other people, even silently and online, lowers the activation
                energy of starting and adds gentle accountability while you work. For many people —
                especially with ADHD — a live room is the difference between intending to study and
                actually studying.
              </p>
              <p className="mt-4 text-base leading-relaxed text-[var(--foreground-muted)]">
                Read more about the technique in our{" "}
                <Link href="/body-doubling" className="font-medium text-[var(--brand-strong)] underline-offset-4 hover:underline">
                  body doubling guide
                </Link>{" "}
                and{" "}
                <Link href="/study-with-me" className="font-medium text-[var(--brand-strong)] underline-offset-4 hover:underline">
                  study-with-me guide
                </Link>
                .
              </p>
            </motion.div>
            <motion.div {...reveal} className="grid gap-4">
              {[
                {
                  icon: Users,
                  title: "Quiet accountability",
                  text: "Live presence — not surveillance. Others see that you're in the room and focusing; nobody sees your screen.",
                },
                {
                  icon: Video,
                  title: "Camera optional, always",
                  text: "Cameras are off by default. Turn yours on only if it helps you — most people never do.",
                },
                {
                  icon: ShieldCheck,
                  title: "Moderated and reportable",
                  text: "Rooms follow clear conduct rules with one-tap reporting. Read the full policy on the room safety page.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-5"
                >
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-[var(--foreground-muted)]">
                      {text}
                    </span>
                  </span>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────── */}
        <section className="px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-3xl">
            <motion.div {...reveal}>
              <p className="page-eyebrow">Questions</p>
              <h2 id="faq-heading" className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                Frequently asked questions
              </h2>
            </motion.div>
            <dl className="mt-8 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
              {FAQ.map(([q, a]) => (
                <div key={q} className="py-6">
                  <dt className="text-base font-semibold tracking-tight">{q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{a}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-sm text-[var(--foreground-muted)]">
              More on privacy and conduct:{" "}
              <Link href="/safety" className="font-medium text-[var(--brand-strong)] underline-offset-4 hover:underline">
                room safety &amp; moderation
              </Link>{" "}
              ·{" "}
              <Link href="/privacy" className="font-medium text-[var(--brand-strong)] underline-offset-4 hover:underline">
                privacy policy
              </Link>
            </p>
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────────────── */}
        <section className="px-4 pb-20 sm:px-6 sm:pb-28">
          <motion.div
            {...reveal}
            className="mx-auto max-w-4xl overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--card-border)] bg-[radial-gradient(circle_at_50%_0%,var(--brand-soft-hover),transparent_65%)] px-6 py-14 text-center shadow-[var(--shadow-violet-md)] sm:px-12 sm:py-16"
          >
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-[var(--radius-lg)] bg-[var(--brand-soft)] text-[var(--brand-strong)]">
              <GraduationCap size={22} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h2 className="mx-auto mt-6 max-w-xl text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Ready to study with company?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[var(--foreground-muted)]">
              Join FocusArx free — synchronized study rooms, a Pomodoro timer, streaks, and an AI
              coach in one calm workspace.
            </p>
            <Button asChild size="xl" className="mt-8">
              <Link href="/signup">
                Join free <ArrowRight />
              </Link>
            </Button>
            <p className="mt-4 text-xs text-[var(--foreground-subtle)]">
              Free forever at the core. No credit card.
            </p>
          </motion.div>
        </section>
      </main>

      {/* Crawlable related links */}
      <nav
        aria-label="Related pages"
        className="border-t border-[var(--border-subtle)] px-4 py-8 sm:px-6"
      >
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-[var(--foreground-subtle)]">
          <Link href="/" className="transition-colors hover:text-[var(--foreground)]">Home</Link>
          <Link href="/study-rooms" className="transition-colors hover:text-[var(--foreground)]">Live study rooms</Link>
          <Link href="/study-with-me" className="transition-colors hover:text-[var(--foreground)]">Study with me</Link>
          <Link href="/body-doubling" className="transition-colors hover:text-[var(--foreground)]">Body doubling</Link>
          <Link href="/pomodoro-guide" className="transition-colors hover:text-[var(--foreground)]">Pomodoro guide</Link>
          <Link href="/focus-guide" className="transition-colors hover:text-[var(--foreground)]">Focus guide</Link>
          <Link href="/safety" className="transition-colors hover:text-[var(--foreground)]">Room safety</Link>
        </div>
      </nav>
    </div>
  );
}
