import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { ArrowLeft, HelpCircle, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

const FAQS = [
  {
    cat: "Getting Started",
    items: [
      { q: "How do I start a focus session?", a: "On the main timer page, click the play button to start a Pomodoro focus session. The default duration is 25 minutes. You can customise this in the timer settings." },
      { q: "Do I need to create an account?", a: "Yes — accounts let us save your sessions, XP, streaks, and settings securely. Sign up takes under 30 seconds with just an email and password." },
      { q: "Is FocusArx free to use?", a: "Yes! The core app — timer, tasks, streaks, missions, gamification, AI coaching, and analytics — is completely free. Premium perks (XP multipliers, exclusive themes, etc.) are unlocked with coins you earn from focusing, not money." },
    ]
  },
  {
    cat: "Timer & Sessions",
    items: [
      { q: "What is the Pomodoro technique?", a: "Pomodoro is a time management method: work for 25 minutes (one 'Pomodoro'), then take a 5-minute break. After 4 Pomodoros, take a longer 15–30 minute break. FocusArx automates this cycle and tracks your progress." },
      { q: "What does 'Focus Score' mean?", a: "Your Focus Score (0–100) is calculated after each session based on attention consistency, distraction events detected by the webcam (if enabled), and whether you completed the full session without exiting early." },
      { q: "Can I use the timer without the webcam?", a: "Yes. Webcam tracking is completely optional. You get a full focus score without it based on session completion, lock mode, and distraction events you log manually." },
    ]
  },
  {
    cat: "Account & Data",
    items: [
      { q: "How do I delete my account?", a: "Visit your Profile page, scroll to the bottom, and click 'Delete Account'. You can also email focusarx@gmail.com and we will permanently delete your data within 7 days." },
      { q: "Is my webcam data stored?", a: "No. Webcam data is processed entirely on-device using MediaPipe. No video frames are ever sent to our servers. Only the derived focus score is saved." },
      { q: "Can I export my data?", a: "We're building a data export feature. In the meantime, contact focusarx@gmail.com and we'll send you a CSV of your session history." },
    ]
  },
  {
    cat: "Premium",
    items: [
      { q: "How does Premium work?", a: "Premium is unlocked with 9,000 in-app coins, which you earn by completing focus sessions and missions. It adds XP and coin multipliers, exclusive themes and pets, premium loot boxes, and unlimited AI coaching." },
      { q: "Do I need a credit card?", a: "No. FocusArx core is free forever, and Premium is activated with coins you earn in the app — no payment required." },
    ]
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--rgba-124-58-237-0_1)] last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between py-4 text-left gap-4 group"
      >
        <span className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--brand-400)] transition-colors">{q}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronDown size={16} className="text-[var(--foreground-subtle)] shrink-0" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-sm leading-relaxed text-[var(--foreground-muted)]">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="relative min-h-[100dvh] forge-bg-glow">
      <PageSEO {...PAGE_SEO.support} />
      <main id="main-content" className="relative z-[var(--z-content)] mx-auto max-w-4xl px-4 py-10">
        <PageTransition>
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-[var(--foreground-subtle)] hover:text-[var(--brand-400)] transition-colors">
            <ArrowLeft size={13} /> Back to FocusArx
          </Link>

          <header className="mb-10 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--palette-purple-500)]/30 bg-[var(--palette-purple-500)]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--palette-purple-300)]"
            >
              <HelpCircle size={12} />
              Help Center
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mb-3 text-4xl font-semibold tracking-tight text-[var(--foreground)]"
            >
              How can we help?
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="text-sm text-[var(--foreground-muted)]"
            >
              Browse our FAQ or reach out directly — we usually reply within 24 hours.
            </motion.p>
          </header>

          {/* Quick links */}
          <div className="mb-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { emoji: "✉️", title: "Email Us", desc: "focusarx@gmail.com", href: "mailto:focusarx@gmail.com" },
              { emoji: "📞", title: "Call Us", desc: "+91 77250 04639", href: "tel:+917725004639" },
              { emoji: "💬", title: "Contact Form", desc: "Send a detailed message", href: "/contact" },
              { emoji: "📖", title: "Guides", desc: "Pomodoro & study techniques", href: "/pomodoro-guide" },
            ].map((c, i) => (
              <motion.a
                key={i} href={c.href}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                whileHover={{ y: -3 }}
                className="flex items-center gap-3.5 rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-12-14-28-0_8)] p-4 backdrop-blur-sm transition-colors hover:border-[var(--rgba-124-58-237-0_35)]"
              >
                <span className="text-2xl">{c.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{c.title}</p>
                  <p className="text-xs text-[var(--foreground-muted)]">{c.desc}</p>
                </div>
              </motion.a>
            ))}
          </div>

          {/* FAQ */}
          <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-12-14-28-0_8)] p-6 backdrop-blur-sm">
            <h2 className="mb-6 text-lg font-bold text-[var(--foreground)]">Frequently Asked Questions</h2>

            {/* Category tabs */}
            <div className="mb-6 flex flex-wrap gap-2">
              {FAQS.map((cat, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    activeTab === i
                      ? "bg-[var(--rgba-124-58-237-0_25)] text-[var(--brand-400)] border border-[var(--rgba-124-58-237-0_4)]"
                      : "bg-[var(--rgba-124-58-237-0_06)] text-[var(--foreground-subtle)] border border-transparent hover:text-[var(--foreground-muted)]"
                  }`}
                >
                  {cat.cat}
                </button>
              ))}
            </div>

            <div>
              {FAQS[activeTab].items.map((item, i) => (
                <FaqItem key={i} q={item.q} a={item.a} />
              ))}
            </div>
          </div>

          {/* Still need help */}
          <div className="mt-8 rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-gradient-to-br from-[var(--rgba-124-58-237-0_08)] to-transparent p-6 text-center">
            <p className="mb-1.5 font-semibold text-[var(--foreground)]">Still need help?</p>
            <p className="mb-4 text-sm text-[var(--foreground-muted)]">Our team is happy to assist. Average response time is under 24 hours.</p>
            <Link href="/contact">
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: "0 0 30px 6px var(--rgba-124-58-237-0_3)" }}
                whileTap={{ scale: 0.97 }}
                className="rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-500)] px-6 py-2.5 text-sm font-bold text-[var(--palette-white)]"
              >
                Contact Support →
              </motion.button>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-[var(--rgba-124-58-237-0_1)] pt-6 text-xs text-[var(--foreground-subtle)]">
            {[["/contact","Contact"], ["/about","About"], ["/privacy","Privacy"]].map(([href, label]) => (
              <Link key={href} href={href} className="hover:text-[var(--brand-400)] transition-colors">{label}</Link>
            ))}
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
