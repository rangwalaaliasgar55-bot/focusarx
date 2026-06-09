import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";

interface TickerItem {
  id: string;
  message: string;
  emoji: string;
}

const MAX_VISIBLE = 3;

export function LiveActivityTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;

    function addItem(emoji: string, message: string) {
      const id = `tick-${++counterRef.current}`;
      setItems(prev => [...prev.slice(-(MAX_VISIBLE - 1)), { id, emoji, message }]);
      setTimeout(() => {
        setItems(prev => prev.filter(i => i.id !== id));
      }, 5000);
    }

    sock.on("session:complete", (data: { username: string; durationMin: number; mode: string }) => {
      addItem("🎯", `${data.username} completed a ${data.durationMin}m ${data.mode} session`);
    });
    sock.on("achievement:unlock", (data: { username: string; badge: { name: string } }) => {
      addItem("🏆", `${data.username} unlocked "${data.badge.name}"`);
    });
    sock.on("streak:milestone", (data: { username: string; days: number }) => {
      addItem("🔥", `${data.username} hit a ${data.days}-day streak!`);
    });
    sock.on("user:levelup", (data: { username: string; newLevel: number }) => {
      addItem("⚡", `${data.username} reached Level ${data.newLevel}!`);
    });

    return () => {
      sock.off("session:complete");
      sock.off("achievement:unlock");
      sock.off("streak:milestone");
      sock.off("user:levelup");
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence>
        {items.map(item => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 80, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2 shadow-lg text-sm text-white max-w-xs"
          >
            <span>{item.emoji}</span>
            <span className="truncate">{item.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
