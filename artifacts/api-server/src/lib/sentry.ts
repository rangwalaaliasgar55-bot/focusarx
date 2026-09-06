/**
 * Optional error observability (Sentry, env-gated).
 *
 * Without SENTRY_DSN this module is a typed no-op: the SDK is never
 * imported, nothing is sent, self-hosters pay zero cost. With a DSN, the
 * central Express error handler reports 500s with release tags. PII is
 * never attached (no bodies, tokens or SQL text).
 *
 * Dependency note: @sentry/node pulls @opentelemetry/*, and the api-server
 * build (build.mjs) bundles those into dist/app.mjs — they must NOT be in its
 * `external` list (no runtime-resolvable copy exists under the pnpm layout,
 * and an external bare import crashed every serverless cold start). Only
 * @workspace/db declares @opentelemetry/api, so pnpm resolves a SINGLE
 * drizzle snapshot — two snapshots cause cross-package SQL<> type-identity
 * errors (see adminAuth eq() overload failures when they diverge).
 */

let initAttempted = false;
let initOk = false;

async function ensureInit(): Promise<boolean> {
  if (initAttempted) return initOk;
  initAttempted = true;
  const dsn = (process.env.SENTRY_DSN || "").trim();
  if (!dsn) return false;
  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID,
      tracesSampleRate: 0.05,
      sendDefaultPii: false,
    });
    initOk = true;
    return true;
  } catch {
    return false;
  }
}

/** Fire-and-forget from error paths. Never throws, never blocks responses. */
export function reportError(err: unknown, extra?: Record<string, unknown>): void {
  const dsn = (process.env.SENTRY_DSN || "").trim();
  if (!dsn) return;
  void ensureInit()
    .then(async (ok) => {
      if (!ok) return;
      const Sentry = await import("@sentry/node");
      Sentry.captureException(err, extra ? { extra } : undefined);
    })
    .catch(() => {});
}
