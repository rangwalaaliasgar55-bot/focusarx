import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";
import { PromptProvider } from "@/components/ui/PromptDialog";
import { DEFAULT_APPEARANCE, type LayoutId } from "@/lib/designPacks";
import { __resetAppearanceStateForTests, setAppearanceState } from "@/lib/appearance";

/**
 * The workspace layout pack, on the page the layout is about.
 *
 * `quiet` / `studio` / `compact` are not three colour schemes — each one is a
 * claim about what the workspace arranges. Before this, only the arena honoured
 * the choice, so an account pinned to `studio` by an admin (or `compact` for a
 * small screen) got the house arrangement and a settings screen that said
 * otherwise. These tests mount the real page, because that is where the claim
 * lives; the store is the only thing faked.
 *
 * The regions are addressed by `data-region` rather than by class name: the
 * arrangement is a DOM fact, and a restyle must not be able to break a test
 * about it.
 */

vi.mock("@/lib/webglCapability", () => ({ is3DCapable: () => false }));

function assign(layout: LayoutId) {
  setAppearanceState({ fields: { ...DEFAULT_APPEARANCE, layout }, source: "user", synced: true });
}

async function mountFocusPage() {
  const mod = await import("@/pages/focus");
  const Page = mod.default;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const { hook } = memoryLocation({ path: "/focus" });
  let view: ReturnType<typeof render> | null = null;
  await act(async () => {
    view = render(
      <QueryClientProvider client={client}>
        <Router hook={hook}>
          <AuthProvider>
            <ToastProvider>
              <PromptProvider>
                <Suspense fallback={null}>
                  <Page />
                </Suspense>
              </PromptProvider>
            </ToastProvider>
          </AuthProvider>
        </Router>
      </QueryClientProvider>,
    );
  });
  return view!;
}

beforeEach(() => {
  __resetAppearanceStateForTests();
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  __resetAppearanceStateForTests();
});

describe("workspace layout pack", () => {
  it("is the house arrangement on the default pack", { timeout: 60_000 }, async () => {
    const { container } = await mountFocusPage();
    expect(container.querySelector('[data-layout="quiet"]')).toBeTruthy();
    // Timer and companion, plus the tasks rail.
    expect(container.querySelector('[data-region="timer"]')).toBeTruthy();
    expect(container.querySelector('[data-region="companion"]')).toBeTruthy();
    expect(container.querySelector('[data-region="rail"]')).toBeTruthy();
    // Still one column: the companion sits under the timer.
    expect(container.querySelector('[data-region="workspace"]')!.className).not.toContain("lg:flex-row");
    expect(container.querySelector('[data-region="motivation"]')).toBeTruthy();
  });

  it("puts the companion beside the timer on the studio pack", { timeout: 60_000 }, async () => {
    assign("studio");
    const { container } = await mountFocusPage();
    expect(container.querySelector('[data-layout="studio"]')).toBeTruthy();
    const workspace = container.querySelector('[data-region="workspace"]')!;
    expect(workspace.className).toContain("lg:flex-row");
    // The companion is its own column, and the timer keeps one of its own.
    const companion = container.querySelector('[data-region="companion"]')!;
    expect(companion.parentElement).toBe(workspace);
    expect(companion.className).toContain("lg:w-[380px]");
    expect(container.querySelector('[data-region="timer"]')!.className).toContain("lg:flex-1");
    // The rail is not what studio is about: tasks stay where they were.
    expect(container.querySelector('[data-region="rail"]')).toBeTruthy();
  });

  it("puts the workspace panels where the user arranged them", { timeout: 60_000 }, async () => {
    const { container } = await mountFocusPage();
    // Nothing to grab until the user asks for the arrangement controls — a
    // handle that is always on the timer is a handle in the way of Start.
    expect(screen.queryByRole("button", { name: "Move Companion earlier" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Arrange" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Companion earlier" }));

    const panelled = [...container.querySelectorAll("[data-panel]")] as HTMLElement[];
    const placement = Object.fromEntries(panelled.map((el) => [el.dataset.panel, el.style.order]));
    expect(placement).toEqual({ companion: "0", timer: "1", tasks: "2" });
    // The reading order is deliberately still timer → companion → tasks: the
    // panels are painted in the arranged order by flex `order`, so nothing that
    // walks the DOM (the mobile drawer, the skip link, a screen reader before
    // layout) is reordered underneath the user.
    expect(panelled.map((el) => el.dataset.panel)).toEqual(["timer", "companion", "tasks"]);
    // The regions are the panels now, so the arrangement survives the styles
    // that used to be the only way the three sat in a column.
    expect(container.querySelector('[data-region="companion"]')!.getAttribute("data-panel")).toBe("companion");
    expect(container.querySelector('[data-region="timer"]')!.getAttribute("data-panel")).toBe("timer");
    expect(container.querySelector('[data-region="rail"]')!.getAttribute("data-panel")).toBe("tasks");
    expect(JSON.parse(window.localStorage.getItem("focusarx-panel-order") ?? "null")).toEqual(["companion", "timer", "tasks"]);

    // Reloading keeps it: the order is read from storage, not from the DOM.
    cleanup();
    const second = await mountFocusPage();
    const reloaded = [...second.container.querySelectorAll("[data-panel]")] as HTMLElement[];
    expect(Object.fromEntries(reloaded.map((el) => [el.dataset.panel, el.style.order]))).toEqual({
      companion: "0",
      timer: "1",
      tasks: "2",
    });

    // Arrange mode itself is a mode, not a setting: the reloaded page is back
    // to using the arrangement, not to editing it.
    expect(screen.getByRole("button", { name: "Arrange" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("button", { name: "Move Companion earlier" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Arrange" }));
    expect(screen.getByRole("button", { name: "Done arranging" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Done arranging" }));
    expect(screen.queryByRole("button", { name: "Move Companion earlier" })).toBeNull();
  });

  it("folds the rail away and keeps the clock on the compact pack", { timeout: 60_000 }, async () => {
    assign("compact");
    const { container } = await mountFocusPage();
    expect(container.querySelector('[data-layout="compact"]')).toBeTruthy();
    // The smallest footprint: no side rail, and no second column.
    expect(container.querySelector('[data-region="rail"]')).toBeNull();
    expect(container.querySelector('[data-region="workspace"]')!.className).not.toContain("lg:flex-row");
    // What compact must never drop: the timer and its companion.
    expect(container.querySelector('[data-region="timer"]')).toBeTruthy();
    expect(container.querySelector('[data-region="companion"]')).toBeTruthy();
    // The motivational line goes with the rail — it is the first thing a small
    // screen should lose, not the clock.
    expect(container.querySelector('[data-region="motivation"]')).toBeNull();
  });
});
