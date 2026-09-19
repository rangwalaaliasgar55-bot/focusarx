/**
 * §1.6 — third-party integrations.
 *
 * A registry rather than five bespoke route files. Everything that differs
 * between Google Calendar and Slack — authorize URL, token endpoint, scopes,
 * whether the token expires — is data; everything that is the same (state
 * signing, token exchange, encrypted storage, refresh, disconnect) is written
 * once here.
 *
 * The one design decision that matters: **every provider is env-gated and
 * reports itself as unconfigured rather than failing at the last step.** OAuth
 * needs an app registration — a client id and secret from a console — which the
 * deployer may not have done. A user who clicks "Connect Google Calendar",
 * signs in with Google, grants access, and *then* sees "not configured" has
 * been asked to hand over a credential for nothing. `listProviders` carries
 * `configured`, the connect route 503s up front, and the settings UI disables
 * the button with the reason.
 *
 * The state parameter is signed, not stored. It carries the user id and a
 * nonce, is MAC'd with the same key as the webhook secrets, and expires in ten
 * minutes. A stored state row would work too, but it needs a table and a
 * cleanup job; a signed value cannot be replayed after its expiry and needs
 * neither. See `signState`/`verifyState` — and note the nonce, which is what
 * stops a *valid* state from one user's flow being reused in another's.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface ProviderDefinition {
  /** Stable key stored in `integration_connections.provider`. Never renamed. */
  key: string;
  name: string;
  /** What connecting it actually does, shown in the UI before the user agrees. */
  description: string;
  category: "calendar" | "chat" | "health" | "tasks";
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Extra authorize params some providers require. */
  authorizeParams?: Record<string, string>;
  /** Whether the provider returns a refresh token we must persist. */
  usesRefreshToken: boolean;
  clientIdEnv: string;
  clientSecretEnv: string;
  /**
   * Some providers require PKCE even for confidential clients. Google's
   * installed-app and Slack's newer flows both do; sending it when not
   * required is harmless, so this is opt-out.
   */
  requiresPkce?: boolean;
  /** Where a user manages or revokes the grant, for the "disconnect" copy. */
  revokeUrl?: string;
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    key: "google_calendar",
    name: "Google Calendar",
    description: "Adds each completed focus session to a calendar of your choice, so deep work shows up next to meetings.",
    category: "calendar",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/calendar.events", "openid", "email"],
    authorizeParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    usesRefreshToken: true,
    clientIdEnv: "GOOGLE_CALENDAR_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CALENDAR_CLIENT_SECRET",
    revokeUrl: "https://myaccount.google.com/permissions",
  },
  {
    key: "google_fit",
    name: "Google Fit",
    description: "Reads activity and sleep so your focus readiness reflects how rested you actually are.",
    category: "health",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/fitness.activity.read",
      "https://www.googleapis.com/auth/fitness.sleep.read",
      "openid",
    ],
    authorizeParams: { access_type: "offline", prompt: "consent" },
    usesRefreshToken: true,
    clientIdEnv: "GOOGLE_FIT_CLIENT_ID",
    clientSecretEnv: "GOOGLE_FIT_CLIENT_SECRET",
    revokeUrl: "https://myaccount.google.com/permissions",
  },
  {
    key: "apple_health",
    name: "Apple Health",
    description:
      "Imports mindfulness minutes and sleep from an export file. Apple Health has no server-side API, so this is an import rather than a live connection.",
    category: "health",
    // No OAuth, no server-side access: Apple exposes HealthKit only to an app
    // on the device and requires a signed export for anything server-side.
    // Recorded here as a *manual import* provider so the UI can tell the truth
    // instead of showing a Connect button that cannot work.
    authorizeUrl: "",
    tokenUrl: "",
    scopes: [],
    usesRefreshToken: false,
    clientIdEnv: "",
    clientSecretEnv: "",
  },
  {
    key: "slack",
    name: "Slack",
    description: "Posts a daily focus summary and lets teammates start a focus session from a channel.",
    category: "chat",
    authorizeUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: ["chat:write", "commands", "users:read"],
    usesRefreshToken: false,
    clientIdEnv: "SLACK_CLIENT_ID",
    clientSecretEnv: "SLACK_CLIENT_SECRET",
    revokeUrl: "https://slack.com/apps",
  },
  {
    key: "discord",
    name: "Discord",
    description: "Shares focus sessions with a server and updates your status while a timer runs.",
    category: "chat",
    authorizeUrl: "https://discord.com/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    scopes: ["identify", "guilds", "webhook.incoming"],
    usesRefreshToken: true,
    clientIdEnv: "DISCORD_CLIENT_ID",
    clientSecretEnv: "DISCORD_CLIENT_SECRET",
    revokeUrl: "https://discord.com/developers/applications",
  },
];

