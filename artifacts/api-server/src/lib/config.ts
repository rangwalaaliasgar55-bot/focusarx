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

export function getServerConfig(): ServerConfig {
  const isProduction = process.env.NODE_ENV === "production";

  let jwtSecret: string | null =
    process.env.AUTH_SECRET ?? process.env.SESSION_SECRET ?? null;
  if (!jwtSecret && !isProduction) {
    jwtSecret = `dev-${crypto.randomUUID()}`;
    if (!warnedDevJwt) {
      warnedDevJwt = true;
      console.warn(
        "[config] AUTH_SECRET is not set — using an ephemeral dev secret (sessions reset on restart).",
      );
    }
  }

  const adminPassword: string | null = process.env.ADMIN_PASSWORD ?? null;
  // NOTE: never throw from getServerConfig(). It is called from request-time
  // middleware (e.g. the CORS origin callback on EVERY cross-origin request),
  // so a throw here surfaces as an opaque 500 "Internal error" on login and
  // other auth requests. The admin login route already handles a null
  // adminPassword gracefully, and getConfigErrors() reports it as missing.
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

  const vercelUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : null;

  return {
    jwtSecret,
    adminPassword,
    databaseUrl: resolveDatabaseUrl(),
    isProduction,
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? null,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? null,
    appUrl:
      process.env.APP_URL ??
      vercelUrl ??
      (isProduction ? "https://focusarx.vercel.app" : "http://localhost:5173"),
  };
}

/** Env vars that must be set in production for auth + data routes. */
export function getConfigErrors(): string[] {
  const missing: string[] = [];
  if (!resolveDatabaseUrl()) {
    missing.push("DATABASE_URL or POSTGRES_URL_NON_POOLING");
  }
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && !(process.env.AUTH_SECRET ?? process.env.SESSION_SECRET)) {
    missing.push("AUTH_SECRET");
  }
  if (isProduction && !process.env.ADMIN_PASSWORD) {
    missing.push("ADMIN_PASSWORD");
  }
  return missing;
}
