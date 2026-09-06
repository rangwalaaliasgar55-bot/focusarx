import { QueryError } from "@/components/ui/QueryError";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getToken } from "@/lib/auth";
import { Bell, CheckCheck, Trash2, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { isPushSubscribed, requestPushPermission } from "@/lib/pushNotifications";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const TYPE_ICONS: Record<string, string> = {
  friend_request: "👥",
  friend_accepted: "🤝",
  badge: "🏆",
  mission: "🎯",
  daily_reward: "🎁",
  level_up: "⚡",
  group_join: "🏫",
  system: "📢",
};

const TYPE_COLORS: Record<string, string> = {
  friend_request: "border-[var(--palette-blue-500)]/30 bg-[var(--palette-blue-500)]/5",
  friend_accepted: "border-[var(--palette-emerald-500)]/30 bg-[var(--palette-emerald-500)]/5",
  badge: "border-[var(--palette-amber-500)]/30 bg-[var(--palette-amber-500)]/5",
  mission: "border-[var(--palette-violet-500)]/30 bg-[var(--palette-violet-500)]/5",
  daily_reward: "border-[var(--palette-emerald-500)]/30 bg-[var(--palette-emerald-500)]/5",
  level_up: "border-[var(--palette-amber-500)]/30 bg-[var(--palette-amber-500)]/5",
  group_join: "border-[var(--palette-blue-500)]/30 bg-[var(--palette-blue-500)]/5",
  system: "border-[var(--border-subtle)] bg-[var(--surface-hover)]",
};

export default function NotificationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [pushEnabled, setPushEnabled] = useState(() => isPushSubscribed());

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch("/api/notifications"),
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

  const preferences = useQuery({ queryKey: ["push-preferences"], queryFn: () => apiFetch("/api/push/preferences") });
  const savePreferences = useMutation({
    mutationFn: (value: { priorityEnabled: boolean; sound: string }) => apiFetch("/api/push/preferences", { method: "PATCH", body: JSON.stringify(value) }),
    onSuccess: () => { toast("Notification preferences saved", "success"); void preferences.refetch(); },
    onError: () => toast("Premium is required for custom notification controls", "danger"),
  });

  const notifications = data?.notifications ?? [];
  const unread = notifications.filter((n: any) => !n.read).length;

  return (
    <div className="min-h-screen bg-[var(--muted)] text-[var(--foreground)] p-4 sm:p-6 max-w-2xl mx-auto">
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
          {!pushEnabled && <button type="button" onClick={() => void requestPushPermission().then(() => { setPushEnabled(true); void preferences.refetch(); }).catch(() => toast("Push permission could not be enabled", "danger"))} className="min-h-11 rounded-xl bg-[var(--brand-600)] px-4 text-sm font-semibold text-white">Enable push</button>}
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

      <div className="space-y-2">
        {notifications.map((n: any) => (
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
              <p className="text-[11px] text-[var(--foreground-subtle)] mt-1">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); deleteNotif.mutate(n.id); }} className="shrink-0 rounded-lg p-1 text-[var(--foreground-subtle)] hover:text-[var(--palette-red-400)] hover:bg-[var(--palette-red-500)]/10 transition-colors">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
