import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "focusarx_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function signingKey(): string {
  const key = process.env.ADMIN_SECRET ?? process.env.AUTH_SECRET;
  if (!key) {
    throw new Error("Set ADMIN_SECRET or AUTH_SECRET for admin sessions.");
  }
  return key;
}

export function verifyAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;

  const a = Buffer.from(input, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function mintAdminCookieValue(): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = String(exp);
  const sig = createHmac("sha256", signingKey()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function parseAdminCookieValue(value: string | undefined): boolean {
  if (!value) return false;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return false;

  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const expected = createHmac("sha256", signingKey())
    .update(payload)
    .digest("hex");

  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  return parseAdminCookieValue(jar.get(ADMIN_COOKIE)?.value);
}

export async function requireAdminApi(): Promise<Response | null> {
  if (await isAdminAuthenticated()) return null;
  return Response.json({ error: "Admin authentication required" }, { status: 401 });
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}
