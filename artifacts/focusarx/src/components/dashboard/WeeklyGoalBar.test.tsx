import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { WeeklyGoalBar } from "./WeeklyGoalBar";
import { DEFAULT_WEEKLY_GOAL_MIN, WEEKLY_GOAL_KEY } from "@/lib/weeklyGoal";
import { safeRemove } from "@/lib/safeStorage";

/**
 * The target row's contract.
 *
 * The bar replaces a card that silently swallowed two failures: an
 * out-of-range edit that closed the editor without saving, and a refused
 * localStorage write that looked exactly like a successful one. Both are
 * asserted here, from the DOM a user actually sees.
 */

beforeEach(() => {
  safeRemove(WEEKLY_GOAL_KEY);
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const openEditor = () => fireEvent.click(screen.getByRole("button", { name: /change target|raise the target/i }));
const targetInput = () => screen.getByLabelText("Weekly goal in minutes") as HTMLInputElement;

describe("WeeklyGoalBar", () => {
  it("shows the week against the target and labels the bar", () => {
    render(<WeeklyGoalBar minutes={238} />);
    expect(screen.getByText(`238 of ${DEFAULT_WEEKLY_GOAL_MIN} min protected — 62 to go.`)).toBeTruthy();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-label")).toBe("Weekly goal 79 percent");
  });

  it("celebrates a met target instead of showing an empty countdown", () => {
    render(<WeeklyGoalBar minutes={412} />);
    expect(screen.getByText("Target hit — 412 of 300 min protected, 112 past it.")).toBeTruthy();
    // The affordance changes wording because the target is no longer a ceiling.
    expect(screen.getByRole("button", { name: /raise the target/i })).toBeTruthy();
  });

  it("persists a new target and updates the sentence", () => {
    render(<WeeklyGoalBar minutes={100} />);
    openEditor();
    fireEvent.change(targetInput(), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Save target" }));

    expect(screen.getByText("100 of 120 min protected — 20 to go.")).toBeTruthy();
    expect(window.localStorage.getItem(WEEKLY_GOAL_KEY)).toBe("120");
    expect(screen.queryByLabelText("Weekly goal in minutes")).toBeNull();
  });

  it("rejects an out-of-range target with a reason and keeps the old one", () => {
    render(<WeeklyGoalBar minutes={100} />);
    openEditor();
    fireEvent.change(targetInput(), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save target" }));

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/between 30 and 6,000/i);
    // The editor stays open with the bad value, so the user can fix it.
    expect((targetInput() as HTMLInputElement).value).toBe("5");
    expect(window.localStorage.getItem(WEEKLY_GOAL_KEY)).toBeNull();
    expect(screen.queryByText(/of 5 min protected/)).toBeNull();
  });

  it("says so when the browser will not store the target", () => {
    // A successful-looking save that evaporates on reload is the failure this
    // row exists to stop hiding.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    render(<WeeklyGoalBar minutes={100} />);
    openEditor();
    fireEvent.change(targetInput(), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Save target" }));

    expect(screen.getByRole("alert").textContent).toMatch(/this visit only/i);
    // The target still applies for this visit, so the sentence reflects it.
    expect(screen.getByText("100 of 120 min protected — 20 to go.")).toBeTruthy();
  });

  it("closes the editor on Escape without changing anything", () => {
    render(<WeeklyGoalBar minutes={100} />);
    openEditor();
    fireEvent.change(targetInput(), { target: { value: "900" } });
    fireEvent.keyDown(targetInput(), { key: "Escape" });

    expect(screen.queryByLabelText("Weekly goal in minutes")).toBeNull();
    expect(screen.getByText("100 of 300 min protected — 200 to go.")).toBeTruthy();
  });
});
