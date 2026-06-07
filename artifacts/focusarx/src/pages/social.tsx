import { useState } from "react";
import type { ElementType } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Users, UserPlus, Trophy, Activity, Search, Check, X, Bell, Clock, Rss } from "lucide-react";

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
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#1e2130] bg-[#111318] p-3 hover:border-[#7C3AED]/40 transition-colors">
      <Avatar name={friend.name} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#e8eaf0] truncate">{friend.name}</p>
        <p className="text-xs text-[#4a4f62]">Level {friend.level} · {friend.xp.toLocaleString()} XP</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-bold text-amber-400">🔥 {friend.streak}</p>
        {friend.sessionsToday > 0 && <p className="text-[10px] text-emerald-400">{friend.sessionsToday} today</p>}
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

export default function SocialPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"friends" | "requests" | "leaderboard" | "activity" | "following">("friends");
  const [searchQ, setSearchQ] = useState("");
  const [addQ, setAddQ] = useState("");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "alltime">("weekly");

  const { data: friends = [] } = useQuery({ queryKey: ["social-friends"], queryFn: () => apiFetch("/api/social/friends"), staleTime: 30_000 });
  const { data: requests } = useQuery({ queryKey: ["social-requests"], queryFn: () => apiFetch("/api/social/requests"), staleTime: 30_000 });
  const { data: leaderboard = [] } = useQuery({ queryKey: ["social-leaderboard", period], queryFn: () => apiFetch(`/api/social/leaderboard?period=${period}`), staleTime: 60_000 });
  const { data: activity = [] } = useQuery({ queryKey: ["social-activity"], queryFn: () => apiFetch("/api/social/activity"), staleTime: 60_000, enabled: tab === "activity" });
  const { data: following = [] } = useQuery({ queryKey: ["social-following"], queryFn: () => apiFetch("/api/social/following"), staleTime: 60_000, enabled: tab === "following" });
  const { data: followers = [] } = useQuery({ queryKey: ["social-followers"], queryFn: () => apiFetch("/api/social/followers"), staleTime: 60_000, enabled: tab === "following" });

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
  const TABS: Array<{ id: "friends" | "requests" | "leaderboard" | "activity" | "following"; label: string; icon: ElementType; count?: number }> = [
    { id: "friends", label: "Friends", icon: Users, count: friends.length },
    { id: "requests", label: "Requests", icon: UserPlus, count: incoming.length || undefined },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy },
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
            <t.icon size={12} />
            <span className="hidden sm:inline">{t.label}</span>
            {t.count !== undefined && t.count > 0 && <span className="ml-0.5 rounded-full bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "friends" && (
        <div className="space-y-2">
          {friends.length === 0 && <div className="text-center py-12 text-[#3a3d4a]"><Users size={40} className="mx-auto mb-3 opacity-30" /><p>No friends yet. Send a request above!</p></div>}
          {friends.map((f: any) => <FriendCard key={f.id} friend={f} />)}
        </div>
      )}

      {tab === "requests" && (
        <div className="space-y-4">
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
          <LeaderboardTable data={leaderboard} />
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
          {activity.length === 0 && <div className="text-center py-12 text-[#3a3d4a]"><Activity size={40} className="mx-auto mb-3 opacity-30" /><p>No recent activity from friends</p></div>}
          {activity.map((a: any) => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl border border-[#1e2130] bg-[#111318] p-3">
              <span className="text-xl">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#e8eaf0]">{a.userName}</p>
                <p className="text-xs text-[#5a5f72]">{a.description}</p>
              </div>
              <span className="text-[10px] text-[#3a3d4a] shrink-0 flex items-center gap-1"><Clock size={10} />{a.timestamp ? new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
