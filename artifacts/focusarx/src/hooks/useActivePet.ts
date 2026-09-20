import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";

/**
 * The user's currently-active companion, normalized across both storage
 * systems: the catalog release keeps pets in `user_pet_inventory` (many pets,
 * one `isActive`), while older accounts only have the single legacy
 * `user_pets` row. Reading only the legacy row is what made new-release pets
 * show up as the default owl — or not at all — on surfaces that never
 * migrated (the focus tab's companion and battle arena).
 */
export interface ActivePet {
  /** Catalog slug (== legacy `petType`), e.g. "capybara". */
  slug: string;
  /** Nickname, catalog name, or legacy pet name. */
  name: string;
  level: number;
  /** Catalog category — used for the species-glyph fallback. */
  category?: string;
}

interface InventoryRow {
  inventory: { isActive: boolean; level: number; nickname: string | null };
  catalog: { slug: string; name: string; category: string } | null;
}

/** Fired by the pets page after adopting/activating, so mounted listeners re-read. */
export const ACTIVE_PET_EVENT = "focusarx:pet-activated";

export async function fetchActivePet(): Promise<ActivePet | null> {
  const h: Record<string, string> = {};
  const token = getToken();
  if (token) h["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch("/api/pets/inventory", { headers: h });
    if (res.ok) {
      const data = (await res.json()) as { inventory?: InventoryRow[] };
      const active = (data.inventory ?? []).find((row) => row.inventory?.isActive);
      if (active) {
        return {
          slug: active.catalog?.slug ?? "owl",
          name: active.inventory.nickname ?? active.catalog?.name ?? "Companion",
          level: active.inventory.level ?? 1,
          category: active.catalog?.category,
        };
      }
      if (data.inventory && data.inventory.length > 0) {
        const first = data.inventory[0]!;
        return {
          slug: first.catalog?.slug ?? "owl",
          name: first.inventory.nickname ?? first.catalog?.name ?? "Companion",
          level: first.inventory.level ?? 1,
          category: first.catalog?.category,
        };
      }
    }
  } catch {
    /* offline — legacy fetch below will also fail quietly */
  }

  try {
    const res = await fetch("/api/pets", { headers: h });
    if (res.ok) {
      const data = (await res.json()) as {
        pet?: { petType: string; petName: string | null; petLevel: number } | null;
      };
      if (data.pet) {
        return {
          slug: data.pet.petType,
          name: data.pet.petName ?? data.pet.petType,
          level: data.pet.petLevel ?? 1,
        };
      }
    }
  } catch {
    /* ignore */
  }

  // Fallback starter companion if user has not yet adopted a pet. Bulbasaur
  // has bundled artwork on every surface, so a guest never sees the historic
  // owl/plant placeholder while the catalog request is still unavailable.
  return {
    slug: "bulbasaur",
    name: "Bulbasaur",
    level: 1,
    category: "starter",
  };
}

/** Shared query for every surface that renders the companion. */
export function useActivePet() {
  const query = useQuery<ActivePet | null>({
    queryKey: ["active-pet"],
    queryFn: fetchActivePet,
    staleTime: 30_000,
    retry: false,
  });

  // The pets page dispatches ACTIVE_PET_EVENT after an activate; invalidate so
  // every mounted consumer swaps species without a reload.
  useEffect(() => {
    const reread = () => void query.refetch();
    window.addEventListener(ACTIVE_PET_EVENT, reread);
    return () => window.removeEventListener(ACTIVE_PET_EVENT, reread);
  }, [query]);

  return query;
}
