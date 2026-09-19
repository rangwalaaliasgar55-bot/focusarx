import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Animated pet artwork wherever the catalog carries it.
 *
 * Released staged pets bring an animated sprite URL (PokeAPI / Pokémon
 * Showdown lineage, set by the admin release pipeline); the original six
 * companions have none and keep their glyphs. When the sprite is missing,
 * blocked, or fails to load, the glyph renders instead — a broken image icon
 * must never be what a pet looks like. The sprite is aria-hidden: every card
 * already prints the companion's name beside it.
 */
interface PetSpriteProps {
  /** Sprite URL from the catalog (`thumbnailUrl`), or null/undefined. */
  src?: string | null;
  /** Emoji glyph used when there is no (working) sprite. */
  glyph: string;
  /** Rendered box size in px (art is square, object-contain). */
  size?: number;
  className?: string;
}

export function PetSprite({ src, glyph, size = 64, className }: PetSpriteProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span aria-hidden="true" className={cn("inline-block leading-none", className)} style={{ fontSize: size * 0.62 }}>
        {glyph}
      </span>
    );
  }

  return (
    // Decorative: the companion's name sits next to the sprite in every
    // card/modal, so the artwork is aria-hidden (image-hygiene gate).
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn("inline-block object-contain [image-rendering:pixelated]", className)}
      style={{ width: size, height: size }}
    />
  );
}