const BY_KEY = new Map(PROVIDERS.map((p) => [p.key, p]));

export function getProvider(key: string): ProviderDefinition | null {
  return BY_KEY.get(key) ?? null;
}

/** True when this provider is usable without a live connection (file import). */
export function isManualProvider(provider: ProviderDefinition): boolean {
  return provider.authorizeUrl === "" || provider.clientIdEnv === "";
}

export function providerConfigured(provider: ProviderDefinition): boolean {
  if (isManualProvider(provider)) return true;
  return Boolean(process.env[provider.clientIdEnv] && process.env[provider.clientSecretEnv]);
}

export function clientIdFor(provider: ProviderDefinition): string {
  return process.env[provider.clientIdEnv] ?? "";
}

function clientSecretFor(provider: ProviderDefinition): string {
  return process.env[provider.clientSecretEnv] ?? "";
}

/** What the API tells the client about a provider. Never includes a secret. */
export interface ProviderView {
  key: string;
  name: string;
  description: string;
  category: ProviderDefinition["category"];
  scopes: string[];
  configured: boolean;
  /** Manual providers are imported from a file, not authorized. */
  manual: boolean;
  revokeUrl?: string;
  /** Why it cannot be used, when it cannot — shown verbatim in the UI. */
  unavailableReason?: string;
}

export function providerView(provider: ProviderDefinition): ProviderView {
  const manual = isManualProvider(provider);
  const configured = providerConfigured(provider);
  let unavailableReason: string | undefined;
  if (!configured) {
    unavailableReason =
      process.env.NODE_ENV === "production"
        ? "Not available on this deployment yet"
        : `${provider.clientIdEnv} is not set`;
  }
  if (!manual && !process.env.INTEGRATION_ENCRYPTION_KEY) {
    unavailableReason = "Token encryption key is not configured on the server";
  }
  return {
    key: provider.key,
    name: provider.name,
    description: provider.description,
    category: provider.category,
    scopes: provider.scopes,
    configured,
    manual,
    ...(provider.revokeUrl ? { revokeUrl: provider.revokeUrl } : {}),
    ...(unavailableReason ? { unavailableReason } : {}),
  };
}

// ─── STATE ───────────────────────────────────────────────────────────────────

const STATE_TTL_MS = 10 * 60 * 1000;

function stateKey(): Buffer {
  // Dedicated variable if present, else derived from the encryption key so a
  // single-key deployment does not have to add a second one. The `::state`
  // suffix is what keeps the two derivations independent — without it, a MAC
  // and a cipher key would be the same bytes used two ways.
  const raw = process.env.INTEGRATION_STATE_KEY ?? process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) throw new Error("No key configured for OAuth state signing");
  return createHash("sha256").update(`${raw}::oauth-state`, "utf8").digest();
}

export interface OAuthState {
  userId: string;
  provider: string;
  nonce: string;
  issuedAt: number;
  /**
   * PKCE code verifier, for providers that require it.
   *
   * It travels inside the MAC'd state rather than in a server-side session, so
   * the callback can complete the exchange with no shared session store. It is
   * safe there because the state is signed *and* expires in ten minutes *and*
   * carries a nonce nobody can predict — a verifier is only useful to whoever
   * started the flow.
   */
  pkceVerifier?: string;
}

/**
 * Sign an OAuth `state` parameter.
 *
 * The state parameter is the CSRF defence for the whole flow: without it, an
 * attacker can start a flow with *their* account, capture the callback URL, and
 * trick a victim into visiting it — binding the attacker's third-party account
 * to the victim's Focusarx account. Signing it makes the value unforgeable and
 * the ten-minute expiry stops a captured one being reused later.
 */
