import { useState, useEffect, useRef } from "react";
import { useAuth, getToken } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSocketEvent, getSocket } from "@/lib/socket";
import { Radio, Users, Lock, Globe, Plus, X, Send, MessageCircle, LogIn, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { EmotePicker } from "@/components/EmotePicker";
import { AdSlot } from "@/components/AdSlot";

interface Room {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  memberCount: number;
  activeCount?: number;
  createdAt: string;
}

interface RoomMessage {
  userId: string;
  content: string;
  ts: string;
  isBot?: boolean;
  botName?: string;
}

async function fetchRooms(): Promise<Room[]> {
  const token = getToken();
  const res = await fetch("/api/study-rooms", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Failed");
  const data = await res.json();
  return data.rooms ?? data;
}

async function createRoom(body: { name: string; description: string; isPrivate: boolean }): Promise<Room> {
  const token = getToken();
  const res = await fetch("/api/study-rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ name: body.name, description: body.description, isPublic: !body.isPrivate }),
  });
  if (!res.ok) throw new Error("Failed to create room");
  return res.json();
}

async function joinRoom(roomId: string): Promise<void> {
  const token = getToken();
  await fetch(`/api/study-rooms/${roomId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

async function leaveRoom(roomId: string): Promise<void> {
  const token = getToken();
  await fetch(`/api/study-rooms/${roomId}/leave`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

function RoomChat({ room, onClose }: { room: Room; onClose: () => void }) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [input, setInput] = useState("");
  const { data: session } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const socket = getSocket();

  useEffect(() => {
    socket?.emit("join:room", room.id);
    return () => { socket?.emit("leave:room", room.id); };
  }, [room.id, socket]);

  useSocketEvent<RoomMessage>("room:chat", (msg) => {
    setMessages((prev) => [...prev.slice(-199), msg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  });

  const send = () => {
    const content = input.trim();
    if (!content || !socket) return;
    socket.emit("room:chat", { roomId: room.id, content });
    setInput("");
  };

  return (
    <div className="flex h-[min(70dvh,42rem)] min-h-[28rem] flex-col rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--rgba-124-58-237-0_15)]">
        <div className="flex items-center gap-2">
          <MessageCircle size={14} className="text-[var(--brand-400)]" />
          <span className="text-sm font-semibold text-[var(--foreground)]">{room.name}</span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--palette-6b7280)] hover:text-[var(--foreground)] hover:bg-[var(--rgba-124-58-237-0_1)]">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-[var(--foreground-subtle)] text-sm">
            No messages yet. Say hello! 👋
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col gap-0.5 ${m.userId === session?.user?.id ? "items-end" : "items-start"}`}>
            <span className="text-[10px] text-[var(--foreground-subtle)]">{m.userId === session?.user?.id ? "You" : (m.botName ?? `User ${m.userId.slice(0, 6)}`)}</span>
            <div className={`rounded-xl px-3 py-1.5 text-sm max-w-[80%] ${m.userId === session?.user?.id ? "bg-[var(--rgba-124-58-237-0_25)] text-[var(--foreground)]" : "bg-[var(--rgba-255-255-255-0_05)] text-[var(--foreground)]"}`}>
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[var(--rgba-124-58-237-0_1)] pb-[max(.625rem,env(safe-area-inset-bottom))]">
        <EmotePicker onSelect={(emoji) => setInput((value) => `${value}${emoji}`)} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Type a message…"
          className="flex-1 rounded-xl bg-[var(--rgba-255-255-255-0_05)] border border-[var(--rgba-124-58-237-0_15)] px-3 py-1.5 text-sm text-[var(--foreground)] placeholder-[var(--foreground-subtle)] outline-none focus:border-[var(--rgba-124-58-237-0_4)]"
        />
        <button onClick={send} disabled={!input.trim()} className="rounded-xl bg-[var(--brand-600)] px-3 py-1.5 text-[var(--palette-white)] disabled:opacity-40 hover:bg-[var(--brand-700)]">
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

export default function StudyRoomsPage() {
  const { status } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [joinedRooms, setJoinedRooms] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: "", description: "", isPrivate: false });

  const { data: rooms = [], isLoading } = useQuery<Room[]>({
    queryKey: ["study-rooms"],
    queryFn: fetchRooms,
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: createRoom,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["study-rooms"] }); setShowCreate(false); setForm({ name: "", description: "", isPrivate: false }); },
  });

  const joinMut = useMutation({
    mutationFn: joinRoom,
    onSuccess: (_d, roomId) => { setJoinedRooms((p) => new Set([...p, roomId])); },
  });

  const leaveMut = useMutation({
    mutationFn: leaveRoom,
    onSuccess: (_d, roomId) => {
      setJoinedRooms((p) => { const s = new Set(p); s.delete(roomId); return s; });
      if (activeRoom?.id === roomId) setActiveRoom(null);
    },
  });

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <main className="relative z-[var(--z-content)] mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-10">
        <PageTransition>
          <header className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--foreground-subtle)]">Live collaboration</p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
                <Radio size={22} className="text-[var(--brand-400)]" /> Study Rooms
              </h1>
            </div>
            {status === "authenticated" ? (
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brand-600)] to-[var(--palette-4f46e5)] px-4 py-2 text-sm font-medium text-[var(--palette-white)] shadow-[0_0_12px_var(--rgba-124-58-237-0_3)] hover:opacity-90">
                <Plus size={15} /> New Room
              </button>
            ) : (
              <Link href="/login" className="flex items-center gap-2 rounded-xl border border-[var(--rgba-124-58-237-0_3)] px-4 py-2 text-sm font-medium text-[var(--brand-400)] hover:bg-[var(--rgba-124-58-237-0_08)]">
                Sign in to join
              </Link>
            )}
          </header>

          <AnimatePresence>
            {showCreate && (
              <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                className="mb-6 rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Create Room</p>
                  <button onClick={() => setShowCreate(false)} className="text-[var(--palette-6b7280)] hover:text-[var(--foreground)]"><X size={16} /></button>
                </div>
                <div className="space-y-3">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Room name" maxLength={60}
                    className="w-full rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-255-255-255-0_03)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--foreground-subtle)] outline-none focus:border-[var(--rgba-124-58-237-0_5)]" />
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Description (optional)" rows={2} maxLength={200}
                    className="w-full rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-255-255-255-0_03)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--foreground-subtle)] outline-none focus:border-[var(--rgba-124-58-237-0_5)] resize-none" />
                  <label className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] cursor-pointer">
                    <input type="checkbox" checked={form.isPrivate} onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })} className="accent-[var(--brand-600)]" />
                    Private room
                  </label>
                  <button onClick={() => createMut.mutate(form)} disabled={!form.name.trim() || createMut.isPending}
                    className="w-full rounded-xl bg-gradient-to-r from-[var(--brand-600)] to-[var(--palette-4f46e5)] py-2.5 text-sm font-medium text-[var(--palette-white)] disabled:opacity-50">
                    {createMut.isPending ? "Creating…" : "Create Room"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--rgba-124-58-237-0_06)]" />)}
            </div>
          )}

          {!isLoading && rooms.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--rgba-124-58-237-0_2)] p-12 text-center">
              <Radio size={32} className="mx-auto mb-3 text-[var(--foreground-subtle)]" />
              <p className="text-[var(--foreground)] font-medium">No study rooms yet</p>
              <p className="mt-1 text-sm text-[var(--palette-6b7280)]">Create one and invite friends to study together</p>
            </div>
          )}

          <div className="space-y-4">
            {rooms.map((room) => {
              const joined = joinedRooms.has(room.id);
              return (
                <motion.div key={room.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl hover:border-[var(--rgba-124-58-237-0_35)] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {room.isPrivate ? <Lock size={12} className="text-[var(--brand-gold)] shrink-0" /> : <Globe size={12} className="text-[var(--brand-teal)] shrink-0" />}
                        <p className="font-semibold text-[var(--foreground)] truncate">{room.name}</p>
                      </div>
                      {room.description && <p className="text-sm text-[var(--palette-6b7280)] mb-2">{room.description}</p>}
                      <div className="flex items-center gap-3 text-[11px] text-[var(--foreground-subtle)]">
                        <span className="flex items-center gap-1"><Users size={10} />{room.memberCount} members</span>
                        {room.activeCount != null && <span className="flex items-center gap-1 text-[var(--palette-22d387)]">● {room.activeCount} online</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {status === "authenticated" ? (
                        <>
                          {joined && (
                            <button onClick={() => setActiveRoom(activeRoom?.id === room.id ? null : room)}
                              className={`rounded-xl px-3 py-1.5 text-xs font-medium border transition-colors ${activeRoom?.id === room.id ? "bg-[var(--rgba-124-58-237-0_2)] border-[var(--rgba-124-58-237-0_4)] text-[var(--brand-400)]" : "border-[var(--rgba-124-58-237-0_2)] text-[var(--foreground-muted)] hover:text-[var(--brand-400)]"}`}>
                              <MessageCircle size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => joined ? leaveMut.mutate(room.id) : joinMut.mutate(room.id)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${joined ? "bg-[var(--rgba-239-68-68-0_1)] text-[var(--palette-f87171)] hover:bg-[var(--rgba-239-68-68-0_2)]" : "bg-gradient-to-r from-[var(--brand-600)] to-[var(--palette-4f46e5)] text-[var(--palette-white)] hover:opacity-90"}`}>
                            {joined ? <LogOut size={12} /> : <LogIn size={12} />}
                          </button>
                        </>
                      ) : (
                        <Link href="/login" className="rounded-xl border border-[var(--rgba-124-58-237-0_25)] px-3 py-1.5 text-xs font-medium text-[var(--brand-400)] hover:bg-[var(--rgba-124-58-237-0_08)]">
                          Sign in to join
                        </Link>
                      )}
                    </div>
                  </div>
                  <AnimatePresence>
                    {activeRoom?.id === room.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden">
                        <RoomChat room={room} onClose={() => setActiveRoom(null)} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {/* In-feed ad after the room list. Deliberately outside the list
                so it is never mistaken for a joinable room. */}
            <AdSlot name="studyRoomsInFeed" minHeight={120} />
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
