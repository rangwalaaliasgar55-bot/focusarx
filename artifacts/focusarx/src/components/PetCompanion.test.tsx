import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

vi.mock("@/hooks/useActivePet", () => ({
  useActivePet: () => ({
    data: {
      slug: "pikachu",
      name: "Sparky",
      level: 7,
      category: "event",
      thumbnailUrl: "https://sprites.example/pikachu.gif",
    },
  }),
}));
vi.mock("@/lib/auth", () => ({ getToken: () => null }));

import PetCompanion from "./PetCompanion";

describe("PetCompanion", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows an active released pet's animated artwork instead of its fallback glyph", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ inventory: [] }), { status: 200 })));
    const { container } = render(<PetCompanion isRunning={false} elapsedSeconds={0} mode="focus" />);
    // Inventory effects settle after mount; flush that update within act so
    // this regression test itself does not hide an asynchronous UI warning.
    await act(async () => { await Promise.resolve(); });
    const sprite = container.querySelector('img[src="https://sprites.example/pikachu.gif"]');
    expect(sprite).toBeTruthy();
    expect(sprite?.getAttribute("alt")).toBe("");
    expect(sprite?.getAttribute("aria-hidden")).toBe("true");
  });
});
