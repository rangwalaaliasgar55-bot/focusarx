import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/**
 * `/data-deletion` told every signed-in user who pressed the button:
 *
 *     "Deletion request received. We'll process and confirm by email within
 *      30 days."
 *
 * and called nothing but `GET /api/auth/session`. There was no request. The
 * account was untouched, no email was sent, and nothing was queued. A person
 * exercising a legal right to erasure was given a receipt for work that never
 * happened, and would have discovered it 30 days later by still being able to
 * log in.
 *
 * The bug was invisible to every kind of check the repo had: the page rendered,
 * the button worked, the type-checker was happy (there was no API call to get
 * wrong), and the only assertion anyone could have written against it — "does
 * the success state appear?" — passed for the wrong reason.
 *
 * So this test asserts the thing that was actually missing: a request reaching
 * the server. The rendered copy is checked too, because a page that claims
 * "irreversible" while deferring deletion for 30 days is wrong in the opposite
 * direction and just as harmful.
 */

const apiJson = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  apiJson: (...args: unknown[]) => apiJson(...args),
  errorMessage: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
}));

let token: string | null = "test-token";
vi.mock("@/lib/auth", () => ({ getToken: () => token }));
vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import DataDeletionPage from "./data-deletion";

async function confirmDeletion() {
  fireEvent.click(screen.getByRole("button", { name: /request account deletion/i }));
  fireEvent.change(screen.getByLabelText(/confirm your password/i), { target: { value: "hunter2" } });
  fireEvent.click(screen.getByRole("button", { name: /schedule deletion/i }));
}

beforeEach(() => {
  token = "test-token";
  apiJson.mockReset();
  apiJson.mockResolvedValue({
    ok: true,
    deleted: false,
    requestedAt: "2026-01-01T12:00:00.000Z",
    scheduledFor: "2026-01-31T12:00:00.000Z",
    daysRemaining: 30,
    cancellable: true,
  });
});

afterEach(cleanup);

describe("data deletion page", () => {
  it("actually asks the server to delete, and sends the password", async () => {
    render(<DataDeletionPage />);
    await confirmDeletion();

    await waitFor(() => expect(apiJson).toHaveBeenCalledTimes(1));
    const [path, init] = apiJson.mock.calls[0] as [string, { method: string; body: string }];
    expect(path).toBe("/api/auth/account");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({ password: "hunter2" });
  });

  it("reports the date rather than implying the data is already gone", async () => {
    render(<DataDeletionPage />);
    await confirmDeletion();

    expect(await screen.findByText(/deletion scheduled/i)).toBeTruthy();
    expect(screen.getByText(/nothing has been removed yet/i)).toBeTruthy();
    // The old copy promised email confirmation of something that had not
    // happened; there is no email because there is no separate request queue.
    expect(screen.queryByText(/we'll process and confirm by email/i)).toBeNull();
  });

  it("never calls a deferred deletion irreversible", () => {
    render(<DataDeletionPage />);
    const main = screen.getByRole("main");
    expect(main.textContent).not.toMatch(/irreversible/i);
    expect(main.textContent).not.toMatch(/immediate deletion/i);
    // It says how long the window is, because that is what the user needs to
    // know in order to change their mind.
    expect(main.textContent).toMatch(/30 days/i);
  });

  it("does not claim success when nobody is signed in", async () => {
    token = null;
    render(<DataDeletionPage />);
    await confirmDeletion();

    expect(apiJson).not.toHaveBeenCalled();
    expect(await screen.findByText(/not signed in/i)).toBeTruthy();
    expect(screen.queryByText(/deletion scheduled/i)).toBeNull();
  });

  it("surfaces a server refusal instead of a success state", async () => {
    apiJson.mockRejectedValue(new Error("Password confirmation required"));
    render(<DataDeletionPage />);
    await confirmDeletion();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/password confirmation required/i);
    expect(screen.queryByText(/deletion scheduled/i)).toBeNull();
  });
});
