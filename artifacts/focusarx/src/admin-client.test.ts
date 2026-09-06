import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearToken, getToken, setToken } from "@/lib/auth";
import { adminFetch } from "@/components/admin/AdminHelpers";

/**
 * `adminFetch` is the console's only path to the API. It wraps `apiFetch` (silent
 * refresh, single-flight, deployment-skew queueing, the server's own error text)
 * without forcing 600 lines of `if (!res.ok)` panels to be rewritten around a
 * throwing client — so the adapter has to keep *both* promises: the recovery
 * behaviour of `apiFetch`, and a `Response` at the end of every path.
 */

const SRC = path.resolve(process.cwd(), "src");

type Stub = (url: string, init?: RequestInit) => Promise<Response> | Promise<never>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(impl: Stub) {
  const seen: { url: string; headers: Record<string, string> }[] = [];
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    seen.push({ url, headers });
    return impl(url, init);
  });
  vi.stubGlobal("fetch", mock);
  return { mock, seen };
}

beforeEach(() => {
  setToken("stale-access-token");
});

afterEach(() => {
  clearToken();
  vi.unstubAllGlobals();
});

describe("adminFetch", () => {
  it("recovers from an expired access token instead of dying until the next reload", async () => {
    const { seen } = stubFetch(async (url) => {
      if (url === "/api/admin/feature-flags") {
        // The first hit is the 401 the old code surfaced as a dead panel.
        if (seen.filter((s) => s.url === url).length === 1) {
          return json({ error: { code: "TOKEN_EXPIRED", message: "jwt expired" } }, 401);
        }
        return json({ flags: [] });
      }
      if (url === "/api/auth/refresh") return json({ accessToken: "fresh-access-token" });
      throw new Error(`unexpected request to ${url}`);
    });

    const res = await adminFetch("/api/admin/feature-flags", { headers: { Authorization: "Bearer stale-access-token" } });

    expect(res.ok).toBe(true);
    await expect(res.json()).resolves.toEqual({ flags: [] });
    expect(seen.map((s) => s.url)).toEqual(["/api/admin/feature-flags", "/api/auth/refresh", "/api/admin/feature-flags"]);
    expect(getToken()).toBe("fresh-access-token");
  });

  it("hands the panel the server's own explanation as a body it can read", async () => {
    const { mock } = stubFetch(async () =>
      json({ error: { code: "FLAG_EXISTS", message: "A flag called focus-chamber already exists." } }, 409),
    );

    const res = await adminFetch("/api/admin/feature-flags", {
      method: "POST",
      body: JSON.stringify({ key: "focus-chamber" }),
    });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("FLAG_EXISTS");
    expect(body.error.message).toBe("A flag called focus-chamber already exists.");
  });

  it("degrades an unreachable API into a response rather than an unhandled rejection", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    const res = await adminFetch("/api/admin/economy");
    expect(res.status).toBe(504);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("NETWORK");
    expect(body.error.message).toMatch(/could not be reached/);
  });

  it("keeps the session cookie and the skew header the app's routes expect", async () => {
    const { seen } = stubFetch(async () => json({ ok: true }));

    await adminFetch("/api/admin/cms/notify-all", { method: "POST", body: "{}" });

    const request = seen[0]!;
    expect(request.headers["content-type"]).toBe("application/json");
    expect(request.headers["x-focusarx-deployment"]).toBeTruthy();
    expect(request.headers["authorization"]).toBe("Bearer stale-access-token");
  });
});

