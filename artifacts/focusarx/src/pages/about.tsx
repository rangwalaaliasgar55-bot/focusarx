import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { ArrowLeft, Zap, Heart, Globe, Users, ShieldCheck, Mail, Phone, BookOpen, CalendarCheck, Scale, Coins } from "lucide-react";
import { motion } from "framer-motion";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { AuthorBlock } from "@/components/AuthorBlock";
import { TEAM_AUTHOR } from "@/content/authors.mjs";
import { ABOUT_REVIEWED } from "@/content/seo-pages.mjs";

/**
 * Editorial standards — the part of an About page that actually earns trust.
 *
 * "We care about quality" is not evidence. What a reader (and a quality rater)
 * can check is whether a page names who wrote it, links the sources behind its
 * claims, shows the working for its numbers, and says what happens when it is
 * wrong. These are the promises the rest of the site is built to keep: the
 * byline comes from src/content/authors.mjs, the outbound citations from
 * src/lib/citations.mjs, the numbers from /evidence.
 */
const STANDARDS = [
  {
    icon: BookOpen,
    title: "Sources you can open",
    desc: "Claims about attention, memory and study intervals link out to the primary work — the paper, the book, or the exam body that publishes the pattern. Where a source cannot be linked honestly, we say so rather than invent a citation.",
  },
  {
    icon: Scale,
    title: "Numbers with a ledger",
    desc: "Every metric we quote appears on the evidence ledger with its definition, source, sample and date. If we cannot show the working, the number does not go on the page.",
  },
  {
    icon: CalendarCheck,
    title: "Review dates, not build dates",
    desc: "A page shows when its copy was last checked against reality — the same date the sitemap advertises. Pages with no dated review show no date at all: a guessed one is worse than none.",
  },
  {
    icon: ShieldCheck,
    title: "No clinical claims",
    desc: "FocusArx is a focus tool, not a treatment. Our ADHD and study pages describe technique and evidence; they do not diagnose and they are not medical advice.",
  },
  {
    icon: Coins,
    title: "No advertising, no data sales",
    desc: "The core product is free and premium is earned with coins from sessions you actually completed. We sell no ads, no data, and no page ranking.",
  },
];

