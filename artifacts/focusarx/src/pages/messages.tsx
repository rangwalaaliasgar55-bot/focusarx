import { useState, useRef, useEffect, Component, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { MessageSquare, Send, Plus, Search, X, Users, ArrowLeft, AlertCircle, RefreshCw } from "lucide-react";
import { EmotePicker } from "@/components/EmotePicker";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) } });
  if (!res.ok) { const t = await res.text(); throw new Error(t); }
  return res.json();
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = (name || "U").slice(0, 2).toUpperCase();
  const colors = ["from-[var(--palette-violet-500)] to-[var(--palette-indigo-600)]", "from-[var(--palette-emerald-500)] to-[var(--palette-teal-600)]", "from-[var(--palette-amber-500)] to-[var(--palette-orange-600)]", "from-[var(--palette-rose-500)] to-[var(--palette-pink-600)]"];
  const color = colors[initials.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, fontSize: size * 0.35 }}
      className={`rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-[var(--palette-white)] font-bold shrink-0`}>
      {initials}
    </div>
  );
}

const EMOJI_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎯", "🏆"];

function MessageBubble({ msg, isMe, onReact }: { msg: any; isMe: boolean; onReact: (emoji: string) => void }) {
  const [showReact, setShowReact] = useState(false);

  return (
    <div className={`flex gap-2 group ${isMe ? "flex-row-reverse" : ""}`}>
      {!isMe && <Avatar name={msg.senderName || "U"} size={28} />}
      <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        {msg.replyTo && (
          <div className="rounded-lg bg-[var(--rgba-255-255-255-0_02)] border border-[var(--rgba-255-255-255-0_06)] px-2 py-1 text-xs text-[var(--foreground-subtle)] mb-1">
            ↩ {msg.replyTo.content?.slice(0, 50)}…
          </div>
        )}
        <div
          className={`relative rounded-2xl px-3 py-2 text-sm cursor-pointer ${isMe ? "bg-[var(--brand-600)] text-[var(--palette-white)] rounded-tr-sm" : "bg-[var(--rgba-255-255-255-0_06)] text-[var(--foreground)] rounded-tl-sm"}`}
          onDoubleClick={() => setShowReact(s => !s)}
        >
          {msg.isDeleted ? <span className="italic text-[var(--foreground-subtle)]">Message deleted</span> : msg.content}
          {msg.isEdited && <span className="ml-1 text-[10px] opacity-60">(edited)</span>}
        </div>
        {showReact && (
          <div className="flex gap-1 bg-[var(--rgba-255-255-255-0_025)] border border-[var(--rgba-255-255-255-0_06)] rounded-full px-2 py-1">
            {EMOJI_REACTIONS.map(e => (
              <button key={e} onClick={() => { onReact(e); setShowReact(false); }}
                className="text-base hover:scale-125 transition-transform">{e}</button>
            ))}
          </div>
        )}
        {Object.entries(msg.reactions || {}).length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {Object.entries(msg.reactions || {}).map(([emoji, count]) => (
              <span key={emoji} className="rounded-full bg-[var(--rgba-255-255-255-0_06)] px-2 py-0.5 text-xs">{emoji} {count as number}</span>
            ))}
          </div>
        )}
        <span className="text-[9px] text-[var(--foreground-subtle)]">{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
      </div>
    </div>
  );
}

