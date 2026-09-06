# Repository error audit — 2026-09-06

## Result

**Several verified bugs were fixed, but the repository is not completely clean.**
Type checking, production builds, unit/integration regressions, schema checks and
dependency auditing pass. Repository-wide ESLint still reports **435 errors
and 490 warnings**, and Knip reports **8 unused files**. Those backlogs were
not hidden by disabling rules or deleting unconnected features wholesale.

Scope: all seven workspaces, root scripts/CI configuration, recorded SQL
migrations, the standalone SQL snapshot, browser tests and targeted source review.
This is repository-wide automated coverage plus targeted manual review, **not a
claim that every line or every possible production workflow has been proven correct**.

> **Pull-request scope:** The `.github/workflows/ci.yml` updates described
> below were audited locally but are excluded from this PR because the GitHub
> connection lacks workflow-write permission. Those edits remain saved locally;
> the other source, script, migration and documentation changes are included.

## Verified fixes

| Area | Finding and correction |
|---|---|
| Mobile controls | A global `.inline-flex` exception overrode button minimum heights, leaving login buttons approximately 21px tall and the Home link approximately 19px tall. Only actual inline text links remain exempt. |
| Pricing layout | A 600px decorative glow expanded a 390px viewport to 495px. The decorative layer now clips its overflow without clipping page content. |
| Wake lock | Browser-released sentinels were retained, preventing reacquisition. Overlapping and late requests could also leak locks after stopping/unmounting. Added generation guards, release cleanup, request deduplication and seven regression tests. |
| Premium authentication | The premium hook treated a missing localStorage token as a free account even with a valid cookie session. It now follows authenticated state, sends cookies and retains the optional bearer fallback. |
| Premium AI boundary | AI insights queries ran in the parent of `PremiumGate`, so hiding children did not stop requests. Queries now live in a child that mounts only after entitlement is granted. Added free/loading/premium regression coverage. |
| Migration `0013` | It was missing from the journal, referenced nonexistent tables such as `streaks`, and attempted to create a competing integer-ID flashcard model. Replaced its unjournaled SQL with additive FSRS changes matching the existing text-ID schema and registered it. |
| Migration completeness | Replaying the old journal left 126 current schema columns absent, including the refresh-token store. Added `0014_schema_catchup.sql` for missing existing application tables, columns and indexes. All 15 migrations now replay; the resulting column definitions match the canonical schema. |
| SQL bootstrap | `database/full_schema.sql` failed on an empty database (`study_groups` did not exist at a foreign-key reference) and contained an obsolete refresh-token layout. It is now generated from Drizzle, creates tables before foreign keys, and has a reproducible drift check. |
| Database cleanup | Housekeeping compared `ai_budget_state.day` (text) to a timestamp, raising PostgreSQL `42883` and rolling back the whole cleanup block. It now compares ISO date keys; a temporary-table integration test verifies old rows are pruned and fresh rows survive. |
| Changed-file lint | Missing refs were swallowed as “no changes”; refs/filenames passed through a shell; push CI compared HEAD to itself. The script now fails closed, uses argument arrays/NUL-delimited filenames and compares CI against the event's actual base commit. |
| Migration validation | The CI filename glob matched `NNNN_.sql`, not descriptive migration names. The replacement validator checks numbering, duplicates, missing/unjournaled files, entry ordering and timestamps. CI also replays SQL against an empty database. |
| Security dependencies | The production-only audit missed 37 development/build-tool advisories, including 11 critical Orval findings. Patched affected packages within their major versions, updated esbuild, and expanded CI to audit all dependencies. The full audit now reports zero advisories. |
| Code generation | The patched Orval release needed explicit Zod 3 output for catalog-based dependencies and DOM iterable types for generated Headers handling. Both settings were corrected and code generation/type checking verified. Existing checked-in generated output was retained to avoid unrelated regeneration churn. |
| Browser test validity | Removed unconditional `expect(true)` checks, observed AI requests before navigation, asserted real auth redirects, and corrected sitemap-index expectations. Navigation tests now use a route that actually renders AppShell. Timer tests dismiss the first-visit notice and allow the existing five-second recovery fallback to finish. |
| Local preview server | Malformed URL escapes could throw an uncaught URIError. The static server now returns 400, contains stream errors, and has request-resolution regressions using temporary fixture directories. |
| Tooling | Updated the obsolete Vitest worker option. Knip no longer evaluates a database-dependent config just to scan source, and CI disables OXC's large raw-transfer allocation. Temporary audit output is excluded from lint. |

