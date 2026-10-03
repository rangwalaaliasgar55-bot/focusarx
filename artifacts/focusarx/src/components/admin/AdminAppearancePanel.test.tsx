/**
 * The console's half of the design packs.
 *
 * Two things are asserted here, and both are the *admin's* acceptance criteria
 * rather than the user's:
 *
 *   1. **Assign a design to an account.** The pin is the load-bearing part — an
 *      admin write must carry `locked`, or "set this for them" quietly becomes
 *      "suggest it to them", and the next thing the user touches wins.
 *   2. **See the battles.** The console's battle list is where "which board is
 *      actually played, and which cup" is answered, so the rows have to carry
 *      both the design and the ladder cup, not just that a fight happened.
 *
 * `adminFetch` is mocked at the seam the panel already uses; everything else —
 * the table, the dirty tracking, the toast — is the real component.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/Toast";

const adminFetchMock = vi.fn();

vi.mock("./AdminHelpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./AdminHelpers")>();
  return { ...actual, adminFetch: (...args: unknown[]) => adminFetchMock(...args) };
});

const { AdminAppearancePanel } = await import("./AdminAppearancePanel");

const USER = {
  userId: "u-1",
  name: "Ada",
  email: "ada@example.com",
  assigned: true,
  locked: false,
  source: "user",
  updatedBy: null,
  updatedAt: null,
  appearance: { timerFace: "analog", petDesign: "wild3d", battleDesign: "retro", layout: "studio" },
  labels: { timerFace: "Analog clock", petDesign: "Wild 3D", battleDesign: "Retro", layout: "Studio" },
};

const BATTLE = {
  id: "b-1",
  userId: "u-1",
  userName: "Ada",
  petSlug: "axolotl",
  petName: "Axolotl",
  petLevel: 5,
  rivalSlug: "owl",
  rivalName: "Wild Owl",
  rivalLevel: 5,
  difficulty: "normal",
  design: "retro",
  stage: 3,
  result: "win",
  rounds: 7,
  damageDealt: 41,
  damageTaken: 12,
  createdAt: "2026-10-03T00:00:00.000Z",
};

function listResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      users: [USER],
      total: 1,
      page: 1,
      limit: 50,
      distribution: { timerFace: { analog: 1 }, petDesign: {}, battleDesign: { retro: 1 }, layout: { studio: 1 } },
      battleUsage: [{ design: "retro", battles: 1, wins: 1 }],
    }),
  } as unknown as Response;
}

function battlesResponse() {
  return { ok: true, status: 200, json: async () => ({ battles: [BATTLE] }) } as unknown as Response;
}

function renderPanel() {
  return render(
    <ToastProvider>
      <AdminAppearancePanel authHeaders={() => ({})} />
    </ToastProvider>,
  );
}

afterEach(() => {
  cleanup();
  adminFetchMock.mockReset();
});

describe("the design-packs console", () => {
  it("lists each account's assignment and the fights it played, cup included", async () => {
    adminFetchMock.mockImplementation(async (url: string) =>
      String(url).includes("/battles") ? battlesResponse() : listResponse(),
    );

    renderPanel();

    // The account and the design it renders, in the admin's own words.
    expect(await screen.findByText("ada@example.com")).toBeTruthy();
    expect(screen.getByLabelText("Timer face for Ada")).toHaveProperty("value", "analog");
    expect(screen.getByLabelText("Layout for Ada")).toHaveProperty("value", "studio");
    expect(screen.getByLabelText("Companion art for Ada")).toHaveProperty("value", "wild3d");

    // The battle log, named by cup: "which cup is anyone past" is unanswerable
    // from the assignment table alone. Read the whole row, because the rival and
    // the result live in sibling spans.
    const row = (await screen.findByText(/Axolotl/)).closest("li");
    expect(row, "the battle row is not a list item").toBeTruthy();
    expect(row!.textContent).toContain("Wild Owl");
    expect(row!.textContent).toContain("Cup 3 · Tidewall Cup");
    expect(row!.textContent).toContain("win · 7r · Retro");
  });

  it("pins a design for an account, sending the lock with the assignment", async () => {
    adminFetchMock.mockImplementation(async (url: string) =>
      String(url).includes("/battles") ? battlesResponse() : listResponse(),
    );
    renderPanel();
    await screen.findByText("ada@example.com");

    // Change two fields, then enable the pin and save: the request must carry
    // all four ids *and* `locked: true`, or the account can overwrite the
    // assignment the admin just made.
    fireEvent.change(screen.getByLabelText("Battle board for Ada"), { target: { value: "arena" } });
    fireEvent.change(screen.getByLabelText("Layout for Ada"), { target: { value: "compact" } });
    fireEvent.click(screen.getByRole("button", { name: /^Pin$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

    await waitFor(() => expect(adminFetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/appearance/u-1"),
      expect.objectContaining({ method: "PUT" }),
    ));
    const [, init] = adminFetchMock.mock.calls.find(([url]) => String(url).includes("/api/admin/appearance/u-1"))!;
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      timerFace: "analog",
      petDesign: "wild3d",
      battleDesign: "arena",
      layout: "compact",
      locked: true,
    });
  });
});
