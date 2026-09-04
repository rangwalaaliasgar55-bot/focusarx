import { describe, it, expect } from "vitest";
import { parseFocusDeepLink } from "./focusDeepLink";

describe("parseFocusDeepLink (funnel regression)", () => {
  it("parses the Instagram entry link", () => {
    expect(parseFocusDeepLink("?duration=25&task=Revise+thermo&src=ig")).toEqual({
      durationSeconds: 1500,
      task: "Revise thermo",
      src: "ig",
      armed: true,
    });
  });

  it("clamps garbage to nulls instead of NaN/throwing", () => {
    expect(parseFocusDeepLink("?duration=abc")).toEqual({
      durationSeconds: null,
      task: null,
      src: null,
      armed: false,
    });
    expect(parseFocusDeepLink("?duration=0")).toMatchObject({ durationSeconds: null });
    expect(parseFocusDeepLink("?duration=9999")).toMatchObject({ durationSeconds: null });
    expect(parseFocusDeepLink("?duration=-5")).toMatchObject({ durationSeconds: null });
    expect(parseFocusDeepLink("")).toMatchObject({ armed: false });
  });

  it("trims and caps the task, sanitizes src", () => {
    const link = parseFocusDeepLink(`?task=${"a".repeat(500)}&src=IG!!`);
    expect(link.task!.length).toBe(120);
    expect(link.src).toBe("ig");
    expect(link.armed).toBe(true);
  });
});
