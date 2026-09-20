import { describe, expect, it } from "vitest";
import { parseVoiceCapture } from "./voiceCapture";

describe("parseVoiceCapture", () => {
  it("structures several tasks and a goal without writing data", () => {
    const result = parseVoiceCapture(
      "Add task revise physics for 45 minutes tomorrow high priority, then create a goal to finish the semester strong by Friday, also remind me to email the client under work urgent",
      "2026-09-20",
    );
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ kind: "task", title: "revise physics", estimatedMinutes: 45, dueDate: "2026-09-21", priority: "high", category: "Study" });
    expect(result[1]).toMatchObject({ kind: "goal", title: "finish the semester strong", description: "Target date: 2026-09-25" });
    expect(result[2]).toMatchObject({ kind: "task", title: "email the client", priority: "urgent", category: "Work" });
  });

  it("handles recurrence, hours, weekdays, and day after tomorrow", () => {
    expect(parseVoiceCapture("task practice maths 1.5 hours every Monday", "2026-09-20")[0]).toMatchObject({
      title: "practice maths", estimatedMinutes: 90, recurring: "every monday", category: "Study",
    });
    expect(parseVoiceCapture("Call mum day after tomorrow", "2026-09-20")[0]?.dueDate).toBe("2026-09-22");
    expect(parseVoiceCapture("Read for half an hour in 3 days", "2026-09-20")[0]).toMatchObject({ estimatedMinutes: 30, dueDate: "2026-09-23" });
    expect(parseVoiceCapture("File forms September 25th", "2026-09-20")[0]?.dueDate).toBe("2026-09-25");
  });

  it("retains a spoken time and warns because tasks store date precision", () => {
    const item = parseVoiceCapture("remind me to submit the form tomorrow at 5 pm", "2026-09-20")[0]!;
    expect(item.title).toContain("5 pm");
    expect(item.warnings[0]).toContain("spoken time remains");
  });

  it("limits a capture to twelve safe drafts", () => {
    const result = parseVoiceCapture(Array.from({ length: 20 }, (_, i) => `task item ${i}`).join(";"), "2026-09-20");
    expect(result).toHaveLength(12);
  });
});
