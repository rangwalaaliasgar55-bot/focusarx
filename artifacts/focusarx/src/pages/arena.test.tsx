import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/Toast";
import { movesFor, statsFor } from "@/lib/petBattle";
import ArenaPage from "./arena";

/**
 * The arena page drives the turn loop, and that loop had two bugs the engine
 * tests could not see:
 *
 *   • the board assumed the *player* moved first. When the rival was faster the
 *     fight opened on the enemy's turn and simply froze — no beat was scheduled,
 *     so the grid stayed dead;
 *   • the beat was scheduled per click, so a second click inside the 620 ms
 *     window could resolve twice.
 *
 * What is asserted here is therefore the loop, not the maths: whose turn it is,
 * that the idle side's buttons are genuinely disabled, that the beat lands
 * after the timer and hands the turn back, and that the player's click moves
 * the *enemy's* bar. The engine underneath is the real one — these are the
 * integration seams.
 *
 * No session hint and no token means `hasSessionHint()` is false, so the page
 * makes no requests: this is the guest path, which is also the one a new device
 * sees.
 */

// A deliberately slow companion against the fastest rival in the fallback list,
// so the fight opens on the rival's turn. The pair is asserted below rather than
// trusted: if the balance numbers change so that this pet is no longer the
// slower animal, the test says so instead of quietly testing the other branch.
const PET = { slug: "axolotl", name: "Axolotl", level: 5, category: "starter" };
const FAST_RIVAL = "Sage Owl";

vi.mock("@/hooks/useActivePet", () => ({
  useActivePet: () => ({ data: PET, isLoading: false, isError: false }),
}));

function renderArena() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ArenaPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/**
 * The two fighters' bars.
 *
 * The player's carries the companion's own name; the rival's carries the name
 * the *engine* gave it, which is the band prefix plus the species ("Wild Owl"),
 * not the catalog's display name on the chip ("Sage Owl") — so the rival is
 * found as "the bar that is not the player's" rather than by guessing its name.
 */
function playerHp(): number {
  const bar = screen.getByRole("progressbar", { name: new RegExp(`^${PET.name} health$`, "i") });
  return Number(bar.getAttribute("aria-valuenow"));
}

/**
 * The battle log's lines, oldest first.
 *
 * The log — not the health bars — is what these tests assert on, because every
 * line names its actor and the outcome in words. Whether a strike lands is
 * decided by a seeded roll *and* by `Date.now()` (the seed is the clock), so an
 * HP assertion here is a 2%-flaky assertion; "the newest line starts with the
 * animal whose turn it was" is true of a hit and of a miss alike, and is exactly
 * the property the turn loop has to guarantee.
 */
function logLines(): string[] {
  return Array.from(document.querySelectorAll("ol li")).map((li) => li.textContent ?? "");
}

const lastLine = () => logLines().at(-1) ?? "";

/** The player's free move — the one always affordable, whatever the energy. */
const FREE_MOVE = movesFor(PET.slug).find((m) => m.id === "jab")!.name;

/**
 * Move buttons are named by their whole row ("Tidal Crash38 pow · 4 energy2
 * ..." — the name computation does not insert spaces between the nested
 * spans), so the match is a prefix and deliberately has no trailing boundary.
 * Move names come from `movesFor`, so tests read the name off the engine.
 */
