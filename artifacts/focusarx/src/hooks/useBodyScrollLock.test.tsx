import { render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useBodyScrollLock } from "./useBodyScrollLock";

/**
 * The lock is reference-counted because overlays stack: a confirm dialog on
 * top of a sheet would otherwise unlock the page when the dialog closed,
 * while the sheet underneath was still open.
 */
function Harness({ active }: { active: boolean }) {
  useBodyScrollLock(active);
  return null;
}

afterEach(() => {
  // Leave the document exactly as we found it — body styles are global state.
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
  document.body.style.touchAction = "";
});

describe("useBodyScrollLock", () => {
  it("locks the body while active", () => {
    const { unmount } = render(<Harness active />);
    expect(document.body.style.overflow).toBe("hidden");
    // iOS Safari ignores overflow:hidden for touch, so touch-action is set too.
    expect(document.body.style.touchAction).toBe("none");
    unmount();
  });

  it("does not lock when inactive", () => {
    render(<Harness active={false} />);
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.touchAction).toBe("");
  });

  it("restores the previous styles on unmount", () => {
    document.body.style.overflow = "scroll";
    document.body.style.touchAction = "manipulation";

    const { unmount } = render(<Harness active />);
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("scroll");
    expect(document.body.style.touchAction).toBe("manipulation");
  });

  it("stays locked until the last overlay closes", () => {
    const outer = render(<Harness active />);
    const inner = render(<Harness active />);
    expect(document.body.style.overflow).toBe("hidden");

    // Closing the inner overlay must NOT unlock while the outer is still open.
    inner.unmount();
    expect(document.body.style.overflow).toBe("hidden");

    outer.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("toggles with the flag", () => {
    const { rerender } = render(<Harness active={false} />);
    expect(document.body.style.overflow).toBe("");

    rerender(<Harness active />);
    expect(document.body.style.overflow).toBe("hidden");

    rerender(<Harness active={false} />);
    expect(document.body.style.overflow).toBe("");
  });

  it("survives StrictMode double-invocation", () => {
    // React 19 StrictMode mounts, unmounts and remounts effects. A naive
    // implementation unlocks itself during that cycle and the overlay ships
    // with the page still scrollable.
    const { rerender } = renderHook((active: boolean) => useBodyScrollLock(active), {
      initialProps: true,
    });
    rerender(true);
    expect(document.body.style.overflow).toBe("hidden");
  });
});
