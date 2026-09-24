/**
 * Ambient Sound Bar — the unified UI for the shared procedural ambient engine.
 *
 * Backed by `lib/ambientEngine` (layered noise + LFO soundscapes, single
 * AudioContext, 4-layer cap, EQ, tab-hide ducking).
 *
 * Renders as a compact pill on mobile / compact bar on desktop;
 * expands into a sleek mixer with scenes, layers with per-layer volume,
 * YouTube tracks, EQ, and master volume.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Music, X, Sparkles, SlidersHorizontal, Square, Play, Pause, ChevronDown, ChevronUp } from "lucide-react";
import {
  ambientEngine,
  AMBIENT_SOUNDS,
  AMBIENT_PRESETS,
  EQ_PRESETS,
  MAX_LAYERS,
  type SoundId,
} from "@/lib/ambientEngine";
import { useAmbientEngine } from "@/hooks/useAmbientEngine";
import { safeGetJson, safeSetJson } from "@/lib/safeStorage";
import AudioVisualizer from "./AudioVisualizer";

const MIX_KEY = "focusarx-ambient-mix";
const CORE_IDS: SoundId[] = ["rain", "storm", "ocean", "forest", "cafe", "fireplace", "crickets", "pink", "brown", "white"];

/** Tracks published by an admin (streamed audio or YouTube, not synthesized). */
type CustomTrack = {
  id: string;
  label: string;
  emoji?: string;
  url: string;
  credit?: string;
  type?: "audio" | "youtube";
  youtubeId?: string | null;
};

type SavedMix = { layers: Array<{ id: SoundId; volume: number }>; master: number };

function persistMix(activeIds: SoundId[], volumes: Record<string, number>, master: number) {
  safeSetJson(MIX_KEY, { layers: activeIds.map((id) => ({ id, volume: volumes[id] ?? 0.5 })), master } satisfies SavedMix);
}

interface Props {
  /** "panel" = desktop column bar (collapsible); "pill" = floating toggle (mobile). */
  variant?: "panel" | "pill";
  className?: string;
}

