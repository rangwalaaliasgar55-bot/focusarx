import { useState, useEffect, useMemo, Suspense, lazy } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth, getToken } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Target, Clock } from "lucide-react";
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

/** Mirrors the enriched shape returned by GET /api/study-rooms. */
interface ForgeRoom {
  id: string;
  name: string;
  hostName: string;
  participantCount: number;
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
    <div className="rounded-3xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-6 backdrop-blur-xl">
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

export default function ForgeRoomPage() {
  const { data: session } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    playCoachVoice("forge");
  }, []);

  const roomsQuery = useQuery({
    queryKey: ["forge-rooms"],
    queryFn: fetchForgeRooms,
    refetchInterval: 30_000,
  });

  const rooms = roomsQuery.data ?? [];
  // Fall back to the busiest room so the page opens on something real.
  const selected = useMemo(() => {
    if (rooms.length === 0) return null;
    return rooms.find((room) => room.id === selectedId) ?? rooms[0];
  }, [rooms, selectedId]);

  const participants = selected?.participants ?? [];
  const combinedMinutes = participants.reduce((total, p) => total + (p.focusMinutes ?? 0), 0);
  const myId = session?.user?.id;
  const iAmHere = participants.some((p) => p.userId === myId);

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
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--brand-teal)]/30 bg-[var(--brand-teal)]/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-teal)]"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--brand-teal)]" aria-hidden="true" />
              Live Forge Room
            </motion.div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              Collective <br /><span className="text-[var(--brand-teal)]">Focus</span>
            </h1>

            <div className="mt-8 flex items-center gap-6 sm:gap-8">
              <div className="text-center">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-subtle)]">Participants</p>
                <p className="text-3xl font-semibold text-[var(--palette-white)]">{selected?.participantCount ?? 0}</p>
              </div>
              <div className="h-10 w-px bg-[var(--palette-white)]/5" aria-hidden="true" />
              <div className="text-center">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-subtle)]">Combined focus</p>
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
              <Skeleton className="hidden h-64 rounded-3xl lg:block" />
            </div>
          ) : roomsQuery.isError ? (
            <ErrorState
              title="The Forge didn't respond"
              message="We couldn't load the live rooms. Your own focus sessions are unaffected."
              onRetry={() => { void roomsQuery.refetch(); }}
            />
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] py-16 text-center backdrop-blur-xl">
              <Users size={40} className="text-[var(--foreground-subtle)]" />
              <p className="text-sm text-[var(--foreground-subtle)]">No rooms are live right now</p>
              <p className="max-w-sm text-xs text-[var(--foreground-subtle)]">Be the first to open one, or browse the rooms that are already running.</p>
              <Link
                href="/study-rooms"
                className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[var(--brand-teal)] px-6 text-sm font-bold text-[var(--palette-black)] transition-transform hover:scale-105"
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
                    className={`min-h-[44px] rounded-2xl border px-4 py-2 text-xs font-bold transition-colors ${
                      selected?.id === room.id
                        ? "border-[var(--brand-teal)]/40 bg-[var(--brand-teal)]/10 text-[var(--brand-teal)]"
                        : "border-[var(--palette-white)]/10 bg-[var(--palette-white)]/[0.02] text-[var(--foreground-muted)] hover:border-[var(--brand-teal)]/25"
                    }`}
                  >
                    {room.name}
                    <span className="ml-2 font-mono text-[10px] opacity-60">{room.participantCount}</span>
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
                          className={`relative rounded-3xl border p-6 backdrop-blur-xl ${
                            p.userId === myId
                              ? "border-[var(--brand-teal)]/40 bg-[var(--brand-teal)]/5"
                              : "border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-4">
                              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold ${
                                p.userId === myId
                                  ? "bg-[var(--brand-teal)] text-[var(--palette-black)]"
                                  : "bg-[var(--palette-white)]/5 text-[var(--foreground-subtle)]"
                              }`}>
                                {p.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h3 className="truncate font-bold text-[var(--palette-white)]">
                                  {p.name}{p.userId === myId ? " (You)" : ""}
                                </h3>
                                <p className="mt-0.5 text-[10px] uppercase tracking-widest text-[var(--foreground-subtle)]">Level {p.level}</p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xs font-semibold text-[var(--brand-teal)]">{p.focusMinutes ?? 0}m</p>
                              <p className="text-[9px] uppercase tracking-wider text-[var(--foreground-subtle)]">focused</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {participants.length === 0 && selected && (
                    <div className="rounded-3xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-8 text-center backdrop-blur-xl">
                      <p className="text-sm text-[var(--foreground-subtle)]">
                        “{selected.name}” is open but nobody has joined yet.
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
                  <div className="rounded-3xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-6 backdrop-blur-xl sm:p-8">
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

                      {capacity > 0 && (
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

                  <div className="rounded-3xl border border-[var(--brand-400)]/20 bg-[var(--brand-400)]/5 p-6 backdrop-blur-xl sm:p-8">
                    <h2 className="mb-4 text-xl font-bold">{iAmHere ? "You're in the room" : "Join the Flow"}</h2>
                    <p className="mb-6 text-sm leading-relaxed text-[var(--foreground-muted)]">
                      {iAmHere
                        ? "You're part of this room — start a session and your minutes add to the room total."
                        : "Join a room and your focus minutes count toward the shared goal. Every member's session adds to the total."}
                    </p>
                    <Link
                      href={iAmHere ? "/" : "/study-rooms"}
                      className="flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-[var(--palette-white)] px-4 py-4 text-center text-lg font-semibold text-[var(--palette-black)] transition-transform hover:scale-105"
                    >
                      {iAmHere ? "Start a session" : "Browse rooms"}
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </PageTransition>
  );
}
