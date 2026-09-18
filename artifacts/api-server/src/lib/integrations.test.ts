import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildAuthorizeUrl,
  callbackUrl,
  createPkce,
  exchangeToken,
  getProvider,
  isManualProvider,
  needsRefresh,
  pkceChallenge,
  PROVIDERS,
  providerConfigured,
  providerView,
  signState,
  summariseTokenResponse,
  verifyState,
  STATE_TTL,
} from "./integrations";

const GOOGLE = getProvider("google_calendar")!;

const env = { ...process.env };

beforeEach(() => {
  process.env.INTEGRATION_ENCRYPTION_KEY = "test-state-key";
  process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id-123";
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret-456";
  process.env.SLACK_CLIENT_ID = "slack-id";
  process.env.SLACK_CLIENT_SECRET = "slack-secret";
});

afterEach(() => {
  process.env = { ...env };
});

describe("provider registry", () => {
  it("finds providers by key and returns null for anything else", () => {
    expect(getProvider("slack")!.name).toBe("Slack");
    expect(getProvider("slacky")).toBeNull();
    expect(getProvider("")).toBeNull();
  });

  it("keeps keys unique, since they are stored on connection rows", () => {
    const keys = PROVIDERS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every OAuth provider the env vars it needs to be configured", () => {
    for (const provider of PROVIDERS) {
      if (isManualProvider(provider)) continue;
      expect(provider.clientIdEnv, provider.key).toBeTruthy();
      expect(provider.clientSecretEnv, provider.key).toBeTruthy();
      expect(provider.authorizeUrl).toMatch(/^https:/);
      expect(provider.tokenUrl).toMatch(/^https:/);
      expect(provider.scopes.length, provider.key).toBeGreaterThan(0);
    }
  });

  it("marks Apple Health as a manual import rather than a connection", () => {
    // Apple exposes HealthKit only to a signed app on the device. Showing a
    // Connect button that cannot work is worse than showing none.
    const apple = getProvider("apple_health")!;
    expect(isManualProvider(apple)).toBe(true);
    expect(providerConfigured(apple)).toBe(true);
    expect(buildAuthorizeUrl(apple, "https://x/cb", "state")).toBe("");
  });
});

