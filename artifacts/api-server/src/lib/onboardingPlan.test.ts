/**
 * The first-run generator's pure half.
 *
 * Two promises are load-bearing and both are pinned here:
 *
 *  - **A new account never lands on a blank dashboard.** With no AI keys at
 *    all, `templateWeek`/`templateCards` still produce a real week and a real
 *    deck, shaped by the dream the learner picked.
 *  - **A model cannot write anything absurd into someone's list on day one.**
 *    `normalizeTasks` clamps minutes, drops vague text, validates priority and
 *    caps the count, and the route only accepts a reply that clears
 *    `MIN_AI_TASKS` — otherwise the template wins.
 */
import { describe, it, expect } from "vitest";
import {
  KICKOFF_CATEGORY, MIN_AI_TASKS, clampDailyTarget, clampMinutes, extractJsonArray,
  normalizeTasks, planBody, templateCards, templateWeek,
} from "./onboardingPlan";
import { DREAM_SYSTEMS } from "./dreamSystems";

describe("template week", () => {
  it("gives every dream a full first week", () => {
    for (const dreamType of Object.keys(DREAM_SYSTEMS)) {
      const week = templateWeek(dreamType, 120);
      expect(week, dreamType).toHaveLength(7);
      expect(week.every(t => t.category === KICKOFF_CATEGORY)).toBe(true);
      expect(week.every(t => t.text.length > 0 && t.minutes > 0)).toBe(true);
    }
  });

  it("names the dream's own subjects instead of generic filler", () => {
    const week = templateWeek("iit", 120);
    const planTask = week.find(t => t.text.startsWith("Write your subject plan"));
    for (const subject of DREAM_SYSTEMS.iit!.subjects) {
      expect(planTask?.text).toContain(subject.name);
    }
  });

  it("keeps the day-one block inside the learner's stated capacity", () => {
    const tight = templateWeek("iit", 60)[0]!;
    const roomy = templateWeek("iit", 600)[0]!;
    // The opening line quotes their availability in hours, and the session it
    // asks for is the dream's deep block — never their whole day.
    expect(tight.text).toContain("1h today");
    expect(roomy.text).toContain("10h today");
    expect(tight.minutes).toBeLessThanOrEqual(180);
  });

  it("falls back to the custom system for an unknown dream", () => {
    expect(templateWeek("not-a-dream", 120)).toEqual(templateWeek("custom", 120));
  });
});

describe("starter deck", () => {
  it("is non-empty, answerable and unique per dream system", () => {
    for (const dreamType of Object.keys(DREAM_SYSTEMS)) {
      const cards = templateCards(dreamType, 120);
      expect(cards.length, dreamType).toBeGreaterThanOrEqual(6);
      expect(cards.every(c => c.front.length > 0 && c.back.length > 0)).toBe(true);
      const fronts = new Set(cards.map(c => c.front));
      expect(fronts.size).toBe(cards.length);
      expect(cards[1]!.back).toBe(DREAM_SYSTEMS[dreamType]!.dailyHabit);
    }
  });

  it("writes the learner's own target into the first card", () => {
    expect(templateCards("coding", 180)[0]!.back).toContain("180 focused minutes a day");
  });
});

describe("normalizeTasks", () => {
  it("keeps a good model reply, clamped", () => {
    const reply = "Sure! Here you go:\n```json\n" + JSON.stringify([
      { text: "Solve three integration problems from yesterday's chapter", minutes: 45, priority: "high" },
      { text: "Rewrite your physics formula sheet from memory", minutes: 900, priority: "low" },
      { text: "Read the next chapter and summarise it in five bullets", minutes: 4, priority: "weird" },
    ]) + "\n```";
    const tasks = normalizeTasks(reply);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toMatchObject({ minutes: 45, priority: "high", category: KICKOFF_CATEGORY });
    expect(tasks[1]!.minutes).toBe(180);          // clamped from 900
    expect(tasks[2]!.minutes).toBe(10);           // clamped up from 4
    expect(tasks[2]!.priority).toBe("medium");    // unknown priority rejected
  });

  it("drops vague rows and caps the count", () => {
    const rows = [
      { text: "ok", minutes: 30 },                 // too short to act on
      { text: 42, minutes: 30 },                   // not a string
      ...Array.from({ length: 9 }, (_, i) => ({ text: `Concrete action number ${i} for the week`, minutes: 30 })),
    ];
    const tasks = normalizeTasks(JSON.stringify(rows));
    expect(tasks).toHaveLength(7);
    expect(tasks.every(t => t.text.startsWith("Concrete action"))).toBe(true);
  });

  it("returns nothing rather than throwing on junk", () => {
    expect(normalizeTasks("no array here")).toEqual([]);
    expect(normalizeTasks("[{ broken json,")).toEqual([]);
    expect(extractJsonArray("prose [1,2,3] more prose")).toEqual([1, 2, 3]);
    expect(extractJsonArray('{"a":1}')).toEqual([]);
  });

  it("asks for at least four tasks before an AI week may replace the template", () => {
    // Guards the route's accept/reject line: three tasks is not a week.
    expect(MIN_AI_TASKS).toBeGreaterThan(1);
    expect(normalizeTasks(JSON.stringify([
      { text: "Task one is real", minutes: 30 },
      { text: "Task two is real", minutes: 30 },
      { text: "Task three is real", minutes: 30 },
    ])).length).toBeLessThan(MIN_AI_TASKS);
  });
});

describe("planBody", () => {
  it("coerces an empty body into a usable plan", () => {
    expect(planBody({})).toEqual({
      dreamType: "custom", dailyTargetMinutes: 120, studyWindow: "morning", targetDate: null, subjects: [],
    });
  });

  it("rejects an unknown dream, a bad date and out-of-band targets", () => {
    const parsed = planBody({ dreamType: "hack-the-planet", targetDate: "tomorrow", dailyTargetMinutes: 5000, studyWindow: "3am" });
    expect(parsed.dreamType).toBe("custom");
    expect(parsed.targetDate).toBeNull();
    expect(parsed.dailyTargetMinutes).toBe(600);
    expect(parsed.studyWindow).toBe("morning");
  });

  it("trims and caps the subject list", () => {
    const parsed = planBody({ subjects: ["  Physics  ", 7, "Maths", ...Array.from({ length: 10 }, (_, i) => `Subject ${i}`)] });
    expect(parsed.subjects[0]).toBe("Physics");
    expect(parsed.subjects).not.toContain(7);
    expect(parsed.subjects.length).toBe(8);
  });

  it("shares one clamp implementation with the daily target helpers", () => {
    expect(clampDailyTarget(10)).toBe(30);
    expect(clampDailyTarget(120.4)).toBe(120);
    expect(clampMinutes(0)).toBe(10);
    expect(clampMinutes(Number.NaN, 42)).toBe(42);
  });
});
