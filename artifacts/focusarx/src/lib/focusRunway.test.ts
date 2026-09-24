import { describe, expect, it } from "vitest";
import {
  buildFocusRunway,
  formatRunwayTime,
  nextRunwayBlock,
  roundUpToFive,
  runwayStatus,
  sortRunwayTasks,
} from "./focusRunway";

describe("Focus Runway planner", () => {
  it("puts due-today and urgent work ahead of routine work", () => {
    const tasks = sortRunwayTasks([
      { id: "routine", title: "Read notes", priority: "low" },
      { id: "today", title: "Submit draft", priority: "medium", dueDate: "2026-09-24" },
      { id: "urgent", title: "Call advisor", priority: "urgent" },
    ], "2026-09-24");
    expect(tasks.map((task) => task.id)).toEqual(["today", "urgent", "routine"]);
  });

  it("adds a reset after a deep stretch rather than silently overbooking", () => {
    const plan = buildFocusRunway([
      { id: "one", title: "Chapter one", priority: "high", estimatedPomodoros: 2 },
      { id: "two", title: "Chapter two", priority: "medium", estimatedPomodoros: 2 },
    ], { day: "2026-09-24", startAtMinute: 9 * 60 });
    expect(plan.blocks.map((block) => block.kind)).toEqual(["focus", "reset", "focus"]);
    expect(plan.blocks[1]).toMatchObject({ title: "Step away and reset", minutes: 10, startsAtMinute: 590 });
  });

  it("limits a day honestly and retains overflow for a later plan", () => {
    const plan = buildFocusRunway(Array.from({ length: 9 }, (_, index) => ({ id: String(index), title: `Task ${index}`, estimatedPomodoros: 4 })), {
      day: "2026-09-24",
      startAtMinute: 9 * 60,
    });
    expect(plan.unscheduledTaskIds.length).toBeGreaterThan(0);
    expect(plan.blocks.every((block) => block.endsAtMinute <= 19 * 60)).toBe(true);
  });

  it("keeps status derived from live time and task completion", () => {
    const plan = buildFocusRunway([{ id: "one", title: "One", estimatedPomodoros: 1 }], { day: "2026-09-24", startAtMinute: 600 });
    const block = plan.blocks[0];
    expect(runwayStatus(block, 610, new Set())).toBe("running");
    expect(runwayStatus(block, 630, new Set())).toBe("missed");
    expect(runwayStatus(block, 610, new Set(["one"]))).toBe("done");
    expect(nextRunwayBlock(plan.blocks, 590, new Set())?.id).toBe(block.id);
  });

  it("formats time and uses five-minute starts", () => {
    expect(roundUpToFive(542)).toBe(545);
    expect(formatRunwayTime(13 * 60 + 5)).toBe("1:05 PM");
  });
});
