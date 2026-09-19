import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The §1.6 invariants that a refactor can quietly break.
 *
 * The crypto in `secrets.ts` and the SSRF check in `webhooks.ts` both have
 * direct unit tests. What unit tests cannot cover is whether a *future* route
 * uses them. Every one of these failures is a single plausible line:
 *
 *   - someone adds a column to the insert and passes `secret` instead of
 *     `encryptSecret(secret)` — the round-trip test still passes, and the
 *     signing key is now plaintext in the table;
 *   - someone returns the endpoint row from `GET /webhooks`, which now includes
 *     `secretEnc`, and a stored credential is handed out on every page load;
 *   - someone POSTs to `endpoint.url` without re-validating, and a hostname
 *     repointed at `169.254.169.254` after saving gets fetched.
 *
 * A source-level gate is the right tool because the invariant is about *which
 * function is called*, and cannot pass by accident.
 */
const SRC = join(process.cwd(), "src");

const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/** Every .ts file under a directory, excluding tests. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(SRC, dir))) {
    const full = join(SRC, dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(join(dir, entry)));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(join(dir, entry));
    }
  }
  return out;
}

const ALL_SOURCES = [...sourceFiles("routes"), ...sourceFiles("lib")];

/** The columns that hold a credential and must never be written in the clear. */
const ENCRYPTED_COLUMNS = ["secretEnc", "accessTokenEnc", "refreshTokenEnc"];

describe("credential columns are only ever written through encryptSecret", () => {
  /**
   * Every write to a credential column, harvested from the object literal of an
   * `insert().values(...)` or an `update().set(...)`.
   *
   * Scoping to those two calls is what makes this precise. An unscoped scan
   * matched `webhookEndpointsTable.secretEnc` in a `select({...})` — a read —
   * and reported it as an unencrypted write.
   */
  function credentialWrites(): Array<{ file: string; column: string; expression: string }> {
    const out: Array<{ file: string; column: string; expression: string }> = [];
    for (const file of ALL_SOURCES) {
      const text = read(file);
      for (const block of text.matchAll(/\.(?:values|set)\(\{([\s\S]*?)\}\)/g)) {
        const body = block[1]!;
        for (const column of ENCRYPTED_COLUMNS) {
          for (const match of body.matchAll(new RegExp(`${column}\\s*:\\s*([^,}\\n]+)`, "g"))) {
            out.push({ file, column, expression: match[1]!.trim() });
          }
        }
      }
    }
    return out;
  }

  it("never writes one of them without encrypting it", () => {
    const offenders = credentialWrites().filter(({ expression }) => {
      if (expression.includes("encryptSecret(")) return false;
      // A provider may not return a refresh token; storing null is correct.
      if (expression === "null") return false;
      // Preserving the value already in the column. What is stored there was
      // encrypted when it was written, and the comment on the refresh path says
      // why overwriting it with null would break the next refresh.
      if (expression.includes("row.")) return false;
      return true;
    });
    expect(
      offenders.map((o) => `${o.file}: ${o.column}: ${o.expression}`),
      "Unencrypted writes to credential columns",
    ).toEqual([]);
  });

  it("has a positive control, so the check cannot pass by matching nothing", () => {
    // A gate that finds no assignments at all passes vacuously — the mistake
    // that made the first version of `data-integrity-constraints.test.mjs`
    // worthless. These are the writes that must exist.
    const writes = credentialWrites();
    expect(writes.length).toBeGreaterThanOrEqual(4);
    expect(writes.some((w) => w.expression.includes("encryptSecret("))).toBe(true);
    // And the "preserve the existing token" branch must still be there, or a
    // refresh that omits the token would null the connection's credentials.
    expect(writes.some((w) => w.column === "refreshTokenEnc" && w.expression.includes("row."))).toBe(true);
  });
});

describe("stored secrets never leave the server", () => {
  it("returns the plaintext secret from exactly the create and rotate handlers", () => {
    // `POST /webhooks` and `POST /webhooks/:id/rotate` are the only places the
    // plaintext may appear in a response. Anywhere else, and a stolen session
    // can be used to *collect the signing keys* of every endpoint the user
    // owns — which would make the ciphertext at rest worth nothing.
    //
    // Only `secret` as a property *value* counts. Matching the bare word would
    // flag `{ error: "Could not rotate the secret" }` and the `signPayload(secret,
    // ...)` call argument, neither of which reveals anything.
    const text = read("routes/webhooks.ts");
    const responses = [...text.matchAll(/\bres\.(?:json|status\([^)]*\)\.json)\(([\s\S]*?)\);/g)].map((m) => m[1]!);
    const revealsSecret = responses.filter((body) => {
      const withoutStrings = body.replace(/"[^"]*"/g, '""');
      return /[{,]\s*secret\s*[,}]/.test(withoutStrings);
    });
    expect(revealsSecret).toHaveLength(2);
    // One carries the endpoint, the other only the rotated secret.
    expect(revealsSecret.some((b) => b.includes("shapeEndpoint"))).toBe(true);
    expect(revealsSecret.some((b) => b.trim() === "{ secret }")).toBe(true);
  });

  it("shapes endpoint rows through shapeEndpoint rather than returning them raw", () => {
    // `shapeEndpoint` is what strips `secretEnc`. Returning a drizzle row
    // directly would include it, and nothing in the type system objects.
    const text = read("routes/webhooks.ts");
    expect(text).toContain("function shapeEndpoint(");
    expect(text).not.toMatch(/res\.json\(\{\s*endpoint:\s*row\s*\}\)/);
    expect(text).not.toMatch(/res\.json\(\{\s*endpoints:\s*endpoints\s*\}\)/);
  });

  it("keeps the ciphertext out of the shape it sends", () => {
    const text = read("routes/webhooks.ts");
    const shape = text.slice(text.indexOf("function shapeEndpoint("), text.indexOf("/** Load an endpoint"));
    for (const column of ENCRYPTED_COLUMNS) {
      expect(shape, column).not.toContain(`${column}:`);
    }
    expect(shape).toContain("secretHint");
  });

  it("shapes connections through shapeConnection, which reports only hasRefreshToken", () => {
    // The column must not appear as an *output key*. Reading `row.refreshTokenEnc`
    // to compute `hasRefreshToken: Boolean(...)` is the point — the UI needs to
    // know whether a refresh is possible without being handed the token.
    const text = read("routes/integrations.ts");
    const shape = text.slice(text.indexOf("function shapeConnection("), text.indexOf("// ─── LIST"));
    for (const column of ["accessTokenEnc", "refreshTokenEnc", "secretEnc"]) {
      expect(shape, `${column} must not be returned`).not.toContain(`${column}:`);
    }
    expect(shape).toContain("hasRefreshToken: Boolean(row.refreshTokenEnc)");
  });

  it("never puts a token into the stored metadata blob", () => {
    // `metadata.raw` keeps the provider's response for debugging. Storing the
    // whole response would put an access token in plaintext JSONB *next to* the
    // encrypted copy, quietly defeating the encryption.
    expect(read("lib/integrations.ts")).toContain("summariseTokenResponse");
    const text = read("lib/integrations.ts");
    expect(text).toContain('REDACTED.has(k)');
    expect(text).toMatch(/metadata:\s*\{\s*raw:\s*summariseTokenResponse/);
  });
});

