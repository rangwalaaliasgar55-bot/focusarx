import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act, fireEvent, waitFor } from "@testing-library/react";
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

/** All buttons whose visible text is exactly `text`. */
function byText(text: string) {
  return Array.from(document.querySelectorAll("button")).filter((b) => (b.textContent || "").trim() === text);
}
const byAria = (re: RegExp) => Array.from(document.querySelectorAll("button")).filter((b) => re.test(b.getAttribute("aria-label") || ""));
const digits = () => (document.querySelector("button[aria-label*='remaining']")?.getAttribute("aria-label") ?? "");

async function click(el: Element | undefined) {
  if (!el) return false;
  await act(async () => { fireEvent.click(el); await Promise.resolve(); });
  return true;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("timer flow", () => {
  it("start → session type → lock mode → the clock actually runs", async () => {
    render(withProviders(<Timer />));
    await act(async () => { await Promise.resolve(); });

    expect(await click(byAria(/^start session$/i)[0])).toBe(true);
    await waitFor(() => expect(byText("Choose focus type").length).toBe(0));
    // Pick "Deep Work" inside the session-type picker.
    const deepWork = Array.from(document.querySelectorAll("button")).filter((b) => /Deep Work/.test(b.textContent || "") && b.className.includes("rounded-2xl"));
    // eslint-disable-next-line no-console
    console.log("SESSION TYPES:", deepWork.length, JSON.stringify(deepWork.map((b) => (b.textContent || "").slice(0, 24))));
    await click(deepWork[0]);
    await act(async () => { await Promise.resolve(); });

    const confirm = byText("Start session").filter((b) => b.className.includes("brand-600"));
    // eslint-disable-next-line no-console
    console.log("LOCK CONFIRM:", confirm.length, "ARIA START:", byAria(/pause|start session/i).map((b) => b.getAttribute("aria-label")).join(" | "));
    await click(confirm[0]);
    await act(async () => { await Promise.resolve(); });

    const label0 = digits();
    // eslint-disable-next-line no-console
    console.log("LABEL AFTER START:", JSON.stringify(label0), "RUNNING BUTTONS:", byAria(/pause/i).length);
    await act(async () => { await new Promise((r) => setTimeout(r, 2300)); });
    const label1 = digits();
    // eslint-disable-next-line no-console
    console.log("LABEL AFTER 2.3s:", JSON.stringify(label1));
    expect(label0).toBeTruthy();
    expect(label1).not.toBe(label0);
  }, 20000);
});
