import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Layers3,
  Plus,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { useAuth, getToken } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import PageHeader from "@/components/PageHeader";
import { PageSEO } from "@/components/PageSEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card as UICard, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface Deck {
  id: string;
  title: string;
  description: string | null;
  category: string;
  cardCount: number;
  dueCount: number;
  createdAt: string;
}

interface StudyCard {
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
  const token = getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function LeitnerBar({ cards }: { cards: StudyCard[] }) {
  const boxes = [1, 2, 3, 4, 5].map((box) => cards.filter((card) => card.box === box).length);
  const total = Math.max(1, cards.length);
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]" aria-label="Leitner box distribution">
        {boxes.map((count, index) => count > 0 && <span key={index} className="h-full border-r border-[var(--background)] bg-[var(--brand-500)] last:border-0" style={{ width: `${(count / total) * 100}%`, opacity: 0.35 + index * 0.14 }} />)}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[0.625rem] text-[var(--foreground-subtle)]">{boxes.map((count, index) => <span key={index}>B{index + 1} · {count}</span>)}</div>
    </div>
  );
}

function StudyMode({
  deck,
  queue,
  index,
  flipped,
  onFlip,
  onExit,
  onReview,
}: {
  deck: Deck;
  queue: StudyCard[];
  index: number;
  flipped: boolean;
  onFlip: () => void;
  onExit: () => void;
  onReview: (rating: "again" | "hard" | "good" | "easy") => void;
}) {
  const reduceMotion = useReducedMotion();
  const card = queue[index];
  const progress = queue.length ? ((index + 1) / queue.length) * 100 : 0;

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit();
      if (event.key === " " || event.key === "Enter") { event.preventDefault(); onFlip(); }
      if (!flipped) return;
      if (event.key === "1") onReview("again");
      if (event.key === "2") onReview("hard");
      if (event.key === "3") onReview("good");
      if (event.key === "4") onReview("easy");
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [flipped, onExit, onFlip, onReview]);

  if (!card) return null;
  const ratings = [
    { rating: "again" as const, label: "Again", hint: "1", icon: RotateCcw, color: "var(--danger)", soft: "var(--danger-soft)" },
    { rating: "hard" as const, label: "Hard", hint: "2", icon: ThumbsDown, color: "var(--warning)", soft: "var(--warning-soft)" },
    { rating: "good" as const, label: "Good", hint: "3", icon: ThumbsUp, color: "var(--success)", soft: "var(--success-soft)" },
    { rating: "easy" as const, label: "Easy", hint: "4", icon: CheckCircle2, color: "var(--info)", soft: "var(--info-soft)" },
  ];

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex min-h-[100dvh] flex-col overflow-y-auto bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex min-h-[4.5rem] items-center gap-4 border-b border-[var(--border-subtle)] px-4 sm:px-6">
        <Button variant="ghost" size="icon" onClick={onExit} aria-label="Exit study mode"><X /></Button>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{deck.title}</p><p className="text-xs text-[var(--foreground-subtle)]">Distraction-free study</p></div>
        <span className="font-mono text-sm tabular-nums text-[var(--foreground-muted)]">{index + 1} / {queue.length}</span>
      </header>
      <Progress value={progress} className="h-1 rounded-none" />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-8 sm:px-8">
        <p className="mb-5 text-center text-xs text-[var(--foreground-subtle)]">Press Space to flip · Esc to exit</p>
        <button type="button" onClick={onFlip} className="relative min-h-[22rem] w-full rounded-[var(--radius-2xl)] text-center [perspective:1600px] sm:min-h-[27rem]" aria-label={flipped ? "Show question" : "Show answer"}>
          <motion.div className="absolute inset-0 [transform-style:preserve-3d]" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: reduceMotion ? 0 : 0.4, ease: "easeOut" }}>
            <section className="absolute inset-0 grid place-items-center rounded-[var(--radius-2xl)] border border-[var(--card-border)] bg-[var(--surface)] p-8 shadow-[var(--shadow-xl)] [backface-visibility:hidden] sm:p-14">
              <div><Badge variant="secondary">Question</Badge><p className="mt-7 text-balance text-2xl font-semibold leading-relaxed sm:text-4xl">{card.front}</p><p className="mt-8 text-xs text-[var(--foreground-subtle)]">Tap anywhere to reveal the answer</p></div>
            </section>
            <section className="absolute inset-0 grid place-items-center rounded-[var(--radius-2xl)] border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[var(--surface)] p-8 shadow-[var(--shadow-xl)] [backface-visibility:hidden] [transform:rotateY(180deg)] sm:p-14">
              <div><Badge variant="success">Answer</Badge><p className="mt-7 text-balance text-xl font-medium leading-relaxed text-[var(--foreground-muted)] sm:text-3xl">{card.back}</p><p className="mt-8 text-xs text-[var(--foreground-subtle)]">How well did you know it?</p></div>
            </section>
          </motion.div>
        </button>

        <AnimatePresence>
          {flipped && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ratings.map(({ rating, label, hint, icon: Icon, color, soft }) => (
                <button key={rating} type="button" onClick={() => onReview(rating)} className="flex min-h-14 items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] font-semibold transition-transform duration-[var(--duration-fast)] hover:-translate-y-0.5" style={{ color, background: soft }}><Icon size={17} /> {label}<kbd className="ml-1 text-[0.625rem] opacity-70">{hint}</kbd></button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function FlashcardsPage() {
  const { status } = useAuth();
  const { toast } = useToast();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [cardFront, setCardFront] = useState("");
  const [aiNotes, setAiNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [cardBack, setCardBack] = useState("");
  const [addingCard, setAddingCard] = useState(false);
  const [studying, setStudying] = useState(false);
  const [queue, setQueue] = useState<StudyCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const loadDecks = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/flashcards/decks", { headers: authHeaders() });
      if (!response.ok) throw new Error();
      setDecks(await response.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (status === "authenticated") void loadDecks(); }, [loadDecks, status]);

  const openDeck = useCallback(async (deck: Deck) => {
    setActiveDeck(deck);
    setCardsLoading(true);
    try {
      const response = await fetch(`/api/flashcards/decks/${deck.id}/cards`, { headers: authHeaders() });
      if (!response.ok) throw new Error();
      setCards(await response.json());
    } catch {
      toast("This deck could not be loaded", "danger");
    } finally {
      setCardsLoading(false);
    }
  }, [toast]);

  const createDeck = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const response = await fetch("/api/flashcards/decks", { method: "POST", headers: authHeaders(), body: JSON.stringify({ title: newTitle.trim(), description: newDesc.trim() || undefined }) });
      if (!response.ok) throw new Error();
      setNewTitle(""); setNewDesc("");
      await loadDecks();
      toast("Deck created", "success");
    } catch { toast("Deck could not be created", "danger"); }
    finally { setCreating(false); }
  };

  const addCard = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeDeck || !cardFront.trim() || !cardBack.trim() || addingCard) return;
    setAddingCard(true);
    try {
      const response = await fetch(`/api/flashcards/decks/${activeDeck.id}/cards`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ front: cardFront.trim(), back: cardBack.trim() }) });
      if (!response.ok) throw new Error();
      const card = await response.json();
      setCards((current) => [...current, card]);
      setCardFront(""); setCardBack("");
      void loadDecks();
      toast("Card added", "success");
    } catch { toast("Card could not be added", "danger"); }
    finally { setAddingCard(false); }
  };

  const generateCards = async () => {
    if (!activeDeck || aiNotes.trim().length < 50) return;
    setGenerating(true);
    try {
      const response = await fetch(`/api/flashcards/decks/${activeDeck.id}/generate`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ notes: aiNotes.trim(), count: 10 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Generation failed");
      setCards((current) => [...current, ...(data.cards ?? [])]); setAiNotes(""); void loadDecks(); toast(`${data.cards?.length ?? 0} cards generated`, "success");
    } catch (error) { toast(error instanceof Error ? error.message : "AI cards could not be generated", "danger"); }
    finally { setGenerating(false); }
  };

  const deleteCard = async (id: string) => {
    const response = await fetch(`/api/flashcards/cards/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!response.ok) { toast("Card could not be deleted", "danger"); return; }
    setCards((current) => current.filter((card) => card.id !== id));
    void loadDecks();
    toast("Card deleted", "info");
  };

  const deleteDeck = async (id: string) => {
    const response = await fetch(`/api/flashcards/decks/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!response.ok) { toast("Deck could not be deleted", "danger"); return; }
    setActiveDeck(null); setCards([]);
    void loadDecks();
    toast("Deck deleted", "info");
  };

  const startStudy = () => {
    const now = Date.now();
    const ordered = [...cards.filter((card) => new Date(card.nextReviewAt).getTime() <= now), ...cards.filter((card) => new Date(card.nextReviewAt).getTime() > now)];
    setQueue(ordered); setIndex(0); setFlipped(false); setStudying(true);
  };

  const review = useCallback(async (rating: "again" | "hard" | "good" | "easy") => {
    const card = queue[index];
    if (!card) return;
    const response = await fetch(`/api/flashcards/cards/${card.id}/review`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ rating }) });
    if (!response.ok) { toast("Review could not be saved", "danger"); return; }
    setFlipped(false);
    if (index + 1 >= queue.length) {
      setStudying(false);
      toast("Study session complete", "success");
      await loadDecks();
      if (activeDeck) await openDeck(activeDeck);
    } else setIndex((current) => current + 1);
  }, [activeDeck, index, loadDecks, openDeck, queue, toast]);

  const deckTotals = useMemo(() => ({ cards: decks.reduce((sum, deck) => sum + deck.cardCount, 0), due: decks.reduce((sum, deck) => sum + deck.dueCount, 0) }), [decks]);

  return (
    <div className="page-container">
      <PageSEO title="Flashcards | Spaced Repetition | FocusArx" description="Create flashcards and study with spaced repetition to lock knowledge into long-term memory." />
      <PageHeader eyebrow="Study" title={activeDeck ? activeDeck.title : "Flashcards"} subtitle={activeDeck ? activeDeck.description || "Build the deck, then review with Leitner spaced repetition." : "Turn notes into durable memory with calm, distraction-free review."} icon={<Layers3 />} actions={activeDeck ? <><Button variant="ghost" onClick={() => { setActiveDeck(null); setCards([]); }}><ArrowLeft /> All decks</Button><Button onClick={startStudy} disabled={!cards.length}><Sparkles /> Study {activeDeck.dueCount || cards.length}</Button></> : <Badge variant="secondary">{deckTotals.cards} cards · {deckTotals.due} due</Badge>} />

      {activeDeck ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(18rem,.7fr)_minmax(0,1.3fr)]">
          <div className="space-y-5">
            <UICard><CardHeader><CardTitle>Leitner progress</CardTitle><CardDescription>Cards move toward mastery as recall improves.</CardDescription></CardHeader><CardContent><LeitnerBar cards={cards} /></CardContent></UICard>
            <UICard><CardHeader><CardTitle>Add a card</CardTitle><CardDescription>Keep each prompt focused on one idea.</CardDescription></CardHeader><CardContent><form onSubmit={addCard} className="space-y-3"><Input value={cardFront} onChange={(event) => setCardFront(event.target.value)} placeholder="Question or prompt" aria-label="Card front" /><Textarea value={cardBack} onChange={(event) => setCardBack(event.target.value)} placeholder="Answer" rows={4} aria-label="Card back" /><Button type="submit" loading={addingCard} disabled={!cardFront.trim() || !cardBack.trim()} className="w-full"><Plus /> Add card</Button></form></CardContent></UICard>
            <UICard><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles /> AI cards <Badge>Premium</Badge></CardTitle><CardDescription>Paste notes and generate ten focused question-answer cards.</CardDescription></CardHeader><CardContent className="space-y-3"><Textarea value={aiNotes} onChange={(event) => setAiNotes(event.target.value)} rows={6} placeholder="Paste at least 50 characters of notes…" aria-label="Notes for AI flashcard generation" /><Button className="w-full" onClick={() => void generateCards()} loading={generating} disabled={aiNotes.trim().length < 50}><Sparkles /> Generate cards</Button></CardContent></UICard>
            <Button variant="ghost" className="w-full text-[var(--danger)]" onClick={() => void deleteDeck(activeDeck.id)}><Trash2 /> Delete deck</Button>
          </div>
          <UICard className="overflow-hidden"><CardHeader><CardTitle>Cards</CardTitle><CardDescription>{cards.length} card{cards.length === 1 ? "" : "s"} in this deck.</CardDescription></CardHeader><CardContent className="pt-4">{cardsLoading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div> : cards.length ? <div className="divide-y divide-[var(--border-subtle)]">{cards.map((card) => <div key={card.id} className="group flex min-h-20 items-center gap-3 py-3"><Badge variant="secondary" className="shrink-0">Box {card.box}</Badge><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{card.front}</p><p className="mt-1 truncate text-xs text-[var(--foreground-muted)]">{card.back}</p></div><Button variant="ghost" size="icon" className="text-[var(--foreground-subtle)] hover:text-[var(--danger)]" onClick={() => void deleteCard(card.id)} aria-label={`Delete card ${card.front}`}><Trash2 /></Button></div>)}</div> : <EmptyState icon={<BookOpen />} title="This deck is empty" description="Add the first question and answer to make it study-ready." />}</CardContent></UICard>
        </div>
      ) : (
        <>
          <UICard className="mb-6"><CardHeader><CardTitle>Create a deck</CardTitle><CardDescription>Group cards by subject, chapter, or exam.</CardDescription></CardHeader><CardContent><form onSubmit={createDeck} className="grid gap-3 sm:grid-cols-[1fr_1.2fr_auto]"><Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Deck title" aria-label="Deck title" /><Input value={newDesc} onChange={(event) => setNewDesc(event.target.value)} placeholder="Short description (optional)" aria-label="Deck description" /><Button type="submit" loading={creating} disabled={!newTitle.trim()}><Plus /> Create</Button></form></CardContent></UICard>
          {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading decks">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-48" />)}</div> : error ? <EmptyState icon={<RotateCcw />} title="Decks could not be loaded" description="Check your connection and try again. Your cards are safe." action={{ label: "Retry", onClick: () => void loadDecks() }} /> : decks.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{decks.map((deck) => <button key={deck.id} type="button" onClick={() => void openDeck(deck)} className="ui-panel ui-panel-interactive min-h-48 p-5 text-left"><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-[var(--radius-lg)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"><BookOpen /></span>{deck.dueCount > 0 && <Badge>{deck.dueCount} due</Badge>}</div><h2 className="mt-5 text-lg font-semibold tracking-tight">{deck.title}</h2><p className="mt-2 line-clamp-2 text-sm text-[var(--foreground-muted)]">{deck.description || "No description"}</p><div className="mt-5 flex items-center justify-between text-xs text-[var(--foreground-subtle)]"><span>{deck.cardCount} cards</span><span>{deck.category}</span></div></button>)}</div> : <EmptyState icon={<BookOpen />} title="Create your first deck" description="Start with a small set of questions from the subject you are studying now." />}
        </>
      )}

      {studying && activeDeck && queue[index] && <StudyMode deck={activeDeck} queue={queue} index={index} flipped={flipped} onFlip={() => setFlipped((current) => !current)} onExit={() => setStudying(false)} onReview={(rating) => void review(rating)} />}
    </div>
  );
}
