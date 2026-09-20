import { useCallback, useEffect, useState } from "react";
import { MotionTab, SectionHeader, adminFetch } from "@/components/admin/AdminHelpers";

// ─── Types ──────────────────────────────────────────────────────────────────

type FeatureFlag = {
  key: string;
  description: string | null;
  rolloutPercentage: number;
  enabled: boolean;
};

// ─── Panel ──────────────────────────────────────────────────────────────────

/**
 * Developer controls. The backend already accepted flag upserts
 * (POST /admin/feature-flags) but this panel only *displayed* flags — there
 * was no way to flip or create one without the SQL editor. Both actions are
 * now first-class: every flip is an upsert, so a brand-new key typed into
 * "New flag" becomes a real flag the moment it is created.
 */
export function AdminFlagsPanel({ authHeaders }: { authHeaders: () => Record<string, string> }) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    try {
      const r = await adminFetch("/api/admin/feature-flags", { headers: authHeaders(), credentials: "include" });
      if (r.ok) { const d = await r.json(); setFlags(d.flags ?? []); }
    } finally { setLoading(false); }
  }, [authHeaders]);

  useEffect(() => { void loadFlags(); }, [loadFlags]);

  /** Upsert a flag (create or flip) and reflect the server's answer. */
  const upsert = async (key: string, enabled: boolean, description?: string) => {
    setBusyKey(key); setMessage(null);
    try {
      const r = await adminFetch("/api/admin/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ key, enabled, description }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMessage(`Error: ${d.error ?? "Failed to update flag"}`);
        return;
      }
      const d = await r.json();
      const flag = d.flag as FeatureFlag;
      setFlags((prev) => {
        const i = prev.findIndex((f) => f.key === flag.key);
        if (i === -1) return [...prev, flag].sort((a, b) => a.key.localeCompare(b.key));
        const next = [...prev];
        next[i] = flag;
        return next;
      });
      setMessage(`${flag.key} is now ${flag.enabled ? "ON" : "OFF"}.`);
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : "Request failed"}`);
    } finally {
      setBusyKey(null);
    }
  };

  /**
   * Delete a flag row. Every consumer fails open, so deleting a flag restores
   * the shipped default rather than breaking anything — which is exactly why
   * this is a hard delete and not a soft "off".
   */
  const removeFlag = async (key: string) => {
    setBusyKey(key);
    setMessage(null);
    try {
      const r = await adminFetch(`/api/admin/feature-flags/${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: authHeaders(),
        credentials: "include",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMessage(`Error: ${d.error ?? "Failed to delete flag"}`); return; }
      setFlags((prev) => prev.filter((f) => f.key !== key));
      setMessage(`Deleted ${key} — consumers fall back to the default (on).`);
    } finally { setBusyKey(null); }
  };

  const createFlag = () => {
    const key = newKey.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key) return;
    void upsert(key, true, newDescription.trim() || undefined);
    setNewKey("");
    setNewDescription("");
  };

  return (
    <MotionTab>
      <SectionHeader title="Feature Flags" sub="Developer controls — flip a rollout switch or register a new flag; changes apply immediately." />
      {loading ? <p className="text-xs text-[var(--palette-zinc-500)]">Loading…</p> : (
        <div className="grid gap-2 sm:grid-cols-2">
          {flags.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{f.key}</p>
                <p className="text-[11px] text-[var(--palette-zinc-500)]">{f.description ?? ""} • rollout {f.rolloutPercentage}%</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={f.enabled}
                aria-label={`Toggle ${f.key}`}
                disabled={busyKey === f.key}
                onClick={() => void upsert(f.key, !f.enabled)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${f.enabled ? "bg-[var(--palette-emerald-600)]" : "bg-[var(--palette-zinc-700)]"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--palette-white)] transition-transform ${f.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
              <button
                type="button"
                aria-label={`Delete ${f.key}`}
                title={f.key === "gemini_auto_publish" ? "Protected — set enabled=false instead" : "Delete this flag"}
                disabled={busyKey === f.key || f.key === "gemini_auto_publish"}
                onClick={() => void removeFlag(f.key)}
                className="shrink-0 rounded-lg border border-[var(--palette-rose-900)]/70 px-2 py-1 text-[11px] font-semibold text-[var(--palette-rose-400)] transition hover:bg-[var(--palette-rose-950)]/50 disabled:opacity-30"
              >
                Delete
              </button>
            </div>
          ))}
          {flags.length === 0 && (
            <p className="text-xs text-[var(--palette-zinc-500)]">
              No flags stored yet — everything below is live and defaults to ON. Create one to start controlling it.
            </p>
          )}
        </div>
      )}

      {/* New flag — the developer escape hatch for wiring unreleased work. */}
      <div className="mt-4 rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/20 p-4">
        <p className="text-xs font-semibold">New flag</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="adminflags-new-key">Flag key</label>
          <input
            id="adminflags-new-key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="flag_key (e.g. developer_mode)"
            className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)] sm:max-w-xs"
          />
          <label className="sr-only" htmlFor="adminflags-new-description">Description</label>
          <input
            id="adminflags-new-description"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="What it controls (optional)"
            className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]"
          />
          <button
            type="button"
            onClick={createFlag}
            disabled={!newKey.trim() || busyKey !== null}
            className="shrink-0 rounded-lg bg-[var(--palette-violet-600)] px-4 py-2 text-sm font-semibold text-[var(--palette-white)] transition hover:bg-[var(--palette-violet-500)] disabled:opacity-50"
          >
            Create ON
          </button>
        </div>
        {message && (
          <p className={`mt-2 text-xs ${message.startsWith("Error") ? "text-[var(--palette-rose-400)]" : "text-[var(--palette-emerald-400)]"}`}>{message}</p>
        )}
      </div>

      {/* Which keys actually do something. A flag with no consumer is a lie,
          so the panel states plainly what each wired key controls today. */}
      <div className="mt-4 rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/20 p-4">
        <p className="text-xs font-semibold">Flags wired into the product</p>
        <ul className="mt-2 space-y-1 text-[11px] text-[var(--palette-zinc-500)]">
          <li><code className="text-[var(--palette-zinc-300)]">lootboxes</code> — hides the Loot Boxes page and its link; the page explains it is paused.</li>
          <li><code className="text-[var(--palette-zinc-300)]">leaderboard</code> — removes Leaderboard from the navigation.</li>
          <li><code className="text-[var(--palette-zinc-300)]">community</code> — removes Community from the navigation.</li>
          <li><code className="text-[var(--palette-zinc-300)]">gemini_auto_publish</code> — ON by default; this row is the off switch for auto-publishing approved ideas.</li>
        </ul>
        <p className="mt-2 text-[11px] text-[var(--palette-zinc-500)]">Unknown keys are safe: every consumer fails open, so a flag nobody reads can never hide a feature.</p>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/20 p-4">
        <p className="text-xs font-semibold">Content tools</p>
        <p className="mt-1 text-[11px] text-[var(--palette-zinc-500)]">Pets / cosmetics / buildings / themes / sounds / quests / battle passes / announcements / token rewards — use respective tabs (marketplace, pets, quests, battlepass, city, notify, tokens) for CRUD. Asset catalog for 3D models, thumbnails, etc. is at /api/assets/catalog.</p>
      </div>
    </MotionTab>
  );
}
