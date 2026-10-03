import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_PANEL_ORDER,
  PANEL_IDS,
  PANEL_ORDER_KEY,
  movePanel,
  normalizePanelOrder,
  orderIndex,
  readPanelOrder,
  reorderPanel,
  writePanelOrder,
} from "./panelLayout";

/**
 * The arrangement rules, without a browser.
 *
 * These matter more than they look: the stored order is user data that survives
 * releases, so a panel renamed, removed or added has to degrade into a usable
 * workspace rather than a blank one, and the drag and keyboard paths have to
 * agree about what "move this here" means.
 */

beforeEach(() => {
  window.localStorage.clear();
});

describe("panel order", () => {
  it("ships the default order and calls the panels by name", () => {
    expect(DEFAULT_PANEL_ORDER).toEqual(["timer", "companion", "tasks"]);
    expect(PANEL_IDS).toHaveLength(3);
  });

  it("drops ids it does not know, de-dupes, and appends what is missing", () => {
    expect(normalizePanelOrder(["tasks", "tasks", "warp-drive", "timer"])).toEqual([
      "tasks",
      "timer",
      "companion",
    ]);
    expect(normalizePanelOrder(null)).toEqual([...DEFAULT_PANEL_ORDER]);
    expect(normalizePanelOrder(["companion"])).toEqual(["companion", "timer", "tasks"]);
  });

  it("moves a panel by one place and clamps at both ends", () => {
    expect(movePanel(DEFAULT_PANEL_ORDER, "companion", -1)).toEqual(["companion", "timer", "tasks"]);
    expect(movePanel(DEFAULT_PANEL_ORDER, "companion", 1)).toEqual(["timer", "tasks", "companion"]);
    // Already first, asked to go earlier: unchanged, and not reordered by accident.
    expect(movePanel(DEFAULT_PANEL_ORDER, "timer", -1)).toEqual([...DEFAULT_PANEL_ORDER]);
    expect(movePanel(DEFAULT_PANEL_ORDER, "tasks", 5)).toEqual([...DEFAULT_PANEL_ORDER]);
  });

  it("drops a dragged panel where its target sits, not next to it", () => {
    // Dragging the timer onto the companion — the timer takes its place.
    expect(reorderPanel(DEFAULT_PANEL_ORDER, "timer", "companion")).toEqual(["companion", "timer", "tasks"]);
    // And the other way: the companion takes the first slot.
    expect(reorderPanel(DEFAULT_PANEL_ORDER, "companion", "timer")).toEqual(["companion", "timer", "tasks"]);
    // Dragging the rail to the top puts it above both.
    expect(reorderPanel(DEFAULT_PANEL_ORDER, "tasks", "timer")).toEqual(["tasks", "timer", "companion"]);
    expect(reorderPanel(DEFAULT_PANEL_ORDER, "tasks", "tasks")).toEqual([...DEFAULT_PANEL_ORDER]);
  });

  it("round-trips through storage, and repairs a poisoned value", () => {
    expect(readPanelOrder()).toEqual([...DEFAULT_PANEL_ORDER]);

    writePanelOrder(["tasks", "timer", "companion"]);
    expect(readPanelOrder()).toEqual(["tasks", "timer", "companion"]);

    // A hand-edited or older value must never reach a render unrepaired.
    window.localStorage.setItem(PANEL_ORDER_KEY, JSON.stringify(["timer", "timer", 42]));
    expect(readPanelOrder()).toEqual(["timer", "companion", "tasks"]);

    window.localStorage.setItem(PANEL_ORDER_KEY, "not json");
    expect(readPanelOrder()).toEqual([...DEFAULT_PANEL_ORDER]);
  });

  it("answers the CSS order for a panel, defaulting to the front", () => {
    expect(orderIndex(["tasks", "timer", "companion"], "timer")).toBe(1);
    expect(orderIndex(DEFAULT_PANEL_ORDER, "companion")).toBe(1);
    // Unknown in a raw list still normalises rather than returning -1.
    expect(orderIndex(["nope" as never], "tasks")).toBe(2);
  });
});
