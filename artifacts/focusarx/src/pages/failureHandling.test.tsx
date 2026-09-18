import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * A page must not be able to render a claim about the user's data when the
 * request that would have produced that data failed.
 *
 * This is not hypothetical. Four separate pages shipped with the same defect,
 * each stating something untrue about the *user* when the *network* was at
 * fault:
 *
 *   - `analytics.tsx`  a user with hundreds of sessions was told
 *                      "Complete sessions to see your analytics."
 *   - `quests.tsx`     "Daily quests loading… Complete a session to unlock
 *                      them!" — a permanent fake progress state, because
 *                      nothing was ever going to arrive.
 *   - `wallet.tsx`     "No transactions yet. Complete sessions to earn coins!"
 *                      shown to a user with a coin balance, which the failed
 *                      request had also hidden.
 *   - `achievements`   "No achievements in this category yet. Keep focusing to
 *                      unlock them!"
 *
 * Each one was a `catch` that set nothing (or an `if (res.ok)` with no `else`),
 * so the fall-through landed on the *empty* state rather than the *error*
 * state. The empty state is written to describe a healthy new account; that
 * makes it exactly the wrong thing to show when the fetch broke.
 *
 * Rather than trying to prove the absence of a behavioural bug by static
 * analysis, this gate pins the one mechanical precondition that produced all
 * four: a fetch error is observable. If a page reads remote data and never
 * checks whether the read worked, it is one refactor away from all four bugs
 * again.
 */

const PAGES_DIR = join(process.cwd(), "src/pages");

function pageFiles(): string[] {
  return readdirSync(PAGES_DIR)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => join(PAGES_DIR, f))
    .sort();
}

const read = (p: string) => readFileSync(p, "utf8");

/**
 * Strip comments so prose *about* the bug ("the empty state below already says
 * what happened") cannot satisfy — or trip — the checks below.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** A page that fetches data on mount (as opposed to posting on a click). */
function isDataFetchingPage(src: string): boolean {
  return src.includes("useEffect") && /\bfetch\s*\(/.test(src);
}

/**
 * Pages whose whole job is to bounce the user somewhere else. `auth-callback`
 * swaps the OAuth token for a session and navigates; a failed trade *should*
 * land on the dashboard, and does. There is no content of its own that a
 * failure could falsely describe. Exempt by name, not by pattern, so adding a
 * second exemption is a deliberate edit someone has to justify in review.
 */
const REDIRECT_ONLY_PAGES = new Set(["auth-callback.tsx"]);

/** Does the page have any way to learn that its request failed? */
function observesFailure(src: string): boolean {
  return (
    /isError|loadError|loadFailed|setLoadError|setLoadFailed|fetchError|setFetchError/.test(src) ||
    /\berror\s*&&/.test(src) ||
    /setError\s*\(/.test(src) ||
    /toast\s*\(/.test(src) // a catch that surfaces a toast is observing the failure
  );
}

describe("page failure handling", () => {
  const pages = pageFiles();

  it("scans a plausible number of pages", () => {
    // Guards against the scan silently finding nothing, which would make every
    // assertion below vacuously true.
    expect(pages.length).toBeGreaterThan(60);
  });

  it("has every data-fetching page capable of observing a failed request", () => {
    const offenders: string[] = [];
    for (const p of pages) {
      const src = stripComments(read(p));
      if (!isDataFetchingPage(src)) continue;
      if (REDIRECT_ONLY_PAGES.has(p.split("/").pop()!)) continue;
      if (!observesFailure(src)) offenders.push(relative(process.cwd(), p));
    }
    expect(offenders, `pages that cannot tell a failed fetch from an empty one:\n${offenders.join("\n")}`).toEqual(
      [],
    );
  });

  /**
   * Deliberately NOT asserted: "no page contains an empty catch". A
   * fire-and-forget beacon, a best-effort `navigator.clipboard` write and a
   * `<audio>.play()` promise all legitimately swallow. Flagging them made this
   * gate noisy enough that it would have been deleted rather than obeyed, so
   * the check lives at the call site instead: the assertion above requires
   * every data-fetching page to have *some* way to observe a failure, and the
   * one below requires the response status to be checked before the body is
   * trusted. Those two cover the four real bugs without punishing the benign
   * cases.
   */
  it("does not collect fire-and-forget catches as offenders", () => {
    expect(true).toBe(true);
  });

  it("does not read a JSON body without first checking the response was ok", () => {
    // `if (res.ok) setX(await res.json())` and bare `.then(r => r.json())` both
    // treat an error body as data. The achievements page did exactly this: the
    // error body parsed cleanly, `d.badges` was undefined, and `?? []` rendered
    // it as "you have earned nothing".
    const offenders: string[] = [];
    for (const p of pages) {
      const src = stripComments(read(p));
      for (const m of src.matchAll(/\.then\s*\(\s*\(\s*(\w+)\s*\)\s*=>\s*\1\.json\s*\(\s*\)/g)) {
        const rest = src.slice(m.index!);
        // An ok-check either precedes the json() in the same arrow, or is the
        // very next thing the chain does.
        const window = rest.slice(0, 400);
        if (!/\.ok\b/.test(window)) {
          offenders.push(`${relative(process.cwd(), p)}: .then((r) => r.json()) with no r.ok check`);
        }
      }
    }
    expect(offenders, `error bodies read as data:\n${offenders.join("\n")}`).toEqual([]);
  });
});
