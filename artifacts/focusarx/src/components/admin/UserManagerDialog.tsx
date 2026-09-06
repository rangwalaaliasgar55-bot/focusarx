import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save, ShieldAlert, KeyRound, Coins, Flame, Trash2, Bell, Wallet, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { adminFetch } from "./AdminHelpers";

export interface AdminUserProfile {
  user: {
    id: string;
    email: string;
    name: string | null;
    isGuest: boolean;
    role: string;
    bio: string | null;
    timezone: string | null;
    onboardingCompleted: boolean;
    productivityScore: number | null;
    totalFocusMinutes: number | null;
    referralCode: string | null;
    createdAt: string;
    hasPassword: boolean;
  };
  wallet: { coins: number; totalXp: number; weeklyXp: number; level: number; prestige: number } | null;
  streak: { currentStreak: number; longestStreak: number; lastStudyDate: string | null } | null;
  premium: { isActive: boolean; expiresAt: string | null } | null;
  stats: { sessionCount: number; totalFocusMinutes: number; lastSessionAt: string | null; postCount: number };
  recentSessions: Array<{
    id: string; mode: string; durationSec: number; focusScore: number | null;
    completedAt: string | null; sessionStatus: string | null;
  }>;
}

type SaveState = { kind: "ok" | "err"; msg: string } | null;

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--palette-zinc-600)]">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]";

