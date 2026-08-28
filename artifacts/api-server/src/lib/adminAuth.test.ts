import { describe, expect, it } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import { checkAdminAuth, requireAdmin } from "./adminAuth";

/**
 * Regression guard for the `/api/drops/admin/*` hang.
 *
 * `checkAdminAuth` is a *predicate* — `Promise<boolean>`, one declared
 * parameter, never calls `next()`. It was mounted directly into five route
 * chains in routes/drops.ts:
 *
 *   dropsRouter.get("/admin/drops", authMiddleware, checkAdminAuth, adminLimiter, handler)
 *
 * Express dispatches middleware by arity, so a 1-arg function is treated as
 * `(req, res, next)`. It got called, its promise was discarded, and `next()`
 * never ran — every admin drops request hung until the platform killed it
 * (30s maxDuration on Vercel). Five endpoints, no error, no log line.
 *
 * These tests drive a real HTTP server so the failure mode is the real one:
 * a timeout, not a wrong status code.
 */

async function withServer(
  mount: (app: express.Express) => void,
  fn: (base: string) => Promise<void>,
): Promise<void> {
  const app = express();
  mount(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await fn(base);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

describe("requireAdmin (the middleware form)", () => {
  it("responds 403 instead of hanging when the caller is not an admin", async () => {
    await withServer(
      (app) => {
        app.get("/admin/drops", requireAdmin, (_req, res) => res.json({ ok: true }));
      },
      async (base) => {
        const res = await fetch(`${base}/admin/drops`, { signal: AbortSignal.timeout(3000) });
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: "Admin access required" });
      },
    );
  });

  it("does not leak stack traces or DB details on rejection", async () => {
    await withServer(
      (app) => {
        app.get("/admin/drops", requireAdmin, (_req, res) => res.json({ ok: true }));
      },
      async (base) => {
        const body = await (await fetch(`${base}/admin/drops`, { signal: AbortSignal.timeout(3000) })).text();
        expect(body.toLowerCase()).not.toContain("stack");
        expect(body.toLowerCase()).not.toContain("postgres");
      },
    );
  });
});

describe("checkAdminAuth mounted as middleware (the original bug)", () => {
  it("does hang — which is exactly why routes must use requireAdmin", async () => {
    await withServer(
      (app) => {
        // Reproduce the defect: the predicate in the chain, no next() call.
        app.get("/broken", checkAdminAuth as never, (_req, res) => res.json({ ok: true }));
      },
      async (base) => {
        // It must NOT resolve. If someone "fixes" checkAdminAuth into a
        // middleware, this flips and the test tells us to re-check drops.ts.
        const timedOut = await fetch(`${base}/broken`, { signal: AbortSignal.timeout(600) })
          .then(() => false)
          .catch((e: unknown) => (e as { name?: string })?.name === "TimeoutError" || (e as { name?: string })?.name === "AbortError");
        expect(timedOut, "checkAdminAuth now behaves as middleware — update this test and routes/drops.ts").toBe(true);
      },
    );
  });
});

describe("arity contract", () => {
  it("checkAdminAuth declares 1 parameter and cannot be middleware", () => {
    expect(checkAdminAuth.length).toBe(1);
  });

  it("requireAdmin declares 3 parameters so Express treats it as request middleware", () => {
    expect(requireAdmin.length).toBe(3);
  });
});
