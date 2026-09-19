import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import ConsequencesPage from "./consequences";

/**
 * Two ways this page told the user something untrue.
 *
 * 1. A failed load rendered as a blank page. The week's content is gated on
 *    `data`, so when the request failed there was nothing to draw below the
 *    header and the only explanation was a toast that had already faded. The
 *    page showed no contracts whether the user had none or the request had
 *    simply failed — and those are different facts.
 *
 * 2. The card decided "is this the current week?" from the browser clock
 *    instead of the answer the server had already computed. The old expression
 *    was
 *
 *      new Date(Date.now() - ((getDay() + 6) % 7) * 86400000)
 *        .toISOString().slice(0, 10)
 *
 *    A **local** weekday used to step back from a **UTC** instant. East of
 *    Greenwich that is wrong for part of every Monday — at 02:00 IST it is
 *    still Sunday in UTC, so it returned *last* week's Monday and the live
 *    contract was read as a finished one. The progress bar and the "m" so far"
 *    figure vanished, in the timezone most of this app's users are in, for five
 *    and a half hours every Monday.
 *
 * The contract test below does not try to reproduce a timezone offset. It
 * asserts the stronger property the fix establishes: the card reads the week
 * from the server, and never consults the clock at all. A card that is right
 * about the week only because the machine's clock agreed with the server is
 * still the bug, one timezone away.
 */

const toast = vi.fn();
vi.mock("@/components/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ status: "authenticated", user: { id: "u1" } }),
  getToken: () => "test-token",
}));
vi.mock("@/components/PageSEO", () => ({ PageSEO: () => null }));

function contract(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    weekStart: "2026-01-05",
    contractType: "charity",
    targetMinutes: 600,
    charityName: null,
    charityAmount: null,
    achieved: false,
    consequenceTriggered: false,
    createdAt: "2026-01-05T00:00:00.000Z",
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    contracts: [contract()],
    currentContract: contract(),
    weekMinutes: 120,
    weekStart: "2026-01-05",
    freezeTokens: 0,
    ...overrides,
  };
}

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

function okFetch(body: unknown) {
  const fn = vi.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  toast.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a failed load is not \"no contracts\"", () => {
  it("shows a retryable error instead of a blank page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })),
    );

    render(<ConsequencesPage />);
    await flush();

    // The bug: this page was empty here. `data` stayed null, so every content
    // block was skipped and the user saw a header above nothing.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("your contracts");
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("recovers when the retry succeeds", async () => {
    let fail = true;
    const fetchFn = vi.fn(() =>
      fail
        ? Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) })
        : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload()) }),
    );
    vi.stubGlobal("fetch", fetchFn);

    render(<ConsequencesPage />);
    await flush();
    expect(screen.getByText("Try again")).toBeTruthy();

    fail = false;
    fireEvent.click(screen.getByText("Try again"));
    await flush();

    expect(screen.queryByText("Try again")).toBeNull();
    expect(screen.getByText(/Target: 600m focus/)).toBeTruthy();
  });
});

describe("the current week comes from the server, not the clock", () => {
  it("renders progress for a week the server calls current, even if the clock's week differs", async () => {
    // The card must not care what today is. Freeze the clock well away from the
    // contract's week: a card that recomputes the week locally reads this as a
    // past contract and drops both the progress bar and the "so far" figure.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T09:00:00.000Z"));

    okFetch(payload());
    render(<ConsequencesPage />);
    await flush();

    expect(screen.getByText("120m so far")).toBeTruthy();
  });

  it("hides progress for a past week the server does not call current", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-07T09:00:00.000Z"));

    const past = contract({ id: "c0", weekStart: "2025-12-29" });
    okFetch(payload({ contracts: [contract(), past] }));
    render(<ConsequencesPage />);
    await flush();

    // The current week shows its figure; the settled week does not claim one.
    expect(screen.getByText("120m so far")).toBeTruthy();
    expect(screen.getAllByText(/Target:/).length).toBe(2);
  });

  it("survives a week boundary in a timezone east of UTC", async () => {
    // Monday 02:00 IST is still Sunday in UTC — the exact instant the old
    // expression misread. The server's own weekStart is the only authority.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T20:30:00.000Z")); // 2026-03-16 02:00 IST

    okFetch(payload({ weekStart: "2026-03-16", currentContract: contract({ weekStart: "2026-03-16" }) }));
    render(<ConsequencesPage />);
    await flush();

    expect(screen.getByText("120m so far")).toBeTruthy();
  });
});
