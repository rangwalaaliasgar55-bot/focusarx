import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Crown, Rocket, Search, Undo2 } from "lucide-react";
import { adminFetch, Badge, EmptyState, LoadingState, SectionHeader } from "./AdminHelpers";

/**
 * Release pipeline for staged pets.
 *
 * The catalog of candidates lives in server code (api-server's petStaging
 * module); this panel browses it and performs the two deliberate acts —
 * release into the live catalog, pull back out. Fan-use entries (Pokémon)
 * are gated behind an explicit IP-review checkbox that mirrors the server's
 * own 412 gate, and pets that anyone has adopted cannot be pulled at all.
 */

interface PetSource {
  id: string;
  title: string;
  url: string;
  verdict: "staged" | "rejected" | "mechanics-reference";
  stagedCount: number;
  license: string;
  summary: string;
}

interface StagedEntry {
  slug: string;
  name: string;
  description: string;
  style: "2d" | "3d";
  gen: number;
  dex: number;
  kind: "species" | "form";
  license: string;
  spriteUrl: string;
  released: boolean;
}

interface ReleasesResponse {
  sources: PetSource[];
  total: number;
  page: number;
  pageSize: number;
  entries: StagedEntry[];
}

const RARITIES = ["common", "rare", "epic", "legendary", "exclusive"] as const;
const CATEGORIES = ["starter", "free", "achievement", "premium", "seasonal", "event", "legendary", "exclusive", "admin_drop"] as const;

interface ReleaseOptions {
  rarity: (typeof RARITIES)[number];
  category: (typeof CATEGORIES)[number];
  tokenCost: number;
  isPremium: boolean;
  confirmIpReview: boolean;
}

const DEFAULT_OPTIONS: ReleaseOptions = { rarity: "rare", category: "event", tokenCost: 0, isPremium: false, confirmIpReview: false };

const VERDICT_BADGE: Record<PetSource["verdict"], { label: string; color: string }> = {
  staged: { label: "Staged", color: "bg-[var(--palette-violet-950)] text-[var(--palette-violet-400)]" },
  rejected: { label: "Rejected", color: "bg-[var(--palette-red-950)] text-[var(--palette-red-400)]" },
  "mechanics-reference": { label: "Mechanics reference", color: "bg-[var(--palette-blue-950)] text-[var(--palette-blue-400)]" },
};

