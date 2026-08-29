import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Contract guard: every `/api/...` endpoint the web app calls must have a
 * matching route registered on the API server.
 *
 * This exists because the frontend and backend drifted silently several times:
 *   - GET  /api/stats/streak        -> 404 (dashboard streak widgets rendered nothing)
 *   - POST /api/social/requests     -> 404 (friend requests could not be sent)
 *   - POST /api/social/requests/:id/accept|reject, DELETE .../:id -> 404
 *   - POST /api/mood                -> 404 (energy check-in discarded)
 *   - GET  /api/sessions            -> 404 (constellations fallback)
 * Each one is a plain 404 in the network tab with no build or type error, so
 * nothing else in the pipeline catches it.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_SRC = path.resolve(here, "../../../focusarx/src");
const ROUTES_DIR = path.resolve(here, ".");

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

function walk(dir: string, filter: RegExp, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, acc);
    else if (filter.test(entry.name)) acc.push(full);
  }
  return acc;
}

/** Strip `//` line comments so commented-out example calls are not counted. */
function stripLineComments(source: string): string {
  return source.replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

/** Turn `/api/social/requests/${id}/accept` and `/social/requests/:id/accept`
 *  into one comparable key. */
function normalize(p: string): string {
  return p
    .replace(/\?.*$/, "")
    .replace(/\/api\//, "/")
    .replace(/\$\{[^}]*\}/g, ":p")
    .replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ":p")
    .replace(/\/+$/, "")
    .toLowerCase();
}

/** Extract `apiJson` / `apiFetch` / `fetch` calls made against /api. */
function frontendCalls(): Array<{ method: string; path: string; file: string }> {
  const calls: Array<{ method: string; path: string; file: string }> = [];
  const nameRe = /\b(apiJson|apiFetch|apiUpload|fetch)\s*/g;

  for (const file of walk(FRONTEND_SRC, /\.(ts|tsx)$/)) {
    const s = stripLineComments(fs.readFileSync(file, "utf8"));
    const rel = path.relative(FRONTEND_SRC, file);
    let m: RegExpExecArray | null;
    nameRe.lastIndex = 0;

    while ((m = nameRe.exec(s))) {
      let i = m.index + m[0].length;

      // Skip a balanced generic argument, e.g. apiJson<{ streak: StreakInfo }>
      if (s[i] === "<") {
        let depth = 0;
        for (; i < s.length; i++) {
          if (s[i] === "<") depth++;
          else if (s[i] === ">") {
            depth--;
            if (depth === 0) {
              i++;
              break;
            }
          }
        }
      }
      while (i < s.length && /\s/.test(s[i]!)) i++;
      if (s[i] !== "(") continue;

      i++;
      while (i < s.length && /\s/.test(s[i]!)) i++;
      const quote = s[i];
      if (quote !== '"' && quote !== "'" && quote !== "`") continue;

      let j = i + 1;
      let buf = "";
      while (j < s.length && s[j] !== quote) {
        if (s[j] === "\\") {
          buf += s[j + 1];
          j += 2;
          continue;
        }
        buf += s[j];
        j++;
      }
      if (!buf.startsWith("/api")) continue;

      // Look at the init object for an explicit method (defaults to GET).
      let k = j + 1;
      let depth = 0;
      let init = "";
      if (s[k] === ",") {
        k++;
        for (; k < s.length; k++) {
          const c = s[k]!;
          if ("({[".includes(c)) depth++;
          else if (")}]".includes(c)) {
            if (depth === 0) break;
            depth--;
          }
          init += c;
        }
      }
      // An explicit literal (`method: "POST"`) is checked strictly.
      // A dynamic method — `method` shorthand, or `method,` a variable with a
      // default — cannot be resolved statically, so it is recorded as "*" and
      // matched against any verb. Defaulting those to GET produced a false
      // positive: `/api/developer/users/${action}` is only ever POST or DELETE,
      // and the contract test reported a missing "GET /developer/users/:p".
      // The path still has to exist with the right arity, so the guard keeps
      // its value; only the verb check is relaxed for the unresolvable cases.
      const literal = init.match(/method:\s*["'`]([A-Z]+)["'`]/)?.[1];
      const method = literal ?? (/method\b/.test(init) ? "*" : "GET");
      calls.push({ method, path: buf, file: rel });
    }
  }
  return calls;
}

/** Collect every route the API registers, split into comparable segments. */
function backendRoutes(): Array<{ method: string; segments: string[] }> {
  const routes: Array<{ method: string; segments: string[] }> = [];
  // `router.get("/x"`, `socialRouter.post("/x"`, `app.use("/x", router)` etc.
  const routeRe = new RegExp(
    `\\.(${HTTP_METHODS.join("|")})\\(\\s*["'\`]([^"'\`]+)["'\`]`,
    "g",
  );

  for (const file of walk(ROUTES_DIR, /\.ts$/)) {
    if (/\.test\.ts$/.test(file)) continue;
    const s = fs.readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    routeRe.lastIndex = 0;
    while ((m = routeRe.exec(s))) {
      routes.push({
        method: m[1]!.toUpperCase(),
        segments: normalize(m[2]!).split("/").filter(Boolean),
      });
    }
  }
  return routes;
}

/**
 * A frontend `${...}` template segment is fully dynamic, so it may stand for
 * any backend segment. That matters for paths assembled from a union, e.g.
 * `/api/admin/moderation/${postId}/${action}` where action is "approve" |
 * "reject" and the backend declares two literal routes. Literal segments and
 * the segment count still have to line up.
 */
function matches(
  call: { method: string; segments: string[] },
  route: { method: string; segments: string[] },
): boolean {
  // "*" = the frontend passes a dynamic method we cannot resolve statically.
  if (call.method !== "*" && call.method !== route.method) return false;
  if (call.segments.length !== route.segments.length) return false;
  return call.segments.every(
    (segment, i) => segment === ":p" || segment === route.segments[i],
  );
}

describe("frontend/backend API route contract", () => {
  const calls = frontendCalls();
  const routes = backendRoutes();

  it("discovers frontend API calls (guards against a silently empty scan)", () => {
    // If the extractor breaks, every other assertion here passes vacuously.
    expect(calls.length).toBeGreaterThan(100);
    expect(routes.length).toBeGreaterThan(100);
  });

  it("has a backend route for every endpoint the web app calls", () => {
    const missing = new Map<string, Set<string>>();

    for (const call of calls) {
      const parsed = {
        method: call.method,
        segments: normalize(call.path).split("/").filter(Boolean),
      };
      if (routes.some((route) => matches(parsed, route))) continue;
      const key = `${call.method} ${normalize(call.path)}`;
      if (!missing.has(key)) missing.set(key, new Set());
      missing.get(key)!.add(call.file);
    }

    const report = [...missing.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, files]) => `  ${key}\n      called from: ${[...files].join(", ")}`)
      .join("\n");

    expect(missing.size, `Missing backend routes:\n${report}`).toBe(0);
  });
});
