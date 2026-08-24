import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music2, VolumeX, Volume2, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import {
  ambientEngine,
  AMBIENT_SOUNDS,
  AMBIENT_PRESETS,
  type SoundId,
} from "@/lib/ambientEngine";

const STORAGE_KEY = "focusarx_sounds_v2";
const MAX_LAYERS = 3;

interface SavedPrefs {
  sounds: Array<{ id: SoundId; volume: number }>;
  master: number;
}

function loadSavedPrefs(): SavedPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedPrefs;
      if (Array.isArray(parsed.sounds)) return parsed;
    }
  } catch {}
  return { sounds: [], master: 0.9 };
}

function savePrefs(sounds: Array<{ id: SoundId; volume: number }>, master: number) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ sounds, master })); } catch {}
}

function VolumeSlider({
  value,
  color,
  onChange,
  compact,
}: {
  value: number;
  color: string;
  onChange: (v: number) => void;
  compact?: boolean;
}) {
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      aria-label="Volume"
      className={`flex-1 rounded-full appearance-none cursor-pointer ${compact ? "h-0.5" : "h-1"}`}
      style={{
        background: `linear-gradient(to right, ${color} 0%, ${color} ${value * 100}%, var(--rgba-124-58-237-0_12) ${value * 100}%, var(--rgba-124-58-237-0_12) 100%)`,
      }}
    />
  );
}

interface Props {
  visible?: boolean;
  /** "floating" renders the bottom pill (mobile); "panel" renders an inline card (desktop). */
  variant?: "floating" | "panel";
}