describe("URLs are validated before every fetch", () => {
  it("validates on the way in and again before sending", () => {
    // Two layers on purpose: the check at save time cannot see a hostname that
    // is repointed at a private address afterwards, and the check at send time
    // cannot see a URL that was never validated. The delivery worker is the one
    // that actually opens the connection.
    const routes = read("routes/webhooks.ts");
    const validations = [...routes.matchAll(/validateWebhookUrl\(/g)].length;
    expect(validations).toBeGreaterThanOrEqual(3);
    expect(routes).toContain("UNSAFE_WEBHOOK_URL");
  });

  it("does not follow redirects, which would escape the check", () => {
    // A 302 to 169.254.169.254 happens after the URL check, so `follow` would
    // make the validation decorative.
    const lib = read("lib/webhooks.ts");
    expect(lib).toContain('redirect: "manual"');
  });

  it("blocks the metadata range and the private ranges", () => {
    const lib = read("lib/webhooks.ts");
    expect(lib).toContain("169 && b === 254");
    expect(lib).toContain("isPrivateIpv4");
    expect(lib).toContain("isPrivateIpv6");
  });
});

describe("the delivery worker cannot lose or duplicate an event", () => {
  it("claims with a status predicate, so two workers cannot both send", () => {
    const lib = read("lib/webhooks.ts");
    expect(lib).toContain('eq(webhookDeliveriesTable.status, "pending")');
    expect(lib).toContain('status: "sending"');
    // The claim must be conditional; an unconditional update would let both
    // workers proceed.
    expect(lib).toMatch(/\.where\(and\(eq\(webhookDeliveriesTable\.id, row\.id\), eq\(webhookDeliveriesTable\.status, "pending"\)\)\)/);
  });

  it("reclaims rows abandoned by a crashed process", () => {
    // Without this a row stays `sending` forever: invisible to the user and to
    // the retry worker.
    expect(read("lib/webhooks.ts")).toContain("reclaimStuckDeliveries");
    expect(read("lib/webhookWorker.ts")).toContain("reclaimStuckDeliveries");
  });

  it("does not mark a row failed on a non-retryable status before recording the response", () => {
    const lib = read("lib/webhooks.ts");
    expect(lib).toContain("isRetryableStatus");
    expect(lib).toContain("responseStatus: outcome.status ?? null");
  });

  it("signs the body with the timestamp, so a capture cannot be replayed", () => {
    const lib = read("lib/webhooks.ts");
    expect(lib).toContain("`${timestamp}.${body}`");
    expect(lib).toContain("parseSignatureHeader");
  });
});

describe("the callback cannot be used without a verified state", () => {
  it("is not behind authMiddleware, and derives the user from the state", () => {
    // The browser arrives from a third-party origin with no bearer token, so
    // authMiddleware cannot be used — which makes the state the *only*
    // authentication on this route. Reading a user id from anywhere else here
    // would be account takeover.
    const text = read("routes/integrations.ts");
    const callback = text.slice(
      text.indexOf('integrationsRouter.get("/integrations/:provider/callback"'),
      text.indexOf("// ─── REFRESH"),
    );
    expect(callback).not.toContain("authMiddleware");
    expect(callback).toContain("verifyState(req.query.state");
    expect(callback).toContain("state.userId");
    // No path where the handler reads an identity out of the query string.
    expect(callback).not.toMatch(/req\.query\.(userId|user_id)/);
  });

  it("refuses to proceed when the state is bad, before looking at the code", () => {
    const text = read("routes/integrations.ts");
    const callback = text.slice(
      text.indexOf('integrationsRouter.get("/integrations/:provider/callback"'),
      text.indexOf("// ─── REFRESH"),
    );
    const stateCheck = callback.indexOf("if (!state)");
    const codeCheck = callback.indexOf("if (!code)");
    expect(stateCheck).toBeGreaterThan(-1);
    expect(stateCheck).toBeLessThan(codeCheck);
  });
});
