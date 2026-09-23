import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiJson, ApiError } from "@/lib/api";
import { Volume2, Crown, Lock, Coins, ArrowRight, Sparkles } from "lucide-react";
import { Brain } from "lucide-react";
import { usePremium } from "@/hooks/usePremium";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

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


interface CoachStatus {
  isPremium?: boolean;
  lockScreen?: {
    description?: string;
    benefits?: string[];
    currentBalance?: number; tokensNeeded?: number;
    plan?: { durationDays?: number; tokenCost?: number } | null;
  } | null;
}

async function fetchCoachStatus() {
  return apiJson<CoachStatus>("/api/coach/status");
}

export default function CoachPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try {
      return localStorage.getItem("fx-coach-voice") !== "false";
    } catch {
      return false;
    }
  });

  const { isPremium, isLoading: premiumLoading } = usePremium();

  const { data: coachStatus } = useQuery({
    queryKey: ["coach-status"],
    queryFn: fetchCoachStatus,
    enabled: open && !premiumLoading,
    staleTime: 30_000,
  });

  const isLocked = coachStatus ? !coachStatus.isPremium : !isPremium && !premiumLoading;
  const lockScreen = coachStatus?.lockScreen;


  useEffect(() => {
    try {
      localStorage.setItem("fx-coach-voice", String(voiceEnabled));
    } catch {}
  }, [voiceEnabled]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [hasProactive, setHasProactive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [proactiveMsg, setProactiveMsg] = useState(() => PROACTIVE_MESSAGES[0]!);
  useEffect(() => {
    if (open || hasProactive || isLocked) return;
    const t = setTimeout(() => {
      // Picked at fire time, not in render: the clock may not run during render.
      setProactiveMsg(PROACTIVE_MESSAGES[Math.floor(Date.now() / 300_000) % PROACTIVE_MESSAGES.length]!);
      setHasProactive(true);
    }, 3 * 60 * 1000);
    return () => clearTimeout(t);
  }, [open, hasProactive, isLocked]);

  // While the chat panel is open it occupies exactly the band the Quick
  // Launch orb sits in (index.css). Flag it on <html> so the orb steps aside
  // for as long as the panel is up — the same document-attribute pattern the
  // focus mode uses with [data-focus-mode='active'].
  useEffect(() => {
    const root = document.documentElement;
    if (open) {
      root.setAttribute("data-coach-open", "true");
      return () => root.removeAttribute("data-coach-open");
    }
  }, [open]);

  const fetchTip = useCallback(async () => {
    if (isLocked) return; // Do not load AI model for free users
    try {
      const d = await apiJson<{ tip?: string | null; error?: string; fallback?: boolean }>("/api/coach/session-tip", { method: "POST" });
      if (d.fallback) setIsFallback(true);
      if (d.tip) {
        setMessages([{ role: "assistant", content: d.tip }]);
      } else {
        setMessages([{ role: "assistant", content: "Hey! I'm your FocusArx Coach. Ask me anything about focus, productivity, or your current session 🎯" }]);
      }
    } catch {
      setMessages([{ role: "assistant", content: "Hey! I'm your FocusArx Coach. Ask me anything about focus, productivity, or your current session 🎯" }]);
    }
  }, [isLocked]);

  useEffect(() => {
    // Deferred a tick: fetchTip sets state, and a synchronous call here would
    // cascade renders during the effect phase.
    if (open && messages.length === 0 && !isLocked) {
      const t = setTimeout(() => void fetchTip(), 0);
      if (open) {
        const f = setTimeout(() => inputRef.current?.focus(), 300);
        return () => { clearTimeout(t); clearTimeout(f); };
      }
      return () => clearTimeout(t);
    }
    if (open) {
      const f = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(f);
    }
  }, [open, isLocked, messages.length, fetchTip]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    if (isLocked) return; // Block AI requests for free users
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMsg: Message = { role: "user", content: text };
    const newHistory = [...messages, newMsg];
    setMessages(newHistory);
    setLoading(true);

    try {
      const d = await apiJson<{ reply?: string; error?: string; fallback?: boolean }>("/api/coach/chat", {
        method: "POST",
        body: JSON.stringify({
          message: text,
          conversationHistory: messages.slice(-8),
        }),
      });
      if (d.fallback) setIsFallback(true);
      const reply = d.reply ?? "Stay focused — you've got this!";
      setMessages((h) => [...h, { role: "assistant", content: reply }]);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        // Premium required — show lock
        setMessages((h) => [...h, { role: "assistant", content: "Focus Coach is Premium-only. Unlock with Focus Tokens to continue." }]);
        setLoading(false);
        return;
      }
      setMessages((h) => [...h, { role: "assistant", content: "Connection issue — try again in a moment." }]);
    }
    setLoading(false);
  };


  return (
    <>
      {/* Proactive nudge — only for premium */}
      <AnimatePresence>
        {hasProactive && !open && !isLocked && (
          <motion.button
            key="nudge"
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            onClick={() => {
              setOpen(true);
              setHasProactive(false);
            }}
            className="fixed bottom-28 right-20 z-[var(--z-nav)] max-w-[220px] rounded-2xl border border-[var(--rgba-124-58-237-0_35)] bg-[var(--rgba-8-12-28-0_96)] px-4 py-3 text-left"
          >
            <p className="mb-1 text-[11px] font-semibold text-[var(--brand-400)]">Coach tip 🧠</p>
            <p className="text-[11px] leading-relaxed text-[var(--foreground-muted)]">{proactiveMsg}</p>
            <p className="mt-2 text-[11px] text-[var(--foreground-subtle)]">Tap to reply →</p>
          </motion.button>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => {
          setOpen((o) => !o);
          setHasProactive(false);
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        className="fixed bottom-28 right-4 z-[var(--z-nav)] flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-600)] md:bottom-10 md:right-6"
        title="FocusArx Coach"
        aria-label={open ? "Close coach" : "Open coach"}
      >
        {hasProactive && !open && !isLocked && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[var(--palette-f97316)] ring-2 ring-[var(--rgba-8-12-28-0_97)]" />
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
            className="fixed bottom-44 right-4 z-[var(--z-nav)] flex w-[340px] max-sm:w-[calc(100vw-2rem)] max-h-[480px] flex-col rounded-2xl border border-[var(--rgba-124-58-237-0_3)] bg-[var(--rgba-8-12-28-0_92)] shadow-[var(--shadow-lg)] md:bottom-28 md:right-6"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-[var(--rgba-124-58-237-0_15)] px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-600)] text-sm"><Brain size={16} aria-hidden="true" /></div>
              <div>
                <p className="text-sm font-bold text-[var(--foreground)]">FocusArx Coach</p>
                <p className="text-[11px] text-[var(--foreground-subtle)]">{isLocked ? "Premium feature" : "Productivity & neuroscience"}</p>
              </div>
              {!isLocked && (
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`ml-auto rounded-lg border p-1.5 transition-all ${voiceEnabled ? "border-[var(--brand-400)]/40 bg-[var(--brand-400)]/10 text-[var(--brand-400)]" : "border-[var(--palette-white)]/5 text-[var(--foreground-subtle)]"}`}
                  title={voiceEnabled ? "Voice Enabled" : "Voice Disabled"}
                >
                  <Volume2 size={14} className={voiceEnabled ? "animate-pulse" : ""} />
                </button>
              )}
              {isFallback && !isLocked && (
                <span className="ml-auto rounded border border-[var(--border-subtle)] px-1.5 py-0.5 text-[11px] text-[var(--palette-zinc-600)]">Basic</span>
              )}
            </div>

            {isLocked ? (
              /* Premium lock screen — no AI model loaded */
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--palette-amber-500)]/10 text-[var(--palette-amber-400)]">
                  <Lock size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Focus Coach is available with Premium access</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--foreground-muted)]">
                    {lockScreen?.description ?? "Unlock personalized focus plans, session analysis, and productivity guidance using Focus Tokens."}
                  </p>
                </div>

                {lockScreen && (
                  <div className="w-full rounded-xl bg-[var(--surface-hover)] p-3 text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)]">What you get</p>
                    <ul className="mt-2 space-y-1">
                      {(lockScreen.benefits ?? []).slice(0, 4).map((b: string) => (
                        <li key={b} className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
                          <Sparkles size={12} className="text-[var(--brand-400)]" /> {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {lockScreen && (
                  <div className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Coins size={14} className="text-[var(--brand-400)]" /> Your balance
                      </span>
                      <span className="font-bold tabular-nums">{lockScreen.currentBalance?.toLocaleString() ?? 0} tokens</span>
                    </div>
                    {lockScreen.plan && (
                      <>
                        <div className="mt-1.5 flex items-center justify-between text-[var(--foreground-subtle)]">
                          <span>Need for {lockScreen.plan.durationDays} days</span>
                          <span className="font-medium">{lockScreen.plan.tokenCost?.toLocaleString()} tokens</span>
                        </div>
                        {(lockScreen.tokensNeeded ?? 0) > 0 && (
                          <p className="mt-2 text-[11px] text-[var(--warning)]">
                            You currently have {lockScreen.currentBalance?.toLocaleString()} tokens and need {lockScreen.tokensNeeded?.toLocaleString()} more for {lockScreen.plan.durationDays} days of Premium.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="flex w-full flex-col gap-2">
                  <Link
                    href="/premium"
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[var(--palette-amber-500)] px-4 py-2.5 text-sm font-bold text-white"
                    onClick={() => setOpen(false)}
                  >
                    <Crown size={16} /> View Premium benefits
                  </Link>
                  <Link
                    href="/quests"
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-2.5 text-sm font-medium"
                    onClick={() => setOpen(false)}
                  >
                    Earn tokens through quests <ArrowRight size={14} />
                  </Link>
                </div>
                <p className="text-[11px] text-[var(--foreground-subtle)]">No real-money payments. Unlock purely through productivity.</p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Messages */}
                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${ msg.role === "user" ? "rounded-br-sm bg-[var(--brand-600)] text-[var(--palette-white)]" : "rounded-bl-sm bg-[var(--rgba-124-58-237-0_1)] text-[var(--foreground)]" }`}
                      >
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-sm bg-[var(--rgba-124-58-237-0_1)] px-4 py-3">
                        <div className="flex gap-1">
                          {[0, 0.2, 0.4].map((d, i) => (
                            <motion.div
                              key={i}
                              className="h-1.5 w-1.5 rounded-full bg-[var(--brand-400)]"
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

                {messages.length <= 1 && !loading && (
                  <div className="flex flex-wrap gap-1.5 px-4 pb-2">
                    {QUICK_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setInput(p);
                          setTimeout(() => inputRef.current?.focus(), 0);
                        }}
                        className="rounded-full border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_06)] px-3 py-1 text-[11px] font-medium text-[var(--muted-fg)] transition-all hover:border-[var(--rgba-124-58-237-0_4)] hover:text-[var(--brand-400)]"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}

                <div className="border-t border-[var(--rgba-124-58-237-0_15)] p-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value.slice(0, 1000))}
                        onKeyDown={(e) => e.key === "Enter" && void send()}
                        placeholder="Ask your coach…"
                        maxLength={1000}
                        className="w-full rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_05)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--foreground-subtle)] focus:border-[var(--brand-600)] focus:outline-none"
                      />
                      {input.length > 800 && <span className="absolute bottom-1 right-2 text-[11px] text-[var(--color-error)]">{1000 - input.length}</span>}
                    </div>
                    <button
                      onClick={() => void send()}
                      disabled={!input.trim() || loading}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-600)] text-[var(--palette-white)] transition hover:bg-[var(--brand-700)] disabled:opacity-40"
                      aria-label="Send message"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
