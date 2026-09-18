import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import RoadmapPage from "./roadmap";

/**
 * A saved protocol list that fails to load must not just disappear.
 *
 * `fetchSavedList` ran `if (r.ok) { setSavedRoadmaps(...) }` with no else, and
 * swallowed failures with an empty catch. The "Saved Protocols" section only
 * renders when the list is non-empty, so a failed request removed the whole
 * section: a user with five saved roadmaps saw none of them, with no message
 * and no retry — the shape of "your saved work is gone". The silent catch made
 * it invisible from our side too, so a broken list endpoint would never have
 * been noticed.
 */

vi.mock("@/components/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ status: "authenticated" }),
  getToken: () => "test-token",
}));
vi.mock("@/components/PageSEO", () => ({
  PageSEO: () => null,
  PAGE_SEO: new Proxy({}, { get: () => ({}) }),
}));
vi.mock("@/components/AuthorBlock", () => ({ AuthorBlock: () => null }));

function stubList({ ok }: { ok: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("/api/roadmap/list")) {
        return Promise.resolve({
          ok,
          status: ok ? 200 : 500,
          json: () =>
            Promise.resolve(
              ok
                ? { roadmaps: [{ id: 7, subject: "Organic Chemistry", createdAt: "2026-02-01T00:00:00Z" }] }
                : {},
            ),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    }),
  );
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a failed saved-list load is not an empty saved list", () => {
  it("offers a retry instead of silently hiding the section", async () => {
    stubList({ ok: false });

    render(<RoadmapPage />);

    await waitFor(() => expect(screen.getByText(/your saved protocols/)).toBeTruthy());
    expect(screen.getByText("Try again")).toBeTruthy();
    // The section that vanished entirely before.
    expect(screen.queryByText("Saved Protocols")).toBeNull();
  });

  it("recovers on retry and shows the saved roadmaps", async () => {
    stubList({ ok: false });
    render(<RoadmapPage />);
    await waitFor(() => expect(screen.getByText(/your saved protocols/)).toBeTruthy());

    stubList({ ok: true });
    fireEvent.click(screen.getByText("Try again"));

    await waitFor(() => expect(screen.getByText("Organic Chemistry")).toBeTruthy());
    expect(screen.queryByText(/your saved protocols/)).toBeNull();
  });
});