function ConversationThread({ conv, currentUserId, onBack }: { conv: any; currentUserId: string; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading, isError: msgsError } = useQuery({
    queryKey: ["messages", conv.id],
    queryFn: () => apiFetch(`/api/dm/${conv.id}/messages`),
    staleTime: 5_000,
    refetchInterval: 5_000,
    retry: 2,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMsg = useMutation({
    mutationFn: () => apiFetch(`/api/dm/${conv.id}/messages`, { method: "POST", body: JSON.stringify({ content: text.trim() }) }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["messages", conv.id] }); qc.invalidateQueries({ queryKey: ["conversations"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const reactMsg = useMutation({
    mutationFn: ({ msgId, emoji }: { msgId: string; emoji: string }) =>
      apiFetch(`/api/dm/messages/${msgId}/react`, { method: "POST", body: JSON.stringify({ emoji }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", conv.id] }),
  });

  const otherName = conv.otherParticipant?.name || conv.name || "Conversation";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b border-[var(--rgba-255-255-255-0_06)]">
        <button onClick={onBack} className="sm:hidden text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"><ArrowLeft size={18} /></button>
        {conv.type === "group" ? <Users size={22} className="text-[var(--brand-600)]" /> : <Avatar name={otherName} size={36} />}
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">{otherName}</p>
          {conv.type === "group" && <p className="text-xs text-[var(--foreground-subtle)]">{conv.participantCount} members</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--rgba-255-255-255-0_06)] border-t-[var(--brand-600)]" /></div>
        ) : msgsError ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle size={28} className="text-[var(--foreground-subtle)] mb-2" />
            <p className="text-sm text-[var(--foreground-subtle)]">Couldn't load messages</p>
          </div>
        ) : (messages as any[]).length === 0 ? (
          <div className="text-center py-12 text-[var(--foreground-subtle)]">
            <MessageSquare size={36} className="mx-auto mb-3 opacity-30" />
            <p>No messages yet. Say hello! 👋</p>
          </div>
        ) : (
          (messages as any[]).map((m: any) => (
            <MessageBubble key={m.id} msg={m} isMe={m.senderId === currentUserId}
              onReact={(emoji) => reactMsg.mutate({ msgId: m.id, emoji })} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-[var(--rgba-255-255-255-0_06)]">
        <div className="flex gap-2 pb-[env(safe-area-inset-bottom)]">
          <EmotePicker onSelect={(emoji) => setText((value) => `${value}${emoji}`)} />
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && text.trim()) { e.preventDefault(); sendMsg.mutate(); } }}
            placeholder="Type a message…"
            className="flex-1 rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--palette-3a3d4a)] outline-none focus:border-[var(--brand-600)]"
          />
          <button
            onClick={() => text.trim() && sendMsg.mutate()}
            disabled={!text.trim() || sendMsg.isPending}
            className="rounded-xl bg-[var(--brand-600)] px-3 py-2 text-[var(--palette-white)] disabled:opacity-50 hover:bg-[var(--palette-6d31d4)] transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function NewConversationModal({ onClose, onStart }: { onClose: () => void; onStart: (userId: string) => void }) {
  const [q, setQ] = useState("");
  const { data: friends = [] } = useQuery({
    queryKey: ["dm-friends"],
    queryFn: () => apiFetch("/api/social/friends"),
    staleTime: 30_000,
  });
  const { data: searchResults = [] } = useQuery({
    queryKey: ["user-search-dm", q],
    queryFn: () => apiFetch(`/api/social/search?q=${encodeURIComponent(q)}&friendsOnly=true`),
    enabled: q.length >= 2,
    staleTime: 10_000,
  });

  const displayList = q.length >= 2 ? (searchResults as any[]) : (friends as any[]);

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--palette-black)]/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">New Message</h3>
          <button onClick={onClose}><X size={16} className="text-[var(--foreground-subtle)]" /></button>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search friends…"
          className="w-full rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand-600)]"
          autoFocus />
        {q.length === 0 && (friends as any[]).length > 0 && (
          <p className="text-[10px] text-[var(--foreground-subtle)] mt-2 mb-1">Your friends</p>
        )}
        <div className="mt-1 space-y-1 max-h-56 overflow-y-auto">
          {displayList.map((u: any) => (
            <button key={u.id} onClick={() => onStart(u.id)}
              className="flex w-full items-center gap-3 rounded-xl p-2 hover:bg-[var(--rgba-255-255-255-0_06)] transition-colors">
              <Avatar name={u.name || "?"} size={32} />
              <span className="text-sm text-[var(--foreground)]">{u.name || "User"}</span>
            </button>
          ))}
          {q.length >= 2 && (searchResults as any[]).length === 0 && (
            <p className="text-xs text-center text-[var(--foreground-subtle)] py-4">No friends found matching "{q}"</p>
          )}
          {q.length === 0 && (friends as any[]).length === 0 && (
            <p className="text-xs text-center text-[var(--foreground-subtle)] py-6">Add friends first to send messages</p>
          )}
        </div>
      </div>
    </div>
  );
}

class MessagesErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error("[MessagesPage] Uncaught error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--rgba-255-255-255-0_02)] flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <AlertCircle size={40} className="text-[var(--foreground-subtle)] mx-auto mb-4" />
            <p className="text-base font-semibold text-[var(--foreground)] mb-2">Something went wrong</p>
            <p className="text-sm text-[var(--foreground-subtle)] mb-5">The messages page ran into an error. Try reloading.</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="flex items-center gap-2 mx-auto rounded-xl bg-[var(--brand-600)] px-5 py-2 text-sm font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-6d31d4)] transition-colors"
            >
              <RefreshCw size={14} /> Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MessagesPageInner() {
  const { data: session } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");

  const currentUserId = (session as any)?.user?.id;

  const { data: conversations = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => apiFetch("/api/dm/conversations"),
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry: 2,
  });

  const startDm = useMutation({
    mutationFn: (userId: string) => apiFetch("/api/dm/start", { method: "POST", body: JSON.stringify({ userId }) }),
    onSuccess: (conv) => { setShowNew(false); setSelectedConv(conv); qc.invalidateQueries({ queryKey: ["conversations"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const filtered = (conversations as any[]).filter((c: any) => {
    if (!search) return true;
    const name = c.otherParticipant?.name || c.name || "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-[var(--rgba-255-255-255-0_02)] text-[var(--foreground)] flex h-screen">
      {showNew && <NewConversationModal onClose={() => setShowNew(false)} onStart={(userId) => startDm.mutate(userId)} />}

      {/* Sidebar */}
      <div className={`flex flex-col border-r border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)] ${selectedConv ? "hidden sm:flex w-72" : "flex w-full sm:w-72"}`}>
        <div className="p-4 border-b border-[var(--rgba-255-255-255-0_06)]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-bold text-[var(--foreground)]">Messages</h1>
            <button onClick={() => setShowNew(true)} className="rounded-lg bg-[var(--brand-600)]/20 border border-[var(--brand-600)]/30 p-1.5 text-[var(--brand-400)] hover:bg-[var(--brand-600)]/30 transition-colors">
              <Plus size={15} />
            </button>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="w-full rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] pl-8 pr-3 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--brand-600)]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {[1,2,3].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--rgba-255-255-255-0_025)]" />)}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <AlertCircle size={28} className="text-[var(--foreground-subtle)] mb-3 opacity-60" />
              <p className="text-sm text-[var(--foreground-subtle)] mb-3">Couldn't load conversations</p>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--rgba-255-255-255-0_06)] px-3 py-1.5 text-xs text-[var(--brand-400)] hover:bg-[var(--rgba-255-255-255-0_06)] transition-colors"
              >
                <RefreshCw size={11} /> Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[var(--foreground-subtle)]">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No conversations yet</p>
              <button onClick={() => setShowNew(true)} className="mt-3 text-xs text-[var(--brand-600)] hover:underline">Start one →</button>
            </div>
          ) : (
            filtered.map((c: any) => {
              const name = c.otherParticipant?.name || c.name || "Conversation";
              const isActive = selectedConv?.id === c.id;
              return (
                <button key={c.id} onClick={() => setSelectedConv(c)}
                  className={`flex w-full items-center gap-3 px-3 py-3 hover:bg-[var(--rgba-255-255-255-0_025)] transition-colors ${isActive ? "bg-[var(--rgba-255-255-255-0_025)] border-r-2 border-[var(--brand-600)]" : ""}`}>
                  {c.type === "group" ? (
                    <div className="h-9 w-9 rounded-full bg-[var(--brand-600)]/20 border border-[var(--brand-600)]/30 flex items-center justify-center shrink-0"><Users size={16} className="text-[var(--brand-400)]" /></div>
                  ) : (
                    <Avatar name={name} size={36} />
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{name}</p>
                    <p className="text-xs text-[var(--foreground-subtle)] truncate">{c.lastMessage?.content || "No messages yet"}</p>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="shrink-0 rounded-full bg-[var(--brand-600)] text-[var(--palette-white)] text-[9px] h-4 w-4 flex items-center justify-center font-bold">{c.unreadCount}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className={`flex-1 flex flex-col ${!selectedConv ? "hidden sm:flex" : "flex"}`}>
        {selectedConv ? (
          <ConversationThread conv={selectedConv} currentUserId={currentUserId} onBack={() => setSelectedConv(null)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <MessageSquare size={48} className="text-[var(--brand-600)] opacity-30 mb-4" />
            <p className="text-lg font-semibold text-[var(--foreground)] mb-2">Your Messages</p>
            <p className="text-sm text-[var(--foreground-subtle)] mb-6">Connect with friends and study partners</p>
            <button onClick={() => setShowNew(true)} className="rounded-xl bg-[var(--brand-600)] px-5 py-2 text-sm font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-6d31d4)]">
              Start a conversation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <MessagesErrorBoundary>
      <MessagesPageInner />
    </MessagesErrorBoundary>
  );
}