describe("configuration is reported, not assumed", () => {
  it("reports a provider configured only when both env vars are present", () => {
    expect(providerConfigured(GOOGLE)).toBe(true);
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    expect(providerConfigured(GOOGLE)).toBe(false);
  });

  it("names the missing variable outside production", () => {
    delete process.env.SLACK_CLIENT_ID;
    const view = providerView(getProvider("slack")!);
    expect(view.configured).toBe(false);
    expect(view.unavailableReason).toContain("SLACK_CLIENT_ID");
  });

  it("does not name internals in production", () => {
    // An unconfigured integration is not the visitor's problem to debug, and
    // the variable name is a hint about our deployment for anyone probing.
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    delete process.env.SLACK_CLIENT_ID;
    try {
      const view = providerView(getProvider("slack")!);
      expect(view.unavailableReason).toBe("Not available on this deployment yet");
      expect(view.unavailableReason).not.toContain("SLACK_CLIENT_ID");
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it("blocks every provider when the encryption key is missing", () => {
    // Storing a token without encryption must be impossible, so the UI must not
    // offer the flow at all.
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    const view = providerView(GOOGLE);
    expect(view.unavailableReason).toBe("Token encryption key is not configured on the server");
  });

  it("never exposes a client secret in the view", () => {
    const view = providerView(GOOGLE);
    expect(JSON.stringify(view)).not.toContain("client-secret-456");
  });
});

describe("OAuth state", () => {
  it("round-trips the user and provider", () => {
    const state = signState("user-1", "google_calendar");
    const parsed = verifyState(state, "google_calendar");
    expect(parsed).not.toBeNull();
    expect(parsed!.userId).toBe("user-1");
  });

  it("rejects a forged state", () => {
    // Without this the whole flow is a CSRF: the attacker completes OAuth with
    // their own Google account and tricks the victim into visiting the callback.
    const state = signState("user-1", "google_calendar");
    const [body] = state.split(".");
    const forged = `${body}.${Buffer.from("0".repeat(43)).toString("base64url")}`;
    expect(verifyState(forged, "google_calendar")).toBeNull();
  });

  it("rejects a state whose body was edited", () => {
    const state = signState("user-1", "google_calendar");
    const [, mac] = state.split(".");
    const swapped = Buffer.from(JSON.stringify({ userId: "attacker", provider: "google_calendar", nonce: "x", issuedAt: Date.now() }), "utf8").toString("base64url");
    expect(verifyState(`${swapped}.${mac}`, "google_calendar")).toBeNull();
  });

  it("rejects a state signed for a different provider", () => {
    // Prevents a state minted for Slack being replayed on the Google callback,
    // which would bind the wrong grant.
    const state = signState("user-1", "slack");
    expect(verifyState(state, "google_calendar")).toBeNull();
  });

  it("expires", () => {
    const issued = 1_700_000_000_000;
    const state = signState("user-1", "slack", issued);
    expect(verifyState(state, "slack", issued + STATE_TTL - 1000)).not.toBeNull();
    expect(verifyState(state, "slack", issued + STATE_TTL + 1)).toBeNull();
  });

  it("rejects a state from the future, in case the clock moved", () => {
    const state = signState("user-1", "slack", 2_000_000_000_000);
    expect(verifyState(state, "slack", 1_700_000_000_000)).toBeNull();
  });

  it("mints a distinct nonce each time", () => {
    expect(signState("u", "slack")).not.toBe(signState("u", "slack"));
  });

  it("returns null for hostile input rather than throwing", () => {
    for (const bad of [null, undefined, 42, "", ".", "abc", "a.b.c.d"]) {
      expect(verifyState(bad, "slack"), String(bad)).toBeNull();
    }
  });
});

describe("PKCE", () => {
  it("derives the challenge from the verifier with S256", () => {
    const pair = createPkce();
    expect(pkceChallenge(pair.verifier)).toBe(pair.challenge);
    expect(pair.verifier).not.toBe(pair.challenge);
  });

  it("produces a verifier of legal length and charset", () => {
    const { verifier } = createPkce();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("authorize URL", () => {
  it("carries client id, redirect, scopes, and state", () => {
    const url = new URL(buildAuthorizeUrl(GOOGLE, "https://app.test/cb", "the-state"));
    expect(url.searchParams.get("client_id")).toBe("client-id-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.test/cb");
    expect(url.searchParams.get("state")).toBe("the-state");
    expect(url.searchParams.get("scope")).toContain("calendar.events");
    expect(url.searchParams.get("access_type")).toBe("offline");
  });

  it("passes a nonce through for providers that require PKCE", () => {
    const pkce = createPkce();
    const url = new URL(buildAuthorizeUrl({ ...GOOGLE, requiresPkce: true }, "https://app.test/cb", "s", pkce));
    expect(url.searchParams.get("code_challenge")).toBe(pkce.challenge);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("encodes a redirect URI that itself has a query string", () => {
    // String concatenation here would inject the redirect's params into the
    // authorize request; URLSearchParams is what makes that impossible.
    const url = new URL(buildAuthorizeUrl(GOOGLE, "https://app.test/cb?next=/focus&x=1", "s"));
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.test/cb?next=/focus&x=1");
  });

  it("joins scopes with a comma for Slack and a space elsewhere", () => {
    // Slack's v2 OAuth takes comma-separated scopes; Google rejects a comma.
    // Getting this wrong yields a scope error that reads like a permissions bug.
    const slack = getProvider("slack")!;
    expect(new URL(buildAuthorizeUrl(slack, "https://x/cb", "s")).searchParams.get("scope")).toContain(",");
    expect(new URL(buildAuthorizeUrl(GOOGLE, "https://x/cb", "s")).searchParams.get("scope")).not.toContain(",");
  });
});

describe("callback URL", () => {
  it("derives from APP_URL and strips a trailing slash", () => {
    process.env.APP_URL = "https://focusarx.app/";
    expect(callbackUrl("slack")).toBe("https://focusarx.app/api/integrations/slack/callback");
  });

  it("falls back to a local base when nothing is configured", () => {
    delete process.env.APP_URL;
    delete process.env.PUBLIC_URL;
    delete process.env.API_BASE_URL;
    expect(callbackUrl("slack")).toBe("http://localhost:3000/api/integrations/slack/callback");
  });
});

describe("token exchange", () => {
  const okResponse = (json: unknown, status = 200) =>
    Promise.resolve({ ok: status < 400, status, text: async () => JSON.stringify(json) } as Response);

  it("parses a Google-shaped response", async () => {
    const result = await exchangeToken(
      GOOGLE,
      { code: "abc", grant_type: "authorization_code" },
      () => okResponse({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "calendar.events", email: "a@b.c" }),
    );
    expect(result.ok).toBe(true);
    expect(result.tokens!.accessToken).toBe("at");
    expect(result.tokens!.refreshToken).toBe("rt");
    expect(result.tokens!.displayName).toBe("a@b.c");
    // A minute of slack: a token must not be used at the instant it expires.
    expect(result.tokens!.expiresAt!.getTime()).toBeLessThanOrEqual(Date.now() + 3600_000);
  });

  it("treats Slack's HTTP 200 with ok:false as a failure", async () => {
    // The bug this test exists for: checking only `res.ok` reports success and
    // stores an undefined token, leaving a connection that fails on first use.
    const result = await exchangeToken(
      getProvider("slack")!,
      { code: "bad" },
      () => okResponse({ ok: false, error: "invalid_code" }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_code");
  });

  it("refuses a response with no access token, even at HTTP 200", async () => {
    const result = await exchangeToken(GOOGLE, { code: "x" }, () => okResponse({ scope: "calendar.events" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("access token");
  });

  it("reports a non-JSON body without throwing", async () => {
    const result = await exchangeToken(
      GOOGLE,
      { code: "x" },
      () => Promise.resolve({ ok: false, status: 502, text: async () => "<html>Bad gateway</html>" } as Response),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("non-JSON");
  });

  it("surfaces the provider's own error string", async () => {
    const result = await exchangeToken(
      GOOGLE,
      { code: "x" },
      () => okResponse({ error: "invalid_grant", error_description: "Token has been revoked" }, 400),
    );
    expect(result.error).toBe("Token has been revoked");
  });

  it("survives a network error", async () => {
    const result = await exchangeToken(GOOGLE, { code: "x" }, () => Promise.reject(new Error("ECONNREFUSED")));
    expect(result.ok).toBe(false);
    expect(result.error).toBe("ECONNREFUSED");
  });

  it("sends the grant type and client credentials as form data", async () => {
    let seen: { url: string; body: string } | null = null;
    await exchangeToken(getProvider("slack")!, { code: "c", grant_type: "authorization_code" }, (url, init) => {
      seen = { url: String(url), body: String((init as RequestInit).body) };
      return okResponse({ access_token: "at" });
    });
    expect(seen!.url).toBe("https://slack.com/api/oauth.v2.access");
    const params = new URLSearchParams(seen!.body);
    expect(params.get("grant_type")).toBe("authorization_code");
    expect(params.get("client_secret")).toBe("slack-secret");
  });
});

describe("token response summary", () => {
  it("redacts every credential field", () => {
    const summary = summariseTokenResponse({
      access_token: "SECRET-AT",
      refresh_token: "SECRET-RT",
      id_token: "SECRET-ID",
      client_secret: "SECRET-CS",
      bot_token: "SECRET-BOT",
      scope: "chat:write",
      expires_in: 3600,
    });
    const serialised = JSON.stringify(summary);
    expect(serialised).not.toContain("SECRET");
    expect(summary.scope).toBe("chat:write");
    expect(summary.expires_in).toBe(3600);
  });

  it("drops nested objects rather than recursing into them", () => {
    // Slack nests `authed_user: { access_token }`; recursing would need a
    // per-provider redaction list that someone would eventually forget.
    const summary = summariseTokenResponse({ authed_user: { access_token: "SECRET" }, ok: true });
    expect(summary.authed_user).toBeUndefined();
    expect(JSON.stringify(summary)).not.toContain("SECRET");
  });
});

describe("refresh timing", () => {
  it("refreshes shortly before expiry, and not a moment before", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    expect(needsRefresh(new Date("2026-01-01T12:04:00Z"), now)).toBe(true);
    expect(needsRefresh(new Date("2026-01-01T12:30:00Z"), now)).toBe(false);
  });

  it("never refreshes a token that does not expire", () => {
    // Slack's token has no expiry. Treating null as "expired" would refresh it
    // forever and eventually invalidate the grant.
    expect(needsRefresh(null)).toBe(false);
  });
});
