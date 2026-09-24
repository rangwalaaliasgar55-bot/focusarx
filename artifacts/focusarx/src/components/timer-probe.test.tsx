import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";
import { PromptProvider } from "@/components/ui/PromptDialog";
import { SessionRecoveryProvider } from "@/components/SessionRecoveryContext";
import Timer from "@/components/Timer";

function withProviders(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const { hook } = memoryLocation({ path: "/focus" });
  return (
    <QueryClientProvider client={client}>
      <Router hook={hook}>
        <AuthProvider>
          <ToastProvider>
            <PromptProvider>
              <SessionRecoveryProvider>{node}</SessionRecoveryProvider>
            </PromptProvider>
          </ToastProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("timer probe", () => {
  it("mounts and starts", async () => {
    render(withProviders(<Timer />));
    // Wait for recovery gate
    await act(async () => { await Promise.resolve(); });
    const buttons = Array.from(document.querySelectorAll("button")).map((b) => b.textContent?.trim());
    // eslint-disable-next-line no-console
    console.log("BUTTONS:", JSON.stringify(buttons));
    // eslint-disable-next-line no-console
    console.log("HTML LEN:", document.body.innerHTML.length);
    expect(true).toBe(true);
  });
});
