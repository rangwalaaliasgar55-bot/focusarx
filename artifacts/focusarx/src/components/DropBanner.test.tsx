import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/socket", () => ({ useSocketEvent: () => undefined }));
vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getToken: () => "member-token" }));

import { DropBanner } from "./DropBanner";

const now = Date.now();
const drops = [
  {
    id: "coin-rain", type: "coin_rain", title: "Lunar coin rain", description: "Claim a reward before the pool empties.",
    payload: { coinsPerClaim: 250 }, startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 3_600_000).toISOString(),
    poolTotal: 100, poolRemaining: 42, live: true, upcoming: false,
  },
  {
    id: "double-xp", type: "double_xp", title: "Double XP hour", description: null,
    payload: { multiplier: 2 }, startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 3_600_000).toISOString(),
    poolTotal: 0, poolRemaining: 0, live: true, upcoming: false,
  },
];

describe("DropBanner", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("foregrounds one actionable event and collapses concurrent events until requested", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ drops }), { status: 200 })));
    // DropBanner reads through the shared React Query cache now, so it needs
    // a provider like every other query-consuming surface.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <DropBanner />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: "Lunar coin rain" })).toBeTruthy());
    expect(screen.getByText("42 of 100 left")).toBeTruthy();
    expect(screen.queryByText("Double XP hour")).toBeNull();
    expect(screen.getByRole("button", { name: "Show 1 other event" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show 1 other event" }));
    expect(screen.getByText("Double XP hour")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Start a focus session" })).toBeTruthy();
  });
});
