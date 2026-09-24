import type { LucideProps } from "lucide-react";
import {
  Atom,
  BookOpenCheck,
  Brain,
  Coffee,
  Compass,
  Leaf,
  MoonStar,
  Mountain,
  Orbit,
  Rocket,
  Sparkles,
  Waves,
} from "lucide-react";

/**
 * Small curated identity marks for profiles. They use Lucide (ISC licensed),
 * which is already shipped by the app; no patched Nerd Font or unreviewed glyph
 * bundle is added just to render profile symbols. See the labels in the picker
 * for accessible names.
 */
export const PROFILE_ICON_OPTIONS = [
  { id: "orbit", label: "Orbit", Icon: Orbit },
  { id: "reader", label: "Reader", Icon: BookOpenCheck },
  { id: "mind", label: "Mind", Icon: Brain },
  { id: "coffee", label: "Coffee", Icon: Coffee },
  { id: "compass", label: "Compass", Icon: Compass },
  { id: "leaf", label: "Leaf", Icon: Leaf },
  { id: "moon", label: "Moon", Icon: MoonStar },
  { id: "mountain", label: "Mountain", Icon: Mountain },
  { id: "rocket", label: "Rocket", Icon: Rocket },
  { id: "spark", label: "Spark", Icon: Sparkles },
  { id: "waves", label: "Waves", Icon: Waves },
  { id: "atom", label: "Atom", Icon: Atom },
] as const;

export type ProfileIconId = (typeof PROFILE_ICON_OPTIONS)[number]["id"];

export const PROFILE_ICON_IDS = PROFILE_ICON_OPTIONS.map((option) => option.id) as readonly ProfileIconId[];

export function isProfileIconId(value: unknown): value is ProfileIconId {
  return typeof value === "string" && PROFILE_ICON_IDS.includes(value as ProfileIconId);
}

export function ProfileIcon({ id, ...props }: { id?: string | null } & LucideProps) {
  const option = PROFILE_ICON_OPTIONS.find((candidate) => candidate.id === id);
  if (!option) return null;
  const Icon = option.Icon;
  return <Icon {...props} />;
}
