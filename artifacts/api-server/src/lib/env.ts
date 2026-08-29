import { z } from "zod";

/**
 * Centralized environment access.
 *
 * ── Design rule: `getEnv()` MUST NEVER THROW. ────────────────────────────────
 *
 * This module used to throw whenever Zod rejected *any* variable while
 * `NODE_ENV === "production"`. Because `getEnv()` is reached at module
 * evaluation time (routes/auth → lib/rateLimiter → lib/rateLimitStore →
 * lib/env), a single malformed variable crashed the whole serverless module.
 * Vercel then answered **every** request with HTTP 500 and emitted no
 * route-level log — the production incident this file was written to fix.
 *
 * The correct semantics are:
 *   - Absent  variables → the request-time config gate answers 503 CONFIG_ERROR
 *     naming exactly what is missing (see `getConfigErrors` in lib/config.ts).
 *   - Malformed variables → recorded in `getEnvIssues()`, logged once at ERROR,
 *     surfaced by the same gate, and individually dropped so the remaining
 *     valid configuration still applies.
 *
 * A server that boots and reports its own misconfiguration is strictly more
 * operable than one that 500s on every route.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().optional(),
  LOG_LEVEL: z.string().optional().default("info"),

  // Database — required in production
  DATABASE_URL: z.string().url().optional(),
  POSTGRES_URL: z.string().url().optional(),
  POSTGRES_URL_NON_POOLING: z.string().url().optional(),
  POSTGRES_PRISMA_URL: z.string().url().optional(),

  // Auth — required in production
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters").optional(),
  SESSION_SECRET: z.string().min(32).optional(),

  // App URLs
  APP_URL: z.string().url().optional(),
  VITE_APP_URL: z.string().url().optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),

  // Admin
  //
  // The hard floor is 8 characters, not 16. A stricter floor looks better on
  // paper but is actively harmful in practice: the real production value is
  // 13 characters, and because `getEnv()` now drops invalid keys instead of
  // throwing, a 16-char floor would not crash — it would *silently disable
  // admin login* while the API reported itself healthy. The correct split is:
  //   - < 8 chars  → rejected (error): unusable, dropped, reported by the gate
  //   - 8..15      → accepted (advisory): admin login keeps working, operators
  //                  get a warning recommending a longer password
  ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD must be at least 8 characters").optional(),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // AI
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  // Cache / Redis
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Push
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),

  // Email delivery (Resend preferred, SMTP fallback) + cron auth
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional(),

  // Vercel
  VERCEL: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
  VERCEL_DEPLOYMENT_ID: z.string().optional(),
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),

  // Deployment version override
  DEPLOYMENT_VERSION: z.string().optional(),
});

type RawEnv = z.infer<typeof envSchema>;

/**
 * How badly an environment problem affects the running server.
 *
 *  - `error`   — the variable is unusable and has been dropped. The feature it
 *                powers is disabled, and the config gate names it in a 503.
 *  - `warning` — the variable parsed and the feature works, but the value is
 *                weaker than recommended. Never blocks a request.
 */
export type EnvSeverity = "error" | "warning";

/** A single rejected or suspect environment variable. Safe to log and to show an operator. */
export interface EnvIssue {
  /** Variable name. Never includes the value — values may be secrets. */
  key: string;
  /** Human-readable validation message. */
  message: string;
  /** `error` blocks the affected feature; `warning` is advisory only. */
  severity: EnvSeverity;
}

function formatIssues(issues: EnvIssue[]): string {
  return issues.map((i) => `  - [${i.severity}] ${i.key}: ${i.message}`).join("\n");
}

/**
 * Values that parse successfully but fall short of what we recommend.
 *
 * These deliberately do NOT become errors: the production admin password is
 * 13 characters, and turning a "could be stronger" opinion into a hard failure
 * is how you lock yourself out of your own admin panel.
 */
function collectAdvisories(data: RawEnv): EnvIssue[] {
  const advisories: EnvIssue[] = [];
  if (data.ADMIN_PASSWORD && data.ADMIN_PASSWORD.length < 16) {
    advisories.push({
      key: "ADMIN_PASSWORD",
      message: "accepted, but shorter than the recommended 16 characters",
      severity: "warning",
    });
  }
  return advisories;
}

/**
 * `NODE_ENV` is derived independently of Zod so that an unrecognised value
 * (`prod`, `Production`, `prodution`) can never flip a production deployment
 * into development mode — which would silently disable secure cookies and JWT
 * verification.
 */
function resolveNodeEnv(): "development" | "test" | "production" {
  const raw = process.env["NODE_ENV"];
  if (raw === "production" || raw === "test" || raw === "development") return raw;
  // Vercel always sets VERCEL_ENV; treat its production signal as authoritative.
  if (process.env["VERCEL_ENV"] === "production") return "production";
  return "development";
}

/**
 * Parse `process.env`, dropping only the keys that failed validation so one
 * malformed variable never discards the rest of the configuration.
 */
