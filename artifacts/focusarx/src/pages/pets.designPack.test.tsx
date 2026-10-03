import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DEFAULT_APPEARANCE, type PetDesignId } from "@/lib/designPacks";
import { __resetAppearanceStateForTests, setAppearanceState } from "@/lib/appearance";
import PetsPage from "./pets";

/**
 * The companion-art pack, on the page that shows the companion.
 *
 * The three packs are not three skins of one picture: `classic` is the posed
 * rig, `wild3d` builds the animal from its own parameters, and `sprite` means
 * **no 3D at all** — which is a promise, not a preference. So the assignment has
 * to reach this page, and `sprite` has to win over the 3D/2D toggle without
 * destroying the visitor's own choice (an admin can release the pin again).
 *
 * WebGL is mocked as available: jsdom has no canvas, so without that the page
 * would take the no-3D path regardless of the pack and every assertion below
 * would pass for the wrong reason.
 */

vi.mock("@/lib/webglCapability", () => ({ is3DCapable: () => true }));
vi.mock("@/components/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ status: "authenticated" }), getToken: () => "t" }));
vi.mock("@/components/PageSEO", () => ({
  PageSEO: () => null,
  PAGE_SEO: new Proxy({}, { get: () => ({}) }),
}));
/** Stands in for three.js, which cannot run under jsdom. */
vi.mock("@/components/Pet3D", () => ({ Pet3D: () => <div data-testid="pet3d" /> }));

const catalog = [
  { id: 1, slug: "owl", name: "Night Owl", description: "Wise", category: "starter", rarity: "common", tokenCost: 0, isPremium: false },
];

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("/api/pets/inventory")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              inventory: [
                { id: 9, petId: 1, isActive: true, level: 3, catalog: { slug: "owl", name: "Night Owl" }, inventory: { level: 3, isActive: true } },
              ],
            }),
        });
      }
      if (url.includes("/api/pets/catalog")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ pets: catalog }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    }),
  );
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <PetsPage />
    </QueryClientProvider>,
  );
}

/** Assign a pack the way the store does once the server has answered. */
function assign(petDesign: PetDesignId) {
  setAppearanceState({ fields: { ...DEFAULT_APPEARANCE, petDesign }, source: "admin", locked: true, synced: true });
}

beforeEach(() => {
  __resetAppearanceStateForTests();
  stubFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  __resetAppearanceStateForTests();
});

describe("companion art pack", () => {
  it("renders the 3D stage on a capable device when nothing is assigned", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("pet3d")).toBeTruthy());
  });

  it("renders it for the wild pack too — same stage, different animal", async () => {
    assign("wild3d");
    renderPage();
    await waitFor(() => expect(screen.getByTestId("pet3d")).toBeTruthy());
  });

  it("never renders 3D when the account is on the sprite pack", async () => {
    assign("sprite");
    renderPage();

    // Wait for the showcase to exist at all (the 2D stage has the pet's own
    // interaction), then assert the canvas never appears.
    await waitFor(() => expect(screen.getByRole("button", { name: /Say hi to/ })).toBeTruthy());
    expect(screen.queryByTestId("pet3d")).toBeNull();
    // The toggle itself is gone too: offering a control the pack forbids is the
    // interface lying about what it will do.
    expect(screen.queryByRole("button", { name: "3D" })).toBeNull();
    expect(screen.queryByRole("button", { name: "2D" })).toBeNull();
  });

  it("keeps the visitor's own 3D choice when the pin is released", async () => {
    assign("sprite");
    const { unmount } = renderPage();
    await waitFor(() => expect(screen.queryByTestId("pet3d")).toBeNull());
    unmount();

    // Admin released the account: the pack is back to the default, and the
    // device-capable default returns — the sprite assignment did not permanently
    // latch the page into 2D.
    __resetAppearanceStateForTests();
    renderPage();
    await waitFor(() => expect(screen.getByTestId("pet3d")).toBeTruthy());
  });
});
