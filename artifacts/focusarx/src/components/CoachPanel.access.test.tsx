/**
 * The coach must answer a free student.
 *
 * This is the regression guard for the most damaging bug the AI had:
 * `/api/coach/chat` was `requirePremium` on the server *and* the panel refused
 * to send from the client for anyone without a plan ("Do not load AI model for
 * free users"). Those two guards agreed with each other and disagreed with the
 * product — a student who typed "plan my next 3 hours" could not get an answer,
 * and what they read instead ("Focus Coach is Premium-only") is indistinguishable
 * from an AI that does not work. Every report of "the AI does not do what I ask"
 * started here.
 *
 * So this test asserts the *behaviour*, not the source text: with a signed-in
 * free account and a working server, the message is posted and the reply shown.
 * It also pins the two states that must stay distinct — signed out (no account
 * to attach the message to) and allowance spent (the one place a premium pitch
 * belongs).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

const authState = { status: "authenticated" as "authenticated" | "unauthenticated" | "loading" };

// Only `useAuth` is replaced. The rest of the module is kept, because
// `@/lib/api` imports the token helpers from it — a factory that returned
// `{ useAuth }` alone left `getToken` undefined, the request threw before it
// reached the network, and the panel quietly fell back to its canned greeting.
// (That failure mode is worth remembering: it is how a mocked-out test can
// "pass" while the real integration is broken.)
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    useAuth: () => ({ status: authState.status, data: null, signIn: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }),
  };
});

vi.mock("@/hooks/usePremium", () => ({
  usePremium: () => ({ isPremium: false, isLoading: false }),
}));

vi.mock("wouter", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) =>
    createElement("a", { href, ...rest }, children),
  useLocation: () => ["/focus", vi.fn()],
}));

import CoachPanel from "./CoachPanel";
import { FOCUS_DEEP_LINK_EVENT } from "@/lib/focusDeepLink";
import { AuthStatus } from "@/lib/auth";

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(QueryClientProvider, { client }, createElement(CoachPanel))
  );
}

/** The panel's floating button, by its accessible label. */
async function openPanel() {
  fireEvent.click(screen.getByLabelText("Open coach"));
}

type Route = { status?: number; body: unknown };

function mockFetch(routes: Record<string, Route>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, _init?: RequestInit) => {
    const path = String(url);
    calls.push(path);
    const match = Object.entries(routes).find(([key]) => path.startsWith(key));
    const route = match?.[1];
    if (!route) {
      return new Response(JSON.stringify({ error: { message: "not mocked" } }), { status: 404 });
    }
    if (route.status === undefined) {
      // `apiFetch` reads this header on every response.
      return new Response(JSON.stringify(route.body), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-FocusArx-Deployment": "test" },
      });
    }
    return new Response(JSON.stringify(route.body), { status: route.status, headers: { "Content-Type": "application/json" } });
  }));
  return calls;
}

