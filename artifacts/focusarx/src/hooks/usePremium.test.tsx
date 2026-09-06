import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePremium } from "./usePremium";

const auth = vi.hoisted(() => ({ status: "authenticated", token: null as string | null }));
vi.mock("@/lib/auth", () => ({ useAuth: () => auth, getToken: () => auth.token }));
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.unstubAllGlobals();
  auth.status = "authenticated";
  auth.token = null;
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return renderHook(() => usePremium(), {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

describe("usePremium cookie-first authentication", () => {
  it("loads entitlement with cookies even without a localStorage bearer token", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ isPremium: true, balance: 300, plans: [{ tokenCost: 9000 }] })));
    vi.stubGlobal("fetch", fetch);
    const { result } = setup();
    await waitFor(() => expect(result.current.isPremium).toBe(true));
    expect(fetch).toHaveBeenCalledWith("/api/premium/status", { headers: {}, credentials: "include" });
    expect(result.current.cheapestCost).toBe(9000);
  });

  it("keeps bearer-token fallback support", async () => {
    auth.token = "ui-test-token";
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ isPremium: false })));
    vi.stubGlobal("fetch", fetch);
    setup();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/premium/status", {
      headers: { Authorization: "Bearer ui-test-token" }, credentials: "include",
    }));
    await act(async () => {});
  });

  it("does not request private entitlement for anonymous visitors", async () => {
    auth.status = "unauthenticated";
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { result } = setup();
    await act(async () => {});
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.isPremium).toBe(false);
  });
});
