import { useState, useEffect } from "react";
import { LoadingState, MotionTab, SectionHeader, adminFetch } from "./AdminHelpers";
import type { AdminPanelProps, SiteSettings } from "./AdminTypes";

type AdminTrack = { id: string; label: string; emoji?: string; url: string; credit?: string };

export function AdminSitePanel({ authHeaders }: AdminPanelProps) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  /* Curated ambient music tracks — streamed audio published to every user's
     ambient mixer (separate from the built-in synthesized soundscapes). */
  const [tracks, setTracks] = useState<AdminTrack[]>([]);
  const [trackDraft, setTrackDraft] = useState({ label: "", emoji: "", url: "", credit: "" });
  const [trackMsg, setTrackMsg] = useState<string | null>(null);

  useEffect(() => { load(); void loadTracks(); }, []);

  async function loadTracks() {
    try {
      const r = await adminFetch("/api/site/ambient-tracks", { headers: authHeaders(), credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d)) setTracks(d);
      }
    } catch { /* ignore */ }
  }

  async function saveTracks(next: AdminTrack[]) {
    setTrackMsg(null);
    try {
      const r = await adminFetch("/api/admin/ambient-tracks", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify(next),
      });
      if (r.ok) { setTracks(next); setTrackMsg("Track list published — live for all users."); }
      else {
        const d = await r.json().catch(() => ({}));
        const detail = typeof d?.error === "string" ? d.error : (d?.error?.message ?? "Failed to save tracks");
        setTrackMsg("Error: " + detail);
      }
    } catch (e: any) { setTrackMsg("Error: " + e.message); }
  }

  function addTrack() {
    const label = trackDraft.label.trim();
    const url = trackDraft.url.trim();
    if (!label || !url) { setTrackMsg("Error: a label and an https URL are required."); return; }
    if (!url.startsWith("https://")) { setTrackMsg("Error: track URL must use https."); return; }
    if (tracks.length >= 20) { setTrackMsg("Error: at most 20 tracks — remove one first."); return; }
    const track: AdminTrack = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: label.slice(0, 40),
      emoji: trackDraft.emoji.trim() || "🎵",
      url,
      credit: trackDraft.credit.trim() || undefined,
    };
    void saveTracks([...tracks, track]);
    setTrackDraft({ label: "", emoji: "", url: "", credit: "" });
  }

  function removeTrack(id: string) {
    void saveTracks(tracks.filter((t) => t.id !== id));
  }

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
      /* The server schema marks the announcement/branding optional fields
         `.optional()` but NOT `.nullable()` (only hero* fields are nullable),
         so empty strings must be OMITTED rather than sent as null — sending
         nulls is what used to 400 with "Invalid settings" the moment a
         toggle autosaved with empty optional fields. */
      const body: Record<string, unknown> = {
        maintenanceMode: s.maintenanceMode,
        maintenanceMessage: s.maintenanceMessage,
        announcementEnabled: s.announcementEnabled,
        brandingName: s.brandingName,
        heroTitle: s.heroTitle || null,
        heroSubtitle: s.heroSubtitle || null,
        heroCtaText: s.heroCtaText || null,
      };
      if (s.announcementTitle) body.announcementTitle = s.announcementTitle;
      if (s.announcementText) body.announcementText = s.announcementText;
      if (s.announcementEmoji) body.announcementEmoji = s.announcementEmoji;
      if (s.brandingTagline) body.brandingTagline = s.brandingTagline;
      const r = await adminFetch("/api/admin/site/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (r.ok) setResult("Settings saved! Changes are live site-wide.");
      else {
        const d = await r.json().catch(() => ({}));
        const detail = typeof d?.error === "string" ? d.error : (d?.error?.message ?? "Failed to save");
        setResult("Error: " + detail);
      }
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
        {/* Curated ambient tracks */}
        <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-5 lg:col-span-2">
          <h3 className="mb-1 text-sm font-semibold text-[var(--palette-zinc-100)]">🎵 Curated Ambient Tracks</h3>
          <p className="mb-4 text-xs text-[var(--palette-zinc-500)]">
            Publish streamed music tracks (licensed lofi loops, nature recordings…) to every user's ambient mixer.
            Built-in soundscapes are synthesized; tracks added here stream from the URL you provide. Max 20.
          </p>

          {tracks.length > 0 && (
            <ul className="mb-4 space-y-1.5">
              {tracks.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)] px-3 py-2">
                  <span aria-hidden>{t.emoji || "🎵"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-[var(--palette-zinc-200)]">{t.label}</span>
                    <span className="block truncate text-[11px] text-[var(--palette-zinc-500)]">{t.credit ? `${t.credit} · ` : ""}{t.url}</span>
                  </span>
                  <button type="button" onClick={() => removeTrack(t.id)}
                    className="shrink-0 rounded-lg border border-[var(--palette-zinc-700)] px-2.5 py-1 text-[11px] font-semibold text-[var(--palette-zinc-400)] hover:border-[var(--palette-rose-500)]/50 hover:text-[var(--palette-rose-400)] transition">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-2 sm:grid-cols-[1fr_4rem]">
            <div>
              <label htmlFor="adminsitepanel-track-label" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Track label</label>
              <input id="adminsitepanel-track-label" value={trackDraft.label} onChange={(e) => setTrackDraft((d) => ({ ...d, label: e.target.value }))}
                placeholder="Midnight Lofi Study"
                className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" />
            </div>
            <div>
              <label htmlFor="adminsitepanel-track-emoji" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Emoji</label>
              <input id="adminsitepanel-track-emoji" value={trackDraft.emoji} onChange={(e) => setTrackDraft((d) => ({ ...d, emoji: e.target.value }))}
                placeholder="🎵" maxLength={8}
                className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" />
            </div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr]">
            <div>
              <label htmlFor="adminsitepanel-track-url" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Audio URL (https, mp3/m4a/ogg)</label>
              <input id="adminsitepanel-track-url" value={trackDraft.url} onChange={(e) => setTrackDraft((d) => ({ ...d, url: e.target.value }))}
                placeholder="https://cdn.example.com/lofi-loop.mp3" inputMode="url"
                className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" />
            </div>
            <div>
              <label htmlFor="adminsitepanel-track-credit" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Credit (optional)</label>
              <input id="adminsitepanel-track-credit" value={trackDraft.credit} onChange={(e) => setTrackDraft((d) => ({ ...d, credit: e.target.value }))}
                placeholder="Artist / license note"
                className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={addTrack}
              className="rounded-lg bg-[var(--palette-teal-600)] px-4 py-2 text-xs font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-teal-500)] transition">
              Add & publish track
            </button>
            {trackMsg && (
              <span className={`text-xs ${trackMsg.startsWith("Error") ? "text-[var(--palette-rose-400)]" : "text-[var(--palette-emerald-400)]"}`}>{trackMsg}</span>
            )}
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
