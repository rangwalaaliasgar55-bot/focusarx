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

const PRO_EXTRAS = [
  "Everything in Free",
  "Unlimited AI Coach messages",
  "Unlimited AI Roadmap generation",
  "Priority AI response speed",
  "Advanced analytics export (CSV)",
  "Custom Pomodoro profiles (unlimited)",
  "Offline mode & PWA install",
  "Early access to new features",
  "Priority support",
  "No rate limits on any feature",
];

export default function PricingPage() {
  return (
    <div className="relative min-h-[100dvh] forge-bg-glow">
      <PageSEO {...PAGE_SEO.pricing} />
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
              FocusArx is free to use. Pro unlocks unlimited AI and removes all rate limits.
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

            {/* Pro Tier */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="relative rounded-2xl border border-[rgba(124,58,237,0.5)] bg-[rgba(16,23,50,0.6)] p-7 backdrop-blur-xl flex flex-col shadow-[0_0_40px_rgba(124,58,237,0.15)]"
            >
              {/* Popular badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_0_14px_rgba(124,58,237,0.5)]">
                  Coming soon
                </span>
              </div>

              {/* Particle decoration */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute h-1 w-1 rounded-full bg-[#7C3AED]"
                    style={{ left: `${10 + i * 20}%`, top: `${5 + (i % 3) * 20}%` }}
                    animate={{ opacity: [0.2, 0.7, 0.2], scale: [1, 1.4, 1] }}
                    transition={{ repeat: Infinity, duration: 2.5 + i * 0.3, delay: i * 0.2 }}
                  />
                ))}
              </div>

              <div className="mb-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(124,58,237,0.2)]">
                  <Crown size={18} className="text-[#FFB800]" />
                </div>
                <h2 className="text-xl font-bold text-[#E2E8F0]">Pro</h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-[#E2E8F0]">$8</span>
                  <span className="text-sm text-[#4B5563]">/ month</span>
                </div>
                <p className="mt-2 text-xs text-[#64748B]">Billed monthly. Cancel anytime.</p>
              </div>

              <ul className="flex-1 space-y-2.5 mb-7">
                {PRO_EXTRAS.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#94A3B8]">
                    <Check size={14} className="mt-0.5 shrink-0 text-[#FFB800]" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                disabled
                className="block w-full rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] py-3 text-center text-sm font-bold text-white opacity-60 cursor-not-allowed"
              >
                Launching soon — stay tuned
              </button>
            </motion.div>
          </div>

          {/* FAQ */}
          <div className="mt-16 max-w-3xl mx-auto">
            <h2 className="mb-6 text-center text-lg font-bold text-[#E2E8F0]">Frequently asked questions</h2>
            <div className="space-y-4">
              {[
                {
                  q: "Is FocusArx really free?",
                  a: "Yes. The core experience — Pomodoro timer, gamification, leaderboard, AI Coach, AI Roadmap, webcam monitoring, and all analytics — is free with no time limits and no credit card required."
                },
                {
                  q: "What are the AI rate limits on the free plan?",
                  a: "The AI Coach is limited to 20 messages per minute per user. The AI Roadmap generator allows 10 roadmap saves per hour. These limits are generous for typical use and reset automatically."
                },
                {
                  q: "Do I need an account to use FocusArx?",
                  a: "No. You can start a guest session immediately with no sign-up. Guest sessions persist via a local key. Creating a free account unlocks leaderboard participation and cross-device sync."
                },
                {
                  q: "When will Pro launch?",
                  a: "We're building Pro features based on user feedback. Join us and use the free plan — we'll notify registered users when Pro is available."
                },
              ].map(({ q, a }) => (
                <div key={q} className="rounded-2xl border border-[rgba(124,58,237,0.1)] bg-[rgba(16,23,50,0.4)] p-5">
                  <p className="mb-2 text-sm font-semibold text-[#E2E8F0]">{q}</p>
                  <p className="text-sm leading-relaxed text-[#64748B]">{a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer links */}
          <div className="mt-10 flex flex-wrap justify-center gap-4 border-t border-[rgba(124,58,237,0.1)] pt-6">
            {[
              { href: "/privacy", label: "Privacy Policy" },
              { href: "/terms", label: "Terms of Service" },
              { href: "/ai-policy", label: "AI Policy" },
              { href: "/cookie-policy", label: "Cookie Policy" },
            ].map(({ href, label }) => (
              <Link key={href} href={href} className="text-xs text-[#4B5563] hover:text-[#A78BFA] transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
