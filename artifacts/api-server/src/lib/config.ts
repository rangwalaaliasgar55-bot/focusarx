import crypto from "crypto";
import { getEnv, getEnvErrors, getDatabaseUrl, getJwtSecret, getAppUrl } from "./env";

export type ServerConfig = {
  jwtSecret: string | null;
  adminPassword: string | null;
  databaseUrl: string | null;
  isProduction: boolean;
  appUrl: string | null;
  googleClientId: string | null;
  googleClientSecret: string | null;
};

let warnedDevJwt = false;
let warnedDevAdmin = false;
let devJwtSecret: string | null = null;

export function resolveDatabaseUrl(): string | null {
  try {
    return getDatabaseUrl();
  } catch {
    const isVercel = Boolean(process.env.VERCEL);
    if (isVercel) {
      return (
        process.env.POSTGRES_URL_NON_POOLING ??
        process.env.DATABASE_URL ??
        process.env.POSTGRES_PRISMA_URL ??
        process.env.POSTGRES_URL ??
        null
      );
    }
    return (
      process.env.DATABASE_URL ??
      process.env.POSTGRES_PRISMA_URL ??
      process.env.POSTGRES_URL ??
      process.env.POSTGRES_URL_NON_POOLING ??
      null
    );
  }
}

export function getServerConfig(): ServerConfig {
  const env = getEnv();
  const isProduction = env.NODE_ENV === "production";

  let jwtSecret: string | null = getJwtSecret();
  if (!jwtSecret && !isProduction) {
    // Keep one deterministic-per-process dev secret. Generating a fresh UUID on
    // every getServerConfig() call made tokens signed in one request impossible
    // to verify in the next (login signed with secret A, session verified with
    // secret B → 401), which broke sign-in/sign-up wherever AUTH_SECRET was unset.
    if (!devJwtSecret) {
      devJwtSecret = `dev-${crypto.randomUUID()}`;
    }
    jwtSecret = devJwtSecret;
    if (!warnedDevJwt) {
      warnedDevJwt = true;
      console.warn(
        "[config] AUTH_SECRET is not set — using an ephemeral dev secret (sessions reset on restart).",
      );
    }
  }

  const adminPassword: string | null = env.ADMIN_PASSWORD ?? null;
  if (!adminPassword && isProduction && !warnedDevAdmin) {
    warnedDevAdmin = true;
    console.error(
      "[config] ADMIN_PASSWORD is not set — admin password login is disabled. Set it in your environment variables.",
    );
  } else if (!adminPassword && !isProduction && !warnedDevAdmin) {
    warnedDevAdmin = true;
    console.warn(
      "[config] ADMIN_PASSWORD is not set — admin password login disabled in dev.",
    );
  }

  return {
    jwtSecret,
    adminPassword,
    databaseUrl: resolveDatabaseUrl(),
    isProduction,
    googleClientId: env.GOOGLE_CLIENT_ID ?? null,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET ?? null,
    appUrl: getAppUrl(),
  };
}

/**
 * Everything that prevents the API from serving authenticated, data-backed
 * requests. Returned verbatim to the caller by the config gate in `app.ts`, so
 * every entry must be safe to show a client: variable *names* and validation
 * *messages* only — never values.
 *
 * Two distinct failure classes are reported:
 *  - missing   — the variable is absent entirely
 *  - malformed — the variable is present but rejected validation (too short,
 *                not a URL, not a number). These used to crash the serverless
 *                module at import time and produce a blanket HTTP 500.
 */
export function getConfigErrors(): string[] {
  const missing: string[] = [];
  if (!resolveDatabaseUrl()) {
    missing.push("DATABASE_URL or POSTGRES_URL_NON_POOLING");
  }
  const env = getEnv();
  const isProduction = env.NODE_ENV === "production";
  if (isProduction && !(env.AUTH_SECRET ?? env.SESSION_SECRET)) {
    missing.push("AUTH_SECRET");
  }
  if (isProduction && !env.ADMIN_PASSWORD) {
    missing.push("ADMIN_PASSWORD");
  }
  // Errors only. Advisories ("shorter than recommended") must never turn into
  // a 503 — the value works, it is merely not ideal.
  for (const issue of getEnvErrors()) {
    missing.push(`${issue.key} (${issue.message})`);
  }
  return missing;
}

/**
 * Runtime status for the health endpoint. Deliberately coarse: it reports
 * *whether* the server can do its job, never connection strings or secrets.
 */
export function getConfigStatus(): {
  ok: boolean;
  environment: string;
  database: boolean;
  authSecret: boolean;
  adminPassword: boolean;
  errors: string[];
} {
  const env = getEnv();
  const errors = getConfigErrors();
  return {
    ok: errors.length === 0,
    environment: env.NODE_ENV,
    database: Boolean(resolveDatabaseUrl()),
    authSecret: Boolean(env.AUTH_SECRET ?? env.SESSION_SECRET),
    adminPassword: Boolean(env.ADMIN_PASSWORD),
    // Names + validation messages only.
    errors,
  };
}
