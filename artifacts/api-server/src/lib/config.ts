export type ServerConfig = {
  jwtSecret: string | null;
  adminPassword: string | null;
  databaseUrl: string | null;
  isProduction: boolean;
  googleClientId: string | null;
  googleClientSecret: string | null;
  appUrl: string | null;
};

let warnedDevJwt = false;
let warnedDevAdmin = false;

export function getServerConfig(): ServerConfig {
  const isProduction = process.env.NODE_ENV === "production";

  // AUTH_SECRET takes priority; fall back to SESSION_SECRET so existing Vercel/Replit secrets work
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

  return {
    jwtSecret,
    adminPassword,
    databaseUrl: process.env.DATABASE_URL ?? null,
    isProduction,
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? null,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? null,
    appUrl: process.env.APP_URL ?? (isProduction ? "https://focusarx.vercel.app" : "http://localhost:20925"),
  };
}

/** Env vars that must be set in production (Vercel) for auth + data routes. */
export function getConfigErrors(): string[] {
  const config = getServerConfig();
  const missing: string[] = [];
  if (!config.databaseUrl) missing.push("DATABASE_URL");
  if (config.isProduction && !config.jwtSecret) missing.push("AUTH_SECRET");
  return missing;
}
