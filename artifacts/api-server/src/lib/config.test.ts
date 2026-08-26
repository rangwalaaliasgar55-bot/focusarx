import { describe, expect, it } from "vitest";
import { getServerConfig } from "./config";

describe("getServerConfig", () => {
  it("returns a stable JWT secret between calls in development", () => {
    const first = getServerConfig().jwtSecret;
    const second = getServerConfig().jwtSecret;

    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });
});
