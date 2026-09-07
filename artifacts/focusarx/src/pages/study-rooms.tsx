import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Radio, Users, Lock, Globe, Plus, X, Send, MessageCircle, LogIn, LogOut, KeyRound, Crown,
  Copy, Check, Timer as TimerIcon, Play, Pause, RotateCcw, Sparkles, Bot, Shield, Search, Flame,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiJson, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { PageTransition } from "@/components/PageTransition";
import { EmotePicker } from "@/components/EmotePicker";
import { AdSlot } from "@/components/AdSlot";
import { Button } from "@/components/ui/button";
import { ambientEngine, AMBIENT_PRESETS } from "@/lib/ambientEngine";

// ─── Types (mirror artifacts/api-server/src/routes/studyRooms.ts) ────────────

type RoomMode = "silent" | "pomodoro" | "open_chat" | "accountability";
type RoomAmbiance = "silence" | "lofi" | "rain" | "cafe" | "forest" | "binaural";

interface Participant {
  userId: string;
  name: string;
  level: number;
  role: string;
  isHost: boolean;
  joinedAt: string;
  focusMinutes: number;
  online: boolean;
}

interface Room {
  id: string;
  name: string;
  description: string | null;
  topic: string | null;
  hostId: string;
  hostName: string;
  mode: RoomMode;
  ambiance: RoomAmbiance;
  status: string;
  isPublic: boolean;
  isPrivate: boolean;
  maxParticipants: number;
  timerDuration: number;
  inviteCode: string | null;
  scheduledFor: string | null;
  createdAt: string;
  memberCount: number;
  onlineCount: number;
  participants: Participant[];
  messageCount: number;
  isHost: boolean;
  isMember: boolean;
}

interface RoomMessage {
  id: string;
  userId: string | null;
  kind: "chat" | "system" | "bot";
  content: string;
  createdAt: string;
  authorName: string;
  isBot: boolean;
  isAdmin: boolean;
  isMine: boolean;
}

const MODE_META: Record<RoomMode, { label: string; hint: string; emoji: string }> = {
  silent: { label: "Silent", hint: "Cameras off, chat muted. Pure deep work.", emoji: "🤫" },
  pomodoro: { label: "Pomodoro", hint: "Shared 25/5 cycles with the room timer.", emoji: "🍅" },
  open_chat: { label: "Open chat", hint: "Talk freely, share notes and doubts.", emoji: "💬" },
  accountability: { label: "Accountability", hint: "Post a goal, report back when done.", emoji: "🎯" },
};

const AMBIANCE_META: Record<RoomAmbiance, { label: string; emoji: string; preset: string | null }> = {
  silence: { label: "Silence", emoji: "🔇", preset: null },
  lofi: { label: "Lo-fi", emoji: "🎧", preset: "deep-focus" },
  rain: { label: "Rain", emoji: "🌧️", preset: "rainy-cafe" },
  cafe: { label: "Café", emoji: "☕", preset: "rainy-cafe" },
  forest: { label: "Forest", emoji: "🌲", preset: "forest-walk" },
  binaural: { label: "Binaural", emoji: "🧠", preset: "deep-sleep" },
};

const TIMER_OPTIONS = [
  { label: "25 min", value: 1500 },
  { label: "45 min", value: 2700 },
  { label: "50 min", value: 3000 },
  { label: "90 min", value: 5400 },
];

// ─── API helpers ─────────────────────────────────────────────────────────────

const fetchRooms = () => apiJson<Room[]>("/api/study-rooms");
const joinRoom = (roomId: string) => apiJson<{ ok: boolean; room: Room }>(`/api/study-rooms/${roomId}/join`, { method: "POST", body: "{}" });
const leaveRoom = (roomId: string) => apiJson<{ ok: boolean }>(`/api/study-rooms/${roomId}/leave`, { method: "DELETE" });
const endRoom = (roomId: string) => apiJson<{ ok: boolean }>(`/api/study-rooms/${roomId}`, { method: "DELETE" });
const joinByCode = (inviteCode: string) => apiJson<{ ok: boolean; room: Room }>("/api/study-rooms/join-code", { method: "POST", body: JSON.stringify({ inviteCode }) });

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  return fallback;
}

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Room timer (shared plan; ticks locally) ─────────────────────────────────