export function AdminPetReleases() {
  const [data, setData] = useState<ReleasesResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [gen, setGen] = useState<"all" | number>("all");
  const [style, setStyle] = useState<"all" | "2d" | "3d">("all");
  const [released, setReleased] = useState<"all" | "staged" | "released">("all");
  const [page, setPage] = useState(1);

  const [releaseTarget, setReleaseTarget] = useState<StagedEntry | null>(null);
  const [pullTarget, setPullTarget] = useState<StagedEntry | null>(null);
  const [options, setOptions] = useState<ReleaseOptions>(DEFAULT_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (gen !== "all") params.set("gen", String(gen));
    if (style !== "all") params.set("style", style);
    if (released !== "all") params.set("released", String(released === "released"));
    params.set("page", String(page));
    const res = await adminFetch(`/api/admin/pets/releases?${params.toString()}`, { credentials: "include" });
    if (!res.ok) {
      setLoadFailed(true);
      setLoading(false);
      return;
    }
    setData(await res.json());
    setLoading(false);
  }, [q, gen, style, released, page]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const totalPages = useMemo(() => (data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1), [data]);

  const openRelease = (entry: StagedEntry) => {
    setOptions(DEFAULT_OPTIONS);
    setMessage(null);
    setReleaseTarget(entry);
    setPullTarget(null);
  };

  const openPull = (entry: StagedEntry) => {
    setMessage(null);
    setPullTarget(entry);
    setReleaseTarget(null);
  };

  const closeModal = () => {
    setReleaseTarget(null);
    setPullTarget(null);
    setMessage(null);
  };

  const doRelease = async () => {
    if (!releaseTarget) return;
    setBusy(true);
    setMessage(null);
    const res = await adminFetch(`/api/admin/pets/releases/${encodeURIComponent(releaseTarget.slug)}/release`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setMessage(body?.detail ?? body?.error ?? "Release failed");
      return;
    }
    closeModal();
    void load();
  };

  const doPull = async () => {
    if (!pullTarget) return;
    setBusy(true);
    setMessage(null);
    const res = await adminFetch(`/api/admin/pets/releases/${encodeURIComponent(pullTarget.slug)}/pull`, {
      method: "POST",
      credentials: "include",
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setMessage(body?.error ?? "Pull failed");
      return;
    }
    closeModal();
    void load();
  };

  const target = releaseTarget ?? pullTarget;
  const needsIpGate = target?.license === "fan-use";

  return (
    <div className="space-y-5">
      <SectionHeader title="Pet release pipeline" sub="Candidates staged from external sources — release them into the live catalog when there is time." />

      {/* Source verdicts */}
      {data && (
        <div className="grid gap-3 lg:grid-cols-3">
          {data.sources.map((source) => {
            const badge = VERDICT_BADGE[source.verdict];
            return (
              <div key={source.id} className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-4">
                <div className="flex items-start justify-between gap-2">
                  <a href={source.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[var(--palette-zinc-200)] underline-offset-2 hover:underline">
                    {source.title}
                  </a>
                  <Badge label={badge.label} color={badge.color} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--palette-zinc-500)]">{source.summary}</p>
                <p className="mt-2 text-[11px] text-[var(--palette-zinc-600)]">
                  {source.stagedCount > 0 ? `${source.stagedCount} staged · ` : ""}license: {source.license}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* IP banner — the one thing an admin must not miss on this panel. */}
      <div className="flex items-start gap-3 rounded-xl border border-[var(--palette-amber-500)]/30 bg-[var(--palette-amber-500)]/10 p-4">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--palette-amber-400)]" />
        <p className="text-xs leading-relaxed text-[var(--palette-zinc-300)]">
          Staged Pokémon sprites are <strong>© Nintendo / Game Freak / Creatures Inc.</strong> — upstream tags them non-commercial fan use.
          Releasing one requires the per-release IP-review confirmation below and is logged. If FocusArx monetises pets, get legal sign-off or ship original creatures instead.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--palette-zinc-500)]" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search name or slug…"
            aria-label="Search staged pets"
            className="w-56 rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)] py-2 pl-8 pr-3 text-xs text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]/60"
          />
        </div>
        <select value={gen === "all" ? "all" : String(gen)} onChange={(e) => { setGen(e.target.value === "all" ? "all" : Number(e.target.value)); setPage(1); }} aria-label="Filter by generation" className="rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)] px-3 py-2 text-xs text-[var(--palette-zinc-200)]">
          <option value="all">All gens</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => <option key={g} value={g}>Gen {g}</option>)}
        </select>
        <select value={style} onChange={(e) => { setStyle(e.target.value as typeof style); setPage(1); }} aria-label="Filter by sprite style" className="rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)] px-3 py-2 text-xs text-[var(--palette-zinc-200)]">
          <option value="all">2D + 3D</option>
          <option value="2d">2D pixel art</option>
          <option value="3d">3D animated</option>
        </select>
        <select value={released} onChange={(e) => { setReleased(e.target.value as typeof released); setPage(1); }} aria-label="Filter by release status" className="rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)] px-3 py-2 text-xs text-[var(--palette-zinc-200)]">
          <option value="all">Staged + released</option>
          <option value="staged">Staged only</option>
          <option value="released">Released only</option>
        </select>
        {data && <span className="ml-auto text-xs text-[var(--palette-zinc-500)]">{data.total.toLocaleString()} candidates</span>}
      </div>

      {/* List */}
      {loadFailed ? (
        <EmptyState title="Could not load the staging manifest" description="The release pipeline could not be reached. Nothing was changed." action={<button onClick={() => void load()} className="rounded-lg bg-[var(--palette-violet-600)] px-4 py-2 text-xs font-semibold text-white">Retry</button>} />
      ) : loading && !data ? (
        <LoadingState text="Loading staged pets…" />
      ) : data && data.entries.length === 0 ? (
        <EmptyState title="No staged pets match" description="Try clearing the search or filters." />
      ) : data ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--palette-zinc-800)]/80">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/60 text-[var(--palette-zinc-500)]">
                <th className="px-4 py-2.5 font-medium">Pet</th>
                <th className="px-4 py-2.5 font-medium">Gen</th>
                <th className="px-4 py-2.5 font-medium">Style</th>
                <th className="px-4 py-2.5 font-medium">License</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry) => (
                <tr key={entry.slug} className="border-b border-[var(--palette-zinc-800)]/60 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <img src={entry.spriteUrl} alt="" aria-hidden="true" width={40} height={40} loading="lazy" referrerPolicy="no-referrer" className="h-10 w-10 rounded-lg bg-[var(--palette-zinc-900)] object-contain [image-rendering:pixelated]" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--palette-zinc-200)]">{entry.name}</p>
                        <p className="truncate text-[11px] text-[var(--palette-zinc-600)]">{entry.slug} · #{entry.dex}{entry.kind === "form" ? " · form" : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--palette-zinc-400)]">{entry.gen}</td>
                  <td className="px-4 py-2.5 text-[var(--palette-zinc-400)]">{entry.style === "2d" ? "2D pixel" : "3D anim"}</td>
                  <td className="px-4 py-2.5 text-[var(--palette-zinc-400)]">{entry.license}</td>
                  <td className="px-4 py-2.5">
                    {entry.released
                      ? <span className="inline-flex items-center gap-1 text-[var(--palette-emerald-400)]"><CheckCircle2 size={13} /> Released</span>
                      : <span className="text-[var(--palette-zinc-500)]">Staged</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {entry.released ? (
                      <button onClick={() => openPull(entry)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-[11px] font-semibold text-[var(--palette-zinc-300)] hover:bg-[var(--palette-zinc-800)]">
                        <Undo2 size={12} /> Pull
                      </button>
                    ) : (
                      <button onClick={() => openRelease(entry)} className="inline-flex items-center gap-1 rounded-lg bg-[var(--palette-violet-600)] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[var(--palette-violet-500)]">
                        <Rocket size={12} /> Release…
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Pagination */}
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 rounded-lg border border-[var(--palette-zinc-800)] px-3 py-1.5 text-xs text-[var(--palette-zinc-300)] disabled:opacity-40">
            <ArrowLeft size={13} /> Prev
          </button>
          <span className="text-xs text-[var(--palette-zinc-500)]">Page {data.page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="inline-flex items-center gap-1 rounded-lg border border-[var(--palette-zinc-800)] px-3 py-1.5 text-xs text-[var(--palette-zinc-300)] disabled:opacity-40">
            Next <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Release / pull modal */}
      {target && (
        <div className="fixed inset-0 z-[var(--z-modal)] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={releaseTarget ? `Release ${target.name}` : `Pull ${target.name}`}>
          {/* A full-area dismiss button instead of a bare onClick on the backdrop: a
              pointer-only dismiss is unreachable from the keyboard (axe flags both). */}
          <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={closeModal} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-md rounded-2xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)] p-5"
          >
            <div className="flex items-center gap-3">
              <img src={target.spriteUrl} alt="" aria-hidden="true" width={56} height={56} referrerPolicy="no-referrer" className="h-14 w-14 rounded-xl bg-[var(--palette-zinc-900)] object-contain [image-rendering:pixelated]" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
              <div>
                <h3 className="text-sm font-bold text-[var(--palette-zinc-100)]">{releaseTarget ? "Release" : "Pull"} {target.name}</h3>
                <p className="text-[11px] text-[var(--palette-zinc-500)]">{target.slug} · Gen {target.gen} · {target.style === "2d" ? "2D pixel art" : "3D animated"} · {target.license}</p>
              </div>
            </div>

            {releaseTarget && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-medium text-[var(--palette-zinc-400)]">
                    Rarity
                    <select value={options.rarity} onChange={(e) => setOptions((o) => ({ ...o, rarity: e.target.value as ReleaseOptions["rarity"] }))} className="mt-1 w-full rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)] px-2 py-2 text-xs text-[var(--palette-zinc-200)]">
                      {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <label className="text-[11px] font-medium text-[var(--palette-zinc-400)]">
                    Category
                    <select value={options.category} onChange={(e) => setOptions((o) => ({ ...o, category: e.target.value as ReleaseOptions["category"] }))} className="mt-1 w-full rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)] px-2 py-2 text-xs text-[var(--palette-zinc-200)]">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="text-[11px] font-medium text-[var(--palette-zinc-400)]">
                    Token cost
                    <input type="number" min={0} value={options.tokenCost} onChange={(e) => setOptions((o) => ({ ...o, tokenCost: Math.max(0, Number(e.target.value) || 0) }))} className="mt-1 w-full rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)] px-2 py-2 text-xs text-[var(--palette-zinc-200)]" />
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-[11px] font-medium text-[var(--palette-zinc-400)]">
                    <input type="checkbox" checked={options.isPremium} onChange={(e) => setOptions((o) => ({ ...o, isPremium: e.target.checked }))} className="h-4 w-4" />
                    <span className="inline-flex items-center gap-1"><Crown size={12} className="text-[var(--palette-amber-400)]" /> Premium-only</span>
                  </label>
                </div>

                {needsIpGate && (
                  <label className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--palette-amber-500)]/30 bg-[var(--palette-amber-500)]/10 p-3 text-[11px] leading-relaxed text-[var(--palette-zinc-300)]">
                    <input type="checkbox" checked={options.confirmIpReview} onChange={(e) => setOptions((o) => ({ ...o, confirmIpReview: e.target.checked }))} className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>I confirm IP review for this Pokémon character. It is © Nintendo / Game Freak / Creatures Inc.; I accept responsibility for publishing fan-use content.</span>
                  </label>
                )}
              </>
            )}

            {pullTarget && (
              <p className="mt-4 rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/60 p-3 text-xs leading-relaxed text-[var(--palette-zinc-400)]">
                Pulling removes {target.name} from the live catalog. The server refuses if anyone has adopted it — user companions are never deleted by a pull.
              </p>
            )}

            {message && <p className="mt-3 rounded-lg bg-[var(--palette-rose-500)]/10 p-2.5 text-[11px] text-[var(--palette-rose-300)]">{message}</p>}

            <div className="mt-5 flex gap-2">
              <button onClick={closeModal} className="flex-1 rounded-xl border border-[var(--palette-zinc-800)] py-2.5 text-xs font-bold text-[var(--palette-zinc-300)]">Cancel</button>
              {releaseTarget ? (
                <button
                  onClick={() => void doRelease()}
                  disabled={busy || (needsIpGate && !options.confirmIpReview)}
                  className="flex-1 rounded-xl bg-[var(--palette-violet-600)] py-2.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  {busy ? "Releasing…" : "Release to catalog"}
                </button>
              ) : (
                <button onClick={() => void doPull()} disabled={busy} className="flex-1 rounded-xl bg-[var(--palette-rose-600)] py-2.5 text-xs font-bold text-white disabled:opacity-40">
                  {busy ? "Pulling…" : "Pull from catalog"}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
