import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { SystemDiagnostics } from "./SystemDiagnostics";

// The build-time version is the "dev-local" sentinel under test, which the
// compatibility rule (rightly) treats as unverifiable — so a drift row can
// only be exercised by taking the comparator out of the equation.
const flags = vi.hoisted(() => ({ forceIncompatible: false }));
vi.mock("@/lib/deploymentSkew", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/deploymentSkew")>();
  return {
    ...actual,
    isVersionCompatible: (...args: Parameters<typeof actual.isVersionCompatible>) =>
      flags.forceIncompatible ? false : actual.isVersionCompatible(...args),
  };
});

/**
 * The diagnostics card has to be trustworthy in every state, because it is the
 * thing an operator opens during an incident. A card that spins forever reads
 * as "the diagnostics are broken"; a card that shows a bare "error" reads as
 * "everything is broken". So each row gets its own loading, ok, warn and error
 * wording, and each probe failing must not take the others down with it.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Route = (url: string) => { status: number; body?: unknown } | null;

function stubFetch(route: Route) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.signal?.aborted) throw new Error("aborted");
    const hit = route(url);
    // A plain object is enough: the card only reads .status and .json(), and
    // jsdom provides neither fetch nor Response to lean on.
    if (!hit) return { status: 404, json: async () => null };
    return { status: hit.status, json: async () => hit.body ?? null };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const HEALTHY: Route = (url) => {
  if (url.includes("/api/deployment")) {
    return { status: 200, body: { version: "abc123def456", knownIds: ["abc123def456"], skewProtectionAvailable: true } };
  }
  if (url.includes("/api/healthz/ready")) {
    return { status: 200, body: { ready: true, database: true, config: { ok: true, errors: [] } } };
  }
  if (url.includes("/api/study-rooms")) {
    return { status: 200, body: [{ id: "r1" }, { id: "r2" }] };
  }
  return null;
};

describe("SystemDiagnostics", () => {
  beforeEach(() => {
    flags.forceIncompatible = false;
    // jsdom has no service worker: the card must say so rather than crash.
    expect(navigator.serviceWorker).toBeUndefined();
  });

  it("reports a healthy stack row by row", async () => {
    stubFetch(HEALTHY);
    render(<SystemDiagnostics />);

    await waitFor(() => expect(screen.getByText("serving requests")).toBeTruthy());
    const copy = document.body.textContent ?? "";
    expect(copy).toContain("System diagnostics");
    expect(copy).toContain("connected");
    expect(copy).toContain("2 room(s) listed");
    expect(copy).toContain("not supported in this browser");
    expect(copy).toMatch(/in sync|no server version seen yet/);
  });

  it("flags a deployment drift as a warning, not a crash", async () => {
    flags.forceIncompatible = true;
    stubFetch((url) => {
      if (url.includes("/api/deployment")) {
        return { status: 200, body: { version: "ffffffffff11", knownIds: ["ffffffffff11"] } };
      }
      return HEALTHY(url);
    });
    render(<SystemDiagnostics />);

    await waitFor(() => expect(screen.getByText(/browser .* vs server/)).toBeTruthy());
  });

  it("survives the study-rooms 500 while the rest of the stack stays green", async () => {
    stubFetch((url) => {
      if (url.includes("/api/study-rooms")) {
        return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Could not load study rooms" } } };
      }
      return HEALTHY(url);
    });
    render(<SystemDiagnostics />);

    await waitFor(() => expect(screen.getByText(/HTTP 500 — the rooms endpoint is failing/)).toBeTruthy());
    // The other probes still reported honestly.
    expect(screen.getByText("connected")).toBeTruthy();
    expect(screen.getByText("serving requests")).toBeTruthy();
  });

  it("separates a dead database from a dead API", async () => {
    stubFetch((url) => {
      if (url.includes("/api/healthz/ready")) {
        return { status: 503, body: { ready: false, database: false, config: { ok: true, errors: [] } } };
      }
      return HEALTHY(url);
    });
    render(<SystemDiagnostics />);

    await waitFor(() => expect(screen.getByText(/readiness probe returned 503/)).toBeTruthy());
    expect(screen.getByText("probe failed — no connection")).toBeTruthy();
  });

  it("paints every row in a loading state before any probe answers", () => {
    stubFetch(() => null);
    render(<SystemDiagnostics />);
    // First paint: all six rows exist with probing copy, not blank space and
    // not a spinner in place of a label.
    const copy = document.body.textContent ?? "";
    for (const probe of [
      "asking the server…",
      "probing /healthz…",
      "probing readiness…",
      "loading rooms…",
      "checking registration…",
    ]) {
      expect(copy, probe).toContain(probe);
    }
  });

  it("re-checks on demand", async () => {
    const fetchMock = stubFetch(HEALTHY);
    render(<SystemDiagnostics />);
    await waitFor(() => expect(screen.getByText("connected")).toBeTruthy());
    const before = fetchMock.mock.calls.length;
    screen.getByRole("button", { name: /re-check/i }).click();
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
  });
});
