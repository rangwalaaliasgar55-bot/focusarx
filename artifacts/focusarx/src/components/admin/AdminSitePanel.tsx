import { useCallback, useState, useEffect } from "react";
import { LoadingState, MotionTab, SectionHeader, adminFetch } from "./AdminHelpers";
import type { AdminPanelProps, SiteSettings } from "./AdminTypes";

type AmbientInsight = { starts: number; listeners: number; starts30d: number; listeners30d: number; lastListenedAt: string | null };
type AdminTrack = {
  id: string;
  label: string;
  emoji?: string;
  url: string;
  credit?: string;
  sourceUrl?: string;
  license: string;
  looping: boolean;
  status: "draft" | "published" | "archived";
  publishedAt?: string | null;
  insight: AmbientInsight;
};
type CustomSetting = { key: string; value: string | number | boolean | null; public: boolean; note: string; updatedAt: string };

export function AdminSitePanel({ authHeaders }: AdminPanelProps) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  /* Curated ambient music tracks — streamed audio published to every user's
     ambient mixer (separate from the built-in synthesized soundscapes). */
  const [tracks, setTracks] = useState<AdminTrack[]>([]);
  const [trackDraft, setTrackDraft] = useState({ label: "", emoji: "", url: "", credit: "", sourceUrl: "", license: "", looping: true });
  const [trackMsg, setTrackMsg] = useState<string | null>(null);
  const [trackSaving, setTrackSaving] = useState<string | null>(null);

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
      const r = await adminFetch("/api/admin/ambient-tracks", { headers: authHeaders(), credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setTracks(Array.isArray(d.tracks) ? d.tracks : []);
      }
    } catch { /* The admin settings panel remains usable if this optional list fails. */ }
  }, [authHeaders]);

  async function runTrackAction(path: string, options: RequestInit, success: string) {
    setTrackMsg(null); setTrackSaving(path);
    try {
      const r = await adminFetch(path, {
        ...options,
        headers: { ...authHeaders(), ...(options.body ? { "Content-Type": "application/json" } : {}) },
        credentials: "include",
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setTrackMsg(`Error: ${typeof d?.error === "string" ? d.error : d?.error?.message ?? "Could not save track"}`);
        return false;
      }
      await loadTracks();
      setTrackMsg(success);
      return true;
    } catch (error) {
      setTrackMsg(`Error: ${error instanceof Error ? error.message : "Could not save track"}`);
      return false;
    } finally { setTrackSaving(null); }
  }

  async function addTrack() {
    const label = trackDraft.label.trim();
    const url = trackDraft.url.trim();
    if (!label || !url || !trackDraft.license.trim()) {
      setTrackMsg("Error: label, direct audio URL, and license are required."); return;
    }
    if (/youtu(?:\.be|be\.com)|youtube\.com/i.test(url)) {
      setTrackMsg("Error: YouTube links cannot be used as audio tracks. Add a licensed direct audio file instead."); return;
    }
    const ok = await runTrackAction("/api/admin/ambient-tracks", {
      method: "POST",
      body: JSON.stringify({
        label, url, emoji: trackDraft.emoji.trim() || "🎵", credit: trackDraft.credit.trim(),
        sourceUrl: trackDraft.sourceUrl.trim(), license: trackDraft.license.trim(), looping: trackDraft.looping,
      }),
    }, "Draft saved. Review it, then select Release when it is ready for listeners.");
    if (ok) setTrackDraft({ label: "", emoji: "", url: "", credit: "", sourceUrl: "", license: "", looping: true });
  }

  function releaseTrack(track: AdminTrack) {
    void runTrackAction(`/api/admin/ambient-tracks/${encodeURIComponent(track.id)}/publish`, { method: "POST" }, `${track.label} is now released.`);
  }
  function unpublishTrack(track: AdminTrack) {
    void runTrackAction(`/api/admin/ambient-tracks/${encodeURIComponent(track.id)}/unpublish`, { method: "POST" }, `${track.label} is back in draft.`);
  }
  function archiveTrack(track: AdminTrack) {
    void runTrackAction(`/api/admin/ambient-tracks/${encodeURIComponent(track.id)}/archive`, { method: "POST" }, `${track.label} was archived.`);
  }
  function setTrackLoop(track: AdminTrack, looping: boolean) {
    void runTrackAction(`/api/admin/ambient-tracks/${encodeURIComponent(track.id)}`, { method: "PATCH", body: JSON.stringify({ looping }) }, `Loop default updated for ${track.label}.`);
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
        <section className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-5 lg:col-span-2" aria-labelledby="ambient-catalog-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="ambient-catalog-heading" className="text-sm font-semibold text-[var(--palette-zinc-100)]">🎵 Ambient audio catalog</h3>
              <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-[var(--palette-zinc-500)]">
                Add licensed direct-audio recordings as drafts, review their provenance, then explicitly release them. The mixer is audio-first: YouTube links are intentionally not accepted or embedded.
              </p>
            </div>
            <span className="rounded-full border border-[var(--palette-zinc-700)] px-2 py-1 text-[11px] font-semibold text-[var(--palette-zinc-400)]">
              {tracks.filter((track) => track.status === "published").length} released · {tracks.filter((track) => track.status === "draft").length} drafts
            </span>
          </div>

          {tracks.length > 0 && (
            <ul className="mt-4 space-y-2" aria-label="Ambient audio catalog">
              {tracks.map((track) => {
                const busy = trackSaving?.includes(encodeURIComponent(track.id));
                const statusTone = track.status === "published" ? "border-[var(--palette-emerald-500)]/40 bg-[var(--palette-emerald-500)]/10 text-[var(--palette-emerald-400)]" : track.status === "draft" ? "border-[var(--palette-amber-500)]/40 bg-[var(--palette-amber-500)]/10 text-[var(--palette-amber-300)]" : "border-[var(--palette-zinc-600)] bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-400)]";
                return (
                  <li key={track.id} className="rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)] px-3 py-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <span aria-hidden className="pt-0.5">{track.emoji || "🎵"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-[var(--palette-zinc-200)]">{track.label}</span>
                          <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${statusTone}`}>{track.status}</span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-[var(--palette-zinc-500)]">{track.credit || "No creator credit supplied"} · {track.license}{track.sourceUrl ? ` · ${track.sourceUrl}` : ""}</p>
                        <p className="mt-1 text-[11px] text-[var(--palette-zinc-500)]">
                          <strong className="font-semibold text-[var(--palette-zinc-400)]">Private insight:</strong> {track.insight.listeners30d} signed-in listeners / {track.insight.starts30d} starts in 30d · {track.insight.listeners} all-time listeners
                          {track.insight.lastListenedAt ? ` · last start ${new Date(track.insight.lastListenedAt).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {track.status !== "published" && <button type="button" disabled={busy} onClick={() => releaseTrack(track)} className="rounded-lg bg-[var(--palette-emerald-700)] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[var(--palette-emerald-600)] disabled:opacity-50">Release</button>}
                        {track.status === "published" && <button type="button" disabled={busy} onClick={() => unpublishTrack(track)} className="rounded-lg border border-[var(--palette-amber-500)]/50 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--palette-amber-300)] transition hover:bg-[var(--palette-amber-500)]/10 disabled:opacity-50">Unpublish</button>}
                        {track.status !== "archived" && <button type="button" disabled={busy} onClick={() => archiveTrack(track)} className="rounded-lg border border-[var(--palette-zinc-700)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--palette-zinc-400)] transition hover:border-[var(--palette-rose-500)]/50 hover:text-[var(--palette-rose-400)] disabled:opacity-50">Archive</button>}
                      </div>
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-[11px] text-[var(--palette-zinc-400)]">
                      <input type="checkbox" checked={track.looping} disabled={busy} onChange={(event) => setTrackLoop(track, event.target.checked)} className="h-3.5 w-3.5 accent-[var(--palette-violet-500)]" />
                      Loop by default — listeners can still change this in their own mixer.
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <fieldset className="mt-4 rounded-lg border border-[var(--palette-zinc-800)] p-3">
            <legend className="px-1 text-xs font-semibold text-[var(--palette-zinc-300)]">Add a licensed audio draft</legend>
            <div className="grid gap-2 sm:grid-cols-[1fr_4rem]">
              <div><label htmlFor="adminsitepanel-track-label" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Track label</label><input id="adminsitepanel-track-label" value={trackDraft.label} onChange={(event) => setTrackDraft((draft) => ({ ...draft, label: event.target.value }))} placeholder="Late-night rain" className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" /></div>
              <div><label htmlFor="adminsitepanel-track-emoji" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Emoji</label><input id="adminsitepanel-track-emoji" value={trackDraft.emoji} onChange={(event) => setTrackDraft((draft) => ({ ...draft, emoji: event.target.value }))} placeholder="🌧️" maxLength={8} className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" /></div>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div><label htmlFor="adminsitepanel-track-url" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Direct audio URL</label><input id="adminsitepanel-track-url" value={trackDraft.url} onChange={(event) => setTrackDraft((draft) => ({ ...draft, url: event.target.value }))} placeholder="https://cdn.example.com/rain.mp3 or /ambient/..." inputMode="url" className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" /></div>
              <div><label htmlFor="adminsitepanel-track-credit" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Creator credit</label><input id="adminsitepanel-track-credit" value={trackDraft.credit} onChange={(event) => setTrackDraft((draft) => ({ ...draft, credit: event.target.value }))} placeholder="Creator / label" className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" /></div>
              <div><label htmlFor="adminsitepanel-track-source" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Source URL</label><input id="adminsitepanel-track-source" value={trackDraft.sourceUrl} onChange={(event) => setTrackDraft((draft) => ({ ...draft, sourceUrl: event.target.value }))} placeholder="https://source.example.com" inputMode="url" className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" /></div>
              <div><label htmlFor="adminsitepanel-track-license" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">License <span className="text-[var(--palette-rose-400)]">required</span></label><input id="adminsitepanel-track-license" value={trackDraft.license} onChange={(event) => setTrackDraft((draft) => ({ ...draft, license: event.target.value }))} placeholder="CC0, CC BY 4.0, MIT, commercial license…" className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-3 py-2 text-sm text-[var(--palette-zinc-200)] outline-none focus:border-[var(--palette-violet-500)]" /></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-[var(--palette-zinc-400)]"><input type="checkbox" checked={trackDraft.looping} onChange={(event) => setTrackDraft((draft) => ({ ...draft, looping: event.target.checked }))} className="h-3.5 w-3.5 accent-[var(--palette-violet-500)]" /> Loop by default</label>
              <button type="button" disabled={trackSaving !== null} onClick={() => void addTrack()} className="rounded-lg bg-[var(--palette-teal-600)] px-4 py-2 text-xs font-semibold text-black transition hover:bg-[var(--palette-teal-500)] disabled:opacity-50">{trackSaving === "/api/admin/ambient-tracks" ? "Saving…" : "Save as draft"}</button>
              {trackMsg && <span role="status" className={`text-xs ${trackMsg.startsWith("Error") ? "text-[var(--palette-rose-400)]" : "text-[var(--palette-emerald-400)]"}`}>{trackMsg}</span>}
            </div>
          </fieldset>
        </section>

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
