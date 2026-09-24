import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";
import ProfilePage from "@/pages/profile";

const console_: Array<{ level: string; text: string }> = [];
const orig = { error: console.error, warn: console.warn, log: console.log };

function withProviders(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const { hook } = memoryLocation({ path: "/profile" });
  return (
    <QueryClientProvider client={client}>
      <Router hook={hook}>
        <AuthProvider>
          <ToastProvider>{node}</ToastProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  console_.length = 0;
  console.error = (...a: unknown[]) => { console_.push({ level: "error", text: a.map(String).join(" ") }); };
  console.warn = (...a: unknown[]) => { console_.push({ level: "warn", text: a.map(String).join(" ") }); };
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

afterEach(() => {
  console.error = orig.error; console.warn = orig.warn;
  cleanup();
  vi.unstubAllGlobals();
});

describe("profile probe", () => {
  it("renders and reports what is actually on the page", async () => {
    render(withProviders(<ProfilePage />));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });

    const text = (document.body.textContent ?? "").replace(/\s+/g, " ").trim();
    const buttons = Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || b.getAttribute("aria-label") || "").trim()).filter(Boolean);
    const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim());
    const styled = Array.from(document.querySelectorAll("div,section")).filter((el) => {
      const c = el.className;
      return typeof c === "string" && /var\(--/.test(c);
    }).length;

    orig.log("PROFILE TEXT:", JSON.stringify(text.slice(0, 700)));
    orig.log("PROFILE COUNTS:", JSON.stringify({ buttons: buttons.length, tabs, styledDivs: styled, html: document.body.innerHTML.length }));
    orig.log("PROFILE BUTTONS:", JSON.stringify(buttons.slice(0, 25)));
    orig.log("PROFILE CONSOLE:", JSON.stringify(console_.slice(0, 8)));
    expect(text.length).toBeGreaterThan(0);
  }, 20000);
});
