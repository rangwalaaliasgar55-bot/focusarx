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
];

export default function PricingPage() {
  const productSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "FocusArx Premium",
    "image": "https://focusarx.site/logo.png",
    "description": "Unlock unlimited AI coaching, Focus DNA insights, multipliers, and exclusive themes with FocusArx Premium — activated with in-app coins.",
    "brand": {
      "@type": "Brand",
      "name": "FocusArx"
    }
  };

  return (
    <div className="relative min-h-[100dvh] forge-bg-glow">
      <PageSEO {...PAGE_SEO.pricing} structuredData={productSchema} />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.08),transparent_65%)] blur-3xl" />
      </div>

      <main id="main-content" className="relative z-10 mx-auto max-w-4xl px-4 py-10">
        <PageTransition>
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-[#4B5563] hover:text-[#A78BFA] transition-colors">
            <ArrowLeft size={13} /> Back to FocusArx
          </Link>

          <header className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#4B5563]">Pricing</p>
            <h1 className="text-3xl font-bold text-[#E2E8F0] sm:text-4xl">
              Simple, honest pricing
            </h1>
            <p className="mt-3 text-sm text-[#64748B]">
              FocusArx is free to use. Premium unlocks unlimited AI and extra perks — and you activate it with coins you earn by focusing.
            </p>
          </header>

          <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
            {/* Free Tier */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-2xl border border-[rgba(124,58,237,0.15)] bg-[rgba(16,23,50,0.5)] p-7 backdrop-blur-xl flex flex-col"
            >
              <div className="mb-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(124,58,237,0.12)]">
                  <Zap size={18} className="text-[#A78BFA]" />
                </div>
                <h2 className="text-xl font-bold text-[#E2E8F0]">Free</h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-[#E2E8F0]">$0</span>
                  <span className="text-sm text-[#4B5563]">/ forever</span>
                </div>
                <p className="mt-2 text-xs text-[#64748B]">No credit card required. No hidden fees.</p>
              </div>

              <ul className="flex-1 space-y-2.5 mb-7">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#94A3B8]">
                    <Check size={14} className="mt-0.5 shrink-0 text-[#06D6A0]" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className="block w-full rounded-xl border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.08)] py-3 text-center text-sm font-semibold text-[#A78BFA] transition-all hover:bg-[rgba(124,58,237,0.15)]"
              >
                Get started free
              </Link>
            </motion.div>

            {/* Premium Tier */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="relative rounded-2xl border border-[rgba(124,58,237,0.5)] bg-[rgba(16,23,50,0.6)] p-7 backdrop-blur-xl flex flex-col shadow-[0_0_40px_rgba(124,58,237,0.15)]"
            >
              {/* Badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_0_14px_rgba(124,58,237,0.5)]">
                  Earn It
                </span>
              </div>

              <div className="mb-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(124,58,237,0.2)]">
                  <Crown size={18} className="text-[#FFB800]" />
                </div>
                <h2 className="text-xl font-bold text-[#E2E8F0]">Premium</h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-[#E2E8F0]">9,000</span>
                  <span className="text-sm text-[#4B5563]">coins</span>
                </div>
                <p className="mt-2 text-xs text-[#64748B]">Unlocked with coins you earn from completed sessions. No credit card.</p>
              </div>

              <ul className="flex-1 space-y-2.5 mb-7">
                {PREMIUM_EXTRAS.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#94A3B8]">
                    <Check size={14} className="mt-0.5 shrink-0 text-[#FFB800]" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/premium"
                className="block w-full rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] py-3 text-center text-sm font-bold text-white transition-all hover:brightness-110"
              >
                Unlock Premium
              </Link>
            </motion.div>
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
