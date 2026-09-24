/**
 * Voice capture must actually be reachable.
 *
 * It was written, reviewed and shipped as dead code: the manager was rendered
 * nowhere (so the "open voice capture" event had no listener), the router was
 * never mounted in `routes/index.ts`, and its idempotency table was missing from
 * the schema — which is why the router could not even be imported. Three
 * independent omissions, one symptom the user reported plainly: "voice feature
 * is not there".
 *
 * This test drives the real path: dispatches the event on a mounted wrapper,
 * asserts the dialog appears, asserts the transcript reaches
 * `POST /api/voice-capture/parse`, then saves and asserts the commit call. The
 * server side (that the router is mounted) is covered by
 * `api-server/src/routes/voiceCaptureContract.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

vi.mock("@/components/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
  ToastProvider: ({ children }: { children: ReactNode }) => children,
}));

import { VoiceCaptureMount } from "./VoiceCaptureMount";
import { openVoiceCapture } from "@/lib/voiceCapture";

const ITEMS = [
  {
    id: "draft-1",
    kind: "task" as const,
    title: "Revise physics",
    sourceText: "revise physics for 45 minutes tomorrow",
    dueDate: "2026-09-25",
    estimatedMinutes: 45,
    priority: "high" as const,
    category: "Study",
    recurring: null,
    description: null,
    confidence: 0.9,
    warnings: [],
  },
];

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(VoiceCaptureMount)));
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    if (String(url).includes("/voice-capture/parse")) {
      return new Response(JSON.stringify({ items: ITEMS, transcript: body.transcript }), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-FocusArx-Deployment": "test" },
      });
    }
    if (String(url).includes("/voice-capture/commit")) {
      return new Response(JSON.stringify({ createdCount: body.items?.length ?? 0, replayed: false }), {
        status: 201,
        headers: { "Content-Type": "application/json", "X-FocusArx-Deployment": "test" },
      });
    }
    return new Response(JSON.stringify({}), { status: 404, headers: { "X-FocusArx-Deployment": "test" } });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("voice capture reachability", () => {
  it("loads nothing until it is asked for", () => {
    mount();
    // The wrapper must not render the dialog (or fetch its chunk) on page load:
    // it is weight the entry chunk cannot afford on every visit.
    expect(screen.queryByText(/Voice planner/i)).toBeNull();
  });

  it("opens the dialog from anywhere via the open event", async () => {
    mount();
    await act(async () => {
      openVoiceCapture("revise physics for 45 minutes tomorrow");
    });
    await waitFor(() => expect(screen.getByText(/Voice planner/i)).toBeTruthy());
  });

  it("sends the transcript to the parse endpoint and shows the drafted items", async () => {
    const calls: string[] = [];
    const original = globalThis.fetch as unknown as (url: string, init?: RequestInit) => Promise<Response>;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(String(url));
      return original(url, init);
    }));

    mount();
    await act(async () => {
      openVoiceCapture("revise physics for 45 minutes tomorrow");
    });

    await waitFor(() => expect(screen.getByDisplayValue("Revise physics")).toBeTruthy());
    expect(calls.some((c) => c.includes("/api/voice-capture/parse"))).toBe(true);
  });

  it("saves the drafts to the commit endpoint", async () => {
    const calls: string[] = [];
    const original = globalThis.fetch as unknown as (url: string, init?: RequestInit) => Promise<Response>;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${String(url)}`);
      return original(url, init);
    }));

    mount();
    await act(async () => {
      openVoiceCapture("revise physics for 45 minutes tomorrow");
    });
    await waitFor(() => expect(screen.getByDisplayValue("Revise physics")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
    });

    await waitFor(() =>
      expect(calls.some((c) => c.startsWith("POST") && c.includes("/api/voice-capture/commit"))).toBe(true)
    );
  });
});
