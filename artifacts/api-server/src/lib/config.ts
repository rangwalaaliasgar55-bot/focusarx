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

  const adminPassword: string | null =
    process.env.ADMIN_PASSWORD ?? (!isProduction ? "admin123" : null);
  if (!process.env.ADMIN_PASSWORD && !isProduction && !warnedDevAdmin) {
    warnedDevAdmin = true;
    console.warn(
      "[config] ADMIN_PASSWORD is not set — using default dev password 'admin123'.",
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
  const config = getServerConfig();
  const missing: string[] = [];
  if (!config.databaseUrl) {
    missing.push("DATABASE_URL or POSTGRES_URL_NON_POOLING");
  }
  if (config.isProduction && !config.jwtSecret) missing.push("AUTH_SECRET");
  return missing;
}
