import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Check, Zap, ArrowLeft, Crown } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

const FREE_FEATURES = [
  "Unlimited Pomodoro sessions",
  "Full gamification (XP, coins, badges, streaks)",
  "Leaderboard rankings",
  "AI Coach (20 msg/min)",
  "AI Study Roadmap (10/hr)",
  "Webcam attention monitoring",
  "Session analytics & heatmaps",
  "Tasks & goal tracking",
  "Focus DNA insights",
  "Ghost Mode (compete vs yourself)",
  "Break Free companion",
  "Consequence contracts",
  "Forge Room co-focus",
  "Session Replay",
];

const PREMIUM_EXTRAS = [
  "Everything in Free",
  "Unlimited AI Coach messages",
  "Unlimited AI Roadmap generation",
  "1.25× coin multiplier on every session",
  "XP multiplier for faster leveling",
  "Premium loot boxes with better drops",
  "Exclusive themes, pets & profile badge",
  "Premium analytics & AI reports",
  "Premium Battle Pass access",
  "Exclusive emotes in messages and study rooms",
  "Cosmic, Neon, and Aurora Focus City skins",
  "Premium seasonal challenges and rewards",
  "AI-generated flashcards and unlimited decks",
  "Detailed AI roadmaps with milestones and resources",
  "180-day analytics and premium notification controls",
];

/**
 * Exam guides most Indian visitors are here for. Real pages, real links — the
 * pricing answer is "free", and the useful next click is the guide for the
 * paper they are actually sitting.
 */
const INDIA_EXAM_LINKS: [string, string][] = [
  ["/exam/jee-main", "JEE Main study plan"],
  ["/exam/jee-advanced", "JEE Advanced study plan"],
  ["/exam/neet-ug", "NEET UG study plan"],
  ["/exam/cbse-class-12", "CBSE Class 12 boards"],
  ["/exam/cbse-class-10", "CBSE Class 10 boards"],
  ["/exam/bitsat", "BITSAT speed strategy"],
  ["/exam/kcet", "KCET study plan"],
  ["/exam/mht-cet", "MHT-CET study plan"],
  ["/exam/wbjee", "WBJEE study plan"],
  ["/exam/cuet-ug", "CUET (UG) subject choice"],
  ["/exam/clat", "CLAT study plan"],
  ["/exam/ca-foundation", "CA Foundation study plan"],
  ["/exam/upsc-cse", "UPSC CSE study plan"],
  ["/exam", "All 23 exam guides"],
];

