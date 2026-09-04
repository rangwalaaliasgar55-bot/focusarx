import React from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getToken, useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Trophy, Flame, Clock, CheckSquare, Star, Users, Zap, Crown, ArrowLeft, UserPlus } from "lucide-react";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function StatBubble({ icon: Icon, label, value, color = "var(--brand-600)" }: { icon: React.ComponentType<any>; label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-4 gap-1">
      <Icon size={16} style={{ color }} />
      <p className="text-xl font-semibold text-[var(--foreground)]">{value}</p>
      <p className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider text-center">{label}</p>
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
      const setMeta = (attr: string, name: string, content: string) => {
        let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
        if (!el) {
          el = document.createElement("meta");
          el.setAttribute(attr, name);
          document.head.appendChild(el);
        }
        el.setAttribute("content", content);
      };
      const desc = `View ${username}'s public study profile on FocusArx — stats, badges, streak, and more.`;
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", desc);
      // Per-user share card from real public stats (Phase 4.4).
      const ogImage = `https://focusarx.site/api/og/user?u=${encodeURIComponent(username)}`;
      setMeta("property", "og:title", `${username} — FocusArx Profile`);
      setMeta("property", "og:description", desc);
      setMeta("property", "og:image", ogImage);
      setMeta("name", "twitter:image", ogImage);
    }
  }, [username]);
  const { toast } = useToast();

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
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--brand-600)]" />
    </div>
  );

  if (error || !profile) return (
    <div className="min-h-screen bg-[var(--muted)] flex flex-col items-center justify-center text-center p-6">
      <p className="text-6xl mb-4">👤</p>
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Profile not found</h1>
      <p className="text-[var(--foreground-subtle)] mb-6">No user with the username "{username}" exists.</p>
      <Link href="/" className="rounded-xl bg-[var(--brand-600)] px-5 py-2.5 text-sm font-semibold text-[var(--palette-white)]">Go Home</Link>
    </div>
  );

  const initials = (profile.name || "U").slice(0, 2).toUpperCase();
  const colors = ["from-[var(--palette-violet-500)] to-[var(--palette-indigo-600)]", "from-[var(--palette-emerald-500)] to-[var(--palette-teal-600)]", "from-[var(--palette-amber-500)] to-[var(--palette-orange-600)]"];
  const color = colors[initials.charCodeAt(0) % colors.length];

  return (
    <div className="min-h-screen bg-[var(--muted)] text-[var(--foreground)]">
      {/* Hero banner */}
      <div className="relative h-28 sm:h-36 bg-gradient-to-br from-[var(--brand-600)]/30 to-[var(--palette-4f46e5)]/20 border-b border-[var(--border-subtle)]">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_30%_50%,_var(--brand-600),_transparent_70%)]" />
        <Link href="/" className="absolute top-4 left-4 flex items-center gap-1.5 text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors">
          <ArrowLeft size={13} /> Back
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Avatar */}
        <div className="flex items-end justify-between -mt-12 mb-4">
          <div className={`h-24 w-24 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-3xl font-semibold text-[var(--palette-white)] border-4 border-[var(--rgba-8-9-20-0_8)] shadow-xl`}>
            {initials}
          </div>
          {!isOwnProfile && status === "authenticated" && (
            <button onClick={() => sendRequest.mutate()} disabled={sendRequest.isPending || sendRequest.isSuccess} className="flex items-center gap-2 rounded-xl bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-[var(--palette-white)] disabled:opacity-50 hover:bg-[var(--palette-6d31d4)] transition-colors">
              <UserPlus size={14} /> {sendRequest.isSuccess ? "Request sent!" : sendRequest.isPending ? "…" : "Add Friend"}
            </button>
          )}
        </div>

        {/* Name + bio */}
        <div className="mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">{profile.name}</h1>
            {profile.isPremium && <span className="flex items-center gap-1 rounded-full border border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/10 px-2 py-0.5 text-xs text-[var(--brand-gold)] font-bold"><Crown size={10} /> Premium</span>}
            {profile.prestige > 0 && <span className="flex items-center gap-1 rounded-full border border-[var(--palette-amber-500)]/40 bg-[var(--palette-amber-500)]/10 px-2 py-0.5 text-xs text-[var(--palette-amber-400)] font-bold"><Crown size={10} /> Prestige {profile.prestige}</span>}
            {(profile.isBot || profile.role === "bot") && <span className="inline-flex items-center gap-1 rounded-full border border-[var(--forge-border)] bg-[var(--surface-1)] px-2.5 py-1 text-[10px] font-medium text-[var(--foreground-subtle)]" title="Focus Companion — fictional identity for community simulation, not a real person"><span className="h-1.5 w-1.5 rounded-full bg-[var(--foreground-subtle)]"/> Focus Companion</span>}
          </div>
          {(profile.isBot || profile.role === "bot") && <p className="mt-2 text-[11px] leading-relaxed text-[var(--foreground-subtle)]">This is a Focus Companion — a fictional community member to make study rooms feel alive. Not a real person, no real testimonials.</p>}
          {profile.bio && <p className="text-sm text-[var(--foreground-subtle)] mt-1.5 leading-relaxed">{profile.bio}</p>}
          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--foreground-subtle)]">
            <span className="flex items-center gap-1"><Users size={11} /> {profile.friendCount} friends</span>
            <span>·</span>
            <span>Joined {new Date(profile.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
            {profile.timezone && <><span>·</span><span>🕐 {profile.timezone}</span></>}
          </div>
        </div>

        {/* Level bar */}
        <div className="rounded-2xl border border-[var(--brand-600)]/30 bg-[var(--surface-hover)] p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><Zap size={15} className="text-[var(--brand-600)]" /><span className="text-sm font-bold text-[var(--foreground)]">Level {level}</span>{profile.prestige > 0 && <span className="text-[10px] font-bold text-[var(--palette-amber-400)]">✦ P{profile.prestige}</span>}</div>
            <span className="text-xs text-[var(--foreground-subtle)]">{xp.toLocaleString()} XP</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--rgba-255-255-255-0_06)] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)] transition-all" style={{ width: `${Math.min(100, (xp / levelXpRequired(level)) * 100)}%` }} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <StatBubble icon={Flame} label="Streak" value={`${profile.streak}d`} color="var(--palette-f97316)" />
          <StatBubble icon={Clock} label="Focus Hours" value={profile.totalFocusHours} color="var(--color-warning)" />
          <StatBubble icon={CheckSquare} label="Tasks Done" value={profile.tasksCompleted} color="var(--palette-22d387)" />
          <StatBubble icon={Trophy} label="Sessions" value={profile.totalSessions} color="var(--info)" />
          <StatBubble icon={Flame} label="Best Streak" value={`${profile.longestStreak}d`} color="var(--color-error)" />
          <StatBubble icon={Star} label="Badges" value={profile.badgeCount} color="var(--brand-400)" />
        </div>

        {/* Recent badges */}
        {profile.recentBadges?.length > 0 && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-4 mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-3">Recent Badges</p>
            <div className="flex flex-wrap gap-2">
              {profile.recentBadges.map((b: string) => (
                <div key={b} className="flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--muted)] px-3 py-1.5 text-sm">
                  <span>{BADGE_EMOJI[b] ?? "🏆"}</span>
                  <span className="text-xs text-[var(--foreground-subtle)] capitalize">{b.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
