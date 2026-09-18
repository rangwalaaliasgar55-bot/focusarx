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
