import { useState } from "react";
import { Check, Lock, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AnimalGlyph } from "@/components/pets/AnimalGlyph";
import {
  BATTLE_DESIGNS,
  LAYOUTS,
  PET_DESIGNS,
  TIMER_FACE_LABELS,
  type AppearanceField,
} from "@/lib/designPacks";
import { TIMER_THEMES } from "@/lib/timerTheme";
import { useAppearance, useAppearanceState, useResetAppearance, useUpdateAppearance } from "@/lib/appearance";
import { petBodyParams } from "@/lib/petBodyParams";
import { useActivePet } from "@/hooks/useActivePet";
import { cn } from "@/lib/utils";

/**
 * Design packs in settings — face, companion art, battle board, layout.
 *
 * This is the user's half of the assignment the admin console also writes. The
 * two writers are made legible here rather than hidden: when an admin has pinned
 * the account, the section says so, the options render as a preview of what is
 * pinned, and the write path is refused (the API answers 409) instead of the
 * choice being accepted and then overwritten by the next sweep.
 *
 * Every option shows its own preview built from the same components the real
 * surface uses — the companion uses `AnimalGlyph`, the faces print their own
 * registry blurbs — because "which design" is not a decision anyone can make
 * from a label alone.
 */

function OptionCard({
  active,
  disabled,
  label,
  blurb,
  onClick,
  preview,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  blurb: string;
  onClick: () => void;
  preview?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex min-h-[64px] flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
        active ? "border-[var(--brand-500)] bg-[var(--brand-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-1)] hover:border-[var(--border-strong)]",
        disabled && "opacity-60",
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className={cn("text-xs font-semibold", active ? "text-[var(--brand-strong)]" : "text-[var(--foreground-muted)]")}>{label}</span>
        {active && <Check size={14} className="shrink-0 text-[var(--brand-strong)]" aria-hidden="true" />}
      </span>
      {preview && <span aria-hidden="true">{preview}</span>}
      <span className="text-[11px] leading-snug text-[var(--foreground-subtle)]">{blurb}</span>
    </button>
  );
}

export function DesignPackSettings() {
  const appearance = useAppearanceState();
  const update = useUpdateAppearance();
  const reset = useResetAppearance();
  const { data: activePet } = useActivePet();
  const [pending, setPending] = useState<AppearanceField | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Hydrates the store from the account.
  useAppearance();

  const locked = appearance.locked;
  const fields = appearance.fields;
  const petParams = petBodyParams(activePet?.slug ?? "bulbasaur", activePet?.category);

  const choose = async (field: AppearanceField, value: string) => {
    setPending(field);
    setNotice(null);
    const result = await update({ [field]: value } as never);
    setPending(null);
    if (result.locked) {
      setNotice("Your design is managed by an admin. Ask them to release it if you want to choose again.");
    } else if (result.ok === false && result.error) {
      setNotice(result.error);
    }
  };

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="text-sm">Design packs</CardTitle>
        <CardDescription className="text-xs">
          How your timer, companion and battles look. Your account remembers the choice, so it follows you to another device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {locked && (
          <p className="flex items-start gap-2 rounded-lg bg-[var(--warning-soft)] p-3 text-[11px] text-[var(--warning)]">
            <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              An admin has pinned these designs for your account. You can preview the options, but only they can change or release them.
            </span>
          </p>
        )}
        {notice && <p className="rounded-lg bg-[var(--surface-hover)] p-2.5 text-[11px] text-[var(--foreground-muted)]">{notice}</p>}

        {/* Timer face */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-medium">Timer face</Label>
            <span className="text-[11px] text-[var(--foreground-subtle)]">Also switchable from the timer itself</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {TIMER_THEMES.map((face) => (
              <OptionCard
                key={face.id}
                active={fields.timerFace === face.id}
                disabled={locked || pending === "timerFace"}
                label={face.label}
                blurb={face.blurb}
                onClick={() => void choose("timerFace", face.id)}
              />
            ))}
          </div>
        </div>

        {/* Companion art */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Companion art</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PET_DESIGNS.map((design) => (
              <OptionCard
                key={design.id}
                active={fields.petDesign === design.id}
                disabled={locked || pending === "petDesign"}
                label={design.label}
                blurb={design.blurb}
                onClick={() => void choose("petDesign", design.id)}
                preview={
                  design.id === "sprite" ? (
                    <span className="text-[11px] font-semibold text-[var(--foreground-subtle)]">2D artwork only</span>
                  ) : (
                    <AnimalGlyph
                      params={design.id === "wild3d" ? petParams : { ...petParams, ears: "tuft", tail: "stub", beak: true, wings: true, plan: "bird" }}
                      size={design.id === "wild3d" ? 40 : 34}
                    />
                  )
                }
              />
            ))}
          </div>
          <p className="text-[11px] text-[var(--foreground-subtle)]">
            Wild 3D builds every catalog species as its own animal; the studio rig keeps the original six hand-built models.
          </p>
        </div>

        {/* Battle board */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Battle board</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {BATTLE_DESIGNS.map((design) => (
              <OptionCard
                key={design.id}
                active={fields.battleDesign === design.id}
                disabled={locked || pending === "battleDesign"}
                label={design.label}
                blurb={design.blurb}
                onClick={() => void choose("battleDesign", design.id)}
                preview={
                  <span className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="inline-block h-2 w-6 rounded-sm"
                        style={{ background: i === 0 ? "var(--brand-500)" : "var(--surface-3)" }}
                      />
                    ))}
                  </span>
                }
              />
            ))}
          </div>
        </div>

        {/* Workspace layout */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Workspace layout</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {LAYOUTS.map((design) => (
              <OptionCard
                key={design.id}
                active={fields.layout === design.id}
                disabled={locked || pending === "layout"}
                label={design.label}
                blurb={design.blurb}
                onClick={() => void choose("layout", design.id)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void reset().then((r) => r.locked && setNotice("Your design is managed by an admin."))}
            disabled={locked || appearance.isDefault}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground-subtle)] transition-colors hover:border-[var(--border-strong)] disabled:opacity-50"
          >
            <Sparkles size={12} aria-hidden="true" /> Reset to defaults
          </button>
          <span className="text-[11px] text-[var(--foreground-subtle)]">
            {appearance.isDefault ? "You are on the defaults." : `Saved${appearance.source === "admin" ? " by an admin" : ""}.`}
          </span>
        </div>

        <p className="text-[11px] text-[var(--foreground-subtle)]">
          Current: {TIMER_FACE_LABELS[fields.timerFace]} · {PET_DESIGNS.find((d) => d.id === fields.petDesign)?.label} ·{" "}
          {BATTLE_DESIGNS.find((d) => d.id === fields.battleDesign)?.label} · {LAYOUTS.find((d) => d.id === fields.layout)?.label}
        </p>
      </CardContent>
    </Card>
  );
}

export default DesignPackSettings;
