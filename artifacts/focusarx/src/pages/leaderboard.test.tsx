import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import LeaderboardPage, { formatCountdown, msUntilWeeklyReset } from "./leaderboard";

/**
 * The board used to renumber everyone from 1 over the rows it received, which
 * discarded the one number the server computes carefully.
 *
 * `GET /api/social/leaderboard` caps the board at 200 rows but **always appends
 * the viewer with their true rank**, even past the cut — so a user genuinely
 * ranked 4,812 was shown as "rank 201". That is a wrong number presented with
 * complete confidence, and worse than a missing one: 201 is where *everyone*
 * outside the cut lands, so the figure never moves no matter how much they
 * focus.
 *
 * It also killed the feature meant to handle exactly this case. The "your
 * position" row was conditioned on the renumbered rank exceeding the list
 * length, which after renumbering could never be true — dead code. The user saw
 * a row in the middle of the top 200 claiming rank ~150 instead.
 */

const getToken = vi.fn(() => "test-token");
vi.mock("@/lib/auth", () => ({ getToken: () => getToken() }));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/TiltCard", () => ({
  TiltCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/AdSlot", () => ({ AdSlot: () => null }));
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function entry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    rank: 1,
    userId: "u1",
    name: "Ada",
    weeklyXp: 100,
    totalXp: 1000,
    coins: 10,
    streak: 3,
    isCurrentUser: false,
    ...overrides,
  };
}

function respondWith(rows: unknown[]) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => rows });
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  getToken.mockReturnValue("test-token");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("rank comes from the server", () => {
  it("does not renumber a viewer the server placed past the cut", async () => {
    // 200 board rows plus the viewer, ranked 4812 and appended by the API.
    const rows = [
      ...Array.from({ length: 200 }, (_, i) =>
        entry({ rank: i + 1, userId: `u${i + 1}`, name: `User ${i + 1}`, weeklyXp: 10_000 - i }),
      ),
      entry({ rank: 4812, userId: "me", name: "Me", weeklyXp: 5, isCurrentUser: true }),
    ];
    vi.stubGlobal("fetch", respondWith(rows));
    render(<LeaderboardPage />);
    await flush();

    const standing = screen.getByTestId("your-standing");
    expect(standing.textContent).toContain("#4,812");
    // The regression: this used to read 201.
    expect(standing.textContent).not.toContain("#201");
  });

  it("pins the viewer's row outside the list rather than burying it by XP", async () => {
    // The old code sorted by XP and appended the viewer last, so the viewer's
    // row drifted into the middle of the board — visually claiming a place the
    // server had explicitly said was not theirs.
    const rows = [
      entry({ rank: 1, userId: "a", name: "Top", weeklyXp: 900 }),
      entry({ rank: 2, userId: "b", name: "Second", weeklyXp: 800 }),
      entry({ rank: 3, userId: "c", name: "Third", weeklyXp: 700 }),
      entry({ rank: 4, userId: "d", name: "Fourth", weeklyXp: 600 }),
      entry({ rank: 900, userId: "me", name: "Me", weeklyXp: 5, isCurrentUser: true }),
    ];
    vi.stubGlobal("fetch", respondWith(rows));
    render(<LeaderboardPage />);
    await flush();

    expect(screen.getByTestId("your-standing").textContent).toContain("#900");
    // And it is not one of the numbered list rows.
    expect(screen.queryByText("(you)")).toBeNull();
  });

  it("orders the list by the server's rank, so ties cannot swap between refreshes", async () => {
    // Both on 640 XP: sorting by XP leaves their order to the sort's stability,
    // which can differ from the server's tiebreak. Ranks 4 and 5 keep them in
    // the list rather than the podium, which is deliberately drawn 2-1-3.
    const rows = [
      entry({ rank: 1, userId: "a", name: "First", weeklyXp: 900 }),
      entry({ rank: 2, userId: "b", name: "Second", weeklyXp: 800 }),
      entry({ rank: 3, userId: "c", name: "Third", weeklyXp: 700 }),
      entry({ rank: 4, userId: "d", name: "Fourth", weeklyXp: 640 }),
      entry({ rank: 5, userId: "e", name: "Fifth", weeklyXp: 640 }),
    ];
    vi.stubGlobal("fetch", respondWith(rows));
    render(<LeaderboardPage />);
    await flush();

    // Both on 640 XP, listed in the server's order.
    const fourth = screen.getByText("Fourth");
    const fifth = screen.getByText("Fifth");
    expect(fourth.compareDocumentPosition(fifth) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the gap to the place above when the viewer is on the board", async () => {
    // A rank alone does not tell you what to do; the distance does, and it is
    // the only number here a single session can change.
    const rows = [
      entry({ rank: 1, userId: "a", name: "Top", weeklyXp: 900 }),
      entry({ rank: 2, userId: "b", name: "Second", weeklyXp: 800 }),
      entry({ rank: 3, userId: "c", name: "Third", weeklyXp: 700 }),
      entry({ rank: 4, userId: "d", name: "Fourth", weeklyXp: 640 }),
      entry({ rank: 5, userId: "me", name: "Me", weeklyXp: 557, isCurrentUser: true }),
    ];
    vi.stubGlobal("fetch", respondWith(rows));
    render(<LeaderboardPage />);
    await flush();

    const gap = screen.getByTestId("gap-to-next");
    expect(gap.textContent).toContain("83 XP");
    expect(gap.textContent).toContain("Fourth");
    expect(gap.textContent).toContain("#4");
  });

  it("shows no gap when the viewer is already first", async () => {
    const rows = [
      entry({ rank: 1, userId: "me", name: "Me", weeklyXp: 900, isCurrentUser: true }),
      entry({ rank: 2, userId: "b", name: "Second", weeklyXp: 800 }),
      entry({ rank: 3, userId: "c", name: "Third", weeklyXp: 700 }),
      entry({ rank: 4, userId: "d", name: "Fourth", weeklyXp: 600 }),
    ];
    vi.stubGlobal("fetch", respondWith(rows));
    render(<LeaderboardPage />);
    await flush();

    expect(screen.queryByTestId("gap-to-next")).toBeNull();
    expect(screen.queryByTestId("your-standing")).toBeNull();
  });
});

describe("states are distinguishable", () => {
  it("reports a failed load as a failure, not as an empty board", async () => {
    // "No one's on the board yet" when the request failed tells the user
    // something false about everyone else.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<LeaderboardPage />);
    await flush();

    expect(screen.getByText("Rankings unavailable")).toBeTruthy();
    expect(screen.queryByText(/No one's on the board yet/)).toBeNull();
  });

  it("treats a non-ok response as a failure even though it parses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => [] }));
    render(<LeaderboardPage />);
    await flush();
    expect(screen.getByText("Rankings unavailable")).toBeTruthy();
  });

  it("explains an empty friends board, where a lone row would look broken", async () => {
    vi.stubGlobal("fetch", respondWith([entry({ rank: 1, userId: "me", name: "Me", isCurrentUser: true })]));
    render(<LeaderboardPage />);
    await flush();

    // Switch to the friends scope.
    const friends = screen.getByRole("button", { name: /My friends/ });
    await act(async () => {
      friends.click();
    });
    await flush();

    expect(screen.getByText("Nobody else is here yet.")).toBeTruthy();
  });

  it("ignores a slow response for a filter the user has left", async () => {
    // Without the cancellation flag the slower request wins, and the tab shows
    // the wrong board with no way for the user to tell.
    let releaseSlow: ((value: unknown) => void) | null = null;
    const slow = new Promise((resolve) => {
      releaseSlow = resolve;
    });
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("period=weekly")) {
        return slow.then(() => ({ ok: true, status: 200, json: async () => [entry({ rank: 1, name: "Weekly Board" })] }));
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [entry({ rank: 1, name: "AllTime Board" })] });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<LeaderboardPage />);
    await flush();

    await act(async () => {
      screen.getByRole("button", { name: /All Time/ }).click();
    });
    await flush();
    expect(screen.getByText("AllTime Board")).toBeTruthy();

    // The weekly request finally resolves, after the user has moved on.
    await act(async () => {
      releaseSlow!(null);
      await Promise.resolve();
    });
    await flush();
    expect(screen.queryByText("Weekly Board")).toBeNull();
    expect(screen.getByText("AllTime Board")).toBeTruthy();
  });
});

