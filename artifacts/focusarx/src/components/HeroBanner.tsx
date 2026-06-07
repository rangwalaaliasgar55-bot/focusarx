import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useLink } from "wouter";

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
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full rounded-2xl border border-[rgba(124,58,237,0.3)] bg-gradient-to-br from-[rgba(124,58,237,0.12)] via-[rgba(79,70,229,0.08)] to-[rgba(16,12,32,0.6)] p-6 mb-2 relative overflow-hidden"
      >
        {/* Decorative glows */}
        <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.18),transparent_70%)] blur-2xl" />
        <div className="pointer-events-none absolute left-0 bottom-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,0.12),transparent_70%)] blur-xl" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.4)] bg-[rgba(124,58,237,0.12)] px-3 py-1 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#a78bfa]">Free · No credit card</span>
            </div>
            <h2 className="text-xl font-black text-[#E2E8F0] leading-tight">
              Don't just study harder.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A78BFA] to-[#60A5FA]">Study smarter.</span>
            </h2>
            <p className="text-xs text-[#6b7280] mt-1">AI tracks your focus, builds your roadmap, and keeps you accountable every day.</p>
          </div>
          <button
            onClick={() => { localStorage.setItem("heroBannerV2Dismissed", "true"); setDismissed(true); }}
            className="shrink-0 rounded-lg p-1 text-[#3a3d4a] hover:text-[#6b7080] transition-colors"
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {STATS.map(s => (
            <div key={s.label} className="rounded-xl border border-[rgba(124,58,237,0.15)] bg-[rgba(124,58,237,0.07)] px-3 py-2 text-center">
              <p className="text-base font-black text-[#a78bfa]">{s.value}</p>
              <p className="text-[9px] uppercase tracking-widest text-[#4a4f62]">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {FEATURES.map(f => (
            <span key={f.label} title={f.desc} className="flex items-center gap-1.5 rounded-full border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.08)] px-2.5 py-1 text-[11px] font-medium text-[#9ca3af] hover:text-[#a78bfa] hover:border-[rgba(124,58,237,0.4)] transition-colors cursor-default">
              {f.icon} {f.label}
            </span>
          ))}
        </div>

        {/* Rotating testimonial */}
        <div className="mb-4 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-4 py-3 min-h-[56px] relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={testimonialIdx}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 px-4 py-3 flex items-center gap-3"
            >
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                {TESTIMONIALS[testimonialIdx]!.name[0]}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-[#9ca3af] italic">"{TESTIMONIALS[testimonialIdx]!.text}"</p>
                <p className="text-[10px] text-[#4a4f62] mt-0.5">{TESTIMONIALS[testimonialIdx]!.name} · {TESTIMONIALS[testimonialIdx]!.role}</p>
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
            className="flex-1 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-lg shadow-[rgba(124,58,237,0.3)]"
          >
            Start First Session →
          </button>
          <a
            href="/leaderboard"
            onClick={() => { localStorage.setItem("heroBannerV2Dismissed", "true"); setDismissed(true); }}
            className="rounded-xl border border-[rgba(124,58,237,0.3)] px-4 py-2.5 text-sm font-semibold text-[#a78bfa] hover:bg-[rgba(124,58,237,0.1)] transition-colors whitespace-nowrap"
          >
            View Leaderboard
          </a>
        </div>

        {/* Indicator dots */}
        <div className="flex justify-center gap-1 mt-3">
          {TESTIMONIALS.map((_, i) => (
            <button key={i} onClick={() => setTestimonialIdx(i)} className={`h-1 rounded-full transition-all ${i === testimonialIdx ? "w-5 bg-[#7C3AED]" : "w-1.5 bg-[#2a2d3a]"}`} />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
