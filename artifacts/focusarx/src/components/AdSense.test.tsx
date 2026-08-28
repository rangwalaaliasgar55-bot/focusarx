import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { AdSense, AdSenseAnchor } from "./AdSense";

/**
 * Console hygiene for the AdSense components.
 *
 * Ad units are the easiest place in the app to introduce a silent console
 * error: `window.adsbygoogle.push()` throws when the loader is absent or
 * blocked, and an unguarded call surfaces in DevTools on every page that
 * carries an ad. The old implementation caught the throw but still left the
 * `<ins>` element unstyled and un-reserved.
 */

type Entry = { level: string; args: unknown[] };

function captureConsole() {
  const entries: Entry[] = [];
  const originals = {
    error: console.error,
    warn: console.warn,
  };
  console.error = (...args: unknown[]) => { entries.push({ level: "error", args }); };
  console.warn = (...args: unknown[]) => { entries.push({ level: "warn", args }); };
  const restore = () => {
    console.error = originals.error;
    console.warn = originals.warn;
  };
  return { entries, restore };
}

describe("AdSense console hygiene", () => {
  let cap: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    cap = captureConsole();
    delete (window as { adsbygoogle?: unknown[] }).adsbygoogle;
    delete (window as { __adsbygoogleLoaded?: boolean }).__adsbygoogleLoaded;
    document.head.innerHTML = "";
  });

  afterEach(() => {
    cap.restore();
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders without any console output when the AdSense loader is absent", () => {
    const { container } = render(<AdSense slot="1234567890" format="auto" />);
    expect(container.querySelector("ins.adsbygoogle")).toBeTruthy();
    expect(cap.entries, `unexpected console output: ${JSON.stringify(cap.entries)}`).toEqual([]);
  });

  it("renders without console output when adsbygoogle.push throws", () => {
    // Simulate a blocked/failed loader: push() rejects loudly.
    (window as { adsbygoogle?: unknown[] }).adsbygoogle = {
      push() { throw new Error("adsbygoogle.push() error: All ins elements already have ads"); },
    } as unknown as unknown[];

    render(<AdSense slot="1234567890" format="rectangle" />);
    expect(cap.entries, `push() failure leaked to console: ${JSON.stringify(cap.entries)}`).toEqual([]);
  });

  it("injects the loader script exactly once across many units", () => {
    render(
      <>
        <AdSense slot="1111111111" format="auto" />
        <AdSense slot="2222222222" format="fluid" />
        <AdSenseAnchor slot="3333333333" />
      </>,
    );
    const scripts = [...document.querySelectorAll("script#adsbygoogle-js")];
    expect(scripts.length, "loader injected more than once").toBeLessThanOrEqual(1);
    expect(cap.entries, `unexpected console output: ${JSON.stringify(cap.entries)}`).toEqual([]);
  });

  it("reserves layout height so a filling ad cannot shift content (CLS)", () => {
    const { container } = render(<AdSense slot="1234567890" format="rectangle" />);
    const wrapper = container.querySelector<HTMLElement>(".ad-container");
    const style = wrapper?.getAttribute("style") ?? "";
    expect(style).toMatch(/min-height/);
    expect(cap.entries).toEqual([]);
  });

  it("emits the publisher id and slot on the ins element", () => {
    const { container } = render(<AdSense slot="9876543210" format="auto" />);
    const ins = container.querySelector("ins.adsbygoogle");
    expect(ins?.getAttribute("data-ad-client")).toMatch(/^ca-pub-\d+$/);
    expect(ins?.getAttribute("data-ad-slot")).toBe("9876543210");
    expect(cap.entries).toEqual([]);
  });
});
