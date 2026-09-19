import { useEffect, useState } from "react";
import { apiJson, errorMessage } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QueryError } from "@/components/ui/QueryError";

/**
 * §1.6 — connected apps and outbound webhooks.
 *
 * Information design, in the order the user needs it:
 *
 *  1. **What is connected, and whether it still works.** A connection that
 *     silently stopped refreshing is the failure mode that matters — the user
 *     must not have to guess. `status` and `lastError` come from the server and
 *     are shown, not summarised into a green dot.
 *  2. **What connecting grants.** The scopes are listed before the button, not
 *     after the consent screen. Asking someone to approve access they have not
 *     seen is how integration UIs earn distrust.
 *  3. **Why something is unavailable.** A disabled button with a reason, not a
 *     button that fails after a round trip through Google's consent screen.
 *
 * Webhook secrets follow the one rule that makes signing meaningful: shown once
 * at creation, never retrievable afterwards, with the hint kept for matching.
 */

interface Notice {
  kind: string;
  provider: string | null;
  reason: string | null;
}

interface ProviderConnection {
  id: string;
  provider: string;
  externalAccountId: string | null;
  displayName: string | null;
  scopes: string[];
  status: string;
  lastError: string | null;
  lastSyncedAt: string | null;
  expiresAt: string | null;
  hasRefreshToken: boolean;
  /** True for link/webhook/key connections rather than an OAuth grant. */
  manual?: boolean;
  manualKind?: string | null;
  /** Credential stored without INTEGRATION_ENCRYPTION_KEY — shown as a warning. */
  plaintextStorage?: boolean;
}

interface Provider {
  key: string;
  name: string;
  description: string;
  category: string;
  scopes: string[];
  configured: boolean;
  manual: boolean;
  /** Credential-free connect options this provider supports (server-declared). */
  manualKinds?: Array<"calendar_feed" | "webhook" | "api_key">;
  revokeUrl?: string;
  unavailableReason?: string;
  connection: ProviderConnection | null;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  active: boolean;
  secretHint: string;
  failureCount: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  disabledReason: string | null;
}

/**
 * What each outcome says.
 *
 * A denial is not an error, so it does not read like one. A failure names the
 * step that failed, because "exchange_failed" and "invalid_state" call for
 * different user actions — one is "try again", the other is "start over".
 */
const NOTICE_COPY: Record<string, { title: string; detail: string }> = {
  connected: { title: "Connected", detail: "Future events will be sent automatically." },
  denied: {
    title: "Connection cancelled",
    detail: "You declined access, and nothing on your account was changed.",
  },
  invalid_state: {
    title: "That link expired",
    detail: "For your security the connection link is only valid for ten minutes. Start again from here.",
  },
  exchange_failed: {
    title: "Could not finish connecting",
    detail: "The provider rejected the authorization. Start again, and check that you approved every requested permission.",
  },
  not_configured: {
    title: "Not available yet",
    detail: "This integration is not enabled on this deployment.",
  },
  missing_code: {
    title: "Could not finish connecting",
    detail: "The provider did not return an authorization code. Start again from here.",
  },
  unknown_provider: {
    title: "Unknown integration",
    detail: "The provider in that link is not one we support.",
  },
  server_error: {
    title: "Could not finish connecting",
    detail: "Something went wrong on our side. Try again in a moment.",
  },
};

/**
 * Pick the copy for an outcome.
 *
 * `connected` and `denied` are outcomes in their own right and carry no reason;
 * every other kind is a failure that does carry one. Keying off `reason` alone
 * sent a denial to the generic fallback and lost the sentence that explains it.
 */
function noticeFor(notice: Notice): { title: string; detail: string } {
  if (notice.kind === "connected") {
    const name = notice.provider ? notice.provider.replace(/_/g, " ") : "the integration";
    return { title: `Connected to ${name}`, detail: NOTICE_COPY.connected!.detail };
  }
  const key = notice.kind === "denied" ? "denied" : (notice.reason ?? "");
  return (
    NOTICE_COPY[key] ?? {
      title: "Could not finish connecting",
      detail: "Nothing on your account was changed. You can try again from here.",
    }
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  calendar: "Calendar",
  chat: "Team chat",
  health: "Health",
  tasks: "Tasks",
};

/** "3 minutes ago" beats a timestamp for the one question this answers: is it
 * still working? Falls back to the date for anything older than a week. */
function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "never";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Date(iso).toLocaleDateString();
}

