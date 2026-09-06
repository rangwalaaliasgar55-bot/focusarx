import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import AiInsightsPage from "./ai-insights";

const premium = vi.hoisted(() => ({ isPremium: false, isLoading: false, balance: 250, cheapestCost: 10000 }));
vi.mock("@/hooks/usePremium", () => ({ usePremium: () => premium }));
vi.mock("@/lib/auth", () => ({ getToken: () => null }));

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.unstubAllGlobals();
  premium.isPremium = false;
  premium.isLoading = false;
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><AiInsightsPage /></QueryClientProvider>);
}

describe("AI insights premium boundary", () => {
  it("does not request AI data for a free user", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    renderPage();
    await act(async () => {});
    expect(screen.getByText("AI Coach is Premium")).toBeTruthy();
    expect(screen.getByText("Your Balance")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not request AI data while entitlement is loading", async () => {
    premium.isLoading = true;
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    renderPage();
    await act(async () => {});
    expect(fetch).not.toHaveBeenCalled();
  });

  it("mounts the queries once premium access is granted", async () => {
    premium.isPremium = true;
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    renderPage();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/ai/performance-insights", expect.any(Object)));
  });
});