const STANDARDS_LINKS = [
  { href: "/evidence", label: "Evidence ledger" },
  { href: "/camera-data", label: "Camera and data" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/safety", label: "Safety" },
];

const VALUES = [
  { icon: Zap, title: "Deep Work First", desc: "We believe that focused, uninterrupted work is the most powerful skill a person can develop. Every feature we build serves that single purpose." },
  { icon: Heart, title: "Built for Humans", desc: "Productivity tools should reduce stress, not add to it. FocusArx is designed to feel like a supportive partner, not a demanding taskmaster." },
  { icon: Globe, title: "Accessible to Everyone", desc: "Great focus tools shouldn't cost money. Our core features are free forever — premium perks are earned with coins, not cash." },
  { icon: Users, title: "Community Driven", desc: "Our users shape FocusArx. We read every piece of feedback, build features users actually ask for, and ship fast." },
];

export default function AboutPage() {
  return (
    <div className="relative min-h-[100dvh] forge-bg-glow">
      <PageSEO {...PAGE_SEO.about} />
      <main id="main-content" className="relative z-[var(--z-content)] mx-auto max-w-5xl px-4 py-10 md:py-20">
        <PageTransition>
          <Link href="/" className="mb-10 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] hover:text-[var(--brand-400)] transition-colors">
            <ArrowLeft size={13} /> Back to Hub
          </Link>

          {/* Hero */}
          <div className="mb-24 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--palette-purple-500)]/30 bg-[var(--palette-purple-500)]/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--palette-purple-300)]"
            >
              Our Mission
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mb-8 text-5xl sm:text-7xl font-semibold tracking-tight text-[var(--palette-white)] leading-[0.9]"
            >
              Restoring the world's <br />
              <span className="text-gradient">Attention Span.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mx-auto max-w-2xl text-lg leading-relaxed text-[var(--foreground-muted)]"
            >
              FocusArx was born in 2024 from a simple realization: in an era of infinite distraction, the ability to focus is the ultimate competitive advantage. We build tools that help you reclaim your time and achieve true mastery.
            </motion.p>
            <AuthorBlock lastReviewed={ABOUT_REVIEWED} className="mt-8 justify-center" />
          </div>

          {/* Values Grid */}
          <div className="mb-24 grid sm:grid-cols-2 gap-6">
            {VALUES.map((v, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="rounded-[32px] border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.01] p-8 backdrop-blur-xl glass-heavy"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-600)]/10 border border-[var(--brand-600)]/20">
                  <v.icon size={20} className="text-[var(--brand-400)]" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-[var(--palette-white)]">{v.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--muted-fg)]">{v.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Editorial standards */}
          <div className="mb-24 grid gap-8 lg:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="rounded-[32px] border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.01] p-10 backdrop-blur-xl glass-heavy"
            >
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)]">
                Who writes this
              </p>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--palette-white)]">{TEAM_AUTHOR.name}</h2>
              <p className="mb-4 text-sm leading-relaxed text-[var(--muted-fg)]">{TEAM_AUTHOR.role}.</p>
              <p className="text-sm leading-relaxed text-[var(--muted-fg)]">{TEAM_AUTHOR.credentials}</p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--muted-fg)]">{TEAM_AUTHOR.bio}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="rounded-[32px] border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.01] p-10 glass lg:col-span-2"
            >
              <h2 className="mb-2 text-2xl font-semibold text-[var(--palette-white)]">How we research what we publish</h2>
              <p className="mb-8 text-sm leading-relaxed text-[var(--muted-fg)]">
                Every guide, comparison and exam page on this site is held to the same five rules.
              </p>
              <ul className="space-y-6">
                {STANDARDS.map((std) => (
                  <li key={std.title} className="flex items-start gap-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--brand-600)]/20 bg-[var(--brand-600)]/10">
                      <std.icon size={16} className="text-[var(--brand-400)]" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-base font-semibold text-[var(--palette-white)]">{std.title}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-[var(--muted-fg)]">{std.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--palette-white)]/5 pt-6 text-sm">
                {STANDARDS_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="text-[var(--brand-400)] underline-offset-4 transition-colors hover:underline"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>

              <p className="mt-6 text-sm leading-relaxed text-[var(--muted-fg)]">
                Spotted something wrong, out of date or overstated? Email{" "}
                <a
                  href="mailto:focusarx@gmail.com?subject=Correction"
                  className="text-[var(--brand-400)] underline-offset-4 hover:underline"
                >
                  focusarx@gmail.com
                </a>{" "}
                and we will correct the page and move its last-updated date, so you can tell the fix happened.
              </p>
            </motion.div>
          </div>

          {/* Contact & Legal Details */}
          <div className="mb-24 grid gap-8 lg:grid-cols-3">
             <div className="lg:col-span-2 space-y-8">
                <div className="rounded-[32px] border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.01] p-10 glass">
                   <h2 className="text-2xl font-semibold text-[var(--palette-white)] mb-6">Verified Information</h2>
                   <div className="grid sm:grid-cols-2 gap-10">
                      <div className="space-y-6">
                         <div className="flex items-start gap-4">
                            <Globe className="text-[var(--brand-400)] mt-1" size={18} />
                            <div>
                               <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-1">Based In</p>
                               <p className="text-sm text-[var(--palette-zinc-300)]">India</p>
                               <p className="text-sm text-[var(--palette-zinc-500)]">Serving learners worldwide</p>
                            </div>
                         </div>
                         <div className="flex items-start gap-4">
                            <ShieldCheck className="text-[var(--brand-400)] mt-1" size={18} />
                            <div>
                               <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-1">Privacy</p>
                               <p className="text-sm text-[var(--palette-zinc-300)]">On-device vision processing</p>
                               <p className="text-sm text-[var(--palette-zinc-500)]">No video ever leaves your browser</p>
                            </div>
                         </div>
                      </div>
                      <div className="space-y-6">
                         <div className="flex items-start gap-4">
                            <Mail className="text-[var(--brand-400)] mt-1" size={18} />
                            <div>
                               <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-1">Email</p>
                               <a href="mailto:focusarx@gmail.com" className="text-sm text-[var(--palette-zinc-300)] hover:text-[var(--brand-400)] transition-colors">focusarx@gmail.com</a>
                               <p className="text-sm text-[var(--palette-zinc-500)]">We reply fast</p>
                            </div>
                         </div>
                         <div className="flex items-start gap-4">
                            <Phone className="text-[var(--brand-400)] mt-1" size={18} />
                            <div>
                               <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-1">Phone / WhatsApp</p>
                               <a href="tel:+917725004639" className="text-sm text-[var(--palette-zinc-300)] hover:text-[var(--brand-400)] transition-colors">+91 77250 04639</a>
                               <p className="text-sm text-[var(--palette-zinc-500)]">Mon–Sat · 9am–7pm IST</p>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>

             <div className="rounded-[32px] border border-[var(--palette-white)]/5 bg-gradient-to-br from-[var(--brand-600)]/10 to-[var(--brand-pink)]/5 p-10 flex flex-col justify-center text-center">
                <h3 className="text-2xl font-semibold text-[var(--palette-white)] mb-4 italic">Join the Elite.</h3>
                <p className="text-sm text-[var(--foreground-muted)] mb-8">Ready to transform your cognitive output? Start your first session today.</p>
                <Link href="/signup">
                  <button className="w-full py-4 rounded-2xl bg-[var(--palette-white)] text-[var(--palette-black)] font-semibold hover:scale-105 transition-all shadow-xl shadow-[var(--palette-purple-950)]/20">
                    Get Started Free
                  </button>
                </Link>
             </div>
          </div>

          <div className="px-6 py-12 border-t border-[var(--palette-white)]/5 text-center">
             <p className="text-[11px] text-[var(--palette-zinc-700)] leading-relaxed uppercase tracking-[0.2em] max-w-3xl mx-auto">
               *FocusArx is a productivity app built by an independent team. AI-generated coaching is for educational and motivational purposes only — it is not professional advice. Focus responsibly.
             </p>
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