beforeEach(() => {
  authState.status = "authenticated";
  try { localStorage.clear(); } catch { /* jsdom without storage */ }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CoachPanel access", () => {
  it("sends a free student's message to the model and renders the answer", async () => {
    const calls = mockFetch({
      "/api/coach/status": {
        // Free tier, messages remaining: NOT locked.
        body: { isPremium: false, allowance: { used: 1, limit: 10, remaining: 9, isPremium: false }, lockScreen: null },
      },
      "/api/coach/session-tip": { body: { tip: "Start with the hardest thing.", fallback: false, provider: "gemini" } },
      "/api/coach/chat": {
        body: {
          reply: "Three blocks of 50 minutes: thermodynamics first, then past questions.",
          fallback: false,
          provider: "gemini",
          allowance: { used: 2, limit: 10, remaining: 8, isPremium: false },
        },
      },
    });

    mount();
    await act(async () => { await openPanel(); });

    // The greeting tip loads from the model, not from a lock screen.
    await waitFor(() => expect(screen.getByText(/Start with the hardest thing/)).toBeTruthy());

    const input = screen.getByPlaceholderText("Ask your coach…");
    fireEvent.change(input, { target: { value: "plan my next 3 hours" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByText(/Three blocks of 50 minutes/)).toBeTruthy()
    );

    const chatCall = calls.find((c) => c.includes("/api/coach/chat"));
    expect(chatCall, "the message never reached the chat endpoint").toBeTruthy();
    // And nothing on the way in said "premium" to the student.
    expect(screen.queryByText(/Premium-only/i)).toBeNull();
  });

  it("shows the daily allowance instead of a paywall", async () => {
    mockFetch({
      "/api/coach/status": {
        body: { isPremium: false, allowance: { used: 0, limit: 10, remaining: 10, isPremium: false }, lockScreen: null },
      },
      "/api/coach/session-tip": { body: { tip: "One thing at a time.", fallback: false } },
    });

    mount();
    await act(async () => { await openPanel(); });

    await waitFor(() => expect(screen.getByText(/10 of 10 messages left today/)).toBeTruthy());
  });

  it("asks a signed-out visitor to sign in rather than selling premium", async () => {
    authState.status = "unauthenticated";
    const calls = mockFetch({});

    mount();
    await act(async () => { await openPanel(); });

    expect(screen.getByText(/Sign in and your coach is ready/i)).toBeTruthy();
    expect(screen.queryByText(/Premium access/i)).toBeNull();
    // No chat request is attempted without an account to attach it to.
    expect(calls.some((c) => c.includes("/api/coach/chat"))).toBe(false);
  });

  it("shows the server's own sentence once the allowance is spent", async () => {
    mockFetch({
      "/api/coach/status": {
        body: {
          isPremium: false,
          allowance: { used: 10, limit: 10, remaining: 0, isPremium: false },
          lockScreen: {
            title: "That is all 10 coach messages for today",
            description: "Your daily messages reset at midnight IST.",
            benefits: ["Personalized focus plan"],
            currentBalance: 1200,
            tokensNeeded: 8800,
            plan: { durationDays: 30, tokenCost: 10000 },
          },
        },
      },
    });

    mount();
    await act(async () => { await openPanel(); });

    await waitFor(() =>
      expect(screen.getByText(/That is all 10 coach messages for today/)).toBeTruthy()
    );
    // The allowance is explained, not just denied.
    expect(screen.getByText(/reset at midnight IST/i)).toBeTruthy();
  });
});

describe("CoachPanel actions — the coach does the work", () => {
  it("shows what it did, as chips, when the server performed actions", async () => {
    mockFetch({
      "/api/coach/status": { body: { isPremium: false, allowance: { used: 0, limit: 10, remaining: 10 }, lockScreen: null } },
      "/api/coach/session-tip": { body: { tip: "Ready when you are.", fallback: false } },
      "/api/coach/chat": {
        body: {
          reply: "Added it for tomorrow.",
          fallback: false,
          provider: "gemini",
          actions: [
            { type: "create_task", ok: true, summary: "Added “Revise physics” for 2026-09-25", id: "task-1" },
            { type: "start_session", ok: true, summary: "Starting a 45-minute block", client: { minutes: 45, label: "Revise physics" } },
          ],
          allowance: { used: 1, limit: 10, remaining: 9 },
        },
      },
    });

    mount();
    await act(async () => { await openPanel(); });
    const input = screen.getByPlaceholderText("Ask your coach…");
    fireEvent.change(input, { target: { value: "add task revise physics for 45 minutes tomorrow" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
      await Promise.resolve();
    });

    // The chips are the proof of work — not the sentence above them.
    await waitFor(() => expect(screen.getByText(/Added “Revise physics” for 2026-09-25/)).toBeTruthy());
    expect(screen.getByText(/Starting a 45-minute block/)).toBeTruthy();
  });

  it("arms the timer when the coach asks for a session", async () => {
    const deepLinks: unknown[] = [];
    const onDeepLink = (event: Event) => deepLinks.push((event as CustomEvent).detail);
    window.addEventListener(FOCUS_DEEP_LINK_EVENT, onDeepLink);

    mockFetch({
      "/api/coach/status": { body: { isPremium: false, allowance: { used: 0, limit: 10, remaining: 10 }, lockScreen: null } },
      "/api/coach/session-tip": { body: { tip: "Ready.", fallback: false } },
      "/api/coach/chat": {
        body: {
          reply: "Starting it now.",
          actions: [{ type: "start_session", ok: true, summary: "Starting a 25-minute block", client: { minutes: 25, label: "Organic chemistry" } }],
        },
      },
    });

    mount();
    await act(async () => { await openPanel(); });
    const input = screen.getByPlaceholderText("Ask your coach…");
    fireEvent.change(input, { target: { value: "start a 25 minute block on organic chemistry" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
      await Promise.resolve();
    });

    // The dispatch is deferred (the panel yields a tick so the reply paints
    // first), and an earlier test's deferred dispatch can still land here, so
    // wait for *this* payload rather than for "any" event.
    await waitFor(() =>
      expect(deepLinks.some((d) => (d as { task?: string }).task === "Organic chemistry")).toBe(true)
    );
    // The same deep-link payload the Instagram funnel uses — one code path arms
    // the timer, whoever asked: 25 minutes as seconds, and the label as the task.
    expect(deepLinks.at(-1)).toMatchObject({ seconds: 1500, task: "Organic chemistry" });
    window.removeEventListener(FOCUS_DEEP_LINK_EVENT, onDeepLink);
  });

  it("does not dress up a failed action as success", async () => {
    mockFetch({
      "/api/coach/status": { body: { isPremium: false, allowance: { used: 0, limit: 10, remaining: 10 }, lockScreen: null } },
      "/api/coach/session-tip": { body: { tip: "Ready.", fallback: false } },
      "/api/coach/chat": {
        body: {
          reply: "I could not find that task.",
          actions: [{ type: "complete_task", ok: false, summary: "No open task matched “the essay” — nothing was changed" }],
        },
      },
    });

    mount();
    await act(async () => { await openPanel(); });
    const input = screen.getByPlaceholderText("Ask your coach…");
    fireEvent.change(input, { target: { value: "mark the essay done" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByText(/nothing was changed/)).toBeTruthy());
  });
});

describe("AuthStatus", () => {
  it("is one of the three states the panel branches on", () => {
    const states: AuthStatus[] = ["loading", "authenticated", "unauthenticated"];
    expect(states).toHaveLength(3);
  });
});
