import { Router } from "express";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, petCatalogTable, userPetInventoryTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { checkAdminAuth } from "../lib/adminAuth";
import { auditLog, getClientIp } from "../lib/auditLog";
import { extractUserId } from "./auth";
import {
  PET_SOURCES,
  findStagedPet,
  queryStagedPets,
  spriteUrlFor,
  stagedSlugs,
} from "../lib/petStaging";

/**
 * Admin release pipeline for staged pets.
 *
 * Candidates live in code (lib/petStaging.ts + generated data); this router
 * lets admins browse them and, deliberately and logged, publish one into the
 * live `pet_catalog` — or pull it back. The two gates that matter:
 *
 *  - "fan-use" entries (all Pokémon candidates today) cannot be released
 *    without `confirmIpReview: true`. Staging is not approval, and the API
 *    treats it that way even if a UI regression ever forgets.
 *  - Pulling refuses once any user holds the pet: deleting a catalog row
 *    cascades into `user_pet_inventory`, so a "pull" that someone has adopted
 *    would silently delete their companion.
 */

const router = Router();
const checkAuth = checkAdminAuth;

const RARITIES = ["common", "rare", "epic", "legendary", "exclusive"] as const;
const CATEGORIES = ["starter", "free", "achievement", "premium", "seasonal", "event", "legendary", "exclusive", "admin_drop"] as const;

const releaseBodySchema = z.object({
  confirmIpReview: z.boolean().optional(),
  rarity: z.enum(RARITIES).optional(),
  category: z.enum(CATEGORIES).optional(),
  tokenCost: z.number().int().min(0).max(1_000_000).optional(),
  isPremium: z.boolean().optional(),
  unlockSource: z.string().trim().min(1).max(80).optional(),
});

// GET /api/admin/pets/releases — browse the staging manifest.
router.get("/admin/pets/releases", async (req, res) => {
  if (!(await checkAuth(req))) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const genRaw = Number(req.query.gen);
    const gen = Number.isInteger(genRaw) && genRaw >= 1 && genRaw <= 9 ? genRaw : undefined;
    const style = req.query.style === "2d" || req.query.style === "3d" ? req.query.style : undefined;
    const kind = req.query.kind === "species" || req.query.kind === "form" ? req.query.kind : undefined;
    const released = req.query.released === "true" ? true : req.query.released === "false" ? false : undefined;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || undefined;

    // Released = slug already in the live catalog. Look up only staged slugs
    // so the query can never scan unrelated catalog rows.
    const slugs = stagedSlugs();
    const rows = slugs.length
      ? await db.select({ slug: petCatalogTable.slug }).from(petCatalogTable).where(inArray(petCatalogTable.slug, slugs))
      : [];
    const releasedSlugs = new Set(rows.map((r) => r.slug));

    const result = queryStagedPets({ q, gen, style, kind, released, page, pageSize }, releasedSlugs);
    res.json({ sources: PET_SOURCES, ...result });
  } catch (err) {
    logger.error({ err }, "admin pet releases list error");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /api/admin/pets/releases/:slug/release — publish a staged pet.
router.post("/admin/pets/releases/:slug/release", async (req, res) => {
  if (!(await checkAuth(req))) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = releaseBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "Invalid release options" }); return; }
  const body = parsed.data;

  const entry = findStagedPet(req.params.slug);
  if (!entry) { res.status(404).json({ error: "Not a staged pet" }); return; }

  // The hard gate: fan-use content needs an explicit, per-release IP review
  // confirmation. Staging alone is never approval.
  if (entry.license === "fan-use" && body.confirmIpReview !== true) {
    res.status(412).json({
      error: "IP review confirmation required",
      detail: `${entry.name} is tagged "${entry.license}" upstream (Pokémon — © Nintendo / Game Freak / Creatures Inc.). Pass confirmIpReview: true only after legal review.`,
    });
    return;
  }

  try {
    const [existing] = await db.select().from(petCatalogTable).where(eq(petCatalogTable.slug, entry.slug)).limit(1);
    if (existing) {
      // Idempotent: re-releasing returns the live row instead of erroring,
      // so a double-click in the panel can never corrupt the catalog.
      res.json({ catalog: existing, alreadyReleased: true });
      return;
    }

    const spriteUrl = spriteUrlFor(entry);
    const [inserted] = await db.insert(petCatalogTable).values({
      slug: entry.slug,
      name: entry.name,
      description: entry.description,
      rarity: body.rarity ?? "rare",
      category: body.category ?? "event",
      thumbnailUrl: spriteUrl,
      fallbackImageUrl: spriteUrl,
      unlockSource: body.unlockSource ?? "Staged release",
      tokenCost: body.tokenCost ?? 0,
      isPremium: body.isPremium ?? false,
      isActive: true,
    }).returning();

    auditLog({
      action: "admin_pet_release",
      userId: extractUserId(req) ?? undefined,
      ip: getClientIp(req),
      details: { slug: entry.slug, license: entry.license, rarity: inserted.rarity, category: inserted.category, ipReviewConfirmed: body.confirmIpReview === true },
    });
    res.status(201).json({ catalog: inserted, alreadyReleased: false });
  } catch (err) {
    logger.error({ err, slug: entry.slug }, "admin pet release error");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /api/admin/pets/releases/:slug/pull — remove a released staged pet.
router.post("/admin/pets/releases/:slug/pull", async (req, res) => {
  if (!(await checkAuth(req))) { res.status(403).json({ error: "Forbidden" }); return; }
  const entry = findStagedPet(req.params.slug);
  if (!entry) { res.status(404).json({ error: "Not a staged pet" }); return; }

  try {
    const [catalogRow] = await db.select().from(petCatalogTable).where(eq(petCatalogTable.slug, entry.slug)).limit(1);
    if (!catalogRow) { res.status(404).json({ error: "Not released" }); return; }

    // The cascade guard: user_pet_inventory references catalog rows with
    // ON DELETE CASCADE, so deleting an adopted pet would delete someone's
    // companion. That is never an acceptable "pull".
    const holders = await db.select({ petId: userPetInventoryTable.petId })
      .from(userPetInventoryTable)
      .where(eq(userPetInventoryTable.petId, catalogRow.id))
      .limit(1);
    if (holders.length > 0) {
      res.status(409).json({ error: "Pet is adopted — pulling it would delete user companions. Deactivate it instead." });
      return;
    }

    await db.delete(petCatalogTable).where(and(eq(petCatalogTable.id, catalogRow.id), eq(petCatalogTable.slug, entry.slug)));
    auditLog({
      action: "admin_pet_pull",
      userId: extractUserId(req) ?? undefined,
      ip: getClientIp(req),
      details: { slug: entry.slug },
    });
    res.json({ pulled: true });
  } catch (err) {
    logger.error({ err, slug: entry.slug }, "admin pet pull error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as adminPetReleasesRouter };
