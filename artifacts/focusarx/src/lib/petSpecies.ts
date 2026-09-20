/**
 * Species visuals for the pet system — the single source of truth shared by
 * the focus-tab companion, the pets page and the battle arena.
 *
 * Why this exists: the 2026-09 pet release moved companions from a fixed
 * 6-species table (`user_pets.petType`) to a catalog (`pet_catalog`) with a
 * dozen species, but every emoji/color map in the UI still listed only the
 * original six. Any newly-released species (capybara, otter, axolotl, …)
 * silently fell back to the default owl on the focus tab and to a paw glyph
 * on the pets page. One map here means a new catalog row can never be
 * forgotten in four places again.
 *
 * Anything unknown still falls back (category glyph, then the paw), so a
 * brand-new catalog entry added server-side degrades gracefully instead of
 * rendering as a different animal.
 */

export interface PetSpeciesVisual {
  emoji: string;
  /** CSS color used for glows, level badges and name text. */
  color: string;
}

/** Keyed by `pet_catalog.slug` (== legacy `user_pets.petType`). */
const SPECIES: Record<string, PetSpeciesVisual> = {
  owl:      { emoji: "🦉", color: "var(--palette-amber-400)" },
  fox:      { emoji: "🦊", color: "var(--color-error)" },
  dragon:   { emoji: "🐲", color: "var(--brand-500)" },
  robot:    { emoji: "🤖", color: "var(--palette-06b6d4)" },
  cat:      { emoji: "🐱", color: "var(--palette-ec4899)" },
  phoenix:  { emoji: "🦅", color: "var(--palette-f97316)" },
  turtle:   { emoji: "🐢", color: "var(--brand-teal)" },
  panda:    { emoji: "🐼", color: "var(--foreground)" },
  unicorn:  { emoji: "🦄", color: "var(--palette-violet-400)" },
  axolotl:  { emoji: "🦎", color: "var(--palette-ec4899)" },
  capybara: { emoji: "🦫", color: "var(--palette-amber-400)" },
  otter:    { emoji: "🦦", color: "var(--palette-06b6d4)" },
};

/** Fallback glyph per catalog category, mirroring the pets-page filter chips. */
const CATEGORY_EMOJI: Record<string, string> = {
  starter: "🌱",
  free: "🐾",
  achievement: "🏆",
  premium: "👑",
  seasonal: "🍂",
  event: "🎉",
  legendary: "🌟",
  exclusive: "💎",
  admin_drop: "🛡️",
};

const DEFAULT_VISUAL: PetSpeciesVisual = { emoji: "🐾", color: "var(--brand-400)" };

/**
 * Resolve the visual for a pet. `slug` is the catalog slug (legacy pets store
 * it in `petType`); `category` is the catalog category, used only when the
 * slug is unknown (e.g. a Gemini-seeded catalog entry the UI has never seen).
 */
export function petSpeciesVisual(
  slug?: string | null,
  category?: string | null,
): PetSpeciesVisual {
  const bySlug = slug ? SPECIES[slug] : undefined;
  if (bySlug) return bySlug;
  const byCategory = category ? CATEGORY_EMOJI[category] : undefined;
  if (byCategory) return { emoji: byCategory, color: DEFAULT_VISUAL.color };
  return DEFAULT_VISUAL;
}

/** Emoji only — the common case. */
export function petSpeciesEmoji(slug?: string | null, category?: string | null): string {
  return petSpeciesVisual(slug, category).emoji;
}

/** Category chip glyph — shared with the pets page filters. */
export function petCategoryEmoji(category?: string | null): string {
  return (category ? CATEGORY_EMOJI[category] : undefined) ?? "🐾";
}
