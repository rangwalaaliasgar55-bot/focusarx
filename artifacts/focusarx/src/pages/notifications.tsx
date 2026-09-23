import { QueryError } from "@/components/ui/QueryError";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { Bell, CheckCheck, Trash2, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { isPushSubscribed, requestPushPermission } from "@/lib/pushNotifications";

interface AppNotification {
  id: string;
  type: string;
  title?: string;
  message?: string;
  read?: boolean;
  createdAt?: string;
}
interface PushPreferences {
  premium?: boolean;
  priorityEnabled?: boolean;
  sound?: string;
}
interface NotificationsPayload { notifications?: AppNotification[] }

/** Shared client: cookie-first auth, silent refresh, readable error messages. */
function apiFetch<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  return apiJson<T>(path, opts);
}

// Every notification `type` the API emits, with a glyph. Unknown types fall
// back to the bell so a new server type never renders blank.
const TYPE_ICONS: Record<string, string> = {
  friend_request: "👥",
  friend_accepted: "🤝",
  new_follower: "➕",
  badge: "🏆",
  badge_unlocked: "🏆",
  mission: "🎯",
  mission_claimed: "🎯",
  daily_reward: "🎁",
  gift: "🎁",
  lootbox_reward: "📦",
  level_up: "⚡",
  streak: "🔥",
  streak_endangerment: "⚠️",
  group_join: "🏫",
  post_comment: "💬",
  post_reaction: "❤️",
  dm: "✉️",
  premium: "👑",
  referral: "🔗",
  reengage: "👋",
  admin_message: "🛡️",
  system: "📢",
};

const BLUE = "border-[var(--palette-blue-500)]/30 bg-[var(--palette-blue-500)]/5";
const GREEN = "border-[var(--palette-emerald-500)]/30 bg-[var(--palette-emerald-500)]/5";
const AMBER = "border-[var(--palette-amber-500)]/30 bg-[var(--palette-amber-500)]/5";
const VIOLET = "border-[var(--brand-500)]/40 bg-[var(--palette-violet-500)]/5";
const PINK = "border-[var(--palette-pink-500)]/30 bg-[var(--palette-pink-500)]/5";
const RED = "border-[var(--palette-red-500)]/30 bg-[var(--palette-red-500)]/5";
const NEUTRAL = "border-[var(--border-subtle)] bg-[var(--surface-hover)]";

const TYPE_COLORS: Record<string, string> = {
  friend_request: BLUE,
  friend_accepted: GREEN,
  new_follower: BLUE,
  badge: AMBER,
  badge_unlocked: AMBER,
  mission: VIOLET,
  mission_claimed: VIOLET,
  daily_reward: GREEN,
  gift: GREEN,
  lootbox_reward: VIOLET,
  level_up: AMBER,
  streak: AMBER,
  streak_endangerment: RED,
  group_join: BLUE,
  post_comment: PINK,
  post_reaction: PINK,
  dm: BLUE,
  premium: AMBER,
  referral: GREEN,
  reengage: NEUTRAL,
  admin_message: VIOLET,
  system: NEUTRAL,
};