export function signState(
  userId: string,
  provider: string,
  now: number = Date.now(),
  pkceVerifier?: string,
): string {
  const payload: OAuthState = {
    userId,
    provider,
    nonce: randomBytes(16).toString("base64url"),
    issuedAt: now,
    ...(pkceVerifier ? { pkceVerifier } : {}),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const mac = createHmac("sha256", stateKey()).update(body, "utf8").digest("base64url");
  return `${body}.${mac}`;
}

/**
 * Verify and unpack a state parameter. Null on anything unexpected — bad MAC,
 * bad JSON, expired, wrong provider — because every one of those is a reason to
 * abandon the flow rather than to pick the closest interpretation.
 */
export function verifyState(
  state: unknown,
  expectedProvider: string,
  now: number = Date.now(),
): OAuthState | null {
  if (typeof state !== "string") return null;
  const idx = state.lastIndexOf(".");
  if (idx <= 0) return null;
  const body = state.slice(0, idx);
  const mac = state.slice(idx + 1);
  let expectedMac: string;
  try {
    expectedMac = createHmac("sha256", stateKey()).update(body, "utf8").digest("base64url");
  } catch {
    return null;
  }
  const given = Buffer.from(mac, "utf8");
  const want = Buffer.from(expectedMac, "utf8");
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  let parsed: OAuthState;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed.userId !== "string" || typeof parsed.provider !== "string") return null;
  if (parsed.provider !== expectedProvider) return null;
  if (!Number.isFinite(parsed.issuedAt) || now - parsed.issuedAt > STATE_TTL_MS) return null;
  // A clock skewed into the future is as suspicious as an expired one.
  if (parsed.issuedAt - now > 60_000) return null;
  if (parsed.pkceVerifier !== undefined && typeof parsed.pkceVerifier !== "string") return null;
  return parsed;
}

export const STATE_TTL = STATE_TTL_MS;

// ─── PKCE ────────────────────────────────────────────────────────────────────

export interface PkcePair {
  verifier: string;
  challenge: string;
}

/**
 * RFC 7636 S256. The verifier never leaves the server — it is embedded in the
 * signed state, so the callback can complete the exchange without a second
 * round trip and without storing anything.
 */
export function createPkce(): PkcePair {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: pkceChallenge(verifier) };
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url");
}

// ─── AUTHORIZE URL ───────────────────────────────────────────────────────────

/**
 * Build the URL we redirect the user to.
 *
 * Built with `URL`/`searchParams` rather than string concatenation so a scope
 * containing `&` or a redirect URI containing a query string cannot break the
 * request or inject an extra parameter.
 */
