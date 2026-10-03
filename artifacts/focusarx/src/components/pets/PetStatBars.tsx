import { statsFor } from "@/lib/petBattle";
import { cn } from "@/lib/utils";

/**
 * The companion's four stats, as bars — the rows the uploads put under the pet.
 *
 * `redesign-focusarx-frontend-and-pet/src/pages/Companion.tsx` showed HP, ATK,
 * DEF and SPD as labelled bars beside the pet, normalised against a fixed
 * `maxStat` table of its own (`{ hp: 260, atk: 90, def: 75, spd: 70 }`). The
 * rows, the labels and the shape are theirs; only the numbers are different,
 * because in that build the stats came from its local store while here they
 * come from the engine that actually decides a fight (`lib/petBattle.statsFor`).
 *
 * The ceiling is the same species at the level cap rather than a flat table.
 * A flat table is a table for one build's curve: copying theirs would draw a
 * level-20 owl at 76% HP and a level-1 owl at 22%, which is a picture of their
 * balance, not of this one. The same species at `maxLevel` means the bar always
 * answers the question it looks like it answers — "how far along is this pet".
 */
export interface PetStatBarsProps {
  /** Catalog slug — the stats are species-shaped (stable per-species variance). */
  slug: string;
  level: number;
  /** The level cap to normalise against. Defaults to the app's 20. */
  maxLevel?: number;
  /** Tighter rows for a card that already has a lot in it. */
  compact?: boolean;
  className?: string;
}

const ROWS = [
  { key: "hp", label: "HP", colour: "var(--color-success)" },
  { key: "atk", label: "ATK", colour: "var(--color-error)" },
  { key: "def", label: "DEF", colour: "var(--info)" },
  { key: "spd", label: "SPD", colour: "var(--palette-amber-400)" },
] as const;

export function PetStatBars({ slug, level, maxLevel = 20, compact = false, className }: PetStatBarsProps) {
  const stats = statsFor(slug, level);
  const ceiling = statsFor(slug, maxLevel);

  return (
    <dl className={cn("w-full space-y-1.5", compact && "space-y-1", className)} data-testid="pet-stat-bars">
      {ROWS.map(({ key, label, colour }) => {
        const value = stats[key];
        const max = Math.max(1, ceiling[key]);
        const pct = Math.min(100, Math.round((value / max) * 100));
        return (
          <div key={key} className="flex items-center gap-2">
            <dt className={cn("shrink-0 font-semibold text-[var(--foreground-subtle)]", compact ? "w-8 text-[10px]" : "w-10 text-[11px]")}>
              {label}
            </dt>
            <dd className="flex flex-1 items-center gap-2">
              <span
                className={cn("relative flex-1 overflow-hidden rounded-full bg-[var(--surface-1)]", compact ? "h-1.5" : "h-2")}
                // The bar is decoration around a number that is also printed,
                // so it carries no role of its own — a screen reader gets the
                // value, not a percentage of an unspoken maximum.
                aria-hidden="true"
              >
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: colour }} />
              </span>
              <span className={cn("shrink-0 text-right font-bold tabular-nums text-[var(--foreground)]", compact ? "w-8 text-[10px]" : "w-9 text-[11px]")}>
                {value}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export default PetStatBars;