## Validation performed

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Pass |
| `pnpm typecheck` | Pass across shared libraries and both applications |
| API Vitest suites against disposable PostgreSQL | **357 passed**, including all DB-gated suites |
| Frontend Vitest suites | **242 passed** |
| `pnpm test:scripts` | **16 passed** |
| Combined unit/integration/script tests | **615 passed**; no DB-gated tests omitted in the database-enabled run |
| `pnpm build` | Pass for all buildable workspaces |
| Frontend SEO validation | **89 prerendered pages** pass title, metadata, canonical, JSON-LD and robots/sitemap gates |
| Frontend bundle budget | Pass; initial JavaScript approximately **104.3 KiB gzip**, three.js not preloaded |
| Production API bundle cold start | Pass; health, deployment, settings and sitemap return 200; anonymous session correctly returns 401 |
| `pnpm --filter @workspace/api-spec run codegen` | Pass, including generated library type checking |
| Migration structural validation | Pass, with two pre-existing index-replacement warnings requiring review |
| Migration SQL replay | **15/15** apply on an empty database; all API suites also pass on the migration-created schema |
| SQL snapshot bootstrap/reapplication | Pass; **107 tables**, **973 column definitions** match the canonical schema |
| SQL snapshot drift check | Pass without a database connection |
| Full dependency audit | **0 vulnerabilities** at every severity |
| `pnpm lint:changed --base HEAD` | Pass; five existing `any` warnings in touched application files |
| Full ESLint | **Fail: 435 errors, 490 warnings** |
| Knip files/dependencies scan | **Fail: 8 unused files**; no dependency findings |
| `git diff --check` | Pass |

### Browser coverage and rerun accounting

The full nine-project matrix exercises desktop, reduced motion, landscape phone,
tablet, and widths 320/360/375/390/414. Of **333 cases**, the first final-matrix
run passed 306, skipped 16 breakpoint-inapplicable checks, and exposed 11 test
failures: the first-visit cookie notice intercepting two 320px timer clicks, and
nine reduced-motion assertions expiring at the same five-second boundary as
session recovery. After correcting those test interactions/budgets, **all 27
related cases passed across the nine projects**.

Combining that matrix with the targeted rerun verifies **317 distinct passing
cases and 16 intentional skips**. The entire matrix was not rerun a second time
after those test-only corrections. Earlier browser runs also reproduced the
mobile sizing/overflow bugs and stale sitemap/nav assertions described above.

Environment: Node **22.22.3**, pnpm **10.26.1**, disposable PostgreSQL **18.4**,
Chromium **149**. The sandbox could not reach the Playwright browser CDN or Debian
mirrors, so Chromium/PostgreSQL test binaries were obtained through temporary npm
packages. These tools, databases, traces and build outputs are not tracked in Git.
CI remains configured for Node 24/PostgreSQL 16 and Playwright's pinned Chromium;
that exact hosted environment was not executed here.

## Remaining errors / follow-up

### 1. Full-repository lint backlog

Most errors are unused imports/variables, but the backlog also includes React
state-in-effect findings and accessibility problems. A lint finding is not by
itself proof of a runtime failure; it still requires review and cleanup.

- **354** unused-variable/import errors.
- **33** `react-hooks/set-state-in-effect` errors.
- **19** unassociated form-label errors.
- **29** other errors (const declarations, unused assignments, keyboard access,
  console policy and related rules).

Largest remaining concentrations:

