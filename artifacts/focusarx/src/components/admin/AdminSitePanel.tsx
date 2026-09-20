import { useCallback, useState, useEffect } from "react";
import { LoadingState, MotionTab, SectionHeader, adminFetch } from "./AdminHelpers";
import type { AdminPanelProps, SiteSettings } from "./AdminTypes";

type AdminTrack = { id: string; label: string; emoji?: string; url: string; credit?: string; type?: "audio" | "youtube"; youtubeId?: string | null };
type CustomSetting = { key: string; value: string | number | boolean | null; public: boolean; note: string; updatedAt: string };

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match ? match[1]! : null;
}

export function AdminSitePanel({ authHeaders }: AdminPanelProps) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  /* Curated ambient music tracks — streamed audio published to every user's
     ambient mixer (separate from the built-in synthesized soundscapes). */
  const [tracks, setTracks] = useState<AdminTrack[]>([]);
  const [trackDraft, setTrackDraft] = useState({ label: "", emoji: "", url: "", credit: "" });
  const [trackMsg, setTrackMsg] = useState<string | null>(null);

  /* Custom settings — the admin-defined key/value escape hatch. Anything the
     typed fields above do not cover can be registered, exposed publicly or kept
     internal, edited and deleted without a deploy. */
  const [custom, setCustom] = useState<CustomSetting[]>([]);
  const [customDraft, setCustomDraft] = useState({ key: "", value: "", isPublic: false, note: "" });
  const [customMsg, setCustomMsg] = useState<string | null>(null);

  const loadCustom = useCallback(async () => {
    try {
      const r = await adminFetch("/api/admin/site/custom-settings", { headers: authHeaders(), credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setCustom(Array.isArray(d.settings) ? d.settings : []);
      }
    } catch { /* the list is optional chrome — never block the settings form */ }
  }, [authHeaders]);

  /**
   * Coerce the typed-in text into the value the server will store. We cannot
   * ask admins to choose a JSON type from a dropdown, so "true"/"42"/"hello"
   * become boolean/number/string, which is what they meant in every case.
   */
  function parseValue(raw: string): string | number | boolean | null {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    return trimmed;
  }

  async function saveCustom(key: string, value: string, isPublic: boolean, note: string) {
    setCustomMsg(null);
    const res = await adminFetch(`/api/admin/site/custom-settings/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ value: parseValue(value), public: isPublic, note }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setCustomMsg(`Error: ${d.error ?? "Could not save"}`); return false; }
    await loadCustom();
    setCustomMsg(`${key} saved${isPublic ? " (public)" : " (internal)"}.`);
    return true;
  }

  async function removeCustom(key: string) {
    setCustomMsg(null);
    const res = await adminFetch(`/api/admin/site/custom-settings/${encodeURIComponent(key)}`, {
      method: "DELETE", headers: authHeaders(), credentials: "include",
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setCustomMsg(`Error: ${d.error ?? "Could not delete"}`); return; }
    await loadCustom();
    setCustomMsg(`${key} deleted.`);
  }

  const loadTracks = useCallback(async () => {
    try {
      const r = await adminFetch("/api/site/ambient-tracks", { headers: authHeaders(), credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d)) setTracks(d);
      }
    } catch { /* ignore */ }
  }, [authHeaders]);

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
    } catch (e) { setTrackMsg("Error: " + (e instanceof Error ? e.message : "Failed")); }
  }

  function addTrack() {
    const label = trackDraft.label.trim();
    const url = trackDraft.url.trim();
    if (!label || !url) { setTrackMsg("Error: a label and a valid URL are required."); return; }
    if (!url.startsWith("https://") && !url.startsWith("http://")) { setTrackMsg("Error: track URL must use https."); return; }
    if (tracks.length >= 30) { setTrackMsg("Error: at most 30 tracks — remove one first."); return; }
    const ytId = extractYouTubeId(url);
    const track: AdminTrack = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: label.slice(0, 60),
      emoji: trackDraft.emoji.trim() || (ytId ? "▶️" : "🎵"),
      url,
      credit: trackDraft.credit.trim() || undefined,
      type: ytId ? "youtube" : "audio",
      youtubeId: ytId || null,
    };
    void saveTracks([...tracks, track]);
    setTrackDraft({ label: "", emoji: "", url: "", credit: "" });
  }

  function removeTrack(id: string) {
    void saveTracks(tracks.filter((t) => t.id !== id));
  }

  const load = useCallback(async () => {
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
  }, [authHeaders]);

  // Deferred a tick so the first setState isn't synchronous in the effect.
  useEffect(() => {
    const t = setTimeout(() => { void load(); void loadTracks(); void loadCustom(); }, 0);
    return () => clearTimeout(t);
  }, [load, loadTracks, loadCustom]);

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
    } catch (e) { setResult("Error: " + (e instanceof Error ? e.message : "Failed")); }
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
          <h3 className="mb-1 text-sm font-semibold text-[var(--palette-zinc-100)]">🎵 Curated Ambient & YouTube Tracks</h3>
          <p className="mb-4 text-xs text-[var(--palette-zinc-500)]">
            Publish streamed music tracks or YouTube songs (lo-fi streams, ambient music, study playlists, binaural beats) to every user's ambient sound bar. Max 30.
          </p>

          {tracks.length > 0 && (
            <ul className="mb-4 space-y-1.5">
              {tracks.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)] px-3 py-2">
                  <span aria-hidden>{t.emoji || (t.type === "youtube" ? "▶️" : "🎵")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-[var(--palette-zinc-200)]">{t.label}</span>
                      {t.type === "youtube" && (
                        <span className="rounded bg-[var(--danger-soft)] border border-[var(--danger)]/30 px-1.5 py-0.5 text-[11px] font-bold text-[var(--danger)] uppercase tracking-wider">
                          YouTube
                        </span>
                      )}
                    </span>
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
                placeholder="Lofi Hip Hop Study Beats"
                className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" />
            </div>
            <div>
              <label htmlFor="adminsitepanel-track-emoji" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Emoji</label>
              <input id="adminsitepanel-track-emoji" value={trackDraft.emoji} onChange={(e) => setTrackDraft((d) => ({ ...d, emoji: e.target.value }))}
                placeholder="🎧" maxLength={8}
                className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" />
            </div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr]">
            <div>
              <label htmlFor="adminsitepanel-track-url" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Track Link (YouTube URL or Direct Audio .mp3/.ogg)</label>
              <input id="adminsitepanel-track-url" value={trackDraft.url} onChange={(e) => setTrackDraft((d) => ({ ...d, url: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=... or https://cdn.example.com/song.mp3" inputMode="url"
                className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" />
            </div>
            <div>
              <label htmlFor="adminsitepanel-track-credit" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Artist / Channel Credit (optional)</label>
              <input id="adminsitepanel-track-credit" value={trackDraft.credit} onChange={(e) => setTrackDraft((d) => ({ ...d, credit: e.target.value }))}
                placeholder="Lofi Girl / ChilledCow"
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

        {/* Custom settings — anything at all, added and deleted without a deploy */}
        <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-5 lg:col-span-2">
          <h3 className="mb-1 text-sm font-semibold text-[var(--palette-zinc-100)]">🧩 Custom Settings</h3>
          <p className="mb-4 text-xs text-[var(--palette-zinc-500)]">
            Register any setting the app does not have a typed field for. Values can be text, numbers or true/false.
            Public settings are readable by the site at <code>/api/site/custom-settings</code>; internal ones never leave the admin surface.
          </p>

          {custom.length > 0 && (
            <div className="mb-4 space-y-1.5">
              {custom.map((c) => (
                <div key={c.key} className="grid gap-2 rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)] px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-center">
                  <div className="min-w-0">
                    <span className="block truncate font-mono text-xs font-semibold text-[var(--palette-zinc-200)]">{c.key}</span>
                    {c.note && <span className="block truncate text-[11px] text-[var(--palette-zinc-500)]">{c.note}</span>}
                  </div>
                  <input
                    aria-label={`Value for ${c.key}`}
                    defaultValue={c.value === null ? "" : String(c.value)}
                    onBlur={(e) => { if (e.target.value !== String(c.value ?? "")) void saveCustom(c.key, e.target.value, c.public, c.note); }}
                    className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-900)] px-2.5 py-1.5 text-xs text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]"
                  />
                  <label className="flex items-center gap-1.5 text-[11px] text-[var(--palette-zinc-400)]">
                    <input
                      type="checkbox"
                      checked={c.public}
                      onChange={(e) => void saveCustom(c.key, String(c.value ?? ""), e.target.checked, c.note)}
                      className="h-3.5 w-3.5 accent-[var(--palette-violet-600)]"
                    />
                    public
                  </label>
                  <button type="button" onClick={() => void removeCustom(c.key)}
                    className="rounded-lg border border-[var(--palette-zinc-700)] px-2.5 py-1 text-[11px] font-semibold text-[var(--palette-zinc-400)] transition hover:border-[var(--palette-rose-500)]/50 hover:text-[var(--palette-rose-400)]">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input
              aria-label="New setting key"
              value={customDraft.key}
              onChange={(e) => setCustomDraft((d) => ({ ...d, key: e.target.value }))}
              placeholder="key (e.g. exam_banner_text)"
              className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]"
            />
            <input
              aria-label="New setting value"
              value={customDraft.value}
              onChange={(e) => setCustomDraft((d) => ({ ...d, value: e.target.value }))}
              placeholder="value (text, 42, true)"
              className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]"
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--palette-zinc-400)]">
                <input type="checkbox" checked={customDraft.isPublic}
                  onChange={(e) => setCustomDraft((d) => ({ ...d, isPublic: e.target.checked }))}
                  className="h-3.5 w-3.5 accent-[var(--palette-violet-600)]" />
                public
              </label>
              <button type="button"
                onClick={async () => {
                  const key = customDraft.key.trim().toLowerCase();
                  if (!key) { setCustomMsg("Error: a key is required"); return; }
                  const ok = await saveCustom(key, customDraft.value, customDraft.isPublic, customDraft.note);
                  if (ok) setCustomDraft({ key: "", value: "", isPublic: false, note: "" });
                }}
                className="rounded-lg bg-[var(--palette-violet-600)] px-4 py-2 text-xs font-semibold text-[var(--palette-white)] transition hover:bg-[var(--palette-violet-500)]">
                Add setting
              </button>
            </div>
          </div>
          {customMsg && (
            <p className={`mt-2 text-xs ${customMsg.startsWith("Error") ? "text-[var(--palette-rose-400)]" : "text-[var(--palette-emerald-400)]"}`}>{customMsg}</p>
          )}
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