function recover(candidates: Record<string, string | undefined>): {
  data: RawEnv;
  issues: EnvIssue[];
} {
  const issues: EnvIssue[] = [];
  const scrubbed: Record<string, string | undefined> = { ...candidates };
  const nodeEnv = resolveNodeEnv();

  // At most a handful of iterations: each pass either succeeds or removes at
  // least one key from a finite key set.
  for (let pass = 0; pass < 8; pass += 1) {
    const result = envSchema.safeParse(scrubbed);
    if (result.success) {
      return { data: { ...result.data, NODE_ENV: nodeEnv }, issues };
    }
    const rejected = new Set<string>();
    for (const error of result.error.errors) {
      const key = error.path[0];
      if (typeof key === "string") {
        if (!rejected.has(key)) {
          rejected.add(key);
          issues.push({ key, message: error.message, severity: "error" });
        }
        delete scrubbed[key];
      }
    }
    if (rejected.size === 0) break; // nothing left to drop — stop looping
  }

  // Absolute floor: start from a known-good minimal environment. Keeps the
  // process alive and lets /api/healthz report the real problems.
  const minimal: RawEnv = envSchema.parse({
    NODE_ENV: nodeEnv,
    PATH: undefined,
  });
  return { data: minimal, issues };
}

let parsedEnv: RawEnv | null = null;
let envIssues: EnvIssue[] = [];
let reported = false;

/** Best-effort, never-throwing environment snapshot. Cached after first call. */
export function getEnv(): RawEnv {
  if (parsedEnv) return parsedEnv;

  const direct = envSchema.safeParse(process.env);
  if (direct.success) {
    parsedEnv = { ...direct.data, NODE_ENV: resolveNodeEnv() };
    envIssues = collectAdvisories(parsedEnv);
  } else {
    const recovered = recover(process.env as Record<string, string | undefined>);
    parsedEnv = recovered.data;
    envIssues = [...recovered.issues, ...collectAdvisories(parsedEnv)];
  }

  if (!reported) {
    reported = true;
    // One line per variable: greppable in Vercel's log search, and each line
    // names the exact variable to fix. Values are never logged.
    for (const issue of envIssues) {
      if (issue.severity === "error") {
        console.warn(`[env] Ignoring invalid ${issue.key}: ${issue.message}`);
      } else {
        console.warn(`[env] ${issue.key}: ${issue.message}`);
      }
    }
    const errors = envIssues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      console.error(
        "[env] Rejected environment variable(s) — the affected features are disabled:\n" +
          formatIssues(errors) +
          "\n[env] Fix these in your deployment's environment settings. See docs/ENVIRONMENT.md.",
      );
    }
  }

  return parsedEnv;
}

/**
 * Variables that failed validation or carry a weaker-than-recommended value.
 * Exposed so the config gate can tell an operator exactly what is wrong
 * instead of returning a bare 500/503.
 */
export function getEnvIssues(): EnvIssue[] {
  getEnv(); // ensure parsing has run
  return envIssues;
}

/**
 * Only the issues that actually disable a feature. The config gate turns these
 * into a 503; advisories are deliberately excluded so a weak-but-usable value
 * can never take the API down.
 */
export function getEnvErrors(): EnvIssue[] {
  return getEnvIssues().filter((i) => i.severity === "error");
}

/**
 * Report what production is missing or has misconfigured.
 *
 * Previously this threw, which turned a recoverable misconfiguration into a
 * boot crash loop (standalone) or a blanket 500 (serverless). It now returns a
 * list so the caller can log a fatal banner and keep serving — `/api/healthz`
 * stays up and the config gate returns a precise, actionable 503.
 */
export function validateProductionEnv(): string[] {
  const env = getEnv();
  const problems: string[] = [];

  if (env.NODE_ENV !== "production") return problems;

  const hasDb =
    env.DATABASE_URL ||
    env.POSTGRES_URL ||
    env.POSTGRES_URL_NON_POOLING ||
    env.POSTGRES_PRISMA_URL;

  if (!hasDb) problems.push("DATABASE_URL (or POSTGRES_URL_NON_POOLING) is not set");
  if (!env.AUTH_SECRET && !env.SESSION_SECRET) problems.push("AUTH_SECRET (min 32 chars) is not set");
  if (!env.ADMIN_PASSWORD) problems.push("ADMIN_PASSWORD (min 8 chars) is not set");
  if (!env.APP_URL && !env.VERCEL_URL) problems.push("APP_URL (or VERCEL_URL auto) is not set");

  // Strength checks — a too-short secret is as dangerous as a missing one.
  // ADMIN_PASSWORD is intentionally absent: its floor is 8 and anything above
  // that is an advisory, not a problem (see collectAdvisories).
  if (env.AUTH_SECRET && env.AUTH_SECRET.length < 32) {
    problems.push("AUTH_SECRET is too short (must be at least 32 characters)");
  }

  for (const issue of getEnvErrors()) {
    problems.push(`${issue.key} is invalid (${issue.message})`);
  }

  return problems;
}

export function getDatabaseUrl(): string | null {
  const env = getEnv();
  const isVercel = Boolean(env.VERCEL || process.env.VERCEL);
  if (isVercel) {
    return (
      env.POSTGRES_URL_NON_POOLING ??
      env.DATABASE_URL ??
      env.POSTGRES_PRISMA_URL ??
      env.POSTGRES_URL ??
      null
    );
  }
  return (
    env.DATABASE_URL ??
    env.POSTGRES_PRISMA_URL ??
    env.POSTGRES_URL ??
    env.POSTGRES_URL_NON_POOLING ??
    null
  );
}

export function getJwtSecret(): string | null {
  const env = getEnv();
  return env.AUTH_SECRET ?? env.SESSION_SECRET ?? null;
}

export function getAppUrl(): string {
  const env = getEnv();
  const vercelUrl = env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null;
  return (
    env.APP_URL ??
    vercelUrl ??
    (env.NODE_ENV === "production" ? "https://focusarx.vercel.app" : "http://localhost:5173")
  );
}

// Re-export for convenience
export const env = {
  get: getEnv,
  getDatabaseUrl,
  getJwtSecret,
  getAppUrl,
  validateProductionEnv,
};