export function UserManagerDialog({
  userId,
  onClose,
  onChanged,
  authHeaders,
}: {
  userId: string | null;
  onClose: () => void;
  onChanged: () => void;
  authHeaders: () => Record<string, string>;
}) {
  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>(null);

  // Editable forms
  const [profileForm, setProfileForm] = useState({ name: "", email: "", bio: "", timezone: "", role: "user" });
  const [walletForm, setWalletForm] = useState({ coins: "", totalXp: "", weeklyXp: "", level: "" });
  const [streakForm, setStreakForm] = useState({ currentStreak: "", longestStreak: "" });
  const [password, setPassword] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [notify, setNotify] = useState({ title: "", message: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await adminFetch(`/api/admin/users/${userId}/profile`, { headers: authHeaders(), credentials: "include" });
      if (!r.ok) { setSaveState({ kind: "err", msg: `Failed to load profile (${r.status})` }); return; }
      const d = (await r.json().catch(() => null)) as AdminUserProfile | null;
      if (!d) { setSaveState({ kind: "err", msg: "The profile response could not be read." }); return; }
      setProfile(d);
      setProfileForm({
        name: d.user.name ?? "",
        email: d.user.email ?? "",
        bio: d.user.bio ?? "",
        timezone: d.user.timezone ?? "",
        role: d.user.role ?? "user",
      });
      setWalletForm({
        coins: String(d.wallet?.coins ?? 0),
        totalXp: String(d.wallet?.totalXp ?? 0),
        weeklyXp: String(d.wallet?.weeklyXp ?? 0),
        level: String(d.wallet?.level ?? 1),
      });
      setStreakForm({
        currentStreak: String(d.streak?.currentStreak ?? 0),
        longestStreak: String(d.streak?.longestStreak ?? 0),
      });
    } finally {
      setLoading(false);
    }
  }, [userId, authHeaders]);

  /* The per-user reset this effect used to perform now lives at the call site as
     `key={managingUserId}`: remounting per user is how React wants "reset state
     when a prop changes" expressed, and it means the dialog can never open
     showing the previous user's profile while the new one loads. */
  useEffect(() => { void load(); }, [load]);

  const call = async (label: string, url: string, method: string, body?: unknown) => {
    setBusy(label);
    setSaveState(null);
    try {
      const r = await adminFetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setSaveState({ kind: "err", msg: d.error ?? `Request failed (${r.status})` }); return null; }
      return d;
    } catch (e: any) {
      setSaveState({ kind: "err", msg: e.message });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const saveProfile = async () => {
    const d = await call("profile", `/api/admin/users/${userId}`, "PATCH", profileForm);
    if (d) { setSaveState({ kind: "ok", msg: "Profile saved" }); onChanged(); void load(); }
  };

  const saveWallet = async (mode: "set" | "add") => {
    const body: Record<string, string | number> = { mode };
    if (walletForm.coins !== "") body.coins = Number(walletForm.coins);
    if (walletForm.totalXp !== "") body.totalXp = Number(walletForm.totalXp);
    if (walletForm.weeklyXp !== "") body.weeklyXp = Number(walletForm.weeklyXp);
    if (walletForm.level !== "") body.level = Number(walletForm.level);
    const d = await call("wallet", `/api/admin/users/${userId}/wallet`, "PATCH", body);
    if (d) { setSaveState({ kind: "ok", msg: mode === "add" ? "Amounts added" : "Wallet set" }); onChanged(); void load(); }
  };

  const wipeCurrency = async () => {
    if (!confirm("Set this user's coins AND XP to zero? This cannot be undone.")) return;
    const d = await call("wallet", `/api/admin/users/${userId}/wallet`, "PATCH", { coins: 0, totalXp: 0, weeklyXp: 0, level: 1, mode: "set" });
    if (d) { setSaveState({ kind: "ok", msg: "Currency wiped" }); onChanged(); void load(); }
  };

  const saveStreak = async () => {
    const d = await call("streak", `/api/admin/users/${userId}/streak`, "PATCH", {
      currentStreak: Number(streakForm.currentStreak || 0),
      longestStreak: Number(streakForm.longestStreak || 0),
    });
    if (d) { setSaveState({ kind: "ok", msg: "Streak saved" }); onChanged(); void load(); }
  };

  const resetPassword = async () => {
    const d = await call("pw", `/api/admin/users/${userId}/reset-password`, "POST", password.trim() ? { password: password.trim() } : {});
    if (d) {
      setTempPassword(d.temporaryPassword);
      setSaveState({ kind: "ok", msg: "Password reset — copy the temporary password below" });
      setPassword("");
    }
  };

  const sendNotification = async () => {
    if (!notify.title.trim() || !notify.message.trim()) return;
    const d = await call("notify", `/api/admin/users/${userId}/notification`, "POST", notify);
    if (d) { setSaveState({ kind: "ok", msg: "Notification delivered" }); setNotify({ title: "", message: "" }); }
  };

  const u = profile?.user;

  return (
    <Dialog open={Boolean(userId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] w-[min(calc(100vw-2rem),44rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound size={16} className="text-[var(--palette-violet-400)]" />
            Manage user
          </DialogTitle>
          <DialogDescription>
            {u ? u.email : "Loading…"} · joined {u ? new Date(u.createdAt).toLocaleDateString() : "—"}
          </DialogDescription>
        </DialogHeader>

        {loading && !profile ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--palette-zinc-700)] border-t-[var(--palette-violet-400)]" />
          </div>
        ) : profile ? (
          <div className="space-y-5">
            {/* Snapshot */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Sessions" value={String(profile.stats.sessionCount)} />
              <Stat label="Focus mins" value={profile.stats.totalFocusMinutes.toLocaleString()} />
              <Stat label="Posts" value={String(profile.stats.postCount)} />
              <Stat label="Premium" value={profile.premium?.isActive ? "Active" : "—"} />
            </div>

            {saveState && (
              <div className={`rounded-lg border px-3 py-2 text-xs ${saveState.kind === "ok"
                ? "border-[var(--palette-emerald-800)]/50 bg-[var(--palette-emerald-950)]/30 text-[var(--palette-emerald-400)]"
                : "border-[var(--palette-red-800)]/50 bg-[var(--palette-red-950)]/30 text-[var(--palette-red-400)]"}`}>
                {saveState.msg}
              </div>
            )}

            {/* Profile */}
            <section className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">Profile</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name">
                  <input className={inputCls} value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} />
                </Field>
                <Field label="Email">
                  <input className={inputCls} value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} />
                </Field>
                <Field label="Role">
                  <select className={inputCls} value={profileForm.role} onChange={e => setProfileForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="bot">bot (AI rival)</option>
                  </select>
                </Field>
                <Field label="Timezone">
                  <input className={inputCls} value={profileForm.timezone} onChange={e => setProfileForm(f => ({ ...f, timezone: e.target.value }))} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Bio">
                    <textarea rows={2} className={`${inputCls} resize-none`} value={profileForm.bio} onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))} />
                  </Field>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button onClick={() => void saveProfile()} disabled={busy === "profile"}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--palette-violet-700)] px-4 py-2 text-xs font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-violet-600)] disabled:opacity-50">
                  {busy === "profile" ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />} Save profile
                </button>
                <span className="text-[11px] text-[var(--palette-zinc-600)]">
                  Referral {u?.referralCode ?? "—"} · Productivity {u?.productivityScore ?? 0} · {u?.hasPassword ? "password login" : "no password set"}
                </span>
              </div>
            </section>

            {/* Wallet */}
            <section className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">
                <Wallet size={12} /> Wallet &amp; currency
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Coins 🪙">
                  <input type="number" className={inputCls} value={walletForm.coins} onChange={e => setWalletForm(f => ({ ...f, coins: e.target.value }))} />
                </Field>
                <Field label="Total XP">
                  <input type="number" className={inputCls} value={walletForm.totalXp} onChange={e => setWalletForm(f => ({ ...f, totalXp: e.target.value }))} />
                </Field>
                <Field label="Weekly XP">
                  <input type="number" className={inputCls} value={walletForm.weeklyXp} onChange={e => setWalletForm(f => ({ ...f, weeklyXp: e.target.value }))} />
                </Field>
                <Field label="Level">
                  <input type="number" className={inputCls} value={walletForm.level} onChange={e => setWalletForm(f => ({ ...f, level: e.target.value }))} />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={() => void saveWallet("set")} disabled={busy === "wallet"}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--palette-violet-700)] px-3 py-1.5 text-xs font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-violet-600)] disabled:opacity-50">
                  <Save size={12} /> Set exact values
                </button>
                <button onClick={() => void saveWallet("add")} disabled={busy === "wallet"}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs font-semibold text-[var(--palette-zinc-300)] hover:bg-[var(--palette-zinc-800)] disabled:opacity-50">
                  <Coins size={12} /> Add to balance
                </button>
                <button onClick={() => void wipeCurrency()} disabled={busy === "wallet"}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--palette-red-800)] px-3 py-1.5 text-xs font-semibold text-[var(--palette-red-400)] hover:bg-[var(--palette-red-950)] disabled:opacity-50">
                  <Trash2 size={12} /> Wipe currency
                </button>
              </div>
            </section>

            {/* Streak */}
            <section className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">
                <Flame size={12} className="text-[var(--palette-orange-400)]" /> Streak
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Current streak (days)">
                  <input type="number" min="0" className={inputCls} value={streakForm.currentStreak} onChange={e => setStreakForm(f => ({ ...f, currentStreak: e.target.value }))} />
                </Field>
                <Field label="Longest streak (days)">
                  <input type="number" min="0" className={inputCls} value={streakForm.longestStreak} onChange={e => setStreakForm(f => ({ ...f, longestStreak: e.target.value }))} />
                </Field>
              </div>
              <div className="mt-3">
                <button onClick={() => void saveStreak()} disabled={busy === "streak"}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--palette-violet-700)] px-4 py-2 text-xs font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-violet-600)] disabled:opacity-50">
                  {busy === "streak" ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />} Save streak
                </button>
              </div>
            </section>

            {/* Password reset */}
            <section className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-4">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">
                <KeyRound size={12} /> Forgot-password help
              </p>
              <p className="mb-3 text-[11px] text-[var(--palette-zinc-500)]">
                Set a new password for this user (min 8 chars). Leave blank to generate a random one you can relay to them.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={`${inputCls} max-w-[16rem]`}
                  placeholder="New password (optional, min 8 chars)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button onClick={() => void resetPassword()} disabled={busy === "pw"}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--palette-amber-700)] px-3 py-2 text-xs font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-amber-600)] disabled:opacity-50">
                  {busy === "pw" ? <RefreshCw size={12} className="animate-spin" /> : <KeyRound size={12} />} Reset password
                </button>
              </div>
              {tempPassword && (
                <div className="mt-3 rounded-lg border border-[var(--palette-amber-800)]/50 bg-[var(--palette-amber-950)]/20 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-amber-400)]">Temporary password — shown once</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 rounded bg-[var(--palette-zinc-950)] px-2 py-1.5 font-mono text-sm text-[var(--palette-amber-300)]">{tempPassword}</code>
                    <button
                      onClick={() => void navigator.clipboard?.writeText(tempPassword)}
                      className="rounded-lg border border-[var(--palette-zinc-700)] px-2.5 py-1.5 text-xs text-[var(--palette-zinc-300)] hover:bg-[var(--palette-zinc-800)]"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Direct notification */}
            <section className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">
                <Bell size={12} /> Send this user a notification
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputCls} placeholder="Title" value={notify.title} onChange={e => setNotify(n => ({ ...n, title: e.target.value }))} />
                <input className={inputCls} placeholder="Message" value={notify.message} onChange={e => setNotify(n => ({ ...n, message: e.target.value }))} />
              </div>
              <div className="mt-3">
                <button onClick={() => void sendNotification()} disabled={busy === "notify" || !notify.title.trim() || !notify.message.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--palette-sky-700)] px-4 py-2 text-xs font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-sky-600)] disabled:opacity-50">
                  {busy === "notify" ? <RefreshCw size={12} className="animate-spin" /> : <Bell size={12} />} Deliver
                </button>
              </div>
            </section>

            {/* Recent sessions */}
            <section className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">Recent sessions</p>
              {profile.recentSessions.length === 0 ? (
                <p className="text-xs text-[var(--palette-zinc-600)]">No sessions yet.</p>
              ) : (
                <div className="max-h-44 space-y-1 overflow-y-auto">
                  {profile.recentSessions.map(s => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-[var(--palette-zinc-800)] px-3 py-1.5 text-xs">
                      <span className="text-[var(--palette-zinc-300)]">
                        {Math.round((s.durationSec ?? 0) / 60)}m {s.mode}
                        {s.focusScore != null && <span className="ml-2 text-[var(--palette-zinc-500)]">score {Math.round(s.focusScore)}</span>}
                      </span>
                      <span className="text-[11px] text-[var(--palette-zinc-600)]">
                        {s.completedAt ? new Date(s.completedAt).toLocaleString() : s.sessionStatus ?? ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="flex items-center gap-1.5 text-[11px] text-[var(--palette-zinc-600)]">
              <ShieldAlert size={11} /> All changes are logged server-side. Deleting users is available from the Users table.
            </p>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-[var(--palette-zinc-500)]">Could not load this user.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 px-3 py-2 text-center">
      <p className="text-sm font-bold text-[var(--palette-zinc-200)]">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-[var(--palette-zinc-500)]">{label}</p>
    </div>
  );
}