| File | Errors |
|---|---:|
| `artifacts/focusarx/src/pages/social.tsx` | 25 |
| `artifacts/focusarx/src/pages/pets.tsx` | 16 |
| `artifacts/focusarx/src/pages/developer.tsx` | 12 |
| `artifacts/focusarx/src/pages/groups.tsx` | 11 |
| `artifacts/api-server/src/routes/notifications.ts` | 9 |
| `artifacts/api-server/src/routes/premium.ts` | 9 |
| `artifacts/api-server/src/routes/quests.ts` | 9 |
| `artifacts/focusarx/src/pages/constellations.tsx` | 9 |
| `artifacts/focusarx/src/pages/roadmap.tsx` | 9 |
| `artifacts/focusarx/src/pages/habits.tsx` | 8 |
| `artifacts/focusarx/src/components/FeatureCompassModal.tsx` | 7 |
| `artifacts/focusarx/src/pages/flashcards.tsx` | 7 |
| `artifacts/api-server/src/lib/tokenPremium.test.ts` | 6 |
| `artifacts/api-server/src/routes/dreams.ts` | 6 |
| `artifacts/api-server/src/routes/lootboxes.ts` | 6 |

Reproduce: `pnpm lint`. The audit did not convert these errors into warnings or
turn off their rules. The changed-files gate passes, not the full lint command.

### 2. Knip backlog — CI still fails this job

These files are currently disconnected from the application graph:

- `artifacts/api-server/src/lib/aiStreaming.ts`
- `artifacts/api-server/src/lib/coachMessages.ts`
- `artifacts/api-server/src/lib/walletLock.ts`
- `artifacts/focusarx/src/components/AITaskDecomposer.tsx`
- `artifacts/focusarx/src/components/AudioVisualizer.tsx`
- `artifacts/focusarx/src/components/BinauralBeatsPanel.tsx`
- `artifacts/focusarx/src/components/FeynmanTutor.tsx`
- `artifacts/focusarx/src/lib/binauralBeats.ts`

They should be deliberately connected or removed after deciding whether the
unconnected features are still intended. Reproduce with:

```bash
KNIP_DISABLE_RAW_TRANSFER=1 pnpm exec knip --include files --include dependencies
```

### 3. Production deployment and external services

- **No production database was modified and no deployment was performed.** All
  SQL/schema/integration checks used disposable local databases.
- `push:vercel` is still a best-effort cleanup/patch path, **not a complete SQL
  migration runner**. Provision/synchronize the schema separately; see the
  corrected `database/README.md`. A successful build alone does not prove the
  deployed database is current.
- Database URL aliases are inconsistent: the runtime supports
  `POSTGRES_PRISMA_URL`, but Drizzle config and `push:vercel` do not. Use an
  explicitly exported `DATABASE_URL` for predictable script behavior; unifying
  environment resolution remains a follow-up.
- The replay helper refuses non-empty schemas and is intended for CI/bootstrap,
  not tracking incremental upgrades on a live production database. Fresh-replay
  success does not prove every older/partially managed schema can upgrade without
  intervention. Test production upgrades on a copy/Neon branch before applying.
- Live OAuth, Stripe, email, AI providers, Redis, push delivery and deployed
  WebSocket behavior need real configured integration testing.
- The lazy three.js chunk remains over Vite's warning threshold (about 732 kB
  minified); enforced initial-load and route budgets nevertheless pass.
- Historical `0011` and `neon_sql_editor_idempotent.sql` each replace an index;
  the migration scanner correctly continues to flag those operations for review.

## Reproduction

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test                         # DB suites skip without DATABASE_URL
# With DATABASE_URL pointing at a disposable, initialized database:
pnpm test                         # exercises all DB-gated suites too
pnpm build
pnpm --filter @workspace/focusarx run budget
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run validate-migrations
pnpm --filter @workspace/db run schema:check
# MIGRATION_DATABASE_URL must point at an EMPTY disposable database:
pnpm --filter @workspace/db run test:migrations
pnpm audit --audit-level high
pnpm lint:changed --base <comparison-commit>
pnpm lint
pnpm exec playwright install chromium
pnpm test:e2e --workers=2
```
