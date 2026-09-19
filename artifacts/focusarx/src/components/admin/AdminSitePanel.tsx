import { useState, useEffect } from "react";
import { LoadingState, MotionTab, SectionHeader, adminFetch } from "./AdminHelpers";
import type { AdminPanelProps, SiteSettings } from "./AdminTypes";

export function AdminSitePanel({ authHeaders }: AdminPanelProps) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const r = await adminFetch("/api/admin/site/settings", { headers: authHeaders(), credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setSettings({
          maintenanceMode: d.maintenanceMode ?? false,
          maintenanceMessage: d.maintenanceMessage ?? "We're making FocusArx even better. Check back in a few minutes.",
          announcementEnabled: d.announcementEnabled ?? false,
          announcementTitle: d.announcementTitle ?? "",
          announcementText: d.announcementText ?? "",
          announcementEmoji: d.announcementEmoji ?? "",
          brandingName: d.brandingName ?? "FocusArx",
          brandingTagline: d.brandingTagline ?? "",
          heroTitle: d.heroTitle ?? "",
          heroSubtitle: d.heroSubtitle ?? "",
          heroCtaText: d.heroCtaText ?? "",
        });
      }
    } catch { /* ignore */ }
  }

  async function save(next?: SiteSettings) {
    const s = next ?? settings;
    if (!s) return;
    setSaving(true); setResult(null);
    try {
      const r = await adminFetch("/api/admin/site/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({
          maintenanceMode: s.maintenanceMode,
          maintenanceMessage: s.maintenanceMessage,
          announcementEnabled: s.announcementEnabled,
          announcementTitle: s.announcementTitle || null,
          announcementText: s.announcementText || null,
          announcementEmoji: s.announcementEmoji || null,
          brandingName: s.brandingName,
          brandingTagline: s.brandingTagline || null,
          heroTitle: s.heroTitle || null,
          heroSubtitle: s.heroSubtitle || null,
          heroCtaText: s.heroCtaText || null,
        }),
      });
      if (r.ok) setResult("Settings saved! Changes are live site-wide.");
      else { const d = await r.json().catch(() => ({})); setResult("Error: " + (d.error ?? "Failed to save")); }
    } catch (e: any) { setResult("Error: " + e.message); }
    finally { setSaving(false); }
  }

  /* Toggles autosave the moment they flip. The old flow required a separate
     Save click, so admins flipped maintenance mode, saw nothing change (they
     bypass the gate), and concluded it was broken. Passing the merged object
     to save() avoids racing React's async state update. */
  const flip = (patch: Partial<SiteSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    void save(next);
  };

  if (!settings) {
    return (
      <MotionTab>
        <SectionHeader title="Site Settings" sub="Maintenance mode, announcements, and branding." />
        <LoadingState />
      </MotionTab>
    );
  }

  const set = (patch: Partial<SiteSettings>) => setSettings((s) => (s ? { ...s, ...patch } : s));

  return (
    <MotionTab>
      <SectionHeader title="Site Settings" sub="Control the entire site — maintenance mode, announcements, and branding. Toggles go live the moment you flip them; text fields save with the button below." />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Maintenance mode */}
        <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--palette-zinc-100)]">🛠 Maintenance Mode</h3>
              <p className="mt-0.5 text-xs text-[var(--palette-zinc-500)]">Show a maintenance screen to everyone except admins.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.maintenanceMode}
              aria-label="Maintenance mode"
              onClick={() => flip({ maintenanceMode: !settings.maintenanceMode })}
              className={`relative h-6 w-11 rounded-full transition-colors ${settings.maintenanceMode ? "bg-[var(--palette-amber-600)]" : "bg-[var(--palette-zinc-700)]"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--palette-white)] transition-transform ${settings.maintenanceMode ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          {/* Admins bypass the gate by design (they need access to switch it
              off), which made the toggle look broken. Say so explicitly. */}
          {settings.maintenanceMode && (
            <p className="mb-3 rounded-lg border border-[var(--palette-amber-500)]/30 bg-[var(--palette-amber-500)]/10 px-3 py-2 text-xs text-[var(--palette-amber-300)]">
              Maintenance mode is LIVE for all visitors. You still see the normal site because admins are exempt — open an incognito window to see what everyone else sees.
            </p>
          )}
          <label htmlFor="adminsitepanel-maintenance-message" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Maintenance message</label>
          <textarea id="adminsitepanel-maintenance-message" rows={3} value={settings.maintenanceMessage} onChange={(e) => set({ maintenanceMessage: e.target.value })}
            className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-amber-500)] resize-none" />
        </div>

        {/* Announcement */}
        <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--palette-zinc-100)]">📣 Site Announcement</h3>
              <p className="mt-0.5 text-xs text-[var(--palette-zinc-500)]">Publish a banner across the whole app.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.announcementEnabled}
              aria-label="Site announcement"
              onClick={() => flip({ announcementEnabled: !settings.announcementEnabled })}
              className={`relative h-6 w-11 rounded-full transition-colors ${settings.announcementEnabled ? "bg-[var(--palette-emerald-600)]" : "bg-[var(--palette-zinc-700)]"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--palette-white)] transition-transform ${settings.announcementEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div className="space-y-2">
            <input placeholder="Emoji (e.g. 🎉)" value={settings.announcementEmoji} onChange={(e) => set({ announcementEmoji: e.target.value })}
              className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-emerald-500)]" />
            <input placeholder="Title" value={settings.announcementTitle} onChange={(e) => set({ announcementTitle: e.target.value })}
              className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-emerald-500)]" />
            <input placeholder="Message" value={settings.announcementText} onChange={(e) => set({ announcementText: e.target.value })}
              className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-emerald-500)]" />
          </div>
        </div>

        {/* Branding */}
        <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-[var(--palette-zinc-100)] mb-1">🎨 Branding</h3>
          <p className="mb-4 text-xs text-[var(--palette-zinc-500)]">Edit the app name and tagline shown across the product.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="adminsitepanel-app-name" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">App name</label>
              <input id="adminsitepanel-app-name" value={settings.brandingName} onChange={(e) => set({ brandingName: e.target.value })}
                className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" />
            </div>
            <div>
              <label htmlFor="adminsitepanel-tagline" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Tagline</label>
              <input id="adminsitepanel-tagline" value={settings.brandingTagline} onChange={(e) => set({ brandingTagline: e.target.value })}
                className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" />
            </div>
          </div>
        </div>

        {/* Landing page copy */}
        <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-[var(--palette-zinc-100)] mb-1">📝 Landing Page Copy</h3>
          <p className="mb-4 text-xs text-[var(--palette-zinc-500)]">Edit the hero headline, subtitle, and CTA on the landing page.</p>
          <div className="space-y-3">
            <div>
              <label htmlFor="adminsitepanel-hero-subtitle" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Hero subtitle</label>
              <textarea id="adminsitepanel-hero-subtitle" rows={2} value={settings.heroSubtitle} onChange={(e) => set({ heroSubtitle: e.target.value })}
                placeholder="Strap in, Commander. Every focus session fires your thrusters…"
                className="w-full resize-none rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" />
            </div>
            <div>
              <label htmlFor="adminsitepanel-cta-button-text" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">CTA button text</label>
              <input id="adminsitepanel-cta-button-text" value={settings.heroCtaText} onChange={(e) => set({ heroCtaText: e.target.value })}
                placeholder="🚀 Begin Launch Sequence"
                className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={() => void save()} disabled={saving}
          className="rounded-lg bg-[var(--palette-violet-600)] px-5 py-2.5 text-sm font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-violet-500)] disabled:opacity-50 transition"
        >{saving ? "Saving…" : "Save Settings"}</button>
        {result && (
          <span className={`text-xs ${result.startsWith("Error") ? "text-[var(--palette-rose-400)]" : "text-[var(--palette-emerald-400)]"}`}>{result}</span>
        )}
      </div>
    </MotionTab>
  );
}
