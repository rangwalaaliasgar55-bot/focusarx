import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "./useWakeLock";

const originalWakeLock = Object.getOwnPropertyDescriptor(navigator, "wakeLock");
const originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");

function createSentinel() {
  const sentinel = Object.assign(new EventTarget(), {
    released: false,
    type: "screen" as const,
    onrelease: null,
    release: vi.fn(async () => {
      sentinel.released = true;
      sentinel.dispatchEvent(new Event("release"));
    }),
  });
  return sentinel;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});

afterEach(() => {
  cleanup();
  if (originalWakeLock) Object.defineProperty(navigator, "wakeLock", originalWakeLock);
  else Reflect.deleteProperty(navigator, "wakeLock");
  if (originalVisibility) Object.defineProperty(document, "visibilityState", originalVisibility);
  else Reflect.deleteProperty(document, "visibilityState");
});

function installWakeLock(request: () => Promise<WakeLockSentinel>) {
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
}

describe("useWakeLock", () => {
  it("acquires a lock while active and releases it when disabled", async () => {
    const sentinel = createSentinel();
    const request = vi.fn().mockResolvedValue(sentinel);
    installWakeLock(request);
    const { result, rerender } = renderHook((active: boolean) => useWakeLock(active), { initialProps: true });
    await act(async () => {});
    expect(result.current.supported).toBe(true);
    expect(result.current.isLocked).toBe(true);
    expect(request).toHaveBeenCalledWith("screen");
    await act(async () => { rerender(false); });
    expect(sentinel.release).toHaveBeenCalledTimes(1);
    expect(result.current.isLocked).toBe(false);
  });

  it("reacquires after the browser releases a hidden tab's lock", async () => {
    const first = createSentinel();
    const second = createSentinel();
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    installWakeLock(request);
    const { result } = renderHook(() => useWakeLock(true));
    await act(async () => {});
    await act(async () => {
      setVisibility("hidden");
      await first.release();
    });
    expect(result.current.isLocked).toBe(false);
    await act(async () => { setVisibility("visible"); });
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.current.isLocked).toBe(true);
  });

  it("releases an in-flight result if the timer stops before acquisition", async () => {
    const pending = deferred<WakeLockSentinel>();
    const sentinel = createSentinel();
    installWakeLock(vi.fn().mockReturnValue(pending.promise));
    const { result, rerender } = renderHook((active: boolean) => useWakeLock(active), { initialProps: true });
    await act(async () => { rerender(false); });
    await act(async () => { pending.resolve(sentinel); });
    expect(sentinel.release).toHaveBeenCalledTimes(1);
    expect(result.current.isLocked).toBe(false);
  });

  it("releases a late acquisition after unmount", async () => {
    const pending = deferred<WakeLockSentinel>();
    const sentinel = createSentinel();
    installWakeLock(vi.fn().mockReturnValue(pending.promise));
    const { unmount } = renderHook(() => useWakeLock(true));
    unmount();
    await act(async () => { pending.resolve(sentinel); });
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it("does not issue overlapping requests or replace an existing lock", async () => {
    const pending = deferred<WakeLockSentinel>();
    const request = vi.fn().mockReturnValue(pending.promise);
    installWakeLock(request);
    const { result } = renderHook(() => useWakeLock(true));
    await act(async () => { setVisibility("visible"); });
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(createSentinel()); });
    await act(async () => { await result.current.request(); });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not acquire while inactive or hidden", async () => {
    const request = vi.fn().mockResolvedValue(createSentinel());
    installWakeLock(request);
    const { result, rerender } = renderHook((active: boolean) => useWakeLock(active), { initialProps: false });
    await act(async () => { await result.current.request(); });
    expect(request).not.toHaveBeenCalled();
    await act(async () => { setVisibility("hidden"); rerender(true); });
    expect(request).not.toHaveBeenCalled();
  });

  it("degrades gracefully when unsupported or permission is denied", async () => {
    Reflect.deleteProperty(navigator, "wakeLock");
    const unsupported = renderHook(() => useWakeLock(true));
    expect(unsupported.result.current.supported).toBe(false);
    expect(unsupported.result.current.isLocked).toBe(false);
    unsupported.unmount();

    installWakeLock(vi.fn().mockRejectedValue(new Error("Permission denied")));
    const denied = renderHook(() => useWakeLock(true));
    await act(async () => {});
    expect(denied.result.current.supported).toBe(true);
    expect(denied.result.current.isLocked).toBe(false);
  });
});
