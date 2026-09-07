import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Shield, Search, RotateCcw, Trash2, Pencil, Megaphone, X } from "lucide-react";
import { EmptyState, LoadingState, MotionTab, SectionHeader, StatCard, adminFetch, QuickActionButton } from "./AdminHelpers";
import type { AdminPanelProps } from "./AdminTypes";

type Overview = {
  participants: number;
  activeThisWeek: number;
  totalRelapses: number;
  longestEver: number;
  avgCurrentStreak: number;
  buckets: { day0_6: number; day7_29: number; day30_89: number; day90_plus: number };
  moods: { checkins7d: number; avg7d: number };
  pledges: { total: number; recent: Array<{ id: string; message: string; postedAt: string }> };
};

type JourneyUser = {
  userId: string;
  name: string;
  email: string;
  role: string;
  startDate: string;
  currentStreak: number;
  longestStreak: number;
  relapseCount: number;
  lastRelapseDate: string | null;
  updatedAt: string;
  avgMood7d: number | null;
  checkins7d: number;
};

const inputCls = "rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-2.5 py-1.5 text-xs text-[var(--palette-zinc-100)] outline-none focus:border-[var(--palette-sky-600)]";

function moodEmoji(v: number | null): string {
  if (v == null) return "—";
  if (v >= 4.5) return "😄";
  if (v >= 3.5) return "🙂";
  if (v >= 2.5) return "😐";
  if (v >= 1.5) return "😕";
  return "😞";
}