// Mounted with `key={room.id}-${room.timerDuration}` so a room switch (or a
// host changing the plan) remounts it with fresh state — no reset-in-effect.
function RoomTimer({ room }: { room: Room }) {
  const [secondsLeft, setSecondsLeft] = useState(room.timerDuration);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<"focus" | "break">("focus");

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        // Phase flip: pomodoro rooms alternate focus/break, others just stop.
        if (room.mode === "pomodoro") {
          setPhase((p) => (p === "focus" ? "break" : "focus"));
          return phase === "focus" ? 300 : room.timerDuration;
        }
        setRunning(false);
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, room.mode, room.timerDuration, phase]);

  const total = phase === "focus" ? room.timerDuration : 300;
  const pct = total > 0 ? Math.round(((total - secondsLeft) / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">
          <TimerIcon size={12} /> Room timer · {phase === "focus" ? "Focus" : "Break"}
        </p>
        <span className="text-[11px] text-[var(--foreground-subtle)]">{pct}%</span>
      </div>
      <p className="mt-2 text-center font-mono text-4xl font-bold tabular-nums text-[var(--foreground)]">{formatClock(secondsLeft)}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full bg-[var(--brand-500)] transition-[width] duration-1000" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <Button size="sm" variant={running ? "outline" : "default"} onClick={() => setRunning((r) => !r)}>
          {running ? <><Pause /> Pause</> : <><Play /> Start</>}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setRunning(false); setPhase("focus"); setSecondsLeft(room.timerDuration); }}>
          <RotateCcw /> Reset
        </Button>
      </div>
    </div>
  );
}

// ─── Chat (REST polling) ─────────────────────────────────────────────────────

