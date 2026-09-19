import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VirtualStudyRoomPage from "./virtual-study-room";

/**
 * A failed room fetch used to delete a section of a public landing page.
 *
 * `fetchPublicRooms` did `if (!res.ok) return []`. Empty is a legitimate
 * answer — there may be no rooms open right now — so the 500 was absorbed and
 * the "Live rooms right now" section, the page's strongest social proof,
 * simply did not render. Nothing in the UI and nothing in the logs
 * distinguished "no one is studying" from "the request failed".
 *
 * The section header already promises "Happening now"; the honest thing when
 * we cannot know is to say so and offer a retry, not to pretend the rooms
 * aren't there.
 *
 * These tests drive the real react-query client and the real `fetch` call.
 * An earlier version of this file mocked `useQuery` and asserted only that
 * `isError` produced the error block — which passed even after the `return []`
 * regression was re-injected, because nothing in it ever reached the code that
 * was wrong. The failure has to start at the network boundary or the test
 * proves nothing.
 */

vi.mock("@/components/PageSEO", () => ({
  PageSEO: () => null,
  PAGE_SEO: new Proxy({}, { get: () => ({}) }),
}));
vi.mock("@/components/AuthorBlock", () => ({ AuthorBlock: () => null }));
vi.mock("@/content/seo-pages.mjs", () => ({ GUIDE_LIBRARY_REVIEWED: "2026-01-01" }));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <VirtualStudyRoomPage />
    </QueryClientProvider>,
  );
}

function stubRooms(response: { ok: boolean; status: number; body: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ...response, json: () => Promise.resolve(response.body) })),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a failed room fetch does not silently delete the live section", () => {
  it("turns a 500 into a retryable error, not an empty room list", async () => {
    stubRooms({ ok: false, status: 500, body: {} });

    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("the live rooms");
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("keeps the section quiet for a genuinely empty list", async () => {
    // The legitimate empty case: the request worked, nobody is studying. That
    // is not an error, and the section is allowed to stay out of the way.
    stubRooms({ ok: true, status: 200, body: [] });

    renderPage();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders the rooms when the request succeeds", async () => {
    stubRooms({
      ok: true,
      status: 200,
      body: [{ id: 1, name: "JEE Night Shift", description: "", isLive: true }],
    });

    renderPage();

    expect(await screen.findByText("JEE Night Shift")).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("never prints a head count, even when the payload carries one", async () => {
    // Older API builds returned per-room counts. The public page must not turn
    // them into "N online" / "N people studying now" — summed over the list
    // that is a live user counter, which is not published.
    stubRooms({
      ok: true,
      status: 200,
      body: [
        { id: 1, name: "JEE Night Shift", description: "", isLive: true, participantCount: 4, onlineCount: 4, activeCount: 4 },
        { id: 2, name: "Quiet Library", description: "", isLive: false, participantCount: 9, onlineCount: 0 },
      ],
    });

    renderPage();

    expect(await screen.findByText("JEE Night Shift")).toBeTruthy();
    expect(screen.queryByText(/\d+ online/)).toBeNull();
    expect(screen.queryByText(/people studying now/)).toBeNull();
    expect(screen.getByText("1 room live now")).toBeTruthy();
    expect(screen.getByText("Open")).toBeTruthy();
  });
});
