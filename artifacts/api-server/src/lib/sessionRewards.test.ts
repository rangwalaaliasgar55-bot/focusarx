/**
 * Session reward math — marathon taper (Workstream H).
 */
import { describe, it, expect } from "vitest";
import {
  baseSessionRewards,
  computeSessionRewards,
  isMarathonMinutes,
  FULL_REWARD_MINUTES,
  MAX_CUSTOM_MINUTES,
} from "./sessionRewards";

describe("baseSessionRewards", () => {
  it("pays 20 XP/min inside the first 2 hours", () => {
    expect(baseSessionRewards(25).xp).toBe(500);
    expect(baseSessionRewards(60).xp).toBe(1200);
    expect(baseSessionRewards(FULL_REWARD_MINUTES).xp).toBe(2400);
  });

  it("tapers to 75% beyond 120 minutes", () => {
    const r = baseSessionRewards(240);
    // 120 * 20 + 120 * 15
    expect(r.xp).toBe(2400 + 1800);
    expect(r.fullMinutes).toBe(120);
    expect(r.taperedMinutes).toBe(120);
  });

  it("never pays more than the pre-taper formula (sub-linear)", () => {
    // Without taper: 240 * 20 = 4800. With taper: 4200.
    expect(baseSessionRewards(240).xp).toBeLessThan(240 * 20);
    // And the taper only kicks in beyond 120.
    expect(baseSessionRewards(120).taperedMinutes).toBe(0);
    expect(baseSessionRewards(121).taperedMinutes).toBe(1);
    expect(baseSessionRewards(121).xp).toBe(120 * 20 + 15);
  });

  it("floors partial minutes", () => {
    expect(baseSessionRewards(0.9).xp).toBe(0);
    expect(baseSessionRewards(1.9).xp).toBe(20);
  });

  it("coins: 10 per 5-min block, tapered blocks pay 7 beyond 2h", () => {
    expect(baseSessionRewards(25).coins).toBe(50);
    expect(baseSessionRewards(120).coins).toBe(240);
    // 120 min full → 24 blocks × 10 = 240; 120 tapered → 24 × 7 = 168
    expect(baseSessionRewards(240).coins).toBe(240 + 168);
  });
});

describe("computeSessionRewards", () => {
  it("adds the 25-min pomodoro bonus", () => {
    // 50 XP + 50 coins + 50 bonus
    expect(computeSessionRewards({ minutes: 25 }).coins).toBe(100);
    expect(computeSessionRewards({ minutes: 24 }).coins).toBe(40);
  });

  it("adds the showed-up bonus on early completion", () => {
    const full = computeSessionRewards({ minutes: 30 });
    const early = computeSessionRewards({ minutes: 30, completedEarly: true });
    expect(early.coins).toBe(full.coins + 10);
  });

  it("applies premium multipliers (1.5x XP, 1.25x coins) after bonuses", () => {
    const base = computeSessionRewards({ minutes: 30 });
    const prem = computeSessionRewards({ minutes: 30, isPremium: true });
    expect(prem.xp).toBe(Math.round(base.xp * 1.5));
    expect(prem.coins).toBe(Math.round(base.coins * 1.25));
  });

  it("returns zero for sub-minute sessions", () => {
    expect(computeSessionRewards({ minutes: 0.4 })).toEqual({ xp: 0, coins: 0, fullMinutes: 0, taperedMinutes: 0 });
  });

  it("a full marathon (240) pays exactly 4200 XP / 458 coins pre-premium", () => {
    const r = computeSessionRewards({ minutes: 240 });
    expect(r.xp).toBe(4200);
    // 24×10 + 24×7 = 408 + 50 pomodoro bonus
    expect(r.coins).toBe(408 + 50);
  });
});

describe("marathon helpers", () => {
  it("flags sessions beyond 120 minutes as marathons", () => {
    expect(isMarathonMinutes(120)).toBe(false);
    expect(isMarathonMinutes(121)).toBe(true);
    expect(isMarathonMinutes(240)).toBe(true);
  });

  it("custom duration cap is 240 minutes (raised from 180)", () => {
    expect(MAX_CUSTOM_MINUTES).toBe(240);
  });
});
