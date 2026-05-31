import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, ChevronUp, Zap, Target, Brain, ArrowRight } from "lucide-react";

const OVERLAY_KEY = "focusarx-welcome-seen";

export function hasSeenWelcome() {
  return localStorage.getItem(OVERLAY_KEY) === "1";
}

export function markWelcomeSeen() {
  localStorage.setItem(OVERLAY_KEY, "1");
}

const BENEFITS = [
  {
    icon: Brain,
    title: "AI-powered focus tracking",
    desc: "Your camera detects distraction in real-time and nudges you back on track.",
  },
  {
    icon: Zap,
    title: "Deep work sessions, gamified",
    desc: "Earn streaks, unlock achievements, and race your past self with Ghost Mode.",
  },
  {
    icon: Target,
    title: "Built around your rhythm",
    desc: "Customise session lengths, sound profiles, and goals to match how you actually work.",
  },
];

export default function WelcomeOverlay() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!hasSeenWelcome()) {
      const t = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    markWelcomeSeen();
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="welcome-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4"
          style={{ background: "rgba(5, 7, 18, 0.88)", backdropFilter: "blur(18px)" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="relative w-full max-w-lg rounded-2xl border border-[rgba(124,58,237,0.25)] bg-[#0d0f1c] shadow-[0_0_80px_rgba(124,58,237,0.18)] overflow-hidden"
          >
            {/* Purple glow strip at top */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#7C3AED] to-transparent" />

            {/* Close button */}
            <button
              onClick={dismiss}
              aria-label="Close"
              className="absolute top-4 right-4 rounded-lg p-1.5 text-[#4B5563] transition-colors hover:bg-[rgba(124,58,237,0.12)] hover:text-[#A78BFA]"
            >
              <X size={16} />
            </button>

            <div className="p-8 pb-6">
              {/* Logo + badge */}
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center shadow-lg shadow-purple-900/40">
                  <Brain size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#4B5563]">Welcome to</p>
                  <p className="text-lg font-bold text-[#E2E8F0] leading-tight">FocusArx</p>
                </div>
              </div>

              {/* Headline */}
              <h2 className="text-2xl font-bold text-[#E2E8F0] leading-snug mb-2">
                Your AI-powered<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A78BFA] to-[#7C3AED]">
                  deep-work command centre.
                </span>
              </h2>

              {/* Tagline */}
              <p className="text-sm text-[#6B7280] leading-relaxed mb-1">
                FocusArx combines a smart Pomodoro timer, real-time AI attention tracking, and
                habit-building tools into one focused environment — so you can do your best work, consistently.
              </p>

              {/* Who it's for */}
              <p className="text-xs text-[#A78BFA]/70 mb-6">
                For students, developers, creators, and anyone serious about protecting their focus.
              </p>

              {/* Benefits */}
              <div className="space-y-3 mb-6">
                {BENEFITS.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-3 rounded-xl border border-[rgba(124,58,237,0.12)] bg-[rgba(124,58,237,0.06)] px-4 py-3">
                    <div className="mt-0.5 shrink-0 rounded-lg bg-[rgba(124,58,237,0.2)] p-1.5">
                      <Icon size={13} className="text-[#A78BFA]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#E2E8F0]">{title}</p>
                      <p className="text-[11px] text-[#6B7280] leading-snug mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Learn More expandable */}
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-[#7C3AED] hover:text-[#A78BFA] transition-colors mb-3 font-medium"
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {expanded ? "Show less" : "Learn more about FocusArx"}
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl border border-[rgba(124,58,237,0.15)] bg-[rgba(124,58,237,0.05)] p-4 mb-3 text-xs text-[#6B7280] leading-relaxed space-y-2">
                      <p>
                        <span className="text-[#A78BFA] font-semibold">The problem:</span>{" "}
                        Modern work is full of interruptions. Most focus tools are passive timers that can't
                        tell whether you're actually focused — or scrolling.
                      </p>
                      <p>
                        <span className="text-[#A78BFA] font-semibold">Our solution:</span>{" "}
                        FocusArx uses your camera (locally, with full privacy) to detect attention drift,
                        and pairs it with streaks, leaderboards, and an AI coach to build a lasting deep-work habit.
                      </p>
                      <p>
                        <span className="text-[#A78BFA] font-semibold">Your data stays yours:</span>{" "}
                        All camera processing happens on-device. Nothing is sent to any server.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CTA buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={dismiss}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-900/30 hover:opacity-90 transition-opacity"
                >
                  Get Started
                  <ArrowRight size={14} />
                </button>
                <button
                  onClick={dismiss}
                  className="rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.08)] px-5 py-2.5 text-sm font-medium text-[#A78BFA] hover:bg-[rgba(124,58,237,0.15)] transition-colors"
                >
                  Enter App
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