export function IntegrationSettings() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [available, setAvailable] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  /* Link-based connect: which provider's form is open, its kind and the value. */
  const [manualFor, setManualFor] = useState<string | null>(null);
  const [manualKind, setManualKind] = useState<"calendar_feed" | "webhook" | "api_key">("webhook");
  const [manualValue, setManualValue] = useState("");
  const [manualNote, setManualNote] = useState<string | null>(null);

  /**
   * The outcome of an OAuth round trip, read from the URL the provider sent the
   * user back to.
   *
   * Rendered as a dismissible notice rather than a toast, for three reasons: the
   * page has just reloaded, so a toast competes with the first paint; an error
   * needs to stay on screen long enough to read and act on; and a toast that has
   * already faded leaves no trace of *why* a connection the user just approved
   * is not there. Read once, into state, so it survives a re-render.
   */
  const [notice, setNotice] = useState<Notice | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const kind = params.get("integration");
    if (!kind) return null;
    return { kind, provider: params.get("provider"), reason: params.get("reason") };
  });

  // Clearing the query string is a side effect on the browser's history, not a
  // state update: without it a refresh re-announces a stale result, and a
  // bookmark of the page would carry someone else's outcome.
  useEffect(() => {
    if (!notice || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    for (const key of ["integration", "provider", "reason"]) url.searchParams.delete(key);
    window.history.replaceState({}, "", url.toString());
  }, [notice]);

  /**
   * Load both panels in one round trip.
   *
   * An async function defined inside the effect, with a cancellation flag:
   * every state update happens after an `await`, so nothing renders
   * synchronously into the effect's commit, and a reload that supersedes an
   * in-flight request cannot have its older response applied over the newer
   * one. The single `Promise.all` is deliberate — the two panels are useless
   * apart, so a failure is one failure and there is no half-loaded state.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [integrations, hooks] = await Promise.all([
          apiJson<{ providers: Provider[] }>("/api/integrations"),
          apiJson<{ endpoints: WebhookEndpoint[]; available: boolean }>("/api/webhooks"),
        ]);
        if (cancelled) return;
        setProviders(integrations.providers);
        setEndpoints(hooks.endpoints);
        setAvailable(hooks.available);
        // Cleared after the request resolves, not before it starts. Clearing at
        // the top renders a frame that is neither "failed" nor "loading", which
        // reads as a flash of "you have no connections".
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(errorMessage(err, "Could not load your connections."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function connect(provider: Provider) {
    setBusy(provider.key);
    try {
      const { authorizeUrl } = await apiJson<{ authorizeUrl: string }>(
        `/api/integrations/${provider.key}/connect`,
        { method: "POST" },
      );
      // A full-page navigation rather than window.open: popup blockers reject a
      // window opened after an await, and the callback redirects back here.
      window.location.href = authorizeUrl;
    } catch (err) {
      toast(errorMessage(err, `Could not connect ${provider.name}.`), "error");
      setBusy(null);
    }
  }

  /**
   * Connect without OAuth: a calendar feed, an incoming webhook, or an API key.
   *
   * The server verifies before saving — a calendar link must return a real
   * iCalendar document, a webhook must accept a test message — so "Connected"
   * here means something was actually reached, not that a form was submitted.
   */
  async function manualConnect(provider: Provider) {
    if (!manualValue.trim()) return;
    setBusy(provider.key);
    setManualNote(null);
    try {
      const result = await apiJson<{ verified: boolean; encrypted: boolean; note: string }>(
        `/api/integrations/${provider.key}/manual-connect`,
        { method: "POST", body: JSON.stringify({ kind: manualKind, value: manualValue.trim() }) },
      );
      toast(`${provider.name} connected. ${result.note}`, "success");
      setManualFor(null);
      setManualValue("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setManualNote(errorMessage(err, "Could not connect that link."));
    } finally {
      setBusy(null);
    }
  }

  async function testConnection(provider: Provider) {
    setBusy(provider.key);
    try {
      const result = await apiJson<{ verified: boolean }>(`/api/integrations/${provider.key}/test`, { method: "POST" });
      toast(result.verified ? `${provider.name} still works.` : `${provider.name} saved (no live check available for API keys).`, "success");
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(errorMessage(err, `${provider.name} did not respond.`), "error");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(provider: Provider) {
    setBusy(provider.key);
    try {
      const result = await apiJson<{ revokeUrl: string | null }>(
        `/api/integrations/${provider.key}`,
        { method: "DELETE" },
      );
      toast(`${provider.name} disconnected.`, "success");
      setReloadKey((k) => k + 1);
      // The grant is gone on our side; the token may still be live at the
      // provider, so point at where to finish the job rather than implying the
      // access is fully revoked.
      if (result.revokeUrl && typeof window !== "undefined") {
        toast(`To revoke access at ${provider.name} too, visit their connected-apps page.`, "info");
      }
    } catch (err) {
      toast(errorMessage(err, `Could not disconnect ${provider.name}.`), "error");
    } finally {
      setBusy(null);
    }
  }

  async function testEndpoint(endpoint: WebhookEndpoint) {
    setBusy(endpoint.id);
    try {
      const result = await apiJson<{ ok: boolean; status: number | null; durationMs: number; error: string | null }>(
        `/api/webhooks/${endpoint.id}/test`,
        { method: "POST" },
      );
      if (result.ok) {
        toast(`Delivered in ${result.durationMs}ms (HTTP ${result.status}).`, "success");
      } else {
        toast(`Delivery failed: ${result.error ?? "no response"}`, "error");
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(errorMessage(err, "Could not send the test delivery."), "error");
    } finally {
      setBusy(null);
    }
  }

  async function removeEndpoint(endpoint: WebhookEndpoint) {
    setBusy(endpoint.id);
    try {
      await apiJson(`/api/webhooks/${endpoint.id}`, { method: "DELETE" });
      toast("Webhook deleted.", "success");
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(errorMessage(err, "Could not delete the webhook."), "error");
    } finally {
      setBusy(null);
    }
  }

  async function toggleEndpoint(endpoint: WebhookEndpoint) {
    setBusy(endpoint.id);
    try {
      await apiJson(`/api/webhooks/${endpoint.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !endpoint.active }),
      });
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(errorMessage(err, "Could not update the webhook."), "error");
    } finally {
      setBusy(null);
    }
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <QueryError what="your connections" onRetry={() => setReloadKey((k) => k + 1)} />
          {/* The specific reason, under the shared block. QueryError is
              deliberately generic so it reads the same everywhere; the server's
              message is what tells the user whether retrying is worth it. */}
          <p className="text-center text-xs text-muted-foreground">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  const noticeCopy = notice ? noticeFor(notice) : null;

  return (
    <div className="space-y-6">
      {noticeCopy ? (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-[var(--surface-raised)] p-4"
          data-testid="integration-notice"
        >
          <div>
            <p className="text-sm font-medium">{noticeCopy.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{noticeCopy.detail}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Connected apps</CardTitle>
          <CardDescription>
            Send your focus sessions where you already work. Disconnecting removes our copy of the access token
            immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            providers.map((provider) => {
              const connection = provider.connection;
              const broken = connection && connection.status !== "active";
              return (
                <div
                  key={provider.key}
                  className="rounded-lg border border-border p-4"
                  data-testid={`provider-${provider.key}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{provider.name}</span>
                        <Badge variant="secondary">{CATEGORY_LABELS[provider.category] ?? provider.category}</Badge>
                        {connection ? (
                          <Badge variant={broken ? "error" : "success"}>
                            {broken ? connection.status : "Connected"}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{provider.description}</p>

                      {/* The reason a connection is broken, in the server's own
                          words. A green dot with no detail would hide the one
                          thing the user needs to act on. */}
                      {broken && connection?.lastError ? (
                        <p className="mt-2 text-sm text-destructive">{connection.lastError}</p>
                      ) : null}

                      {connection ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {connection.displayName ?? connection.externalAccountId ?? "Connected account"}
                          {connection.expiresAt ? ` · token expires ${relativeTime(connection.expiresAt)}` : ""}
                          {connection.lastSyncedAt ? ` · last used ${relativeTime(connection.lastSyncedAt)}` : ""}
                        </p>
                      ) : null}

                      {/* Scopes before the button, never after the consent screen. */}
                      {!connection && provider.scopes.length > 0 ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted-foreground">
                            Access requested ({provider.scopes.length})
                          </summary>
                          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            {provider.scopes.map((scope) => (
                              <li key={scope} className="font-mono break-all">
                                {scope}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}

                      {!provider.configured && provider.unavailableReason ? (
                        <p className="mt-2 text-xs text-muted-foreground">{provider.unavailableReason}</p>
                      ) : null}
                      {connection?.manual && connection.plaintextStorage ? (
                        <p className="mt-2 text-xs text-[var(--palette-amber-400)]">
                          ⚠️ Connected, but this credential is stored unencrypted — set INTEGRATION_ENCRYPTION_KEY on the server to encrypt it.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      {provider.manual ? (
                        <span className="text-xs text-muted-foreground">Imported from a file</span>
                      ) : connection ? (
                        <>
                          {/* A manual connection is re-checkable: proving it still
                              works is the whole reason the card shows a status. */}
                          {connection.manual && (
                            <Button variant="ghost" size="sm" disabled={busy === provider.key} onClick={() => void testConnection(provider)}>
                              Test
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy === provider.key}
                            onClick={() => void disconnect(provider)}
                          >
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            disabled={!provider.configured || busy === provider.key}
                            onClick={() => void connect(provider)}
                          >
                            {busy === provider.key ? "Opening…" : "Connect"}
                          </Button>
                          {/* The fallback door. Shown whenever OAuth is unavailable,
                              so an unconfigured deploy still has a working path. */}
                          {(provider.manualKinds?.length ?? 0) > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy === provider.key}
                              onClick={() => {
                                setManualFor(manualFor === provider.key ? null : provider.key);
                                setManualKind(provider.manualKinds?.[0] ?? "webhook");
                                setManualValue("");
                                setManualNote(null);
                              }}
                            >
                              {manualFor === provider.key ? "Cancel" : "Connect with a link"}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {manualFor === provider.key && (
                    <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-hover)]/40 p-3">
                      <p className="text-xs font-semibold">Connect {provider.name} without app registration</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {([
                          { id: "calendar_feed" as const, label: "Calendar (iCal) link" },
                          { id: "webhook" as const, label: "Incoming webhook" },
                          { id: "api_key" as const, label: "API key" },
                        ]).filter((option) => (provider.manualKinds ?? ["webhook"]).includes(option.id)).map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={manualKind === option.id}
                            onClick={() => setManualKind(option.id)}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                              manualKind === option.id
                                ? "border-[var(--brand-strong)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                                : "border-[var(--border-subtle)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <label className="mt-2 block text-[11px] text-[var(--foreground-muted)]" htmlFor={`manual-${provider.key}`}>
                        {manualKind === "calendar_feed"
                          ? "Paste your calendar's private iCal/ICS address — we fetch it and confirm it is a real calendar before saving."
                          : manualKind === "webhook"
                            ? "Paste an incoming-webhook URL (Slack, Discord, Zapier…). We send one test message to prove it works."
                            : "Paste the API key or token. This one is stored and marked unverified — there is no public endpoint to check it against."}
                      </label>
                      <input
                        id={`manual-${provider.key}`}
                        value={manualValue}
                        onChange={(e) => setManualValue(e.target.value)}
                        placeholder={manualKind === "calendar_feed" ? "https://calendar.google.com/calendar/ical/…/basic.ics" : manualKind === "webhook" ? "https://hooks.slack.com/services/…" : "paste your API key or token…"}
                        className="mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand-strong)]"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <Button size="sm" disabled={busy === provider.key || !manualValue.trim()} onClick={() => void manualConnect(provider)}>
                          {busy === provider.key ? "Checking…" : "Verify & connect"}
                        </Button>
                        {manualNote && <span className="text-[11px] text-[var(--palette-rose-400)]">{manualNote}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>
            {available
              ? "We POST an event to your URL and sign it, so you can verify it came from us."
              : "Webhooks are not enabled on this deployment yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {endpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No endpoints yet. Create one to receive session events.
            </p>
          ) : (
            endpoints.map((endpoint) => (
              <div key={endpoint.id} className="rounded-lg border border-border p-4" data-testid={`endpoint-${endpoint.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-mono text-sm">{endpoint.url}</span>
                      <Badge variant={endpoint.active ? "success" : "error"}>
                        {endpoint.active ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    {endpoint.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{endpoint.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Secret <span className="font-mono">{endpoint.secretHint}…</span> · last success{" "}
                      {relativeTime(endpoint.lastSuccessAt)}
                      {endpoint.failureCount > 0 ? ` · ${endpoint.failureCount} consecutive failures` : ""}
                    </p>
                    {endpoint.disabledReason ? (
                      <p className="mt-1 text-xs text-destructive">{endpoint.disabledReason}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === endpoint.id}
                      onClick={() => void testEndpoint(endpoint)}
                    >
                      Send test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === endpoint.id}
                      onClick={() => void toggleEndpoint(endpoint)}
                    >
                      {endpoint.active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === endpoint.id}
                      onClick={() => void removeEndpoint(endpoint)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
