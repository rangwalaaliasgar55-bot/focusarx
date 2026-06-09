import React from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Trophy, Flame, Clock, CheckSquare, Star, Users, Zap, Crown, ArrowLeft, UserPlus } from "lucide-react";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function StatBubble({ icon: Icon, label, value, color = "#7C3AED" }: { icon: React.ComponentType<any>; label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-[#1e2130] bg-[#111318] p-4 gap-1">
      <Icon size={16} style={{ color }} />
      <p className="text-xl font-black text-[#e8eaf0]">{value}</p>
      <p className="text-[10px] text-[#4a4f62] uppercase tracking-wider text-center">{label}</p>
    </div>
  );
}

const BADGE_EMOJI: Record<string, string> = {
  early_bird: "🌅", night_owl: "🦉", streak_3: "🔥", streak_7: "🏅", sessions_10: "⚡", sessions_50: "💪",
  focus_master: "🧠", golden_focus: "✨", elite_focus: "👑", task_warrior: "⚔️", centurion: "🎖️",
};

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { data: session, status } = useAuth();

  React.useEffect(() => {
    if (username) {
      document.title = `${username} — FocusArx Profile`;
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", `View ${username}'s public study profile on FocusArx — stats, badges, streak, and more.`);
    }
  }, [username]);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => apiFetch(`/api/u/${encodeURIComponent(username!)}`),
    enabled: !!username,
    staleTime: 120_000,
  });

  const sendRequest = useMutation({
    mutationFn: () => apiFetch(`/api/u/${username}/friend`, { method: "POST" }),
    onSuccess: () => toast("Friend request sent!", "success"),
    onError: (e: any) => toast(e.message, "error"),
  });

  const levelXpRequired = (level: number) => Math.round(100 * Math.pow(level, 1.5));
  const level = profile?.level ?? 1;
  const xp = profile?.xp ?? 0;
  const isOwnProfile = session?.user && profile?.id === session.user.id;

  if (isLoading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#1e2130] border-t-[#7C3AED]" />
    </div>
  );

  if (error || !profile) return (
    <div className="min-h-screen bg-[#0a0c12] flex flex-col items-center justify-center text-center p-6">
      <p className="text-6xl mb-4">👤</p>
      <h1 className="text-2xl font-bold text-[#e8eaf0] mb-2">Profile not found</h1>
      <p className="text-[#4a4f62] mb-6">No user with the username "{username}" exists.</p>
      <Link href="/" className="rounded-xl bg-[#7C3AED] px-5 py-2.5 text-sm font-semibold text-white">Go Home</Link>
    </div>
  );

  const initials = (profile.name || "U").slice(0, 2).toUpperCase();
  const colors = ["from-violet-500 to-indigo-600", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600"];
  const color = colors[initials.charCodeAt(0) % colors.length];

  return (
    <div className="min-h-screen bg-[#0a0c12] text-[#e8eaf0]">
      {/* Hero banner */}
      <div className="relative h-28 sm:h-36 bg-gradient-to-br from-[#7C3AED]/30 to-[#4F46E5]/20 border-b border-[#1e2130]">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_30%_50%,_#7C3AED,_transparent_70%)]" />
        <Link href="/" className="absolute top-4 left-4 flex items-center gap-1.5 text-xs text-[#5a5f72] hover:text-[#e8eaf0] transition-colors">
          <ArrowLeft size={13} /> Back
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Avatar */}
        <div className="flex items-end justify-between -mt-12 mb-4">
          <div className={`h-24 w-24 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-3xl font-black text-white border-4 border-[#0a0c12] shadow-xl`}>
            {initials}
          </div>
          {!isOwnProfile && status === "authenticated" && (
            <button onClick={() => sendRequest.mutate()} disabled={sendRequest.isPending || sendRequest.isSuccess} className="flex items-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#6d31d4] transition-colors">
              <UserPlus size={14} /> {sendRequest.isSuccess ? "Request sent!" : sendRequest.isPending ? "…" : "Add Friend"}
            </button>
          )}
        </div>

        {/* Name + bio */}
        <div className="mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-black text-[#e8eaf0]">{profile.name}</h1>
            {profile.prestige > 0 && <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400 font-bold"><Crown size={10} /> Prestige {profile.prestige}</span>}
          </div>
          {profile.bio && <p className="text-sm text-[#5a5f72] mt-1.5 leading-relaxed">{profile.bio}</p>}
          <div className="flex items-center gap-3 mt-2 text-xs text-[#4a4f62]">
            <span className="flex items-center gap-1"><Users size={11} /> {profile.friendCount} friends</span>
            <span>·</span>
            <span>Joined {new Date(profile.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
            {profile.timezone && <><span>·</span><span>🕐 {profile.timezone}</span></>}
          </div>
        </div>

        {/* Level bar */}
        <div className="rounded-2xl border border-[#7C3AED]/30 bg-[#111318] p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><Zap size={15} className="text-[#7C3AED]" /><span className="text-sm font-bold text-[#e8eaf0]">Level {level}</span>{profile.prestige > 0 && <span className="text-[10px] font-bold text-amber-400">✦ P{profile.prestige}</span>}</div>
            <span className="text-xs text-[#4a4f62]">{xp.toLocaleString()} XP</span>
          </div>
          <div className="h-2 rounded-full bg-[#1e2130] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#a78bfa] transition-all" style={{ width: `${Math.min(100, (xp / levelXpRequired(level)) * 100)}%` }} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <StatBubble icon={Flame} label="Streak" value={`${profile.streak}d`} color="#f97316" />
          <StatBubble icon={Clock} label="Focus Hours" value={profile.totalFocusHours} color="#f59e0b" />
          <StatBubble icon={CheckSquare} label="Tasks Done" value={profile.tasksCompleted} color="#22d387" />
          <StatBubble icon={Trophy} label="Sessions" value={profile.totalSessions} color="#60a5fa" />
          <StatBubble icon={Flame} label="Best Streak" value={`${profile.longestStreak}d`} color="#ef4444" />
          <StatBubble icon={Star} label="Badges" value={profile.badgeCount} color="#a78bfa" />
        </div>

        {/* Recent badges */}
        {profile.recentBadges?.length > 0 && (
          <div className="rounded-2xl border border-[#1e2130] bg-[#111318] p-4 mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#4a4f62] mb-3">Recent Badges</p>
            <div className="flex flex-wrap gap-2">
              {profile.recentBadges.map((b: string) => (
                <div key={b} className="flex items-center gap-1.5 rounded-full border border-[#1e2130] bg-[#0a0c12] px-3 py-1.5 text-sm">
                  <span>{BADGE_EMOJI[b] ?? "🏆"}</span>
                  <span className="text-xs text-[#5a5f72] capitalize">{b.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
