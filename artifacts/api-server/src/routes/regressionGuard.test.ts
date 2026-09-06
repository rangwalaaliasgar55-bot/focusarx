import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ══════════════════════════════════════════════════════════════════
 * Regression barricade
 * ══════════════════════════════════════════════════════════════════
 *
 * Each test here pins a specific defect that shipped silently — no build
 * error, no type error, nothing in the network tab. They are written as source
 * contracts so the failure message names the file and line to fix.
 *
 *  1. `checkAdminAuth` mounted as Express middleware (request hangs forever)
 *  2. Unclamped `parseInt` fed to Drizzle `.limit()/.offset()` (500s / scans)
 *  3. Sitemap listing pages robots.txt disallows (contradictory crawl signal)
 *  4. Sitemap listing login-walled routes (soft-404 thin pages)
 *  5. Missing / malformed ads.txt (AdSense cannot verify the site)
 *  6. CSP missing the AdSense origins (ads silently blocked)
 *  7. Duplicate AdSense slot ids (units cannibalise each other)
 *  8. Auth routes with no rate limiter (unbounded account/token minting)
 *  9. `console.*` in server code (bypasses pino → no structured logs)
 * 10. Sitemap host disagreeing with the canonical host (duplicate content)
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const API_SRC = path.resolve(here, "..");
const FRONTEND = path.resolve(here, "../../../focusarx");
const REPO_ROOT = path.resolve(here, "../../../../");

function walk(dir: string, filter: RegExp, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, acc);
    else if (filter.test(entry.name)) acc.push(full);
  }
  return acc;
}

function read(p: string): string {
  return fs.readFileSync(p, "utf8");
}

const routeFiles = () => walk(path.join(API_SRC, "routes"), /\.ts$/).filter((f) => !f.endsWith(".test.ts"));

