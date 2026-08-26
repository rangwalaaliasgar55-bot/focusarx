import { getEnv, getDatabaseUrl, getJwtSecret, getAppUrl } from "./env";

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
    jwtSecret = `dev-${crypto.randomUUID()}`;
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

/** Env vars that must be set in production for auth + data routes. */
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
  return missing;
}
