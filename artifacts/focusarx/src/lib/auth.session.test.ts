/**
 * Session-resolution semantics.
 *
 * The rule under test: only a verdict from the server may end a session.
 * `GET /api/auth/session` answers 401 when the credentials really are spent,
 * and 503 (or nothing at all) when the API is down, cold-starting, or the
 * database is having a bad minute. The old code collapsed both into
 * "clearToken(); return null", so a two-second blip during a page load signed
 * people out of a live account — mid-focus-session, which is the worst possible
 * moment to lose the run.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";

vi.mock("@/lib/site-analytics", () => ({ linkAnalyticsUser: vi.fn(), trackSiteEvent: vi.fn() }));
vi.mock("@/lib/gtag", () => ({ trackEvent: vi.fn() }));

// The localStorage key the provider writes to, spelled out so the test pins
// the real name rather than a constant that could drift with it. It is a
// storage key name, not a credential.
const TOKEN_KEY = "focusarx-auth-token"; // gitleaks:allow

type Reply = { status: number; body?: unknown } | { error: Error };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Queue one reply per path, consumed in call order (repeats the last one). */
function mockFetch(replies: Record<string, Reply[]>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      const path = url.replace(/^https?:\/\/[^/]+/, "");
      const queue = replies[path];
      if (!queue || queue.length === 0) throw new Error(`unexpected fetch: ${path}`);
      const reply = queue.length > 1 ? queue.shift() : queue[0];
      if (!reply) throw new Error(`unexpected fetch: ${path}`);
      if ("error" in reply) throw reply.error;
      return jsonResponse(reply.status, reply.body ?? {});
    }),
  );
  return calls;
}

const session = (email = "me@example.com") => ({ status: 200, body: { user: { id: "u1", email, name: null } } });

describe("resolveSession", () => {
  beforeEach(async () => {
    localStorage.clear();
    // `tryRefreshSession` keeps one in-flight promise so parallel 401s share a
    // single rotation, and releases it on a macrotask. Yield once so the next
    // test never inherits the previous test's cached outcome.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the token and retries when the API is unavailable", async () => {
    localStorage.setItem(TOKEN_KEY, "jwt-value");
    const calls = mockFetch({
      "/api/auth/session": [{ status: 503, body: { error: { code: "CONFIG_ERROR", message: "nope" } } }],
    });

    const { resolveSession } = await import("@/lib/auth");
    const result = await resolveSession({ retryDelaysMs: [0, 0, 0] });

    expect(result.session).toBeNull();
    expect(result.signedOut).toBe(false);
    // Credentials survive a 5xx — this is the whole fix.
    expect(localStorage.getItem(TOKEN_KEY)).toBe("jwt-value");
    // …and the request was actually retried rather than given up on once.
    expect(calls.filter((c) => c.url.includes("/api/auth/session")).length).toBe(4);
  });

  it("keeps the token when the network itself fails", async () => {
    localStorage.setItem(TOKEN_KEY, "jwt-value");
    mockFetch({
      "/api/auth/session": [{ error: new TypeError("Failed to fetch") }],
    });

    const { resolveSession } = await import("@/lib/auth");
    const result = await resolveSession({ retryDelaysMs: [0] });

    expect(result.signedOut).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBe("jwt-value");
  });

  it("clears the token when the server says the session is spent", async () => {
    localStorage.setItem(TOKEN_KEY, "expired-jwt");
    mockFetch({
      // 401 on the session, and the silent refresh refuses too: that is a
      // verdict, so the local credential is genuinely dead.
      "/api/auth/session": [{ status: 401, body: { error: { code: "UNAUTHORIZED", message: "Unauthorized" } } }],
      "/api/auth/refresh": [{ status: 401, body: { error: { code: "INVALID_TOKEN", message: "Invalid refresh token" } } }],
    });

    const { resolveSession } = await import("@/lib/auth");
    const result = await resolveSession({ retryDelaysMs: [0] });

    expect(result.session).toBeNull();
    expect(result.signedOut).toBe(true);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("resumes the session through a silent refresh and stores the new token", async () => {
    localStorage.setItem(TOKEN_KEY, "old-jwt");
    mockFetch({
      "/api/auth/session": [
        { status: 401, body: { error: { code: "UNAUTHORIZED", message: "Unauthorized" } } },
        session("resumed@example.com"),
      ],
      "/api/auth/refresh": [{ status: 200, body: { accessToken: "fresh-jwt", token: "fresh-legacy" } }],
    });

    const { resolveSession } = await import("@/lib/auth");
    const result = await resolveSession({ retryDelaysMs: [0] });

    expect(result.session?.user.email).toBe("resumed@example.com");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("fresh-jwt");
  });

  it("treats a refresh that could not be answered as 'unavailable', not 'expired'", async () => {
    localStorage.setItem(TOKEN_KEY, "good-jwt");
    mockFetch({
      "/api/auth/session": [{ status: 401, body: { error: { code: "UNAUTHORIZED", message: "Unauthorized" } } }],
      // Rolling deploy: the refresh POST never reached a healthy instance.
      "/api/auth/refresh": [{ status: 502, body: {} }],
    });

    const { resolveSession } = await import("@/lib/auth");
    const result = await resolveSession({ retryDelaysMs: [0] });

    expect(result.signedOut).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBe("good-jwt");
  });
});

describe("apiErrorMessage", () => {
  it("prefers the server's own wording", async () => {
    const { apiErrorMessage } = await import("@/lib/auth");
    expect(
      apiErrorMessage({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } }, "fallback"),
    ).toBe("Invalid credentials");
    expect(apiErrorMessage({ error: "Plain string" }, "fallback")).toBe("Plain string");
    expect(apiErrorMessage("raw", "fallback")).toBe("raw");
    expect(apiErrorMessage({}, "Server rejected the request")).toBe("Server rejected the request");
  });

  it("unwraps the ApiError thrown by apiFetch", async () => {
    const { apiErrorMessage } = await import("@/lib/auth");
    // Callers pass the caught error, and `ApiError` keeps the parsed body on
    // `.data`. Before this, every form showed its generic fallback and the
    // real reason ("Current password is incorrect") was thrown away.
    const err = new ApiError(
      400,
      "Request failed (400)",
      { error: { code: "VALIDATION_ERROR", message: "Current password is incorrect" } },
    );
    expect(apiErrorMessage(err, "Could not update password.")).toBe("Current password is incorrect");
    // An ApiError with no usable body still falls back rather than leaking
    // "Request failed (400)" to a human.
    expect(apiErrorMessage(new ApiError(500, "Request failed (500)"), "Try again later.")).toBe("Try again later.");
  });
});
