import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PetsPage from "./pets";

/**
 * An unknown collection must not render as an empty one.
 *
 * The page fetched the catalog and the inventory together but only handled a
 * catalog failure. An inventory failure fell into `if (invRes.ok)` with no
 * `else`, leaving `inventory` as `[]` while `loadError` stayed false — so the
 * page rendered as entirely healthy and, because `ownedSlugs` is built from
 * that array, told the user:
 *
 *   - every pet they already owned was not theirs, with an active price button;
 *   - "My Pets (0)" in the tab;
 *   - "No pets yet — unlock from collection", which is false *and* sends them
 *     off to spend tokens on pets they already have.
 *
 * The server is idempotent, so no one is charged twice — the harm is a
 * confident lie about the user's own collection, and a "Unlocked!" toast for a
 * purchase they had made weeks ago. Ownership is the fact this screen exists
 * to report; when it is unknown, the screen has to say so.
 */

vi.mock("@/components/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ status: "authenticated" }), getToken: () => "t" }));
vi.mock("@/components/PageSEO", () => ({
  PageSEO: () => null,
  PAGE_SEO: new Proxy({}, { get: () => ({}) }),
}));
vi.mock("@/components/Pet3D", () => ({ Pet3D: () => null }));

const catalog = [
  { id: 1, slug: "owl", name: "Night Owl", description: "Wise", category: "starter", rarity: "common", tokenCost: 0, isPremium: false },
  { id: 2, slug: "fox", name: "Clever Fox", description: "Sharp", category: "starter", rarity: "rare", tokenCost: 50, isPremium: false },
];

/** The user owns the fox. The catalog endpoint always succeeds; only the
 *  inventory endpoint fails, which is the case the old code swallowed. */
function stubFetch({ inventoryOk }: { inventoryOk: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("/api/pets/inventory")) {
        return Promise.resolve({
          ok: inventoryOk,
          status: inventoryOk ? 200 : 500,
          json: () =>
            Promise.resolve({ inventory: [{ id: 9, petId: 2, isActive: true, level: 3, catalog: { slug: "fox", name: "Clever Fox" }, inventory: { level: 3, isActive: true } }] }),
        });
      }
      if (url.includes("/api/pets/catalog")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ pets: catalog }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    }),
  );
}

/** pets.tsx reads premium status through react-query, so it needs a client. */
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <PetsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("an unknown collection is not an empty one", () => {
  it("says ownership could not be checked instead of offering to sell it back", async () => {
    stubFetch({ inventoryOk: false });

    renderPage();

    // The lie: the collection is presented as empty.
    await waitFor(() => expect(screen.getAllByText("Check status").length).toBe(2));
    expect(screen.queryByText(/My Pets \(0\)/)).toBeNull();

    // And no price button for a pet that may already be owned.
    const spendButtons = screen.queryAllByText(/^🪙 /);
    expect(spendButtons.length).toBe(0);
  });

  it("does not claim \"No pets yet\" when the inventory request failed", async () => {
    stubFetch({ inventoryOk: false });

    renderPage();
    await waitFor(() => expect(screen.getAllByText("Check status").length).toBe(2));

    fireEvent.click(screen.getByText(/My Pets/));

    await waitFor(() => expect(screen.getByText(/your pet collection/)).toBeTruthy());
    expect(screen.queryByText(/No pets yet/)).toBeNull();
  });

  it("shows ownership normally when both requests succeed", async () => {
    stubFetch({ inventoryOk: true });

    renderPage();

    // The fox is owned, so it is labelled rather than priced.
    await waitFor(() => expect(screen.getByText("My Pets (1)")).toBeTruthy());
    expect(screen.getByText("Owned")).toBeTruthy();
    expect(screen.queryAllByText("Check status").length).toBe(0);
  });
});
