import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

/**
 * The danger zone is the one place in the product where a wrong sentence costs
 * the user their data.
 *
 * It used to say, unconditionally, "This permanently removes your profile,
 * focus history, XP, coins, streaks, and rewards. This action cannot be undone."
 * Every clause of that became false once deletion gained a grace period — and
 * falsely claiming an action is irreversible is uniquely harmful, because it
 * stops the user from attempting the undo that now exists.
 *
 * These tests pin the distinction that matters: a scheduled deletion is
 * reversible and says so, a guest profile really is immediate, and the recovery
 * window is genuinely usable because the account still authenticates.
 */

const auth = vi.hoisted(() => ({
  data: null as null | { user: Record<string, unknown>; pendingDeletion?: Record<string, unknown> },
  signOut: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ data: auth.data, signOut: auth.signOut, refresh: auth.refresh, status: "authenticated" }),
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

const apiJson = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ apiJson: (...args: unknown[]) => apiJson(...args) }));

vi.mock("@/components/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { AccountSecuritySection } from "./AccountSecuritySection";

const scheduled = (daysRemaining: number, cancellable = true) => ({
  requestedAt: "2026-01-01T12:00:00.000Z",
  scheduledFor: "2026-01-31T12:00:00.000Z",
  daysRemaining,
  cancellable,
});

const regularUser = { id: "u1", email: "a@b.co", name: "Ali", isGuest: false };

beforeEach(() => {
  apiJson.mockReset();
  apiJson.mockResolvedValue({ ok: true, deleted: false, ...scheduled(30) });
  auth.signOut.mockReset();
  auth.refresh.mockReset();
  auth.data = { user: regularUser };
});

afterEach(cleanup);

describe("account deletion with a grace period", () => {
  it("never claims a scheduled deletion cannot be undone", () => {
    render(<AccountSecuritySection />);
    const zone = screen.getByText("Danger zone").parentElement!;
    expect(zone.textContent).not.toMatch(/cannot be undone/i);
    expect(zone.textContent).not.toMatch(/permanently delete/i);
    // It states the window, because that is the fact the decision turns on.
    expect(zone.textContent).toMatch(/30 days/i);
  });

  it("offers a working undo while the window is open", async () => {
    auth.data = { user: regularUser, pendingDeletion: scheduled(12) };
    render(<AccountSecuritySection />);

    expect(screen.getByText(/12 days left/i)).toBeTruthy();
    // The delete affordance must be gone — re-requesting would be meaningless
    // and the button would invite the user to do something already done.
    expect(screen.queryByRole("button", { name: /delete account/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /keep my account/i }));
    await waitFor(() =>
      expect(apiJson).toHaveBeenCalledWith("/api/auth/account/deletion/cancel", { method: "POST" }),
    );
    // The session is re-read so the banner disappears without a manual reload.
    expect(auth.refresh).toHaveBeenCalled();
  });

  it("says so when the window has closed instead of offering a fake undo", () => {
    auth.data = { user: regularUser, pendingDeletion: scheduled(0, false) };
    render(<AccountSecuritySection />);
    expect(screen.queryByRole("button", { name: /keep my account/i })).toBeNull();
    expect(screen.getByText(/recovery window has closed/i)).toBeTruthy();
  });

  it("keeps guest deletion immediate, and labels it as such", () => {
    auth.data = { user: { ...regularUser, isGuest: true } };
    render(<AccountSecuritySection />);
    // A guest profile has no email to recover through, so promising a window
    // would be the same lie in the other direction.
    expect(screen.getByText(/no way to recover one/i)).toBeTruthy();
  });

  it("reports a scheduled deletion rather than a completed one", async () => {
    render(<AccountSecuritySection />);
    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
    fireEvent.change(screen.getByLabelText(/confirm your password/i), { target: { value: "hunter2" } });
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: /schedule deletion/i }));

    await waitFor(() => expect(apiJson).toHaveBeenCalled());
    const [path, init] = apiJson.mock.calls[0] as [string, { method: string }];
    expect(path).toBe("/api/auth/account");
    expect(init.method).toBe("DELETE");
    expect(auth.signOut).toHaveBeenCalled();
  });
});
