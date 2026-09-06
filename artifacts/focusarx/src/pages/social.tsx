import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Users, UserPlus, Trophy, Activity, Check, Bell, Rss, MessageCircle as MessageCircleIcon, Plus, Send, Image, Trash2, ArrowUpRight, Star as StarIcon, Shield } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { DropBanner } from "@/components/DropBanner";
import { motion, AnimatePresence } from "framer-motion";
import { BLUR_IN, STAGGER, STAGGER_CHILD } from "@/lib/animations";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function Avatar({ name, size = 36, level }: { name: string; size?: number, level?: number }) {
  const initials = (name || "U").slice(0, 2).toUpperCase();
  const colors = ["from-[var(--palette-violet-500)] to-[var(--palette-indigo-600)]", "from-[var(--palette-emerald-500)] to-[var(--palette-teal-600)]", "from-[var(--palette-amber-500)] to-[var(--palette-orange-600)]", "from-[var(--palette-rose-500)] to-[var(--palette-pink-600)]", "from-[var(--palette-blue-500)] to-[var(--palette-cyan-600)]"];
  const color = colors[initials.charCodeAt(0) % colors.length];
  return (
    <div className="relative shrink-0">
      <div style={{ width: size, height: size, fontSize: size * 0.35 }} className={`rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-[var(--palette-white)] font-bold border-2 border-[var(--background)] shadow-lg`}>
        {initials}
      </div>
      {level && (
        <div className="absolute -bottom-1 -right-1 bg-[var(--background)] rounded-full border border-[var(--palette-white)]/10 px-1 py-0.5">
           <span className="text-[7px] font-semibold text-[var(--brand-400)] leading-none">{level}</span>
        </div>
      )}
    </div>
  );
}

function IdentityBadges({ isAdmin, className = "" }: { isAdmin?: boolean; className?: string }) {
  if (!isAdmin) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      <span className="inline-flex items-center gap-0.5 rounded-full border border-[var(--palette-red-500)]/30 bg-[var(--palette-red-500)]/10 px-1.5 py-px text-[7px] font-semibold uppercase tracking-widest text-[var(--palette-red-400)]" title="FocusArx admin">
          <Shield size={7} /> Admin
        </span>
    </span>
  );
}

