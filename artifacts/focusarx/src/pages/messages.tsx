import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { MessageSquare, Send, Plus, Search, X, Users, ArrowLeft, MoreHorizontal, Smile } from "lucide-react";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) } });
  if (!res.ok) { const t = await res.text(); throw new Error(t); }
  return res.json();
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = (name || "U").slice(0, 2).toUpperCase();
  const colors = ["from-violet-500 to-indigo-600", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600", "from-rose-500 to-pink-600"];
  const color = colors[initials.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, fontSize: size * 0.35 }}
      className={`rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold shrink-0`}>
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
          <div className="rounded-lg bg-[#0a0c12] border border-[#1e2130] px-2 py-1 text-xs text-[#4a4f62] mb-1">
            ↩ {msg.replyTo.content?.slice(0, 50)}…
          </div>
        )}
        <div
          className={`relative rounded-2xl px-3 py-2 text-sm cursor-pointer ${isMe ? "bg-[#7C3AED] text-white rounded-tr-sm" : "bg-[#1e2130] text-[#e8eaf0] rounded-tl-sm"}`}
          onDoubleClick={() => setShowReact(s => !s)}
        >
          {msg.isDeleted ? <span className="italic text-[#4a4f62]">Message deleted</span> : msg.content}
          {msg.isEdited && <span className="ml-1 text-[10px] opacity-60">(edited)</span>}
        </div>
        {showReact && (
          <div className="flex gap-1 bg-[#111318] border border-[#1e2130] rounded-full px-2 py-1">
            {EMOJI_REACTIONS.map(e => (
              <button key={e} onClick={() => { onReact(e); setShowReact(false); }}
                className="text-base hover:scale-125 transition-transform">{e}</button>
            ))}
          </div>
        )}
        {Object.entries(msg.reactions || {}).length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {Object.entries(msg.reactions || {}).map(([emoji, count]) => (
              <span key={emoji} className="rounded-full bg-[#1e2130] px-2 py-0.5 text-xs">{emoji} {count as number}</span>
            ))}
          </div>
        )}
        <span className="text-[9px] text-[#3a3d4a]">{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
      </div>
    </div>
  );
}

