import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { useState } from "react";
import { Route, Router } from "wouter";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Why every route in `App.tsx` must not use an inline `component={() => ...}`.
 *
 * `<Route component={X} />` renders `createElement(X)`, and React reconciles by
 * element *type*. An arrow function written inline in JSX is a brand-new
 * function on every render of the parent, so React sees a different component
 * type at the same position and unmounts the whole subtree before mounting a
 * fresh one.
 *
 * That is not a theoretical concern here. `App` holds `isFocusing`, which the
 * timer itself sets via the `fx:focus-start` / `fx:focus-stop` events, and
 * `AppWithPalette` holds `paletteOpen`. So a running focus session would tear
 * its own page down and rebuild it — the timer's skeleton returns, session
 * recovery runs again, and the user sees the session "reload". Switching
 * browser tabs made it worse, because the deployment-skew detector polls on
 * visibility change and notifies its listeners, re-rendering `App`.
 *
 * These tests pin both halves: the React semantics that cause it, and the
 * source-level rule that prevents it.
 */

afterEach(cleanup);

describe("inline route components remount", () => {
  it("unmounts and remounts the subtree when the parent re-renders", () => {
    const mounted: string[] = [];
    const unmounted: string[] = [];

    function Page() {
      // Effects stand in for the real observable consequence: on the timer
      // page a remount resets `recoveryReady`, re-reads the persisted session
      // and re-runs the server recovery call.
      const [id] = useState(() => {
        mounted.push("Page");
        return mounted.length;
      });
      return <span data-testid="page">{id}</span>;
    }

    function Harness() {
      const [, setTick] = useState(0);
      return (
        <Router>
          <button type="button" onClick={() => setTick((n) => n + 1)}>
            rerender
          </button>
          {/* The anti-pattern, reproduced. */}
          <Route path="/" component={() => <Page />} />
        </Router>
      );
    }

    const { getByText, getByTestId } = render(<Harness />);
    expect(mounted).toEqual(["Page"]);
    const first = getByTestId("page").textContent;

    act(() => {
      getByText("rerender").click();
    });

    // Two mounts, and a fresh component instance: the old one was destroyed.
    expect(mounted.length).toBe(2);
    expect(getByTestId("page").textContent).not.toBe(first);
    void unmounted;
  });

  it("does not remount when the component reference is stable", () => {
    const mounted: string[] = [];

    function Page() {
      useState(() => {
        mounted.push("Page");
        return mounted.length;
      });
      return <span>page</span>;
    }

    function Harness() {
      const [, setTick] = useState(0);
      return (
        <Router>
          <button type="button" onClick={() => setTick((n) => n + 1)}>
            rerender
          </button>
          <Route path="/" component={Page} />
        </Router>
      );
    }

    const { getByText } = render(<Harness />);
    expect(mounted.length).toBe(1);
    act(() => {
      getByText("rerender").click();
    });
    expect(mounted.length).toBe(1);
  });

  it("does not remount when the route is given children instead", () => {
    // The fix used across App.tsx: `<Route path="...">` with real elements
    // rather than a component *type*. The elements are recreated each render,
    // but React reconciles them by the (stable) element type, so nothing
    // unmounts.
    const mounted: string[] = [];

    function Page() {
      useState(() => {
        mounted.push("Page");
        return mounted.length;
      });
      return <span>page</span>;
    }

    function Harness() {
      const [, setTick] = useState(0);
      return (
        <Router>
          <button type="button" onClick={() => setTick((n) => n + 1)}>
            rerender
          </button>
          <Route path="/">
            <Page />
          </Route>
        </Router>
      );
    }

    const { getByText } = render(<Harness />);
    expect(mounted.length).toBe(1);
    act(() => {
      getByText("rerender").click();
    });
    expect(mounted.length).toBe(1);
  });
});

describe("App.tsx route definitions", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const appSource = readFileSync(path.resolve(here, "../App.tsx"), "utf8");

  it("never passes an inline function to a Route", () => {
    // The gate. A single `component={() => ...}` reintroduces the remount for
    // whichever page it wraps, and the symptom (a session reloading itself
    // mid-run) looks like a timer bug rather than a routing one, so it is worth
    // failing the build over rather than re-deriving.
    const offenders = appSource
      .split("\n")
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => /<(Route|Switch)\b[^>]*\b(component|render)=\{\s*\(/.test(line));

    expect(
      offenders.map((o) => `${o.number}: ${o.line.trim()}`),
      "Inline component/render props on <Route> remount the page subtree on every parent render.",
    ).toEqual([]);
  });

  it("defines a real destination for every route it presents to the user", () => {
    // Sanity check that the source scan above is running against the real file
    // and not an empty string — a gate that matches nothing always passes.
    const routeCount = (appSource.match(/<Route\s+path=/g) ?? []).length;
    expect(routeCount).toBeGreaterThan(80);
  });
});