export function AdminBreakFreePanel({ authHeaders, onManageUser }: AdminPanelProps & { onManageUser?: (id: string) => void }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<JourneyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"current" | "longest" | "relapses" | "recent">("current");
  const [editing, setEditing] = useState<JourneyUser | null>(null);
  const [edit, setEdit] = useState({ startDate: "", longestStreak: 0, relapseCount: 0 });
  const [pledgeDraft, setPledgeDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const headers = useCallback(() => ({ ...authHeaders(), "Content-Type": "application/json" }), [authHeaders]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ sort, limit: "150" });
      if (q.trim()) params.set("q", q.trim());
      const [o, u] = await Promise.all([
        adminFetch("/api/admin/break-free/overview", { headers: authHeaders(), credentials: "include" }),
        adminFetch(`/api/admin/break-free/users?${params.toString()}`, { headers: authHeaders(), credentials: "include" }),
      ]);
      if (o.ok) setOverview(await o.json());
      if (u.ok) setUsers((await u.json()).users ?? []);
    } finally { setLoading(false); }
  }, [authHeaders, q, sort]);

  useEffect(() => { void load(); }, [load]);

  async function act(key: string, fn: () => Promise<Response>, success: (d: any) => string) {
    setBusy(key);
    try {
      const r = await fn();
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { alert(d.error?.message ?? d.error ?? "Failed"); return; }
      setNotice(success(d));
      await load();
    } finally { setBusy(null); }
  }

  const resetUser = (u: JourneyUser, countRelapse: boolean) => {
    if (!confirm(`${countRelapse ? "Log a relapse and restart" : "Restart"} ${u.name}'s streak from today?`)) return;
    void act(`reset:${u.userId}`, () => adminFetch(`/api/admin/break-free/users/${u.userId}/reset`, {
      method: "POST", headers: headers(), credentials: "include", body: JSON.stringify({ countRelapse }),
    }), () => `${u.name}'s streak restarted from today`);
  };

  const deleteUser = (u: JourneyUser) => {
    if (!confirm(`Remove ${u.name}'s entire Break Free journey (streak + mood log)? This cannot be undone.`)) return;
    void act(`del:${u.userId}`, () => adminFetch(`/api/admin/break-free/users/${u.userId}`, {
      method: "DELETE", headers: authHeaders(), credentials: "include",
    }), () => `${u.name}'s journey removed`);
  };

  const openEdit = (u: JourneyUser) => {
    setEditing(u);
    setEdit({ startDate: u.startDate.slice(0, 10), longestStreak: u.longestStreak, relapseCount: u.relapseCount });
  };

  const saveEdit = () => {
    if (!editing) return;
    void act(`edit:${editing.userId}`, () => adminFetch(`/api/admin/break-free/users/${editing.userId}`, {
      method: "PATCH", headers: headers(), credentials: "include", body: JSON.stringify(edit),
    }), () => `${editing.name}'s journey updated`).then(() => setEditing(null));
  };

  const deletePledge = (id: string) => {
    if (!confirm("Remove this pledge from the public wall?")) return;
    void act(`pledge:${id}`, () => adminFetch(`/api/admin/break-free/pledges/${id}`, {
      method: "DELETE", headers: authHeaders(), credentials: "include",
    }), () => "Pledge removed");
  };

  const postPledge = () => {
    const message = pledgeDraft.trim();
    if (!message) return;
    void act("pledge:new", () => adminFetch("/api/admin/break-free/pledges", {
      method: "POST", headers: headers(), credentials: "include", body: JSON.stringify({ message }),
    }), () => "Pledge posted to the wall").then(() => setPledgeDraft(""));
  };

  const b = overview?.buckets;
  const bucketTotal = b ? b.day0_6 + b.day7_29 + b.day30_89 + b.day90_plus : 0;

  return (
    <MotionTab>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader title="Break Free" sub="Manage every member's no-fap journey: streaks, relapses, mood check-ins and the public pledge wall." />
        <button onClick={() => { setLoading(true); void load(); }} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)] transition">
          <RefreshCw size={12} className={`inline mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="On a journey" value={String(overview?.participants ?? 0)} accent="violet" sub={`${overview?.activeThisWeek ?? 0} active this week`} />
        <StatCard label="Avg current streak" value={`${overview?.avgCurrentStreak ?? 0}d`} accent="emerald" />
        <StatCard label="Longest ever" value={`${overview?.longestEver ?? 0}d`} accent="amber" />
        <StatCard label="Total relapses" value={String(overview?.totalRelapses ?? 0)} accent="rose" />
        <StatCard label="Mood (7d)" value={`${moodEmoji(overview?.moods.avg7d ?? null)} ${overview?.moods.avg7d ?? 0}/5`} sub={`${overview?.moods.checkins7d ?? 0} check-ins`} />
      </div>

      {b && bucketTotal > 0 && (
        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-4">
          <p className="mb-2 text-xs font-semibold text-[var(--palette-zinc-300)]">Where members are right now</p>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--palette-zinc-800)]">
            {[
              ["day0_6", "bg-[var(--palette-rose-500)]"], ["day7_29", "bg-[var(--palette-amber-500)]"],
              ["day30_89", "bg-[var(--palette-sky-500)]"], ["day90_plus", "bg-[var(--palette-emerald-500)]"],
            ].map(([key, cls]) => {
              const n = b[key as keyof typeof b];
              return n ? <div key={key} className={cls} style={{ width: `${(n / bucketTotal) * 100}%` }} title={`${n}`} /> : null;
            })}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-[var(--palette-zinc-400)] sm:grid-cols-4">
            <span>🔴 Days 0–6: <b className="text-[var(--palette-zinc-200)]">{b.day0_6}</b></span>
            <span>🟠 Week 1–4: <b className="text-[var(--palette-zinc-200)]">{b.day7_29}</b></span>
            <span>🔵 Month 1–3: <b className="text-[var(--palette-zinc-200)]">{b.day30_89}</b></span>
            <span>🟢 90+ days: <b className="text-[var(--palette-zinc-200)]">{b.day90_plus}</b></span>
          </div>
        </div>
      )}

      {notice && <p className="text-[11px] text-[var(--palette-emerald-400)]">✓ {notice}</p>}

      {/* Members */}
      <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[12rem]">
            <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--palette-zinc-500)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className={`${inputCls} w-full pl-7`} />
          </label>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={inputCls} aria-label="Sort">
            <option value="current">Longest current streak</option>
            <option value="longest">Longest ever</option>
            <option value="relapses">Most relapses</option>
            <option value="recent">Recently active</option>
          </select>
          <span className="text-[11px] text-[var(--palette-zinc-500)]">{users.length} member{users.length === 1 ? "" : "s"}</span>
        </div>

        {loading ? <LoadingState /> : users.length === 0 ? (
          <EmptyState icon={<Shield size={32} />} title="No journeys yet" description="Members appear here once they start a Break Free streak." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-[var(--palette-zinc-500)]">
                <tr>
                  <th className="pb-2 pr-3">Member</th>
                  <th className="pb-2 pr-3">Current</th>
                  <th className="pb-2 pr-3">Longest</th>
                  <th className="pb-2 pr-3">Relapses</th>
                  <th className="pb-2 pr-3">Mood 7d</th>
                  <th className="pb-2 pr-3">Started</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--palette-zinc-800)]/70">
                {users.map((u) => (
                  <tr key={u.userId} className="text-[var(--palette-zinc-300)]">
                    <td className="py-2 pr-3">
                      <button onClick={() => onManageUser?.(u.userId)} className="block max-w-[14rem] truncate text-left font-medium text-[var(--palette-zinc-100)] hover:underline">{u.name}</button>
                      <span className="block max-w-[14rem] truncate font-mono text-[10px] text-[var(--palette-zinc-600)]">{u.email}</span>
                    </td>
                    <td className="py-2 pr-3 font-semibold text-[var(--palette-emerald-300)]">{u.currentStreak}d</td>
                    <td className="py-2 pr-3">{u.longestStreak}d</td>
                    <td className="py-2 pr-3">{u.relapseCount}{u.lastRelapseDate ? <span className="block text-[10px] text-[var(--palette-zinc-600)]">last {u.lastRelapseDate}</span> : null}</td>
                    <td className="py-2 pr-3">{moodEmoji(u.avgMood7d)} {u.avgMood7d ?? "—"}<span className="block text-[10px] text-[var(--palette-zinc-600)]">{u.checkins7d} check-ins</span></td>
                    <td className="py-2 pr-3 font-mono text-[11px]">{u.startDate.slice(0, 10)}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        <QuickActionButton onClick={() => openEdit(u)}><Pencil size={11} /> Edit</QuickActionButton>
                        <QuickActionButton loading={busy === `reset:${u.userId}`} onClick={() => resetUser(u, false)}><RotateCcw size={11} /> Restart</QuickActionButton>
                        <QuickActionButton variant="danger" loading={busy === `reset:${u.userId}`} onClick={() => resetUser(u, true)}>Log relapse</QuickActionButton>
                        <QuickActionButton variant="danger" loading={busy === `del:${u.userId}`} onClick={() => deleteUser(u)}><Trash2 size={11} /></QuickActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit drawer */}
      {editing && (
        <div className="rounded-xl border border-[var(--palette-sky-900)] bg-[var(--palette-sky-950)]/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--palette-zinc-200)]">Edit {editing.name}'s journey</p>
            <button onClick={() => setEditing(null)} className="text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-200)]" aria-label="Close"><X size={14} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-[11px] text-[var(--palette-zinc-400)]">Start date
              <input type="date" value={edit.startDate} onChange={(e) => setEdit((s) => ({ ...s, startDate: e.target.value }))} className={`${inputCls} mt-1 w-full`} />
            </label>
            <label className="block text-[11px] text-[var(--palette-zinc-400)]">Longest streak (days)
              <input type="number" min={0} value={edit.longestStreak} onChange={(e) => setEdit((s) => ({ ...s, longestStreak: Number(e.target.value) }))} className={`${inputCls} mt-1 w-full`} />
            </label>
            <label className="block text-[11px] text-[var(--palette-zinc-400)]">Relapse count
              <input type="number" min={0} value={edit.relapseCount} onChange={(e) => setEdit((s) => ({ ...s, relapseCount: Number(e.target.value) }))} className={`${inputCls} mt-1 w-full`} />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <QuickActionButton onClick={() => setEditing(null)}>Cancel</QuickActionButton>
            <QuickActionButton variant="success" loading={busy === `edit:${editing.userId}`} onClick={saveEdit}>Save</QuickActionButton>
          </div>
        </div>
      )}

      {/* Pledge wall */}
      <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--palette-zinc-300)]"><Megaphone size={12} /> Public pledge wall <span className="font-normal text-[var(--palette-zinc-500)]">({overview?.pledges.total ?? 0} total)</span></p>
        <div className="mb-3 flex gap-2">
          <input value={pledgeDraft} onChange={(e) => setPledgeDraft(e.target.value)} maxLength={100} placeholder="Post an encouraging pledge as the community…" className={`${inputCls} flex-1`} />
          <QuickActionButton variant="primary" disabled={!pledgeDraft.trim()} loading={busy === "pledge:new"} onClick={postPledge}>Post</QuickActionButton>
        </div>
        {(overview?.pledges.recent ?? []).length === 0 ? (
          <p className="text-[11px] text-[var(--palette-zinc-500)]">No pledges yet.</p>
        ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {overview!.pledges.recent.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs text-[var(--palette-zinc-200)]">{p.message}</p>
                  <p className="text-[10px] text-[var(--palette-zinc-600)]">{new Date(p.postedAt).toLocaleString()}</p>
                </div>
                <button onClick={() => deletePledge(p.id)} disabled={busy === `pledge:${p.id}`} className="shrink-0 text-[var(--palette-zinc-500)] hover:text-[var(--palette-rose-400)] disabled:opacity-50" aria-label="Remove pledge"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MotionTab>
  );
}
