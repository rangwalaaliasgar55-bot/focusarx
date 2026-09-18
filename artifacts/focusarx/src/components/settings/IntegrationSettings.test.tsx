import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { IntegrationSettings } from "./IntegrationSettings";

/**
 * The two things this component must not do:
 *
 * 1. **Offer a Connect button for something the server cannot do.** The user
 *    would be sent through Google's consent screen and *then* told it is
 *    unavailable — having already granted access. The button is disabled with
 *    the reason shown up front.
 * 2. **Render a failed request as an empty state.** "No endpoints yet" when the
 *    request failed tells the user something false about their own config.
 */

const toast = vi.fn();
vi.mock("@/components/Toast", () => ({ useToast: () => ({ toast }) }));

const apiJson = vi.fn();
vi.mock("@/lib/api", () => ({
  apiJson: (...args: unknown[]) => apiJson(...args),
  errorMessage: (err: unknown, fallback: string) =>
    err instanceof Error && err.message ? err.message : fallback,
}));

function provider(overrides: Record<string, unknown> = {}) {
  return {
    key: "google_calendar",
    name: "Google Calendar",
    description: "Adds each completed focus session to a calendar.",
    category: "calendar",
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
    configured: true,
    manual: false,
    connection: null,
    ...overrides,
  };
}

function resolveWith(providers: unknown[], endpoints: unknown[] = [], available = true) {
  apiJson.mockImplementation((url: string) => {
    if (url === "/api/integrations") return Promise.resolve({ providers });
    if (url === "/api/webhooks") return Promise.resolve({ endpoints, available });
    return Promise.resolve({});
  });
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  toast.mockClear();
  apiJson.mockReset();
  window.history.replaceState({}, "", "/profile");
});

afterEach(() => {
  cleanup();
});

