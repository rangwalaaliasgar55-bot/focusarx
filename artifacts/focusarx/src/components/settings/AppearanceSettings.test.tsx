import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { AppearanceSettings } from "./AppearanceSettings";
import { DEFAULT_ACCENT } from "@/lib/accent";

const LS_ACCENT = "focusarx-accent";

describe("AppearanceSettings color customization", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.removeAttribute("style");
  });

  it("renders theme cards and accent presets", () => {
    render(<AppearanceSettings />);
    expect(screen.getByText("Theme & color")).toBeDefined();
    for (const label of ["Midnight", "Daylight", "Midnight Gold", "Aurora", "Crimson"]) {
      expect(screen.getByText(label)).toBeDefined();
    }
    expect(screen.getByLabelText("Emerald accent color")).toBeDefined();
    expect(screen.getByLabelText("Pick a custom accent color")).toBeDefined();
  });

  it("applies a preset accent to the document tokens and persists it", () => {
    render(<AppearanceSettings />);

    fireEvent.click(screen.getByLabelText("Emerald accent color"));

    const style = document.documentElement.style;
    expect(style.getPropertyValue("--brand-500")).toBe("#10B981");
    expect(style.getPropertyValue("--brand-violet")).toBe("#10B981");
    expect(style.getPropertyValue("--ring")).toContain("16, 185, 129");
    expect(style.getPropertyValue("--rgba-124-58-237-0_18")).toContain("0.18");
    expect(localStorage.getItem(LS_ACCENT)).toBe("emerald");
  });

  it("applies a custom color from the color input", () => {
    render(<AppearanceSettings />);

    fireEvent.change(screen.getByLabelText("Pick a custom accent color"), {
      target: { value: "#ff6600" },
    });

    expect(document.documentElement.style.getPropertyValue("--brand-500")).toBe("#FF6600");
    expect(localStorage.getItem(LS_ACCENT)).toBe("custom:#FF6600");
  });

  it("reset clears overrides and returns to the default palette", () => {
    render(<AppearanceSettings />);

    fireEvent.click(screen.getByLabelText("Rose accent color"));
    expect(document.documentElement.style.getPropertyValue("--brand-500")).toBe("#F43F5E");

    fireEvent.click(screen.getByText("Reset to default"));
    expect(document.documentElement.style.getPropertyValue("--brand-500")).toBe("");
    expect(localStorage.getItem(LS_ACCENT)).toBeNull();
  });

  it("restores the stored accent on next render", () => {
    localStorage.setItem(LS_ACCENT, "teal");
    render(<AppearanceSettings />);

    // applyTheme (via useTheme on mount) re-asserts the stored accent.
    expect(document.documentElement.style.getPropertyValue("--brand-500")).toBe("#14B8A6");
    expect(DEFAULT_ACCENT).toBe("#8B5CF6");
  });
});