export default function AmbientSoundBar({ visible = true, variant = "floating" }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [activeSounds, setActiveSounds] = useState<Array<{ id: SoundId; volume: number }>>([]);
  const [master, setMaster] = useState(0.9);

  // Sync with the shared audio engine + restore persisted layers on mount.
  useEffect(() => {
    const sync = () => {
      setActiveSounds(ambientEngine.activeIds().map(id => ({ id, volume: ambientEngine.getVolume(id) })));
      setMaster(ambientEngine.getMasterVolume());
    };
    sync();
    const unsub = ambientEngine.subscribe(sync);
    const prefs = loadSavedPrefs();
    ambientEngine.setMasterVolume(prefs.master ?? 0.9);
    return unsub;
  }, []);

  // Persist on change.
  useEffect(() => {
    if (activeSounds.length > 0 || master !== 0.9) savePrefs(activeSounds, master);
  }, [activeSounds, master]);

  // Fade with visibility (e.g. hide while session overlay is up).
  useEffect(() => {
    ambientEngine.setVisible(visible);
  }, [visible]);

  const toggleSound = useCallback((id: SoundId) => {
    if (ambientEngine.isActive(id)) {
      ambientEngine.stop(id);
    } else if (ambientEngine.activeIds().length < MAX_LAYERS) {
      ambientEngine.play(id, 0.5);
    }
  }, []);

  const setVolume = useCallback((id: SoundId, vol: number) => ambientEngine.setVolume(id, vol), []);
  const stopAll = useCallback(() => ambientEngine.stopAll(), []);
  const setMasterVol = useCallback((v: number) => {
    ambientEngine.setMasterVolume(v);
    setMaster(v);
  }, []);

  if (!visible) return null;

  const soundGrid = (
    <div className={`grid gap-2 ${variant === "panel" ? "grid-cols-3 xl:grid-cols-4" : "grid-cols-3"}`}>
      {AMBIENT_SOUNDS.map((sound) => {
        const isActive = activeSounds.some((s) => s.id === sound.id);
        const isDisabled = activeSounds.length >= MAX_LAYERS && !isActive;
        return (
          <button
            key={sound.id}
            onClick={() => !isDisabled && toggleSound(sound.id)}
            disabled={isDisabled}
            title={isActive ? `Turn off ${sound.label}` : `Play ${sound.label}`}
            className={`rounded-xl border p-2.5 text-center transition-all ${
              isActive
                ? "border-[var(--rgba-124-58-237-0_4)] bg-[var(--rgba-124-58-237-0_15)]"
                : isDisabled
                ? "border-[var(--rgba-124-58-237-0_06)] bg-transparent opacity-40 cursor-not-allowed"
                : "border-[var(--rgba-124-58-237-0_1)] bg-[var(--rgba-124-58-237-0_04)] hover:bg-[var(--rgba-124-58-237-0_09)]"
            }`}
          >
            <span className="text-base">{sound.emoji}</span>
            <p className={`text-[9px] mt-0.5 font-medium ${isActive ? "text-[var(--brand-400)]" : "text-[var(--palette-6b7280)]"}`}>
              {sound.label}
            </p>
          </button>
        );
      })}
    </div>
  );

  const presetRow = (
    <div className="flex flex-wrap gap-1.5">
      {AMBIENT_PRESETS.map((p) => (
        <button
          key={p.id}
          onClick={() => ambientEngine.applyPreset(p)}
          className="rounded-full border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-124-58-237-0_05)] px-2.5 py-1 text-[10px] font-medium text-[var(--foreground-muted)] hover:bg-[var(--rgba-124-58-237-0_12)] hover:text-[var(--brand-400)] transition-colors"
        >
          {p.emoji} {p.label}
        </button>
      ))}
    </div>
  );

  const activeSliders = activeSounds.length > 0 && (
    <div className="space-y-2">
      {activeSounds.map((s) => {
        const def = AMBIENT_SOUNDS.find((sd) => sd.id === s.id)!;
        return (
          <div key={s.id} className="flex items-center gap-2.5">
            <button
              onClick={() => ambientEngine.stop(s.id)}
              title={`Stop ${def.label}`}
              className="text-base w-6 shrink-0 text-center hover:scale-110 transition-transform"
            >
              {def.emoji}
            </button>
            <VolumeX size={11} className="text-[var(--foreground-subtle)] shrink-0" />
            <VolumeSlider value={s.volume} color={def.color} onChange={(v) => setVolume(s.id, v)} />
            <Volume2 size={11} className="text-[var(--foreground-subtle)] shrink-0" />
          </div>
        );
      })}
      <div className="flex items-center gap-2.5 border-t border-[var(--rgba-124-58-237-0_1)] pt-2">
        <SlidersHorizontal size={11} className="text-[var(--foreground-subtle)] shrink-0" />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)] shrink-0">Master</span>
        <VolumeSlider value={master} color="var(--brand-400)" onChange={setMasterVol} />
      </div>
    </div>
  );

  const emptyHint = activeSounds.length === 0 && (
    <p className="text-center text-[10px] text-[var(--foreground-subtle)]">
      Tap a sound or a preset — layer up to {MAX_LAYERS}.
    </p>
  );

  // ── Desktop panel variant ────────────────────────────────────────────────
  if (variant === "panel") {
    return (
      <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_18)] bg-[var(--rgba-12-17-40-0_75)] p-4 backdrop-blur-xl shadow-[0_8px_40px_var(--rgba-0-0-0-0_35)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Music2 size={13} className="text-[var(--brand-400)]" />
            <span className="text-xs font-semibold text-[var(--foreground-muted)]">Ambient Mixer</span>
            {activeSounds.length > 0 && (
              <span className="rounded-full bg-[var(--rgba-124-58-237-0_2)] px-2 py-0.5 text-[9px] font-semibold text-[var(--brand-400)]">
                {activeSounds.length} playing
              </span>
            )}
          </div>
          {activeSounds.length > 0 && (
            <button onClick={stopAll} className="text-[10px] text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors">
              Stop all
            </button>
          )}
        </div>
        <div className="space-y-3">
          {soundGrid}
          {presetRow}
          {activeSliders}
          {emptyHint}
        </div>
      </div>
    );
  }

  // ── Floating pill variant (mobile / small screens) ───────────────────────
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 28 }}
      className="fixed bottom-4 lg:hidden left-1/2 -translate-x-1/2 z-[var(--z-nav)] w-[calc(100%-2rem)] max-w-md"
    >
      <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_25)] bg-[var(--rgba-12-17-40-0_92)] backdrop-blur-xl shadow-[0_8px_40px_var(--rgba-0-0-0-0_4)]">
        {/* Header row */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Music2 size={13} className="text-[var(--brand-400)]" />
            <span className="text-xs font-semibold text-[var(--foreground-muted)]">Ambient Sounds</span>
            {activeSounds.length > 0 && (
              <span className="rounded-full bg-[var(--rgba-124-58-237-0_2)] px-2 py-0.5 text-[9px] font-semibold text-[var(--brand-400)]">
                {activeSounds.length} playing
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeSounds.length > 0 && (
              <button onClick={stopAll} className="text-[10px] text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors">
                Stop all
              </button>
            )}
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? "Collapse ambient sounds" : "Expand ambient sounds"}
              className="grid h-11 w-11 place-items-center rounded-[var(--radius-md)] text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground-muted)]"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>

        {/* Sound grid */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1 space-y-3">
                {soundGrid}
                {presetRow}
                {activeSliders}
                {emptyHint}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mini mixer when collapsed */}
        {!expanded && activeSounds.length > 0 && (
          <div className="flex items-center gap-2 px-4 pb-2.5">
            {activeSounds.map((s) => {
              const def = AMBIENT_SOUNDS.find((sd) => sd.id === s.id)!;
              return (
                <div key={s.id} className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-sm">{def.emoji}</span>
                  <VolumeSlider value={s.volume} color={def.color} onChange={(v) => setVolume(s.id, v)} compact />
                  <button onClick={() => ambientEngine.stop(s.id)} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors">
                    <VolumeX size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