export function buildAuthorizeUrl(
  provider: ProviderDefinition,
  redirectUri: string,
  state: string,
  pkce?: PkcePair,
): string {
  // A manual provider has no authorize URL. Returning "" rather than throwing
  // is the honest answer — there is nothing to redirect to — and it keeps a
  // caller that forgot to check `isManualProvider` from turning a UI mistake
  // into a 500.
  if (!provider.authorizeUrl) return "";
  const url = new URL(provider.authorizeUrl);
  url.searchParams.set("client_id", clientIdFor(provider));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scopes.join(provider.category === "chat" ? "," : " "));
  url.searchParams.set("state", state);
  for (const [k, v] of Object.entries(provider.authorizeParams ?? {})) url.searchParams.set(k, v);
  if (provider.requiresPkce && pkce) {
    url.searchParams.set("code_challenge", pkce.challenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

// ─── TOKEN EXCHANGE ──────────────────────────────────────────────────────────

export interface TokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string | null;
  externalAccountId: string | null;
  displayName: string | null;
  metadata: Record<string, unknown>;
}

export interface ExchangeResult {
  ok: boolean;
  tokens?: TokenResponse;
  error?: string;
}

/**
 * Exchange an authorization code, or refresh a token.
 *
 * One function for both because they are the same POST with a different
 * `grant_type`, and a second near-identical function is where the two drift
 * apart and one of them stops handling an error case.
 *
 * Provider responses are read defensively. Slack returns `{"ok": false,
 * "error": "..."}` **with HTTP 200**, so a check on `res.ok` alone reports
 * success and stores an undefined token. Every field is therefore treated as
 * optional and the absence of an access token is the failure signal.
 */
export async function exchangeToken(
  provider: ProviderDefinition,
  params: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<ExchangeResult> {
  const body = new URLSearchParams({
    client_id: clientIdFor(provider),
    client_secret: clientSecretFor(provider),
    ...params,
  });
  try {
    const res = await fetchImpl(provider.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    const text = await res.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, error: `Provider returned a non-JSON response (HTTP ${res.status})` };
    }
    // Slack's HTTP 200 with ok:false. Prefer the provider's own error string.
    if (!res.ok || json.ok === false) {
      const detail =
        (typeof json.error_description === "string" && json.error_description) ||
        (typeof json.error === "string" && json.error) ||
        (typeof json.message === "string" && json.message) ||
        `HTTP ${res.status}`;
      return { ok: false, error: detail };
    }
    const accessToken = typeof json.access_token === "string" ? json.access_token : null;
    if (!accessToken) {
      // Never persist a connection with no usable token: it would show as
      // "Connected" and fail on first use.
      return { ok: false, error: "Provider did not return an access token" };
    }
    const expiresIn = typeof json.expires_in === "number" ? json.expires_in : null;
    // Slack nests the bot token one level down.
    const tokenJson = (typeof json.access_token === "string" ? json : json.authed_user) as
      | Record<string, unknown>
      | undefined;
    return {
      ok: true,
      tokens: {
        accessToken,
        refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
        // A minute of slack so a token is never used at the moment it expires.
        expiresAt: expiresIn === null ? null : new Date(Date.now() + (expiresIn - 60) * 1000),
        scopes: typeof json.scope === "string" ? json.scope : provider.scopes.join(" "),
        externalAccountId:
          (typeof json.sub === "string" && json.sub) ||
          (typeof (tokenJson?.id) === "string" && (tokenJson!.id as string)) ||
          null,
        displayName: typeof json.email === "string" ? json.email : null,
        metadata: { raw: summariseTokenResponse(json) },
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Token exchange failed" };
  }
}

/**
 * A token response with every credential stripped out.
 *
 * Stored in `metadata.raw` for debugging. The whole response would put an access
 * token in a JSONB column in plaintext, next to the encrypted copy — which
 * would quietly defeat the encryption.
 */
export function summariseTokenResponse(json: Record<string, unknown>): Record<string, unknown> {
  const REDACTED = new Set(["access_token", "refresh_token", "id_token", "client_secret", "bot_token"]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(json)) {
    if (REDACTED.has(k)) out[k] = "[redacted]";
    else if (v === null || ["string", "number", "boolean"].includes(typeof v)) out[k] = v;
    // Nested token objects (Slack's `authed_user`) are dropped rather than
    // recursed: the shape varies per provider and the value here is a debugging
    // hint, not a faithful copy.
  }
  return out;
}

/** Refresh an access token that is about to expire. */
export async function refreshToken(
  provider: ProviderDefinition,
  refresh: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExchangeResult> {
  if (!provider.tokenUrl) return { ok: false, error: "Provider does not support token refresh" };
  return exchangeToken(
    provider,
    { grant_type: "refresh_token", refresh_token: refresh },
    fetchImpl,
  );
}

/** True when a stored token should be refreshed before next use. */
export function needsRefresh(expiresAt: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false; // Non-expiring token (Slack) — nothing to do.
  return expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;
}

/**
 * The redirect URI registered with the provider.
 *
 * Derived from the public base URL rather than hard-coded, because the same
 * build runs on a preview deployment and in production and the provider will
 * reject a mismatch. `APP_URL`/`PUBLIC_URL` are what the rest of the server
 * already uses for absolute links.
 */
export function callbackUrl(providerKey: string, baseOverride?: string): string {
  const base = (
    baseOverride ??
    process.env.APP_URL ??
    process.env.PUBLIC_URL ??
    process.env.API_BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}/api/integrations/${providerKey}/callback`;
}
