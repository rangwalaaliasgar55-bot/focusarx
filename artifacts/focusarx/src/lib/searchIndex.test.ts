import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NOT_SEARCHABLE, SEARCH_INDEX, scoreEntry, searchEntries } from "./searchIndex";

/**
 * Search covered 28 of 97 routes.
 *
 * The index was a hand-written array inside `pages/search.tsx`, and it had
 * drifted by 69 pages — so "wallet", "tasks", "habits", "goals" and "pomodoro
 * timer" all returned nothing on a page whose only job is finding things. The
 * failure is invisible by construction: nobody notices a page *missing* from
 * search, they conclude the app does not have it.
 *
 * The gate below is the actual fix. Deriving from `PAGE_SEO` covers the content
 * pages, curated entries cover the app, and anything else has to be excluded
 * with a stated reason — so a new route cannot silently become unfindable.
 */

const APP_TSX = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");

/** Every static route the app serves. Param routes have no single URL to index. */
function staticRoutes(): string[] {
  const paths = [...APP_TSX.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]!);
  return [...new Set(paths.filter((p) => !p.includes(":")))];
}

describe("every route is findable or deliberately not", () => {
  it("covers or excludes every static route", () => {
    const indexed = new Set(SEARCH_INDEX.map((e) => e.path));
    const missing = staticRoutes().filter((path) => !indexed.has(path) && !NOT_SEARCHABLE[path]);
    expect(
      missing,
      `These routes are neither in the search index nor in NOT_SEARCHABLE. Either add an ` +
        `entry (so users can find the page) or exclude it with a reason.`,
    ).toEqual([]);
  });

  it("has a positive control, so the gate cannot pass by scanning nothing", () => {
    // A gate that finds no routes would pass vacuously.
    expect(staticRoutes().length).toBeGreaterThan(80);
    expect(SEARCH_INDEX.length).toBeGreaterThan(60);
  });

  it("does not index a route that does not exist", () => {
    // The opposite drift: an entry left behind by a deleted page sends the user
    // to a 404 from a search result, which reads as a broken app.
    const routes = new Set(staticRoutes());
    const orphans = SEARCH_INDEX.filter((e) => !routes.has(e.path)).map((e) => e.path);
    expect(orphans, "Indexed paths with no route in App.tsx").toEqual([]);
  });

  it("gives every exclusion a reason long enough to be one", () => {
    // "/terms": "legal" is not a reason, it is a shrug — and the next person
    // cannot tell whether the exclusion was considered or accidental.
    const thin = Object.entries(NOT_SEARCHABLE)
      .filter(([, reason]) => reason.trim().length < 20)
      .map(([path]) => path);
    expect(thin).toEqual([]);
  });

  it("lists each path once", () => {
    const paths = SEARCH_INDEX.map((e) => e.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("gives every entry a title, a description and a path", () => {
    const incomplete = SEARCH_INDEX.filter((e) => !e.title.trim() || !e.description.trim() || !e.path);
    expect(incomplete).toEqual([]);
  });
});

const pathsFor = (query: string) => searchEntries(query).map((e) => e.path);

describe("what people actually type", () => {

  it("finds the app pages the index used to miss entirely", () => {
    // Each of these returned nothing before the index was derived.
    for (const [query, path] of [
      ["wallet", "/wallet"],
      ["tasks", "/tasks"],
      ["habits", "/habits"],
      ["goals", "/goals"],
      ["pomodoro timer", "/pomodoro-timer"],
      ["streak", "/habits"],
      ["rank", "/leaderboard"],
      ["coins", "/wallet"],
    ] as const) {
      expect(pathsFor(query), `"${query}" should find ${path}`).toContain(path);
    }
  });

  it("finds a page by a word that is only in its keywords", () => {
    // The reason the derived entries carry `keywords` at all: the page's own
    // description may never use the word the user typed.
    expect(pathsFor("fsrs")).toContain("/flashcards");
    expect(pathsFor("time blindness")).toContain("/adhd-focus-tools");
  });

  it("requires every term to match, so a common word does not flood the list", () => {
    // "focus" alone matches dozens; "focus city" must not.
    const broad = pathsFor("focus");
    const narrow = pathsFor("focus city");
    expect(broad.length).toBeGreaterThan(narrow.length);
    expect(narrow).toContain("/city");
    expect(narrow).not.toContain("/tasks");
  });

  it("returns everything for an empty query, and nothing for a miss", () => {
    expect(searchEntries("").length).toBe(SEARCH_INDEX.length);
    expect(searchEntries("   ").length).toBe(SEARCH_INDEX.length);
    expect(searchEntries("zzzzqqq")).toEqual([]);
  });

  it("ranks a title match above a description match", () => {
    const titleHit = SEARCH_INDEX.find((e) => e.path === "/leaderboard")!;
    const bodyHit = SEARCH_INDEX.find((e) => e.path === "/dashboard")!;
    // "leaderboard" is in the title of one and nowhere in the other.
    expect(scoreEntry(titleHit, "leaderboard")).toBeGreaterThan(scoreEntry(bodyHit, "leaderboard"));
  });

  it("is case-insensitive", () => {
    expect(pathsFor("POMODORO")).toEqual(pathsFor("pomodoro"));
  });

  it("does not put a legal page above a feature for a feature query", () => {
    const results = searchEntries("timer");
    expect(results[0]!.path).toContain("timer");
  });
});

describe("exclusions stay honest", () => {
  it("does not exclude a page that users would reasonably search for", () => {
    // An exclusion list is a place convenience goes to hide. These are all
    // destinations a user could want.
    for (const path of ["/dashboard", "/focus", "/tasks", "/wallet", "/pomodoro-timer", "/profile"]) {
      expect(NOT_SEARCHABLE[path], `${path} must be searchable`).toBeUndefined();
    }
  });
});

describe("the localized editions are findable and stay in step with their source", () => {
  /**
   * These ten routes arrived with the international-editions work. Their titles
   * are copied into the index verbatim from `locale-pages.mjs`, because
   * importing that module for real would pull every localized page body
   * (~45 kb) into the entry chunk the bundle-budget gate watches.
   *
   * A copy is only acceptable when something fails as soon as it drifts, so
   * this is that something: the index is compared against the module that
   * authors the pages. A new edition, a reworded title or a changed
   * description fails here rather than quietly leaving a page unfindable.
   */
  it("indexes every edition route with the title the content module gives it", async () => {
    const { localeRouteEntries } = await import("@/content/locale-pages.mjs");
    const source = localeRouteEntries() as Array<{ path: string; title: string; description: string }>;

    expect(source.length).toBeGreaterThan(0);
    for (const page of source) {
      const entry = SEARCH_INDEX.find((e) => e.path === page.path);
      expect(entry, `${page.path} is missing from the search index`).toBeTruthy();
      expect(entry!.title, `${page.path} title drifted from locale-pages.mjs`).toBe(page.title);
      expect(entry!.description, `${page.path} description drifted`).toBe(page.description);
    }
  });

  it("finds an edition by the language a user would actually type", () => {
    expect(pathsFor("hindi")).toContain("/hi");
    expect(pathsFor("espanol")).toContain("/es");
    expect(pathsFor("portuguese")).toContain("/pt-br");
    expect(pathsFor("india pricing")).toContain("/in/pricing");
  });
});