// Filters group the long list into what a learner actually hunts for. The
// server sends every type flat, so the buckets live here and a brand-new type
// automatically lands in "All" instead of vanishing.
const FILTERS = [
  { id: "all", label: "All", types: null },
  { id: "unread", label: "Unread", types: null },
  { id: "social", label: "Social", types: ["friend_request", "friend_accepted", "new_follower", "post_comment", "post_reaction", "dm", "group_join", "referral"] },
  { id: "rewards", label: "Rewards", types: ["badge", "badge_unlocked", "mission", "mission_claimed", "daily_reward", "gift", "lootbox_reward", "level_up", "streak", "streak_endangerment", "premium"] },
  { id: "system", label: "System", types: ["admin_message", "system", "reengage"] },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

/** "Today" / "Yesterday" / "Mon 14 Apr" — the bucket header above a cluster. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Earlier this week";
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** Relative stamp for the row itself; the exact time stays in the title attr. */
function agoLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [pushEnabled, setPushEnabled] = useState(() => isPushSubscribed());
  const [filter, setFilter] = useState<FilterId>("all");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<NotificationsPayload>("/api/notifications"),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => apiFetch("/api/notifications/mark-all-read", { method: "POST" }),
    onSuccess: () => { toast("All notifications marked as read", "success"); qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });

  const deleteNotif = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/notifications/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const clearAll = useMutation({
    mutationFn: () => apiFetch("/api/notifications", { method: "DELETE" }),
    onSuccess: () => { toast("All notifications cleared", "success"); qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });

  const preferences = useQuery<PushPreferences>({ queryKey: ["push-preferences"], queryFn: () => apiFetch<PushPreferences>("/api/push/preferences") });
  const savePreferences = useMutation({
    mutationFn: (value: { priorityEnabled: boolean; sound: string }) => apiFetch("/api/push/preferences", { method: "PATCH", body: JSON.stringify(value) }),
    onSuccess: () => { toast("Notification preferences saved", "success"); void preferences.refetch(); },
    onError: () => toast("Premium is required for custom notification controls", "danger"),
  });

  const notifications = useMemo<AppNotification[]>(() => data?.notifications ?? [], [data]);
  const unread = notifications.filter((n) => !n.read).length;

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: notifications.length, unread };
    for (const f of FILTERS) {
      if (!f.types) continue;
      map[f.id] = notifications.filter((n) => (f.types as readonly string[]).includes(n.type)).length;
    }
    return map;
  }, [notifications, unread]);

  const visible = useMemo(() => {
    const active = FILTERS.find((f) => f.id === filter);
    if (filter === "unread") return notifications.filter((n) => !n.read);
    if (!active?.types) return notifications;
    return notifications.filter((n) => (active.types as readonly string[]).includes(n.type));
  }, [notifications, filter]);

  // Unread first inside each day so the important rows sit at the top of the
  // bucket, then newest-first as the server sent them.
  const groups = useMemo(() => {
    const buckets = new Map<string, AppNotification[]>();
    for (const n of [...visible].sort((a, b) => Number(!!a.read) - Number(!!b.read))) {
      const key = dayLabel(n.createdAt ?? "");
      const list = buckets.get(key) ?? [];
      list.push(n);
      buckets.set(key, list);
    }
    return [...buckets.entries()];
  }, [visible]);

  return (
    <div className="min-h-screen bg-[var(--muted)] text-[var(--foreground)] p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Bell size={22} className="text-[var(--brand-600)]" />
            Notifications
            {unread > 0 && <span className="ml-1 rounded-full bg-[var(--palette-red-500)] text-[var(--palette-white)] text-xs font-bold w-5 h-5 flex items-center justify-center">{unread}</span>}
          </h1>
          <p className="text-sm text-[var(--foreground-subtle)] mt-1">{notifications.length} total</p>
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <button onClick={() => markAllRead.mutate()} className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-3 py-2 text-xs font-medium text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors">
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={() => clearAll.mutate()} className="flex items-center gap-1.5 rounded-xl border border-[var(--palette-red-500)]/20 bg-[var(--palette-red-500)]/5 px-3 py-2 text-xs font-medium text-[var(--palette-red-400)] hover:bg-[var(--palette-red-500)]/10 transition-colors">
              <Trash2 size={13} /> Clear all
            </button>
          )}
        </div>
      </div>

      <section className="mb-5 rounded-2xl border border-[var(--brand-500)]/20 bg-[var(--brand-soft)] p-4" aria-labelledby="push-controls-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><h2 id="push-controls-title" className="font-semibold">Premium notification controls</h2><p className="mt-1 text-xs text-[var(--foreground-subtle)]">Prioritize focus reminders and choose a notification sound.</p></div>
          {/* Push failures used to surface as one scary generic toast. Each
              cause now gets calm, specific guidance — and the copy always
              reassures that in-app notifications keep working, because they
              do; push is an extra, not the product. */}
          {!pushEnabled && <button type="button" onClick={() => void requestPushPermission().then(() => { setPushEnabled(true); void preferences.refetch(); toast("Push enabled — streak alerts will find you anywhere.", "success"); }).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : "";
            toast(
              message.includes("denied")
                ? "Push is blocked in your browser settings — allow notifications for this site, then try again. In-app alerts still work."
                : message.includes("not supported")
                  ? "This browser can't receive push — in-app alerts still work here."
                  : "Push setup didn't finish (no service worker in this environment). In-app alerts still work.",
              "info",
            );
          })} className="min-h-11 rounded-xl bg-[var(--brand-600)] px-4 text-sm font-semibold text-white">Enable push</button>}
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={preferences.data?.priorityEnabled ?? false} disabled={!preferences.data?.premium} onChange={(event) => savePreferences.mutate({ priorityEnabled: event.target.checked, sound: preferences.data?.sound ?? "default" })} /> Priority</label>
          <select aria-label="Notification sound" value={preferences.data?.sound ?? "default"} disabled={!preferences.data?.premium} onChange={(event) => savePreferences.mutate({ priorityEnabled: preferences.data?.priorityEnabled ?? false, sound: event.target.value })} className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"><option value="default">Default</option><option value="chime">Chime</option><option value="focus-bell">Focus bell</option><option value="cosmic">Cosmic</option></select>
        </div>
      </section>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--brand-600)]" />
        </div>
      )}

      {!isLoading && isError && !data && (
        <QueryError what="notifications" onRetry={() => void refetch()} retrying={isRefetching} />
      )}

      {!isLoading && !(isError && !data) && notifications.length === 0 && (
        <div className="text-center py-16">
          <Bell size={48} className="mx-auto mb-4 text-[var(--rgba-255-255-255-0_12)]" />
          <p className="text-[var(--foreground-subtle)] text-sm">You're all caught up!</p>
          <p className="text-[var(--palette-2a2d3a)] text-xs mt-1">Notifications will appear here when you earn badges, complete missions, or get friend activity.</p>
        </div>
      )}

      {/* Filter rail — one row of chips that scroll horizontally on a phone
          and just sit there on a desktop. */}
      {notifications.length > 0 && (
      <div className="mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:flex-wrap">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count = counts[f.id] ?? 0;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={active}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${ active ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-[var(--palette-white)]" : "border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--foreground-subtle)] hover:text-[var(--foreground)]" }`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-black/20" : "bg-[var(--surface-1)]"}`}>{count}</span>
            </button>
          );
        })}
      </div>
      )}

      {groups.length > 0 && (
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground-subtle)]">
            {filter === "all" ? "Latest activity" : FILTERS.find((f) => f.id === filter)?.label}
          </h2>
          <span className="text-[11px] text-[var(--foreground-subtle)]">{visible.length} shown</span>
        </div>
      )}

      <div className="space-y-5">
        {groups.map(([day, list]) => (
          <section key={day}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--foreground-subtle)]">{day}</span>
              <span className="h-px flex-1 bg-[var(--border-subtle)]" />
              <span className="text-[11px] text-[var(--foreground-subtle)]">{list.length}</span>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
        {list.map((n) => (
          <div
            key={n.id}
            role="button"
            tabIndex={0}
            aria-pressed={!!n.read}
            className={`relative flex items-start gap-3 rounded-xl border p-3.5 transition-all cursor-pointer hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] ${TYPE_COLORS[n.type] ?? "border-[var(--border-subtle)] bg-[var(--surface-hover)]"} ${!n.read ? "opacity-100" : "opacity-60"}`}
            onClick={() => !n.read && markRead.mutate(n.id)}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !n.read) { e.preventDefault(); markRead.mutate(n.id); } }}
          >
            {!n.read && <span className="absolute top-3 left-2 w-1.5 h-1.5 rounded-full bg-[var(--brand-600)]" />}
            <span className="text-xl shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? "🔔"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)]">{n.title}</p>
              <p className="text-xs text-[var(--foreground-subtle)] mt-0.5">{n.message}</p>
              <p className="text-[11px] text-[var(--foreground-subtle)] mt-1" title={n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}>{agoLabel(n.createdAt ?? "")}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); deleteNotif.mutate(n.id); }} className="shrink-0 rounded-lg p-1 text-[var(--foreground-subtle)] hover:text-[var(--palette-red-400)] hover:bg-[var(--palette-red-500)]/10 transition-colors">
              <X size={13} />
            </button>
          </div>
        ))}
            </div>
          </section>
        ))}
      </div>

      {!isLoading && !(isError && !data) && notifications.length > 0 && groups.length === 0 && (
        <div className="text-center py-16">
          <Bell size={40} className="mx-auto mb-3 text-[var(--rgba-255-255-255-0_12)]" />
          <p className="text-sm text-[var(--foreground-subtle)]">
            {filter === "unread" ? "Nothing unread — nice." : `No ${filter} notifications yet.`}
          </p>
          <p className="mt-1 text-xs text-[var(--palette-2a2d3a)]">Try another filter, or clear this one to see everything.</p>
        </div>
      )}
    </div>
  );
}