describe("admin console request conventions", () => {
  const adminDir = path.join(SRC, "components/admin");
  const files = [
    ...readdirSync(adminDir)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => ({ label: `components/admin/${f}`, source: readFileSync(path.join(adminDir, f), "utf8") })),
    { label: "pages/admin.tsx", source: readFileSync(path.join(SRC, "pages/admin.tsx"), "utf8") },
  ];

  it("routes every request through the adapter", () => {
    // AdminGate owns the console's own password unlock and must not inherit the
    // user-session refresh dance, so it keeps a bare fetch — everything else that
    // talks to `/api/` goes through `adminFetch`.
    const offenders = files
      .filter(({ label }) => !label.endsWith("AdminGate.tsx"))
      .filter(({ source }) => /(?<![A-Za-z0-9_$.])fetch\(\s*["`]/.test(source))
      .map(({ label }) => label);
    expect(offenders, `${offenders.join(", ")} still call fetch() directly`).toEqual([]);
  });

  it("imports the adapter rather than re-declaring it", () => {
    const users = files.filter(({ label, source }) => !label.endsWith("AdminHelpers.tsx") && /[^a-z]adminFetch\(/.test(source));
    expect(users.length).toBeGreaterThan(15);
    for (const { label, source } of users) {
      expect(
        /import \{[^}]*\badminFetch\b[^}]*\} from "(\.\/AdminHelpers|@\/components\/admin\/AdminHelpers)";/.test(source),
        `${label} calls adminFetch without importing it`,
      ).toBe(true);
    }
    const helpers = files.find((f) => f.label.endsWith("AdminHelpers.tsx"))!;
    expect(helpers.source).toMatch(/apiFetch\(path, init\)/);
    expect(helpers.source).not.toMatch(/from "\.\/AdminHelpers"/);
  });
});

describe("adminFetch failure announcement", () => {
  function captureAnnouncements() {
    const messages: string[] = [];
    const handler = (event: Event) => {
      messages.push(((event as CustomEvent<{ message?: string }>).detail ?? {}).message ?? "");
    };
    window.addEventListener("focusarx:api-error", handler);
    return { messages, stop: () => window.removeEventListener("focusarx:api-error", handler) };
  }

  it("repeats the server's own refusal to the admin who triggered it", async () => {
    const { messages, stop } = captureAnnouncements();
    stubFetch(async () => json({ error: { code: "DROP_LIVE", message: "A drop with that key is already live." } }, 409));

    const res = await adminFetch("/api/admin/drops/create", { method: "POST", body: "{}" });

    expect(res.status).toBe(409);
    expect(messages).toEqual(["A drop with that key is already live."]);
    stop();
  });

  it("says something even when the response has no body to read", async () => {
    const { messages, stop } = captureAnnouncements();
    stubFetch(async () => new Response(null, { status: 502 }));

    await adminFetch("/api/admin/cms/seed/quests", { method: "POST" });

    expect(messages).toEqual(["That didn't go through (502)."]);
    stop();
  });

  it("leaves 401 to the session layer and success to the panel", async () => {
    const { messages, stop } = captureAnnouncements();
    stubFetch(async (url) =>
      url === "/api/auth/refresh"
        ? json({ error: { message: "no session" } }, 400)
        : json({ error: { message: "expired" } }, 401),
    );
    await adminFetch("/api/admin/moderation/queue-" + Math.random(), { headers: authLike() });
    expect(messages).toEqual([]);

    stubFetch(async () => json({ queued: 3 }));
    await adminFetch("/api/admin/moderation/digest-" + Math.random(), { method: "POST", body: "{}" });
    expect(messages).toEqual([]);
    stop();
  });

  it("collapses a burst of identical failures into one announcement", async () => {
    const { messages, stop } = captureAnnouncements();
    stubFetch(async () => json({ error: { message: "Rate limited: try again in a minute." } }, 429));

    await Promise.all([
      adminFetch("/api/admin/bots/list-" + Math.random()),
      adminFetch("/api/admin/bots/list-" + Math.random()),
      adminFetch("/api/admin/bots/list-" + Math.random()),
    ]);

    expect(messages).toHaveLength(1);
    stop();
  });

  it("honours the opt-out for panels that render the failure themselves", async () => {
    const { messages, stop } = captureAnnouncements();
    stubFetch(async () => json({ error: { message: "SMTP is not configured." } }, 503));

    await adminFetch("/api/admin/email/blast-" + Math.random(), { method: "POST", body: "{}" }, { silent: true });

    expect(messages).toEqual([]);
    stop();
  });
});

function authLike() {
  return { Authorization: "Bearer whatever" };
}
