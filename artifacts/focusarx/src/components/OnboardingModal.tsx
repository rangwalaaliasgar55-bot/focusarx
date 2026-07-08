import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

export function useOnboarding() {
  const done = localStorage.getItem("onboardingComplete") === "true";
  return !done;
}

export default function OnboardingModal() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [minutes, setMinutes] = useState(120);
  const [visible, setVisible] = useState(() => localStorage.getItem("onboardingComplete") !== "true");

  if (!visible) return null;

  function finish() {
    localStorage.setItem("onboardingComplete", "true");
    setVisible(false);
  }

  const blocks = Math.round(minutes / 25);
  const topics = ["Exams", "Coding", "Language", "Research", "Work", "Other"];
  const aiTools = [
    { icon: "📷", title: "AI Focus Monitor", desc: "Detects when you get distracted" },
    { icon: "🗺️", title: "AI Roadmap", desc: "Builds your personalized study plan" },
    { icon: "🏆", title: "Leaderboard", desc: "Compete with other focused students" },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="w-full max-w-md rounded-2xl border border-[rgba(124,58,237,0.25)] bg-[#0d0f1c] p-6 shadow-2xl"
          >
            {/* Step dots */}
            <div className="flex gap-2 mb-6">
              {[1,2,3].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= step ? "bg-[#7C3AED]" : "bg-[rgba(255,255,255,0.06)]"}`} />
              ))}
            </div>

            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <h2 className="text-xl font-bold text-[#E2E8F0] mb-1">What are you studying for?</h2>
                <p className="text-xs text-[#4B5563] mb-5">Select all that apply</p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {topics.map(t => (
                    <button
                      key={t}
                      onClick={() => setSelected(s => s.includes(t) ? s.filter(x => x !== t) : [...s, t])}
                      className={`rounded-full px-4 py-2 text-sm font-medium border transition-all ${
                        selected.includes(t)
                          ? "border-[#7C3AED] bg-[rgba(124,58,237,0.2)] text-[#A78BFA]"
                          : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] text-[#6B7280] hover:border-[#7C3AED]/50"
                      }`}
                    >{t}</button>
                  ))}
                </div>
                <input
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  placeholder="Your main goal this week?"
                  className="w-full rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#070810] px-4 py-2.5 text-sm text-[#E2E8F0] placeholder-[#3a3d4a] outline-none focus:border-[#7C3AED]/60 mb-5"
                />
                <button
                  onClick={() => setStep(2)}
                  className="w-full rounded-xl bg-[#7C3AED] py-3 text-sm font-bold text-white hover:bg-[#6d35d4] transition-colors"
                >Next →</button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <h2 className="text-xl font-bold text-[#E2E8F0] mb-1">Set your daily focus goal</h2>
                <p className="text-xs text-[#4B5563] mb-6">How much do you want to study each day?</p>
                <div className="text-center mb-4">
                  <span className="text-4xl font-black text-[#A78BFA]">{minutes >= 60 ? `${(minutes/60).toFixed(1)}h` : `${minutes}m`}</span>
                  <p className="text-xs text-[#4B5563] mt-1">≈ {blocks} focus blocks per day</p>
                </div>
                <input
                  type="range" min="30" max="480" step="30" value={minutes}
                  onChange={e => setMinutes(Number(e.target.value))}
                  className="w-full accent-[#7C3AED] mb-6"
                />
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 rounded-xl border border-[rgba(255,255,255,0.06)] py-3 text-sm text-[#6B7280] hover:text-[#E2E8F0]">← Back</button>
                  <button onClick={() => setStep(3)} className="flex-1 rounded-xl bg-[#7C3AED] py-3 text-sm font-bold text-white hover:bg-[#6d35d4] transition-colors">Next →</button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <h2 className="text-xl font-bold text-[#E2E8F0] mb-1">Meet your AI tools</h2>
                <p className="text-xs text-[#4B5563] mb-5">FocusArx is more than a timer</p>
                <div className="space-y-3 mb-6">
                  {aiTools.map((tool, i) => (
                    <motion.div
                      key={tool.title}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.15 }}
                      className="flex items-center gap-3 rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.07)] p-3"
                    >
                      <span className="text-2xl">{tool.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-[#E2E8F0]">{tool.title}</p>
                        <p className="text-xs text-[#4B5563]">{tool.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex-1 rounded-xl border border-[rgba(255,255,255,0.06)] py-3 text-sm text-[#6B7280] hover:text-[#E2E8F0]">← Back</button>
                  <button
                    onClick={finish}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
                  >Let's Go 🚀</button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
