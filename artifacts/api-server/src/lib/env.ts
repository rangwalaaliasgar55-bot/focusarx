import { z } from "zod";

/**
 * Centralized environment validation.
 *
 * One invalid variable must never take the whole API down. Recovery model:
 *  - getEnv() ALWAYS recovers: invalid keys are dropped (they are all
 *    optional) with a loud `[env] Ignoring invalid KEY` log line, so the
 *    server keeps serving everything that doesn't depend on the bad key.
 *    (It used to throw in production, which — combined with module-scope
 *    limiter construction — 500'd every route in the deployment.)
 *  - Required-in-production gaps are still enforced, but per-request and
 *    with a clear message: routes/middleware turn them into 503
 *    CONFIG_ERROR responses naming what's missing (see getConfigErrors),
 *    and validateProductionEnv() still fails fast for long-running starts.
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
  // Same floor as regular user passwords (auth.ts registerSchema); the admin
  // gate is additionally rate-limited and compared in constant time.
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

function formatZodErrors(error: z.ZodError): string {
  return error.errors
    .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
    .join("\n");
}

let parsedEnv: RawEnv | null = null;

export function getEnv(): RawEnv {
  if (parsedEnv) return parsedEnv;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("[env] Invalid environment variables:\n" + formatZodErrors(result.error));
    // Recover by dropping ONLY the offending keys and re-parsing, so one
    // malformed variable doesn't discard every valid one (a full
    // envSchema.parse({}) here used to zero out the whole config) — and, in
    // production, used to throw and 500 every request. Every schema field is
    // optional, so dropping an invalid key is always safe; if that key was
    // required in production, getConfigErrors() reports it as a 503
    // CONFIG_ERROR naming the variable, which is actionable instead of an
    // opaque INTERNAL_ERROR.
    const scrubbed: Record<string, string | undefined> = { ...process.env };
    for (const issue of result.error.errors) {
      const key = issue.path[0];
      if (typeof key === "string") {
        delete scrubbed[key];
        console.warn(`[env] Ignoring invalid ${key} in ${process.env.NODE_ENV ?? "development"}`);
      }
    }
    parsedEnv = envSchema.parse(scrubbed);
    return parsedEnv;
  }

  parsedEnv = result.data;
  return parsedEnv;
}

/**
 * Validates that production has all required secrets.
 * Throws with a clear message if missing, so server fails fast.
 */
export function validateProductionEnv(): void {
  const env = getEnv();
  const isProd = env.NODE_ENV === "production";

  if (!isProd) return;

  const missing: string[] = [];

  const hasDb =
    env.DATABASE_URL ||
    env.POSTGRES_URL ||
    env.POSTGRES_URL_NON_POOLING ||
    env.POSTGRES_PRISMA_URL;

  if (!hasDb) missing.push("DATABASE_URL (or POSTGRES_URL_NON_POOLING)");
  if (!env.AUTH_SECRET && !env.SESSION_SECRET) missing.push("AUTH_SECRET (min 32 chars)");
  if (!env.ADMIN_PASSWORD) missing.push("ADMIN_PASSWORD (min 8 chars)");
  if (!env.APP_URL && !env.VERCEL_URL) missing.push("APP_URL (or VERCEL_URL auto)");

  if (missing.length > 0) {
    const message =
      `[env] Missing required environment variables in production:\n` +
      missing.map((m) => `  - ${m}`).join("\n") +
      `\n\nAdd them in your hosting provider's environment settings.\n` +
      `See .env.example for reference.`;

    console.error(message);
    throw new Error(message);
  }

  // Additional strength checks in production
  if (env.AUTH_SECRET && env.AUTH_SECRET.length < 32) {
    throw new Error("[env] AUTH_SECRET must be at least 32 characters in production");
  }
  if (env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length < 8) {
    throw new Error("[env] ADMIN_PASSWORD must be at least 8 characters in production");
  }
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
