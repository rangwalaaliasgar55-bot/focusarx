/**
 * Design packs, live: the real Express app against a real Postgres.
 *
 * Skipped without DATABASE_URL, like the other `*.integration.test.ts` files.
 * The unit suites assert the catalog and the sanitisers; what they cannot see is
 * the part of this feature that is a *contract between two writers*:
 *
 *   1. **Who wins.** An admin pins a design for an account; that account's own
 *      PUT and DELETE must then fail with 409 `appearance_locked` — not
 *      succeed, and not be silently overwritten a moment later. A test that
 *      mocks the database can only prove the branch exists; only a real insert
 *      proves the user-facing route reads the row the console wrote.
 *   2. **What the user actually renders.** After a pin, `GET /api/appearance`
 *      must fold the admin's row into `effective`, because that is the field
 *      every client surface reads.
 *   3. **That an admin can see the whole picture** — every account's design,
 *      the battle log across accounts, and the blast radius of "apply to all"
 *      before it writes anything.
 *
 * Throwaway accounts are created per run and deleted in `afterAll` (the
 * `user_appearance` and `pet_battles` rows cascade with them).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

/** Deliberately synthetic and short: CI's secret scanner reads realistic
 *  passwords in a test file as leaked credentials. */
const PW = "pw-test-1";

const hasDb = Boolean(process.env.DATABASE_URL);

const AUTH_COOKIES = ["access_token", "refresh_token", "focusarx_token", "focusarx_session_hint"];
type Jar = Record<string, string>;

