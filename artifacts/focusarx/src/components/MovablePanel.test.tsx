import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MovablePanel } from "./MovablePanel";
import { usePanelOrder } from "@/hooks/usePanelOrder";
import { PANEL_ORDER_KEY, readPanelOrder, type PanelId } from "@/lib/panelLayout";

/**
 * The arrangement UI: two ways to move a panel, one arrangement.
 *
 * The buttons are the contract — a keyboard user, a switch user and a screen
 * reader all get them — and the pointer drag has to produce the same order the
 * buttons would, which is why both paths are asserted against the same storage
 * key rather than against each other's internals.
 */

function Harness({ arranging = true }: { arranging?: boolean }) {
  const { order, move, drop } = usePanelOrder();
  return (
    <div>
      {order.map((id: PanelId, index) => (
        <MovablePanel
          key={id}
          id={id}
          index={index}
          count={order.length}
          arranging={arranging}
          onMove={move}
          onDrop={drop}
        >
          <p>{`${id} body`}</p>
        </MovablePanel>
      ))}
    </div>
  );
}

const panelOrder = () =>
  [...document.querySelectorAll("[data-panel]")].map((el) => ({
    id: (el as HTMLElement).dataset.panel,
    order: (el as HTMLElement).style.order,
  }));

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MovablePanel", () => {
  it("renders no controls until the workspace is in arrange mode", () => {
    const { container } = render(<Harness arranging={false} />);
    expect(container.querySelector('[data-panel="timer"]')).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Move Timer earlier" })).toBeNull();
  });

  it("moves a panel earlier and later with the keyboard buttons, and persists it", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Move Companion earlier" }));
    expect(panelOrder()).toEqual([
      { id: "companion", order: "0" },
      { id: "timer", order: "1" },
      { id: "tasks", order: "2" },
    ]);
    expect(readPanelOrder()).toEqual(["companion", "timer", "tasks"]);

    fireEvent.click(screen.getByRole("button", { name: "Move Companion later" }));
    expect(readPanelOrder()).toEqual(["timer", "companion", "tasks"]);
  });

  it("disables the move that cannot happen and says what moved", () => {
    render(<Harness />);
    expect((screen.getByRole("button", { name: "Move Timer earlier" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Move Tasks and stats later" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Move Tasks and stats earlier" }));
    expect(screen.getByText("Tasks and stats moved to position 2 of 3")).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(PANEL_ORDER_KEY) ?? "[]")).toEqual([
      "timer",
      "tasks",
      "companion",
    ]);
  });

  it("takes the same order from a pointer drag as from the buttons", () => {
    const { container } = render(<Harness />);
    // jsdom has no hit-testing and no pointer capture; both are stubbed so the
    // drag path itself (which panel the pointer is over decides the drop) runs.
    const timer = container.querySelector('[data-panel="timer"]') as Element;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => timer,
    });

    const grip = screen.getByRole("img", { name: "Drag Tasks and stats to move it" });
    fireEvent.pointerDown(grip, { pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(grip, { pointerId: 1 });

    expect(readPanelOrder()).toEqual(["tasks", "timer", "companion"]);
  });
});
