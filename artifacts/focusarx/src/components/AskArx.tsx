/**
 * Ask Arx (Workstream G, G2) — the focus companion, in the focus sidebar.
 *
 * Type "Arx " + anything. LLM replies are capped at 30/user/day
 * (server-enforced); beyond the cap — or with zero AI keys configured —
 * Arx still answers from its always-supportive template pool. Every reply
 * is sanitized server-side so it can never discourage you.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Sparkles, Send, Square } from "lucide-react";
import { openVoiceCapture } from "@/lib/voiceCapture";

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

const OFFLINE_REPLY: Reply = {
  reply: "I'm here — one small step is enough. Try one 25-minute block.",
  source: "template",
  llmRemaining: 30,
};

/**
 * Speech recognition is still vendor-prefixed in every browser that ships it,
 * and it is *optional*: the mic button only appears when one of these exists, so
 * a browser without it gets the text box instead of a button that does nothing.
 */
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Read a reply aloud. Silently a no-op where the browser has no voices. */
function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  } catch { /* talk-back is a bonus, never an error */ }
}

export default function AskArx() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [busy, setBusy] = useState(false);
  /** True when the request reached the server but did not return a usable reply. */
  const [unavailable, setUnavailable] = useState(false);

  /* Voice mode: listen → send the transcript → speak the reply. */
  const [listening, setListening] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [created, setCreated] = useState<{ kind: string; title: string } | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionCtor = getSpeechRecognition();

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  const askByVoice = async (transcript: string) => {
    if (!transcript.trim()) return;
    setVoiceBusy(true);
    setVoiceError(null);
    setCreated(null);
    try {
      const token = localStorage.getItem("focusarx-auth-token");
      const r = await fetch("/api/arx/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ transcript, context: "focus sidebar" }),
      });
      if (!r.ok) throw new Error(`voice:${r.status}`);
      const d = await r.json();
      setReply({ reply: d.reply, source: d.source === "llm" ? "llm" : "template", llmRemaining: d.llmRemaining ?? 30 });
      setCreated(null);
      if (d.needsReview || (d.action?.type && d.action.type !== "none")) {
        openVoiceCapture(transcript);
      }
      speak(d.spoken ?? d.reply);
    } catch {
      setVoiceError("I couldn't hear that clearly — try again or type it.");
    } finally {
      setVoiceBusy(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionCtor) return;
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const recognition = new recognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = navigator.language || "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        const alternative = event.results[i]?.[0];
        if (alternative?.transcript) transcript += alternative.transcript;
      }
      void askByVoice(transcript.trim());
    };
    recognition.onerror = (event) => {
      setListening(false);
      // "no-speech" is a person staying quiet, not a failure worth alarming them about.
      if (event?.error !== "no-speech" && event?.error !== "aborted") {
        setVoiceError(event?.error === "not-allowed" ? "Microphone permission is blocked for this site." : "Voice input hit a problem — you can type instead.");
      }
    };
    recognition.onend = () => setListening(false);
    try {
      setVoiceError(null);
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setVoiceError("Voice input is unavailable right now.");
    }
  };

  const ask = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    const full = /^arx[\s,:!-]/i.test(message) ? message : `Arx ${message}`;
    setBusy(true);
    setReply(null);
    setUnavailable(false);
    try {
      const token = localStorage.getItem("focusarx-auth-token");
      const r = await fetch("/api/arx/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: full }),
      });
      // fetch only rejects on network failure — a 429/500 resolves normally and
      // used to leave the spinner stopping on silence with no user feedback.
      if (!r.ok) throw new Error(`arx:${r.status}`);
      const d = (await r.json()) as Reply;
      setReply(d);
      setInput("");
    } catch {
      setReply(OFFLINE_REPLY);
      setUnavailable(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ui-panel p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
          <Sparkles size={12} className="text-[var(--brand-400)]" /> Ask Arx
        </span>
        <span className={`text-[0.6875rem] text-[var(--foreground-subtle)] transition-transform duration-[var(--duration-fast)] ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="mt-3">
          {reply ? (
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--brand-soft)] p-3">
              <p className="text-xs leading-relaxed text-[var(--brand-strong)]" aria-live="polite">{reply.reply}</p>
              <p className="mt-2 text-[0.6875rem] text-[var(--foreground-subtle)]">
                {unavailable
                  ? "Arx is offline right now — here's a nudge instead"
                  : reply.source === "llm"
                    ? `Arx · ${reply.llmRemaining} smart replies left today`
                    : "Arx · smart replies done for today — template mode"}
              </p>
              {created && (
                <p className="mt-2 rounded-lg border border-[var(--success)]/40 bg-[var(--success-soft)] px-2 py-1.5 text-[0.6875rem] font-semibold text-[var(--success)]">
                  ✓ {created.kind === "goal" ? "Goal" : "Task"} created: {created.title}
                </p>
              )}
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setReply(null); setUnavailable(false); setCreated(null); }}
                  className="text-[0.6875rem] font-semibold text-[var(--foreground-muted)] underline-offset-2 transition-colors hover:text-[var(--brand-strong)] hover:underline"
                >
                  Ask something else
                </button>
                {"speechSynthesis" in (typeof window === "undefined" ? {} : window) && (
                  <button
                    type="button"
                    onClick={() => speak(reply.reply)}
                    className="text-[0.6875rem] font-semibold text-[var(--foreground-muted)] underline-offset-2 transition-colors hover:text-[var(--brand-strong)] hover:underline"
                  >
                    Read aloud
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(s)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--input-bg)] px-2.5 py-1.5 text-left text-xs text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)] hover:border-[var(--brand-500)]/40 disabled:opacity-40"
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
              className="flex-1 min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--input-bg)] px-2.5 py-1.5 text-xs text-[var(--foreground)] placeholder-[var(--foreground-subtle)] outline-none focus:border-[var(--brand-500)] transition-colors"
            />
            {recognitionCtor && (
              <button
                type="button"
                onClick={toggleListening}
                disabled={voiceBusy}
                aria-pressed={listening}
                aria-label={listening ? "Stop listening" : "Speak to Arx"}
                title={listening ? "Listening… tap to stop" : "Speak to Arx — ask for a task or a goal"}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                  listening
                    ? "border-[var(--palette-rose-500)]/60 bg-[var(--palette-rose-500)]/15 text-[var(--palette-rose-400)]"
                    : "border-[var(--border-subtle)] bg-[var(--input-bg)] text-[var(--foreground-muted)] hover:text-[var(--brand-strong)]"
                }`}
              >
                {listening ? <Square size={12} className="align-middle" /> : <Mic size={12} className="align-middle" />}
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-lg border border-[var(--brand-500)]/50 bg-[var(--brand-500)]/10 px-2.5 py-1.5 text-xs font-semibold text-[var(--brand-strong)] transition-colors hover:bg-[var(--brand-500)]/20 disabled:opacity-40"
            >
              {busy ? <span className="inline-block h-3 w-3 animate-spin rounded-full border border-[var(--brand-strong)] border-t-transparent align-middle" /> : <Send size={12} className="align-middle" />}
            </button>
          </form>

          {(listening || voiceBusy || voiceError) && (
            <p className="mt-2 text-[0.6875rem] text-[var(--foreground-subtle)]" aria-live="polite">
              {voiceError ?? (voiceBusy ? "Thinking about what you said…" : "Listening — say “add task revise optics for 30 minutes”.")}
            </p>
          )}
          <p className="mt-1 text-[0.6875rem] text-[var(--foreground-subtle)]">
            Voice can also create things: “add task …”, “set goal …”. Arx replies out loud.
          </p>
        </motion.div>
      )}
    </div>
  );
}
