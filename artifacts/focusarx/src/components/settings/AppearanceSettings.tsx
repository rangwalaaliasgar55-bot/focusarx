
import { useState } from "react";
import { Check, Crown, Palette, RotateCcw } from "lucide-react";
import { use3DQuality } from "@/hooks/use3DQuality";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { THEME_META, useTheme, type Theme } from "@/lib/theme";
import { ACCENT_PRESETS, useAccent } from "@/lib/accent";
import {
  detectTier,
  getTierPreference,
  probeDeviceCaps,
  setTierPreference,
  type DeviceTier,
  type TierPreference,
} from "@/lib/deviceTier";
import { SCENE_PRESETS, useScenePreset, type ScenePresetId } from "@/lib/scenePreset";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

const THEME_ORDER: Theme[] = ["dark", "light", "midnight-gold", "aurora", "crimson"];

function ThemeAndColorSettings() {
  const [theme, setTheme] = useTheme();
  const [accent, setAccentColor, resetAccent] = useAccent();
  const [lockedTheme, setLockedTheme] = useState<Theme | null>(null);

  const pickTheme = async (t: Theme) => {
    const ok = await setTheme(t);
    setLockedTheme(ok ? null : t);
  };

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="text-sm">Theme & color</CardTitle>
        <CardDescription className="text-xs">
          Choose a theme and make the colors yours. Your accent re-grades buttons, glows, shadows, and highlights across FocusArx.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Theme</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {THEME_ORDER.map((t) => {
              const meta = THEME_META[t];
              const active = theme === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => void pickTheme(t)}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-[64px] flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
                    active
                      ? "border-[var(--brand-500)] bg-[var(--brand-soft)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-1)] hover:border-[var(--border-strong)]",
                  )}
                >
                  <span className={cn("h-5 w-full rounded-md", meta.preview)} aria-hidden />
                  <span className="flex w-full items-center justify-between gap-1">
                    <span className={cn("text-xs font-semibold", active ? "text-[var(--brand-strong)]" : "text-[var(--foreground-muted)]")}>{meta.label}</span>
                    {meta.premium && <Crown size={12} className="shrink-0 text-[var(--warning)]" aria-label="Premium theme" />}
                  </span>
                </button>
              );
            })}
          </div>
          {lockedTheme && (
            <p className="rounded-lg bg-[var(--warning-soft)] p-2.5 text-xs text-[var(--warning)]">
              {THEME_META[lockedTheme].label} is a Premium theme.{" "}
              <a href="/premium" className="font-bold underline">Unlock Premium</a> to use it.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Accent color</Label>
            {accent.customized && (
              <button
                type="button"
                onClick={resetAccent}
                className="flex min-h-[28px] items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              >
                <RotateCcw size={12} /> Reset to default
              </button>
            )}
          </div>
          <p className="text-xs text-[var(--foreground-subtle)]">Pick a preset or any custom color — the interface instantly re-grades around it.</p>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {ACCENT_PRESETS.map((preset) => {
              const active = accent.color.toUpperCase() === preset.color.toUpperCase();
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  aria-label={`${preset.label} accent color`}
                  aria-pressed={active}
                  onClick={() => setAccentColor(preset.color)}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full border-2 transition-transform hover:scale-110",
                    active ? "border-[var(--foreground)]" : "border-transparent",
                  )}
                  style={{ background: preset.color }}
                >
                  {active && <Check size={15} className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" />}
                </button>
              );
            })}
            <label
              className="relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-hover)] transition-colors hover:border-[var(--brand-400)]"
              title="Pick a custom color"
            >
              <Palette size={15} className="pointer-events-none text-[var(--foreground-muted)]" />
              <input
                type="color"
                value={accent.color}
                onChange={(e) => setAccentColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Pick a custom accent color"
              />
            </label>
          </div>
          <p className="text-xs text-[var(--foreground-subtle)]">
            Current: <span className="font-mono font-semibold text-[var(--foreground-muted)]">{accent.color}</span>
            {accent.customized ? "" : " (default)"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function EffectsSettings() {
  const { quality, appearance, setQuality, setAppearance, effectiveQuality } = use3DQuality();
  const [tierPref, setTierPrefState] = useState<TierPreference>(() => getTierPreference());
  const [detectedTier] = useState<DeviceTier>(() => detectTier(probeDeviceCaps()));
  const [scenePreset, pickScenePreset] = useScenePreset();
  const [premium, setPremium] = useState<boolean | null>(null);
  const [sceneLocked, setSceneLocked] = useState(false);

  const pickTier = (pref: TierPreference) => {
    setTierPreference(pref);
    setTierPrefState(pref);
  };

  // Pro check without react-query (this panel renders outside providers in
  // tests and must never suspend): direct fetch, cached per mount.
  const ensurePremium = async (): Promise<boolean> => {
    if (premium !== null) return premium;
    try {
      const token = getToken();
      const res = await fetch("/api/premium/status", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        setPremium(false);
        return false;
      }
      const data = await res.json();
      const ok = data?.isPremium === true;
      setPremium(ok);
      return ok;
    } catch {
      setPremium(false);
      return false;
    }
  };

  const pickScene = (id: ScenePresetId) => {
    const preset = SCENE_PRESETS.find((p) => p.id === id);
    // Pro presets need Pro; everyone else falls back to Core silently.
    if (preset?.pro) {
      void ensurePremium().then((ok) => {
        if (!ok) {
          setSceneLocked(true);
          return;
        }
        setSceneLocked(false);
        pickScenePreset(id);
      });
      return;
    }
    setSceneLocked(false);
    pickScenePreset(id);
  };

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="text-sm">Appearance</CardTitle>
        <CardDescription className="text-xs">Control visual effects for performance and battery.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Visual quality</Label>
          <p className="text-xs text-[var(--foreground-subtle)]">Auto-detected: <span className="font-bold capitalize">{detectedTier}</span>. Full = 3D scenes, Lite = 2D scenes, Essential = static ring. Applies to 3D scenes on next page.</p>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Visual quality">
            {(["auto", "full", "lite", "essential"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => pickTier(t)}
                className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold capitalize transition-colors ${
                  tierPref === t
                    ? "border-[var(--brand-500)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-subtle)]"
                }`}
                aria-pressed={tierPref === t}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Scene</Label>
          <p className="text-xs text-[var(--foreground-subtle)]">The visual behind the timer. Core and Minimal Ring ship now; the rest are Pro and still in the studio.</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Scene preset">
            {SCENE_PRESETS.map((p) => {
              const active = scenePreset === p.id;
              const locked = !p.available;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={locked}
                  onClick={() => pickScene(p.id as ScenePresetId)}
                  className={`min-h-[44px] rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? "border-[var(--brand-500)] bg-[var(--brand-soft)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-1)]"
                  }`}
                  aria-pressed={active}
                  title={p.available ? (p.pro ? `${p.blurb} (Pro)` : p.blurb) : `${p.blurb} (coming soon)`}
                >
                  <span className="block text-xs font-bold text-[var(--foreground)]">
                    {p.label}
                    {p.pro && (
                      <span className="ml-1.5 rounded-full bg-[var(--warning-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--warning)]">
                        Pro
                      </span>
                    )}
                  </span>
                  <span className="block text-[11px] text-[var(--foreground-subtle)]">{p.blurb}</span>
                </button>
              );
            })}
          </div>
          {sceneLocked && (
            <p className="text-xs text-[var(--warning)]" role="status">
              That scene needs Pro — unlock it with tokens or card on the Premium page.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">3D effects</Label>
          <p className="text-xs text-[var(--foreground-subtle)]">High uses shadows, reflections, and post-processing. Battery saver reduces detail and disables animations.</p>
          <Select value={appearance} onValueChange={(v) => setAppearance(v as any)}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="on">On — full effects</SelectItem>
              <SelectItem value="reduced">Reduced — lighter effects</SelectItem>
              <SelectItem value="off">Off — 2D fallback</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">3D quality</Label>
          <p className="text-xs text-[var(--foreground-subtle)]">Effective: <span className="font-bold capitalize">{effectiveQuality}</span>. High = shadows + reflections + particles (22), Balanced = shadows + 12 particles, Battery = 2 objects, no shadows.</p>
          <div className="grid grid-cols-3 gap-2">
            {(["battery", "balanced", "high"] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuality(q)}
                className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold capitalize transition-colors ${
                  quality === q
                    ? "border-[var(--brand-500)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-subtle)]"
                }`}
                aria-pressed={quality === q}
              >
                {q === "battery" ? "Battery saver" : q}
              </button>
            ))}
          </div>
          <div className="rounded-lg bg-[var(--surface-hover)] p-3 text-[11px] text-[var(--foreground-subtle)]">
            <p className="font-semibold text-[var(--foreground)]">Current config:</p>
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
              <li>DPR: {quality === "high" ? "1–2" : quality === "balanced" ? "1–1.5" : "1–1.2"}</li>
              <li>Shadows: {effectiveQuality === "high" ? "1024px" : effectiveQuality === "balanced" ? "512px" : "off"}</li>
              <li>Lights: {effectiveQuality === "high" ? 3 : effectiveQuality === "balanced" ? 2 : 1}</li>
              <li>Animated objects: {effectiveQuality === "high" ? 10 : effectiveQuality === "balanced" ? 5 : 2}</li>
              <li>Particles: {effectiveQuality === "high" ? 22 : effectiveQuality === "balanced" ? 12 : 0}</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AppearanceSettings() {
  return (
    <>
      <ThemeAndColorSettings />
      <EffectsSettings />
    </>
  );
}