function ConversationThread({ conv, currentUserId, onBack }: { conv: any; currentUserId: string; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", conv.id],
    queryFn: () => apiFetch(`/api/dm/${conv.id}/messages`),
    staleTime: 5_000,
    refetchInterval: 5_000,
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
      <div className="flex items-center gap-3 p-4 border-b border-[#1e2130]">
        <button onClick={onBack} className="sm:hidden text-[#4a4f62] hover:text-[#e8eaf0]"><ArrowLeft size={18} /></button>
        {conv.type === "group" ? <Users size={22} className="text-[#7C3AED]" /> : <Avatar name={otherName} size={36} />}
        <div>
          <p className="text-sm font-semibold text-[#e8eaf0]">{otherName}</p>
          {conv.type === "group" && <p className="text-xs text-[#4a4f62]">{conv.participantCount} members</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1e2130] border-t-[#7C3AED]" /></div>
        ) : (messages as any[]).length === 0 ? (
          <div className="text-center py-12 text-[#3a3d4a]">
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

      <div className="p-4 border-t border-[#1e2130]">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && text.trim()) { e.preventDefault(); sendMsg.mutate(); } }}
            placeholder="Type a message…"
            className="flex-1 rounded-xl border border-[#1e2130] bg-[#0a0c12] px-3 py-2 text-sm text-[#e8eaf0] placeholder-[#3a3d4a] outline-none focus:border-[#7C3AED]"
          />
          <button
            onClick={() => text.trim() && sendMsg.mutate()}
            disabled={!text.trim() || sendMsg.isPending}
            className="rounded-xl bg-[#7C3AED] px-3 py-2 text-white disabled:opacity-50 hover:bg-[#6d31d4] transition-colors"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#1e2130] bg-[#111318] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#e8eaf0]">New Message</h3>
          <button onClick={onClose}><X size={16} className="text-[#4a4f62]" /></button>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search friends…"
          className="w-full rounded-xl border border-[#1e2130] bg-[#0a0c12] px-3 py-2 text-sm text-[#e8eaf0] outline-none focus:border-[#7C3AED]"
          autoFocus />
        {q.length === 0 && (friends as any[]).length > 0 && (
          <p className="text-[10px] text-[#3a3d4a] mt-2 mb-1">Your friends</p>
        )}
        <div className="mt-1 space-y-1 max-h-56 overflow-y-auto">
          {displayList.map((u: any) => (
            <button key={u.id} onClick={() => onStart(u.id)}
              className="flex w-full items-center gap-3 rounded-xl p-2 hover:bg-[#1e2130] transition-colors">
              <Avatar name={u.name || "?"} size={32} />
              <span className="text-sm text-[#e8eaf0]">{u.name || "User"}</span>
            </button>
          ))}
          {q.length >= 2 && (searchResults as any[]).length === 0 && (
            <p className="text-xs text-center text-[#3a3d4a] py-4">No friends found matching "{q}"</p>
          )}
          {q.length === 0 && (friends as any[]).length === 0 && (
            <p className="text-xs text-center text-[#3a3d4a] py-6">Add friends first to send messages</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { data: session } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");

  const currentUserId = (session as any)?.user?.id;

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => apiFetch("/api/dm/conversations"),
    staleTime: 10_000,
    refetchInterval: 15_000,
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
    <div className="min-h-screen bg-[#0a0c12] text-[#e8eaf0] flex h-screen">
      {showNew && <NewConversationModal onClose={() => setShowNew(false)} onStart={(userId) => startDm.mutate(userId)} />}

      {/* Sidebar */}
      <div className={`flex flex-col border-r border-[#1e2130] bg-[#0a0c12] ${selectedConv ? "hidden sm:flex w-72" : "flex w-full sm:w-72"}`}>
        <div className="p-4 border-b border-[#1e2130]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-bold text-[#e8eaf0]">Messages</h1>
            <button onClick={() => setShowNew(true)} className="rounded-lg bg-[#7C3AED]/20 border border-[#7C3AED]/30 p-1.5 text-[#a78bfa] hover:bg-[#7C3AED]/30 transition-colors">
              <Plus size={15} />
            </button>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4a4f62]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="w-full rounded-xl border border-[#1e2130] bg-[#111318] pl-8 pr-3 py-1.5 text-xs text-[#e8eaf0] outline-none focus:border-[#7C3AED]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {[1,2,3].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-[#111318]" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[#3a3d4a]">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No conversations yet</p>
              <button onClick={() => setShowNew(true)} className="mt-3 text-xs text-[#7C3AED] hover:underline">Start one →</button>
            </div>
          ) : (
            filtered.map((c: any) => {
              const name = c.otherParticipant?.name || c.name || "Conversation";
              const isActive = selectedConv?.id === c.id;
              return (
                <button key={c.id} onClick={() => setSelectedConv(c)}
                  className={`flex w-full items-center gap-3 px-3 py-3 hover:bg-[#111318] transition-colors ${isActive ? "bg-[#111318] border-r-2 border-[#7C3AED]" : ""}`}>
                  {c.type === "group" ? (
                    <div className="h-9 w-9 rounded-full bg-[#7C3AED]/20 border border-[#7C3AED]/30 flex items-center justify-center shrink-0"><Users size={16} className="text-[#a78bfa]" /></div>
                  ) : (
                    <Avatar name={name} size={36} />
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-[#e8eaf0] truncate">{name}</p>
                    <p className="text-xs text-[#4a4f62] truncate">{c.lastMessage?.content || "No messages yet"}</p>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="shrink-0 rounded-full bg-[#7C3AED] text-white text-[9px] h-4 w-4 flex items-center justify-center font-bold">{c.unreadCount}</span>
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
            <MessageSquare size={48} className="text-[#7C3AED] opacity-30 mb-4" />
            <p className="text-lg font-semibold text-[#e8eaf0] mb-2">Your Messages</p>
            <p className="text-sm text-[#4a4f62] mb-6">Connect with friends and study partners</p>
            <button onClick={() => setShowNew(true)} className="rounded-xl bg-[#7C3AED] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6d31d4]">
              Start a conversation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
