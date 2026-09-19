import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import FlashcardsPage from "./flashcards";

/**
 * A failed request must never render as a data claim.
 *
 * Three places on this page did exactly that, and on a spaced-repetition app
 * the lie has a particular sting: "No decks yet" and "No cards in this deck"
 * read as *your reviews are gone*, when the request had merely failed.
 *
 * The third is worse than a display bug. Grading a card wrote the new FSRS
 * schedule locally and fired the review at the server inside
 * `fetch(...).catch(() => {})` — no `res.ok` check at all. A rejected write was
 * therefore indistinguishable from a successful one: the card advanced, the
 * user moved on, and the server kept the old schedule. The next interval the
 * algorithm computes is the entire product, and it was quietly wrong.
 */

const toast = vi.fn();
vi.mock("@/components/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/auth", () => ({ getToken: () => "test-token" }));
vi.mock("@/components/PageSEO", () => ({ PageSEO: () => null }));

function deck(overrides: Record<string, unknown> = {}) {
  return { id: 1, title: "Kanji", description: "", cardCount: 3, dueCount: 2, ...overrides };
}

function card(id: number) {
  return { id, deckId: 1, front: `Front ${id}`, back: `Back ${id}`, fsrs: null };
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

afterEach(() => {
  cleanup();
  toast.mockClear();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  toast.mockClear();
});

describe("a failed load is not an empty deck", () => {
  it("shows an error when the deck list request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    render(<FlashcardsPage />);
    await flush();

    expect(screen.getByText("Couldn't load your decks")).toBeTruthy();
    expect(screen.queryByText(/No decks yet/)).toBeNull();
  });

  it("shows an error when the deck list request cannot be sent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<FlashcardsPage />);
    await flush();

    expect(screen.getByText("Couldn't load your decks")).toBeTruthy();
  });

  it("still shows the genuine empty state when the request succeeds with nothing", async () => {
    // The other half: the error branch must not swallow a real empty deck.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }));
    render(<FlashcardsPage />);
    await flush();

    expect(screen.getByText(/No decks yet/)).toBeTruthy();
    expect(screen.queryByText("Couldn't load your decks")).toBeNull();
  });

  it("shows an error when a deck's cards fail to load, not 'no cards'", async () => {
    // Tapping a deck holding a hundred cards and being told it is empty is the
    // specific failure this replaced.
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/flashcards/decks") {
        return Promise.resolve({ ok: true, status: 200, json: async () => [deck()] });
      }
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<FlashcardsPage />);
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByText("Kanji"));
    });
    await flush();

    expect(screen.getByText("Couldn't load this deck's cards")).toBeTruthy();
    expect(screen.queryByText(/No cards in this deck/)).toBeNull();
  });

  it("leaves a successful empty deck alone", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/flashcards/decks") {
        return Promise.resolve({ ok: true, status: 200, json: async () => [deck()] });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<FlashcardsPage />);
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByText("Kanji"));
    });
    await flush();

    expect(screen.getByText(/No cards in this deck/)).toBeTruthy();
  });
});

describe("a grade the server did not record is not a silent success", () => {
  async function studyOneCard() {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/flashcards/decks") {
        return Promise.resolve({ ok: true, status: 200, json: async () => [deck()] });
      }
      if (url.endsWith("/cards")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [card(1), card(2)] });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<FlashcardsPage />);
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByText("Kanji"));
    });
    await flush();
    return fetchMock;
  }

  it("warns when the review write is rejected, and stays quiet when it is not", async () => {
    await studyOneCard();

    // Reveal the answer so the grade buttons render.
    await act(async () => {
      fireEvent.click(screen.getByText(/Show Answer/i));
    });

    // From here the review POST fails twice (the retry also fails).
    const failing = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal("fetch", failing);

    await act(async () => {
      fireEvent.click(screen.getByText("Forgot"));
    });
    await flush();

    expect(screen.getByTestId("unsaved-reviews")).toBeTruthy();
    expect(screen.getByText(/1 grade was not saved/)).toBeTruthy();
  });

  it("says nothing when the review is accepted", async () => {
    await studyOneCard();
    await act(async () => {
      fireEvent.click(screen.getByText(/Show Answer/i));
    });
    // The default mock accepts everything.
    await act(async () => {
      fireEvent.click(screen.getByText("Good"));
    });
    await flush();

    expect(screen.queryByTestId("unsaved-reviews")).toBeNull();
  });
});
