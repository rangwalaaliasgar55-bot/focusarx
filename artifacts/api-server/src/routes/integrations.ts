/**
 * §1.6 — OAuth integration routes.
 *
 * A single provider-agnostic flow, driven by the registry:
 *
 *   GET    /integrations                    what exists, what is connected, what is configured
 *   POST   /integrations/:provider/connect   → { authorizeUrl } for the client to open
 *   GET    /integrations/:provider/callback  provider redirect target (no bearer token)
 *   POST   /integrations/:provider/refresh   refresh an expiring token
 *   DELETE /integrations/:provider           revoke and forget
 *
 * The callback is the awkward one: the browser arrives from Google or Slack
 * with a `code`, **not** our Authorization header, so it cannot be behind
 * `authMiddleware`. Authentication comes from the signed `state` instead —
 * which is exactly why the state exists and why it carries the user id. Any
 * change that reads a user id from this route without verifying the state first
 * is an account-takeover primitive.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { integrationConnectionsTable } from "@workspace/db/schema";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import {
  buildAuthorizeUrl,
  callbackUrl,
  clientIdFor,
  createPkce,
  exchangeToken,
  getProvider,
  isManualProvider,
  needsRefresh,
  providerConfigured,
  providerView,
  PROVIDERS,
  refreshToken,
  signState,
  verifyState,
} from "../lib/integrations";
import { encryptSecret, decryptSecret, secretsConfigured } from "../lib/secrets";
import { auditLog } from "../lib/auditLog";
import { logger } from "../lib/logger";

export const integrationsRouter = Router();

/**
 * Express types a path param as `string | string[]` when a route could match
 * more than one segment. Coercing here keeps every `getProvider` call honest —
 * an array reaching the registry lookup would miss and read as "unknown
 * provider", which is a confusing way to report a routing mistake.
 */
function providerParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

/**
 * Where the provider sends the user back to.
 *
 * The profile page, anchored to the connections section — the integration UI
 * lives there rather than on a page of its own, so redirecting to a dedicated
 * `/settings/integrations` route would mean either a second copy of the same
 * component or a route that exists only to be redirected through. The hash
 * scrolls the existing section into view.
 */
const DONE_PATH = "/profile";

function redirectBack(res: Response, params: Record<string, string>): void {
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const query = new URLSearchParams(params).toString();
  // The hash comes after the query, per URL syntax — reversing them sends the
  // params to the client as part of the fragment, where `searchParams` cannot
  // read them and the toast never fires.
  const target = `${DONE_PATH}?${query}#integrations`;
  // A relative Location when we do not know our public origin: browsers resolve
  // it against the request, which is correct on any domain including previews.
  res.redirect(base ? `${base}${target}` : target);
}

function shapeConnection(row: typeof integrationConnectionsTable.$inferSelect) {
  return {
    id: row.id,
    provider: row.provider,
    externalAccountId: row.externalAccountId,
    displayName: row.displayName,
    scopes: row.scopes ? row.scopes.split(" ").filter(Boolean) : [],
    status: row.status,
    lastError: row.lastError,
    lastSyncedAt: row.lastSyncedAt,
    expiresAt: row.expiresAt,
    hasRefreshToken: Boolean(row.refreshTokenEnc),
    createdAt: row.createdAt,
    // Manual connections need their own affordances in the UI (Test, and the
    // honest note about storage), so the flag travels with the connection.
    manual: Boolean((row.metadata as Record<string, unknown> | null)?.manual),
    manualKind: ((row.metadata as Record<string, unknown> | null)?.kind as string | undefined) ?? null,
    plaintextStorage: Boolean((row.metadata as Record<string, unknown> | null)?.plaintextStorage),
  };
}

// ─── LIST ────────────────────────────────────────────────────────────────────

