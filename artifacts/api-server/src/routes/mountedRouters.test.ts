/**
 * Every router that exists must be reachable.
 *
 * This is the guard for the bug class that has cost the most in this codebase,
 * three times over:
 *
 *   • **voice capture** — a complete parse/commit implementation, a mounted
 *     manager component, and no `router.use()` anywhere, so the feature simply
 *     did not exist in production;
 *   • **the admin battle-pass builder** — written, typed, tested, and never
 *     mounted, so an admin still could not introduce a season;
 *   • **razorpay** — an entire premium checkout flow that did not even compile,
 *     because its table was in the schema SQL but not in the TypeScript schema.
 *
 * None of those failures produces an error. The routes typecheck, their unit
 * tests pass, and the feature is missing. The only way to catch it is to assert
 * the wiring itself, which is what this file does: every exported `*Router` in
 * `src/routes` must be imported by `routes/index.ts` and passed to `router.use`.
 *
 * If a router genuinely must not be mounted, add it to `INTENTIONALLY_UNMOUNTED`
 * with the reason — an explicit exception is a decision, silence is a bug.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(here, "index.ts");
const indexSource = readFileSync(indexPath, "utf8");

/** Routers that are built but deliberately not served, with a reason. */
const INTENTIONALLY_UNMOUNTED: Record<string, string> = {};

interface RouterExport {
  file: string;
  name: string;
}

function routerExports(): RouterExport[] {
  const found: RouterExport[] = [];
  for (const file of readdirSync(here)) {
    if (!file.endsWith(".ts") || file === "index.ts" || file.includes(".test.")) continue;
    const source = readFileSync(path.join(here, file), "utf8");
    for (const match of source.matchAll(/export (?:const|let)\s+(\w*[Rr]outer)\b/g)) {
      found.push({ file, name: match[1]! });
    }
  }
  return found;
}

describe("route wiring", () => {
  const exports = routerExports();

  it("finds the routers at all (the test itself must not silently pass)", () => {
    expect(exports.length).toBeGreaterThan(20);
  });

  it("mounts every exported router", () => {
    const unmounted = exports
      .filter(({ name }) => !INTENTIONALLY_UNMOUNTED[name])
      .filter(({ name }) => !indexSource.includes(name))
      .map(({ file, name }) => `${name} (${file})`);
    expect(unmounted, `built but unreachable — students see a 404: ${unmounted.join(", ")}`).toEqual([]);
  });

  it("actually calls router.use, not merely imports it", () => {
    // An unused import is the voice-capture bug verbatim.
    for (const { name } of exports.filter(({ name }) => !INTENTIONALLY_UNMOUNTED[name])) {
      expect(indexSource, `${name} is imported but never mounted`).toMatch(
        new RegExp(`router\\.use\\(\\s*${name}\\b`),
      );
    }
  });

  it("keeps the documented exceptions honest", () => {
    for (const [name, reason] of Object.entries(INTENTIONALLY_UNMOUNTED)) {
      expect(reason.trim().length, `${name} needs a reason`).toBeGreaterThan(10);
      expect(exports.some((e) => e.name === name), `${name} no longer exists — drop the exception`).toBe(true);
      expect(indexSource.includes(`router.use(${name}`), `${name} is mounted and also exempt`).toBe(false);
    }
  });
});