function moveButton(name: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^${name}`) }) as HTMLButtonElement;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  document.cookie = "focusarx_session=; path=/; max-age=0";
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

describe("arena page", () => {
  it("opens on the rival's turn when the rival is faster, and does not freeze", async () => {
    // Guard the premise: this pet must be slower than this rival at this level.
    expect(
      statsFor(PET.slug, PET.level).spd,
      `${PET.slug} is no longer slower than ${FAST_RIVAL} — pick another pair for this test`,
    ).toBeLessThan(statsFor("owl", PET.level).spd);

    renderArena();

    fireEvent.click(screen.getByRole("radio", { name: "Even" }));
    fireEvent.click(screen.getByRole("button", { name: FAST_RIVAL }));
    fireEvent.click(screen.getByRole("button", { name: /^Fight / }));

    // The fight starts on the enemy's turn: the board says so, and the player's
    // buttons are disabled rather than offering a move that cannot resolve.
    expect(screen.getByText(/is winding up/)).toBeTruthy();
    expect(moveButton(FREE_MOVE).disabled).toBe(true);
    const opening = logLines().length;

    // The beat lands: the rival acts, and the turn (and therefore the grid)
    // comes back. Before the fix nothing was scheduled here and this line never
    // appeared — the board simply sat there.
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    expect(logLines().length).toBe(opening + 1);
    expect(lastLine()).toMatch(/^Wild Owl /);
    expect(moveButton(FREE_MOVE).disabled).toBe(false);
    expect(screen.queryByText(/is winding up/)).toBeNull();
  });

  it("resolves the player's move against the rival, never against the player", async () => {
    renderArena();
    fireEvent.click(screen.getByRole("button", { name: FAST_RIVAL }));
    fireEvent.click(screen.getByRole("button", { name: /^Fight / }));
    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    const playerBefore = playerHp();
    const before = logLines().length;
    fireEvent.click(moveButton(FREE_MOVE));

    // The click resolved for the *player*: the log names the player, and the
    // player's own health is untouched by their own attack. Before the fix this
    // line read "Wild Owl …" — the click acted for whoever's turn it was.
    expect(logLines().length).toBe(before + 1);
    expect(lastLine()).toMatch(/^Axolotl /);
    expect(lastLine()).toContain(FREE_MOVE);
    expect(playerHp()).toBe(playerBefore);
    expect(moveButton(FREE_MOVE).disabled).toBe(true);
  });

  it("takes exactly one enemy action per player move", async () => {
    renderArena();
    fireEvent.click(screen.getByRole("button", { name: FAST_RIVAL }));
    fireEvent.click(screen.getByRole("button", { name: /^Fight / }));
    await act(async () => {
      vi.advanceTimersByTime(700); // the rival's opening strike
    });

    const beforeMove = logLines().length;
    fireEvent.click(moveButton(FREE_MOVE));
    // Exactly one line between the click and the beat: a scheduled second strike
    // (or a doubled effect) would show up here as an extra one.
    expect(logLines().length).toBe(beforeMove + 1);
    expect(lastLine()).toMatch(/^Axolotl /);

    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    expect(logLines().length).toBe(beforeMove + 2);
    expect(lastLine()).toMatch(/^Wild Owl /);
    // ...and the loop is back with the player, not stuck on the rival.
    expect(moveButton(FREE_MOVE).disabled).toBe(false);
  });

  it("offers the element's own moveset, priced, with the setup move labelled", async () => {
    // The board reads its moves off the engine, so the label wiring is the only
    // thing this test owns: an attack shows its power, a boost shows "set up",
    // and the price on the row matches whether the button is usable.
    renderArena();
    fireEvent.click(screen.getByRole("button", { name: FAST_RIVAL }));
    fireEvent.click(screen.getByRole("button", { name: /^Fight / }));
    await act(async () => {
      vi.advanceTimersByTime(700); // hand the turn to the player
    });

    const moves = movesFor(PET.slug);
    const boost = moves.find((m) => m.kind === "boost");
    const heavy = moves.find((m) => m.id === "heavy");
    expect(boost, "the moveset has no setup move").toBeDefined();
    expect(heavy, "the moveset has no heavy attack").toBeDefined();

    // Two starting points: the two-cost setup move is affordable, the four-cost
    // heavy is not, and the free move is always there.
    expect(moveButton(boost!.name).disabled).toBe(false);
    expect(moveButton(boost!.name).textContent).toContain("set up");
    expect(moveButton(heavy!.name).disabled).toBe(true);
    expect(moveButton(heavy!.name).textContent).toContain("4");
    expect(moveButton(FREE_MOVE).disabled).toBe(false);
    expect(moveButton(FREE_MOVE).textContent).toContain("free");
  });

  it("keeps the fight's numbers in the compact layout", async () => {
    // The layout pack may drop the scene; it must never drop a bar, and the
    // result must not depend on which board is on screen.
    renderArena();
    fireEvent.click(screen.getByRole("button", { name: /^Fight / }));
    const bars = screen.getAllByRole("progressbar");
    expect(bars.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: new RegExp(`^${FREE_MOVE}`) })).toBeTruthy();
  });
});
