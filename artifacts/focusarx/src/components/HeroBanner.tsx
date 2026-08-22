import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const STATS = [
  { value: "2.4M+", label: "focus sessions" },
  { value: "18K+", label: "active learners" },
  { value: "94%", label: "streak retention" },
];

const FEATURES = [
  { icon: "🧠", label: "AI Focus Monitor", desc: "Webcam tracks attention" },
  { icon: "🗺️", label: "AI Roadmap", desc: "Personalized study plans" },
  { icon: "🏆", label: "Leaderboards", desc: "Compete with friends" },
  { icon: "⚡", label: "Deep Work Streaks", desc: "Build unbreakable habits" },
  { icon: "🎯", label: "Daily Missions", desc: "XP & coin rewards" },
  { icon: "🔥", label: "Battle Pass", desc: "50-tier season rewards" },
];

const TESTIMONIALS = [
  { name: "Alex K.", text: "Finally broke my procrastination cycle. 60-day streak!", role: "CS Student" },
  { name: "Priya M.", text: "The AI coach gave me insights I didn't expect.", role: "Med Resident" },
  { name: "James R.", text: "Leaderboard competition keeps me accountable daily.", role: "Freelancer" },
];

export default function HeroBanner({ onStart }: { onStart: () => void }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("heroBannerV2Dismissed") === "true"
  );
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTestimonialIdx(i => (i + 1) % TESTIMONIALS.length), 4000);
    return () => clearInterval(id);
  }, []);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16, scale: 0.97 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full rounded-2xl border border-[var(--rgba-124-58-237-0_3)] bg-gradient-to-br from-[var(--rgba-124-58-237-0_12)] via-[var(--rgba-79-70-229-0_08)] to-[var(--rgba-16-12-32-0_6)] p-6 mb-2 relative overflow-hidden"
      >
        {/* Decorative glows */}
        <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,var(--rgba-124-58-237-0_18),transparent_70%)] blur-2xl" />
        <div className="pointer-events-none absolute left-0 bottom-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,var(--rgba-79-70-229-0_12),transparent_70%)] blur-xl" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--rgba-124-58-237-0_4)] bg-[var(--rgba-124-58-237-0_12)] px-3 py-1 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--palette-emerald-400)] animate-pulse" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--brand-400)]">Free forever</span>
            </div>
            <h2 className="text-xl font-black text-[var(--foreground)] leading-tight">
              Don't just study harder.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--brand-400)] to-[var(--info)]">Study smarter.</span>
            </h2>
            <p className="text-xs text-[var(--palette-6b7280)] mt-1">AI tracks your focus, builds your roadmap, and keeps you accountable every day.</p>
          </div>
          <button
            onClick={() => { localStorage.setItem("heroBannerV2Dismissed", "true"); setDismissed(true); }}
            className="shrink-0 rounded-lg p-1 text-[var(--palette-3a3d4a)] hover:text-[var(--palette-6b7080)] transition-colors"
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {STATS.map(s => (
            <div key={s.label} className="rounded-xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-124-58-237-0_07)] px-3 py-2 text-center">
              <p className="text-base font-black text-[var(--brand-400)]">{s.value}</p>
              <p className="text-[9px] uppercase tracking-widest text-[var(--palette-4a4f62)]">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {FEATURES.map(f => (
            <span key={f.label} title={f.desc} className="flex items-center gap-1.5 rounded-full border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_08)] px-2.5 py-1 text-[11px] font-medium text-[var(--palette-9ca3af)] hover:text-[var(--brand-400)] hover:border-[var(--rgba-124-58-237-0_4)] transition-colors cursor-default">
              {f.icon} {f.label}
            </span>
          ))}
        </div>

        {/* Rotating testimonial */}
        <div className="mb-4 rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_03)] px-4 py-3 min-h-[56px] relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={testimonialIdx}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 px-4 py-3 flex items-center gap-3"
            >
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[var(--brand-600)] to-[var(--palette-4f46e5)] flex items-center justify-center text-[10px] font-bold text-[var(--palette-white)] shrink-0">
                {TESTIMONIALS[testimonialIdx]!.name[0]}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-[var(--palette-9ca3af)] italic">"{TESTIMONIALS[testimonialIdx]!.text}"</p>
                <p className="text-[10px] text-[var(--palette-4a4f62)] mt-0.5">{TESTIMONIALS[testimonialIdx]!.name} · {TESTIMONIALS[testimonialIdx]!.role}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* CTAs */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              localStorage.setItem("heroBannerV2Dismissed", "true");
              setDismissed(true);
              onStart();
            }}
            className="flex-1 rounded-xl bg-gradient-to-r from-[var(--brand-600)] to-[var(--palette-4f46e5)] px-5 py-2.5 text-sm font-bold text-[var(--palette-white)] hover:opacity-90 transition-opacity shadow-lg shadow-[var(--rgba-124-58-237-0_3)]"
          >
            Start First Session →
          </button>
          <a
            href="/leaderboard"
            onClick={() => { localStorage.setItem("heroBannerV2Dismissed", "true"); setDismissed(true); }}
            className="rounded-xl border border-[var(--rgba-124-58-237-0_3)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-400)] hover:bg-[var(--rgba-124-58-237-0_1)] transition-colors whitespace-nowrap"
          >
            View Leaderboard
          </a>
        </div>

        {/* Indicator dots */}
        <div className="flex justify-center gap-1 mt-3">
          {TESTIMONIALS.map((_, i) => (
            <button key={i} onClick={() => setTestimonialIdx(i)} className={`h-1 rounded-full transition-all ${i === testimonialIdx ? "w-5 bg-[var(--brand-600)]" : "w-1.5 bg-[var(--palette-2a2d3a)]"}`} />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
