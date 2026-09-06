import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isDisallowed, parseDirectiveLines, parseRobots, robotsMetaFor } from "./robots-parse.mjs";

/**
 * The robots.txt reader the prerenderer and the build gate share.
 *
 * These tests are written against the bug this file shipped with: an edit dropped a
 * newline and `Disallow: /adminDisallow: /onboarding` went out as one line. That is
 * not a syntax error to a lenient parser — it is one path no URL will ever match, so
 * two private areas became crawlable while the file still looked correct.
 */
const SAMPLE = [
  "# FocusArx robots.txt",
  "User-agent: *",
  "Allow: /",
  "Disallow: /admin",
  "Disallow: /api/",
  "Allow: /api/sitemap.xml",
  "",
  "User-agent: AdsBot-Google",
  "Allow: /",
  "",
  "Sitemap: https://focusarx.site/sitemap.xml",
].join("\n");

describe("parseDirectiveLines", () => {
  it("accepts a well-formed file without complaint", () => {
    expect(parseDirectiveLines(SAMPLE).filter((entry) => entry.error)).toEqual([]);
  });

  it("flags two directives merged onto one line", () => {
    const broken = "User-agent: *\nDisallow: /adminDisallow: /onboarding\n";
    const [userAgent, merged] = parseDirectiveLines(broken);
    expect(userAgent.error).toBeUndefined();
    expect(merged.error).toMatch(/not a single/);
    expect(merged.line).toBe(2);
  });

  it("flags a directive whose path went missing", () => {
    const [, orphan] = parseDirectiveLines("User-agent: *\nDisallow:\n");
    expect(orphan.error).toMatch(/not a single/);
  });

  it("ignores comments and blank lines", () => {
    expect(parseDirectiveLines("# hello\n\n   \nAllow: /\n").map((e) => e.field)).toEqual(["allow"]);
  });

  it("rejects an unknown field instead of treating it as a path", () => {
    expect(parseDirectiveLines("Crawl-delayy: 30")[0].error).toBeDefined();
  });
});

describe("parseRobots", () => {
  it("groups directives by user-agent", () => {
    const { groups } = parseRobots(SAMPLE);
    expect([...groups.keys()]).toEqual(["*", "AdsBot-Google"]);
    expect(groups.get("*").disallow).toEqual(["/admin", "/api/"]);
    expect(groups.get("AdsBot-Google").allow).toEqual(["/"]);
  });

  it("collects merged-line errors for the caller to fail on", () => {
    const { errors } = parseRobots("User-agent: *\nDisallow: /xDisallow: /y\n");
    expect(errors).toHaveLength(1);
  });
});

describe("isDisallowed", () => {
  const { groups } = parseRobots(SAMPLE);
  const wildcard = groups.get("*");

  it.each([
    ["/admin", true, "the private console"],
    ["/admin/users", true, "anything under it"],
    // Prefix matching is literal, so a short Disallow sweeps in unrelated routes.
    // The shipped file lists precise paths for exactly this reason.
    ["/administrative", true, "a longer path sharing the prefix"],
    ["/api", false, "the bare /api is not under /api/"],
    ["/api/sessions", true, "the API"],
    ["/api/sitemap.xml", false, "unless an Allow is more specific"],
    ["/", false, "the site root"],
    ["/premium", false, "an unrelated path"],
  ])("%s → %s (%s)", (path, expected) => {
    expect(isDisallowed(path, wildcard)).toBe(expected);
  });

  it("honours a trailing $ as an exact end-anchor, which is how source maps are blocked", () => {
    const group = { allow: [], disallow: ["/*.map$"] };
    expect(isDisallowed("/assets/app.js.map", group)).toBe(true);
    expect(isDisallowed("/assets/app.js", group)).toBe(false);
  });

  it("treats a missing group as fully allowed", () => {
    expect(isDisallowed("/admin", undefined)).toBe(false);
  });
});

describe("robotsMetaFor", () => {
  const { groups } = parseRobots(SAMPLE);

  it("keeps public pages indexable", () => {
    expect(robotsMetaFor("/guides", groups)).toContain("index, follow");
  });

  it("marks a disallowed page noindex, which is the only signal that removes an already-known URL", () => {
    expect(robotsMetaFor("/admin", groups)).toBe("noindex, nofollow");
    expect(robotsMetaFor("/admin/users", groups)).toBe("noindex, nofollow");
  });

  it("applies to the real file: every private screen it disallows is noindex, and no public page is", () => {
    const { groups: shipped } = parseRobots(readFileSync(resolve(process.cwd(), "public/robots.txt"), "utf8"));
    const PUBLIC = ["/", "/focus-timer", "/pomodoro-guide", "/guides", "/exam", "/blog"];
    const PRIVATE = ["/admin", "/premium", "/achievements", "/onboarding", "/wallet", "/session-replay"];
    for (const path of PUBLIC) expect(robotsMetaFor(path, shipped)).toContain("index, follow");
    for (const path of PRIVATE) expect(robotsMetaFor(path, shipped)).toBe("noindex, nofollow");
  });

  it("agrees with index.html's own default, so no page changes on the way to production", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const shipped = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/)[1];
    expect(robotsMetaFor("/guides", groups)).toBe(shipped);
  });
});