export default function PricingPage() {
  const productSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "FocusArx Premium",
    "image": "https://www.focusarx.site/logo.png",
    "description": "Unlock unlimited AI coaching, Focus DNA insights, multipliers, and exclusive themes with FocusArx Premium — activated with in-app coins.",
    "brand": {
      "@type": "Brand",
      "name": "FocusArx"
    },
    // Premium is never sold, so the honest offer is zero — stated in INR
    // because that is the currency most of our students think in, and the
    // page shows the rupee figure next to the coin cost.
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock",
      "url": "https://www.focusarx.site/pricing"
    }
  };

  return (
    <div className="relative min-h-[100dvh] forge-bg-glow">
      <PageSEO {...PAGE_SEO.pricing} structuredData={productSchema} />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,var(--rgba-124-58-237-0_08),transparent_65%)] blur-3xl" />
      </div>

      <main id="main-content" className="relative z-[var(--z-content)] mx-auto max-w-4xl px-4 py-10">
        <PageTransition>
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-[var(--foreground-subtle)] hover:text-[var(--brand-400)] transition-colors">
            <ArrowLeft size={13} /> Back to FocusArx
          </Link>

          <header className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--foreground-subtle)]">Pricing</p>
            <h1 className="text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
              Simple, honest pricing
            </h1>
            <p className="mt-3 text-sm text-[var(--muted-fg)]">
              FocusArx is free to use. Premium unlocks unlimited AI and extra perks — and you activate it with coins you earn by focusing.
            </p>
          </header>

          <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
            {/* Free Tier */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-16-23-50-0_5)] p-7 backdrop-blur-xl flex flex-col"
            >
              <div className="mb-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--rgba-124-58-237-0_12)]">
                  <Zap size={18} className="text-[var(--brand-400)]" />
                </div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">Free</h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold text-[var(--foreground)]">$0</span>
                  <span className="text-2xl font-semibold text-[var(--foreground-subtle)]">· ₹0</span>
                  <span className="text-sm text-[var(--foreground-subtle)]">/ forever</span>
                </div>
                <p className="mt-2 text-xs text-[var(--muted-fg)]">No credit card, no UPI, no subscription. No hidden fees.</p>
              </div>

              <ul className="flex-1 space-y-2.5 mb-7">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--foreground-muted)]">
                    <Check size={14} className="mt-0.5 shrink-0 text-[var(--brand-teal)]" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className="block w-full rounded-xl border border-[var(--rgba-124-58-237-0_3)] bg-[var(--rgba-124-58-237-0_08)] py-3 text-center text-sm font-semibold text-[var(--brand-400)] transition-all hover:bg-[var(--rgba-124-58-237-0_15)]"
              >
                Get started free
              </Link>
            </motion.div>

            {/* Premium Tier */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="relative rounded-2xl border border-[var(--rgba-124-58-237-0_5)] bg-[var(--rgba-16-23-50-0_6)] p-7 backdrop-blur-xl flex flex-col shadow-[0_0_40px_var(--rgba-124-58-237-0_15)]"
            >
              {/* Badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-[var(--brand-600)] hover:bg-[var(--brand-700)] px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--palette-white)] shadow-[0_0_14px_var(--rgba-124-58-237-0_5)]">
                  Earn It
                </span>
              </div>

              <div className="mb-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--rgba-124-58-237-0_2)]">
                  <Crown size={18} className="text-[var(--brand-gold)]" />
                </div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">Premium</h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold text-[var(--foreground)]">9,000</span>
                  <span className="text-sm text-[var(--foreground-subtle)]">coins</span>
                  <span className="text-sm text-[var(--foreground-subtle)]">· ₹0</span>
                </div>
                <p className="mt-2 text-xs text-[var(--muted-fg)]">
                  Unlocked with coins you earn from completed sessions, daily quests and streaks.
                  Premium is never sold — in rupees, dollars or any other currency — so there is no
                  card, UPI or payment step to reach it.
                </p>
              </div>

              <ul className="flex-1 space-y-2.5 mb-7">
                {PREMIUM_EXTRAS.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--foreground-muted)]">
                    <Check size={14} className="mt-0.5 shrink-0 text-[var(--brand-gold)]" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/premium"
                className="block w-full rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] py-3 text-center text-sm font-bold text-[var(--palette-white)] transition-all hover:brightness-110"
              >
                Unlock Premium
              </Link>
            </motion.div>
          </div>

          {/* ── India ───────────────────────────────────────────────
              Most FocusArx students are in India, and the two questions they
              actually have are "what does this cost me in rupees" and "does
              this know my exam". Both get a direct answer here rather than a
              keyword-stuffed heading. */}
          <section className="mx-auto mt-14 max-w-3xl rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-16-23-50-0_5)] p-7 backdrop-blur-xl">
            <h2 className="text-xl font-bold text-[var(--foreground)]">For students in India</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
              FocusArx costs ₹0. There is no rupee price for Premium because Premium is not for
              sale: you unlock it with coins earned from completed focus sessions, so a student
              with no card, no UPI handle and no budget for another subscription can reach every
              feature by studying. The free tier keeps the timer, tasks, streaks, analytics and
              study rooms, which is the whole workflow.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[var(--foreground-muted)]">
              The study content is written for Indian exams first — paper patterns, marking rules
              and section timing from the official bulletins, not generic advice:
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {INDIA_EXAM_LINKS.map(([href, label]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-[var(--rgba-124-58-237-0_15)] px-4 py-2.5 text-sm text-[var(--foreground-muted)] transition-colors hover:border-[var(--rgba-124-58-237-0_35)] hover:text-[var(--foreground)]"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-[var(--muted-fg)]">
              The app is an installable PWA, so the timer keeps running offline once it has loaded
              — useful on a patchy connection or a data-saving phone. Everything is in English,
              which is the language most of these papers are set in.
            </p>
          </section>
        </PageTransition>
      </main>
    </div>
  );
}
