import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Star } from "lucide-react";
import { getToken } from "@/lib/auth";

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

export default function SeasonalBanner() {
  const [event, setEvent] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const key = "focusarx-seasonal-banner-dismissed";
    const d = localStorage.getItem(key);
    if (d && Date.now() - parseInt(d) < 24 * 60 * 60 * 1000) { setDismissed(true); return; }

    fetch("/api/seasonal/active", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setEvent(d); })
      .catch(() => {});
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("focusarx-seasonal-banner-dismissed", Date.now().toString());
  };

  if (!event || dismissed) return null;

  const daysLeft = Math.ceil((new Date(event.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
        className="relative flex items-center gap-3 rounded-xl border px-4 py-3 text-sm"
        style={{ borderColor: event.bannerColor + "40", background: event.bannerColor + "10" }}
      >
        <Star size={15} style={{ color: event.bannerColor }} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold" style={{ color: event.bannerColor }}>{event.name}</span>
          <span className="text-[#94A3B8] ml-2 text-xs">{event.description}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {event.xpMultiplier > 1 && (
            <span className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold"
              style={{ color: event.bannerColor, borderColor: event.bannerColor + "40", background: event.bannerColor + "15" }}>
              <Zap size={9} /> {event.xpMultiplier}x XP
            </span>
          )}
          <span className="text-[10px] text-[#4B5563]">{daysLeft}d left</span>
          <button onClick={handleDismiss} className="text-[#4B5563] hover:text-[#94A3B8] transition-colors">
            <X size={13} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
