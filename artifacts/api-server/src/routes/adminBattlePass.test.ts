/**
 * The admin season builder — wired, guarded, and honest about what it writes.
 *
 * Two failure modes are worth pinning, and neither shows up at runtime as an
 * error a student or admin would recognise:
 *
 *   1. **Built but unreachable.** The voice-capture backend existed for a while
 *      and was never mounted, so the feature was simply absent. A router that is
 *      not in `routes/index.ts` passes `tsc`, passes its own tests, and does
 *      nothing.
 *   2. **A write hiding in a preview.** "Preview" must not touch the database —
 *      if it did, an admin clicking Preview to look would silently create a
 *      season, and the draft/publish distinction would be a lie.
 *
 * The rest of the file checks the product rules the endpoints advertise: one
 * active season at a time, drafts only for deletion, duplicates refused.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(path.join(here, "adminBattlePass.ts"), "utf8");
const indexSource = readFileSync(path.join(here, "index.ts"), "utf8");

function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const source = code(raw);

/** The body of one handler, from its registration to the next registration. */
function handler(needle: string): string {
  const start = source.indexOf(needle);
  expect(start, `${needle} is not registered`).toBeGreaterThan(-1);
  const next = source.indexOf("router.", start + needle.length);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

const ROUTES = [
  'router.get("/admin/battle-pass",',
  'router.post("/admin/battle-pass/preview",',
  'router.post("/admin/battle-pass",',
  'router.post("/admin/battle-pass/:id/activate",',
  'router.delete("/admin/battle-pass/:id",',
];

describe("admin battle-pass router", () => {
  it("is actually mounted", () => {
    // The voice feature was 'missing' for exactly this reason.
    expect(indexSource, "the builder is not mounted in routes/index.ts").toContain("adminBattlePassRouter");
    expect(indexSource).toMatch(/router\.use\(adminBattlePassRouter\)/);
  });

  it("guards every route with the admin check", () => {
    // A route that is not listed above would be skipped by this file, so the
    // list itself is asserted against the source.
    const registrations = source.match(/router\.(?:get|post|delete|put|patch)\(/g) ?? [];
    expect(registrations).toHaveLength(ROUTES.length);
    for (const route of ROUTES) {
      const body = handler(route);
      expect(body, `${route} is unguarded`).toContain("await checkAdminAuth(req)");
      expect(body, `${route} does not reject unauthorised callers`).toContain("sendUnauthorized(res)");
    }
  });

  it("never lets the preview write", () => {
    const preview = handler('router.post("/admin/battle-pass/preview",');
    for (const write of ["insert(", "update(", "delete(", "transaction("]) {
      expect(preview.includes(write), `preview performs ${write}`).toBe(false);
    }
    // Preview and publish must agree, so preview uses the same generator.
    expect(preview).toContain("buildSeasonTiers(");
  });

  it("keeps exactly one season live when publishing", () => {
    for (const route of ['router.post("/admin/battle-pass/:id/activate",', 'router.post("/admin/battle-pass",']) {
      const body = handler(route);
      if (!body.includes("isActive: true")) continue;
      expect(body).toMatch(/set\(\{ isActive: false \}\)\.where\(eq\(battlePasses\.isActive, true\)\)/);
      expect(body).toContain("transaction(");
    }
    // …and the activate handler really is the one doing it.
    expect(handler('router.post("/admin/battle-pass/:id/activate",')).toContain("isActive: true");
  });

  it("refuses to delete the live season", () => {
    const remove = handler('router.delete("/admin/battle-pass/:id",');
    expect(remove).toContain("target.isActive");
    expect(remove).toContain("409");
  });

  it("refuses a duplicate season id rather than silently making two", () => {
    const create = handler('router.post("/admin/battle-pass",');
    expect(create).toContain("already exists");
    expect(create).toContain("409");
  });

  it("creates drafts unless publishing was asked for", () => {
    const create = handler('router.post("/admin/battle-pass",');
    expect(create).toMatch(/isActive: false/);
    expect(create).toMatch(/if \(activate\)/);
  });

  it("writes only columns the rewards table actually has", () => {
    const create = handler('router.post("/admin/battle-pass",');
    // The row objects are built *before* the insert call, so slice the builder,
    // not the write.
    const tierWrites = create.slice(create.indexOf("const rows ="), create.indexOf("insert(battlePassRewards)"));
    for (const column of ["tier:", "requiredXp:", "isPremium:", "value:", "type:", "battlePassId:"]) {
      expect(tierWrites.includes(column), `reward rows are missing ${column}`).toBe(true);
    }
    for (const phantom of ["freeRewardCoins", "premiumRewardCoins", "freeRewardType", "premiumRewardType"]) {
      expect(source.includes(phantom), `${phantom} does not exist on battle_pass_rewards`).toBe(false);
    }
  });

  it("audits season creation with the acting admin", () => {
    expect(source).toContain("adminId");
    expect(source).toContain("logger.info");
  });
});
