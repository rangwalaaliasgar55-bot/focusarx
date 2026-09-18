import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import ReferralPage from "./referral";

/**
 * The referral page had two ways of quietly telling the user something false.
 *
 * 1. The code card rendered `data?.code ?? "—"`. When `/api/referral/my-code`
 *    failed, the dash reads as *"you don't have a referral code"* — but the
 *    user does; we just never got it. Worse, the copy buttons next to it were
 *    silently inert (`if (!data) return`), so the page looked broken rather
 *    than offline. A referral programme is nothing but this one string; the
 *    page has to be sure before it implies the string is missing.
 *
 * 2. Copying had no failure path at all. `navigator.clipboard.writeText()`
 *    rejects over plain HTTP and whenever the browser denies permission, and
 *    the rejection went nowhere — no change to the icon, no message. The fix
 *    follows the idiom already used for study-room invite codes: when the
 *    write fails, show the value so it can still be selected by hand.
 */

const toast = vi.fn();
vi.mock("@/components/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ status: "authenticated", user: { id: "u1" } }),
  getToken: () => "test-token",
}));
vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

let queryResult: Record<string, unknown> = {};
const refetch = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => queryResult,
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

const code = { code: "FAX-ABC123", shareUrl: "https://focusarx.app/r/FAX-ABC123" };

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  toast.mockClear();
  refetch.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a failed code fetch is not \"you have no code\"", () => {
  it("shows a retryable error instead of a placeholder dash", async () => {
    queryResult = { data: undefined, isLoading: false, isError: true, isFetching: false, refetch };

    render(<ReferralPage />);
    await flush();

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("your referral code");
    expect(screen.getByText("Try again")).toBeTruthy();
    // The specific lie: a dash sitting in the code slot.
    expect(screen.queryByText("—")).toBeNull();
    // And no copy control that would silently do nothing.
    expect(screen.queryByText("Copy invite link")).toBeNull();
  });

  it("retries and then shows the real code", async () => {
    queryResult = { data: undefined, isLoading: false, isError: true, isFetching: false, refetch };

    render(<ReferralPage />);
    await flush();
    fireEvent.click(screen.getByText("Try again"));
    expect(refetch).toHaveBeenCalledTimes(1);

    queryResult = { data: code, isLoading: false, isError: false, isFetching: false, refetch };
    cleanup();
    render(<ReferralPage />);
    await flush();

    expect(screen.getByText("FAX-ABC123")).toBeTruthy();
    expect(screen.getByText("Copy invite link")).toBeTruthy();
  });

  it("surfaces the code when the clipboard is unavailable", async () => {
    queryResult = { data: code, isLoading: false, isError: false, isFetching: false, refetch };
    // jsdom ships no clipboard at all, which is exactly the failure the old
    // handlers swallowed: `writeText` throws and nothing tells the user.
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });

    render(<ReferralPage />);
    await flush();

    fireEvent.click(screen.getByText("Copy invite link"));
    await flush();

    expect(toast).toHaveBeenCalledWith(code.shareUrl, "info");
  });
});
