import { useState, useEffect, useMemo, useRef, Suspense, lazy } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth, getToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { PageTransition } from "@/components/PageTransition";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Target, Clock, Send } from "lucide-react";
import { BLUR_IN } from "@/lib/animations";
import { playCoachVoice } from "@/lib/soundEngine";

const ThreeBackground = lazy(() => import("@/components/ThreeBackground"));

interface RoomParticipant {
  userId: string;
  name: string;
  level: number;
  joinedAt: string;
  focusMinutes: number;
}

/**
 * Mirrors the enriched shape returned by GET /api/study-rooms.
 *
 * Head counts and the participant roster are only present for rooms the
 * viewer belongs to — the API never publishes how many people are inside a
 * room to someone who is not in it.
 */
interface ForgeRoom {
  id: string;
  name: string;
  hostName: string;
  isLive: boolean;
  isMember: boolean;
  participantCount?: number;
  maxParticipants: number;
  participants: RoomParticipant[];
}

/** The shared goal the room works toward, in combined focus minutes. */
const COMBINED_MINUTE_GOAL = 1000;

async function fetchForgeRooms(): Promise<ForgeRoom[]> {
  const token = getToken();
  const res = await fetch("/api/study-rooms", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("forge-unavailable");
  const data = await res.json();
  const rooms = Array.isArray(data) ? data : (data?.rooms ?? []);
  return rooms as ForgeRoom[];
}

function ParticipantSkeleton() {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2 w-16" />
          </div>
        </div>
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  );
}

interface RoomChatMessage {
  id: string;
  content: string;
  authorName: string;
  isBot: boolean;
  isAdmin: boolean;
  isMine: boolean;
  createdAt: string;
}

/**
 * Room chat — the forge room's Discord layer.
 *
 * The server queues topic-matched bot replies to human messages (and bots
 * banter among themselves via the existing seeder), so talking in a room is
 * never talking into the void. Bots always wear the 🤖 AI badge — the
 * honesty guardrail holds here too. Polls every 6 s; renders the latest
 * page and auto-scrolls when new lines land.
 */
function RoomChat({ roomId, canChat }: { roomId: string | null; canChat: boolean }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const chatQuery = useQuery<{ messages: RoomChatMessage[] }>({
    queryKey: ["room-chat", roomId],
    enabled: Boolean(roomId),
    refetchInterval: 6_000,
    queryFn: async () => {
      const res = await apiFetch(`/api/study-rooms/${roomId}/messages`);
      if (!res.ok) return { messages: [] };
      return (await res.json()) as { messages: RoomChatMessage[] };
    },
  });

  const messages = chatQuery.data?.messages ?? [];
  const lastCount = useRef(0);
  useEffect(() => {
    if (messages.length !== lastCount.current) {
      lastCount.current = messages.length;
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }
  }, [messages.length]);

  const send = async () => {
    const content = draft.trim();
    if (!content || !roomId || busy) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/study-rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setDraft("");
        void chatQuery.refetch();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">Room chat</h2>
        <span className="text-[11px] text-[var(--foreground-subtle)]">AI members chat along</span>
      </div>
      <div ref={listRef} className="max-h-72 space-y-3 overflow-y-auto overscroll-contain pr-1" role="log" aria-label="Room chat messages">
        {messages.length === 0 && (
          <p className="py-4 text-center text-xs text-[var(--foreground-subtle)]">
            Quiet in here — say hi and someone, human or AI, will answer.
          </p>
        )}
        {messages.slice(-40).map((m) => (
          <div key={m.id} className="text-sm leading-relaxed">
            <span className={`font-semibold ${m.isMine ? "text-[var(--brand-strong)]" : m.isAdmin ? "text-[var(--palette-amber-400)]" : "text-[var(--palette-white)]"}`}>
              {m.authorName}
            </span>
            {m.isBot && (
              <span className="ml-1 rounded bg-[var(--brand-soft)] px-1 py-0.5 text-[11px] font-bold text-[var(--brand-strong)]">🤖 AI</span>
            )}
            <span className="ml-2 text-[var(--foreground-muted)]">{m.content}</span>
          </div>
        ))}
      </div>
      {canChat ? (
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <label className="sr-only" htmlFor="room-chat-input">Message the room</label>
          <input
            id="room-chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            placeholder="Message the room…"
            className="min-h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand-strong)]"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Send message"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-600)] text-[var(--palette-white)] disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </form>
      ) : (
        <p className="mt-4 text-xs text-[var(--foreground-subtle)]">Join the room to chat with its members.</p>
      )}
    </div>
  );
}

