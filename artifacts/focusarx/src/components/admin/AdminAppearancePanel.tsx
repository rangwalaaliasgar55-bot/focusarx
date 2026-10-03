import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Lock, LockOpen, Palette, RotateCcw, Save, Search, Sword, Users } from "lucide-react";
import {
  AdminCard,
  EmptyState,
  LoadingState,
  MotionTab,
  QuickActionButton,
  SectionHeader,
  StatCard,
  adminFetch,
} from "./AdminHelpers";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { cupLabel } from "@/lib/arenaLadder";
import {
  BATTLE_DESIGNS,
  LAYOUTS,
  PET_DESIGNS,
  TIMER_FACE_LABELS,
  type AppearanceField,
} from "@/lib/designPacks";
import { TIMER_THEMES } from "@/lib/timerTheme";
import type { AdminPanelProps } from "./AdminTypes";

/**
 * Design packs in the console — the answer to "which design is this account on,
 * and who put it there".
 *
 * The console could not previously answer that at all: the timer face lived in
 * the user's `localStorage` and the art packs were build flags. Now the
 * assignment is a row (see `lib/db/src/schema/appearance.ts`), and this panel is
 * the reader and the writer:
 *
 *   • **the table** lists every account with its four assignments, whether the
 *     row came from the user, an admin, or the defaults, and whether it is
 *     pinned;
 *   • **per-account editing** sets any field and optionally pins it. "Assign but
 *     leave them free" is a first-class action (the lock is tri-state), because
 *     an A/B cohort is the common case and it must not accidentally lock people;
 *   • **bulk** applies a pack to a chosen set or to everyone, and the console
 *     runs the dry run first so the blast radius is on screen before the write;
 *   • **battle usage** shows which board is actually being played, from the
 *     battle log rather than from the assignments — the difference between what
 *     was set and what is used is exactly the thing worth seeing.
 *
 * Every write goes through `PUT/POST /api/admin/appearance*`, which validates
 * against the server catalog and records an audit entry with the actor.
 */

interface AppearanceRow {
  userId: string;
  name: string | null;
  email: string | null;
  assigned: boolean;
  locked: boolean;
  source: "user" | "admin" | "default";
  updatedBy: string | null;
  updatedAt: string | null;
  appearance: { timerFace: string; petDesign: string; battleDesign: string; layout: string };
  labels: { timerFace: string; petDesign: string; battleDesign: string; layout: string };
}

interface Distribution {
  timerFace: Record<string, number>;
  petDesign: Record<string, number>;
  battleDesign: Record<string, number>;
  layout: Record<string, number>;
  locked: number;
  unassigned: number;
}

interface BattleUsageRow {
  design: string;
  battles: number;
  wins: number;
  players: number;
}

interface BattleLogRow {
  id: string;
  userId: string;
  userName: string | null;
  petSlug: string;
  petName: string | null;
  petLevel: number;
  rivalName: string;
  rivalLevel: number;
  design: string;
  result: string;
  rounds: number;
  /** Arena cup, or null for a pick-up fight. */
  stage: number | null;
  createdAt: string;
}

interface Draft {
  timerFace: string;
  petDesign: string;
  battleDesign: string;
  layout: string;
  locked: boolean;
}

const selectCls =
  "w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-2 py-1.5 text-[11px] text-[var(--palette-zinc-100)] outline-none focus:border-[var(--palette-sky-600)]";

function toDraft(row: AppearanceRow): Draft {
  return { ...row.appearance, locked: row.locked };
}

