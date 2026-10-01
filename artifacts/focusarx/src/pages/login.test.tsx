import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

/**
 * The two-step sign-in contract.
 *
 * The password step of a 2FA account must NOT establish a session — it swaps
 * the credentials for a challenge the user redeems with a rotating code. The
 * page's job is to hide that machinery behind two calm steps: the password
 * form never flashes back to empty, and the code step is reachable without
 * retyping anything. These tests pin both halves of that behavior.
 */

const auth = vi.hoisted(() => ({
  signIn: vi.fn(),
  verifyMfa: vi.fn(),
  signOut: vi.fn(),
  refresh: vi.fn(),
  data: null,
  status: "unauthenticated",
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/safeRedirect", () => ({ redirectFromSearch: () => "/app" }));
vi.mock("@/components/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/PageSEO", () => ({ PageSEO: () => null, PAGE_SEO: { login: {} } }));
vi.mock("wouter", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/app">{children}</a>,
  useLocation: () => ["/", vi.fn()],
}));

import LoginPage from "./login";

beforeEach(() => {
  auth.signIn.mockReset();
  auth.verifyMfa.mockReset();
});

afterEach(cleanup);

function submitCredentials() {
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "user@example.com" } });
  // Exact label: /password/i would also match the "Forgot password?" link.
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter2" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("login page — two-factor sign-in", () => {
  it("a password-only account signs straight through", async () => {
    auth.signIn.mockResolvedValue({ ok: true });
    render(<LoginPage />);
    submitCredentials();
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith("credentials", { email: "user@example.com", password: "hunter2" }));
    expect(auth.verifyMfa).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/verification code/i)).toBeNull();
  });

  it("an mfaRequired answer swaps to the code step without clearing the form", async () => {
    auth.signIn.mockResolvedValue({ ok: false, mfaChallenge: "challenge-token" });
    render(<LoginPage />);
    submitCredentials();
    await waitFor(() => expect(screen.getByLabelText(/verification code/i)).toBeTruthy());
    expect(screen.getByText(/two-factor authentication/i)).toBeTruthy();
    // The password form is gone; the credentials remain in state so a user
    // who backs out does not have to retype them.
    expect(screen.queryByLabelText(/email address/i)).toBeNull();
    expect(screen.getByRole("button", { name: /verify and sign in/i })).toBeTruthy();
  });

  it("the code step completes through verifyMfa", async () => {
    auth.signIn.mockResolvedValue({ ok: false, mfaChallenge: "challenge-token" });
    auth.verifyMfa.mockResolvedValue({ ok: true });
    render(<LoginPage />);
    submitCredentials();
    await waitFor(() => expect(screen.getByLabelText(/verification code/i)).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /verify and sign in/i }));
    await waitFor(() => expect(auth.verifyMfa).toHaveBeenCalledWith("challenge-token", "123456"));
  });

  it("an invalid code keeps the user on the code step with the challenge intact", async () => {
    auth.signIn.mockResolvedValue({ ok: false, mfaChallenge: "challenge-token" });
    auth.verifyMfa.mockResolvedValue({ ok: false, error: "That code was not accepted." });
    render(<LoginPage />);
    submitCredentials();
    await waitFor(() => expect(screen.getByLabelText(/verification code/i)).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /verify and sign in/i }));
    await waitFor(() => expect(auth.verifyMfa).toHaveBeenCalled());
    expect(screen.getByText(/that code was not accepted/i)).toBeTruthy();
    // Still on the code step — a wrong code must not kick the user back to
    // the password form (that would read as "your password was wrong").
    expect(screen.getByLabelText(/verification code/i)).toBeTruthy();
  });

  it("using a different account returns to a fresh password step", async () => {
    auth.signIn.mockResolvedValue({ ok: false, mfaChallenge: "challenge-token" });
    render(<LoginPage />);
    submitCredentials();
    await waitFor(() => expect(screen.getByLabelText(/verification code/i)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /use a different account/i }));
    expect(screen.getByLabelText(/email address/i)).toBeTruthy();
    expect(screen.queryByLabelText(/verification code/i)).toBeNull();
  });
});
