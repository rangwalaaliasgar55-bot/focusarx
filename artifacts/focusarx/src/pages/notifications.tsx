import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import { useToast } from "@/components/Toast";

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
  friend_request: "border-blue-500/30 bg-blue-500/5",
  friend_accepted: "border-emerald-500/30 bg-emerald-500/5",
  badge: "border-amber-500/30 bg-amber-500/5",
  mission: "border-violet-500/30 bg-violet-500/5",
  daily_reward: "border-emerald-500/30 bg-emerald-500/5",
  level_up: "border-amber-500/30 bg-amber-500/5",
  group_join: "border-blue-500/30 bg-blue-500/5",
  system: "border-[#1e2130] bg-[#111318]",
};

export default function NotificationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
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
    onSuccess: () => { toast({ type: "success", message: "All notifications marked as read" }); qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });

  const deleteNotif = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/notifications/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const clearAll = useMutation({
    mutationFn: () => apiFetch("/api/notifications", { method: "DELETE" }),
    onSuccess: () => { toast({ type: "success", message: "All notifications cleared" }); qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });

  const notifications = data?.notifications ?? [];
  const unread = notifications.filter((n: any) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#0a0c12] text-[#e8eaf0] p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e8eaf0] flex items-center gap-2">
            <Bell size={22} className="text-[#7C3AED]" />
            Notifications
            {unread > 0 && <span className="ml-1 rounded-full bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center">{unread}</span>}
          </h1>
          <p className="text-sm text-[#4a4f62] mt-1">{notifications.length} total</p>
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <button onClick={() => markAllRead.mutate()} className="flex items-center gap-1.5 rounded-xl border border-[#1e2130] bg-[#111318] px-3 py-2 text-xs font-medium text-[#5a5f72] hover:text-[#e8eaf0] transition-colors">
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={() => clearAll.mutate()} className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 size={13} /> Clear all
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1e2130] border-t-[#7C3AED]" />
        </div>
      )}

      {!isLoading && notifications.length === 0 && (
        <div className="text-center py-16">
          <Bell size={48} className="mx-auto mb-4 text-[#1e2130]" />
          <p className="text-[#3a3d4a] text-sm">You're all caught up!</p>
          <p className="text-[#2a2d3a] text-xs mt-1">Notifications will appear here when you earn badges, complete missions, or get friend activity.</p>
        </div>
      )}

      <div className="space-y-2">
        {notifications.map((n: any) => (
          <div
            key={n.id}
            className={`relative flex items-start gap-3 rounded-xl border p-3.5 transition-all cursor-pointer hover:brightness-110 ${TYPE_COLORS[n.type] ?? "border-[#1e2130] bg-[#111318]"} ${!n.read ? "opacity-100" : "opacity-60"}`}
            onClick={() => !n.read && markRead.mutate(n.id)}
          >
            {!n.read && <span className="absolute top-3 left-2 w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />}
            <span className="text-xl shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? "🔔"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#e8eaf0]">{n.title}</p>
              <p className="text-xs text-[#5a5f72] mt-0.5">{n.message}</p>
              <p className="text-[10px] text-[#3a3d4a] mt-1">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); deleteNotif.mutate(n.id); }} className="shrink-0 rounded-lg p-1 text-[#3a3d4a] hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