export function AdminAppearancePanel({ authHeaders }: AdminPanelProps) {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [rows, setRows] = useState<AppearanceRow[] | null>(null);
  const [distribution, setDistribution] = useState<Distribution | null>(null);
  const [battleUsage, setBattleUsage] = useState<BattleUsageRow[]>([]);
  const [battles, setBattles] = useState<BattleLogRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [bulk, setBulk] = useState<{ timerFace: string; petDesign: string; battleDesign: string; layout: string; locked: boolean }>({
    timerFace: "classic",
    petDesign: "wild3d",
    battleDesign: "duel",
    layout: "quiet",
    locked: false,
  });
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(
    async (query = "") => {
      try {
        const url = `/api/admin/appearance?limit=50${query ? `&search=${encodeURIComponent(query)}` : ""}`;
        const [listRes, logRes] = await Promise.all([
          adminFetch(url, { headers: authHeaders(), credentials: "include" }),
          adminFetch("/api/admin/appearance/battles?limit=10", { headers: authHeaders(), credentials: "include" }),
        ]);
        if (listRes.ok) {
          const data = (await listRes.json()) as { users?: AppearanceRow[]; distribution?: Distribution; battleUsage?: BattleUsageRow[] };
          setRows(data.users ?? []);
          setDistribution(data.distribution ?? null);
          setBattleUsage(data.battleUsage ?? []);
          setDrafts({});
        }
        if (logRes.ok) {
          const data = (await logRes.json()) as { battles?: BattleLogRow[] };
          setBattles(data.battles ?? []);
        }
      } finally {
        setLoading(false);
      }
    },
    [authHeaders],
  );

  useEffect(() => {
    // `loading` starts true and `load` clears it in its `finally`; no
    // synchronous setState here, which keeps the mount free of a cascading
    // render (and the admin shell's spinner honest).
    void load();
  }, [load]);

  /** A user-triggered reload: the spinner is state the click owns. */
  const reload = useCallback(
    (query = "") => {
      setLoading(true);
      return load(query);
    },
    [load],
  );

  const save = useCallback(
    async (row: AppearanceRow) => {
      const draft = drafts[row.userId] ?? toDraft(row);
      setBusyUserId(row.userId);
      try {
        const res = await adminFetch(`/api/admin/appearance/${row.userId}`, {
          method: "PUT",
          headers: authHeaders(),
          credentials: "include",
          body: JSON.stringify({
            timerFace: draft.timerFace,
            petDesign: draft.petDesign,
            battleDesign: draft.battleDesign,
            layout: draft.layout,
            locked: draft.locked,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast(`Design saved — ${row.name ?? row.email ?? row.userId} updated.`, "success");
        await reload(search);
      } catch (err) {
        toast(`Could not save the design — ${err instanceof Error ? err.message : "try again."}`, "danger");
      } finally {
        setBusyUserId(null);
      }
    },
    [authHeaders, drafts, reload, search, toast],
  );

  const reset = useCallback(
    async (row: AppearanceRow) => {
      const ok = await confirm({
        title: "Reset this account's design?",
        description: `${row.name ?? row.email ?? row.userId} goes back to the defaults and the pin is released.`,
        confirmLabel: "Reset",
      });
      if (!ok) return;
      setBusyUserId(row.userId);
      try {
        const res = await adminFetch(`/api/admin/appearance/${row.userId}`, {
          method: "DELETE",
          headers: authHeaders(),
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast("Design reset to the defaults.", "success");
        await reload(search);
      } catch (err) {
        toast(`Could not reset — ${err instanceof Error ? err.message : "try again."}`, "danger");
      } finally {
        setBusyUserId(null);
      }
    },
    [authHeaders, confirm, reload, search, toast],
  );

  const applyBulk = useCallback(
    async (all: boolean) => {
      const ids = rows?.map((r) => r.userId) ?? [];
      if (!all && ids.length === 0) return;

      // Dry run first: "all users" is one click from a mistake, and the count is
      // the only thing that makes the decision reversible-before-the-fact.
      const scope = all ? "every real account" : `the ${ids.length} account(s) on this page`;
      try {
        const dryRes = await adminFetch("/api/admin/appearance/bulk", {
          method: "POST",
          headers: authHeaders(),
          credentials: "include",
          body: JSON.stringify({ all, userIds: all ? undefined : ids, ...bulk, dryRun: true }),
        });
        const dry = dryRes.ok ? ((await dryRes.json()) as { affected?: number }) : null;
        const ok = await confirm({
          title: `Apply to ${scope}?`,
          description: `This sets ${describeBulk(bulk)}${bulk.locked ? " and locks it" : ""} for ${dry?.affected ?? "?"} account(s).`,
          confirmLabel: "Apply",
        });
        if (!ok) return;
        setBulkBusy(true);
        const res = await adminFetch("/api/admin/appearance/bulk", {
          method: "POST",
          headers: authHeaders(),
          credentials: "include",
          body: JSON.stringify({ all, userIds: all ? undefined : ids, ...bulk }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { affected?: number };
        toast(`Bulk update applied to ${data.affected ?? 0} account(s).`, "success");
        await reload(search);
      } catch (err) {
        toast(`Bulk update failed — ${err instanceof Error ? err.message : "try again."}`, "danger");
      } finally {
        setBulkBusy(false);
      }
    },
    [authHeaders, bulk, confirm, reload, rows, search, toast],
  );

  const worstHolders = useMemo(() => {
    if (!distribution) return "";
    const top = Object.entries(distribution.timerFace)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id, count]) => `${TIMER_FACE_LABELS[id as keyof typeof TIMER_FACE_LABELS] ?? id} (${count})`);
    return top.join(", ");
  }, [distribution]);

  return (
    <MotionTab>
      <SectionHeader
        title="Design packs"
        sub="Which timer face, companion art, battle board and workspace layout each account renders — and who chose it."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatCard label="Accounts on this page" value={String(rows?.length ?? 0)} accent="violet" />
        <StatCard label="Pinned by admins" value={String(distribution?.locked ?? 0)} accent="amber" />
        <StatCard label="Still on defaults" value={String(distribution?.unassigned ?? 0)} />
        <StatCard label="Top timer faces" value={worstHolders || "—"} sub="page window" />
      </div>

      <AdminCard className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Find an account</span>
            <span className="relative">
              <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--palette-zinc-500)]" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") reload(search);
                }}
                placeholder="name or email"
                className={`${selectCls} pl-7`}
              />
            </span>
          </label>
          <QuickActionButton onClick={() => reload(search)} loading={loading}>
            Search
          </QuickActionButton>
          <QuickActionButton onClick={() => { setSearch(""); reload(""); }} disabled={loading}>
            Clear
          </QuickActionButton>
        </div>
      </AdminCard>

      {/* Bulk application */}
      <AdminCard className="mb-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--palette-zinc-200)]">
          <Users size={13} aria-hidden="true" /> Apply a design pack in bulk
        </p>
        <div className="grid gap-2 sm:grid-cols-5">
          <select className={selectCls} value={bulk.timerFace} onChange={(e) => setBulk((b) => ({ ...b, timerFace: e.target.value }))} aria-label="Timer face">
            {TIMER_THEMES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <select className={selectCls} value={bulk.petDesign} onChange={(e) => setBulk((b) => ({ ...b, petDesign: e.target.value }))} aria-label="Companion art">
            {PET_DESIGNS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <select className={selectCls} value={bulk.battleDesign} onChange={(e) => setBulk((b) => ({ ...b, battleDesign: e.target.value }))} aria-label="Battle board">
            {BATTLE_DESIGNS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <select className={selectCls} value={bulk.layout} onChange={(e) => setBulk((b) => ({ ...b, layout: e.target.value }))} aria-label="Layout">
            {LAYOUTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-[var(--palette-zinc-700)] px-2 py-1.5 text-[11px] text-[var(--palette-zinc-300)]">
            <input type="checkbox" checked={bulk.locked} onChange={(e) => setBulk((b) => ({ ...b, locked: e.target.checked }))} />
            Pin (lock)
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <QuickActionButton onClick={() => void applyBulk(false)} loading={bulkBusy} disabled={!rows || rows.length === 0}>
            Apply to page ({rows?.length ?? 0})
          </QuickActionButton>
          <QuickActionButton onClick={() => void applyBulk(true)} loading={bulkBusy} variant="danger">
            Apply to everyone
          </QuickActionButton>
          <span className="self-center text-[11px] text-[var(--palette-zinc-500)]">
            Guests and bot personas are always excluded. Every change is audited with your admin id.
          </span>
        </div>
      </AdminCard>

      {loading && !rows ? (
        <LoadingState text="Loading design assignments…" />
      ) : !rows || rows.length === 0 ? (
        <EmptyState title="No accounts matched" description="Try a shorter search — names and emails are matched anywhere." />
      ) : (
        <AdminCard className="mb-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[var(--palette-zinc-500)]">
                <th className="pb-2 pr-3">Account</th>
                <th className="pb-2 pr-3">Timer face</th>
                <th className="pb-2 pr-3">Companion</th>
                <th className="pb-2 pr-3">Battle board</th>
                <th className="pb-2 pr-3">Layout</th>
                <th className="pb-2 pr-3">Source</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const draft = drafts[row.userId] ?? toDraft(row);
                const dirty =
                  draft.timerFace !== row.appearance.timerFace ||
                  draft.petDesign !== row.appearance.petDesign ||
                  draft.battleDesign !== row.appearance.battleDesign ||
                  draft.layout !== row.appearance.layout ||
                  draft.locked !== row.locked;
                const set = (field: AppearanceField, value: string) =>
                  setDrafts((prev) => ({ ...prev, [row.userId]: { ...(prev[row.userId] ?? toDraft(row)), [field]: value } }));
                return (
                  <tr key={row.userId} className="border-t border-[var(--palette-zinc-800)] align-middle">
                    <td className="py-2 pr-3">
                      <p className="max-w-[200px] truncate text-xs font-semibold text-[var(--palette-zinc-200)]">{row.name ?? "—"}</p>
                      <p className="max-w-[200px] truncate text-[11px] text-[var(--palette-zinc-500)]">{row.email ?? row.userId}</p>
                    </td>
                    <td className="py-2 pr-3">
                      <select className={selectCls} value={draft.timerFace} onChange={(e) => set("timerFace", e.target.value)} aria-label={`Timer face for ${row.name ?? row.userId}`}>
                        {TIMER_THEMES.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <select className={selectCls} value={draft.petDesign} onChange={(e) => set("petDesign", e.target.value)} aria-label={`Companion art for ${row.name ?? row.userId}`}>
                        {PET_DESIGNS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <select className={selectCls} value={draft.battleDesign} onChange={(e) => set("battleDesign", e.target.value)} aria-label={`Battle board for ${row.name ?? row.userId}`}>
                        {BATTLE_DESIGNS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <select className={selectCls} value={draft.layout} onChange={(e) => set("layout", e.target.value)} aria-label={`Layout for ${row.name ?? row.userId}`}>
                        {LAYOUTS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1.5 text-[11px] text-[var(--palette-zinc-400)]">
                        {row.locked ? <Lock size={11} className="text-[var(--palette-amber-400)]" aria-hidden="true" /> : null}
                        {row.assigned ? row.source : "defaults"}
                      </span>
                      {row.updatedBy && <span className="block text-[11px] text-[var(--palette-zinc-600)]">by {row.updatedBy.slice(0, 8)}</span>}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void save(row)}
                          disabled={!dirty || busyUserId === row.userId}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[var(--palette-zinc-700)] px-2 py-1 text-[11px] font-semibold text-[var(--palette-zinc-200)] disabled:opacity-40"
                        >
                          {dirty ? <Save size={11} aria-hidden="true" /> : <Check size={11} aria-hidden="true" />}
                          {busyUserId === row.userId ? "Saving…" : dirty ? "Save" : "Saved"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDrafts((prev) => ({ ...prev, [row.userId]: { ...(prev[row.userId] ?? toDraft(row)), locked: !draft.locked } }))}
                          title={draft.locked ? "Unpin (the user can choose again)" : "Pin this design"}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[var(--palette-zinc-700)] px-2 py-1 text-[11px] font-semibold text-[var(--palette-zinc-300)]"
                        >
                          {draft.locked ? <Lock size={11} aria-hidden="true" /> : <LockOpen size={11} aria-hidden="true" />}
                          {draft.locked ? "Pinned" : "Pin"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void reset(row)}
                          disabled={busyUserId === row.userId || !row.assigned}
                          title="Reset to defaults"
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[var(--palette-zinc-700)] px-2 py-1 text-[11px] font-semibold text-[var(--palette-zinc-400)] disabled:opacity-40"
                        >
                          <RotateCcw size={11} aria-hidden="true" />
                          Reset
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminCard>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard>
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--palette-zinc-200)]">
            <Sword size={13} aria-hidden="true" /> Battle boards actually played
          </p>
          {battleUsage.length === 0 ? (
            <p className="text-[11px] text-[var(--palette-zinc-500)]">No battles recorded yet.</p>
          ) : (
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="text-[var(--palette-zinc-500)]">
                  <th className="pb-1">Board</th>
                  <th className="pb-1">Battles</th>
                  <th className="pb-1">Wins</th>
                  <th className="pb-1">Players</th>
                </tr>
              </thead>
              <tbody>
                {battleUsage.map((row) => (
                  <tr key={row.design} className="border-t border-[var(--palette-zinc-800)] text-[var(--palette-zinc-300)]">
                    <td className="py-1.5">{BATTLE_DESIGNS.find((d) => d.id === row.design)?.label ?? row.design}</td>
                    <td className="py-1.5 tabular-nums">{row.battles}</td>
                    <td className="py-1.5 tabular-nums">{row.wins}</td>
                    <td className="py-1.5 tabular-nums">{row.players}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AdminCard>

        <AdminCard>
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--palette-zinc-200)]">
            <Palette size={13} aria-hidden="true" /> Recent battles
          </p>
          {battles.length === 0 ? (
            <p className="text-[11px] text-[var(--palette-zinc-500)]">The arena has not been played yet.</p>
          ) : (
            <ul className="space-y-2 text-[11px] text-[var(--palette-zinc-400)]">
              {battles.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 border-t border-[var(--palette-zinc-800)] pt-1.5">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-[var(--palette-zinc-200)]">{b.petName ?? b.petSlug}</span> Lv {b.petLevel} vs{" "}
                    {b.rivalName} Lv {b.rivalLevel}
                    {/* Which cup, not just that a fight happened — the ladder's
                        progress is exactly what the assignment table cannot show. */}
                    {cupLabel(b.stage) && (
                      <span className="text-[var(--palette-zinc-500)]"> · {cupLabel(b.stage)}</span>
                    )}
                  </span>
                  <span className={b.result === "win" ? "text-[var(--palette-emerald-400)]" : "text-[var(--palette-rose-400)]"}>
                    {b.result} · {b.rounds}r · {BATTLE_DESIGNS.find((d) => d.id === b.design)?.label ?? b.design}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </MotionTab>
  );
}

function describeBulk(bulk: { timerFace: string; petDesign: string; battleDesign: string; layout: string }): string {
  const face = TIMER_FACE_LABELS[bulk.timerFace as keyof typeof TIMER_FACE_LABELS] ?? bulk.timerFace;
  const pet = PET_DESIGNS.find((d) => d.id === bulk.petDesign)?.label ?? bulk.petDesign;
  const battle = BATTLE_DESIGNS.find((d) => d.id === bulk.battleDesign)?.label ?? bulk.battleDesign;
  const layout = LAYOUTS.find((d) => d.id === bulk.layout)?.label ?? bulk.layout;
  return `${face} · ${pet} · ${battle} · ${layout}`;
}

export default AdminAppearancePanel;
