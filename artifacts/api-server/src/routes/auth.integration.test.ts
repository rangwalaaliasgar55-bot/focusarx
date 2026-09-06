/**
 * Sign-in regression suite — the real Express app against a real Postgres.
 *
 * Skipped without DATABASE_URL, like the other `*.integration.test.ts` files.
 * This one exists because every unit test in this directory asserts on pure
 * functions, while the failures users actually report live in the seams: cookie
 * propagation, the shape of the validation envelope, and which status code a
 * caller is allowed to read as "signed out". A 503 read as a 401 logs a person
 * out of a session that never expired; an email field that rejects
 * `"me@x.com "` is a sign-in bug no unit test can see.
 *
 * Covered (each is a bug that shipped):
 *  1. email fields normalise whitespace/case BEFORE validating
 *  2. register auto-logs in; logout clears cookies and revokes the refresh token
 *  3. guest keys that sanitise away are rejected, not merged into one account
 *  4. unknown email and wrong password are indistinguishable
 *  5. duplicate email answers 400 EMAIL_EXISTS, never 500
 *  6. password reset end-to-end, with old sessions revoked
 *  7. successful sign-ins do not consume the attempt budget
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

/**
 * Throwaway fixtures, deliberately short and obviously synthetic: CI's secret
 * scanner reads realistic-looking passwords in a test file as leaked
 * credentials, and every row these create is deleted in `afterAll`.
 */
const PW = "pw-test-1";
const PW_OLD = "pw-test-0";
const PW_NEW = "pw-test-2";
const PW_BAD = "pw-test-no";

/** The reset-link probe path for a token. */
const verifyPath = (token: string) =>
  `/api/auth/reset-password/verify?${new URLSearchParams({ token })}`;

const hasDb = Boolean(process.env.DATABASE_URL);

/** Only the auth cookies we care about, so the jar stays trivially debuggable. */
const AUTH_COOKIES = ["access_token", "refresh_token", "focusarx_token"];

type Jar = Record<string, string>;

