import { useState, useRef } from "react";
import type { ElementType } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Users, UserPlus, Trophy, Activity, Check, X, Bell, Clock, Rss, Heart, MessageCircle, Bookmark, Flame, Plus, Send, MoreHorizontal, Image, Edit3, Newspaper, Trash2 } from "lucide-react";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = (name || "U").slice(0, 2).toUpperCase();
  const colors = ["from-violet-500 to-indigo-600", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600", "from-rose-500 to-pink-600", "from-blue-500 to-cyan-600"];
  const color = colors[initials.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, fontSize: size * 0.35 }} className={`rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold shrink-0`}>
      {initials}
    </div>
  );
}

function FriendCard({ friend }: { friend: any }) {
  const focusMinutes = friend.isStudying && friend.studyStartedAt
    ? Math.floor((Date.now() - new Date(friend.studyStartedAt).getTime()) / 60000)
    : (friend.studyingFor ?? 0);

  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${friend.isStudying ? "border-emerald-500/30 bg-[#0d1a12] hover:border-emerald-500/50" : "border-[#1e2130] bg-[#111318] hover:border-[#7C3AED]/40"}`}>
      <div className="relative shrink-0">
        <Avatar name={friend.name} />
        {friend.isStudying && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#0d1a12] animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-[#e8eaf0] truncate">{friend.name}</p>
          {friend.isStudying && (
            <span className="shrink-0 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 uppercase tracking-wide">
              Focusing
            </span>
          )}
        </div>
        {friend.isStudying ? (
          <p className="text-xs text-emerald-400/80 flex items-center gap-1">
            <Clock size={10} /> {focusMinutes > 0 ? `${focusMinutes} min deep work` : "Just started"}
          </p>
        ) : (
          <p className="text-xs text-[#4a4f62]">Level {friend.level} · {friend.xp.toLocaleString()} XP</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-bold text-amber-400">🔥 {friend.streak}</p>
        {friend.sessionsToday > 0 && !friend.isStudying && <p className="text-[10px] text-[#4a4f62]">{friend.sessionsToday} sessions</p>}
      </div>
    </div>
  );
}

function LeaderboardTable({ data }: { data: any[] }) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="space-y-2">
      {data.map((e, i) => (
        <div key={e.userId} className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${e.isMe ? "border-[#7C3AED]/50 bg-[#7C3AED]/10" : "border-[#1e2130] bg-[#111318]"}`}>
          <span className="w-6 text-center text-sm">{i < 3 ? medals[i] : `${i + 1}`}</span>
          <Avatar name={e.name} size={32} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#e8eaf0] truncate">{e.name}{e.isMe && " (You)"}</p>
            <p className="text-xs text-[#4a4f62]">Level {e.level} · 🔥 {e.streak}</p>
          </div>
          <span className="text-sm font-bold text-[#a5a8ff]">{e.xp.toLocaleString()} XP</span>
        </div>
      ))}
      {!data.length && <p className="text-center text-sm text-[#3a3d4a] py-6">Add friends to see them on the leaderboard</p>}
    </div>
  );
}

const REACTIONS = [
  { key: "fire", emoji: "🔥", label: "Fire" },
  { key: "insightful", emoji: "💡", label: "Insightful" },
  { key: "focused", emoji: "🎯", label: "Focused" },
  { key: "legendary", emoji: "🏆", label: "Legendary" },
  { key: "love", emoji: "❤️", label: "Love" },
];