integrationsRouter.get("/integrations", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const rows = await db
      .select()
      .from(integrationConnectionsTable)
      .where(eq(integrationConnectionsTable.userId, userId))
      .orderBy(desc(integrationConnectionsTable.createdAt));
    const byProvider = new Map(rows.map((r) => [r.provider, r]));

    res.json({
      providers: PROVIDERS.map((p) => {
        const connection = byProvider.get(p.key);
        return {
          ...providerView(p),
          connection: connection ? shapeConnection(connection) : null,
        };
      }),
      encryptionReady: secretsConfigured(),
    });
  } catch (err) {
    logger.error({ err }, "integrations: list failed");
    res.status(500).json({ error: "Could not load integrations" });
  }
});

// ─── CONNECT ─────────────────────────────────────────────────────────────────

/**
 * Begin the flow.
 *
 * Returns the authorize URL rather than redirecting, so the client can open it
 * in a popup and keep the user's place in the app. The checks all happen here,
 * *before* the user is sent to a consent screen: telling someone their account
 * is missing a client secret after they have granted calendar access wastes the
 * one thing this flow spends — their trust.
 */
integrationsRouter.post("/integrations/:provider/connect", authMiddleware, async (req: AuthRequest, res: Response) => {
  const provider = getProvider(providerParam(req.params.provider));
  if (!provider) return res.status(404).json({ error: "Unknown provider", code: "UNKNOWN_PROVIDER" });
  if (isManualProvider(provider)) {
    return res.status(400).json({
      error: `${provider.name} is imported from a file rather than connected`,
      code: "MANUAL_PROVIDER",
    });
  }
  if (!providerConfigured(provider)) {
    return res.status(503).json({ error: "This integration is not available yet", code: "PROVIDER_NOT_CONFIGURED" });
  }
  if (!secretsConfigured()) {
    return res.status(503).json({ error: "This integration is not available yet", code: "SECRETS_NOT_CONFIGURED" });
  }

  try {
    const pkce = provider.requiresPkce ? createPkce() : undefined;
    // The verifier travels inside the signed state so the callback needs no
    // server-side session. It is a secret, and the state is MAC'd — but it is
    // also short-lived and single-use by construction, which is what PKCE wants.
    const state = signState(req.userId, provider.key, Date.now(), pkce?.verifier);
    const url = buildAuthorizeUrl(provider, callbackUrl(provider.key), state, pkce);
    res.json({ authorizeUrl: url, provider: provider.key, scopes: provider.scopes });
  } catch (err) {
    logger.error({ err }, "integrations: connect failed");
    res.status(500).json({ error: "Could not start the connection" });
  }
});

// ─── MANUAL / LINK-BASED CONNECT ─────────────────────────────────────────────
/**
 * Connect an app without an OAuth app registration.
 *
 * The OAuth path needs a client id and secret from a provider console, so on a
 * fresh deployment every Connect button is disabled — which is honest but
 * useless to someone who just wants their calendar or a Slack ping wired up.
 * Almost every provider people actually ask for has a credential-free door:
 *
 *  - **calendar_feed** — a private iCal/ICS URL. We fetch it and require a real
 *    calendar document before saving, so a wrong link fails here rather than
 *    silently syncing nothing.
 *  - **webhook** — a Slack/Discord/Zapier incoming-webhook URL. We POST a test
 *    message and require a 2xx, which proves the URL end-to-end at connect time.
 *  - **api_key** — a provider token we cannot validate without their API; it is
 *    stored and marked unverified rather than pretending a check happened.
 *
 * Storage rule: with `INTEGRATION_ENCRYPTION_KEY` set, the credential is
 * AES-256-GCM ciphertext like every other secret. Without it we still store the
 * credential (this is the whole point of the feature) but flag
 * `plaintextStorage` in metadata, the connection card says so out loud, and
 * setting the key is the one-line fix.
 */
const manualConnectSchema = z.object({
  kind: z.enum(["calendar_feed", "webhook", "api_key"]),
  value: z.string().trim().min(8).max(2000),
  label: z.string().trim().max(60).optional().default(""),
});

const VERIFY_TIMEOUT_MS = 8_000;

