/**
 * The AI roadmap has to end in work, not in a picture.
 *
 * "gemini doesnt work does not do tasks does not do what asked" is what a
 * student says when the generator returns a seven-day plan and nothing is ever
 * written to their task list: the plan lives in component state and dies on
 * refresh. `POST /api/roadmap/commit` is the missing half, and these cases pin
 * the two things that make the button trustworthy — the request it sends, and
 * what it tells the student afterwards.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Roadmap from "@/pages/roadmap";
import { ToastProvider } from "@/components/Toast";

// The page only offers the commit button to a signed-in student; the auth
// provider itself is not what this test is about.
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  useAuth: () => ({ status: "authenticated", session: null, user: null, loading: false }),
}));

const PLAN = [
  { day: 1, tasks: ["Read chapter 4", "Make a summary sheet"], focusSessions: ["45 min deep work"], estimatedTime: 45 },
  { day: 2, tasks: ["Practice 10 problems"], focusSessions: ["45 min deep work"], estimatedTime: 45 },
  { day: 3, tasks: ["Revise chapter 4 flashcards"], focusSessions: [], estimatedTime: 30 },
];

const CALLS: Array<{ url: string; method: string; body: any }> = [];

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as unknown as Response;
}

beforeEach(() => {
  CALLS.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    CALLS.push({ url: String(url), method, body });
    if (String(url).includes("/api/roadmap/list")) return jsonResponse({ roadmaps: [] });
    if (String(url).includes("/api/ai/roadmap")) return jsonResponse({ roadmap: PLAN });
    if (String(url).includes("/api/roadmap/commit")) return jsonResponse({ ok: true, created: 4, skipped: 1, days: 3, firstDueDate: "2026-09-24", goalId: "goal_1" }, 201);
    return jsonResponse({});
  }));
});

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

async function generatePlan() {
  fireEvent.click(await screen.findByRole("button", { name: /generate|build|create/i }));
  await waitFor(() => { expect(screen.getByText("Read chapter 4")).toBeTruthy(); });
}

describe("roadmap → tasks", () => {
  it("offers to add the generated plan to the task list", async () => {
    wrap(<Roadmap />);
    await generatePlan();
    expect(screen.getByRole("button", { name: /add to my tasks/i })).toBeTruthy();
  });

  it("sends the plan server-side with the chosen horizon", async () => {
    wrap(<Roadmap />);
    await generatePlan();
    fireEvent.click(screen.getByRole("button", { name: /add to my tasks/i }));
    await waitFor(() => { expect(CALLS.some((c) => c.url.includes("/api/roadmap/commit"))).toBe(true); });
    const call = CALLS.find((c) => c.url.includes("/api/roadmap/commit"))!;
    expect(call.method).toBe("POST");
    expect(call.body.horizonDays).toBe(3);
    expect(call.body.days.length).toBe(3);
    expect(call.body.days[0].tasks).toContain("Read chapter 4");
    expect(call.body.subject.length).toBeGreaterThan(2);
  });

  it("confirms what actually happened, including what was already there", async () => {
    wrap(<Roadmap />);
    await generatePlan();
    fireEvent.click(screen.getByRole("button", { name: /add to my tasks/i }));
    await waitFor(() => { expect(screen.getByText(/4 tasks added/i)).toBeTruthy(); });
    expect(screen.getByText(/1 already there/i)).toBeTruthy();
  });

  it("surfaces a server refusal instead of claiming success", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      CALLS.push({ url: String(url), method: (init?.method ?? "GET").toUpperCase(), body: init?.body ? JSON.parse(String(init.body)) : null });
      if (String(url).includes("/api/roadmap/list")) return jsonResponse({ roadmaps: [] });
      if (String(url).includes("/api/ai/roadmap")) return jsonResponse({ roadmap: PLAN });
      if (String(url).includes("/api/roadmap/commit")) return jsonResponse({ error: "That plan has no tasks to add" }, 400);
      return jsonResponse({});
    }));
    wrap(<Roadmap />);
    await generatePlan();
    fireEvent.click(screen.getByRole("button", { name: /add to my tasks/i }));
    await waitFor(() => { expect(screen.getByText(/no tasks to add/i)).toBeTruthy(); });
    expect(screen.queryByText(/tasks added/i)).toBeNull();
  });
});
