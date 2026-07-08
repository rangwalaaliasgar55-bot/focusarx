import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";

type Message = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "I'm feeling distracted 😵",
  "Help me prioritise",
  "I'm procrastinating",
  "Motivation boost 🚀",
];

const PROACTIVE_MESSAGES = [
  "You've been grinding. Take a 5-min walk — your next session will be sharper.",
  "Deep work tip: silence notifications now. Even one ping costs 23 minutes of focus.",
  "Quick win: write down the ONE thing that matters most today. Then start there.",
  "Working in 25-min bursts is scientifically proven to sustain energy. Timer ready?",
  "Hydrate. Seriously. Even mild dehydration tanks cognitive performance by 10-15%.",
];

export default function CoachPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [hasProactive, setHasProactive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Proactive nudge after 3 minutes of inactivity
  useEffect(() => {
    if (open || hasProactive) return;
    const t = setTimeout(() => {
      setHasProactive(true);
    }, 3 * 60 * 1000);
    return () => clearTimeout(t);
  }, [open, hasProactive]);

  const headers = () => {
    const token = getToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    if (open && messages.length === 0) {
      void fetchTip();
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchTip = async () => {
    try {
      const r = await fetch("/api/coach/session-tip", { headers: headers() });
      const d = await r.json() as { tip?: string | null; error?: string; fallback?: boolean };
      if (d.fallback) setIsFallback(true);
      if (d.tip) {
        setMessages([{ role: "assistant", content: d.tip }]);
      } else {
        setMessages([{ role: "assistant", content: "Hey! I'm your FocusArx Coach. Ask me anything about focus, productivity, or your current session 🎯" }]);
      }
    } catch {
      setMessages([{ role: "assistant", content: "Hey! I'm your FocusArx Coach. Ask me anything about focus, productivity, or your current session 🎯" }]);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMsg: Message = { role: "user", content: text };
    const newHistory = [...messages, newMsg];
    setMessages(newHistory);
    setLoading(true);

    try {
      const r = await fetch("/api/coach/chat", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          message: text,
          conversationHistory: messages.slice(-8),
        }),
      });
      const d = await r.json() as { reply?: string; error?: string; fallback?: boolean };
      if (d.fallback) setIsFallback(true);
      const reply = d.reply ?? "Stay focused — you've got this!";
      setMessages(h => [...h, { role: "assistant", content: reply }]);
    } catch {
      setMessages(h => [...h, { role: "assistant", content: "Connection issue — try again in a moment." }]);
    }
    setLoading(false);
  };

  const proactiveMsg = PROACTIVE_MESSAGES[Math.floor(Date.now() / 300_000) % PROACTIVE_MESSAGES.length]!;

  return (
    <>
      {/* Proactive nudge badge */}
      <AnimatePresence>
        {hasProactive && !open && (
          <motion.button
            key="nudge"
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            onClick={() => { setOpen(true); setHasProactive(false); }}
            className="fixed bottom-44 right-4 z-40 max-w-[220px] rounded-2xl border border-[rgba(124,58,237,0.35)] bg-[rgba(8,12,28,0.96)] px-4 py-3 text-left shadow-[0_4px_20px_rgba(124,58,237,0.25)] backdrop-blur-2xl md:bottom-28 md:right-20"
          >
            <p className="text-[11px] font-semibold text-[#A78BFA] mb-1">Coach tip 🧠</p>
            <p className="text-[11px] leading-relaxed text-[#94A3B8]">{proactiveMsg}</p>
            <p className="mt-2 text-[10px] text-[#4B5563]">Tap to reply →</p>
          </motion.button>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => { setOpen(o => !o); setHasProactive(false); }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        className="fixed bottom-28 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] shadow-[0_4px_20px_rgba(124,58,237,0.5)] md:bottom-10 md:right-6"
        title="FocusArx Coach"
        aria-label={open ? "Close coach" : "Open coach"}
      >
        {/* Unread dot */}
        {hasProactive && !open && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#F97316] ring-2 ring-[rgba(8,12,28,0.97)]" />
        )}
        <span className="text-xl">{open ? "✕" : "🧠"}</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-44 right-4 z-40 flex w-[340px] max-sm:w-[calc(100vw-2rem)] max-h-[480px] flex-col rounded-2xl border border-[rgba(124,58,237,0.3)] bg-[rgba(8,12,28,0.92)] shadow-2xl backdrop-blur-2xl md:bottom-28 md:right-6"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-[rgba(124,58,237,0.15)] px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-sm">🧠</div>
              <div>
                <p className="text-sm font-bold text-[#E2E8F0]">FocusArx Coach</p>
                <p className="text-[10px] text-[#4B5563]">Productivity & neuroscience</p>
              </div>
              {isFallback && (
                <span className="ml-auto text-[9px] text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5">Basic</span>
              )}
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "rounded-br-sm bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-white"
                        : "rounded-bl-sm bg-[rgba(124,58,237,0.1)] text-[#E2E8F0]"
                    }`}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm bg-[rgba(124,58,237,0.1)] px-4 py-3">
                      <div className="flex gap-1">
                        {[0, 0.2, 0.4].map((d, i) => (
                          <motion.div key={i} className="h-1.5 w-1.5 rounded-full bg-[#A78BFA]"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ repeat: Infinity, duration: 1, delay: d }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Quick prompts — only show when there's only 1 message (opening tip) */}
              {messages.length <= 1 && !loading && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setInput(p); setTimeout(() => inputRef.current?.focus(), 0); }}
                      className="rounded-full border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.06)] px-3 py-1 text-[10px] font-medium text-[#64748B] transition-all hover:border-[rgba(124,58,237,0.4)] hover:text-[#A78BFA]"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="border-t border-[rgba(124,58,237,0.15)] p-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value.slice(0, 1000))}
                      onKeyDown={e => e.key === "Enter" && void send()}
                      placeholder="Ask your coach…"
                      maxLength={1000}
                      className="w-full rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.05)] px-3 py-2 text-sm text-[#E2E8F0] placeholder-[#4B5563] focus:border-[#7C3AED] focus:outline-none"
                    />
                    {input.length > 800 && (
                      <span className="absolute bottom-1 right-2 text-[9px] text-[#EF4444]">{1000 - input.length}</span>
                    )}
                  </div>
                  <button
                    onClick={() => void send()}
                    disabled={!input.trim() || loading}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7C3AED] text-white transition hover:bg-[#6D28D9] disabled:opacity-40"
                    aria-label="Send message"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
