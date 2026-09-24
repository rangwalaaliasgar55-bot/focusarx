import { useCallback, useEffect, useState } from "react";
import { Crown, Eye, Rocket, Sparkles, Trash2 } from "lucide-react";
import { adminFetch } from "./AdminHelpers";
import { cn } from "@/lib/utils";

/**
 * The battle-pass season builder.
 *
 * The panel above this one used to show a static card — "Season 1 / 1,000 XP per
 * Tier / 50 Tiers" — under the heading "Season Configuration", and the
 * battle-pass page advertised a "draft → preview → publish → rollback" builder
 * that did not exist anywhere. An admin who wanted a new season had to write
 * rows into `battle_passes` and `battle_pass_rewards` by hand.
 *
 * This is the real thing, against `routes/adminBattlePass.ts`:
 *   • **Preview** generates the exact tier table publishing will write (the
 *     generator is pure, so the preview cannot lie) and writes nothing.
 *   • **Create as draft** stores the season inactive; **Publish now** makes it
 *     the live pass in the same transaction.
 *   • **Publish** on an older season is the rollback — one operation, one code
 *     path, so a rollback cannot rot from disuse.
 *   • **Delete** is offered only for drafts; the live pass is refused server-side
 *     as well, because deleting it would strip every student's progress context.
 */
interface SeasonRow {
  id: string;
  season: string;
  title: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  tierCount: number;
}

interface PreviewTier {
  tier: number;
  xpRequired: number;
  free: string;
  premium: string;
  premiumCosmetic: string | null;
}

export function AdminBattlePassBuilder({ authHeaders }: { authHeaders: () => Record<string, string> }) {
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [season, setSeason] = useState(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const [title, setTitle] = useState("");
  const [tierCount, setTierCount] = useState(30);
  const [activate, setActivate] = useState(false);
  const [preview, setPreview] = useState<PreviewTier[] | null>(null);

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await adminFetch(path, {
        ...init,
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "The admin service refused that request.");
      return body as Record<string, unknown>;
    },
    [authHeaders],
  );

  const load = useCallback(async () => {
    try {
      const body = await call("/api/admin/battle-pass");
      setSeasons((body.seasons as SeasonRow[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load seasons");
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  const runPreview = async () => {
    setBusy("preview");
    setError(null);
    setMessage(null);
    try {
      const body = await call("/api/admin/battle-pass/preview", {
        method: "POST",
        body: JSON.stringify({ tierCount, season: season || undefined }),
      });
      setPreview((body.tiers as PreviewTier[]) ?? []);
      setMessage(`Previewed ${body.tierCount} tiers. Publishing will write exactly this table.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    setBusy("create");
    setError(null);
    setMessage(null);
    try {
      const body = await call("/api/admin/battle-pass", {
        method: "POST",
        body: JSON.stringify({ season, title: title || `${season} Season`, tierCount, activate }),
      });
      setMessage(String(body.next ?? "Season created."));
      setPreview(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the season");
    } finally {
      setBusy(null);
    }
  };

  const publish = async (id: string) => {
    setBusy(id);
    setError(null);
    setMessage(null);
    try {
      const body = await call(`/api/admin/battle-pass/${id}/activate`, { method: "POST" });
      setMessage(String(body.message ?? "Published."));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish that season");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    setError(null);
    setMessage(null);
    try {
      await call(`/api/admin/battle-pass/${id}`, { method: "DELETE" });
      setMessage("Draft deleted.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete that draft");
    } finally {
      setBusy(null);
    }
  };

  const field = "h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 text-sm text-[var(--foreground)]";

  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
            <Sparkles size={13} /> Introduce a season
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--foreground-subtle)]">
            30 tiers, a free track of coins and XP, a premium track of Focus Tokens and a cosmetic on every
            milestone tier. Preview before you publish — the preview is generated by the same code that writes it.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">Season id</span>
          <input className={field} value={season} onChange={(e) => setSeason(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="2026-10" />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">Title</span>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Monsoon Focus" maxLength={80} />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">Tiers</span>
          <input
            className={field}
            type="number"
            min={10}
            max={50}
            value={tierCount}
            onChange={(e) => setTierCount(Math.min(50, Math.max(10, Number(e.target.value) || 30)))}
          />
        </label>
        <label className="flex items-end gap-2 pb-1 text-xs text-[var(--foreground-muted)]">
          <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} className="h-4 w-4" />
          Publish immediately
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void runPreview()}
          disabled={busy !== null}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 text-xs font-semibold text-[var(--foreground-muted)] disabled:opacity-50"
        >
          <Eye size={13} /> {busy === "preview" ? "Previewing…" : "Preview tiers"}
        </button>
        <button
          type="button"
          onClick={() => void create()}
          disabled={busy !== null}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--brand-strong)] px-4 text-xs font-semibold text-[var(--neutral-0)] disabled:opacity-50"
        >
          <Rocket size={13} /> {busy === "create" ? "Creating…" : activate ? "Create and publish" : "Create as draft"}
        </button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">{error}</p>}
      {message && <p role="status" className="mt-3 rounded-lg border border-[var(--success)]/40 bg-[var(--success-soft)] px-3 py-2 text-xs text-[var(--foreground-muted)]">{message}</p>}

      {preview && (
        <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-[var(--surface-2)] text-[var(--foreground-subtle)]">
              <tr>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">XP</th>
                <th className="px-3 py-2">Free</th>
                <th className="px-3 py-2">Premium</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((tier) => (
                <tr key={tier.tier} className={cn("border-t border-[var(--border-subtle)]", tier.premiumCosmetic && "bg-[var(--surface-2)]")}>
                  <td className="px-3 py-1.5 tabular-nums">{tier.tier}</td>
                  <td className="px-3 py-1.5 tabular-nums">{tier.xpRequired.toLocaleString()}</td>
                  <td className="px-3 py-1.5">{tier.free}</td>
                  <td className="px-3 py-1.5">
                    {tier.premium}
                    {tier.premiumCosmetic && <Crown size={11} className="ml-1 inline text-[var(--brand-gold)]" aria-label="exclusive cosmetic" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">Seasons</p>
        {loading ? (
          <p className="mt-2 text-xs text-[var(--foreground-subtle)]">Loading seasons…</p>
        ) : seasons.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--foreground-muted)]">
            No season has been published yet — students are seeing the built-in default pass. Introducing one replaces it.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {seasons.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-xs">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", row.isActive ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface-hover)] text-[var(--foreground-subtle)]")}>
                  {row.isActive ? "live" : "draft"}
                </span>
                <span className="font-semibold text-[var(--foreground)]">{row.title}</span>
                <span className="text-[var(--foreground-subtle)]">{row.season} · {row.tierCount} tiers · ends {new Date(row.endDate).toLocaleDateString()}</span>
                <span className="ml-auto flex gap-2">
                  {!row.isActive && (
                    <button
                      type="button"
                      onClick={() => void publish(row.id)}
                      disabled={busy !== null}
                      className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[var(--brand-strong)] px-3 text-[11px] font-semibold text-[var(--neutral-0)] disabled:opacity-50"
                    >
                      <Rocket size={11} /> {busy === row.id ? "Publishing…" : "Publish"}
                    </button>
                  )}
                  {!row.isActive && (
                    <button
                      type="button"
                      onClick={() => void remove(row.id)}
                      disabled={busy !== null}
                      className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[var(--border-subtle)] px-3 text-[11px] font-semibold text-[var(--foreground-muted)] disabled:opacity-50"
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
