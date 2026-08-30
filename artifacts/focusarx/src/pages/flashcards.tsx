/**
 * Flashcards FSRS Page — Spaced repetition with FSRS-4.5 algorithm
 * 
 * Blueprint: Weeks 5-6 AI Intelligence
 * Replaces basic Leitner box system with research-backed FSRS scheduling
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Plus, Brain, Clock, CheckCircle, XCircle, RotateCcw, Sparkles } from 'lucide-react';
import { PageSEO } from '@/components/PageSEO';
import { getToken } from '@/lib/auth';
import { schedule, createNewCard, Grade, type CardState, getDueCards, serializeCard, deserializeCard } from '@/lib/fsrs';

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

  const token = typeof window !== 'undefined' ? getToken() : null;

  // Load decks
  useEffect(() => {
    if (!token) return;
    fetch('/api/flashcards/decks', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        setDecks((data || []).map((d: any) => ({
          id: d.id,
          title: d.title || 'Untitled',
          description: d.description || '',
          cardCount: d.cardCount || 0,
          dueCount: d.dueCount || 0,
        })));
      })
      .catch(() => {});
  }, [token]);

  // Load cards for active deck
  const loadCards = useCallback(async (deckId: number) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}/cards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Convert to FSRS format
        const converted: Card[] = (data || []).map((c: any) => ({
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
      }
    } catch (e) {
      // Failed to load cards — silently skip
    }
    setIsLoading(false);
  }, [token]);

  const handleGrade = useCallback(async (grade: Grade) => {
    const card = cards[currentCardIndex];
    if (!card) return;

    // Apply FSRS scheduling
    const result = schedule(card.fsrs, grade);
    
    // Update card in local state
    const updatedCards = [...cards];
    updatedCards[currentCardIndex] = { ...card, fsrs: result.newState };
    setCards(updatedCards);

    // Save to API
    if (token) {
      fetch(`/api/flashcards/cards/${card.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ grade, fsrs: serializeCard(result.newState) }),
      }).catch(() => {});
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
      }
    } catch (e) {
      // Failed to create deck — silently skip
    }
  }, [newDeckTitle, token]);

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
      }
    } catch (e) {
      // Failed to add card — silently skip
    }
  }, [newCardFront, newCardBack, token, activeDeck]);

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
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--palette-violet-500)]/30 bg-[var(--palette-violet-500)]/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--palette-violet-300)] mb-4">
            <Brain size={12} /> FSRS-4.5 Spaced Repetition
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-3">
            Smart <span className="text-[var(--palette-violet-400)]">Flashcards</span>
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] max-w-md mx-auto">
            Research-backed algorithm adapts to your memory. Review cards at the perfect moment for maximum retention.
          </p>
        </header>

        {/* Deck Selection */}
        {!activeDeck && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Your Decks</h2>
              <button
                onClick={() => setShowCreateDeck(true)}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--palette-violet-500)]/30 bg-[var(--palette-violet-500)]/10 px-3 py-2 text-xs font-bold text-[var(--palette-violet-300)] hover:bg-[var(--palette-violet-500)]/20 transition-all"
              >
                <Plus size={12} /> New Deck
              </button>
            </div>

            {decks.length === 0 ? (
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
                    <div className="flex items-center gap-3 text-[10px] text-[var(--palette-zinc-500)]">
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
                        <span className="text-[10px] font-bold text-[var(--palette-red-300)]">Forgot</span>
                      </button>
                      <button onClick={() => handleGrade(Grade.Hard)} className="rounded-xl border border-[var(--palette-orange-500)]/30 bg-[var(--palette-orange-500)]/10 p-3 text-center hover:bg-[var(--palette-orange-500)]/20 transition-all">
                        <Clock size={16} className="mx-auto mb-1 text-[var(--palette-orange-400)]" />
                        <span className="text-[10px] font-bold text-[var(--palette-orange-300)]">Hard</span>
                      </button>
                      <button onClick={() => handleGrade(Grade.Good)} className="rounded-xl border border-[var(--palette-emerald-500)]/30 bg-[var(--palette-emerald-500)]/10 p-3 text-center hover:bg-[var(--palette-emerald-500)]/20 transition-all">
                        <CheckCircle size={16} className="mx-auto mb-1 text-[var(--palette-emerald-400)]" />
                        <span className="text-[10px] font-bold text-[var(--palette-emerald-300)]">Good</span>
                      </button>
                      <button onClick={() => handleGrade(Grade.Easy)} className="rounded-xl border border-[var(--palette-blue-500)]/30 bg-[var(--palette-blue-500)]/10 p-3 text-center hover:bg-[var(--palette-blue-500)]/20 transition-all">
                        <Sparkles size={16} className="mx-auto mb-1 text-[var(--palette-blue-400)]" />
                        <span className="text-[10px] font-bold text-[var(--palette-blue-300)]">Easy</span>
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
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
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-black text-[var(--palette-white)] mb-2">Study Session Complete!</h2>
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
                  <label className="text-[10px] font-bold text-[var(--palette-zinc-500)] uppercase tracking-wider">Front</label>
                  <input
                    type="text"
                    value={newCardFront}
                    onChange={(e) => setNewCardFront(e.target.value)}
                    placeholder="Question or term..."
                    className="w-full rounded-xl border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-800)] px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--palette-violet-500)]/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--palette-zinc-500)] uppercase tracking-wider">Back</label>
                  <textarea
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
