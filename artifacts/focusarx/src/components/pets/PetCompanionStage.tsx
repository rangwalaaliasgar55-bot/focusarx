import { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { PetStage2D } from "@/components/pets/PetStage2D";
import { petSpeciesEmoji } from "@/lib/petSpecies";
import type { ActivePet } from "@/hooks/useActivePet";
import type { PetDesignId } from "@/lib/designPacks";
import type { WildAnim } from "@/components/pets/ProceduralWildPet";
import { cn } from "@/lib/utils";

/**
 * The account's companion, drawn in the account's art pack.
 *
 * There was one of these inline on the focus page, which is why the phone never
 * had a pet: the desktop column rendered it and the mobile studying screen —
 * the surface a phone actually looks at while working — did not. Pulling it out
 * means the art-pack rule lives in one place: `wild3d` builds a body from the
 * species (`Pet3D design="wild3d"`), `classic` and `sprite` show the catalog's
 * own artwork and glyph (`PetStage2D`), and every surface that shows the pet
 * shows the same one.
 *
 * `studying` is the mood that matters here: a session in flight draws the pet
 * focused, the same way the uploads' companion reacts while the timer runs.
 * `tone` adapts the caption to the surface — the workspace panel has muted text
 * on the page background, the full-screen studying view is already dark.
 *
 * The 3D body is still a dynamic import: three.js is the single heaviest thing
 * in the client bundle and the pets page is not the only entry point that can
 * reach this component, so the pack that asks for it pays for it and the packs
 * that do not never download it.
 */
const Pet3D = lazy(() => import("@/components/Pet3D").then((m) => ({ default: m.Pet3D })));

export interface PetCompanionStageProps {
  pet: ActivePet;
  design: PetDesignId;
  /** A session is in flight — the pet is watching the work, not idling. */
  studying: boolean;
  /** Smaller stage for the `compact` layout pack and the phone overlay. */
  compact?: boolean;
  /** Show "Name · level N" under the pet. Off inside a dense overlay. */
  caption?: boolean;
  /** Where this is drawn. Only affects the caption's colour. */
  tone?: "panel" | "overlay";
  /** The stage's own height in px. Sizes the WebGL canvas, not the 2D stage. */
  size?: number;
  className?: string;
  /** A one-shot care action — the same `WildAnim` values the pets page's care
      buttons play (`wave`, `eat`, `victory`, …). */
  anim?: WildAnim;
}

export function PetCompanionStage({
  pet,
  design,
  studying,
  compact = false,
  caption = true,
  tone = "panel",
  size,
  className,
  anim,
}: PetCompanionStageProps) {
  const mood = studying ? "focused" : "happy";
  const stageHeight = size ?? (compact ? 168 : 224);
  const stageSize = size ?? (compact ? 144 : 200);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col items-center gap-2"
    >
      {design === "wild3d" ? (
        /* The wild body: the species the catalog says, built from its own
           parameters (ears, tail, wings, plan) rather than a recoloured rig. */
        <div className="w-full max-w-[280px]" style={{ height: stageHeight }}>
          <Suspense fallback={<div className="h-full w-full animate-pulse rounded-[1.75rem] bg-[var(--surface-hover)]" />}>
            <Pet3D petType={pet.slug} mood={mood} design="wild3d" anim={anim} />
          </Suspense>
        </div>
      ) : (
        /* Studio rig and Sprite both read as the catalog's own artwork on this
           surface — the difference between them is whether a WebGL device may
           upgrade to the posed rig (the pets page and the timer column do
           that); the wild pack is the one that replaces the artwork with a body
           built from the species. */
        <PetStage2D
          emoji={petSpeciesEmoji(pet.slug, pet.category)}
          imageUrl={pet.thumbnailUrl}
          species={pet.slug}
          name={pet.name}
          mood={mood}
          size={stageSize}
          className={cn("w-full max-w-[280px]", className)}
        />
      )}
      {caption && (
        <p
          className={cn(
            "text-[11px] font-medium",
            tone === "overlay" ? "text-[var(--foreground-muted)]" : "text-[var(--foreground-subtle)]",
          )}
        >
          {pet.name} · level {pet.level}
        </p>
      )}
    </motion.div>
  );
}

export default PetCompanionStage;
