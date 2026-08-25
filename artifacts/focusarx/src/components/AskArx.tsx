/**
 * Ask Arx (Workstream G, G2) — the focus companion, in the focus sidebar.
 *
 * Type "Arx " + anything. LLM replies are capped at 30/user/day
 * (server-enforced); beyond the cap — or with zero AI keys configured —
 * Arx still answers from its always-supportive template pool. Every reply
 * is sanitized server-side so it can never discourage you.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Send } from "lucide-react";

type Reply = {
  reply: string;
  source: "llm" | "template";
  llmRemaining: number;
};

const SUGGESTIONS = [
  "I'm overwhelmed by the syllabus",
  "How do I start when I feel stuck?",
  "I can't sleep before the exam",
];

export default function AskArx() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    const full = /^arx[\s,:!-]/i.test(message) ? message : `Arx ${message}`;
    setBusy(true);
    setReply(null);
    try {
      const token = localStorage.getItem("focusarx-auth-token");
      const r = await fetch("/api/arx/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: full }),
      });
      if (r.ok) {
        const d = (await r.json()) as Reply;
        setReply(d);
        setInput("");
      }
    } catch {
      setReply({ reply: "I'm here — one small step is enough. Try one 25-minute block.", source: "template", llmRemaining: 30 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--palette-4a4f62)]">
          <Sparkles size={12} className="text-[var(--brand-400)]" /> Ask Arx
        </span>
        <span className={`text-[10px] text-[var(--palette-3a3d4a)] transition-transform duration-[var(--duration-fast)] ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="mt-3">
          {reply ? (
            <div className="rounded-xl border border-[var(--rgba-124-58-237-0_25)] bg-[var(--rgba-124-58-237-0_08)] p-3">
              <p className="text-xs leading-relaxed text-[var(--palette-a5a8ff)]">{reply.reply}</p>
              <p className="mt-2 text-[9px] text-[var(--palette-3a3d4a)]">
                {reply.source === "llm" ? `Arx · ${reply.llmRemaining} smart replies left today` : "Arx · smart replies done for today — template mode"}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(s)}
                  className="w-full rounded-lg border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_03)] px-2.5 py-1.5 text-left text-[11px] text-[var(--palette-6b7080)] transition-colors hover:text-[var(--palette-9095a8)] hover:border-[var(--palette-6c63ff)]/40 disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="mt-2.5 flex gap-1.5"
            onSubmit={(e) => { e.preventDefault(); void ask(); }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Arx anything…"
              maxLength={200}
              className="flex-1 min-w-0 rounded-lg border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_03)] px-2.5 py-1.5 text-xs text-[var(--foreground)] placeholder-[var(--foreground-subtle)] outline-none focus:border-[var(--palette-6c63ff)] transition-colors"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-lg border border-[var(--palette-6c63ff)]/50 bg-[var(--palette-6c63ff)]/10 px-2.5 py-1.5 text-xs font-semibold text-[var(--palette-a5a8ff)] transition-colors hover:bg-[var(--palette-6c63ff)]/20 disabled:opacity-40"
            >
              {busy ? <span className="inline-block h-3 w-3 animate-spin rounded-full border border-[var(--palette-a5a8ff)] border-t-transparent align-middle" /> : <Send size={12} className="align-middle" />}
            </button>
          </form>
        </motion.div>
      )}
    </div>
  );
}
