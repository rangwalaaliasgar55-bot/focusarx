/**
 * Ambient Sound Bar — the one UI for the shared procedural ambient engine.
 *
 * Backed by `lib/ambientEngine` (layered noise + LFO soundscapes, single
 * AudioContext, 4-layer cap, EQ, tab-hide ducking). Previously this bar ran
 * its own bare oscillators (a 200 Hz sawtooth labelled "Rain") which is why
 * ambient sound felt broken — it never used the real engine.
 *
 * Renders as a compact pill; expands into a mixer with presets, layers with
 * per-layer volume, EQ, and master volume. Layout adapts to `variant`.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Music, X, Sparkles, SlidersHorizontal, Square } from "lucide-react";
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

type SavedMix = { layers: Array<{ id: SoundId; volume: number }>; master: number };

function persistMix(activeIds: SoundId[], volumes: Record<string, number>, master: number) {
  safeSetJson(MIX_KEY, { layers: activeIds.map((id) => ({ id, volume: volumes[id] ?? 0.5 })), master } satisfies SavedMix);
}

interface Props {
  /** "panel" = always-open card (desktop column); "pill" = floating toggle (mobile). */
  variant?: "panel" | "pill";
  className?: string;
}

export default function AmbientSoundBar({ variant = "pill", className = "" }: Props) {
  const state = useAmbientEngine();
  const [open, setOpen] = useState(variant === "panel");
  const [showAll, setShowAll] = useState(false);
  const [muted, setMuted] = useState(false);
  const preMuteRef = useRef(state.masterVolume);
  const [lastMix] = useState<SavedMix | null>(() => safeGetJson<SavedMix | null>(MIX_KEY, null));

  // Duck when the tab is hidden; restore when visible.
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

  const panel = (
    <motion.div
      key="ambient-panel"
      initial={variant === "pill" ? { opacity: 0, y: 12, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      role="region"
      aria-label="Ambient sound mixer"
      className={`flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] shadow-xl ${variant === "pill" ? "max-h-[min(70vh,560px)] sm:w-[22rem]" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Music size={15} className="shrink-0 text-[var(--brand-400)]" />
          <h3 className="truncate text-sm font-bold text-[var(--foreground)]">Ambient</h3>
          <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--foreground-subtle)]">
            {activeCount}/{MAX_LAYERS}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => ambientEngine.stopAll()}
              className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              aria-label="Stop all ambient sounds"
            >
              <Square size={11} /> Stop
            </button>
          )}
          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? "Unmute ambient" : "Mute ambient"}
            className="grid h-9 w-9 place-items-center rounded-lg text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          {variant === "pill" && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close ambient mixer"
              className="grid h-9 w-9 place-items-center rounded-lg text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* Visualizer */}
        <div className="px-4 pt-3">
          <AudioVisualizer className="h-9 w-full rounded-lg bg-[var(--surface-1)]" />
        </div>

        {/* Presets */}
        <div className="px-4 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Scenes</p>
            {lastMix && activeCount === 0 && (
              <button type="button" onClick={resumeLast} className="text-[11px] font-semibold text-[var(--brand-400)] hover:underline">
                Resume last mix
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
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "border-[var(--brand-500)]/50 bg-[var(--brand-soft)] text-[var(--brand-400)]" : "border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-muted)] hover:border-[var(--brand-400)]/40 hover:text-[var(--foreground)]"}`}
                >
                  <span aria-hidden>{p.emoji}</span>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Layers */}
        <div className="px-4 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Layers</p>
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[11px] font-semibold text-[var(--brand-400)] hover:underline">
              {showAll ? "Show fewer" : `All ${AMBIENT_SOUNDS.length}`}
            </button>
          </div>
          <ul className="space-y-1.5">
            {visibleSounds.map((s) => {
              const active = state.activeIds.includes(s.id);
              const vol = state.volumes[s.id] ?? 0.5;
              const disabled = !active && isFull;
              return (
                <li
                  key={s.id}
                  className={`rounded-xl border px-2.5 py-2 transition-colors ${active ? "border-[var(--brand-500)]/40 bg-[var(--brand-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-1)]"}`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      disabled={disabled}
                      aria-pressed={active}
                      title={disabled ? `Max ${MAX_LAYERS} layers — stop one first` : undefined}
                      className="flex min-h-9 min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base"
                        style={{ background: active ? `color-mix(in oklab, ${s.color} 18%, transparent)` : "var(--surface-2)" }}
                        aria-hidden
                      >
                        {s.emoji}
                      </span>
                      <span className={`truncate text-xs font-semibold ${active ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>{s.label}</span>
                    </button>
                    {active && (
                      <label className="flex items-center gap-2">
                        <span className="sr-only">{s.label} volume</span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={vol}
                          onChange={(e) => ambientEngine.setVolume(s.id, parseFloat(e.target.value))}
                          className="fx-range h-1.5 w-24"
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

        {/* EQ */}
        <div className="px-4 pb-3 pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">
            <SlidersHorizontal size={11} /> Tone
          </p>
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="EQ preset">
            {EQ_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => ambientEngine.setEq(p.id)}
                aria-pressed={state.eq === p.id}
                className={`min-h-9 rounded-lg border text-xs font-semibold transition-colors ${state.eq === p.id ? "border-[var(--brand-500)]/50 bg-[var(--brand-soft)] text-[var(--brand-400)]" : "border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Master */}
      <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3">
        <label className="flex items-center gap-3">
          <Volume2 size={14} className="shrink-0 text-[var(--foreground-subtle)]" />
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
            className="fx-range h-2 flex-1"
            style={{ ["--fx-range-fill" as string]: "var(--brand-400)", ["--fx-range-pct" as string]: `${(muted ? 0 : state.masterVolume) * 100}%` }}
          />
          <span className="w-9 text-right text-[11px] font-bold tabular-nums text-[var(--foreground-subtle)]">
            {Math.round((muted ? 0 : state.masterVolume) * 100)}%
          </span>
        </label>
      </div>
    </motion.div>
  );

  if (variant === "panel") return <div className={className}>{panel}</div>;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close ambient mixer" : "Open ambient mixer"}
        className={`flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold shadow-lg transition-colors ${activeCount > 0 ? "border-[var(--brand-500)]/40 bg-[var(--brand-soft)] text-[var(--brand-400)]" : "border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}
      >
        {activeCount > 0 ? (
          <>
            <Sparkles size={14} />
            <span>{activeCount} sound{activeCount === 1 ? "" : "s"} on</span>
          </>
        ) : (
          <>
            <Volume2 size={14} />
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
              className="fixed inset-0 z-[calc(var(--z-modal)-1)] bg-black/40 backdrop-blur-[2px] sm:hidden"
            />
            <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-[var(--z-modal)] sm:absolute sm:inset-x-auto sm:bottom-full sm:right-0 sm:mb-2">
              {panel}
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