describe("1. admin auth predicate is never mounted as middleware", () => {
  it("checkAdminAuth is always awaited inside a handler, never passed to a route", () => {
    const offenders: string[] = [];
    for (const file of routeFiles()) {
      const s = read(file);
      for (const line of s.split("\n")) {
        if (!line.includes("checkAdminAuth")) continue;
        if (/^\s*(import|export|\/\/|\*)/.test(line)) continue;
        // A route chain passes it bare: router.get("/x", auth, checkAdminAuth, ...)
        // A correct call awaits it: `if (!await checkAdminAuth(req))`.
        const bare = /,\s*checkAdminAuth\s*[,)]/.test(line);
        const awaited = /await\s+checkAdminAuth\s*\(/.test(line);
        if (bare && !awaited) offenders.push(`${path.relative(REPO_ROOT, file)}: ${line.trim()}`);
      }
    }
    expect(
      offenders,
      `checkAdminAuth returns Promise<boolean> and never calls next(), so mounting it\n` +
        `as middleware hangs the request until the platform kills it. Use requireAdmin:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("requireAdmin has arity 3 so Express treats it as request middleware", () => {
    const s = read(path.join(API_SRC, "lib/adminAuth.ts"));
    const m = s.match(/export async function requireAdmin\s*\(([^)]*)\)/s);
    expect(m, "requireAdmin not found in lib/adminAuth.ts").toBeTruthy();
    expect(m![1]!.split(",").filter((p) => p.trim()).length).toBe(3);
  });
});

describe("2. query limits are always clamped before hitting the database", () => {
  it("no route passes raw parseInt() to .limit() or .offset()", () => {
    const offenders: string[] = [];
    for (const file of [...routeFiles(), ...walk(path.join(API_SRC, "lib"), /\.ts$/)]) {
      if (file.endsWith(".test.ts")) continue;
      const s = read(file);
      s.split("\n").forEach((line, i) => {
        if (/\.(limit|offset)\(\s*parseInt\(/.test(line) || /\.(limit|offset)\(\s*Number\(\s*req\.query/.test(line)) {
          offenders.push(`${path.relative(REPO_ROOT, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      `Unclamped pagination — \`?limit=100000\` runs an unbounded scan and\n` +
        `\`?offset=abc\` yields NaN, which Postgres rejects with a 500.\n` +
        `Use parseLimit/parseOffset from lib/pagination.ts:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

/** Pull the URL literals out of the sitemap source. */
function sitemapUrls(): string[] {
  const s = read(path.join(API_SRC, "routes/sitemap.ts"));
  const urls: string[] = [];
  const re = /\{\s*url:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) urls.push(m[1]!);
  // Exam cluster is generated from a slug list.
  const slugBlock = s.match(/const EXAM_SLUGS = \[([\s\S]*?)\];/);
  if (slugBlock) {
    urls.push("/exam");
    for (const sm of slugBlock[1]!.matchAll(/"([^"]+)"/g)) urls.push(`/exam/${sm[1]}`);
  }
  return urls;
}

/** Paths robots.txt tells crawlers not to fetch. */
function robotsDisallowed(): string[] {
  const s = read(path.join(FRONTEND, "public/robots.txt"));
  return [...s.matchAll(/^Disallow:\s*(\S+)/gm)].map((m) => m[1]!);
}

describe("3. sitemap and robots.txt never contradict each other", () => {
  it("every sitemap URL is allowed by robots.txt", () => {
    const urls = sitemapUrls();
    expect(urls.length).toBeGreaterThan(30);
    const disallowed = robotsDisallowed();
    const conflicts = urls.filter((u) =>
      disallowed.some((d) => {
        const base = d.replace(/\/$/, "");
        return base && (u === base || u.startsWith(base.endsWith("*") ? base.slice(0, -1) : base + "/") || u === base);
      }),
    );
    expect(
      conflicts,
      `These URLs are in the sitemap but Disallow:ed in robots.txt — Google sees a\n` +
        `contradiction and drops the pages from the index:\n  ${conflicts.join("\n  ")}`,
    ).toEqual([]);
  });
});

describe("4. sitemap only contains publicly crawlable routes", () => {
  it("no login-walled route appears in the sitemap", () => {
    const app = read(path.join(FRONTEND, "src/App.tsx"));
    const protectedPaths = new Set<string>();
    for (const m of app.matchAll(/<Route\s+path="([^"]+)"[^>]*component=\{\(\)\s*=>\s*<ErrorBoundary><ProtectedRoute/g)) {
      protectedPaths.add(m[1]!);
    }
    expect(protectedPaths.size).toBeGreaterThan(20); // guard against a broken extractor

    const urls = sitemapUrls();
    const leaks = urls.filter((u) => protectedPaths.has(u));
    expect(
      leaks,
      `Login-walled routes in the sitemap. Anonymous crawlers hit these, get\n` +
        `redirected to /login, and Google indexes thin soft-404 pages:\n  ${leaks.join("\n  ")}`,
    ).toEqual([]);
  });
});

describe("5. ads.txt", () => {
  it("exists at the web root and is well formed", () => {
    const p = path.join(FRONTEND, "public/ads.txt");
    expect(fs.existsSync(p), "public/ads.txt is missing — AdSense cannot verify the site").toBe(true);
    const line = read(p)
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#"));
    expect(line, "ads.txt has no directive line").toBeTruthy();
    const parts = line!.split(",").map((s) => s.trim());
    expect(parts[0]).toBe("google.com");
    expect(parts[1]).toMatch(/^pub-\d+$/);
    expect(parts[2]).toMatch(/^(DIRECT|RESELLER)$/i);
    expect(parts[3]).toMatch(/^[a-f0-9]{16}$/i);
  });

  it("declares the same publisher id as the ad component", () => {
    const adsTxt = read(path.join(FRONTEND, "public/ads.txt"));
    const component = read(path.join(FRONTEND, "src/components/AdSense.tsx"));
    const inTxt = adsTxt.match(/pub-\d+/)?.[0];
    const inCode = component.match(/pub-\d+/)?.[0];
    expect(inTxt).toBeTruthy();
    expect(inCode, "AdSense.tsx no longer carries a publisher id").toBeTruthy();
    expect(inTxt).toBe(inCode);
  });
});

describe("6. CSP permits the AdSense origins", () => {
  it("script-src, frame-src and connect-src allow the ad domains", () => {
    const app = read(path.join(API_SRC, "app.ts"));
    const csp = app.slice(app.indexOf("contentSecurityPolicy"), app.indexOf("crossOriginEmbedderPolicy"));
    for (const origin of [
      "https://pagead2.googlesyndication.com",
      "https://tpc.googlesyndication.com",
      "https://*.doubleclick.net",
    ]) {
      expect(csp, `CSP is missing ${origin} — ads will be blocked`).toContain(origin);
    }
    // frame-src must not be 'none', or every ad iframe is blocked.
    expect(csp).toMatch(/frameSrc:\s*\[[\s\S]*?googlesyndication/);
    expect(csp).not.toMatch(/frameSrc:\s*\[\s*"none"/);
  });

  it("does not reinstate a COEP that blocks ad iframes", () => {
    const s = read(path.join(API_SRC, "middlewares/security.ts"));
    expect(s).toContain('"Cross-Origin-Embedder-Policy", "unsafe-none"');
  });
});

describe("7. AdSense slot ids are unique", () => {
  it("no two placements share a slot id", () => {
    const s = read(path.join(FRONTEND, "src/lib/adSlots.ts"));
    const ids = [...s.matchAll(/slot:\s*"(\d+)"/g)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThan(5);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes, `Duplicate ad slot ids: ${[...new Set(dupes)].join(", ")}`).toEqual([]);
  });

  it("every AdSlot name used in JSX exists in the registry", () => {
    const registry = new Set(
      [...read(path.join(FRONTEND, "src/lib/adSlots.ts")).matchAll(/^\s+(\w+):\s*\{ slot:/gm)].map((m) => m[1]!),
    );
    const used = new Set<string>();
    for (const file of walk(path.join(FRONTEND, "src"), /\.tsx$/)) {
      for (const m of read(file).matchAll(/<AdSlot\s+name="(\w+)"/g)) used.add(m[1]!);
    }
    expect(used.size).toBeGreaterThan(0);
    const unknown = [...used].filter((n) => !registry.has(n));
    expect(unknown, `AdSlot names not in the registry: ${unknown.join(", ")}`).toEqual([]);
  });
});

describe("8. every credential-issuing auth route is rate limited", () => {
  it("login, register, guest and refresh all carry a limiter", () => {
    const s = read(path.join(API_SRC, "routes/auth.ts"));
    for (const route of ["/auth/login", "/auth/register", "/auth/guest", "/auth/refresh"]) {
      const m = s.match(new RegExp(`router\\.post\\("${route.replace(/\//g, "\\/")}",\\s*([^,]+),`));
      expect(m, `POST ${route} has no middleware — it is an unbounded account/token minting endpoint`).toBeTruthy();
      expect(m![1]!.trim(), `POST ${route} is missing a rate limiter`).toMatch(/Limiter$/);
    }
  });

  it("the track limiter is not keyed on a client-supplied value", () => {
    const s = read(path.join(API_SRC, "lib/rateLimiter.ts"));
    const track = s.slice(s.indexOf("export const trackLimiter"), s.indexOf("export const adminLimiter"));
    // Strip comments first — the explanatory note about the old bug mentions
    // the field by name, and that is not the same as the code reading it.
    const code = track.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(
      code,
      "trackLimiter must key on IP only — body.visitorId is client-supplied and\n" +
        "rotating it per request gives any caller an unlimited budget.",
    ).not.toContain("visitorId");
    expect(code, "trackLimiter lost its keyGenerator").toMatch(/keyGenerator:\s*ipKey/);
  });

  it("AI limiters key on identity, not the rotating bearer token", () => {
    const s = read(path.join(API_SRC, "lib/rateLimiter.ts"));
    expect(s).toContain("keyGenerator: (req) => `roadmap:${userKey(req)}`");
    expect(s).toContain("keyGenerator: (req) => `coach:${userKey(req)}`");
  });
});

describe("9. server code logs through pino, not console", () => {
  it("no console.* calls in routes/ or lib/ (bootstrap files excepted)", () => {
    // config.ts and env.ts run during process bootstrap, before the pino logger
    // is constructed; console is the only channel available there.
    const BOOTSTRAP_ALLOWLIST = new Set(["config.ts", "env.ts"]);
    const offenders: string[] = [];
    for (const file of [...routeFiles(), ...walk(path.join(API_SRC, "lib"), /\.ts$/)]) {
      if (file.endsWith(".test.ts")) continue;
      if (BOOTSTRAP_ALLOWLIST.has(path.basename(file))) continue;
      read(file).split("\n").forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (/console\.(log|error|warn|info)\(/.test(line)) {
          offenders.push(`${path.relative(REPO_ROOT, file)}:${i + 1}`);
        }
      });
    }
    expect(offenders, `Use the pino logger — console output is unstructured and\nunqueryable in production:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("10. sitemap host matches the canonical host", () => {
  it("sitemap default base matches the canonical host used by index.html", () => {
    const sitemap = read(path.join(API_SRC, "routes/sitemap.ts"));
    const index = read(path.join(FRONTEND, "index.html"));

    const canonical = index.match(/rel="canonical"\s+href="(https:\/\/[^/]+)/)?.[1];
    expect(canonical, "no canonical link in index.html").toBeTruthy();

    const fallback = sitemap.match(/return fromEnv \|\| "(https:\/\/[^"]+)"/)?.[1];
    expect(fallback, "could not find the sitemap base-URL fallback").toBeTruthy();
    expect(
      fallback,
      `Sitemap falls back to ${fallback} but the canonical host is ${canonical}.\n` +
        `Mismatched hosts make every URL a cross-host duplicate.`,
    ).toBe(canonical);

    const robotsSitemap = read(path.join(FRONTEND, "public/robots.txt")).match(/^Sitemap:\s*(\S+)/m)?.[1];
    expect(robotsSitemap?.startsWith(canonical!), "robots.txt Sitemap: uses a different host").toBe(true);
  });

  it("the static sitemap index is valid XML and points at the canonical apex host", () => {
    const xml = read(path.join(FRONTEND, "public/sitemap.xml"));
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("https://focusarx.site/");
    expect(xml).not.toContain("//www.focusarx.site"); // www — would cross-host duplicate
    // Balanced elements — strip the XML comment first, since the explanatory
    // header legitimately mentions <sitemap> in prose.
    const body = xml.replace(/<!--[\s\S]*?-->/g, "");
    const opens = (body.match(/<sitemap>/g) ?? []).length;
    const closes = (body.match(/<\/sitemap>/g) ?? []).length;
    expect(opens).toBeGreaterThan(0);
    expect(opens, "unbalanced <sitemap> elements in the static index").toBe(closes);
    expect((body.match(/<loc>/g) ?? []).length).toBe(opens);
  });
});

describe("11. health endpoint does not leak database internals", () => {
  it("returns a generic message to unauthenticated callers", () => {
    const s = read(path.join(API_SRC, "routes/health.ts"));
    expect(s).toContain('payload.message = "database unavailable"');
    // The raw driver message must only be attached behind the admin check.
    const adminIdx = s.indexOf("checkAdminAuth");
    const rawIdx = s.indexOf("cause ? `${base}: ${cause}` : base");
    expect(adminIdx).toBeGreaterThan(-1);
    expect(rawIdx).toBeGreaterThan(adminIdx);
  });
});

describe("12. sitemap system is wired up", () => {
  it("the sitemap router is mounted at the host root as well as /api", () => {
    const app = read(path.join(API_SRC, "app.ts"));
    expect(app).toContain('import { sitemapRouter } from "./routes/sitemap"');
    expect(app, "sitemapRouter must be mounted at the root for crawlers").toMatch(/app\.use\(sitemapRouter\)/);
  });

  it("vercel.json rewrites the root sitemap paths to the function", () => {
    const cfg = JSON.parse(read(path.join(REPO_ROOT, "vercel.json")));
    const srcs = (cfg.routes ?? []).map((r: { src?: string }) => r.src);
    expect(srcs).toContain("/sitemap\\.xml");
    expect(srcs.some((s: string) => /sitemap-\[/.test(s))).toBe(true);
    // The rewrites must precede the filesystem handler.
    const rewriteIdx = srcs.indexOf("/sitemap\\.xml");
    const fsIdx = (cfg.routes ?? []).findIndex((r: { handle?: string }) => r.handle === "filesystem");
    expect(rewriteIdx).toBeLessThan(fsIdx);
  });
});

describe("13. premium entitlement is never derived from client input", () => {
  it("no route reads a premium flag off the request body or headers", () => {
    const offenders: string[] = [];
    for (const file of routeFiles()) {
      read(file).split("\n").forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        // A client-controlled premium flag is an entitlement bypass.
        if (/req\.body[^;]*\b(isPremium|premiumStatus|isPro)\b/.test(line)) {
          offenders.push(`${path.relative(REPO_ROOT, file)}:${i + 1}: ${line.trim()}`);
        }
        if (/headers\[[^\]]*premium/i.test(line)) {
          offenders.push(`${path.relative(REPO_ROOT, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      `Premium must be resolved server-side via isUserPremium/requirePremium —\n` +
        `a client-supplied flag is a free entitlement bypass:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("isUserPremium fails closed on any database error", () => {
    const s = read(path.join(API_SRC, "lib/premiumCheck.ts"));
    const fn = s.slice(s.indexOf("export async function isUserPremium"));
    const catchIdx = fn.indexOf("} catch (err) {");
    expect(catchIdx, "isUserPremium has no error handling").toBeGreaterThan(-1);
    expect(fn.slice(catchIdx, catchIdx + 200), "must deny, never grant, on error").toMatch(/return false;/);
  });

  it("premium lookup reads the entitlements table as well as the legacy one", () => {
    const s = read(path.join(API_SRC, "lib/premiumCheck.ts"));
    // The purchase path dual-writes both tables inside a try/catch with an
    // empty catch, so a failed backfill used to deny a paying user.
    expect(s).toContain("premiumEntitlementsTable");
    expect(s).toContain("hasActiveEntitlement");
  });

  it("the premium-track battle pass re-verifies entitlement server-side", () => {
    const s = read(path.join(API_SRC, "routes/battlePassEnhanced.ts"));
    const claim = s.slice(s.indexOf('router.post("/battle-pass/claim"'));
    const premiumCheck = claim.indexOf("await isUserPremium(req.userId!)");
    expect(premiumCheck, "premium track claim no longer verifies membership").toBeGreaterThan(-1);
    expect(claim.slice(0, premiumCheck)).toContain("if (isPremiumReward)");
  });

  it("list endpoints use the batched premium lookup, not a per-row query", () => {
    const s = read(path.join(API_SRC, "routes/social.ts"));
    expect(
      s,
      "leaderboard regressed to a per-row isUserPremium loop (N+1 — up to 200\nround trips per request). Use isUsersPremium().",
    ).not.toMatch(/map\(async r => \[r\.userId, await isUserPremium/);
    expect(s).toContain("await isUsersPremium(");
  });
});

describe("14. realtime resources are bounded", () => {
  it("the bot-banter throttle map has a size cap", () => {
    const s = read(path.join(API_SRC, "lib/socketManager.ts"));
    expect(s, "lastBotBanter must be bounded — it is keyed by roomId and\nnever otherwise evicted").toContain("BANTER_MAP_MAX");
    expect(s).toMatch(/if \(lastBotBanter\.size >= BANTER_MAP_MAX\)/);
  });

  it("banter stops emitting once a room is empty", () => {
    const s = read(path.join(API_SRC, "lib/socketManager.ts"));
    const emit = s.slice(s.indexOf("const emitNext = () => {"));
    expect(
      emit.slice(0, 400),
      "the banter timer chain must check room occupancy — otherwise it keeps\n" +
        "broadcasting to a room nobody is in.",
    ).toMatch(/adapter\.rooms\.get\(`room:\$\{roomId\}`\)/);
  });
});

describe("15. mobile layout and build hygiene", () => {
  const css = () => read(path.join(FRONTEND, "src/index.css"));

  it("bottom-nav clearance is scoped to the mobile breakpoint", () => {
    const s = css();
    // A top-level rule here wins the cascade at every breakpoint and adds
    // 72px of dead space on desktop, where the bottom nav is `md:hidden`.
    for (const selector of [".app-shell", ".app-main"]) {
      const topLevel = new RegExp(`^${selector.replace(".", "\\.")} \\{[^}]*padding-bottom: calc\\(72px`, "m");
      expect(
        topLevel.test(s),
        `${selector} reserves 72px for the bottom nav at ALL breakpoints.\n` +
          `Wrap it in @media (max-width: 767px) — the nav is md:hidden.`,
      ).toBe(false);
    }
    // …but it must still be present for mobile, or content hides under the nav.
    const mobileBlock = s.slice(s.indexOf("@media (max-width: 767px) {"));
    expect(mobileBlock).toContain(".app-shell");
  });

  it("viewport meta is mobile-correct", () => {
    const html = read(path.join(FRONTEND, "index.html"));
    const vp = html.match(/name="viewport"\s+content="([^"]+)"/)?.[1] ?? "";
    expect(vp).toContain("width=device-width");
    expect(vp, "viewport-fit=cover is required for notch safe-area insets").toContain("viewport-fit=cover");
    expect(vp, "user-scalable=no breaks pinch-zoom and fails WCAG 1.4.4").not.toMatch(/user-scalable\s*=\s*no/);
  });

  it("build chunking uses the function form so vendor-react is not empty", () => {
    const s = read(path.join(FRONTEND, "vite.config.ts"));
    // The object form produced "Generated an empty chunk: vendor-react", which
    // inlined react+react-dom into the entry bundle (375 kB on every page).
    expect(s, "manualChunks must use the function form").toMatch(/manualChunks\s*\(\s*id\s*(,[^)]*)?\)/);
    expect(s).toMatch(/return "vendor-react"/);
    // three must be split off — it is ~730 kB and only 3D pages need it.
    expect(s).toMatch(/return "vendor-three"/);
    expect(s, "recharts/d3 must not sit in the entry chunk").toMatch(/return "vendor-charts"/);
  });

  it("the AdSense loader is identified so it is never injected twice", () => {
    const html = read(path.join(FRONTEND, "index.html"));
    const component = read(path.join(FRONTEND, "src/components/AdSense.tsx"));
    expect(html).toContain('id="adsbygoogle-js"');
    expect(component, "AdSense.tsx must check for the existing loader").toContain("adsbygoogle-js");
    // The loader must stay async — a sync third-party script blocks first paint.
    expect(html.slice(html.indexOf("adsbygoogle-js"), html.indexOf("adsbygoogle-js") + 400)).toMatch(/async/);
  });

  it("ads reserve layout height so filling them causes no CLS", () => {
    const s = read(path.join(FRONTEND, "src/components/AdSense.tsx"));
    expect(s).toContain("MIN_HEIGHT");
    expect(s).toMatch(/minHeight:\s*reserved/);
  });
});
