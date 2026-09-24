import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COINS_PER_5MIN_BLOCK,
  FULL_REWARD_MINUTES,
  MARATHON_TAPER,
  MAX_SESSION_MINUTES,
  XP_PER_MINUTE,
  baseSessionRewards,
  computeSessionRewards,
  isMarathonMinutes,
} from "./sessionRewards";

/**
 * The client mirror must not drift from the server that pays out.
 *
 * A duplicated formula is normally a smell; here the alternative is worse. The
 * timer face has to show the user what a session is worth *while it runs*, and
 * the only authoritative implementation lives in the api-server package, which
 * the browser cannot import. So the copy is deliberate, and this test is the
 * thing that keeps it honest: it reads the server source and asserts the
 * constants and the taper still agree. If someone retunes rewards server-side,
 * this fails here instead of silently lying on the timer.
 */

const SERVER_FILE = join(process.cwd(), "..", "api-server", "src", "lib", "sessionRewards.ts");
const server = readFileSync(SERVER_FILE, "utf8");

function serverConstant(name: string): number {
  const match = server.match(new RegExp(`export const ${name} = ([0-9.]+)`));
  if (!match) throw new Error(`${name} not found in ${SERVER_FILE}`);
  return Number(match[1]);
}

describe("session rewards — client mirror of the server", () => {
  it("uses the same constants as the server", () => {
    expect(XP_PER_MINUTE).toBe(serverConstant("XP_PER_MINUTE"));
    expect(COINS_PER_5MIN_BLOCK).toBe(serverConstant("COINS_PER_5MIN_BLOCK"));
    expect(FULL_REWARD_MINUTES).toBe(serverConstant("FULL_REWARD_MINUTES"));
    expect(MARATHON_TAPER).toBe(serverConstant("MARATHON_TAPER"));
    expect(MAX_SESSION_MINUTES).toBe(serverConstant("MAX_SESSION_MINUTES"));
  });

  it("still tapers past the two-hour mark", () => {
    expect(server).toContain("taperRate(XP_PER_MINUTE)");
    const marathon = baseSessionRewards(150);
    expect(marathon.fullMinutes).toBe(120);
    expect(marathon.taperedMinutes).toBe(30);
    // 120 full minutes + 30 tapered minutes at 75%.
    expect(marathon.xp).toBe(120 * 20 + Math.round(30 * 20 * 0.75));
  });

  it("pays nothing for a session under a minute", () => {
    expect(computeSessionRewards({ minutes: 0.4 })).toEqual({ xp: 0, coins: 0, fullMinutes: 0, taperedMinutes: 0 });
  });

  it("matches the numbers the old client formula got wrong", () => {
    // The ring used to print minutes * 20 / blocks * 10 with no taper and no
    // pomodoro bonus. 25 minutes is the shortest block that exposes all three
    // differences: tapered-free, but with the 50-coin completion bonus.
    const twentyFive = computeSessionRewards({ minutes: 25 });
    expect(twentyFive.xp).toBe(500);
    expect(twentyFive.coins).toBe(5 * 10 + 50);

    // A 3-hour marathon: the old formula would have promised 3_600 XP, the
    // server pays 2_700 — the mismatch that made the live counter untrustworthy.
    const marathon = computeSessionRewards({ minutes: 180 });
    expect(marathon.xp).toBe(120 * 20 + Math.round(60 * 15));
    expect(marathon.xp).toBeLessThan(180 * 20);
    expect(isMarathonMinutes(180)).toBe(true);
  });

  it("applies the premium multipliers in the same order as the server", () => {
    const base = computeSessionRewards({ minutes: 50 });
    const premium = computeSessionRewards({ minutes: 50, isPremium: true });
    expect(base.coins).toBe(10 * 10 + 50);
    expect(premium.xp).toBe(Math.round(base.xp * 1.5));
    expect(premium.coins).toBe(Math.round(base.coins * 1.25));
  });
});