describe.runIf(hasDb)("design packs (live app + real database)", () => {
  let server: Server;
  let base = "";
  let db: typeof import("@workspace/db")["db"];
  let usersTable: typeof import("@workspace/db")["usersTable"];
  const createdUserIds: string[] = [];

  async function call(
    path: string,
    init: { method?: string; body?: unknown; jar?: Jar } = {},
  ): Promise<{ status: number; json: Record<string, unknown>; jar: Jar }> {
    const headers: Record<string, string> = {
      // A real browser UA: the security middleware 403s empty and curl-style
      // user agents, and the suite must exercise the path the SPA actually takes.
      "user-agent": "Mozilla/5.0 (Test) FocusArxAppearanceSuite/1.0 Chrome/126.0.0.0 Safari/537.36",
    };
    if (init.body !== undefined) headers["content-type"] = "application/json";
    if (init.jar) {
      const cookie = AUTH_COOKIES.filter((name) => init.jar![name])
        .map((name) => `${name}=${init.jar![name]}`)
        .join("; ");
      if (cookie) headers.cookie = cookie;
    }
    const res = await fetch(`${base}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const jar: Jar = { ...(init.jar ?? {}) };
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!AUTH_COOKIES.includes(name)) continue;
      if (value === "" || /max-age=0\b/i.test(raw.slice(pair.length))) delete jar[name];
      else jar[name] = value;
    }
    return { status: res.status, json, jar };
  }

  const code = (json: Record<string, unknown>) => json.code as string | undefined;
  const effective = (json: Record<string, unknown>) =>
    json.effective as { timerFace: string; petDesign: string; battleDesign: string; layout: string };

  /** Register a throwaway account on the live app and remember it for cleanup. */
  async function makeUser(label: string) {
    const email = `appearance-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const res = await call("/api/auth/register", { method: "POST", body: { email, password: PW } });
    expect(res.status).toBe(201);
    const id = (res.json.user as { id: string }).id;
    createdUserIds.push(id);
    return { email, id, jar: res.jar };
  }

  beforeAll(async () => {
    ({ db, usersTable } = await import("@workspace/db"));
    const app = (await import("../app")).default;
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);

  afterAll(async () => {
    try {
      // Deleting the account cascades to user_appearance and pet_battles.
      for (const id of createdUserIds.filter(Boolean)) {
        await db.delete(usersTable).where(eq(usersTable.id, id));
      }
    } catch {
      /* best effort: each run uses freshly generated addresses anyway */
    }
    await new Promise<void>((resolve) => {
      if (!server) return resolve();
      server.close(() => resolve());
    });
  });

  it("reads defaults, then persists the account's own choice", async () => {
    const user = await makeUser("own");

    // No row yet: the payload must still be renderable, which is why `effective`
    // exists as a separate field from the raw row.
    const initial = await call("/api/appearance", { jar: user.jar });
    expect(initial.status).toBe(200);
    expect(initial.json.isDefault).toBe(true);
    expect(initial.json.locked).toBe(false);
    expect(initial.json.source).toBe("default");
    expect(effective(initial.json).timerFace).toBe("classic");

    // The catalog travels with the response so the pickers cannot drift from
    // the ids the server will accept.
    const catalog = initial.json.catalog as {
      timerFaces: { id: string; label: string }[];
      layouts: { id: string; label: string }[];
      shells: { id: string; label: string }[];
      petDesigns: { id: string; label: string }[];
      battleDesigns: { id: string; label: string }[];
    };
    expect(catalog.timerFaces.map((f) => f.id)).toContain("analog");
    expect(catalog.timerFaces).toHaveLength(17);
    expect(catalog.layouts.map((l) => l.id)).toEqual(["quiet", "studio", "compact"]);
    // The frame pack travels with the catalog too, so the settings and console
    // pickers have options to render without hard-coding their own list.
    expect(catalog.shells.map((sh) => sh.id)).toEqual(["sidebar", "topbar", "tabs"]);
    expect(catalog.battleDesigns.map((d) => d.id)).toEqual(["duel", "arena", "retro"]);

    const saved = await call("/api/appearance", {
      method: "PUT",
      jar: user.jar,
      body: { timerFace: "analog", petDesign: "wild3d", battleDesign: "retro", layout: "studio", shell: "topbar" },
    });
    expect(saved.status).toBe(200);
    expect(saved.json.source).toBe("user");
    expect(effective(saved.json)).toEqual({
      timerFace: "analog",
      petDesign: "wild3d",
      battleDesign: "retro",
      layout: "studio",
      shell: "topbar",
    });

    // Read it back: the write has to reach the database, not just the response.
    const reread = await call("/api/appearance", { jar: user.jar });
    expect(reread.json.isDefault).toBe(false);
    expect(effective(reread.json).timerFace).toBe("analog");

    // An unknown id is refused at the door with the offending field named — the
    // column's CHECK is the last line of defence, not the first.
    const bad = await call("/api/appearance", { method: "PUT", jar: user.jar, body: { timerFace: "hologram" } });
    expect(bad.status).toBe(400);
    expect(bad.json.fields).toEqual(["timerFace"]);
    expect(effective((await call("/api/appearance", { jar: user.jar })).json).timerFace).toBe("analog");
  }, 60_000);

  it("lets an admin pin a design over the user's own write, and hand it back", async () => {
    const admin = await makeUser("admin");
    const user = await makeUser("pinned");

    // The console's second door: a signed-in account whose role is admin.
    await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, admin.id));

    // A plain user must not reach the console endpoints at all (fail closed).
    const forbidden = await call(`/api/admin/appearance/${user.id}`, {
      method: "PUT",
      jar: user.jar,
      body: { timerFace: "neon" },
    });
    expect(forbidden.status).toBe(403);

    const pinned = await call(`/api/admin/appearance/${user.id}`, {
      method: "PUT",
      jar: admin.jar,
      body: { timerFace: "neon", petDesign: "sprite", battleDesign: "arena", layout: "compact", shell: "tabs", locked: true },
    });
    expect(pinned.status).toBe(200);
    const pinnedUser = pinned.json.user as { locked: boolean; source: string };
    expect(pinnedUser.locked).toBe(true);
    expect(pinnedUser.source).toBe("admin");
    // Labels travel with the write so the console never prints a raw id.
    const labels = pinned.json.labels as { timerFace: string; layout: string; shell: string };
    expect(labels.timerFace).toBe("Neon");
    expect(labels.layout).toBe("Compact");
    // The newest field is the one most likely to be left out of a label map.
    expect(labels.shell).toBe("Bottom tabs");

    // The pin is what the account renders ...
    const asUser = await call("/api/appearance", { jar: user.jar });
    expect(asUser.json.locked).toBe(true);
    expect(asUser.json.source).toBe("admin");
    expect(effective(asUser.json)).toEqual({
      timerFace: "neon",
      petDesign: "sprite",
      battleDesign: "arena",
      layout: "compact",
      shell: "tabs",
    });

    // ... and the account cannot write over it. 409 with a code, so the settings
    // UI can say "managed by an admin" instead of looking like a failed save.
    const refused = await call("/api/appearance", { method: "PUT", jar: user.jar, body: { timerFace: "zen" } });
    expect(refused.status).toBe(409);
    expect(code(refused.json)).toBe("appearance_locked");
    const refusedReset = await call("/api/appearance", { method: "DELETE", jar: user.jar });
    expect(refusedReset.status).toBe(409);
    expect(code(refusedReset.json)).toBe("appearance_locked");
    expect(effective((await call("/api/appearance", { jar: user.jar })).json).timerFace).toBe("neon");

    // Releasing the pin is explicit (`locked: false`), and hands the row back.
    const released = await call(`/api/admin/appearance/${user.id}`, {
      method: "PUT",
      jar: admin.jar,
      body: { locked: false },
    });
    expect(released.status).toBe(200);
    expect((released.json.user as { locked: boolean }).locked).toBe(false);
    // The design the admin chose survives the release — only the pin is gone.
    // (The console's write answers with `appearance`, the user's read with
    // `effective`; both name the same four ids.)
    expect((released.json.appearance as { timerFace: string }).timerFace).toBe("neon");

    const nowFree = await call("/api/appearance", { method: "PUT", jar: user.jar, body: { timerFace: "zen" } });
    expect(nowFree.status).toBe(200);
    expect(nowFree.json.source).toBe("user");
    expect(effective(nowFree.json).timerFace).toBe("zen");
  }, 90_000);

  it("shows an admin every account's design and the battles they played", async () => {
    const admin = await makeUser("watcher");
    const user = await makeUser("fighter");
    await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, admin.id));

    await call("/api/appearance", { method: "PUT", jar: user.jar, body: { battleDesign: "retro", layout: "studio" } });

    const report = {
      petSlug: "axolotl",
      petName: "Axolotl",
      petLevel: 5,
      rivalSlug: "owl",
      rivalName: "Wild Owl",
      rivalLevel: 5,
      difficulty: "normal",
      design: "retro",
      // Cup 3 of the ladder: the point of the column is that the console can ask
      // *which cup* was fought, so the round trip has to carry it.
      stage: 3,
      result: "win",
      rounds: 7,
      damageDealt: 41,
      damageTaken: 12,
    };
    const logged = await call("/api/appearance/battles", { method: "POST", jar: user.jar, body: report });
    expect(logged.status).toBe(201);
    expect((logged.json.battle as { stage: number | null }).stage).toBe(3);

    // A stage outside the ladder is refused at the door with the field named;
    // the column's CHECK is what would otherwise turn this into a 500.
    const badStage = await call("/api/appearance/battles", {
      method: "POST",
      jar: user.jar,
      body: { ...report, stage: 7 },
    });
    expect(badStage.status).toBe(400);
    expect(String(badStage.json.error)).toContain("stage");

    // A pick-up fight still logs, with no cup.
    const pickUp = await call("/api/appearance/battles", {
      method: "POST",
      jar: user.jar,
      body: { ...report, stage: null, result: "loss" },
    });
    expect(pickUp.status).toBe(201);
    expect((pickUp.json.battle as { stage: number | null }).stage).toBeNull();

    // The player's own history ...
    const mine = await call("/api/appearance/battles", { jar: user.jar });
    const summary = mine.json.summary as { total: number; wins: number; lastDesign: string };
    expect(summary.total).toBeGreaterThanOrEqual(1);
    expect(summary.wins).toBeGreaterThanOrEqual(1);
    expect(summary.lastDesign).toBe("retro");

    // ... and the console's view of it, which is what "admin can see the
    // battles" means: the row carries the account, not just the fight.
    const all = await call("/api/admin/appearance/battles?limit=100", { jar: admin.jar });
    expect(all.status).toBe(200);
    const battles = all.json.battles as {
      userId: string;
      rivalSlug: string;
      design: string;
      result: string;
      stage: number | null;
    }[];
    // Found by cup, not by rival: the same rival is faced in a cup and in a
    // pick-up fight, and the cup is the row this test is about.
    const found = battles.find((b) => b.userId === user.id && b.stage === 3);
    expect(found, "the admin battle log does not contain the cup fight just played").toBeTruthy();
    expect(found!.rivalSlug).toBe("owl");
    expect(found!.design).toBe("retro");
    expect(found!.result).toBe("win");
    // ... and the cup it was fought at, which is how the console sees ladder
    // progress at all. The pick-up fight above must not be mistaken for one.
    expect(found!.stage).toBe(3);
    expect(battles.filter((b) => b.userId === user.id && b.stage === null)).toHaveLength(1);

    // A non-admin cannot read the cross-account log.
    expect((await call("/api/admin/appearance/battles", { jar: user.jar })).status).toBe(403);

    // The assignment view: which design this account is on, and where it came from.
    const list = await call(`/api/admin/appearance?search=${encodeURIComponent(user.email)}`, { jar: admin.jar });
    expect(list.status).toBe(200);
    const rows = list.json.users as {
      userId: string;
      assigned: boolean;
      appearance: { battleDesign: string; layout: string };
    }[];
    const row = rows.find((r) => r.userId === user.id);
    expect(row, "the account is missing from the admin assignment list").toBeTruthy();
    expect(row!.assigned).toBe(true);
    expect(row!.appearance.battleDesign).toBe("retro");
    expect(row!.appearance.layout).toBe("studio");

    // "Apply to all" must be countable before it writes: a dry run reports the
    // blast radius and changes nobody.
    const dry = await call("/api/admin/appearance/bulk", {
      method: "POST",
      jar: admin.jar,
      body: { all: true, layout: "compact", dryRun: true },
    });
    expect(dry.status).toBe(200);
    expect(dry.json.dryRun).toBe(true);
    expect(dry.json.affected as number).toBeGreaterThan(0);
    expect(effective((await call("/api/appearance", { jar: user.jar })).json).layout).toBe("studio");

    // The real sweep on one named account does write.
    const swept = await call("/api/admin/appearance/bulk", {
      method: "POST",
      jar: admin.jar,
      body: { userIds: [user.id], layout: "compact", locked: false },
    });
    expect(swept.status).toBe(200);
    expect(swept.json.affected).toBe(1);
    const after = await call("/api/appearance", { jar: user.jar });
    expect(effective(after.json).layout).toBe("compact");
    expect(after.json.source).toBe("admin");
  }, 90_000);
});
