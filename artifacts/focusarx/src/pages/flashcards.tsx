/**
 * Flashcards FSRS Page — Spaced repetition with FSRS-4.5 algorithm
 * 
 * Blueprint: Weeks 5-6 AI Intelligence
 * Replaces basic Leitner box system with research-backed FSRS scheduling
 */

import { useState, useEffect, useCallback } from 'react';
import { PartyPopper } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Plus, Brain, Clock, CheckCircle, XCircle, RotateCcw, Sparkles } from 'lucide-react';
import { PageSEO } from '@/components/PageSEO';
import { getToken } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { schedule, createNewCard, Grade, type CardState, serializeCard, deserializeCard } from '@/lib/fsrs';
import { QueryError } from '@/components/ui/QueryError';

interface Deck {
  id: number;
  title: string;
  description: string;
  cardCount: number;
  dueCount: number;
}

interface Card {
  id: number;
  deckId: number;
  front: string;
  back: string;
  fsrs: CardState;
}

export default function FlashcardsPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDeck, setShowCreateDeck] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');
  const [showAddCard, setShowAddCard] = useState(false);
  const [studyComplete, setStudyComplete] = useState(false);
  /**
   * A failed load is not an empty deck.
   *
   * Both used to render as "No decks yet / No cards in this deck" — telling the
   * user their data does not exist when the request had simply failed. On a
   * spaced-repetition app that is the worst possible lie: it reads as "the
   * reviews I did are gone".
   */
  const [decksError, setDecksError] = useState<string | null>(null);
  /* Gemini auto-deck builder: board + class + subject + topic → a whole deck. */
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoDraft, setAutoDraft] = useState({ board: "CBSE", classLevel: "10", subject: "", topic: "", count: 12 });
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoMsg, setAutoMsg] = useState<string | null>(null);
  const [cardsError, setCardsError] = useState<string | null>(null);
  /**
   * Grades whose save failed.
   *
   * The review POST used to be `fetch(...).catch(() => {})` with no `res.ok`
   * check at all, so a grade the server never recorded advanced the card's FSRS
   * state locally while the server kept the old schedule. The user saw the next
   * card and believed their review counted; on reload it was due again as if
   * never reviewed. The interval the algorithm computes is the entire product,
   * and it was drifting from reality with nothing to show for it.
   *
   * Studying continues — blocking the session would be worse — but the count is
   * surfaced and stays on screen until the writes succeed.
   */
  const [unsavedReviews, setUnsavedReviews] = useState(0);

  const token = typeof window !== 'undefined' ? getToken() : null;
  const { toast } = useToast();

  // Load decks. A non-ok response is an error, not an empty list.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/flashcards/decks', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: unknown = await res.json();
        if (cancelled) return;
        setDecks((Array.isArray(data) ? data : []).map((d: any) => ({
          id: d.id,
          title: d.title || 'Untitled',
          description: d.description || '',
          cardCount: d.cardCount || 0,
          dueCount: d.dueCount || 0,
        })));
        setDecksError(null);
      } catch (err) {
        if (cancelled) return;
        setDecksError(err instanceof Error ? err.message : 'Request failed');
      }
    })();
  return () => {
      cancelled = true;
    };
  }, [token]);

    /**
   * Ask Gemini for a whole deck from a curriculum position. The server reuses
   * an existing deck with the same title, so this is safe to press twice.
   */
  const generateAutoDeck = async () => {
    if (!autoDraft.subject.trim() || !autoDraft.topic.trim()) { setAutoMsg("Add a subject and a topic."); return; }
    setAutoBusy(true);
    setAutoMsg(null);
    try {
      const res = await fetch("/api/flashcards/decks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...autoDraft, classLevel: autoDraft.classLevel || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { setAutoMsg(d.error ?? "Could not generate the deck"); return; }
      const deck = d.deck as { id: number; title: string; existed: boolean };
      setDecks(prev => prev.some(x => x.id === deck.id)
        ? prev
        : [...prev, { id: deck.id, title: deck.title, description: `Auto-built for ${autoDraft.board}`, cardCount: d.cards?.length ?? 0, dueCount: d.cards?.length ?? 0 }]);
      setAutoMsg(`${deck.existed ? "Added" : "Created"} ${d.cards?.length ?? 0} cards in “${deck.title}”.`);
      setAutoOpen(false);
    } finally {
      setAutoBusy(false);
    }
  };

  // Load cards for active deck
  const loadCards = useCallback(async (deckId: number) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}/cards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // The `else` is the fix: without it a 500 or a 401 fell through to the
      // caller's empty state, so tapping a deck with a hundred cards in it said
      // "No cards in this deck. Add some to get started!"
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      const converted: Card[] = (Array.isArray(data) ? data : []).map((c: any) => ({
        id: c.id,
        deckId: c.deckId || deckId,
        front: c.front,
        back: c.back,
        fsrs: c.fsrs ? deserializeCard(c.fsrs) : createNewCard(),
      }));
      setCards(converted);
      setCurrentCardIndex(0);
      setShowAnswer(false);
      setStudyComplete(false);
      setCardsError(null);
    } catch (err) {
      // Keep the previous cards rather than clearing them — the deck the user
      // was studying is still the deck they were studying.
      setCardsError(err instanceof Error ? err.message : 'Request failed');
      toast("Couldn't load cards for this deck. Try again in a moment.", "error");
    }
    setIsLoading(false);
  }, [token, toast]);

  const handleGrade = useCallback(async (grade: Grade) => {
    const card = cards[currentCardIndex];
    if (!card) return;

    // Apply FSRS scheduling
    const result = schedule(card.fsrs, grade);
    
    // Update card in local state
    const updatedCards = [...cards];
    updatedCards[currentCardIndex] = { ...card, fsrs: result.newState };
    setCards(updatedCards);

    // Save to API.
    //
    // This used to be `fetch(...).catch(() => {})` with no `res.ok` check, so
    // both a network failure *and* a 4xx/5xx were discarded. The card's FSRS
    // state advanced locally either way and the user moved on believing the
    // review counted — but the server still held the old schedule, so the
    // interval the algorithm promises was drifting from reality in silence.
    //
    // One immediate retry covers the transient case. Anything still failing is
    // counted and shown on screen, because "your grades are not being saved" is
    // something the user has to know before they finish a deck, not after.
    if (token) {
      const payload = JSON.stringify({ grade, fsrs: serializeCard(result.newState) });
      void (async () => {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const res = await fetch(`/api/flashcards/cards/${card.id}/review`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: payload,
            });
            if (res.ok) return;
          } catch {
            // Fall through to the retry, then to the counter.
          }
        }
        setUnsavedReviews((n) => n + 1);
      })();
    }

    // Move to next card
    setShowAnswer(false);
    if (currentCardIndex + 1 >= cards.length) {
      setStudyComplete(true);
    } else {
      setCurrentCardIndex(prev => prev + 1);
    }
  }, [cards, currentCardIndex, token]);

  const createDeck = useCallback(async () => {
    if (!newDeckTitle.trim() || !token) return;
    
    try {
      const res = await fetch('/api/flashcards/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newDeckTitle.trim() }),
      });
      if (res.ok) {
        const deck = await res.json();
        setDecks(prev => [...prev, { id: deck.id, title: deck.title, description: '', cardCount: 0, dueCount: 0 }]);
        setNewDeckTitle('');
        setShowCreateDeck(false);
      } else {
        toast("Couldn't create the deck. Please try again.", "error");
      }
    } catch {
      toast("Couldn't create the deck. Check your connection.", "error");
    }
  }, [newDeckTitle, token, toast]);

  const addCard = useCallback(async () => {
    if (!newCardFront.trim() || !newCardBack.trim() || !token || !activeDeck) return;
    
    try {
      const res = await fetch(`/api/flashcards/decks/${activeDeck.id}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ front: newCardFront.trim(), back: newCardBack.trim() }),
      });
      if (res.ok) {
        const card = await res.json();
        setCards(prev => [...prev, {
          id: card.id,
          deckId: activeDeck.id,
          front: card.front,
          back: card.back,
          fsrs: createNewCard(),
        }]);
        setNewCardFront('');
        setNewCardBack('');
        setShowAddCard(false);
      } else {
        toast("Couldn't add the card. Please try again.", "error");
      }
    } catch {
      toast("Couldn't add the card. Check your connection.", "error");
    }
  }, [newCardFront, newCardBack, token, activeDeck, toast]);

  const currentCard = cards[currentCardIndex];
  const dueCards = cards.filter(c => c.fsrs.dueDate <= new Date() || c.fsrs.state === 'new');

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PageSEO
        title="Smart Flashcards | FSRS Spaced Repetition | FocusArx"
        description="Study smarter with FSRS-4.5 spaced repetition. AI-powered flashcard scheduling adapts to your memory for optimal retention."
        canonical="/flashcards"
      />

      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--palette-violet-500)]/30 bg-[var(--palette-violet-500)]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--palette-violet-300)] mb-4">
            <Brain size={12} /> FSRS-4.5 Spaced Repetition
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-3">
            Smart <span className="text-[var(--palette-violet-400)]">Flashcards</span>
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] max-w-md mx-auto">
            Research-backed algorithm adapts to your memory. Review cards at the perfect moment for maximum retention.
          </p>
        </header>

        {/*
          Persistent, not a toast: a fading notification would be gone before the
          user finished the deck, which is exactly when they need to know their
          progress is not being recorded.
        */}
        {unsavedReviews > 0 && (
          <div
            role="alert"
            data-testid="unsaved-reviews"
            className="mb-6 rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-4 py-3"
          >
            <p className="text-xs font-semibold text-[var(--color-warning)]">
              {unsavedReviews} {unsavedReviews === 1 ? "grade was" : "grades were"} not saved
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--foreground-subtle)]">
              You can keep reviewing, but those cards will come up again sooner than they should. Check your
              connection and reload to resync.
            </p>
          </div>
        )}

        {/* Deck Selection */}
        {!activeDeck && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Your Decks</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setAutoOpen(v => !v); setAutoMsg(null); }}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--palette-emerald-500)]/30 bg-[var(--palette-emerald-500)]/10 px-3 py-2 text-xs font-bold text-[var(--palette-emerald-400)] hover:bg-[var(--palette-emerald-500)]/20 transition-all"
                >
                  ✨ {autoOpen ? "Close" : "Auto-build with Gemini"}
                </button>
                <button
                  onClick={() => setShowCreateDeck(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--palette-violet-500)]/30 bg-[var(--palette-violet-500)]/10 px-3 py-2 text-xs font-bold text-[var(--palette-violet-300)] hover:bg-[var(--palette-violet-500)]/20 transition-all"
                >
                  <Plus size={12} /> New Deck
                </button>
              </div>
            </div>

            {autoOpen && (
              <div className="rounded-2xl border border-[var(--palette-emerald-500)]/25 bg-[var(--palette-emerald-500)]/5 p-4">
                <p className="text-sm font-bold text-[var(--palette-emerald-300)]">Pick where you are in the syllabus</p>
                <p className="mt-1 text-[11px] text-[var(--palette-zinc-500)]">
                  Gemini writes a full deck for that board, class and topic — no notes needed. Premium feature.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-[11px] text-[var(--palette-zinc-400)]">
                    Board / exam
                    <select
                      value={autoDraft.board}
                      onChange={(e) => setAutoDraft(d => ({ ...d, board: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-2.5 py-2 text-xs text-[var(--palette-zinc-200)] outline-none"
                    >
                      {["CBSE", "ICSE", "State Board", "JEE", "NEET", "UPSC", "CA Foundation", "Other"].map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </label>
                  <label className="text-[11px] text-[var(--palette-zinc-400)]">
                    Class (optional)
                    <input
                      value={autoDraft.classLevel}
                      onChange={(e) => setAutoDraft(d => ({ ...d, classLevel: e.target.value }))}
                      placeholder="10"
                      maxLength={6}
                      className="mt-1 w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-2.5 py-2 text-xs text-[var(--palette-zinc-200)] outline-none"
                    />
                  </label>
                  <label className="text-[11px] text-[var(--palette-zinc-400)]">
                    Subject
                    <input
                      value={autoDraft.subject}
                      onChange={(e) => setAutoDraft(d => ({ ...d, subject: e.target.value }))}
                      placeholder="Physics"
                      maxLength={60}
                      className="mt-1 w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-2.5 py-2 text-xs text-[var(--palette-zinc-200)] outline-none"
                    />
                  </label>
                  <label className="text-[11px] text-[var(--palette-zinc-400)]">
                    Topic
                    <input
                      value={autoDraft.topic}
                      onChange={(e) => setAutoDraft(d => ({ ...d, topic: e.target.value }))}
                      placeholder="Light — reflection & refraction"
                      maxLength={120}
                      className="mt-1 w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-2.5 py-2 text-xs text-[var(--palette-zinc-200)] outline-none"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => void generateAutoDeck()}
                    disabled={autoBusy}
                    className="rounded-xl bg-[var(--palette-emerald-600)] px-4 py-2 text-xs font-bold text-[var(--palette-white)] disabled:opacity-50"
                  >
                    {autoBusy ? "Gemini is writing cards…" : `Build ${autoDraft.count} cards`}
                  </button>
                  <label className="text-[11px] text-[var(--palette-zinc-400)]">
                    Cards
                    <input
                      type="number" min={5} max={30}
                      value={autoDraft.count}
                      onChange={(e) => setAutoDraft(d => ({ ...d, count: Math.min(30, Math.max(5, Number(e.target.value) || 12)) }))}
                      className="ml-2 w-16 rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-2 py-1 text-xs text-[var(--palette-zinc-200)] outline-none"
                    />
                  </label>
                  {autoMsg && <span className="text-[11px] text-[var(--palette-emerald-400)]">{autoMsg}</span>}
                </div>
              </div>
            )}

            {decksError ? (
              /* Before the empty branch: a failed request is not an empty deck. */
              <QueryError what="your decks" onRetry={() => window.location.reload()} />
            ) : decks.length === 0 ? (
              <div className="rounded-2xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/60 p-8 text-center">
                <BookOpen size={32} className="mx-auto text-[var(--palette-zinc-600)] mb-3" />
                <p className="text-sm text-[var(--palette-zinc-500)]">No decks yet. Create your first deck to start learning!</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {decks.map((deck) => (
                  <button
                    key={deck.id}
                    onClick={() => { setActiveDeck(deck); loadCards(deck.id); }}
                    className="rounded-2xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/60 p-5 text-left transition-all hover:border-[var(--palette-violet-500)]/30 hover:bg-[var(--palette-zinc-900)]"
                  >
                    <h3 className="text-sm font-bold text-[var(--palette-white)] mb-1">{deck.title}</h3>
                    <div className="flex items-center gap-3 text-[11px] text-[var(--palette-zinc-500)]">
                      <span>{deck.cardCount} cards</span>
                      {deck.dueCount > 0 && (
                        <span className="text-[var(--palette-orange-400)]">{deck.dueCount} due</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Study Mode */}
        {activeDeck && !studyComplete && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setActiveDeck(null); setCards([]); }}
                className="text-xs text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)]"
              >
                ← Back to decks
              </button>
              <div className="text-xs text-[var(--palette-zinc-500)]">
                {currentCardIndex + 1} / {dueCards.length}
              </div>
            </div>

            {currentCard ? (
              <motion.div
                key={currentCardIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/80 p-8 min-h-[280px] flex flex-col items-center justify-center"
              >
                {/* Front */}
                {!showAnswer ? (
                  <>
                    <p className="text-xl font-bold text-[var(--palette-white)] text-center mb-8">
                      {currentCard.front}
                    </p>
                    <button
                      onClick={() => setShowAnswer(true)}
                      className="rounded-xl border border-[var(--palette-violet-500)]/40 bg-[var(--palette-violet-500)]/15 px-6 py-3 text-sm font-bold text-[var(--palette-violet-300)] hover:bg-[var(--palette-violet-500)]/25 transition-all"
                    >
                      Show Answer
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[var(--palette-zinc-500)] mb-2">Answer:</p>
                    <p className="text-lg text-[var(--palette-white)] text-center mb-8">
                      {currentCard.back}
                    </p>
                    <div className="grid grid-cols-4 gap-2 w-full max-w-md">
                      <button onClick={() => handleGrade(Grade.Again)} className="rounded-xl border border-[var(--palette-red-500)]/30 bg-[var(--palette-red-500)]/10 p-3 text-center hover:bg-[var(--palette-red-500)]/20 transition-all">
                        <XCircle size={16} className="mx-auto mb-1 text-[var(--palette-red-400)]" />
                        <span className="text-[11px] font-bold text-[var(--palette-red-300)]">Forgot</span>
                      </button>
                      <button onClick={() => handleGrade(Grade.Hard)} className="rounded-xl border border-[var(--palette-orange-500)]/30 bg-[var(--palette-orange-500)]/10 p-3 text-center hover:bg-[var(--palette-orange-500)]/20 transition-all">
                        <Clock size={16} className="mx-auto mb-1 text-[var(--palette-orange-400)]" />
                        <span className="text-[11px] font-bold text-[var(--palette-orange-300)]">Hard</span>
                      </button>
                      <button onClick={() => handleGrade(Grade.Good)} className="rounded-xl border border-[var(--palette-emerald-500)]/30 bg-[var(--palette-emerald-500)]/10 p-3 text-center hover:bg-[var(--palette-emerald-500)]/20 transition-all">
                        <CheckCircle size={16} className="mx-auto mb-1 text-[var(--palette-emerald-400)]" />
                        <span className="text-[11px] font-bold text-[var(--palette-emerald-300)]">Good</span>
                      </button>
                      <button onClick={() => handleGrade(Grade.Easy)} className="rounded-xl border border-[var(--palette-blue-500)]/30 bg-[var(--palette-blue-500)]/10 p-3 text-center hover:bg-[var(--palette-blue-500)]/20 transition-all">
                        <Sparkles size={16} className="mx-auto mb-1 text-[var(--palette-blue-400)]" />
                        <span className="text-[11px] font-bold text-[var(--palette-blue-300)]">Easy</span>
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            ) : cardsError ? (
              <QueryError what="this deck's cards" onRetry={() => activeDeck && void loadCards(activeDeck.id)} />
            ) : isLoading ? (
              <div className="rounded-2xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/60 p-8 text-center" aria-busy="true">
                <p className="text-sm text-[var(--palette-zinc-500)]">Loading cards…</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/60 p-8 text-center">
                <p className="text-sm text-[var(--palette-zinc-500)]">No cards in this deck. Add some to get started!</p>
              </div>
            )}

            {/* Add Card button */}
            <button
              onClick={() => setShowAddCard(true)}
              className="w-full rounded-xl border border-[var(--palette-zinc-800)] px-4 py-2.5 text-xs font-bold text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)] transition-all flex items-center justify-center gap-2"
            >
              <Plus size={12} /> Add Card
            </button>
          </div>
        )}

        {/* Study Complete */}
        {studyComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl border border-[var(--palette-emerald-500)]/30 bg-[var(--palette-emerald-500)]/5 p-12 text-center"
          >
            <div className="text-4xl mb-4"><PartyPopper size={16} aria-hidden="true" /></div>
            <h2 className="text-xl font-semibold text-[var(--palette-white)] mb-2">Study Session Complete!</h2>
            <p className="text-sm text-[var(--palette-zinc-500)] mb-6">
              You reviewed {cards.length} cards. Your FSRS algorithm has scheduled optimal review times.
            </p>
            <button
              onClick={() => { setStudyComplete(false); setCurrentCardIndex(0); setShowAnswer(false); }}
              className="rounded-xl border border-[var(--palette-violet-500)]/40 bg-[var(--palette-violet-500)]/15 px-6 py-3 text-sm font-bold text-[var(--palette-violet-300)] hover:bg-[var(--palette-violet-500)]/25 transition-all"
            >
              <RotateCcw size={14} className="inline mr-2" /> Study Again
            </button>
          </motion.div>
        )}

        {/* Create Deck Modal */}
        <AnimatePresence>
          {showCreateDeck && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowCreateDeck(false)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="w-full max-w-sm rounded-2xl border border-[var(--palette-zinc-800)] bg-[var(--palette-0d0f17)] p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold mb-4">Create New Deck</h3>
                <input
                  type="text"
                  value={newDeckTitle}
                  onChange={(e) => setNewDeckTitle(e.target.value)}
                  placeholder="Deck title..."
                  className="w-full rounded-xl border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-800)] px-4 py-2.5 text-sm mb-4 focus:outline-none focus:border-[var(--palette-violet-500)]/50"
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowCreateDeck(false)} className="flex-1 rounded-xl border border-[var(--palette-zinc-700)] px-4 py-2.5 text-xs font-bold text-[var(--palette-zinc-400)]">
                    Cancel
                  </button>
                  <button onClick={createDeck} className="flex-1 rounded-xl border border-[var(--palette-violet-500)]/40 bg-[var(--palette-violet-500)]/15 px-4 py-2.5 text-xs font-bold text-[var(--palette-violet-300)]">
                    Create
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Card Modal */}
        <AnimatePresence>
          {showAddCard && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowAddCard(false)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="w-full max-w-sm rounded-2xl border border-[var(--palette-zinc-800)] bg-[var(--palette-0d0f17)] p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold">Add New Card</h3>
                <div>
                  <label htmlFor="front-390" className="text-[11px] font-bold text-[var(--palette-zinc-500)] uppercase tracking-wider">Front</label>
                  <input id="front-390"
                    type="text"
                    value={newCardFront}
                    onChange={(e) => setNewCardFront(e.target.value)}
                    placeholder="Question or term..."
                    className="w-full rounded-xl border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-800)] px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--palette-violet-500)]/50"
                  />
                </div>
                <div>
                  <label htmlFor="back-400" className="text-[11px] font-bold text-[var(--palette-zinc-500)] uppercase tracking-wider">Back</label>
                  <textarea id="back-400"
                    value={newCardBack}
                    onChange={(e) => setNewCardBack(e.target.value)}
                    placeholder="Answer or definition..."
                    rows={3}
                    className="w-full rounded-xl border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-800)] px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--palette-violet-500)]/50 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddCard(false)} className="flex-1 rounded-xl border border-[var(--palette-zinc-700)] px-4 py-2.5 text-xs font-bold text-[var(--palette-zinc-400)]">
                    Cancel
                  </button>
                  <button onClick={addCard} className="flex-1 rounded-xl border border-[var(--palette-violet-500)]/40 bg-[var(--palette-violet-500)]/15 px-4 py-2.5 text-xs font-bold text-[var(--palette-violet-300)]">
                    Add Card
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
