import { useId } from "react";
import type { PetBodyParams } from "@/lib/petBodyParams";

/**
 * A bundled SVG animal built from body parameters.
 *
 * Companion art used to be either a catalog sprite (a network request, and
 * `null` for most staged rows) or an emoji. Neither is an animal *of a
 * species*: the emoji is a different picture on every platform, and a missing
 * sprite degrades to a paw. This draws the animal instead, from the same
 * `PetBodyParams` the 3D body uses — so a capybara looks like a capybara in
 * both renderings, and a new catalog row is a shape rather than a hole.
 *
 * The drawing is deliberately cheap: one body, a head, and the four features
 * that actually distinguish the families (ears, snout/beak, tail, wings). That
 * is not a limitation to be embarrassed about — at 24–72px, which is where this
 * is used, ears and a snout are what read. Everything is `aria-hidden`; every
 * call site prints the companion's name beside the art.
 */
export interface AnimalGlyphProps {
  params: PetBodyParams;
  /** Rendered box size in px (the art is square, `object-contain`). */
  size?: number;
  className?: string;
  /** Face mirrored (used by the trail face so the walker faces travel). */
  flip?: boolean;
}

export function AnimalGlyph({ params, size = 64, className, flip }: AnimalGlyphProps) {
  const instanceId = useId().replace(/:/g, "");
  const bodyGradientId = `animal-body-${instanceId}`;
  const shadeGradientId = `animal-shade-${instanceId}`;
  const squish = params.squish ?? 1;
  const isBird = params.plan === "bird";
  const isAquatic = params.plan === "aquatic";
  const isSerpent = params.plan === "serpent";
  const isInsect = params.plan === "insect";

  // Head sits high on a bird and low and wide on a quadruped; a serpent has no
  // separate head mass to speak of.
  const headY = isBird ? 52 : isSerpent ? 46 : 62;
  const headR = isBird ? 20 : isSerpent ? 16 : 24;

  return (
    <svg
      aria-hidden="true"
      role="presentation"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, transform: flip ? "scaleX(-1)" : undefined }}
    >
      <defs>
        <linearGradient id={bodyGradientId} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={params.body} />
          <stop offset="1" stopColor={params.patch ?? params.body} stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id={shadeGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={params.belly} />
          <stop offset="1" stopColor={params.belly} stopOpacity="0.65" />
        </linearGradient>
      </defs>

      {/* Grounding shadow — the animal reads as standing, not floating. */}
      <ellipse cx="60" cy="106" rx="30" ry="6" fill="#0f172a" opacity="0.16" />

      {/* Wings sit behind the body so the silhouette stays legible. */}
      {params.wings && !isInsect && (
        <>
          <ellipse cx="30" cy="66" rx="16" ry="24" fill={params.patch ?? params.body} opacity="0.85" transform="rotate(-16 30 66)" />
          <ellipse cx="90" cy="66" rx="16" ry="24" fill={params.patch ?? params.body} opacity="0.85" transform="rotate(16 90 66)" />
        </>
      )}
      {isInsect && (
        <>
          <ellipse cx="36" cy="58" rx="20" ry="11" fill={params.belly} opacity="0.8" transform="rotate(-22 36 58)" />
          <ellipse cx="84" cy="58" rx="20" ry="11" fill={params.belly} opacity="0.8" transform="rotate(22 84 58)" />
        </>
      )}

      {/* Tail — drawn before the body so it attaches behind it. */}
      {params.tail === "fluffy" && (
        <ellipse cx="96" cy="78" rx="17" ry="13" fill={params.patch ?? params.body} transform="rotate(-24 96 78)" />
      )}
      {params.tail === "long" && (
        <path
          d="M92 84c14-4 22-14 24-26"
          fill="none"
          stroke={params.patch ?? params.body}
          strokeWidth="8"
          strokeLinecap="round"
        />
      )}
      {params.tail === "stub" && <circle cx="94" cy="84" r="7" fill={params.patch ?? params.body} />}

      {/* Body. `squish` is the one proportion every family shares. */}
      {isSerpent ? (
        <path
          d="M24 92c8-12 22-10 30-20s22-10 34-2"
          fill="none"
          stroke={`url(#${bodyGradientId})`}
          strokeWidth={18 * squish}
          strokeLinecap="round"
        />
      ) : (
        <ellipse cx="60" cy={isBird ? 74 : 80} rx={isBird ? 26 : 30} ry={(isBird ? 26 : 28) * squish} fill={`url(#${bodyGradientId})`} />
      )}

      {/* Belly panel — what makes the body read as an animal rather than a ball. */}
      {!isSerpent && (
        <ellipse cx="60" cy={isBird ? 78 : 86} rx={isBird ? 15 : 17} ry={(isBird ? 16 : 17) * squish} fill={`url(#${shadeGradientId})`} opacity="0.9" />
      )}

      {/* Feet. */}
      {isAquatic ? (
        <>
          <path d="M44 96l-12 8M76 96l12 8" stroke={params.patch ?? params.body} strokeWidth="5" strokeLinecap="round" />
        </>
      ) : isInsect ? (
        <>
          <path d="M46 92l-8 10M74 92l8 10" stroke={params.patch ?? params.body} strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="46" cy="102" rx="9" ry="5" fill={params.patch ?? params.body} />
          <ellipse cx="74" cy="102" rx="9" ry="5" fill={params.patch ?? params.body} />
        </>
      )}

      {/* Ears. */}
      {params.ears === "pointy" && (
        <>
          <path d={`M${60 - headR + 4} ${headY - 10}l-10-20 20 6Z`} fill={params.body} />
          <path d={`M${60 + headR - 4} ${headY - 10}l10-20-20 6Z`} fill={params.body} />
        </>
      )}
      {params.ears === "round" && (
        <>
          <circle cx={60 - headR + 2} cy={headY - 12} r="9" fill={params.patch ?? params.body} />
          <circle cx={60 + headR - 2} cy={headY - 12} r="9" fill={params.patch ?? params.body} />
        </>
      )}
      {params.ears === "long" && (
        <>
          <ellipse cx={60 - 10} cy={headY - 24} rx="6" ry="18" fill={params.body} transform="rotate(-8 50 38)" />
          <ellipse cx={60 + 10} cy={headY - 24} rx="6" ry="18" fill={params.body} transform="rotate(8 70 38)" />
        </>
      )}
      {params.ears === "tuft" && (
        <>
          <path d={`M${60 - 10} ${headY - 16}l-6-14 12 4Z`} fill={params.patch ?? params.body} />
          <path d={`M${60 + 10} ${headY - 16}l6-14-12 4Z`} fill={params.patch ?? params.body} />
        </>
      )}

      {/* Horns — drawn above the head, behind the eyes. */}
      {params.horns && (
        <>
          <path d={`M${60 - headR + 6} ${headY - 12}l-6-16 12 8Z`} fill="#f2d9a8" stroke="#c9a86a" strokeWidth="1.5" />
          <path d={`M${60 + headR - 6} ${headY - 12}l6-16-12 8Z`} fill="#f2d9a8" stroke="#c9a86a" strokeWidth="1.5" />
        </>
      )}

      {/* Head. */}
      <circle cx="60" cy={headY} r={headR} fill={params.body} />
      <circle cx="60" cy={headY + 6} r={headR * 0.62} fill={params.belly} opacity="0.75" />

      {/* Face features. */}
      <circle cx={60 - headR * 0.36} cy={headY - 3} r={Math.max(2.4, headR * 0.15)} fill="#12161f" />
      <circle cx={60 + headR * 0.36} cy={headY - 3} r={Math.max(2.4, headR * 0.15)} fill="#12161f" />
      {params.beak ? (
        <path d={`M60 ${headY + 5}l-8 6 8 5 8-5Z`} fill="#f2b33d" stroke="#c98a1e" strokeWidth="1" strokeLinejoin="round" />
      ) : params.snout ? (
        <>
          <ellipse cx="60" cy={headY + 11} rx={headR * 0.42} ry={headR * 0.3} fill={params.belly} />
          <ellipse cx="60" cy={headY + 9} rx={headR * 0.16} ry={headR * 0.11} fill="#2b2f3a" />
        </>
      ) : (
        <path d={`M${60 - 5} ${headY + 11}q5 5 10 0`} fill="none" stroke="#2b2f3a" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}
