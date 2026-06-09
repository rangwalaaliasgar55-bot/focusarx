import { useState, useEffect, useRef } from "react";
import { useAuth, getToken } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSocketEvent, getSocket } from "@/lib/socket";
import { Radio, Users, Lock, Globe, Plus, X, Send, MessageCircle, LogIn, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

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
    body: JSON.stringify(body),
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
    method: "POST",
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
    <div className="flex flex-col h-[420px] rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(124,58,237,0.15)]">
        <div className="flex items-center gap-2">
          <MessageCircle size={14} className="text-[#A78BFA]" />
          <span className="text-sm font-semibold text-[var(--foreground)]">{room.name}</span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-[#6B7280] hover:text-[#E2E8F0] hover:bg-[rgba(124,58,237,0.1)]">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-[#4B5563] text-sm">
            No messages yet. Say hello! 👋
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col gap-0.5 ${m.userId === session?.user?.id ? "items-end" : "items-start"}`}>
            <span className="text-[10px] text-[#4B5563]">{m.userId === session?.user?.id ? "You" : `User ${m.userId.slice(0, 6)}`}</span>
            <div className={`rounded-xl px-3 py-1.5 text-sm max-w-[80%] ${m.userId === session?.user?.id ? "bg-[rgba(124,58,237,0.25)] text-[#E2E8F0]" : "bg-[rgba(255,255,255,0.05)] text-[var(--foreground)]"}`}>
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[rgba(124,58,237,0.1)]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Type a message…"
          className="flex-1 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(124,58,237,0.15)] px-3 py-1.5 text-sm text-[var(--foreground)] placeholder-[#4B5563] outline-none focus:border-[rgba(124,58,237,0.4)]"
        />
        <button onClick={send} disabled={!input.trim()} className="rounded-xl bg-[#7C3AED] px-3 py-1.5 text-white disabled:opacity-40 hover:bg-[#6D28D9]">
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
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        <PageTransition>
          <header className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#4B5563]">Live collaboration</p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
                <Radio size={22} className="text-[#A78BFA]" /> Study Rooms
              </h1>
            </div>
            {status === "authenticated" ? (
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-4 py-2 text-sm font-medium text-white shadow-[0_0_12px_rgba(124,58,237,0.3)] hover:opacity-90">
                <Plus size={15} /> New Room
              </button>
            ) : (
              <Link href="/login" className="flex items-center gap-2 rounded-xl border border-[rgba(124,58,237,0.3)] px-4 py-2 text-sm font-medium text-[#A78BFA] hover:bg-[rgba(124,58,237,0.08)]">
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
                  <button onClick={() => setShowCreate(false)} className="text-[#6B7280] hover:text-[#E2E8F0]"><X size={16} /></button>
                </div>
                <div className="space-y-3">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Room name" maxLength={60}
                    className="w-full rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[#4B5563] outline-none focus:border-[rgba(124,58,237,0.5)]" />
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Description (optional)" rows={2} maxLength={200}
                    className="w-full rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[#4B5563] outline-none focus:border-[rgba(124,58,237,0.5)] resize-none" />
                  <label className="flex items-center gap-2 text-sm text-[#94A3B8] cursor-pointer">
                    <input type="checkbox" checked={form.isPrivate} onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })} className="accent-[#7C3AED]" />
                    Private room
                  </label>
                  <button onClick={() => createMut.mutate(form)} disabled={!form.name.trim() || createMut.isPending}
                    className="w-full rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] py-2.5 text-sm font-medium text-white disabled:opacity-50">
                    {createMut.isPending ? "Creating…" : "Create Room"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-[rgba(124,58,237,0.06)]" />)}
            </div>
          )}

          {!isLoading && rooms.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[rgba(124,58,237,0.2)] p-12 text-center">
              <Radio size={32} className="mx-auto mb-3 text-[#4B5563]" />
              <p className="text-[var(--foreground)] font-medium">No study rooms yet</p>
              <p className="mt-1 text-sm text-[#6B7280]">Create one and invite friends to study together</p>
            </div>
          )}

          <div className="space-y-4">
            {rooms.map((room) => {
              const joined = joinedRooms.has(room.id);
              return (
                <motion.div key={room.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl hover:border-[rgba(124,58,237,0.35)] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {room.isPrivate ? <Lock size={12} className="text-[#FFB800] shrink-0" /> : <Globe size={12} className="text-[#06D6A0] shrink-0" />}
                        <p className="font-semibold text-[var(--foreground)] truncate">{room.name}</p>
                      </div>
                      {room.description && <p className="text-sm text-[#6B7280] mb-2">{room.description}</p>}
                      <div className="flex items-center gap-3 text-[11px] text-[#4B5563]">
                        <span className="flex items-center gap-1"><Users size={10} />{room.memberCount} members</span>
                        {room.activeCount != null && <span className="flex items-center gap-1 text-[#22d387]">● {room.activeCount} online</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {status === "authenticated" ? (
                        <>
                          {joined && (
                            <button onClick={() => setActiveRoom(activeRoom?.id === room.id ? null : room)}
                              className={`rounded-xl px-3 py-1.5 text-xs font-medium border transition-colors ${activeRoom?.id === room.id ? "bg-[rgba(124,58,237,0.2)] border-[rgba(124,58,237,0.4)] text-[#A78BFA]" : "border-[rgba(124,58,237,0.2)] text-[#94A3B8] hover:text-[#A78BFA]"}`}>
                              <MessageCircle size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => joined ? leaveMut.mutate(room.id) : joinMut.mutate(room.id)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${joined ? "bg-[rgba(239,68,68,0.1)] text-[#F87171] hover:bg-[rgba(239,68,68,0.2)]" : "bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] text-white hover:opacity-90"}`}>
                            {joined ? <LogOut size={12} /> : <LogIn size={12} />}
                          </button>
                        </>
                      ) : (
                        <Link href="/login" className="rounded-xl border border-[rgba(124,58,237,0.25)] px-3 py-1.5 text-xs font-medium text-[#A78BFA] hover:bg-[rgba(124,58,237,0.08)]">
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
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
