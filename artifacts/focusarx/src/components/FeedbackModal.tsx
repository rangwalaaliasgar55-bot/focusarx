import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Send, Heart } from "lucide-react";
import { getToken } from "@/lib/auth";

const STORAGE_KEY = "focusarx_feedback_shown";
const SESSION_COUNT_KEY = "focusarx_total_sessions";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function useFeedbackTrigger() {
  const [show, setShow] = useState(false);

  const recordSession = useCallback(() => {
    const already = localStorage.getItem(STORAGE_KEY);
    if (already) return;
    const count = parseInt(localStorage.getItem(SESSION_COUNT_KEY) ?? "0", 10) + 1;
    localStorage.setItem(SESSION_COUNT_KEY, String(count));
    if (count === 3) {
      setTimeout(() => setShow(true), 2000);
    }
  }, []);

  const dismiss = useCallback(() => {
    setShow(false);
    localStorage.setItem(STORAGE_KEY, "dismissed");
  }, []);

  const onSubmit = useCallback(() => {
    setShow(false);
    localStorage.setItem(STORAGE_KEY, "submitted");
  }, []);

  return { show, recordSession, dismiss, onSubmit };
}

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const CATEGORIES = [
  { id: "general", label: "General", emoji: "💬" },
  { id: "features", label: "Features", emoji: "⚡" },
  { id: "bugs", label: "Bug", emoji: "🐛" },
  { id: "design", label: "Design", emoji: "🎨" },
  { id: "performance", label: "Speed", emoji: "🚀" },
];

export default function FeedbackModal({ open, onClose, onSubmit }: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setRating(0); setHovered(0); setMessage(""); setCategory("general");
        setSubmitted(false); setSubmitting(false);
      }, 400);
    }
  }, [open]);

  async function handleSubmit() {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const sessionCount = parseInt(localStorage.getItem(SESSION_COUNT_KEY) ?? "0", 10);
      await apiFetch("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ rating, message: message.trim() || undefined, category, sessionCount }),
      });
      setSubmitted(true);
      setTimeout(() => { onSubmit(); }, 1500);
    } catch {
      setSubmitting(false);
    }
  }

  const stars = [1, 2, 3, 4, 5];
  const activeRating = hovered || rating;
  const starLabels = ["", "Needs work", "It's okay", "Pretty good", "Really good", "Love it! 🔥"];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[var(--z-toast)] flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-[var(--palette-black)]/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-md rounded-2xl border border-[var(--rgba-124-58-237-0_3)] bg-[var(--palette-0e0c1a)] shadow-2xl overflow-hidden"
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Gradient header */}
            <div className="bg-gradient-to-r from-[var(--brand-600)]/20 to-[var(--palette-4f46e5)]/10 border-b border-[var(--rgba-124-58-237-0_2)] px-6 pt-6 pb-5">
              <button onClick={onClose} className="absolute top-4 right-4 rounded-lg p-1.5 text-[var(--palette-zinc-500)] hover:bg-[var(--palette-zinc-800)] hover:text-[var(--palette-white)] transition-colors">
                <X size={16} />
              </button>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[var(--rgba-124-58-237-0_2)] p-2.5">
                  <Heart size={20} className="text-[var(--brand-400)]" />
                </div>
                <div>
                  <p className="font-bold text-[var(--foreground)]">Enjoying FocusArx?</p>
                  <p className="text-[11px] text-[var(--palette-zinc-500)] mt-0.5">Help us build something unforgettable</p>
                </div>
              </div>
            </div>

            {submitted ? (
              <motion.div
                className="flex flex-col items-center justify-center py-10 px-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <motion.div
                  className="text-5xl mb-4"
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.4 }}
                >
                  🎉
                </motion.div>
                <p className="text-lg font-bold text-[var(--foreground)] mb-1">Thank you!</p>
                <p className="text-sm text-[var(--palette-zinc-500)] text-center">Your feedback shapes the future of FocusArx.</p>
              </motion.div>
            ) : (
              <div className="px-6 py-5 space-y-5">
                {/* Star rating */}
                <div className="text-center">
                  <p className="text-xs text-[var(--palette-zinc-500)] mb-3 uppercase tracking-wider">How would you rate FocusArx?</p>
                  <div className="flex justify-center gap-2">
                    {stars.map((s) => (
                      <button
                        key={s}
                        onMouseEnter={() => setHovered(s)}
                        onMouseLeave={() => setHovered(0)}
                        onClick={() => setRating(s)}
                        className="transition-transform hover:scale-125 active:scale-110"
                      >
                        <Star
                          size={32}
                          className={`transition-colors duration-[var(--duration-fast)] ${s <= activeRating ? "fill-[var(--palette-amber-400)] text-[var(--palette-amber-400)]" : "text-[var(--palette-zinc-700)]"}`}
                        />
                      </button>
                    ))}
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={activeRating}
                      className="text-xs font-medium mt-2 text-[var(--palette-amber-400)] h-4"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      {starLabels[activeRating]}
                    </motion.p>
                  </AnimatePresence>
                </div>

                {/* Category */}
                <div>
                  <p className="text-[11px] text-[var(--palette-zinc-500)] mb-2 uppercase tracking-wider">Category</p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setCategory(c.id)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border ${
                          category === c.id
                            ? "border-[var(--brand-600)] bg-[var(--rgba-124-58-237-0_2)] text-[var(--brand-400)]"
                            : "border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/50 text-[var(--palette-zinc-500)] hover:border-[var(--palette-zinc-700)]"
                        }`}
                      >
                        {c.emoji} {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <p className="text-[11px] text-[var(--palette-zinc-500)] mb-2 uppercase tracking-wider">Your thoughts (optional)</p>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value.slice(0, 500))}
                    placeholder={rating <= 2 ? "What should we improve?" : rating >= 4 ? "What do you love?" : "What's on your mind?"}
                    rows={3}
                    className="w-full rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/60 px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--palette-zinc-600)] focus:border-[var(--brand-600)]/50 focus:outline-none resize-none transition-colors"
                  />
                  <p className="text-[10px] text-[var(--palette-zinc-700)] text-right mt-0.5">{message.length}/500</p>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-1">
                  <button onClick={onClose} className="flex-1 rounded-xl border border-[var(--palette-zinc-800)] py-2.5 text-sm text-[var(--palette-zinc-500)] hover:bg-[var(--palette-zinc-800)]/50 hover:text-[var(--palette-zinc-300)] transition-colors">
                    Not now
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={rating === 0 || submitting}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] py-2.5 text-sm font-semibold text-[var(--palette-white)] disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    <Send size={14} />
                    {submitting ? "Sending…" : "Send feedback"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
