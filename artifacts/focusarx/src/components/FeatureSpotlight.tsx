import { motion } from "framer-motion";
import { useLocation } from "wouter";

export default function FeatureSpotlight() {
  const [, setLocation] = useLocation();
  const sessions = parseInt(localStorage.getItem("focusSessionsCount") || "0");
  if (sessions >= 3) return null;

  const cards = [
    {
      icon: "📷",
      title: "AI is watching (in a good way)",
      body: "Enable your camera. FocusArx detects when you look away and logs distraction events.",
      btn: "Enable Camera",
      action: () => setLocation("/"),
    },
    {
      icon: "🗺️",
      title: "Your personalized study plan",
      body: "Tell us your goals. Our AI builds a day-by-day roadmap and auto-schedules tasks.",
      btn: "Generate My Roadmap",
      action: () => setLocation("/roadmap"),
    },
    {
      icon: "⚡",
      title: "Enter deep work mode",
      body: "Distraction-free environment. Blocks notifications. Full screen. Pure focus.",
      btn: "Enter Forge Room",
      action: () => setLocation("/forge"),
    },
  ];

  return (
    <div className="w-full mt-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4a4f62] mb-3">Explore AI Features</p>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex-shrink-0 w-52 rounded-2xl border border-[#1e2130] bg-[#111318] p-4 flex flex-col gap-3"
          >
            <span className="text-2xl">{card.icon}</span>
            <div className="flex-1">
              <p className="text-xs font-bold text-[#E2E8F0] mb-1 leading-snug">{card.title}</p>
              <p className="text-[11px] text-[#4B5563] leading-relaxed">{card.body}</p>
            </div>
            <button
              onClick={card.action}
              className="rounded-lg border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.1)] px-3 py-1.5 text-[11px] font-semibold text-[#A78BFA] hover:bg-[rgba(124,58,237,0.2)] transition-colors"
            >{card.btn}</button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