function PostCard({ post, currentUserId, onReacted, onSaved, onDeleted }: { post: any; currentUserId: string; onReacted: () => void; onSaved: () => void; onDeleted: () => void }) {
  const { toast } = useToast();
  const [showComments, setShowComments] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [commentText, setCommentText] = useState("");

  const react = useMutation({
    mutationFn: (reaction: string) => apiFetch(`/api/posts/${post.id}/react`, { method: "POST", body: JSON.stringify({ reaction }) }),
    onSuccess: onReacted,
    onError: (e: any) => toast(e.message, "error"),
  });

  const save = useMutation({
    mutationFn: () => apiFetch(`/api/posts/${post.id}/save`, { method: "POST" }),
    onSuccess: onSaved,
  });

  const del = useMutation({
    mutationFn: () => apiFetch(`/api/posts/${post.id}`, { method: "DELETE" }),
    onSuccess: onDeleted,
  });

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["post-comments", post.id],
    queryFn: () => apiFetch(`/api/posts/${post.id}/comments`),
    enabled: showComments,
    staleTime: 30_000,
  });

  const addComment = useMutation({
    mutationFn: () => apiFetch(`/api/posts/${post.id}/comments`, { method: "POST", body: JSON.stringify({ content: commentText }) }),
    onSuccess: () => { setCommentText(""); refetchComments(); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const totalReactions = post.totalReactions || 0;
  const dominantReaction = totalReactions > 0
    ? REACTIONS.find(r => r.key === Object.entries(post.reactionCounts || {}).sort((a: any, b: any) => b[1] - a[1])[0]?.[0])
    : null;

  return (
    <div className="rounded-2xl border border-[#1e2130] bg-[#111318] overflow-hidden hover:border-[#7C3AED]/20 transition-colors">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <Avatar name={post.author?.name || "U"} size={38} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[#e8eaf0]">{post.author?.name || "User"}</p>
              <span className="text-[10px] font-bold bg-[#7C3AED]/20 text-[#a78bfa] rounded-full px-1.5 py-0.5">Lv.{post.author?.level || 1}</span>
            </div>
            <p className="text-xs text-[#4a4f62]">{post.createdAt ? timeAgo(post.createdAt) : ""}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {post.userId === currentUserId && (
              <button onClick={() => { if (confirm("Delete this post?")) del.mutate(); }}
                className="rounded-lg p-1.5 text-[#4a4f62] hover:text-red-400 hover:bg-red-900/20 transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        <p className="text-sm text-[#d4d6e0] leading-relaxed whitespace-pre-wrap">{post.content}</p>

        {post.type === "achievement" && post.metadata && (
          <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-center gap-2">
            <span className="text-2xl">{post.metadata.icon || "🏆"}</span>
            <div><p className="text-xs font-bold text-amber-400">{post.metadata.title || "Achievement"}</p><p className="text-[11px] text-amber-300/60">{post.metadata.description}</p></div>
          </div>
        )}
      </div>

      <div className="px-4 pb-3 flex items-center gap-1 border-t border-[#1e2130] pt-3">
        {/* Reaction button */}
        <div className="relative">
          <button
            onMouseEnter={() => setShowReactions(true)}
            onMouseLeave={() => setShowReactions(false)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${post.myReaction ? "bg-[#7C3AED]/20 text-[#a78bfa]" : "text-[#4a4f62] hover:bg-[#1e2130] hover:text-[#e8eaf0]"}`}
          >
            <span>{dominantReaction?.emoji || "🔥"}</span>
            <span>{totalReactions > 0 ? totalReactions : ""}</span>
            {!post.myReaction && <span>React</span>}
            {post.myReaction && <span>{REACTIONS.find(r => r.key === post.myReaction)?.emoji}</span>}
          </button>
          {showReactions && (
            <div
              onMouseEnter={() => setShowReactions(true)}
              onMouseLeave={() => setShowReactions(false)}
              className="absolute bottom-full left-0 mb-1 z-10 flex gap-1 bg-[#0a0c12] border border-[#1e2130] rounded-xl px-2 py-1.5 shadow-xl"
            >
              {REACTIONS.map(r => (
                <button key={r.key} onClick={() => react.mutate(r.key)} title={r.label}
                  className={`text-lg hover:scale-125 transition-transform rounded-lg p-0.5 ${post.myReaction === r.key ? "bg-[#7C3AED]/30 ring-1 ring-[#7C3AED]" : ""}`}>
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => setShowComments(s => !s)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${showComments ? "bg-[#1e2130] text-[#e8eaf0]" : "text-[#4a4f62] hover:bg-[#1e2130] hover:text-[#e8eaf0]"}`}>
          <MessageCircle size={13} />
          <span>{post.commentCount > 0 ? post.commentCount : "Comment"}</span>
        </button>

        <button onClick={() => save.mutate()}
          className={`ml-auto rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${post.isSaved ? "text-amber-400 bg-amber-500/10" : "text-[#4a4f62] hover:bg-[#1e2130] hover:text-[#e8eaf0]"}`}>
          <Bookmark size={13} />
        </button>
      </div>

      {showComments && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#1e2130] pt-3">
          {(comments as any[]).map((c: any) => (
            <div key={c.id} className="flex gap-2">
              <Avatar name={c.authorName || "U"} size={24} />
              <div className="flex-1 bg-[#0a0c12] rounded-xl px-3 py-2">
                <p className="text-xs font-semibold text-[#a78bfa]">{c.authorName || "User"}</p>
                <p className="text-xs text-[#d4d6e0] mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={commentText} onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && commentText.trim()) { e.preventDefault(); addComment.mutate(); } }}
              placeholder="Write a comment…"
              className="flex-1 rounded-xl border border-[#1e2130] bg-[#0a0c12] px-3 py-1.5 text-xs text-[#e8eaf0] placeholder-[#3a3d4a] outline-none focus:border-[#7C3AED]" />
            <button onClick={() => commentText.trim() && addComment.mutate()} disabled={!commentText.trim()} className="rounded-xl bg-[#7C3AED] px-3 py-1.5 text-white disabled:opacity-50 hover:bg-[#6d31d4]">
              <Send size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreatePostBox({ currentUserId, onCreated }: { currentUserId: string; onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [type, setType] = useState("general");

  const create = useMutation({
    mutationFn: () => apiFetch("/api/posts", { method: "POST", body: JSON.stringify({ content: content.trim(), type }) }),
    onSuccess: () => { setContent(""); setOpen(false); toast("Post shared! 🎉", "success"); onCreated(); },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full flex items-center gap-3 rounded-2xl border border-[#1e2130] bg-[#111318] p-4 text-left hover:border-[#7C3AED]/40 transition-colors mb-4">
      <div className="h-9 w-9 rounded-full bg-[#7C3AED]/20 border border-[#7C3AED]/30 flex items-center justify-center shrink-0"><Edit3 size={15} className="text-[#a78bfa]" /></div>
      <span className="text-sm text-[#3a3d4a]">Share your progress, thoughts, or wins…</span>
    </button>
  );

  return (
    <div className="rounded-2xl border border-[#7C3AED]/40 bg-[#111318] p-4 mb-4">
      <div className="flex gap-2 mb-3">
        {["general", "study_log", "achievement", "question"].map(t => (
          <button key={t} onClick={() => setType(t)} className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-all ${type === t ? "bg-[#7C3AED] text-white" : "bg-[#0a0c12] text-[#4a4f62] hover:text-[#e8eaf0] border border-[#1e2130]"}`}>
            {t === "study_log" ? "📝 Log" : t === "achievement" ? "🏆 Win" : t === "question" ? "❓ Ask" : "💬 Share"}
          </button>
        ))}
      </div>
      <textarea value={content} onChange={e => setContent(e.target.value)}
        placeholder="What's on your mind? Share a study update, win, or question…"
        rows={3}
        className="w-full rounded-xl border border-[#1e2130] bg-[#0a0c12] px-3 py-2 text-sm text-[#e8eaf0] placeholder-[#3a3d4a] outline-none focus:border-[#7C3AED] resize-none" />
      <div className="flex justify-between items-center mt-2">
        <span className={`text-xs ${content.length > 1800 ? "text-red-400" : "text-[#3a3d4a]"}`}>{content.length}/2000</span>
        <div className="flex gap-2">
          <button onClick={() => { setOpen(false); setContent(""); }} className="rounded-lg px-3 py-1.5 text-xs text-[#4a4f62] hover:text-[#e8eaf0]">Cancel</button>
          <button onClick={() => content.trim() && create.mutate()} disabled={!content.trim() || create.isPending || content.length > 2000}
            className="rounded-xl bg-[#7C3AED] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-[#6d31d4]">
            {create.isPending ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SocialPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: session } = useAuth();
  const currentUserId = (session as any)?.user?.id ?? "";
  const [tab, setTab] = useState<"feed" | "friends" | "requests" | "leaderboard" | "activity" | "following">("feed");
  const [feedType, setFeedType] = useState<"following" | "discover" | "saved">("following");
  const [searchQ, setSearchQ] = useState("");
  const [addQ, setAddQ] = useState("");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "alltime">("weekly");

  const { data: friends = [], isError: friendsError, isLoading: friendsLoading } = useQuery({ queryKey: ["social-friends"], queryFn: () => apiFetch("/api/social/friends"), staleTime: 30_000 });
  const { data: requests, isError: requestsError } = useQuery({ queryKey: ["social-requests"], queryFn: () => apiFetch("/api/social/requests"), staleTime: 30_000 });
  const { data: leaderboard = [], isError: leaderboardError, isLoading: leaderboardLoading } = useQuery({ queryKey: ["social-leaderboard", period], queryFn: () => apiFetch(`/api/social/leaderboard?period=${period}`), staleTime: 60_000 });
  const { data: activity = [], isError: activityError, isLoading: activityLoading } = useQuery({ queryKey: ["social-activity"], queryFn: () => apiFetch("/api/social/activity"), staleTime: 60_000, enabled: tab === "activity" });
  const { data: following = [] } = useQuery({ queryKey: ["social-following"], queryFn: () => apiFetch("/api/social/following"), staleTime: 60_000, enabled: tab === "following" });
  const { data: followers = [] } = useQuery({ queryKey: ["social-followers"], queryFn: () => apiFetch("/api/social/followers"), staleTime: 60_000, enabled: tab === "following" });
  const { data: feed = [], refetch: refetchFeed, isLoading: feedLoading, isError: feedError } = useQuery({ queryKey: ["feed", feedType], queryFn: () => apiFetch(`/api/feed?type=${feedType}`), staleTime: 30_000, enabled: tab === "feed" });

  const followUser = useMutation({
    mutationFn: (userId: string) => apiFetch(`/api/social/follow/${userId}`, { method: "POST" }),
    onSuccess: () => { toast("Now following!", "success"); qc.invalidateQueries({ queryKey: ["social-following"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });
  const unfollowUser = useMutation({
    mutationFn: (userId: string) => apiFetch(`/api/social/follow/${userId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["social-following"] }); },
  });
  const { data: searchResults = [] } = useQuery({ queryKey: ["social-search", searchQ], queryFn: () => apiFetch(`/api/social/search?q=${encodeURIComponent(searchQ)}`), enabled: searchQ.length >= 2, staleTime: 10_000 });

  const sendRequest = useMutation({
    mutationFn: (targetUsername: string) => apiFetch("/api/social/request", { method: "POST", body: JSON.stringify({ targetUsername }) }),
    onSuccess: () => { toast("Friend request sent!", "success"); qc.invalidateQueries({ queryKey: ["social-requests"] }); setAddQ(""); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const acceptRequest = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/social/request/${id}/accept`, { method: "PATCH" }),
    onSuccess: () => { toast("Friend added!", "success"); qc.invalidateQueries({ queryKey: ["social-friends"] }); qc.invalidateQueries({ queryKey: ["social-requests"] }); },
  });

  const rejectRequest = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/social/request/${id}/reject`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-requests"] }),
  });

  const cancelRequest = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/social/request/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-requests"] }),
  });

  const incoming = requests?.incoming ?? [];
  const outgoing = requests?.outgoing ?? [];
  const TABS: Array<{ id: "feed" | "friends" | "requests" | "leaderboard" | "activity" | "following"; label: string; icon: ElementType; count?: number }> = [
    { id: "feed", label: "Feed", icon: Newspaper },
    { id: "friends", label: "Friends", icon: Users, count: friends.length },
    { id: "requests", label: "Requests", icon: UserPlus, count: incoming.length || undefined },
    { id: "leaderboard", label: "Board", icon: Trophy },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "following", label: "Follow", icon: Rss, count: (followers as any[]).length || undefined },
  ];

  return (
    <div className="min-h-screen bg-[#0a0c12] text-[#e8eaf0] p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#e8eaf0]">Social Hub</h1>
        <p className="text-sm text-[#4a4f62] mt-1">Connect, compete, and grow together</p>
      </div>

      {/* Add friend */}
      <div className="rounded-2xl border border-[#1e2130] bg-[#111318] p-4 mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#4a4f62] mb-3">Add a Friend</p>
        <div className="flex gap-2">
          <input value={addQ} onChange={e => setAddQ(e.target.value)} placeholder="Enter username or email…" className="flex-1 rounded-xl border border-[#1e2130] bg-[#0a0c12] px-3 py-2 text-sm text-[#e8eaf0] placeholder-[#3a3d4a] outline-none focus:border-[#7C3AED] transition-colors" onKeyDown={e => e.key === "Enter" && addQ.trim() && sendRequest.mutate(addQ.trim())} />
          <button onClick={() => addQ.trim() && sendRequest.mutate(addQ.trim())} disabled={!addQ.trim() || sendRequest.isPending} className="rounded-xl bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#6d31d4] transition-colors">
            {sendRequest.isPending ? "…" : "Send"}
          </button>
        </div>
        {searchQ.length >= 2 && searchResults.length > 0 && (
          <div className="mt-2 space-y-1">
            {searchResults.map((u: any) => (
              <div key={u.id} className="flex items-center gap-2 rounded-lg bg-[#0a0c12] px-3 py-2">
                <Avatar name={u.name || u.email} size={28} />
                <span className="flex-1 text-sm text-[#e8eaf0]">{u.name || u.email}</span>
                <button onClick={() => sendRequest.mutate(u.email)} className="text-xs text-[#7C3AED] hover:text-[#a78bfa]">Add</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-[#111318] rounded-xl border border-[#1e2130] p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all ${tab === t.id ? "bg-[#7C3AED] text-white" : "text-[#5a5f72] hover:text-[#e8eaf0]"}`}>
            {(() => { const Icon = t.icon as React.FC<{ size?: number }>; return <Icon size={12} />; })()}
            <span className="hidden sm:inline">{t.label}</span>
            {t.count !== undefined && t.count > 0 && <span className="ml-0.5 rounded-full bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "feed" && (
        <div>
          <div className="flex gap-1 mb-4">
            {(["following", "discover", "saved"] as const).map(t => (
              <button key={t} onClick={() => setFeedType(t)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-all ${feedType === t ? "bg-[#7C3AED] text-white" : "bg-[#111318] text-[#5a5f72] hover:text-[#e8eaf0] border border-[#1e2130]"}`}>
                {t === "following" ? "📣 Following" : t === "discover" ? "🔍 Discover" : "🔖 Saved"}
              </button>
            ))}
          </div>
          <CreatePostBox currentUserId={currentUserId} onCreated={() => qc.invalidateQueries({ queryKey: ["feed"] })} />
          {feedLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#111318]" />)}</div>
          ) : feedError ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-4">⚠️</p>
              <p className="text-sm text-red-400 mb-3">Failed to load feed. Please try again.</p>
              <button onClick={() => refetchFeed()} className="rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6d31d4]">Retry</button>
            </div>
          ) : (feed as any[]).length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-4">📰</p>
              <p className="text-lg font-semibold text-[#e8eaf0] mb-2">{feedType === "saved" ? "No saved posts" : feedType === "following" ? "Your feed is empty" : "Nothing here yet"}</p>
              <p className="text-sm text-[#4a4f62] mb-4">{feedType === "following" ? "Follow people to see their posts here" : "Be the first to post!"}</p>
              {feedType === "following" && <button onClick={() => setFeedType("discover")} className="rounded-xl bg-[#7C3AED] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6d31d4]">Discover People</button>}
            </div>
          ) : (
            <div className="space-y-4">
              {(feed as any[]).map((p: any) => (
                <PostCard
                  key={p.id} post={p} currentUserId={currentUserId}
                  onReacted={() => qc.invalidateQueries({ queryKey: ["feed", feedType] })}
                  onSaved={() => qc.invalidateQueries({ queryKey: ["feed", feedType] })}
                  onDeleted={() => qc.invalidateQueries({ queryKey: ["feed", feedType] })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "friends" && (
        <div className="space-y-2">
          {friendsLoading && <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-[#111318]" />)}</div>}
          {friendsError && <p className="text-center py-6 text-sm text-red-400">Failed to load friends. Please refresh the page.</p>}
          {!friendsLoading && !friendsError && friends.length === 0 && <div className="text-center py-12 text-[#3a3d4a]"><Users size={40} className="mx-auto mb-3 opacity-30" /><p>No friends yet. Send a request above!</p></div>}
          {!friendsLoading && !friendsError && friends.map((f: any) => <FriendCard key={f.id} friend={f} />)}
        </div>
      )}

      {tab === "requests" && (
        <div className="space-y-4">
          {requestsError && <p className="text-center py-4 text-sm text-red-400">Failed to load requests. Please refresh the page.</p>}
          {incoming.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#4a4f62] mb-2">Incoming ({incoming.length})</p>
              <div className="space-y-2">
                {incoming.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl border border-[#1e2130] bg-[#111318] p-3">
                    <Avatar name={r.otherUser?.name || r.otherUser?.email || "U"} size={36} />
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-[#e8eaf0]">{r.otherUser?.name || r.otherUser?.email}</p><p className="text-xs text-[#4a4f62]">Wants to be your friend</p></div>
                    <button onClick={() => acceptRequest.mutate(r.id)} className="rounded-lg bg-emerald-500/20 text-emerald-400 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/30 flex items-center gap-1"><Check size={12} /> Accept</button>
                    <button onClick={() => rejectRequest.mutate(r.id)} className="rounded-lg bg-red-500/10 text-red-400 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/20 flex items-center gap-1"><X size={12} /> Decline</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {outgoing.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#4a4f62] mb-2">Sent</p>
              <div className="space-y-2">
                {outgoing.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl border border-[#1e2130] bg-[#111318] p-3">
                    <Avatar name={r.otherUser?.name || r.otherUser?.email || "U"} size={36} />
                    <div className="flex-1"><p className="text-sm font-medium text-[#e8eaf0]">{r.otherUser?.name || r.otherUser?.email}</p><p className="text-xs text-amber-400">Pending…</p></div>
                    <button onClick={() => cancelRequest.mutate(r.id)} className="text-xs text-[#4a4f62] hover:text-red-400">Cancel</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!incoming.length && !outgoing.length && <div className="text-center py-12 text-[#3a3d4a]"><Bell size={40} className="mx-auto mb-3 opacity-30" /><p>No pending friend requests</p></div>}
        </div>
      )}

      {tab === "leaderboard" && (
        <div>
          <div className="flex gap-1 mb-4">
            {(["daily", "weekly", "monthly", "alltime"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-all ${period === p ? "bg-[#7C3AED] text-white" : "bg-[#111318] text-[#5a5f72] hover:text-[#e8eaf0]"}`}>{p === "alltime" ? "All Time" : p}</button>
            ))}
          </div>
          {leaderboardLoading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-[#111318]" />)}</div>
          ) : leaderboardError ? (
            <p className="text-center py-8 text-sm text-red-400">Failed to load leaderboard. Please refresh.</p>
          ) : (
            <LeaderboardTable data={leaderboard} />
          )}
        </div>
      )}

      {tab === "following" && (
        <div className="space-y-4">
          {followers.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#4a4f62] mb-2">Followers ({followers.length})</p>
              <div className="space-y-2">
                {(followers as any[]).map((f: any) => (
                  <div key={f.id} className="flex items-center gap-3 rounded-xl border border-[#1e2130] bg-[#111318] p-3">
                    <Avatar name={f.name} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#e8eaf0]">{f.name}</p>
                      <p className="text-xs text-[#4a4f62]">Level {f.level} · {f.xp?.toLocaleString()} XP</p>
                    </div>
                    <button
                      onClick={() => followUser.mutate(f.id)}
                      className="rounded-lg border border-[#7C3AED]/50 text-[#a78bfa] px-3 py-1.5 text-xs font-semibold hover:bg-[#7C3AED]/10"
                    >
                      Follow Back
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#4a4f62] mb-2">Following ({(following as any[]).length})</p>
            {(following as any[]).length === 0 && <div className="text-center py-8 text-[#3a3d4a]"><Rss size={36} className="mx-auto mb-3 opacity-30" /><p>Not following anyone yet</p><p className="text-xs mt-1">Visit a user's profile to follow them</p></div>}
            <div className="space-y-2">
              {(following as any[]).map((f: any) => (
                <div key={f.id} className="flex items-center gap-3 rounded-xl border border-[#1e2130] bg-[#111318] p-3">
                  <Avatar name={f.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#e8eaf0]">{f.name}</p>
                    <p className="text-xs text-[#4a4f62]">Level {f.level} · 🔥 {f.streak}</p>
                  </div>
                  <button
                    onClick={() => unfollowUser.mutate(f.id)}
                    disabled={unfollowUser.isPending}
                    className="rounded-lg border border-[#1e2130] text-[#4a4f62] px-3 py-1.5 text-xs hover:border-red-900/50 hover:text-red-400 transition-colors"
                  >
                    Unfollow
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className="space-y-2">
          {activityLoading && <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-[#111318]" />)}</div>}
          {activityError && <p className="text-center py-6 text-sm text-red-400">Failed to load activity. Please refresh.</p>}
          {!activityLoading && !activityError && activity.length === 0 && (
            <div className="text-center py-12 text-[#3a3d4a]">
              <Activity size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No recent activity from friends</p>
              <p className="text-xs mt-1 text-[#2a2d3a]">Add friends to see their focus sessions, badges and posts here</p>
            </div>
          )}
          {activity.map((a: any) => {
            const icon = a.type === "session_complete" ? "🎯" : a.type === "badge_unlocked" ? "🏅" : a.type === "mission_claimed" ? "✅" : a.type === "post_created" ? "📝" : "⚡";
            let description = "";
            if (a.type === "session_complete") {
              description = `Completed a ${a.data?.durationMin ?? 0}min focus session${a.data?.focusScore ? ` · ${a.data.focusScore.toFixed(0)}% focus` : ""}${a.data?.category && a.data.category !== "General" ? ` · ${a.data.category}` : ""}`;
            } else if (a.type === "badge_unlocked") {
              description = `Unlocked the "${a.data?.badgeId?.replace(/_/g, " ")}" badge`;
            } else if (a.type === "mission_claimed") {
              description = `Completed mission: ${a.data?.missionKey?.replace(/_/g, " ")}`;
            } else if (a.type === "post_created") {
              description = a.data?.content ?? "Shared a post";
            }
            const ts = a.timestamp ? new Date(a.timestamp) : null;
            const timeLabel = ts ? (Date.now() - ts.getTime() < 3600000 ? `${Math.round((Date.now() - ts.getTime()) / 60000)}m ago` : ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) : "";
            return (
              <div key={a.id} className="flex items-start gap-3 rounded-xl border border-[#1e2130] bg-[#111318] p-3 hover:border-[#2a2d40] transition-colors">
                <span className="text-xl mt-0.5">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-[#e8eaf0]">{a.isMe ? "You" : a.userName}</p>
                    {a.userLevel && <span className="text-[10px] rounded-full bg-[#6c63ff]/15 text-[#a5a8ff] px-1.5 py-0.5">Lv {a.userLevel}</span>}
                  </div>
                  <p className="text-xs text-[#5a5f72] mt-0.5 truncate">{description}</p>
                </div>
                <span className="text-[10px] text-[#3a3d4a] shrink-0 flex items-center gap-1 mt-0.5"><Clock size={10} />{timeLabel}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
