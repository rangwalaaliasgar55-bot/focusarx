import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, getToken } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { PageSEO } from "@/components/PageSEO";
import { Layers, Plus, Trash2, ArrowLeft, BookOpen, RotateCcw, ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";

interface Deck {
  id: string;
  title: string;
  description: string | null;
  category: string;
  cardCount: number;
  dueCount: number;
  createdAt: string;
}

interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  box: number;
  nextReviewAt: string;
  correctCount: number;
  incorrectCount: number;
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export default function FlashcardsPage() {
  const { status } = useAuth();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);

  // New deck form
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // New card form
  const [cardFront, setCardFront] = useState("");
  const [cardBack, setCardBack] = useState("");
  const [addingCard, setAddingCard] = useState(false);

  // Study session
  const [studying, setStudying] = useState(false);
  const [queue, setQueue] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);

  const loadDecks = async () => {
    const res = await fetch("/api/flashcards/decks", { headers: authHeaders() });
    if (res.ok) setDecks(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    void loadDecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const openDeck = async (deck: Deck) => {
    setActiveDeck(deck);
    setStudying(false);
    const res = await fetch(`/api/flashcards/decks/${deck.id}/cards`, { headers: authHeaders() });
    if (res.ok) setCards(await res.json());
  };

  const createDeck = async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/flashcards/decks", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ title: newTitle.trim(), description: newDesc.trim() || undefined }),
      });
      if (res.ok) {
        setNewTitle("");
        setNewDesc("");
        await loadDecks();
      }
    } finally { setCreating(false); }
  };

  const addCard = async () => {
    if (!activeDeck || !cardFront.trim() || !cardBack.trim() || addingCard) return;
    setAddingCard(true);
    try {
      const res = await fetch(`/api/flashcards/decks/${activeDeck.id}/cards`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ front: cardFront.trim(), back: cardBack.trim() }),
      });
      if (res.ok) {
        setCardFront("");
        setCardBack("");
        const c = await res.json();
        setCards((prev) => [...prev, c]);
        void loadDecks();
      }
    } finally { setAddingCard(false); }
  };

  const deleteCard = async (id: string) => {
    await fetch(`/api/flashcards/cards/${id}`, { method: "DELETE", headers: authHeaders() });
    setCards((prev) => prev.filter((c) => c.id !== id));
    void loadDecks();
  };

  const deleteDeck = async (id: string) => {
    await fetch(`/api/flashcards/decks/${id}`, { method: "DELETE", headers: authHeaders() });
    setActiveDeck(null);
    void loadDecks();
  };

  const startStudy = () => {
    // Study due cards first, then everything (order by box).
    const now = Date.now();
    const due = cards.filter((c) => new Date(c.nextReviewAt).getTime() <= now);
    const rest = cards.filter((c) => new Date(c.nextReviewAt).getTime() > now);
    const ordered = [...due, ...rest];
    setQueue(ordered);
    setIdx(0);
    setDone(0);
    setFlipped(false);
    setStudying(true);
  };

  const review = async (rating: "again" | "hard" | "good" | "easy") => {
    const card = queue[idx];
    if (!card) return;
    await fetch(`/api/flashcards/cards/${card.id}/review`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ rating }),
    });
    setDone((d) => d + 1);
    setFlipped(false);
    if (idx + 1 >= queue.length) {
      setStudying(false);
      void loadDecks();
      if (activeDeck) void openDeck(activeDeck);
    } else {
      setIdx((i) => i + 1);
    }
  };

  const currentCard = queue[idx];
  const progress = queue.length ? ((idx) / queue.length) * 100 : 0;

  // ── Study mode ─────────────────────────────────────────────────────────────
  if (studying && currentCard) {
    return (
      <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
        <main className="mx-auto max-w-2xl px-4 py-10">
          <PageTransition>
            <div className="mb-6 flex items-center justify-between">
              <button onClick={() => setStudying(false)} className="flex items-center gap-2 text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors">
                <ArrowLeft size={14} /> Exit study
              </button>
              <span className="text-xs font-mono text-[var(--foreground-subtle)]">{idx + 1} / {queue.length}</span>
            </div>

            <div className="mb-4 h-1.5 w-full rounded-full bg-[var(--muted)] overflow-hidden">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
            </div>

            {/* Card */}
            <div className="[perspective:1600px]">
              <motion.div
                key={currentCard.id + String(flipped)}
                className="relative cursor-pointer select-none"
                onClick={() => setFlipped((f) => !f)}
                initial={false}
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                style={{ transformStyle: "preserve-3d" }}
              >
                {/* Front */}
                <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-[var(--card-border)] bg-[var(--card)] p-10 text-center shadow-xl" style={{ backfaceVisibility: "hidden" }}>
                  <div>
                    <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-subtle)]">Question</p>
                    <p className="text-2xl font-bold leading-snug">{currentCard.front}</p>
                    <p className="mt-6 text-[10px] text-[var(--foreground-subtle)]">Click to flip</p>
                  </div>
                </div>
                {/* Back (rotated) */}
                <div className="absolute inset-0 flex min-h-[320px] items-center justify-center rounded-3xl border border-[rgba(6,214,160,0.3)] bg-[var(--card)] p-10 text-center shadow-xl" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                  <div>
                    <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[#06D6A0]">Answer</p>
                    <p className="text-xl font-medium leading-relaxed text-[var(--foreground-muted)]">{currentCard.back}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Rating buttons */}
            <div className="mt-6 grid grid-cols-4 gap-2">
              <button onClick={() => void review("again")} className="flex flex-col items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors">
                <RotateCcw size={18} /> Again
              </button>
              <button onClick={() => void review("hard")} className="flex flex-col items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 py-3 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors">
                <ThumbsDown size={18} /> Hard
              </button>
              <button onClick={() => void review("good")} className="flex flex-col items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                <ThumbsUp size={18} /> Good
              </button>
              <button onClick={() => void review("easy")} className="flex flex-col items-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/10 py-3 text-xs font-semibold text-blue-400 hover:bg-blue-500/20 transition-colors">
                <CheckCircle2 size={18} /> Easy
              </button>
            </div>
          </PageTransition>
        </main>
      </div>
    );
  }

  // ── Deck detail ─────────────────────────────────────────────────────────────
  if (activeDeck) {
    return (
      <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
        <main className="mx-auto max-w-3xl px-4 py-10">
          <PageTransition>
            <button onClick={() => { setActiveDeck(null); setCards([]); }} className="mb-6 flex items-center gap-2 text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors">
              <ArrowLeft size={14} /> All decks
            </button>

            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black">{activeDeck.title}</h1>
                {activeDeck.description && <p className="mt-1 text-sm text-[var(--foreground-muted)]">{activeDeck.description}</p>}
                <p className="mt-2 text-xs text-[var(--foreground-subtle)]">
                  {cards.length} cards · {activeDeck.dueCount} due now
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={startStudy}
                  disabled={cards.length === 0}
                  className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-4 py-2 text-xs font-bold text-white hover:brightness-110 disabled:opacity-40 transition"
                >
                  ▶ Study ({activeDeck.dueCount || cards.length})
                </button>
                <button onClick={() => void deleteDeck(activeDeck.id)} className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20 transition">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Add card */}
            <div className="mb-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
              <p className="mb-3 text-sm font-semibold">Add a card</p>
              <div className="space-y-3">
                <input
                  value={cardFront}
                  onChange={(e) => setCardFront(e.target.value)}
                  placeholder="Front (question)"
                  className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm outline-none focus:border-[#7C3AED]"
                />
                <textarea
                  value={cardBack}
                  onChange={(e) => setCardBack(e.target.value)}
                  rows={2}
                  placeholder="Back (answer)"
                  className="w-full resize-none rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm outline-none focus:border-[#7C3AED]"
                />
                <button onClick={() => void addCard()} disabled={addingCard || !cardFront.trim() || !cardBack.trim()} className="rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-bold text-white hover:bg-[#6d35d4] disabled:opacity-40 transition">
                  {addingCard ? "Adding…" : "+ Add card"}
                </button>
              </div>
            </div>

            {/* Card list */}
            <div className="space-y-3">
              {cards.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--foreground-subtle)]">
                  No cards yet — add your first one above. 📇
                </div>
              ) : cards.map((c) => (
                <div key={c.id} className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{c.front}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--foreground-muted)]">{c.back}</p>
                  </div>
                  <span className="rounded-full bg-[#7C3AED]/15 px-2 py-0.5 text-[10px] font-bold text-[#A78BFA]">Box {c.box}</span>
                  <button onClick={() => void deleteCard(c.id)} className="text-[var(--foreground-subtle)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </PageTransition>
        </main>
      </div>
    );
  }

  // ── Deck list (default) ────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <PageSEO title="Flashcards | Spaced Repetition | FocusArx" description="Create flashcards and study with spaced repetition to lock knowledge into long-term memory." />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <PageTransition>
          <header className="mb-8">
            <div className="flex items-center gap-2">
              <Layers size={20} className="text-[#A78BFA]" />
              <h1 className="text-2xl font-black">Flashcards</h1>
            </div>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              Create decks, study with spaced repetition, and lock facts into long-term memory.
            </p>
          </header>

          {/* New deck */}
          <div className="mb-8 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
            <p className="mb-3 text-sm font-semibold">New deck</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Deck title (e.g. Spanish verbs)"
                className="flex-1 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm outline-none focus:border-[#7C3AED]"
              />
              <button onClick={() => void createDeck()} disabled={creating || !newTitle.trim()} className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-5 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-40 transition">
                <Plus size={15} /> Create
              </button>
            </div>
          </div>

          {/* Deck grid */}
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--muted)]" />)}
            </div>
          ) : decks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-12 text-center">
              <BookOpen size={32} className="mx-auto mb-3 text-[var(--foreground-subtle)]" />
              <p className="text-sm text-[var(--foreground-muted)]">No decks yet. Create your first deck to start studying.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {decks.map((d) => (
                <button
                  key={d.id}
                  onClick={() => void openDeck(d)}
                  className="group rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-left transition-all hover:border-[#7C3AED]/50 hover:shadow-lg"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-base font-bold">{d.title}</h3>
                    {d.dueCount > 0 && (
                      <span className="rounded-full bg-[#7C3AED]/15 px-2 py-0.5 text-[10px] font-bold text-[#A78BFA]">{d.dueCount} due</span>
                    )}
                  </div>
                  {d.description && <p className="mb-2 text-xs text-[var(--foreground-muted)]">{d.description}</p>}
                  <p className="text-xs text-[var(--foreground-subtle)]">{d.cardCount} cards · {d.category}</p>
                </button>
              ))}
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