function RoomChat({ room, onLeft }: { room: Room; onLeft: () => void }) {
  const { toast } = useToast();
  // `loaded` lives with the messages so a poll result is one state update
  // (applied from the fetch callback, never synchronously in the effect body).
  const [chat, setChat] = useState<{ messages: RoomMessage[]; loaded: boolean }>({ messages: [], loaded: false });
  const { messages, loaded } = chat;
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const loadedRef = useRef(false);
  const lastTsRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" }), 30);
  }, []);

  const poll = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (lastTsRef.current) params.set("after", lastTsRef.current);
      const data = await apiJson<{ messages: RoomMessage[] }>(`/api/study-rooms/${room.id}/messages?${params.toString()}`);
      const wasLoaded = loadedRef.current;
      loadedRef.current = true;
      if (data.messages.length > 0) {
        const nearBottom = !listRef.current || listRef.current.scrollHeight - listRef.current.scrollTop - listRef.current.clientHeight < 120;
        lastTsRef.current = data.messages[data.messages.length - 1]!.createdAt;
        setChat((prev) => {
          const seen = new Set(prev.messages.map((m) => m.id));
          const next = [...prev.messages, ...data.messages.filter((m) => !seen.has(m.id))];
          return { messages: next.slice(-300), loaded: true };
        });
        if (nearBottom) scrollToBottom(wasLoaded);
      } else if (!wasLoaded) {
        setChat((prev) => (prev.loaded ? prev : { ...prev, loaded: true }));
      }
    } catch {
      /* transient — next poll retries */
    }
  }, [room.id, scrollToBottom]);

  // Initial load + polling while the tab is visible. The component is keyed
  // by room id, so a room switch remounts it with empty state.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") void poll(); };
    // First fetch on the next tick (after commit), then every 5 s while visible.
    let first: number | null = window.setTimeout(() => { first = null; tick(); }, 0);
    let id = window.setInterval(tick, 5000);
    const onVis = () => {
      window.clearInterval(id);
      if (document.visibilityState === "visible") {
        tick();
        id = window.setInterval(tick, 5000);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (first !== null) window.clearTimeout(first);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll]);

  // Presence heartbeat every 45 s.
  useEffect(() => {
    const beat = () => apiJson(`/api/study-rooms/${room.id}/heartbeat`, { method: "POST", body: "{}" }).catch(() => undefined);
    void beat();
    const id = window.setInterval(beat, 45_000);
    return () => window.clearInterval(id);
  }, [room.id]);

  const send = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const msg = await apiJson<RoomMessage>(`/api/study-rooms/${room.id}/messages`, { method: "POST", body: JSON.stringify({ content }) });
      setChat((prev) => (prev.messages.some((m) => m.id === msg.id) ? prev : { messages: [...prev.messages, msg], loaded: true }));
      lastTsRef.current = msg.createdAt;
      setInput("");
      scrollToBottom();
    } catch (err) {
      toast(errorMessage(err, "Message not sent"), "danger");
    } finally {
      setSending(false);
    }
  };

  const chatDisabled = room.mode === "silent";

  return (
    <div className="flex h-[min(60dvh,34rem)] min-h-[22rem] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)]">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MessageCircle size={14} className="text-[var(--brand-400)]" />
          <span className="text-sm font-semibold text-[var(--foreground)]">Room chat</span>
          <span className="text-[11px] text-[var(--foreground-subtle)]">· {room.onlineCount} online</span>
        </div>
        <Button size="xs" variant="ghost" onClick={onLeft}><LogOut /> Leave</Button>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {!loaded && <div className="flex h-full items-center justify-center text-sm text-[var(--foreground-subtle)]">Loading conversation…</div>}
        {loaded && messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-[var(--foreground-subtle)]">
            {chatDisabled ? "Silent room — focus together, no chat." : "No messages yet. Say hello! 👋"}
          </div>
        )}
        {messages.map((m) => {
          if (m.kind === "system") {
            return (
              <div key={m.id} className="flex justify-center">
                <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[11px] text-[var(--foreground-subtle)]">{m.content}</span>
              </div>
            );
          }
          return (
            <div key={m.id} className={`flex flex-col gap-0.5 ${m.isMine ? "items-end" : "items-start"}`}>
              <span className="flex items-center gap-1 text-[11px] text-[var(--foreground-subtle)]">
                {m.isBot && <Bot size={10} className="text-[var(--brand-400)]" />}
                {m.isAdmin && <Shield size={10} className="text-[var(--danger)]" />}
                {m.isMine ? "You" : m.authorName}
                <span className="opacity-60">· {timeAgo(m.createdAt)}</span>
              </span>
              <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${m.isMine ? "bg-[var(--brand-600)] text-[var(--neutral-0)]" : "bg-[var(--surface-2)] text-[var(--foreground)]"}`}>
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] px-3 py-2.5 pb-[max(.625rem,env(safe-area-inset-bottom))]">
        <EmotePicker onSelect={(emoji) => setInput((value) => `${value}${emoji}`)} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder={chatDisabled ? "Chat is off in silent rooms" : "Type a message…"}
          disabled={chatDisabled}
          maxLength={500}
          aria-label="Message"
          className="min-h-11 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 text-sm text-[var(--foreground)] placeholder-[var(--foreground-subtle)] outline-none focus:border-[var(--brand-500)] disabled:opacity-50"
        />
        <Button size="icon" onClick={() => void send()} disabled={!input.trim() || sending || chatDisabled} aria-label="Send message">
          <Send />
        </Button>
      </div>
    </div>
  );
}

// ─── Participant list ────────────────────────────────────────────────────────

function ParticipantList({ room }: { room: Room }) {
  const sorted = useMemo(
    () => [...room.participants].sort((a, b) => Number(b.online) - Number(a.online) || Number(b.isHost) - Number(a.isHost) || b.focusMinutes - a.focusMinutes),
    [room.participants],
  );
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">
        <Users size={12} /> In this room · {room.onlineCount}/{room.memberCount}
      </p>
      <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
        {sorted.length === 0 && <li className="text-sm text-[var(--foreground-subtle)]">Nobody here yet — be the first.</li>}
        {sorted.map((p) => (
          <li key={p.userId} className="flex items-center gap-3">
            <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-xs font-bold text-[var(--brand-strong)]">
              {p.name.slice(0, 2).toUpperCase()}
              <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface-1)] ${p.online ? "bg-[var(--success)]" : "bg-[var(--foreground-subtle)]"}`} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-medium text-[var(--foreground)]">
                {p.name}
                {p.isHost && <Crown size={11} className="text-[var(--brand-gold)]" aria-label="Host" />}
                {p.role === "bot" && <Bot size={11} className="text-[var(--brand-400)]" aria-label="AI rival" />}
              </p>
              <p className="text-[11px] text-[var(--foreground-subtle)]">Lv {p.level} · {p.focusMinutes}m focused</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Create room form ────────────────────────────────────────────────────────

type CreateForm = {
  name: string;
  description: string;
  topic: string;
  mode: RoomMode;
  ambiance: RoomAmbiance;
  timerDuration: number;
  maxParticipants: number;
  isPublic: boolean;
};

const DEFAULT_FORM: CreateForm = {
  name: "", description: "", topic: "", mode: "pomodoro", ambiance: "lofi", timerDuration: 1500, maxParticipants: 20, isPublic: true,
};

function CreateRoomPanel({ onClose, onCreated }: { onClose: () => void; onCreated: (room: Room) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<CreateForm>(DEFAULT_FORM);
  const set = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const createMut = useMutation({
    mutationFn: (body: CreateForm) => apiJson<Room>("/api/study-rooms", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (room) => { toast("Room is live 🎉", "success"); onCreated(room); },
    onError: (err) => toast(errorMessage(err, "Could not create the room"), "danger"),
  });

  const inputCls = "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--foreground-subtle)] outline-none focus:border-[var(--brand-500)]";
  const chip = (active: boolean) => `rounded-xl border px-3 py-2 text-left text-xs transition-colors ${active ? "border-[var(--brand-500)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--border-subtle)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)]"}`;

  return (
    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
      className="mb-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--foreground)]">Create a study room</p>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close"><X /></Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Room name (e.g. NEET Biology grind)" maxLength={80} className={inputCls} aria-label="Room name" />
          <input value={form.topic} onChange={(e) => set("topic", e.target.value)} placeholder="Topic / exam (optional)" maxLength={60} className={inputCls} aria-label="Topic" />
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What are we working on? (optional)" rows={3} maxLength={240} className={`${inputCls} resize-none`} aria-label="Description" />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--foreground-muted)]">
            <input type="checkbox" checked={!form.isPublic} onChange={(e) => set("isPublic", !e.target.checked)} className="accent-[var(--brand-600)]" />
            <Lock size={12} /> Private (invite code only)
          </label>
        </div>
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Mode</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(MODE_META) as RoomMode[]).map((m) => (
                <button key={m} type="button" onClick={() => set("mode", m)} className={chip(form.mode === m)} aria-pressed={form.mode === m}>
                  <span className="block font-semibold">{MODE_META[m].emoji} {MODE_META[m].label}</span>
                  <span className="block text-[10px] opacity-70">{MODE_META[m].hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Ambiance</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(AMBIANCE_META) as RoomAmbiance[]).map((a) => (
                <button key={a} type="button" onClick={() => set("ambiance", a)} className={chip(form.ambiance === a)} aria-pressed={form.ambiance === a}>
                  {AMBIANCE_META[a].emoji} {AMBIANCE_META[a].label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Timer</p>
              <select value={form.timerDuration} onChange={(e) => set("timerDuration", Number(e.target.value))} className={inputCls} aria-label="Timer length">
                {TIMER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Seats</p>
              <select value={form.maxParticipants} onChange={(e) => set("maxParticipants", Number(e.target.value))} className={inputCls} aria-label="Maximum participants">
                {[5, 10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
      <Button className="mt-4 w-full" onClick={() => createMut.mutate(form)} disabled={form.name.trim().length < 2 || createMut.isPending} loading={createMut.isPending}>
        <Sparkles /> Open room
      </Button>
    </motion.div>
  );
}

// ─── Room card ───────────────────────────────────────────────────────────────

function RoomCard({ room, expanded, authed, onToggle, onJoin, onLeave, onEnd, busy }: {
  room: Room; expanded: boolean; authed: boolean; busy: boolean;
  onToggle: () => void; onJoin: () => void; onLeave: () => void; onEnd: () => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const mode = MODE_META[room.mode] ?? MODE_META.silent;
  const amb = AMBIANCE_META[room.ambiance] ?? AMBIANCE_META.silence;

  const copyCode = async () => {
    if (!room.inviteCode) return;
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      setCopied(true);
      toast("Invite code copied", "success");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast(`Invite code: ${room.inviteCode}`, "info");
    }
  };

  const playAmbiance = () => {
    const preset = AMBIENT_PRESETS.find((p) => p.id === amb.preset);
    if (!preset) { ambientEngine.stopAll(); return; }
    ambientEngine.applyPreset(preset);
    toast(`Playing ${preset.label}`, "info");
  };

  return (
    <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border bg-[var(--card)] p-4 transition-colors sm:p-5 ${expanded ? "border-[var(--brand-500)]" : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {room.isPublic ? <Globe size={12} className="shrink-0 text-[var(--brand-teal)]" aria-label="Public" /> : <Lock size={12} className="shrink-0 text-[var(--brand-gold)]" aria-label="Private" />}
            <h2 className="truncate text-base font-semibold text-[var(--foreground)]">{room.name}</h2>
            {room.isHost && <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-strong)]">Your room</span>}
            {room.isMember && !room.isHost && <span className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--success)]">Joined</span>}
          </div>
          {room.description && <p className="mb-2 line-clamp-2 text-sm text-[var(--foreground-muted)]">{room.description}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--foreground-subtle)]">
            <span className="flex items-center gap-1"><Users size={10} />{room.memberCount}/{room.maxParticipants}</span>
            <span className="flex items-center gap-1 text-[var(--success)]">● {room.onlineCount} online</span>
            <span>{mode.emoji} {mode.label}</span>
            <span>{amb.emoji} {amb.label}</span>
            <span>⏱ {Math.round(room.timerDuration / 60)} min</span>
            {room.topic && <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5">#{room.topic}</span>}
            <span>host {room.hostName}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          {authed ? (
            room.isMember ? (
              <>
                <Button size="sm" variant={expanded ? "secondary" : "outline"} onClick={onToggle} aria-expanded={expanded}>
                  <MessageCircle /> {expanded ? "Hide" : "Open"}
                </Button>
                <Button size="sm" variant="ghost" onClick={onLeave} disabled={busy} aria-label="Leave room"><LogOut /></Button>
              </>
            ) : (
              <Button size="sm" onClick={onJoin} disabled={busy || room.memberCount >= room.maxParticipants} loading={busy}>
                <LogIn /> {room.memberCount >= room.maxParticipants ? "Full" : "Join"}
              </Button>
            )
          ) : (
            <Link href="/login" className="rounded-xl border border-[var(--border-strong)] px-3 py-2 text-xs font-medium text-[var(--brand-strong)] hover:bg-[var(--brand-soft)]">Sign in to join</Link>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && room.isMember && (
          <motion.div key="room-body" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_18rem]">
              <RoomChat key={room.id} room={room} onLeft={onLeave} />
              <div className="space-y-4">
                <RoomTimer key={`${room.id}-${room.timerDuration}`} room={room} />
                <ParticipantList room={room} />
                <div className="flex flex-wrap gap-2">
                  {amb.preset && <Button size="sm" variant="outline" onClick={playAmbiance}>{amb.emoji} Play {amb.label}</Button>}
                  {room.inviteCode && (
                    <Button size="sm" variant="outline" onClick={copyCode}>
                      {copied ? <Check /> : <Copy />} {room.inviteCode}
                    </Button>
                  )}
                  {room.isHost && <Button size="sm" variant="destructive" onClick={onEnd} disabled={busy}>End room</Button>}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StudyRoomsPage() {
  const { status } = useAuth();
  const authed = status === "authenticated";
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "mine" | "live">("all");

  const { data: rooms = [], isLoading, isError, refetch } = useQuery<Room[]>({
    queryKey: ["study-rooms"],
    queryFn: fetchRooms,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["study-rooms"] });

  const joinMut = useMutation({
    mutationFn: joinRoom,
    onSuccess: (_d, roomId) => { setExpandedId(roomId); void invalidate(); toast("You're in — say hi 👋", "success"); },
    onError: (err) => toast(errorMessage(err, "Could not join the room"), "danger"),
  });
  const leaveMut = useMutation({
    mutationFn: leaveRoom,
    onSuccess: (_d, roomId) => { if (expandedId === roomId) setExpandedId(null); void invalidate(); },
    onError: (err) => toast(errorMessage(err, "Could not leave the room"), "danger"),
  });
  const endMut = useMutation({
    mutationFn: endRoom,
    onSuccess: () => { setExpandedId(null); void invalidate(); toast("Room ended", "info"); },
    onError: (err) => toast(errorMessage(err, "Could not end the room"), "danger"),
  });
  const codeMut = useMutation({
    mutationFn: joinByCode,
    onSuccess: (data) => { setInviteCode(""); setExpandedId(data.room.id); void invalidate(); toast(`Joined ${data.room.name}`, "success"); },
    onError: (err) => toast(errorMessage(err, "Invalid invite code"), "danger"),
  });

  const visibleRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((r) => {
      if (filter === "mine" && !r.isMember) return false;
      if (filter === "live" && r.onlineCount === 0) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.topic ?? "").toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q);
    });
  }, [rooms, filter, search]);

  const totalOnline = rooms.reduce((n, r) => n + r.onlineCount, 0);
  const busy = joinMut.isPending || leaveMut.isPending || endMut.isPending;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <main className="relative z-[var(--z-content)] mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-10">
        <PageTransition>
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--foreground-subtle)]">Study together</p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
                <Radio size={22} className="text-[var(--brand-400)]" /> Study Rooms
              </h1>
              <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                {rooms.length} open room{rooms.length === 1 ? "" : "s"} · {totalOnline} studying right now
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate("/virtual-study-room")}><Flame /> Body doubling</Button>
              {authed ? (
                <Button onClick={() => setShowCreate((v) => !v)}><Plus /> New room</Button>
              ) : (
                <Link href="/login" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-strong)] px-4 text-sm font-medium text-[var(--brand-strong)] hover:bg-[var(--brand-soft)]">Sign in to join</Link>
              )}
            </div>
          </header>

          <AnimatePresence>
            {showCreate && authed && (
              <CreateRoomPanel
                onClose={() => setShowCreate(false)}
                onCreated={(room) => { setShowCreate(false); setExpandedId(room.id); void invalidate(); }}
              />
            )}
          </AnimatePresence>

          {/* Toolbar: search, filters, invite code */}
          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rooms by name or topic" aria-label="Search rooms"
                className="min-h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] pl-9 pr-3 text-sm text-[var(--foreground)] placeholder-[var(--foreground-subtle)] outline-none focus:border-[var(--brand-500)]" />
            </label>
            <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-1" role="tablist" aria-label="Filter rooms">
              {([["all", "All"], ["live", "Live now"], ["mine", "Joined"]] as const).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}
                  className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors ${filter === id ? "bg-[var(--brand-600)] text-[var(--neutral-0)]" : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}>
                  {label}
                </button>
              ))}
            </div>
            {authed && (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (inviteCode.trim()) codeMut.mutate(inviteCode.trim()); }}>
                <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder="Invite code" maxLength={12} aria-label="Invite code"
                  className="min-h-11 w-32 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 font-mono text-sm uppercase tracking-wider text-[var(--foreground)] placeholder-[var(--foreground-subtle)] outline-none focus:border-[var(--brand-500)]" />
                <Button type="submit" variant="outline" disabled={inviteCode.trim().length < 6 || codeMut.isPending} loading={codeMut.isPending} aria-label="Join with invite code"><KeyRound /></Button>
              </form>
            )}
          </div>

          {isLoading && (
            <div className="space-y-3" aria-busy="true">
              {[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--surface-1)]" />)}
            </div>
          )}

          {isError && !isLoading && (
            <div className="rounded-2xl border border-dashed border-[var(--danger)]/40 p-10 text-center">
              <p className="font-medium text-[var(--foreground)]">Rooms are unavailable right now</p>
              <Button className="mt-3" variant="outline" onClick={() => void refetch()}>Try again</Button>
            </div>
          )}

          {!isLoading && !isError && visibleRooms.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--border-strong)] p-12 text-center">
              <Radio size={32} className="mx-auto mb-3 text-[var(--foreground-subtle)]" />
              <p className="font-medium text-[var(--foreground)]">{rooms.length === 0 ? "No open rooms yet" : "No rooms match"}</p>
              <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                {rooms.length === 0 ? "Open one — the first person in a room sets its rhythm." : "Try a different search or filter."}
              </p>
              {authed && rooms.length === 0 && <Button className="mt-4" onClick={() => setShowCreate(true)}><Plus /> Create the first room</Button>}
            </div>
          )}

          <div className="space-y-4">
            {visibleRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                authed={authed}
                busy={busy}
                expanded={expandedId === room.id}
                onToggle={() => setExpandedId((id) => (id === room.id ? null : room.id))}
                onJoin={() => joinMut.mutate(room.id)}
                onLeave={() => leaveMut.mutate(room.id)}
                onEnd={() => { if (window.confirm("End this room for everyone?")) endMut.mutate(room.id); }}
              />
            ))}
            <AdSlot name="studyRoomsInFeed" minHeight={120} />
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
