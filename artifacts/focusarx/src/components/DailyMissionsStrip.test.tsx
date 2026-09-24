import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DailyMissionsStrip } from "./DailyMissionsStrip";
import { ToastProvider } from "@/components/Toast";

/**
 * The daily loop on the dashboard.
 *
 * Three behaviours matter and each has been a real defect somewhere in this
 * app before:
 *   1. a missing field must shrink the card, not blank the dashboard (this
 *      renders above the fold on the most-visited page);
 *   2. a claim must actually call the server — a claim button that only says
 *      "claimed" is a lie the student cannot check;
 *   3. nothing to show must mean *nothing rendered*, not an empty box.
 */
function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

const CALLS: Array<{ url: string; method: string }> = [];

const MISSIONS = {
  daily: [
    { key: "daily_first_session", title: "First Strike", description: "Complete your first focus session today", type: "daily", xpReward: 150, coinReward: 75, targetValue: 1, unit: "sessions", currentValue: 1, completed: true, rewardClaimed: false },
    { key: "daily_60_minutes", title: "Deep Worker", description: "Accumulate 60 minutes of focus time today", type: "daily", xpReward: 400, coinReward: 160, targetValue: 60, unit: "minutes", currentValue: 25, completed: false, rewardClaimed: false },
  ],
  weekly: [],
  featured: {
    key: "daily_two_sessions", title: "Double Down", description: "Complete 2 focus sessions today", type: "daily",
    xpReward: 250, coinReward: 100, targetValue: 2, unit: "sessions", currentValue: 1, completed: false, rewardClaimed: false,
    completionsLast24h: 41,
  },
  stats: { dailyCompleted: 1, totalDaily: 2, weeklyCompleted: 0, totalWeekly: 0 },
};

function mockFetch(payload: unknown = MISSIONS, status = 200) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    CALLS.push({ url, method: init?.method ?? "GET" });
    if (!url.includes("/api/missions")) {
      return new Response(JSON.stringify({}), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    const body = init?.method === "POST" ? { ok: true, xpEarned: 250, coinsEarned: 100 } : payload;
    return new Response(JSON.stringify(body), { status: init?.method === "POST" ? 200 : status, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("DailyMissionsStrip", () => {
  beforeEach(() => {
    CALLS.length = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows today's progress, the mission of the day and how many students cleared it", async () => {
    mockFetch();
    wrap(<DailyMissionsStrip />);

    expect(await screen.findByText("Today's missions")).toBeTruthy();
    expect(screen.getByText(/1 of 2 done today/)).toBeTruthy();
    expect(screen.getByText("Double Down")).toBeTruthy();
    expect(screen.getByText(/41 students cleared this/)).toBeTruthy();
    // The reward is stated in coins and XP, so the goal has a price.
    expect(screen.getByText(/pays 100 coins and 250 XP/)).toBeTruthy();
    expect(screen.getByText(/1 to claim/)).toBeTruthy();
  });

  it("claims the mission of the day through the server", async () => {
    mockFetch({ ...MISSIONS, featured: { ...MISSIONS.featured, currentValue: 2, completed: true } });
    wrap(<DailyMissionsStrip />);

    const button = await screen.findByRole("button", { name: /claim reward/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(CALLS.some((c) => c.url.includes("/api/missions/daily_two_sessions/claim") && c.method === "POST")).toBe(true);
    });
  });

  it("renders the completed state when every daily mission is done", async () => {
    mockFetch({ ...MISSIONS, stats: { ...MISSIONS.stats, dailyCompleted: 2 } });
    wrap(<DailyMissionsStrip />);
    expect(await screen.findByText("Today's missions — all cleared")).toBeTruthy();
    expect(screen.getByText(/reset at midnight/)).toBeTruthy();
  });

  it("renders nothing at all when the payload is unusable", async () => {
    mockFetch({});
    const { container } = wrap(<DailyMissionsStrip />);
    await waitFor(() => {
      expect(CALLS.length).toBeGreaterThan(0);
    });
    expect(container.textContent).toBe("");
  });

  it("renders nothing when the fetch fails, rather than an empty card", async () => {
    mockFetch({}, 500);
    const { container } = wrap(<DailyMissionsStrip />);
    await waitFor(() => {
      expect(CALLS.length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(container.textContent).toBe("");
    });
  });
});
