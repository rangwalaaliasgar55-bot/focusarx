"use client";

import { use3DQuality } from "@/hooks/use3DQuality";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AppearanceSettings() {
  const { quality, appearance, setQuality, setAppearance, effectiveQuality } = use3DQuality();

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="text-sm">Appearance</CardTitle>
        <CardDescription className="text-xs">Control visual effects for performance and battery.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
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
