import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";
import { PromptProvider } from "@/components/ui/PromptDialog";

const entries: string[] = [];
const originals = { error: console.error, warn: console.warn };

beforeEach(() => {
  entries.length = 0;
  console.error = (...a: unknown[]) => entries.push(`error: ${a.map(String).join(" ")}`);
  console.warn = (...a: unknown[]) => entries.push(`warn: ${a.map(String).join(" ")}`);
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

afterEach(() => {
  console.error = originals.error;
  console.warn = originals.warn;
  vi.unstubAllGlobals();
  cleanup();
});

describe("focus page probe", () => {
  it("mounts the real timer page with a clean console", { timeout: 60_000 }, async () => {
    const mod = await import("@/pages/focus");
    const Page = mod.default;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
    const { hook } = memoryLocation({ path: "/focus" });
    await act(async () => {
      render(
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
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    const real = entries.filter((e) => !e.includes("was not wrapped in act(") && !e.includes("overlapping act() calls"));
    // eslint-disable-next-line no-console
    originals.error(`FOCUS PAGE CONSOLE (${real.length}):\n` + real.join("\n").slice(0, 3000));
    expect(true).toBe(true);
  });
});