export default function ForgeRoomPage() {
  const { data: session } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    playCoachVoice("forge");
  }, []);

  const roomsQuery = useQuery({
    queryKey: ["forge-rooms"],
    queryFn: fetchForgeRooms,
    // 30 s while the room list is healthy — presence and the shared minute goal
    // are live data, so the poll is the feature.
    //
    // While it is failing, back off to 2 minutes and stop retrying so hard.
    // React Query's defaults (3 retries with backoff, then another full retry
    // cycle every 30 s) meant a broken /api/study-rooms produced an error in
    // the console roughly every 8 seconds forever, on a page people leave open
    // for hours. Two attempts, then a slow poll and the on-screen error state
    // with its own Retry button, is the same information without the spam.
    retry: (failureCount) => failureCount < 2,
    refetchInterval: (query) => (query.state.error ? 120_000 : 30_000),
    refetchIntervalInBackground: false,
    staleTime: 10_000,
  });

  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);
  // Fall back to the busiest room so the page opens on something real.
  const selected = useMemo(() => {
    if (rooms.length === 0) return null;
    return rooms.find((room) => room.id === selectedId) ?? rooms[0];
  }, [rooms, selectedId]);

  const participants = selected?.participants ?? [];
  const combinedMinutes = participants.reduce((total, p) => total + (p.focusMinutes ?? 0), 0);
  const myId = session?.user?.id;
  const iAmHere = Boolean(selected?.isMember) || participants.some((p) => p.userId === myId);

  const goalProgress = Math.min(100, Math.round((combinedMinutes / COMBINED_MINUTE_GOAL) * 100));
  const capacity = selected?.maxParticipants ?? 0;
  const fillProgress = capacity > 0
    ? Math.min(100, Math.round((participants.length / capacity) * 100))
    : 0;

  return (
    <PageTransition>
      <div className="relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--palette-white)]">
        <div className="absolute inset-0 z-[var(--z-base)]">
          <Suspense fallback={null}>
            <ThreeBackground />
          </Suspense>
        </div>

        <main className="relative z-[var(--z-content)] mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <header className="mb-10 flex flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--brand-teal)]/30 bg-[var(--brand-teal)]/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-teal)]"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--brand-teal)]" aria-hidden="true" />
              Live Forge Room
            </motion.div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              Collective <br /><span className="text-[var(--brand-teal)]">Focus</span>
            </h1>

            <div className="mt-8 flex items-center gap-6 sm:gap-8">
              <div className="text-center">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[var(--foreground-subtle)]">Participants</p>
                <p className="text-3xl font-semibold text-[var(--palette-white)]">
                  {iAmHere ? (selected?.participantCount ?? participants.length) : selected?.isLive ? "Live" : "—"}
                </p>
              </div>
              <div className="h-10 w-px bg-[var(--palette-white)]/5" aria-hidden="true" />
              <div className="text-center">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[var(--foreground-subtle)]">Combined focus</p>
                <p className="text-3xl font-semibold text-[var(--brand-teal)]">{combinedMinutes}<span className="text-base">m</span></p>
              </div>
            </div>
          </header>

          {roomsQuery.isLoading ? (
            <div className="grid gap-8 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => <ParticipantSkeleton key={index} />)}
                </div>
              </div>
              <Skeleton className="hidden h-64 rounded-[var(--radius-xl)] lg:block" />
            </div>
          ) : roomsQuery.isError ? (
            <ErrorState
              title="The Forge didn't respond"
              message="We couldn't load the live rooms. Your own focus sessions are unaffected."
              onRetry={() => { void roomsQuery.refetch(); }}
            />
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] py-16 text-center">
              <Users size={40} className="text-[var(--foreground-subtle)]" />
              <p className="text-sm text-[var(--foreground-subtle)]">No rooms are live right now</p>
              <p className="max-w-sm text-xs text-[var(--foreground-subtle)]">Be the first to open one, or browse the rooms that are already running.</p>
              <Link
                href="/study-rooms"
                className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[var(--brand-teal)] px-6 text-sm font-bold text-[var(--palette-black)] transition-transform"
              >
                Browse study rooms
              </Link>
            </div>
          ) : (
            <>
              {/* Room selector — every figure below comes from the picked room */}
              <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
                {rooms.slice(0, 6).map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedId(room.id)}
                    aria-pressed={selected?.id === room.id}
                    className={`min-h-[44px] rounded-2xl border px-4 py-2 text-xs font-bold transition-colors ${ selected?.id === room.id ? "border-[var(--brand-teal)]/40 bg-[var(--brand-teal)]/10 text-[var(--brand-teal)]" : "border-[var(--palette-white)]/10 bg-[var(--palette-white)]/[0.02] text-[var(--foreground-muted)] hover:border-[var(--brand-teal)]/25" }`}
                  >
                    {room.name}
                    {room.isLive && (
                      <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand-teal)] align-middle" aria-label="Live now" />
                    )}
                  </button>
                ))}
              </div>

              <div className="grid gap-8 lg:grid-cols-3">
                {/* Participants Grid */}
                <div className="space-y-6 lg:col-span-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <AnimatePresence mode="popLayout">
                      {participants.map((p, i) => (
                        <motion.div
                          key={p.userId}
                          variants={BLUR_IN}
                          initial="initial"
                          animate="animate"
                          transition={{ delay: Math.min(i, 5) * 0.05 }}
                          className={`relative rounded-[var(--radius-xl)] border p-6 ${ p.userId === myId ? "border-[var(--brand-teal)]/40 bg-[var(--brand-teal)]/5" : "border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02]" }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-4">
                              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold ${ p.userId === myId ? "bg-[var(--brand-teal)] text-[var(--palette-black)]" : "bg-[var(--palette-white)]/5 text-[var(--foreground-subtle)]" }`}>
                                {p.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h3 className="truncate font-bold text-[var(--palette-white)]">
                                  {p.name}{p.userId === myId ? " (You)" : ""}
                                </h3>
                                <p className="mt-0.5 text-[11px] uppercase tracking-widest text-[var(--foreground-subtle)]">Level {p.level}</p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xs font-semibold text-[var(--brand-teal)]">{p.focusMinutes ?? 0}m</p>
                              <p className="text-[11px] uppercase tracking-wider text-[var(--foreground-subtle)]">focused</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {participants.length === 0 && selected && (
                    <div className="rounded-[var(--radius-xl)] border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-8 text-center">
                      <p className="text-sm text-[var(--foreground-subtle)]">
                        {iAmHere
                          ? `“${selected.name}” is open but nobody else has joined yet.`
                          : selected.isLive
                            ? `“${selected.name}” is live — join it to see who is focusing alongside you.`
                            : `“${selected.name}” is open and quiet right now — join it to start the session.`}
                      </p>
                      <Link
                        href="/study-rooms"
                        className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-[var(--brand-teal)]/40 px-5 text-xs font-bold text-[var(--brand-teal)] transition-colors hover:bg-[var(--brand-teal)]/10"
                      >
                        Join this room
                      </Link>
                    </div>
                  )}
                </div>

                {/* Sidebar: Group Goals */}
                <div className="space-y-6">
                  <div className="rounded-[var(--radius-xl)] border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-6 sm:p-8">
                    <h2 className="mb-6 flex items-center gap-3 text-xl font-bold">
                      <Target size={18} className="text-[var(--palette-rose-400)]" /> Room Objectives
                    </h2>
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <div className="flex justify-between gap-2 text-xs font-bold">
                          <span className="text-[var(--foreground-muted)]">
                            {COMBINED_MINUTE_GOAL.toLocaleString()} combined focus min
                          </span>
                          <span className="text-[var(--palette-rose-400)]">{combinedMinutes.toLocaleString()}m</span>
                        </div>
                        <div
                          className="h-2 overflow-hidden rounded-full bg-[var(--palette-white)]/5"
                          role="progressbar"
                          aria-valuenow={goalProgress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label="Combined focus minutes toward the room goal"
                        >
                          <motion.div
                            className="h-full bg-[var(--palette-rose-500)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${goalProgress}%` }}
                          />
                        </div>
                      </div>

                      {capacity > 0 && iAmHere && (
                        <div className="space-y-2">
                          <div className="flex justify-between gap-2 text-xs font-bold">
                            <span className="text-[var(--foreground-muted)]">Room capacity</span>
                            <span className="text-[var(--palette-rose-400)]">{participants.length}/{capacity}</span>
                          </div>
                          <div
                            className="h-2 overflow-hidden rounded-full bg-[var(--palette-white)]/5"
                            role="progressbar"
                            aria-valuenow={fillProgress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Room capacity filled"
                          >
                            <motion.div
                              className="h-full bg-[var(--palette-rose-500)]"
                              initial={{ width: 0 }}
                              animate={{ width: `${fillProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {selected && (
                      <p className="mt-6 flex items-center gap-2 text-[11px] text-[var(--foreground-subtle)]">
                        <Clock size={12} aria-hidden="true" /> Hosted by {selected.hostName}
                      </p>
                    )}
                  </div>

                  <div className="rounded-[var(--radius-xl)] border border-[var(--brand-400)]/20 bg-[var(--brand-400)]/5 p-6 sm:p-8">
                    <h2 className="mb-4 text-xl font-bold">{iAmHere ? "You're in the room" : "Join the Flow"}</h2>
                    <p className="mb-6 text-sm leading-relaxed text-[var(--foreground-muted)]">
                      {iAmHere
                        ? "You're part of this room — start a session and your minutes add to the room total."
                        : "Join a room and your focus minutes count toward the shared goal. Every member's session adds to the total."}
                    </p>
                    <Link
                      href={iAmHere ? "/" : "/study-rooms"}
                      className="flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-[var(--palette-white)] px-4 py-4 text-center text-lg font-semibold text-[var(--palette-black)] transition-transform"
                    >
                      {iAmHere ? "Start a session" : "Browse rooms"}
                    </Link>
                  </div>

                  {/* The room's live conversation — humans and labelled bots. */}
                  <RoomChat roomId={selected?.id ?? null} canChat={iAmHere} />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </PageTransition>
  );
}
