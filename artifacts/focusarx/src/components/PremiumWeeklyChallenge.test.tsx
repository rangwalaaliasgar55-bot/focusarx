import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PremiumWeeklyChallenge } from "./PremiumWeeklyChallenge";
import { ToastProvider } from "@/components/Toast";

/**
 * The weekly premium contract.
 *
 * The claims worth pinning:
 *   • a free student's dashboard must not sprout a premium advert (that is what
 *     `requirePremium` is for), but the premium page shows it locked — "here is
 *     this week's version of what you get" is the advert;
 *   • the claim button only appears when the server says the week is claimable —
 *     a button that cannot pay out is worse than no button;
 *   • a claimed week says so and offers nothing to press.
 */
let PREMIUM = true;

vi.mock("@/hooks/usePremium", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/usePremium")>();
  return { ...actual, usePremium: () => ({ isPremium: PREMIUM, isLoading: false }) };
});

const CALLS: Array<{ url: string; method: string }> = [];

const PAYLOAD = {
  weekKey: "2026-W39",
  requiresPremium: false,
  claimed: false,
  claimable: true,
  resetsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  challenge: {
    id: "five-days", title: "Five days on", description: "Focus on 5 different days this week.",
    metric: "days", target: 5, tokenReward: 300, coinReward: 600, xpReward: 1000,
  },
  progress: { current: 5, target: 5, percent: 100, complete: true },
  stats: { minutes: 400, sessions: 9, days: 5, quality: 4, tasks: 2 },
};

function mockFetch(payload: unknown = PAYLOAD) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    CALLS.push({ url, method: init?.method ?? "GET" });
    if (!url.includes("/api/premium/challenge")) {
      return new Response("{}", { status: 404, headers: { "Content-Type": "application/json" } });
    }
    const body = init?.method === "POST" ? { ok: true, tokenReward: 300, coinReward: 600 } : payload;
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

describe("PremiumWeeklyChallenge", () => {
  beforeEach(() => {
    CALLS.length = 0;
    PREMIUM = true;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows this week's challenge, the countdown and the payout", async () => {
    mockFetch();
    wrap(<PremiumWeeklyChallenge requirePremium />);
    expect(await screen.findByText("Five days on")).toBeTruthy();
    expect(screen.getByText(/2026-W39/)).toBeTruthy();
    expect(screen.getByText("300 tokens")).toBeTruthy();
    expect(screen.getByText(/left/)).toBeTruthy();
    expect(screen.getByText(/target met/)).toBeTruthy();
  });

  it("renders nothing on a free student's dashboard", () => {
    PREMIUM = false;
    mockFetch({ ...PAYLOAD, requiresPremium: true, claimable: false });
    const { container } = wrap(<PremiumWeeklyChallenge requirePremium />);
    expect(container.textContent).toBe("");
    // …and does not even ask the server for it.
    expect(CALLS).toHaveLength(0);
  });

  it("shows it locked on the premium page instead", async () => {
    PREMIUM = false;
    mockFetch({ ...PAYLOAD, requiresPremium: true, claimable: false });
    wrap(<PremiumWeeklyChallenge />);
    expect(await screen.findByText("Five days on")).toBeTruthy();
    expect(screen.getByText(/Unlock with tokens/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /claim tokens/i })).toBeNull();
  });

  it("claims through the server and says what was paid", async () => {
    mockFetch();
    wrap(<PremiumWeeklyChallenge requirePremium />);
    const button = await screen.findByRole("button", { name: /claim tokens/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(CALLS.some((c) => c.url.includes("/api/premium/challenge/claim") && c.method === "POST")).toBe(true);
    });
  });

  it("offers nothing to press before the target is met", async () => {
    mockFetch({ ...PAYLOAD, claimable: false, progress: { current: 2, target: 5, percent: 40, complete: false } });
    wrap(<PremiumWeeklyChallenge requirePremium />);
    const button = await screen.findByRole("button", { name: /not yet/i });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/3 to go/)).toBeTruthy();
  });

  it("says so when the week is already claimed", async () => {
    mockFetch({ ...PAYLOAD, claimed: true, claimable: false });
    wrap(<PremiumWeeklyChallenge requirePremium />);
    expect(await screen.findByText(/Claimed this week/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /claim tokens/i })).toBeNull();
  });
});
