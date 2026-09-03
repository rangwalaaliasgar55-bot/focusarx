import { defineConfig } from "vitest/config";

/**
 * API server test configuration.
 *
 * `TZ: "UTC"` is deliberate and load-bearing. Several suites (notably
 * `recommendationEngine`) construct a fixed instant such as
 * `new Date("2026-08-28T03:00:00Z")` and assert on the *hour* the engine
 * derives from it. The engine correctly uses `getHours()` because quiet hours
 * are a user-local concept — but that makes the assertions depend on the
 * machine's timezone. The suite passed in UTC and failed in UTC+5:30. Pinning
 * the timezone makes CI and local runs agree everywhere.
 */
export default defineConfig({
  test: {
    environment: "node",
    env: {
      TZ: "UTC",
    },
    // Each worker boots its own Vite server. On memory-constrained machines the
    // default (one worker per core) exhausts resources and the run stalls
    // instead of failing — a hang is much harder to diagnose than a slow pass.
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: 4,
        minForks: 1,
      },
    },
    // The DB-gated integration suites (botEngine, drops, marketplace,
    // aiBudget) share one Postgres and several of them assert on global
    // counts. Running test files in parallel lets one suite observe another
    // suite's fixtures mid-run (botEngine's community-pulse count caught 12
    // leaked users from drops+marketplace in CI). One file at a time keeps
    // those assertions deterministic.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