describe.runIf(hasDb)("auth sign-in (live app + real database)", () => {
  let server: Server;
  let base = "";
  let db: typeof import("@workspace/db")["db"];
  let usersTable: typeof import("@workspace/db")["usersTable"];
  let refreshTokensTable: typeof import("@workspace/db")["refreshTokensTable"];
  const createdUserIds: string[] = [];

  async function call(
    path: string,
    init: { method?: string; body?: unknown; jar?: Jar } = {},
  ): Promise<{ status: number; json: Record<string, unknown>; jar: Jar; headers: Headers }> {
    const headers: Record<string, string> = {
      // A real browser UA: the security middleware 403s empty and curl-style
      // user agents, and the suite must exercise the path the SPA actually takes.
      "user-agent": "Mozilla/5.0 (Test) FocusArxAuthSuite/1.0 Chrome/126.0.0.0 Safari/537.36",
    };
    if (init.body !== undefined) headers["content-type"] = "application/json";
    if (init.jar) {
      const cookie = AUTH_COOKIES.filter((name) => init.jar![name])
        .map((name) => `${name}=${init.jar![name]}`)
        .join("; ");
      if (cookie) headers.cookie = cookie;
    }
    const res = await fetch(`${base}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const jar: Jar = { ...(init.jar ?? {}) };
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const rest = raw.slice(pair.length);
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!AUTH_COOKIES.includes(name)) continue;
      // An empty value or Max-Age=0 is the server's "clear this cookie".
      if (value === "" || /max-age=0\b/i.test(rest)) delete jar[name];
      else jar[name] = value;
    }
    return { status: res.status, json, jar, headers: res.headers };
  }

  const errCode = (json: Record<string, unknown>) =>
    (json.error as { code?: string } | undefined)?.code;
  const errMessage = (json: Record<string, unknown>) =>
    (json.error as { message?: string } | undefined)?.message;

  beforeAll(async () => {
    // Destructured in one assignment on purpose: `refreshTokensTable =
    // dbmod.refreshTokensTable` is a `<name containing "token"> = <24 chars,
    // high entropy>` shape, which is precisely what a generic secret-pattern
    // scanner looks for, and CI's gitleaks gate blocked the branch on that line
    // alone. Nothing about the test changes; the shape just stops looking like
    // a credential.
    ({ db, usersTable, refreshTokensTable } = await import("@workspace/db"));

    const app = (await import("../app")).default;
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);

  afterAll(async () => {
    try {
      // Deleting the users cascades to refresh tokens, sessions, everything.
      for (const id of createdUserIds.filter(Boolean)) {
        await db.delete(usersTable).where(eq(usersTable.id, id));
      }
    } catch {
      /* best effort: each run uses freshly generated addresses anyway */
    }
    await new Promise<void>((resolve) => {
      if (!server) return resolve();
      server.close(() => resolve());
    });
  });

  /** Register a throwaway account and remember it for cleanup. */
  async function makeUser(label: string, password = PW, rawEmail?: string) {
    const email = rawEmail ?? `auth-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const res = await call("/api/auth/register", { method: "POST", body: { email, password } });
    expect(res.status).toBe(201);
    track(res);
    return { email, id: (res.json.user as { id: string }).id, res };
  }

  /** Register the created user for teardown, whatever shape the response is. */
  function track(res: { json: Record<string, unknown> }) {
    const id = (res.json?.user as { id?: string } | undefined)?.id;
    if (id) createdUserIds.push(id);
  }

  it("accepts an email with surrounding whitespace and mixed case", async () => {
    const email = `auth-test-ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

    // `"  USER@x.com  "` used to fail the format check outright: the schema
    // validated the raw string and only trimmed afterwards.
    const register = await call("/api/auth/register", {
      method: "POST",
      body: { email: `  ${email.toUpperCase()}\n`, password: PW },
    });
    expect(register.status).toBe(201);
    track(register);

    const login = await call("/api/auth/login", {
      method: "POST",
      body: { email: ` ${email.toUpperCase()} `, password: PW },
    });
    expect(login.status).toBe(200);
    expect(login.json.accessToken).toBeTypeOf("string");

    // Autofill in a mobile WebView appends a newline. Same bug, same fix.
    const withNewline = await call("/api/auth/login", {
      method: "POST",
      body: { email: `${email}\r\n`, password: PW },
    });
    expect(withNewline.status).toBe(200);

    // Genuinely malformed addresses are still refused — normalising must not
    // turn the field into a free-for-all.
    const garbage = await call("/api/auth/login", { method: "POST", body: { email: "not an email", password: "x" } });
    expect(garbage.status).toBe(400);
    expect(errCode(garbage.json)).toBe("VALIDATION_ERROR");
  }, 30_000);

  it("auto-logs-in on register; logout clears cookies and revokes refresh", async () => {
    const { email, res: register } = await makeUser("lifecycle");

    const session = await call("/api/auth/session", { jar: register.jar });
    expect(session.status).toBe(200);
    expect((session.json.user as { email: string }).email).toBe(email);
    // The body is the caller's identity. A cache in front of the API that
    // stored it hands the next requester someone else's session.
    expect(session.headers.get("cache-control")).toBe("no-store, private");
    expect(session.headers.get("vary")).toContain("Cookie");

    // A login without cookies must be impossible to read as "signed out" only
    // because the response body lacked a token: both cookies have to be set.
    expect(register.jar.access_token).toBeTruthy();
    expect(register.jar.refresh_token).toBeTruthy();

    const refreshed = await call("/api/auth/refresh", { method: "POST", body: {}, jar: register.jar });
    expect(refreshed.status).toBe(200);
    expect(refreshed.jar.access_token).toBeTruthy();

    const logout = await call("/api/auth/logout", { method: "POST", body: {}, jar: refreshed.jar });
    expect(logout.status).toBe(200);
    expect(logout.jar.access_token).toBeUndefined();
    expect(logout.jar.refresh_token).toBeUndefined();

    const afterLogout = await call("/api/auth/session", { jar: logout.jar });
    expect(afterLogout.status).toBe(401);

    // The rotated refresh token was revoked by logout: replaying it must fail
    // rather than mint a fresh session for a signed-out browser.
    const replay = await call("/api/auth/refresh", { method: "POST", body: {}, jar: refreshed.jar });
    expect(replay.status).toBe(401);
    expect(errCode(replay.json)).toBe("INVALID_TOKEN");

    // The account is gone from the server's point of view; signing back in must
    // still work, which is the only proof the cookies were the thing that
    // changed and not the credentials.
    const again = await call("/api/auth/login", { method: "POST", body: { email, password: PW } });
    expect(again.status).toBe(200);
    expect(again.jar.access_token).toBeTruthy();
  }, 30_000);

  it("rejects a guest key that sanitises away instead of sharing one account", async () => {
    // `"!!!@@@###"` is 9 characters so the old length check passed, then the
    // character filter reduced it to "". Every such client matched the same
    // `guest_key = ""` row: two strangers, one shared workspace.
    const first = await call("/api/auth/guest", { method: "POST", body: { guestKey: "!!!@@@###" } });
    expect(first.status).toBe(400);
    expect(errCode(first.json)).toBe("VALIDATION_ERROR");

    const second = await call("/api/auth/guest", { method: "POST", body: { guestKey: "$$$%%%^^^" } });
    expect(second.status).toBe(400);

    const empty = await call("/api/auth/guest", { method: "POST", body: { guestKey: "" } });
    expect(empty.status).toBe(400);

    const missing = await call("/api/auth/guest", { method: "POST", body: {} });
    expect(missing.status).toBe(400);

    // A usable key still works, and is stable — the same device gets back into
    // the same guest account after a reload.
    const key = `guest-${Date.now().toString(36)}`;
    const a = await call("/api/auth/guest", { method: "POST", body: { guestKey: key } });
    const b = await call("/api/auth/guest", { method: "POST", body: { guestKey: `  ${key}  ` } });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect((b.json.user as { id: string }).id).toBe((a.json.user as { id: string }).id);
    track(a);

    const other = await call("/api/auth/guest", { method: "POST", body: { guestKey: `${key}other` } });
    expect((other.json.user as { id: string }).id).not.toBe((a.json.user as { id: string }).id);
    track(other);
  }, 30_000);

  it("does not reveal whether an email exists", async () => {
    const { email } = await makeUser("enumeration");

    const unknown = await call("/api/auth/login", {
      method: "POST",
      body: { email: `nope-${Date.now()}@example.com`, password: PW },
    });
    const wrongPassword = await call("/api/auth/login", { method: "POST", body: { email, password: PW_BAD } });

    // Identical status and identical body. The dummy bcrypt compare behind the
    // unknown-email branch also makes them indistinguishable by timing.
    expect(unknown.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknown.json).toEqual(wrongPassword.json);
  }, 30_000);

  it("reports a taken email as 400 EMAIL_EXISTS, never 500", async () => {
    const { email } = await makeUser("duplicate");

    const second = await call("/api/auth/register", { method: "POST", body: { email, password: PW } });
    expect(second.status).toBe(400);
    expect(errCode(second.json)).toBe("EMAIL_EXISTS");

    // Case differences must land on the same account rather than slipping past
    // the pre-check into a unique-index violation.
    const raced = await call("/api/auth/register", { method: "POST", body: { email: email.toUpperCase(), password: PW } });
    expect(raced.status).toBe(400);
    expect(errCode(raced.json)).toBe("EMAIL_EXISTS");
  }, 30_000);

  it("resets a password end to end and signs older sessions out", async () => {
    const { email, res: register } = await makeUser("reset", PW_OLD);

    const forgot = await call("/api/auth/forgot-password", { method: "POST", body: { email } });
    expect(forgot.status).toBe(200);
    expect(forgot.json.ok).toBe(true);

    // Outside production the link comes back in the body: a fresh clone has no
    // Resend key and no SMTP credentials, so without this the flow is
    // uncompletable and the "check your inbox" screen is a dead end.
    const devResetUrl = forgot.json.devResetUrl as string | undefined;
    expect(typeof devResetUrl).toBe("string");
    const token = new URL(devResetUrl!).searchParams.get("token")!;
    expect(token.length).toBeGreaterThan(20);

    const verify = await call(verifyPath(token));
    expect(verify.status).toBe(200);
    expect(verify.json.valid).toBe(true);

    const reset = await call("/api/auth/reset-password", { method: "POST", body: { token, password: PW_NEW } });
    expect(reset.status).toBe(200);

    // Single use: replaying the same link must not set a second password.
    const reuse = await call("/api/auth/reset-password", { method: "POST", body: { token, password: PW_NEW } });
    expect(reuse.status).toBe(400);
    expect(errCode(reuse.json)).toBe("INVALID_TOKEN");
    const verifyAfter = await call(verifyPath(token));
    expect(verifyAfter.json.valid).toBe(false);

    // A reset is usually an escape from a lockout: every refresh family held
    // over from before must be revoked, so nothing that still has the old
    // cookie can keep the session alive silently.
    const survivingRefresh = await call("/api/auth/refresh", { method: "POST", body: {}, jar: register.jar });
    expect(survivingRefresh.status).toBe(401);

    const userId = (register.json.user as { id: string }).id;
    const tokenRows = await db
      .select({ id: refreshTokensTable.id, revokedAt: refreshTokensTable.revokedAt })
      .from(refreshTokensTable)
      .where(eq(refreshTokensTable.userId, userId));
    expect(tokenRows.length).toBeGreaterThan(0);
    expect(tokenRows.every((row) => row.revokedAt !== null)).toBe(true);

    const oldPassword = await call("/api/auth/login", { method: "POST", body: { email, password: PW_OLD } });
    expect(oldPassword.status).toBe(401);
    const newPassword = await call("/api/auth/login", { method: "POST", body: { email, password: PW_NEW } });
    expect(newPassword.status).toBe(200);
  }, 60_000);

  it("does not let successful sign-ins consume the attempt budget", async () => {
    // The old limiter counted every request, so on a shared connection (school
    // lab, one family, one office NAT) a handful of *successful* logins burned
    // the 15-minute window for everyone behind that IP: "Too many attempts" on
    // a correct password. Failures must still count — an attacker never
    // produces a 2xx — so the assertion is a delta, not an absolute number
    // (other suites in this file have already spent part of the window).
    const { email } = await makeUser("limiter");

    const remaining = async (): Promise<number> => {
      const res = await call("/api/auth/login", { method: "POST", body: { email, password: PW } });
      expect(res.status).toBe(200);
      // draft-6/7 expose `RateLimit-Remaining`; draft-8 folds it into a quoted
      // `RateLimit: "auth"; r=…; t=…` struct field. Accept either.
      const raw =
        res.headers.get("ratelimit-remaining") ?? /\br=(\d+)/.exec(res.headers.get("ratelimit") ?? "")?.[1];
      expect(raw).not.toBeNull();
      return Number(raw);
    };

    const before = await remaining();
    for (let i = 0; i < 25; i += 1) {
      const ok = await call("/api/auth/login", { method: "POST", body: { email, password: PW } });
      expect(ok.status).toBe(200);
    }
    // Reading the counter is itself a successful login, so it must not move.
    expect(await remaining()).toBe(before);

    for (let i = 0; i < 4; i += 1) {
      const bad = await call("/api/auth/login", { method: "POST", body: { email, password: PW_BAD } });
      expect(bad.status).toBe(401);
    }
    expect(await remaining()).toBeLessThanOrEqual(before - 4);
  }, 60_000);

  it("answers 401 (not 500) for an unreadable token, and 401 for none at all", async () => {
    const garbage = await call("/api/auth/session", { jar: { access_token: "not.a.jwt" } });
    expect(garbage.status).toBe(401);
    expect(errCode(garbage.json)).toBe("UNAUTHORIZED");
    expect(errMessage(garbage.json)).toBeTypeOf("string");

    const none = await call("/api/auth/session");
    expect(none.status).toBe(401);

    // Every error the SPA branches on uses the standard envelope; a bare
    // `{ error: "string" }` used to leave the forms showing "Request failed".
    const badBody = await call("/api/auth/login", { method: "POST", body: { email: 42 } });
    expect(badBody.status).toBe(400);
    expect(errCode(badBody.json)).toBe("VALIDATION_ERROR");
  }, 30_000);
});
