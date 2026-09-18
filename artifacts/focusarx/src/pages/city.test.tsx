import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import CityPage from "./city";

/**
 * Two claims about the user's own money that the page could not support.
 *
 * 1. The three loads were combined with `if (!cr.ok && !br.ok) throw`, so a
 *    failure of `/api/city/buildings` *alone* left `buildings` as `[]` and
 *    rendered "No buildings available yet" — telling the user FocusArx has no
 *    buildings to offer, when the buildings endpoint had merely failed.
 *
 * 2. `canAfford` was `wallet ? wallet.coins >= cost : false`. With the wallet
 *    request failed, every card silently became unaffordable and its
 *    accessible name announced the shortfall exactly: "costs 1,500 coins, you
 *    need 1,500 more". We had no idea what the user's balance was.
 *
 * The price is a catalog fact and still renders. The claim about the balance
 * waits until we have one.
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
vi.mock("@/hooks/usePremium", () => ({ usePremium: () => ({ isPremium: false }) }));

const buildings = [
  { slug: "library", name: "Grand Library", category: "study", coinCost: 1500, unlockLevel: 1, description: "Books", emoji: "📚" },
];

function stubCity({
  buildingsOk = true,
  walletOk = true,
}: { buildingsOk?: boolean; walletOk?: boolean } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("/api/city/buildings")) {
        return Promise.resolve({
          ok: buildingsOk,
          status: buildingsOk ? 200 : 500,
          json: () => Promise.resolve(buildingsOk ? buildings : {}),
        });
      }
      if (url.includes("/api/gamification/wallet")) {
        return Promise.resolve({
          ok: walletOk,
          status: walletOk ? 200 : 500,
          json: () => Promise.resolve(walletOk ? { coins: 20000, level: 5 } : {}),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ owned: [], name: "My City", level: 5 }),
      });
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

describe("a failed buildings load is not an empty catalog", () => {
  it("offers a retry instead of claiming there are no buildings", async () => {
    stubCity({ buildingsOk: false });

    render(<CityPage />);

    await waitFor(() => expect(screen.getByText(/the building catalog/)).toBeTruthy());
    expect(screen.queryByText("No buildings available yet")).toBeNull();
  });

  it("renders the catalog when the request succeeds", async () => {
    stubCity();
    render(<CityPage />);

    await waitFor(() => expect(screen.getByText("Grand Library")).toBeTruthy());
    expect(screen.queryByText(/the building catalog/)).toBeNull();
  });
});

describe("an unknown balance is not a shortfall", () => {
  it("does not tell the user how many more coins they need", async () => {
    stubCity({ walletOk: false });

    render(<CityPage />);
    await waitFor(() => expect(screen.getByText("Grand Library")).toBeTruthy());

    // The old accessible name stated the shortfall as fact.
    expect(screen.queryByLabelText(/you need [\d,]+ more/)).toBeNull();
    expect(screen.getByLabelText(/can't check your coin balance/)).toBeTruthy();

    // The balance slot stays, admitting it doesn't know.
    expect(screen.getByLabelText("Coin balance unavailable")).toBeTruthy();
    expect(screen.getByText("Check balance")).toBeTruthy();
  });

  it("shows the balance when the wallet request succeeds", async () => {
    stubCity();
    render(<CityPage />);

    await waitFor(() => expect(screen.getByText("🪙 20,000")).toBeTruthy());
    expect(screen.queryByText("Check balance")).toBeNull();
  });
});
