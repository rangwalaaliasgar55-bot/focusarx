import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { emotesRouter } from "./emotes";
import { flashcardsRouter } from "./flashcards";
import { deploymentRouter } from "./deployment";
import { developerRouter } from "./developer";

/**
 * Regression test: emotes/flashcards/developer mounted `router.use(authMiddleware)`
 * with NO path scope. Because index.ts mounts those routers at the parent root
 * (`router.use(emotesRouter)`), the unscoped auth ran for every request that
 * reached them — 401-ing every router mounted afterwards (/api/deployment,
 * /api/feature-flags, /api/recommendations, /api/mobile, …) for anonymous
 * callers. The auth is now scoped to each router's own prefix.
 *
 * This mounts the affected routers in the same relative order as index.ts
 * (emotes → flashcards → deployment → developer → a canary route last) and
 * asserts both directions: no leak onto later routes, and full enforcement on
 * the routers' own prefixes.
 */

let baseUrl = "";
let server: ReturnType<express.Express["listen"]>;

beforeAll(async () => {
  const app = express();
  const router = express.Router();
  router.use(emotesRouter);
  router.use(flashcardsRouter);
  router.use(deploymentRouter);
  router.use(developerRouter);
  // Canary mounted LAST: if any router above leaks unscoped middleware, this
  // route stops being publicly reachable.
  router.get("/__scope-canary", (_req, res) => res.json({ ok: true }));
  app.use("/api", router);
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => {
  server?.close();
});

describe("router auth scoping", () => {
  it("keeps publicly-documented routes public: /api/deployment answers 200 anonymously", async () => {
    const res = await fetch(`${baseUrl}/api/deployment`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version?: string; protocol?: number };
    expect(body.protocol).toBe(1);
  });

  it("a route mounted after all auth routers still answers 200 anonymously", async () => {
    const res = await fetch(`${baseUrl}/api/__scope-canary`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("still enforces auth on the scoped prefixes (emotes, flashcards, developer)", async () => {
    for (const path of ["/api/emotes", "/api/flashcards/decks", "/api/developer/overview"]) {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`${baseUrl}${path}`);
      expect(res.status, path).toBe(401);
    }
  });
});
