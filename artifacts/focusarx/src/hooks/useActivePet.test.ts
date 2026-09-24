import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getToken: () => null }));

import { fetchActivePet } from "./useActivePet";

describe("fetchActivePet", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps a released pet's animated catalog artwork for companion surfaces", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      inventory: [{
        inventory: { isActive: true, level: 7, nickname: "Sparky" },
        catalog: {
          slug: "pikachu",
          name: "Pikachu",
          category: "event",
          thumbnailUrl: "https://sprites.example/pikachu.gif",
          fallbackImageUrl: "https://sprites.example/pikachu-still.png",
        },
      }],
    }), { status: 200 })));

    await expect(fetchActivePet()).resolves.toMatchObject({
      slug: "pikachu",
      name: "Sparky",
      level: 7,
      thumbnailUrl: "https://sprites.example/pikachu.gif",
    });
  });

  it("uses fallback artwork when a catalog row has no primary thumbnail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      inventory: [{
        inventory: { isActive: true, level: 1, nickname: null },
        catalog: {
          slug: "animated-pet",
          name: "Animated Pet",
          category: "event",
          thumbnailUrl: null,
          fallbackImageUrl: "https://sprites.example/animated-pet.gif",
        },
      }],
    }), { status: 200 })));

    await expect(fetchActivePet()).resolves.toMatchObject({
      thumbnailUrl: "https://sprites.example/animated-pet.gif",
    });
  });
});
