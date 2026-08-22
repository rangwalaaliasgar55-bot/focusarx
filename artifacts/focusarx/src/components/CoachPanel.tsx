import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";
import { Volume2, VolumeX, MessageSquare, Brain } from "lucide-react";

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

const COACH_AUDIO: Record<string, string> = {
  session_start: "/audio/coach/session_start.mp3",
  session_complete: "/audio/coach/session_complete.mp3",
  break_time: "/audio/coach/break_time.mp3",
  distraction: "/audio/coach/distraction_detected.mp3",
  forge: "/audio/coach/forge_welcome.mp3",
};

export default function CoachPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try { return localStorage.getItem("fx-coach-voice") === "true"; } catch { return false; }
  });

  const playCoachVoice = (key: keyof typeof COACH_AUDIO) => {
    if (!voiceEnabled) return;
    const audio = new Audio(COACH_AUDIO[key]);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  };

  useEffect(() => {
    try { localStorage.setItem("fx-coach-voice", String(voiceEnabled)); } catch {}
  }, [voiceEnabled]);
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
            className="fixed bottom-44 right-4 z-[var(--z-nav)] max-w-[220px] rounded-2xl border border-[var(--rgba-124-58-237-0_35)] bg-[var(--rgba-8-12-28-0_96)] px-4 py-3 text-left shadow-[0_4px_20px_var(--rgba-124-58-237-0_25)] backdrop-blur-2xl md:bottom-28 md:right-20"
          >
            <p className="text-[11px] font-semibold text-[var(--brand-400)] mb-1">Coach tip 🧠</p>
            <p className="text-[11px] leading-relaxed text-[var(--foreground-muted)]">{proactiveMsg}</p>
            <p className="mt-2 text-[10px] text-[var(--foreground-subtle)]">Tap to reply →</p>
          </motion.button>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => { setOpen(o => !o); setHasProactive(false); }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        className="fixed bottom-28 right-4 z-[var(--z-nav)] flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-600)] to-[var(--palette-4f46e5)] shadow-[0_4px_20px_var(--rgba-124-58-237-0_5)] md:bottom-10 md:right-6"
        title="FocusArx Coach"
        aria-label={open ? "Close coach" : "Open coach"}
      >
        {/* Unread dot */}
        {hasProactive && !open && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[var(--palette-f97316)] ring-2 ring-[var(--rgba-8-12-28-0_97)]" />
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
            className="fixed bottom-44 right-4 z-[var(--z-nav)] flex w-[340px] max-sm:w-[calc(100vw-2rem)] max-h-[480px] flex-col rounded-2xl border border-[var(--rgba-124-58-237-0_3)] bg-[var(--rgba-8-12-28-0_92)] shadow-2xl backdrop-blur-2xl md:bottom-28 md:right-6"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-[var(--rgba-124-58-237-0_15)] px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-600)] to-[var(--palette-4f46e5)] text-sm">🧠</div>
              <div>
                <p className="text-sm font-bold text-[var(--foreground)]">FocusArx Coach</p>
                <p className="text-[10px] text-[var(--foreground-subtle)]">Productivity & neuroscience</p>
              </div>
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`ml-auto p-1.5 rounded-lg border transition-all ${voiceEnabled ? "border-[var(--brand-400)]/40 bg-[var(--brand-400)]/10 text-[var(--brand-400)]" : "border-[var(--palette-white)]/5 text-[var(--foreground-subtle)]"}`}
                title={voiceEnabled ? "Voice Enabled" : "Voice Disabled"}
              >
                <Volume2 size={14} className={voiceEnabled ? "animate-pulse" : ""} />
              </button>
              {isFallback && (
                <span className="ml-auto text-[9px] text-[var(--palette-zinc-600)] border border-[var(--palette-zinc-800)] rounded px-1.5 py-0.5">Basic</span>
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
                        ? "rounded-br-sm bg-gradient-to-br from-[var(--brand-600)] to-[var(--palette-4f46e5)] text-[var(--palette-white)]"
                        : "rounded-bl-sm bg-[var(--rgba-124-58-237-0_1)] text-[var(--foreground)]"
                    }`}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm bg-[var(--rgba-124-58-237-0_1)] px-4 py-3">
                      <div className="flex gap-1">
                        {[0, 0.2, 0.4].map((d, i) => (
                          <motion.div key={i} className="h-1.5 w-1.5 rounded-full bg-[var(--brand-400)]"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ repeat: Infinity, duration: 0.4, delay: d }}
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
                      className="rounded-full border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_06)] px-3 py-1 text-[10px] font-medium text-[var(--muted-fg)] transition-all hover:border-[var(--rgba-124-58-237-0_4)] hover:text-[var(--brand-400)]"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="border-t border-[var(--rgba-124-58-237-0_15)] p-3">
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
                      className="w-full rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_05)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:border-[var(--brand-600)] focus:outline-none"
                    />
                    {input.length > 800 && (
                      <span className="absolute bottom-1 right-2 text-[9px] text-[var(--color-error)]">{1000 - input.length}</span>
                    )}
                  </div>
                  <button
                    onClick={() => void send()}
                    disabled={!input.trim() || loading}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-600)] text-[var(--palette-white)] transition hover:bg-[var(--brand-700)] disabled:opacity-40"
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