function httpsOnly(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Fetch the URL and confirm it is a calendar document, not a 200 HTML page. */
async function verifyCalendarFeed(raw: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const url = httpsOnly(raw);
  if (!url) return { ok: false, reason: "Calendar feeds must be an https:// link" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow", headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5" } });
    if (!res.ok) return { ok: false, reason: `The feed answered ${res.status}` };
    const body = (await res.text()).slice(0, 4096);
    if (!/BEGIN:VCALENDAR/i.test(body)) {
      return { ok: false, reason: "That link is reachable but is not an iCal/ICS calendar (no BEGIN:VCALENDAR)" };
    }
    return { ok: true };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { ok: false, reason: aborted ? "The feed took too long to answer" : "Could not reach that link" };
  } finally {
    clearTimeout(timer);
  }
}

/** POST a test message. Slack wants `text`, Discord wants `content` — send both. */
async function verifyWebhook(raw: string, providerName: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const url = httpsOnly(raw);
  if (!url) return { ok: false, reason: "Webhook URLs must be https://" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `FocusArx connected ✅ — ${providerName} will get your focus summaries here.`,
        content: `FocusArx connected ✅ — ${providerName} will get your focus summaries here.`,
      }),
    });
    if (!res.ok) return { ok: false, reason: `The webhook answered ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: "The webhook did not accept the test message" };
  } finally {
    clearTimeout(timer);
  }
}

/** Run the right verification for the credential kind. */
async function verifyManualCredential(
  kind: "calendar_feed" | "webhook" | "api_key",
  value: string,
  providerName: string,
): Promise<{ ok: true; verified: boolean } | { ok: false; reason: string }> {
  if (kind === "calendar_feed") {
    const result = await verifyCalendarFeed(value);
    return result.ok ? { ok: true, verified: true } : result;
  }
  if (kind === "webhook") {
    const result = await verifyWebhook(value, providerName);
    return result.ok ? { ok: true, verified: true } : result;
  }
  // api_key: format only. Claiming to have verified it would be a lie.
  return { ok: true, verified: false };
}

integrationsRouter.post("/integrations/:provider/manual-connect", authMiddleware, async (req: AuthRequest, res: Response) => {
  const provider = getProvider(providerParam(req.params.provider));
  if (!provider) return res.status(404).json({ error: "Unknown provider", code: "UNKNOWN_PROVIDER" });

  const parsed = manualConnectSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Provide a link or token to connect", code: "INVALID_INPUT" });
  const { kind, value, label } = parsed.data;

  const check = await verifyManualCredential(kind, value, provider.name);
  if (!check.ok) return res.status(400).json({ error: check.reason, code: "VERIFICATION_FAILED" });

  try {
    const encrypted = secretsConfigured();
    const metadata: Record<string, unknown> = {
      manual: true,
      kind,
      label: label || (kind === "calendar_feed" ? "Calendar feed" : kind === "webhook" ? "Incoming webhook" : "API key"),
      verifiedAt: check.verified ? new Date().toISOString() : null,
      verified: check.verified,
      plaintextStorage: !encrypted,
      // Without an encryption key we keep the credential here, flagged, so the
      // connection actually works instead of failing at the last step.
      ...(encrypted ? {} : { secret: value }),
    };

    const values = {
      userId: req.userId!,
      provider: provider.key,
      externalAccountId: label || provider.key,
      displayName: label || provider.name,
      accessTokenEnc: encrypted ? encryptSecret(value) : null,
      refreshTokenEnc: null,
      scopes: kind === "calendar_feed" ? "calendar.read" : "notify.write",
      expiresAt: null,
      status: "active" as const,
      lastError: null,
      lastSyncedAt: check.verified ? new Date() : null,
      metadata,
      updatedAt: new Date(),
    };

    await db
      .insert(integrationConnectionsTable)
      .values(values)
      .onConflictDoUpdate({
        target: [integrationConnectionsTable.userId, integrationConnectionsTable.provider],
        set: values,
      });

    await auditLog({
      action: "integration_manual_connected",
      userId: req.userId,
      ip: req.ip,
      details: { provider: provider.key, kind, verified: check.verified, encrypted },
    });

    res.json({
      ok: true,
      provider: provider.key,
      kind,
      verified: check.verified,
      encrypted,
      note: encrypted
        ? "Saved and encrypted."
        : "Saved. Set INTEGRATION_ENCRYPTION_KEY to store this credential encrypted.",
    });
  } catch (err) {
    logger.error({ err }, "integrations: manual connect failed");
    res.status(500).json({ error: "Could not save the connection" });
  }
});

/**
 * Re-run the verification for an existing manual connection and record the
 * outcome on the row — the same "does it still work?" question the OAuth
 * connections answer through their refresh path.
 */
integrationsRouter.post("/integrations/:provider/test", authMiddleware, async (req: AuthRequest, res: Response) => {
  const provider = getProvider(providerParam(req.params.provider));
  if (!provider) return res.status(404).json({ error: "Unknown provider", code: "UNKNOWN_PROVIDER" });

  try {
    const [row] = await db.select().from(integrationConnectionsTable)
      .where(and(eq(integrationConnectionsTable.userId, req.userId!), eq(integrationConnectionsTable.provider, provider.key)))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Not connected", code: "NOT_CONNECTED" });

    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    if (!metadata.manual) {
      return res.status(400).json({ error: "Only manually connected apps can be tested from here", code: "NOT_MANUAL" });
    }
    const kind = metadata.kind as "calendar_feed" | "webhook" | "api_key" | undefined;
    let credential: string | null = null;
    if (row.accessTokenEnc && secretsConfigured()) {
      try { credential = decryptSecret(row.accessTokenEnc); } catch { credential = null; }
    } else if (typeof metadata.secret === "string") {
      credential = metadata.secret;
    }
    if (!kind || !credential) return res.status(400).json({ error: "No stored credential to test", code: "NO_CREDENTIAL" });

    const check = await verifyManualCredential(kind, credential, provider.name);
    await db.update(integrationConnectionsTable)
      .set({
        status: check.ok ? "active" : "error",
        lastError: check.ok ? null : check.reason,
        lastSyncedAt: check.ok ? new Date() : row.lastSyncedAt,
        metadata: { ...metadata, verified: check.ok, verifiedAt: check.ok ? new Date().toISOString() : metadata.verifiedAt },
        updatedAt: new Date(),
      })
      .where(eq(integrationConnectionsTable.id, row.id));

    if (!check.ok) return res.status(400).json({ error: check.reason, code: "VERIFICATION_FAILED" });
    res.json({ ok: true, verified: kind !== "api_key" });
  } catch (err) {
    logger.error({ err }, "integrations: test failed");
    res.status(500).json({ error: "Could not test the connection" });
  }
});

// ─── CALLBACK ────────────────────────────────────────────────────────────────

/**
 * Provider redirect target.
 *
 * No `authMiddleware`: the browser is arriving from a third-party origin and
 * has no bearer token. The signed state is the authentication, and the user id
 * comes from it, never from a parameter or a header. Errors redirect to the
 * settings page with a code rather than rendering JSON — a user in a popup
 * staring at `{"error":"invalid_state"}` has no way to act on it.
 */
integrationsRouter.get("/integrations/:provider/callback", async (req: Request, res: Response) => {
  const provider = getProvider(providerParam(req.params.provider));
  if (!provider) return redirectBack(res, { integration: "error", reason: "unknown_provider" });

  // The user pressed "Deny" on the consent screen. Not an error to alarm them
  // with — a decision, reported as one.
  if (typeof req.query.error === "string") {
    return redirectBack(res, { integration: "denied", reason: req.query.error });
  }

  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = verifyState(req.query.state, provider.key);
  if (!state) {
    // Bad MAC, expired, or minted for another provider. All the same to the
    // user, and all the same to us: do not proceed, and do not say which.
    return redirectBack(res, { integration: "error", reason: "invalid_state" });
  }
  if (!code) return redirectBack(res, { integration: "error", reason: "missing_code" });
  if (!providerConfigured(provider) || !secretsConfigured()) {
    return redirectBack(res, { integration: "error", reason: "not_configured" });
  }

  try {
    const verifier = state.pkceVerifier;
    const result = await exchangeToken(provider, {
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl(provider.key),
      ...(provider.requiresPkce && verifier ? { code_verifier: verifier } : {}),
    });
    if (!result.ok || !result.tokens) {
      logger.warn({ provider: provider.key, error: result.error }, "integrations: token exchange failed");
      return redirectBack(res, { integration: "error", reason: "exchange_failed" });
    }

    const tokens = result.tokens;
    const values = {
      userId: state.userId,
      provider: provider.key,
      externalAccountId: tokens.externalAccountId,
      displayName: tokens.displayName,
      accessTokenEnc: encryptSecret(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
      scopes: tokens.scopes,
      expiresAt: tokens.expiresAt,
      status: "active" as const,
      lastError: null,
      metadata: tokens.metadata,
      updatedAt: new Date(),
    };

    // Reconnecting replaces the grant. A second row would leave the old token
    // in the table, still valid at the provider, invisible in the UI.
    await db
      .insert(integrationConnectionsTable)
      .values(values)
      .onConflictDoUpdate({
        target: [integrationConnectionsTable.userId, integrationConnectionsTable.provider],
        set: values,
      });

    await auditLog({
      action: "integration_connected",
      userId: state.userId,
      ip: req.ip,
      details: { provider: provider.key, scopes: tokens.scopes },
    });

    return redirectBack(res, { integration: "connected", provider: provider.key });
  } catch (err) {
    logger.error({ err, provider: provider.key }, "integrations: callback failed");
    return redirectBack(res, { integration: "error", reason: "server_error" });
  }
});

// ─── REFRESH ─────────────────────────────────────────────────────────────────

integrationsRouter.post("/integrations/:provider/refresh", authMiddleware, async (req: AuthRequest, res: Response) => {
  const provider = getProvider(providerParam(req.params.provider));
  if (!provider) return res.status(404).json({ error: "Unknown provider", code: "UNKNOWN_PROVIDER" });
  if (!secretsConfigured()) {
    return res.status(503).json({ error: "This integration is not available yet", code: "SECRETS_NOT_CONFIGURED" });
  }

  try {
    const [row] = await db
      .select()
      .from(integrationConnectionsTable)
      .where(
        and(
          eq(integrationConnectionsTable.userId, req.userId),
          eq(integrationConnectionsTable.provider, provider.key),
        ),
      )
      .limit(1);
    if (!row) return res.status(404).json({ error: "Not connected", code: "NOT_CONNECTED" });
    if (!row.refreshTokenEnc) {
      return res.status(409).json({ error: "This connection cannot be refreshed — reconnect it", code: "NO_REFRESH_TOKEN" });
    }

    let refresh: string;
    try {
      refresh = decryptSecret(row.refreshTokenEnc);
    } catch (err) {
      // The stored token is unreadable, which usually means the encryption key
      // changed. The connection is unusable and the user has to reconnect.
      await db
        .update(integrationConnectionsTable)
        .set({ status: "error", lastError: "Stored credentials could not be read", updatedAt: new Date() })
        .where(eq(integrationConnectionsTable.id, row.id));
      logger.error({ err, provider: provider.key }, "integrations: stored refresh token unreadable");
      return res.status(409).json({ error: "Reconnect this integration", code: "CREDENTIALS_UNREADABLE" });
    }

    const result = await refreshToken(provider, refresh);
    if (!result.ok || !result.tokens) {
      await db
        .update(integrationConnectionsTable)
        .set({
          status: "expired",
          lastError: result.error ?? "Refresh failed",
          updatedAt: new Date(),
        })
        .where(eq(integrationConnectionsTable.id, row.id));
      return res.status(502).json({ error: result.error ?? "Could not refresh", code: "REFRESH_FAILED" });
    }

    const tokens = result.tokens;
    await db
      .update(integrationConnectionsTable)
      .set({
        accessTokenEnc: encryptSecret(tokens.accessToken),
        // Providers often omit the refresh token on refresh, meaning "keep
        // using the one you have". Overwriting with null would break the
        // connection on its *next* refresh.
        refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : row.refreshTokenEnc,
        expiresAt: tokens.expiresAt,
        status: "active",
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(integrationConnectionsTable.id, row.id));

    res.json({ ok: true, expiresAt: tokens.expiresAt });
  } catch (err) {
    logger.error({ err }, "integrations: refresh failed");
    res.status(500).json({ error: "Could not refresh the integration" });
  }
});

// ─── DISCONNECT ──────────────────────────────────────────────────────────────

/**
 * Forget the connection.
 *
 * Deletes the row, which deletes the tokens with it. Revocation at the provider
 * is left to the user, with `revokeUrl` in the provider view — calling a
 * provider's revoke endpoint from here would need a second set of credentials
 * and a network call that can fail, and "Connections at Google" is one click
 * away for anyone who wants the grant gone on the far side too.
 */
integrationsRouter.delete("/integrations/:provider", authMiddleware, async (req: AuthRequest, res: Response) => {
  const provider = getProvider(providerParam(req.params.provider));
  if (!provider) return res.status(404).json({ error: "Unknown provider", code: "UNKNOWN_PROVIDER" });
  try {
    const deleted = await db
      .delete(integrationConnectionsTable)
      .where(
        and(
          eq(integrationConnectionsTable.userId, req.userId),
          eq(integrationConnectionsTable.provider, provider.key),
        ),
      )
      .returning({ id: integrationConnectionsTable.id });
    if (deleted.length === 0) return res.status(404).json({ error: "Not connected", code: "NOT_CONNECTED" });

    await auditLog({
      action: "integration_disconnected",
      userId: req.userId,
      ip: req.ip,
      details: { provider: provider.key },
    });
    res.json({ disconnected: true, provider: provider.key, revokeUrl: provider.revokeUrl ?? null });
  } catch (err) {
    logger.error({ err }, "integrations: disconnect failed");
    res.status(500).json({ error: "Could not disconnect" });
  }
});

/**
 * Send the user to the provider to revoke the grant on their side.
 *
 * Kept server-side so the URL comes from the registry rather than being
 * hard-coded in a client, where it would drift.
 */
integrationsRouter.get("/integrations/:provider/revoke-url", authMiddleware, (req: AuthRequest, res: Response) => {
  const provider = getProvider(providerParam(req.params.provider));
  if (!provider) return res.status(404).json({ error: "Unknown provider", code: "UNKNOWN_PROVIDER" });
  res.json({ revokeUrl: provider.revokeUrl ?? null, clientIdConfigured: Boolean(clientIdFor(provider)) });
});

/** Access-token state for a connected provider, without revealing the token. */
integrationsRouter.get("/integrations/:provider/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  const provider = getProvider(providerParam(req.params.provider));
  if (!provider) return res.status(404).json({ error: "Unknown provider", code: "UNKNOWN_PROVIDER" });
  try {
    const [row] = await db
      .select()
      .from(integrationConnectionsTable)
      .where(
        and(
          eq(integrationConnectionsTable.userId, req.userId),
          eq(integrationConnectionsTable.provider, provider.key),
        ),
      )
      .limit(1);
    if (!row) return res.json({ connected: false });
    res.json({
      connected: true,
      connection: shapeConnection(row),
      // What the UI needs to decide whether to show a "Reconnect" prompt.
      expired: needsRefresh(row.expiresAt),
      canRefresh: Boolean(row.refreshTokenEnc),
    });
  } catch (err) {
    logger.error({ err }, "integrations: status failed");
    res.status(500).json({ error: "Could not load the connection" });
  }
});