export default function AmbientSoundBar({ variant = "pill", className = "" }: Props) {
  const state = useAmbientEngine();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [muted, setMuted] = useState(false);
  const preMuteRef = useRef(state.masterVolume);
  const [lastMix] = useState<SavedMix | null>(() => safeGetJson<SavedMix | null>(MIX_KEY, null));

  // Duck when tab is hidden; restore when visible.
  useEffect(() => {
    const onVis = () => ambientEngine.setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Remember the current mix so "Resume last mix" works after a reload.
  useEffect(() => {
    if (state.activeIds.length > 0) persistMix(state.activeIds, state.volumes, state.masterVolume);
  }, [state.activeIds, state.volumes, state.masterVolume]);

  const activeCount = state.activeIds.length;
  const isFull = activeCount >= MAX_LAYERS;

  const [customTracks, setCustomTracks] = useState<CustomTrack[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [trackVolumes, setTrackVolumes] = useState<Record<string, number>>({});
  const trackAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site/ambient-tracks", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: unknown) => { if (!cancelled && Array.isArray(list)) setCustomTracks(list.slice(0, 30)); })
      .catch(() => { /* decorative — empty list keeps the mixer working */ });
    return () => { cancelled = true; };
  }, []);

  const stopTrack = useCallback(() => {
    const el = trackAudioRef.current;
    if (el) { el.pause(); el.removeAttribute("src"); el.load(); }
    trackAudioRef.current = null;
    setPlayingTrackId(null);
  }, []);

  useEffect(() => () => { stopTrack(); }, [stopTrack]);

  const toggleTrack = (t: CustomTrack) => {
    if (playingTrackId === t.id) { stopTrack(); return; }
    stopTrack();

    const isYt = t.type === "youtube" || !!t.youtubeId || t.url.includes("youtu");
    if (isYt) {
      setPlayingTrackId(t.id);
      return;
    }

    const el = new Audio(t.url);
    el.loop = true;
    el.volume = Math.max(0, Math.min(1, (trackVolumes[t.id] ?? 0.6) * (muted ? 0 : 1)));
    el.addEventListener("error", () => { if (trackAudioRef.current === el) stopTrack(); });
    trackAudioRef.current = el;
    setPlayingTrackId(t.id);
    // `play()` has no guaranteed return value (jsdom, some in-app browsers) —
    // guard before subscribing, or the ambient mixer throws on every play.
    const played = el.play();
    if (played && typeof played.catch === "function") played.catch(() => stopTrack());
  };

  const setTrackVolume = (id: string, v: number) => {
    setTrackVolumes((prev) => ({ ...prev, [id]: v }));
    if (playingTrackId === id && trackAudioRef.current) {
      trackAudioRef.current.volume = Math.max(0, Math.min(1, v * (muted ? 0 : 1)));
    }
  };

  // Master mute also silences a playing track.
  useEffect(() => {
    const el = trackAudioRef.current;
    if (el && playingTrackId) {
      el.volume = Math.max(0, Math.min(1, (trackVolumes[playingTrackId] ?? 0.6) * (muted ? 0 : 1)));
    }
  }, [muted, playingTrackId, trackVolumes]);

  const onCount = activeCount + (playingTrackId ? 1 : 0);

  const toggle = (id: SoundId) => {
    if (ambientEngine.isActive(id)) ambientEngine.stop(id);
    else ambientEngine.play(id, 0.5);
  };

  const toggleMute = () => {
    if (muted) {
      ambientEngine.setMasterVolume(preMuteRef.current || 0.9);
      setMuted(false);
    } else {
      preMuteRef.current = state.masterVolume;
      ambientEngine.setMasterVolume(0);
      setMuted(true);
    }
  };

  const resumeLast = () => {
    if (!lastMix) return;
    ambientEngine.applyPreset({ id: "last", label: "Last mix", emoji: "↩", layers: lastMix.layers.slice(0, MAX_LAYERS) });
    ambientEngine.setMasterVolume(lastMix.master);
  };

  const visibleSounds = showAll ? AMBIENT_SOUNDS : AMBIENT_SOUNDS.filter((s) => CORE_IDS.includes(s.id) || state.activeIds.includes(s.id));

  const mixerBody = (
    <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] shadow-[var(--shadow-lg)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Music size={14} className="shrink-0 text-[var(--brand-400)]" />
          <h3 className="truncate text-xs font-bold text-[var(--foreground)]">Ambient Sound</h3>
          <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--foreground-subtle)]">
            {activeCount}/{MAX_LAYERS}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onCount > 0 && (
            <button
              type="button"
              onClick={() => { ambientEngine.stopAll(); stopTrack(); }}
              className="flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              aria-label="Stop all ambient sounds"
            >
              <Square size={10} /> Stop
            </button>
          )}
          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? "Unmute ambient" : "Mute ambient"}
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close ambient mixer"
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="max-h-[340px] min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-3">
        {/* Visualizer */}
        <AudioVisualizer className="h-7 w-full rounded-lg bg-[var(--surface-1)]" />

        {/* Quick Scenes */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Scenes</p>
            {lastMix && activeCount === 0 && (
              <button type="button" onClick={resumeLast} className="text-[11px] font-semibold text-[var(--brand-400)] hover:underline">
                Resume last
              </button>
            )}
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {AMBIENT_PRESETS.map((p) => {
              const active = p.layers.length > 0 && p.layers.every((l) => state.activeIds.includes(l.id)) && state.activeIds.length === p.layers.length;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => ambientEngine.applyPreset(p)}
                  aria-pressed={active}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${active ? "border-[var(--brand-500)]/50 bg-[var(--brand-soft)] text-[var(--brand-400)]" : "border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-muted)] hover:border-[var(--brand-400)]/40 hover:text-[var(--foreground)]"}`}
                >
                  <span aria-hidden>{p.emoji}</span>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Layers */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Layers</p>
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[11px] font-semibold text-[var(--brand-400)] hover:underline">
              {showAll ? "Fewer" : `All ${AMBIENT_SOUNDS.length}`}
            </button>
          </div>
          <ul className="space-y-1">
            {visibleSounds.map((s) => {
              const active = state.activeIds.includes(s.id);
              const vol = state.volumes[s.id] ?? 0.5;
              const disabled = !active && isFull;
              return (
                <li
                  key={s.id}
                  className={`rounded-lg border px-2 py-1.5 transition-colors ${active ? "border-[var(--brand-500)]/40 bg-[var(--brand-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-1)]"}`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      disabled={disabled}
                      aria-pressed={active}
                      title={disabled ? `Max ${MAX_LAYERS} layers` : undefined}
                      className="flex min-h-7 min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded text-xs" style={{ background: active ? `color-mix(in oklab, ${s.color} 18%, transparent)` : "var(--surface-2)" }} aria-hidden>
                        {s.emoji}
                      </span>
                      <span className={`truncate text-xs font-semibold ${active ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>{s.label}</span>
                    </button>
                    {active && (
                      <label className="flex items-center gap-1.5">
                        <span className="sr-only">{s.label} volume</span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={vol}
                          onChange={(e) => ambientEngine.setVolume(s.id, parseFloat(e.target.value))}
                          className="fx-range h-1.5 w-20"
                          style={{ ["--fx-range-fill" as string]: s.color, ["--fx-range-pct" as string]: `${vol * 100}%` }}
                        />
                      </label>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Curated music & YouTube */}
        {customTracks.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">
              <Music size={11} /> Music & YouTube
            </p>
            <ul className="space-y-1">
              {customTracks.map((t) => {
                const active = playingTrackId === t.id;
                const isYt = t.type === "youtube" || !!t.youtubeId || t.url.includes("youtu");
                const ytId = t.youtubeId || (t.url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/) || [])[1];
                const vol = trackVolumes[t.id] ?? 0.6;
                return (
                  <li
                    key={t.id}
                    className={`rounded-lg border px-2 py-1.5 transition-colors ${active ? "border-[var(--brand-500)]/40 bg-[var(--brand-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-1)]"}`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleTrack(t)}
                        aria-pressed={active}
                        className="flex min-h-7 min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded text-xs" style={{ background: active ? "color-mix(in oklab, var(--brand-400) 18%, transparent)" : "var(--surface-2)" }} aria-hidden>
                          {active ? <Pause size={12} className="text-[var(--brand-400)]" /> : <Play size={12} className="text-[var(--foreground-muted)]" />}
                        </span>
                        <span className="min-w-0">
                          <span className={`flex items-center gap-1.5 truncate text-xs font-semibold ${active ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>
                            <span>{t.emoji ? `${t.emoji} ` : (isYt ? "▶️ " : "")}{t.label}</span>
                            {isYt && (
                              <span className="rounded bg-[var(--palette-rose-950)]/70 border border-[var(--palette-rose-500)]/30 px-1 py-0.5 text-[11px] font-bold text-[var(--palette-rose-400)] uppercase">
                                YT
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                      {active && !isYt && (
                        <label className="flex items-center gap-1.5">
                          <span className="sr-only">{t.label} volume</span>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={vol}
                            onChange={(e) => setTrackVolume(t.id, parseFloat(e.target.value))}
                            className="fx-range h-1.5 w-20"
                            style={{ ["--fx-range-fill" as string]: "var(--brand-400)", ["--fx-range-pct" as string]: `${vol * 100}%` }}
                          />
                        </label>
                      )}
                    </div>

                    {/* YouTube Embedded Stream */}
                    {active && isYt && ytId && (
                      <div className="mt-2 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)]">
                        <div className="relative aspect-video w-full max-h-32">
                          <iframe
                            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&enablejsapi=1&loop=1&playlist=${ytId}&modestbranding=1`}
                            title={t.label}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            className="h-full w-full border-0"
                          />
                        </div>
                        <div className="flex items-center justify-between px-2 py-1 text-[11px] text-[var(--foreground-subtle)]">
                          <span>Focus Audio Stream</span>
                          <a href={t.url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--brand-400)] underline">
                            YouTube ↗
                          </a>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Tone EQ */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">
            <SlidersHorizontal size={11} /> Tone
          </p>
          <div className="grid grid-cols-4 gap-1" role="group" aria-label="EQ preset">
            {EQ_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => ambientEngine.setEq(p.id)}
                aria-pressed={state.eq === p.id}
                className={`min-h-7 rounded-md border text-[11px] font-semibold transition-colors ${state.eq === p.id ? "border-[var(--brand-500)]/50 bg-[var(--brand-soft)] text-[var(--brand-400)]" : "border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Master Volume Footer */}
      <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-1)] px-3.5 py-2">
        <label className="flex items-center gap-2.5">
          <Volume2 size={13} className="shrink-0 text-[var(--foreground-subtle)]" />
          <span className="sr-only">Master volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : state.masterVolume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (muted) setMuted(false);
              ambientEngine.setMasterVolume(v);
            }}
            className="fx-range h-1.5 flex-1"
            style={{ ["--fx-range-fill" as string]: "var(--brand-400)", ["--fx-range-pct" as string]: `${(muted ? 0 : state.masterVolume) * 100}%` }}
          />
          <span className="w-8 text-right text-[11px] font-bold tabular-nums text-[var(--foreground-subtle)]">
            {Math.round((muted ? 0 : state.masterVolume) * 100)}%
          </span>
        </label>
      </div>
    </div>
  );

  // Desktop Column Variant: Sleek, compact one-line card that cleanly expands into the mixer
  if (variant === "panel") {
    return (
      <div className={`flex w-full flex-col gap-2 ${className}`}>
        {/* Compact Toggle Strip */}
        <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-3.5 py-2 shadow-sm">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-expanded={open}
            aria-label="Toggle ambient sound panel"
          >
            <Music size={14} className={onCount > 0 ? "text-[var(--brand-400)]" : "text-[var(--foreground-subtle)]"} />
            <span className="truncate text-xs font-semibold text-[var(--foreground)]">
              {onCount > 0 ? (
                <span className="text-[var(--brand-400)]">{onCount} sound{onCount === 1 ? "" : "s"} playing</span>
              ) : (
                "Ambient Audio"
              )}
            </span>
            <span className="text-[11px] text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>

          <div className="flex items-center gap-1">
            {onCount > 0 && (
              <button
                type="button"
                onClick={() => { ambientEngine.stopAll(); stopTrack(); }}
                className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
                title="Stop all sounds"
              >
                Stop
              </button>
            )}
            <button
              type="button"
              onClick={toggleMute}
              className="grid h-7 w-7 place-items-center rounded text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
          </div>
        </div>

        {/* Collapsible Mixer */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {mixerBody}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Floating Pill Variant (mobile/compact)
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close ambient mixer" : "Open ambient mixer"}
        className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-md transition-colors ${onCount > 0 ? "border-[var(--brand-500)]/40 bg-[var(--brand-soft)] text-[var(--brand-400)]" : "border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}
      >
        {onCount > 0 ? (
          <>
            <Sparkles size={13} />
            <span>{onCount} sound{onCount === 1 ? "" : "s"} on</span>
          </>
        ) : (
          <>
            <Volume2 size={13} />
            <span>Ambient</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              key="ambient-scrim"
              type="button"
              aria-label="Close ambient mixer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[calc(var(--z-modal)-1)] bg-black/40 sm:hidden"
            />
            <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-[var(--z-modal)] sm:absolute sm:inset-x-auto sm:bottom-full sm:right-0 sm:mb-2 sm:w-[20rem]">
              {mixerBody}
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
