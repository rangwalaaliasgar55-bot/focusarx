import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Presentation stage for a companion when the three.js pet is not an option —
 * WebGL missing, quality set to 2D, or a crash recovery.
 *
 * Ported from the interface-upgrade proposal in `focusarx-resource` (its
 * `PetStage`), with the proposal's looping parts deliberately left out: no
 * orbiting conic ring, no breathing halo, no drifting particulate. The design
 * audit bans looping decoration, so everything that moves here is a reaction
 * — pointer tilt, hover brightening, and the tap ripple — and everything
 * collapses under `prefers-reduced-motion`.
 *
 * The interaction is deliberately cosmetic. Bond XP is only awarded by the
 * server for verified focus sessions (`lib/petBond.ts`; the public `/bond`
 * route was removed as a 410 because clients farmed it), so the stage says
 * "say hi", never anything that could read as a reward.
 */

export type PetRarity = "common" | "rare" | "epic" | "legendary" | "exclusive";

/** Halo/glow tint per rarity. Text colours stay on the page's RARITY_COLOR
   tokens; these carry the alpha a glow needs. */
export const RARITY_GLOW: Record<PetRarity, string> = {
  common: "rgba(148,163,184,0.38)",
  rare: "rgba(6,182,212,0.42)",
  epic: "rgba(139,92,246,0.46)",
  legendary: "rgba(251,191,36,0.5)",
  exclusive: "rgba(236,72,153,0.5)",
};

const MOOD_LABEL: Record<string, string> = {
  excited: "excited",
  happy: "happy",
  sleepy: "sleepy",
};

interface PetStage2DProps {
  /** Glyph that stands in for the creature (the catalog is emoji-based). */
  emoji: string;
  /** Animated sprite from the catalog, shown instead of the glyph when it
     loads — this is what makes released staged pets move on the page. */
  imageUrl?: string | null;
  /** Companion name — used in the accessible label. */
  name: string;
  rarity?: string;
  /** Server-derived mood (`GET /api/pets`). Omit to hide the chip. */
  mood?: string | null;
  /** Stage height in px. */
  size?: number;
  className?: string;
}

export function PetStage2D({ emoji, imageUrl, name, rarity = "common", mood, size = 280, className }: PetStage2DProps) {
  const reduceMotion = useReducedMotion();
  const finePointer = useMediaQuery("(pointer: fine)");
  const [hovered, setHovered] = useState(false);
  const [taps, setTaps] = useState(0);
  const [spriteFailed, setSpriteFailed] = useState(false);

  const glow = RARITY_GLOW[(rarity as PetRarity)] ?? RARITY_GLOW.common;
  const discSize = Math.round(size * 0.52);

  /* Pointer tilt. Motion values + springs keep pointermove transform-only;
     the gate means touch devices get the tap ripple but no tilt chase. */
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 120, damping: 18, mass: 0.7 };
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-12, 12]), spring);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [9, -9]), spring);
  const tilt = finePointer && !reduceMotion;

  /* The ripple is keyed by tap count and removed after its animation, so a
     screen reader sees one labelled button, not a pile of finished spans. */
  const [rippleKey, setRippleKey] = useState<number | null>(null);
  useEffect(() => {
    if (rippleKey === null) return;
    const t = window.setTimeout(() => setRippleKey(null), 950);
    return () => window.clearTimeout(t);
  }, [rippleKey]);

  const sayHi = () => {
    if (reduceMotion) return;
    setTaps((n) => n + 1);
    setRippleKey(Date.now());
  };

  const moodLabel = mood ? (MOOD_LABEL[mood] ?? mood) : null;

  return (
    <button
      type="button"
      aria-label={`Say hi to ${name}`}
      onClick={sayHi}
      onPointerMove={
        tilt
          ? (event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              px.set((event.clientX - rect.left) / rect.width - 0.5);
              py.set((event.clientY - rect.top) / rect.height - 0.5);
            }
          : undefined
      }
      onPointerLeave={
        tilt
          ? () => {
              px.set(0);
              py.set(0);
              setHovered(false);
            }
          : undefined
      }
      onPointerEnter={tilt ? () => setHovered(true) : undefined}
      className={cn(
        "group relative block w-full select-none overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border-strong)] text-center outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        className,
      )}
      style={{
        height: size,
        background: "radial-gradient(120% 88% at 50% 20%, var(--brand-soft), transparent 58%), var(--surface)",
        perspective: 900,
      }}
    >
      {/* Rarity halo — brightens on hover, a reaction rather than a loop. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[44%] h-[82%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-opacity duration-[var(--duration-slow)]"
        style={{ background: `radial-gradient(circle, ${glow}, transparent 68%)`, opacity: hovered ? 0.9 : 0.5 }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        style={tilt ? { rotateX, rotateY, transformStyle: "preserve-3d" } : undefined}
      >
        {/* Floor shadow grounding the creature. */}
        <div
          className="pointer-events-none absolute bottom-[10%] left-1/2 h-[16%] w-[58%] -translate-x-1/2 rounded-[50%] blur-md"
          style={{ background: `radial-gradient(ellipse at 50% 40%, ${glow}, transparent 70%)` }}
        />

        {/* The creature. Tap wiggle runs once per interaction; the ripple
            ring expands out from the disc. */}
        <motion.div
          className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2"
          animate={taps > 0 && !reduceMotion ? { scale: [1, 1.08, 1], rotate: [0, -3, 2, 0] } : { scale: 1, rotate: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="relative grid place-items-center rounded-full bg-[var(--surface-raised)]"
            style={{
              width: discSize,
              height: discSize,
              boxShadow: `0 30px 60px -24px rgba(0,0,0,0.55), 0 0 64px -6px ${glow}`,
              border: `2px solid ${glow}`,
            }}
          >
            {imageUrl && !spriteFailed ? (
              // Decorative: the stage button carries the accessible name
              // ("Say hi to …"), so the sprite itself is aria-hidden.
              <img
                src={imageUrl}
                alt=""
                aria-hidden="true"
                width={Math.round(discSize * 0.72)}
                height={Math.round(discSize * 0.72)}
                loading="lazy"
                referrerPolicy="no-referrer"
                draggable={false}
                onError={() => setSpriteFailed(true)}
                className="object-contain [image-rendering:pixelated]"
                style={{ width: discSize * 0.72, height: discSize * 0.72 }}
              />
            ) : (
              <span aria-hidden="true" className="leading-none" style={{ fontSize: discSize * 0.5 }}>
                {emoji}
              </span>
            )}
            {/* No AnimatePresence here: the ring finishes at opacity 0, so the
                timeout unmount is invisible and costs no exit-animation bookkeeping. */}
            {rippleKey !== null && (
              <motion.span
                key={rippleKey}
                data-ripple="true"
                className="pointer-events-none absolute inset-0 rounded-full border-2"
                style={{ borderColor: glow }}
                initial={{ scale: 0.85, opacity: 0.9 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
          </div>
        </motion.div>
      </motion.div>

      {(moodLabel || taps > 0) && (
        <span className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-overlay)] px-3.5 py-1.5 backdrop-blur-xl">
          {moodLabel && (
            <>
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-muted)]">{moodLabel}</span>
              <span aria-hidden="true" className="text-[var(--border-strong)]">·</span>
            </>
          )}
          <span className="text-[0.6875rem] font-medium text-[var(--foreground-subtle)]">
            {taps > 0 ? `${name} noticed you` : "tap to say hi"}
          </span>
        </span>
      )}
    </button>
  );
}
