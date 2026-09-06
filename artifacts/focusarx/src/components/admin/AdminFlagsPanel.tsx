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

export function AdminFlagsPanel({ authHeaders }: { authHeaders: () => Record<string, string> }) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFlags = useCallback(async () => {
    try {
      const r = await adminFetch("/api/admin/feature-flags", { headers: authHeaders(), credentials: "include" });
      if (r.ok) { const d = await r.json(); setFlags(d.flags ?? []); }
    } finally { setLoading(false); }
  }, [authHeaders]);

  useEffect(() => { void loadFlags(); }, [loadFlags]);

  return (
    <MotionTab>
      <SectionHeader title="Feature Flags" sub="Control premium features rollout, asset catalog, seasonal events." />
      {loading ? <p className="text-xs text-[var(--palette-zinc-500)]">Loading…</p> : (
        <div className="grid gap-2 sm:grid-cols-2">
          {flags.map((f) => (
            <div key={f.key} className="flex items-center justify-between rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-4">
              <div>
                <p className="text-sm font-semibold">{f.key}</p>
                <p className="text-[11px] text-[var(--palette-zinc-500)]">{f.description ?? ""} • rollout {f.rolloutPercentage}%</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${f.enabled ? "bg-[var(--palette-emerald-950)] text-[var(--palette-emerald-400)]" : "bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-500)]"}`}>{f.enabled ? "ON" : "OFF"}</span>
            </div>
          ))}
          {flags.length === 0 && <p className="text-xs text-[var(--palette-zinc-500)]">No flags yet — defaults enabled: premium_timer_rituals, premium_analytics, premium_city_modes, pets_3d, battle_pass</p>}
        </div>
      )}
      <div className="mt-4 rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/20 p-4">
        <p className="text-xs font-semibold">Content tools</p>
        <p className="mt-1 text-[11px] text-[var(--palette-zinc-500)]">Pets / cosmetics / buildings / themes / sounds / quests / battle passes / announcements / token rewards — use respective tabs (marketplace, pets, quests, battlepass, city, notify, tokens) for CRUD. Asset catalog for 3D models, thumbnails, etc. is at /api/assets/catalog.</p>
      </div>
    </MotionTab>
  );
}