describe("weekly reset countdown", () => {
  it("counts to the next Monday midnight in local time", () => {
    // Saturday 2026-09-19 12:00 local → Monday 2026-09-21 00:00 local.
    const saturday = new Date(2026, 8, 19, 12, 0, 0).getTime();
    const remaining = msUntilWeeklyReset(saturday);
    const expected = new Date(2026, 8, 21, 0, 0, 0).getTime() - saturday;
    expect(remaining).toBe(expected);
  });

  it("rolls over to the following Monday when it is already Monday", () => {
    const monday = new Date(2026, 8, 21, 0, 30, 0).getTime();
    const remaining = msUntilWeeklyReset(monday);
    const expected = new Date(2026, 8, 28, 0, 0, 0).getTime() - monday;
    expect(remaining).toBe(expected);
  });

  it("never returns a negative interval", () => {
    // A clock a second before the boundary must not render "-1s".
    const justBefore = new Date(2026, 8, 20, 23, 59, 59, 500).getTime();
    expect(msUntilWeeklyReset(justBefore)).toBeGreaterThan(0);
  });

  it("formats days while they last and hours after that", () => {
    expect(formatCountdown(2 * 86_400_000 + 5 * 3_600_000)).toBe("2d 5h");
    expect(formatCountdown(13 * 3_600_000 + 20 * 60_000)).toBe("13h 20m");
    expect(formatCountdown(59 * 60_000)).toBe("0h 59m");
  });

  it("says so at the boundary instead of showing nonsense", () => {
    expect(formatCountdown(0)).toBe("resetting now");
    expect(formatCountdown(-5000)).toBe("resetting now");
    expect(formatCountdown(NaN)).toBe("resetting now");
    expect(formatCountdown(Infinity)).toBe("resetting now");
  });
});