describe("connected apps", () => {
  it("disables Connect and shows the reason when the server cannot do it", async () => {
    resolveWith([
      provider({ configured: false, unavailableReason: "GOOGLE_CALENDAR_CLIENT_ID is not set" }),
    ]);
    render(<IntegrationSettings />);
    await flush();

    const button = screen.getByRole("button", { name: "Connect" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("GOOGLE_CALENDAR_CLIENT_ID is not set")).toBeTruthy();
  });

  it("lists the scopes before the button, not after the consent screen", async () => {
    resolveWith([provider()]);
    render(<IntegrationSettings />);
    await flush();

    expect(screen.getByText(/Access requested/)).toBeTruthy();
    // Inside a disclosure, so the summary states the count and the list holds
    // the detail — the user can see exactly what is being asked for.
    expect(screen.getByText("https://www.googleapis.com/auth/calendar.events")).toBeTruthy();
  });

  it("shows a broken connection's own error rather than a green dot", async () => {
    // A connection that stopped refreshing is the failure that matters, and the
    // only actionable description of it is the server's.
    resolveWith([
      provider({
        connection: {
          id: "c1",
          provider: "google_calendar",
          externalAccountId: "u1",
          displayName: "a@b.c",
          scopes: [],
          status: "expired",
          lastError: "Token has been revoked",
          lastSyncedAt: null,
          expiresAt: null,
          hasRefreshToken: true,
        },
      }),
    ]);
    render(<IntegrationSettings />);
    await flush();

    expect(screen.getByText("Token has been revoked")).toBeTruthy();
    expect(screen.getByText("expired")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeTruthy();
  });

  it("sends the user to the provider's authorize URL on Connect", async () => {
    resolveWith([provider()]);
    render(<IntegrationSettings />);
    await flush();

    apiJson.mockResolvedValueOnce({ authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth?x=1" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    });

    expect(apiJson).toHaveBeenCalledWith("/api/integrations/google_calendar/connect", { method: "POST" });
  });

  it("says nothing was changed when the user denies consent", async () => {
    // Pressing "Deny" is a decision, not a failure. Reporting it as an error
    // makes the user think something went wrong.
    window.history.replaceState({}, "", "/profile?integration=denied&provider=slack");
    resolveWith([provider()]);
    render(<IntegrationSettings />);
    await flush();

    expect(screen.getByTestId("integration-notice").textContent).toContain("Connection cancelled");
    expect(screen.getByText("You declined access, and nothing on your account was changed.")).toBeTruthy();
  });

  it("confirms a successful connection by name", async () => {
    window.history.replaceState({}, "", "/profile?integration=connected&provider=google_calendar");
    resolveWith([provider()]);
    render(<IntegrationSettings />);
    await flush();
    expect(screen.getByTestId("integration-notice").textContent).toContain("Connected to google calendar");
  });

  it("keeps the outcome on screen until dismissed, instead of a toast that fades", async () => {
    // A toast that has already faded leaves no trace of why a connection the
    // user just approved is not there.
    window.history.replaceState({}, "", "/profile?integration=error&reason=exchange_failed");
    resolveWith([provider()]);
    render(<IntegrationSettings />);
    await flush();

    expect(screen.getByText("Could not finish connecting")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    });
    expect(screen.queryByTestId("integration-notice")).toBeNull();
  });

  it("distinguishes an expired link from a rejected authorization", async () => {
    // Different causes need different user actions: one is "start again", the
    // other is "check what you approved".
    window.history.replaceState({}, "", "/profile?integration=error&reason=invalid_state");
    resolveWith([provider()]);
    render(<IntegrationSettings />);
    await flush();
    expect(screen.getByText("That link expired")).toBeTruthy();

    cleanup();
    window.history.replaceState({}, "", "/profile?integration=error&reason=exchange_failed");
    render(<IntegrationSettings />);
    await flush();
    expect(screen.getByText("Could not finish connecting")).toBeTruthy();
    expect(screen.getByText(/approved every requested permission/)).toBeTruthy();
  });

  it("falls back to safe copy for a reason code it does not know", async () => {
    // A reason added after this build shipped must not render as "undefined".
    window.history.replaceState({}, "", "/profile?integration=error&reason=some_new_code");
    resolveWith([provider()]);
    render(<IntegrationSettings />);
    await flush();
    expect(screen.getByTestId("integration-notice").textContent).toContain("Nothing on your account was changed.");
    expect(screen.getByTestId("integration-notice").textContent).not.toContain("undefined");
  });

  it("strips the outcome from the URL, so a refresh does not re-announce it", async () => {
    window.history.replaceState({}, "", "/profile?integration=connected&provider=slack");
    resolveWith([provider()]);
    render(<IntegrationSettings />);
    await flush();
    expect(window.location.search).toBe("");
  });

  it("marks a manual provider as an import rather than offering Connect", async () => {
    resolveWith([provider({ key: "apple_health", name: "Apple Health", manual: true, scopes: [] })]);
    render(<IntegrationSettings />);
    await flush();

    expect(screen.getByText("Imported from a file")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Connect" })).toBeNull();
  });
});

describe("webhooks", () => {
  const endpoint = {
    id: "e1",
    url: "https://example.com/hooks",
    description: "My receiver",
    events: [],
    active: true,
    secretHint: "whsec_ab",
    failureCount: 0,
    lastSuccessAt: new Date().toISOString(),
    lastFailureAt: null,
    disabledReason: null,
  };

  it("shows the secret hint, never a full secret", async () => {
    // The plaintext is returned once at creation and never again. Rendering one
    // here would mean it is retrievable, which defeats signing.
    resolveWith([provider()], [endpoint]);
    render(<IntegrationSettings />);
    await flush();

    expect(screen.getByText("whsec_ab…")).toBeTruthy();
  });

  it("reports a test delivery with its status and duration", async () => {
    resolveWith([provider()], [endpoint]);
    render(<IntegrationSettings />);
    await flush();

    apiJson.mockResolvedValueOnce({ ok: true, status: 200, durationMs: 42, error: null });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    });

    expect(apiJson).toHaveBeenCalledWith("/api/webhooks/e1/test", { method: "POST" });
    expect(toast).toHaveBeenCalledWith("Delivered in 42ms (HTTP 200).", "success");
  });

  it("surfaces the failure reason from a failed test delivery", async () => {
    resolveWith([provider()], [endpoint]);
    render(<IntegrationSettings />);
    await flush();

    apiJson.mockResolvedValueOnce({ ok: false, status: 500, durationMs: 10, error: "HTTP 500" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    });
    expect(toast).toHaveBeenCalledWith("Delivery failed: HTTP 500", "error");
  });

  it("shows why an endpoint was auto-disabled", async () => {
    resolveWith([provider()], [
      { ...endpoint, active: false, failureCount: 15, disabledReason: "Disabled after 15 consecutive failed deliveries" },
    ]);
    render(<IntegrationSettings />);
    await flush();

    expect(screen.getByText("Disabled")).toBeTruthy();
    expect(screen.getByText("Disabled after 15 consecutive failed deliveries")).toBeTruthy();
    expect(screen.getByText(/15 consecutive failures/)).toBeTruthy();
  });

  it("toggles an endpoint by PATCHing the new active state", async () => {
    resolveWith([provider()], [endpoint]);
    render(<IntegrationSettings />);
    await flush();

    apiJson.mockResolvedValueOnce({});
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Disable" }));
    });

    expect(apiJson).toHaveBeenCalledWith("/api/webhooks/e1", {
      method: "PATCH",
      body: JSON.stringify({ active: false }),
    });
  });

  it("says endpoints are unavailable rather than showing an empty list", async () => {
    // "No endpoints yet" when the feature is off is a lie about the user's setup.
    resolveWith([provider()], [], false);
    render(<IntegrationSettings />);
    await flush();

    expect(screen.getByText("Webhooks are not enabled on this deployment yet.")).toBeTruthy();
  });
});

describe("a failed load", () => {
  it("renders an error, not an empty state", async () => {
    // The bug class: telling the user they have no connections when the request
    // simply failed.
    apiJson.mockRejectedValue(new Error("Network unreachable"));
    render(<IntegrationSettings />);
    await flush();

    expect(screen.getByText("Couldn't load your connections")).toBeTruthy();
    expect(screen.getByText("Network unreachable")).toBeTruthy();
    expect(screen.queryByText(/No endpoints yet/)).toBeNull();
  });

  it("retries on demand", async () => {
    apiJson.mockRejectedValueOnce(new Error("Nope"));
    render(<IntegrationSettings />);
    await flush();

    resolveWith([provider()], []);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    });
    expect(screen.getByText("Google Calendar")).toBeTruthy();
  });
});