function FriendCard({ friend }: { friend: any }) {
  const focusMinutes = friend.isStudying && friend.studyStartedAt
    ? Math.floor((Date.now() - new Date(friend.studyStartedAt).getTime()) / 60000)
    : (friend.studyingFor ?? 0);

  return (
    <motion.div variants={STAGGER_CHILD} className={`flex items-center gap-3 rounded-2xl border p-4 transition-all glass ${friend.isStudying ? "border-[var(--palette-emerald-500)]/20 bg-[var(--palette-emerald-500)]/5" : "border-[var(--border)] bg-[var(--palette-white)]/[0.01] hover:bg-[var(--palette-white)]/[0.03]"}`}>
      <div className="relative shrink-0">
        <Avatar name={friend.name} level={friend.level} />
        {friend.isStudying && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[var(--palette-emerald-400)] border-2 border-[var(--background)] animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold text-[var(--palette-white)] truncate">{friend.name}</p>
          {friend.isStudying && (
            <span className="shrink-0 rounded-full bg-[var(--palette-emerald-500)]/10 border border-[var(--palette-emerald-500)]/20 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--palette-emerald-400)] uppercase tracking-widest">
              Active Flow
            </span>
          )}
        </div>
        {friend.isStudying ? (
          <p className="text-[11px] text-[var(--palette-emerald-400)]/80 font-bold uppercase tracking-widest flex items-center gap-1">
             {focusMinutes > 0 ? `${focusMinutes}m In deep work` : "Initializing..."}
          </p>
        ) : (
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)]">LV.{friend.level} · {friend.xp.toLocaleString()} XP</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-[var(--palette-amber-400)] flex items-center gap-1 justify-end">🔥 {friend.streak}</p>
      </div>
    </motion.div>
  );
}

function LeaderboardTable({ data }: { data: any[] }) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="space-y-2">
      {data.map((e, i) => (
        <motion.div
           key={e.userId}
           variants={STAGGER_CHILD}
           className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${e.isMe ? "border-[var(--brand-600)]/30 bg-[var(--brand-600)]/10" : "border-[var(--border)] bg-[var(--palette-white)]/[0.01]"}`}
        >
          <span className={`w-6 text-center text-sm font-semibold ${i < 3 ? "text-xl" : "text-[var(--foreground-subtle)]"}`}>{i < 3 ? medals[i] : `${i + 1}`}</span>
          <Avatar name={e.name} size={32} level={e.level} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[var(--palette-white)] truncate flex items-center gap-1.5">
              {e.name}
              <IdentityBadges isAdmin={e.isAdmin} />
              {e.isMe && <span className="text-[var(--brand-400)]">(You)</span>}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)]">LV.{e.level} · {e.streak}d STREAK</p>
          </div>
          <div className="text-right">
             <p className="text-sm font-semibold text-[var(--brand-400)] tabular-nums">{e.xp.toLocaleString()}</p>
             <p className="text-[11px] font-semibold text-[var(--foreground-subtle)] uppercase tracking-widest">Points</p>
          </div>
        </motion.div>
      ))}
      {!data.length && <p className="text-center text-xs font-bold text-[var(--foreground-subtle)] py-12 uppercase tracking-[0.2em]">Add friends to sync board</p>}
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
    <motion.div variants={STAGGER_CHILD} className="rounded-[32px] border border-[var(--border)] bg-[var(--palette-white)]/[0.01] overflow-hidden hover:border-[var(--brand-600)]/20 transition-all glass-heavy group">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
             <Avatar name={post.author?.name || "U"} size={44} level={post.author?.level} />
             <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="font-bold text-[var(--palette-white)] leading-none">{post.author?.name || "User"}</p>
                  <IdentityBadges isAdmin={post.author?.isAdmin} />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)]">{post.createdAt ? timeAgo(post.createdAt) : ""}</p>
             </div>
          </div>
          {post.userId === currentUserId && (
              <button onClick={() => { if (confirm("Delete this post?")) del.mutate(); }}
                className="opacity-0 group-hover:opacity-100 rounded-xl p-2 text-[var(--foreground-subtle)] hover:text-[var(--palette-red-400)] hover:bg-[var(--palette-red-900)]/20 transition-all">
                <Trash2 size={16} />
              </button>
          )}
        </div>

        <p className="text-[15px] text-[var(--palette-zinc-200)] leading-relaxed whitespace-pre-wrap">{post.content}</p>

        {post.type === "achievement" && post.metadata && (
          <div className="mt-4 rounded-2xl bg-[var(--palette-amber-500)]/5 border border-[var(--palette-amber-500)]/10 p-4 flex items-center gap-4 group/medal">
            <div className="h-12 w-12 rounded-xl bg-[var(--palette-amber-500)]/10 flex items-center justify-center text-3xl group-hover/medal:scale-110 transition-transform">{post.metadata.icon || "🏆"}</div>
            <div>
               <p className="text-xs font-semibold uppercase tracking-widest text-[var(--palette-amber-400)]">{post.metadata.title || "Achievement"}</p>
               <p className="text-xs text-[var(--palette-amber-200)]/60 leading-tight mt-0.5">{post.metadata.description}</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 flex items-center gap-4 border-t border-[var(--border)] bg-[var(--palette-white)]/[0.01]">
          <div className="relative">
            <button
              onMouseEnter={() => setShowReactions(true)}
              onMouseLeave={() => setShowReactions(false)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-semibold uppercase tracking-widest transition-all ${post.myReaction ? "bg-[var(--brand-600)]/20 text-[var(--brand-400)]" : "bg-[var(--palette-white)]/5 text-[var(--foreground-subtle)] hover:text-[var(--palette-white)]"}`}
            >
              <span>{dominantReaction?.emoji || "🔥"}</span>
              <span>{totalReactions > 0 ? totalReactions : ""}</span>
              {!post.myReaction && <span>React</span>}
            </button>
            <AnimatePresence>
              {showReactions && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  onMouseEnter={() => setShowReactions(true)}
                  onMouseLeave={() => setShowReactions(false)}
                  className="absolute bottom-full left-0 mb-2 z-[var(--z-sticky)] flex gap-2 glass p-2 rounded-2xl shadow-2xl"
                >
                  {REACTIONS.map(r => (
                    <button key={r.key} onClick={() => react.mutate(r.key)} title={r.label}
                      className={`text-xl hover:scale-125 transition-transform rounded-xl p-1.5 ${post.myReaction === r.key ? "bg-[var(--brand-600)]/30" : "hover:bg-[var(--palette-white)]/10"}`}>
                      {r.emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-semibold uppercase tracking-widest transition-all ${showComments ? "bg-[var(--palette-white)]/10 text-[var(--palette-white)]" : "text-[var(--foreground-subtle)] hover:text-[var(--palette-white)]"}`}>
            <MessageCircleIcon size={14} /> <span>{post.commentCount || ""}</span>
          </button>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-[var(--palette-white)]/[0.01] border-t border-[var(--border)]">
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <input value={commentText} onChange={e => setCommentText(e.target.value)}
                  placeholder="Share a word of encouragement..."
                  className="flex-1 bg-[var(--muted)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm text-[var(--palette-white)] focus:border-[var(--brand-600)] outline-none transition-all" />
                <button disabled={!commentText.trim() || addComment.isPending}
                  onClick={() => addComment.mutate()}
                  className="bg-[var(--brand-600)] text-[var(--palette-white)] p-2 rounded-xl hover:scale-105 active:scale-95 transition-all">
                  <Send size={16} />
                </button>
              </div>
              <div className="space-y-4 max-h-64 overflow-y-auto pr-2 scrollbar-none">
                {comments.map((c: any) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar name={c.author?.name || c.authorName || "U"} size={28} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-bold text-[var(--palette-white)]">{c.author?.name || c.authorName || "User"}</p>
                        <IdentityBadges isAdmin={c.author?.isAdmin ?? (c as any).isAdmin} />
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)]">{timeAgo(c.createdAt)}</p>
                      </div>
                      <p className="text-xs text-[var(--palette-zinc-400)] leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function SocialPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: session } = useAuth();
  const [tab, setTab] = useState<"feed" | "friends" | "requests" | "leaderboard" | "following" | "activity">("feed");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "alltime">("weekly");
  const [search, setSearch] = useState("");
  const [newPost, setNewPost] = useState("");

  const { data: feedData, isLoading: postsLoading, refetch: refetchPosts } = useQuery({
    queryKey: ["posts", tab],
    queryFn: () => apiFetch(tab === "feed" ? "/api/feed?type=discover&limit=30" : "/api/feed?type=following&limit=30"),
    enabled: tab === "feed",
    staleTime: 60_000,
  });
  // The discover feed returns { posts, nextCursor } (cursor pagination with a
  // 60/40 human/bot mix); "following" still returns a plain array.
  const posts = Array.isArray(feedData) ? feedData : (feedData?.posts ?? []);

  const createPost = useMutation({
    mutationFn: () => apiFetch("/api/posts", { method: "POST", body: JSON.stringify({ content: newPost, type: "status" }) }),
    onSuccess: () => { setNewPost(""); toast("Post shared!", "success"); refetchPosts(); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["user-search", search],
    queryFn: () => apiFetch(`/api/social/search?q=${encodeURIComponent(search)}`),
    enabled: search.length > 2,
  });

  const { data: friends = [], isLoading: friendsLoading, error: friendsError } = useQuery({
    queryKey: ["friends"], queryFn: () => apiFetch("/api/social/friends"),
    enabled: tab === "friends" || tab === "feed",
  });

  const { data: requests = { incoming: [], outgoing: [] } } = useQuery({
    queryKey: ["friend-requests"], queryFn: () => apiFetch("/api/social/requests"),
    enabled: tab === "requests",
  });

  const { data: leaderboard = [], isLoading: leaderboardLoading, error: leaderboardError } = useQuery({
    queryKey: ["social-leaderboard", period], queryFn: () => apiFetch(`/api/social/leaderboard?period=${period === "alltime" ? "total" : period}&scope=global`),
    enabled: tab === "leaderboard",
  });

  const { data: activity = [], isLoading: activityLoading, error: activityError } = useQuery({
    queryKey: ["friends-activity"], queryFn: () => apiFetch("/api/social/activity"),
    enabled: tab === "activity",
  });

  const { data: followingData = { following: [], followers: [] } } = useQuery({
    queryKey: ["following-data"], queryFn: () => apiFetch("/api/social/following"),
    enabled: tab === "following",
  });

  const sendRequest = useMutation({
    mutationFn: (userId: string) => apiFetch("/api/social/requests", { method: "POST", body: JSON.stringify({ toUserId: userId }) }),
    onSuccess: () => { toast("Friend request sent", "success"); setSearch(""); qc.invalidateQueries({ queryKey: ["friend-requests"] }); },
  });

  const followUser = useMutation({
    mutationFn: (userId: string) => apiFetch(`/api/social/follow/${userId}`, { method: "POST" }),
    onSuccess: () => { toast("Following user", "success"); qc.invalidateQueries({ queryKey: ["following-data"] }); },
  });

  const unfollowUser = useMutation({
    mutationFn: (userId: string) => apiFetch(`/api/social/follow/${userId}`, { method: "DELETE" }),
    onSuccess: () => { toast("Unfollowed user", "info"); qc.invalidateQueries({ queryKey: ["following-data"] }); },
  });

  const acceptRequest = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/social/requests/${id}/accept`, { method: "POST" }),
    onSuccess: () => { toast("Request accepted", "success"); qc.invalidateQueries({ queryKey: ["friend-requests"] }); qc.invalidateQueries({ queryKey: ["friends"] }); },
  });

  const rejectRequest = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/social/requests/${id}/reject`, { method: "POST" }),
    onSuccess: () => { toast("Request declined", "info"); qc.invalidateQueries({ queryKey: ["friend-requests"] }); },
  });

  const cancelRequest = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/social/requests/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast("Request cancelled", "info"); qc.invalidateQueries({ queryKey: ["friend-requests"] }); },
  });

  const incoming = requests.incoming || [];
  const outgoing = requests.outgoing || [];
  const followers = followingData.followers || [];
  const following = followingData.following || [];

  return (
    <PageTransition>
      <div className="min-h-screen forge-bg-glow text-[var(--foreground)] px-6 py-12 max-w-4xl mx-auto">
        <header className="mb-12 flex flex-col items-center text-center">
            <motion.div variants={BLUR_IN} initial="initial" animate="animate">
               <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-teal)]/10 mb-6">
                  <Users className="text-[var(--brand-teal)]" />
               </div>
               <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--foreground-subtle)] mb-4">Community Hub</p>
               <h1 className="text-4xl font-semibold text-[var(--palette-white)] sm:text-6xl tracking-tight leading-none mb-4">The <span className="text-[var(--brand-teal)]">Social Flow</span></h1>
               <p className="text-[var(--foreground-muted)] leading-relaxed max-w-xl mx-auto">Connect with global deep-workers. Share milestones, compete on boards, and study in sync.</p>
            </motion.div>
        </header>

        <div className="relative mb-12">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[var(--palette-zinc-500)]"><UserPlus size={18} /></div>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search learners by name or email..."
            className="w-full bg-[var(--muted)] border border-[var(--border)] rounded-3xl py-5 pl-12 pr-6 text-sm text-[var(--palette-white)] focus:border-[var(--brand-teal)] outline-none transition-all shadow-2xl"
          />
          <AnimatePresence>
            {search.length > 2 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                className="absolute top-full inset-x-0 mt-2 z-[var(--z-float)] glass-heavy rounded-3xl overflow-hidden shadow-2xl p-2 border border-[var(--border)]">
                {searchResults.length === 0 ? (
                  <p className="text-center py-6 text-xs font-semibold uppercase text-[var(--foreground-subtle)] tracking-widest">No users found</p>
                ) : (
                  searchResults.map((u: any) => (
                    <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-[var(--palette-white)]/5 transition-all">
                      <Avatar name={u.name} level={u.level} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--palette-white)] truncate flex items-center gap-1.5">{u.name}<IdentityBadges isAdmin={u.isAdmin} /></p>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground-subtle)]">
                          {u.level != null ? `LV.${u.level} · ${u.streak ?? 0}d Streak` : "Member"}
                        </p>
                      </div>
                      <button onClick={() => sendRequest.mutate(u.id)}
                        className="rounded-xl bg-[var(--palette-white)] text-[var(--palette-black)] px-4 py-2 text-xs font-semibold hover:bg-[var(--palette-zinc-200)] transition-all flex items-center gap-2">
                         <Plus size={14} /> Connect
                      </button>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap rounded-[24px] border border-[var(--border)] bg-[var(--palette-white)]/[0.01] p-1.5 mb-12 gap-1">
          {[
            { id: "feed", label: "Public Feed", icon: <Rss size={14} /> },
            { id: "friends", label: "Protocol Mates", icon: <Users size={14} /> },
            { id: "leaderboard", label: "World Board", icon: <Trophy size={14} /> },
            { id: "activity", label: "Live Pulse", icon: <Activity size={14} /> },
            { id: "following", label: "Network", icon: <Check size={14} /> },
            { id: "requests", label: "Connects", icon: <Bell size={14} />, badge: incoming.length },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex-1 min-w-fit flex items-center justify-center gap-2 rounded-2xl py-3 px-4 text-[11px] font-semibold uppercase tracking-widest transition-all ${tab === t.id ? "bg-[var(--brand-teal)] text-[var(--palette-black)] shadow-lg shadow-[var(--brand-teal)]/20" : "text-[var(--foreground-subtle)] hover:bg-[var(--palette-white)]/5 hover:text-[var(--palette-white)]"}`}>
              {t.icon} {t.label}
              {t.badge > 0 && <span className="rounded-full bg-[var(--palette-red-500)] text-[var(--palette-white)] w-4 h-4 flex items-center justify-center text-[11px] animate-bounce">{t.badge}</span>}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === "feed" && (
            <motion.div key="feed" variants={STAGGER} initial="initial" animate="animate" exit="exit" className="space-y-6">
               <DropBanner />
               <div className="rounded-[32px] border border-[var(--border)] bg-[var(--palette-white)]/[0.01] p-6 glass-heavy">
                  <div className="flex gap-4">
                     <Avatar name={session?.user?.name || "U"} size={44} level={12} />
                     <div className="flex-1 space-y-4">
                        <textarea
                          value={newPost} onChange={e => setNewPost(e.target.value)}
                          placeholder="What did you learn in your last flow session?"
                          className="w-full bg-transparent border-none text-[var(--palette-white)] placeholder-[var(--foreground-subtle)] text-lg font-medium outline-none resize-none min-h-[100px]"
                        />
                        <div className="flex justify-between items-center pt-4 border-t border-[var(--border)]">
                           <div className="flex gap-2">
                              <button className="p-2 rounded-xl hover:bg-[var(--palette-white)]/5 text-[var(--foreground-subtle)] transition-colors"><Image size={20} /></button>
                              <button className="p-2 rounded-xl hover:bg-[var(--palette-white)]/5 text-[var(--foreground-subtle)] transition-colors"><StarIcon size={20} /></button>
                           </div>
                           <button
                             disabled={!newPost.trim() || createPost.isPending}
                             onClick={() => createPost.mutate()}
                             className="rounded-2xl bg-[var(--palette-white)] text-[var(--palette-black)] px-8 py-3 text-sm font-semibold hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                           >
                             Share Protocol
                           </button>
                        </div>
                     </div>
                  </div>
               </div>

               {postsLoading ? (
                 <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-48 animate-pulse rounded-[32px] bg-[var(--palette-white)]/[0.01] border border-[var(--border)]" />)}</div>
               ) : (
                 posts.map((p: any) => <PostCard key={p.id} post={p} currentUserId={session?.user?.id || ""} onReacted={() => {}} onSaved={() => {}} onDeleted={() => refetchPosts()} />)
               )}
            </motion.div>
          )}

          {tab === "friends" && (
            <motion.div key="friends" variants={STAGGER} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2">
               {friendsLoading ? <div className="col-span-full py-20 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-teal)] border-t-transparent" /></div> : friends.map((f: any) => <FriendCard key={f.id} friend={f} />)}
               {!friendsLoading && friends.length === 0 && <div className="col-span-full py-32 text-center opacity-30"><Users size={48} className="mx-auto mb-6" /><p className="text-sm font-semibold uppercase tracking-widest">No Protocol Mates Found</p></div>}
            </motion.div>
          )}

          {tab === "leaderboard" && (
            <motion.div key="leaderboard" variants={STAGGER} initial="initial" animate="animate">
               <div className="flex gap-2 mb-8 bg-[var(--palette-white)]/[0.01] border border-[var(--border)] p-1 rounded-2xl">
                  {(["daily", "weekly", "monthly", "alltime"] as const).map(p => (
                    <button key={p} onClick={() => setPeriod(p)} className={`flex-1 rounded-xl py-3 text-[11px] font-semibold uppercase tracking-widest transition-all ${period === p ? "bg-[var(--palette-white)]/10 text-[var(--palette-white)] shadow-xl" : "text-[var(--foreground-subtle)] hover:text-[var(--palette-zinc-300)]"}`}>{p === "alltime" ? "Infinity" : p}</button>
                  ))}
               </div>
               <LeaderboardTable data={leaderboard} />
            </motion.div>
          )}

          {tab === "activity" && (
            <motion.div key="activity" variants={STAGGER} initial="initial" animate="animate" className="space-y-4">
               {activity.map((a: any) => (
                  <motion.div variants={STAGGER_CHILD} key={a.id} className="rounded-2xl border border-[var(--border)] bg-[var(--palette-white)]/[0.01] p-5 flex items-center justify-between glass group">
                     <div className="flex items-center gap-4">
                        <div className="text-2xl h-12 w-12 rounded-xl bg-[var(--palette-white)]/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                           {a.type === "session_complete" ? "🎯" : a.type === "badge_unlocked" ? "🏅" : "⚡"}
                        </div>
                        <div>
                           <p className="text-sm font-bold text-[var(--palette-white)] mb-0.5 flex items-center gap-1.5">
                              {a.userName}
                              <IdentityBadges isAdmin={a.isAdmin} />
                              <span className="text-[11px] font-semibold text-[var(--brand-teal)] ml-1">LV.{a.userLevel}</span>
                            </p>
                           <p className="text-xs text-[var(--foreground-subtle)] font-medium leading-tight">
                              {a.type === "session_complete" ? `Completed ${a.data?.durationMin}m Session` : a.type === "badge_unlocked" ? `Earned ${a.data?.badgeId} Badge` : "Updated Protocol"}
                           </p>
                        </div>
                     </div>
                     <ArrowUpRight size={14} className="text-[var(--foreground-subtle)] group-hover:text-[var(--palette-white)] transition-colors" />
                  </motion.div>
               ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
