# The battle pass, end to end

*Written 2026-09-24, after the season builder was made real. It answers two
questions: "how does this work for a student?" and "how does an admin introduce
a season?"*

---

## 1. The student loop

```
focus session ──▶ season XP ──▶ tiers unlock ──▶ claim ──▶ coins / tokens / cosmetics
      ▲                │                                         │
      └──── timer ◀────┴────────────── daily streak ◀────────────┘
```

1. **Focus earns season XP.** `POST /api/focus/complete` pays 20 XP per focused
   minute (75% rate past 120 minutes) and writes the same amount to
   `battle_pass_progress.season_xp`. Nothing to opt into — a saved session is XP.
2. **XP unlocks tiers.** Tier *t* needs `500·t + 250·⌊t/5⌋` season XP:

   | tier | 1 | 2 | 3 | 4 | 5 | 6 | 10 | 20 | 30 | 50 |
   |---|---|---|---|---|---|---|---|---|---|---|
   | XP | 500 | 1 000 | 1 500 | 2 000 | 2 750 | 3 000 | 5 500 | 11 000 | 16 500 | 27 500 |

   Tier 1 is exactly one 25-minute session (500 XP). A new account starts at
   **tier 0** with a reachable first goal, not at tier 1 with nothing to do.
3. **Claiming pays what the tier promised.** Free track: `50 + 10t` coins
   (`+100` on milestone tiers) and `100 + 20t` XP. Premium track: `25 + 5t` Focus
   Tokens (`+75` at milestones), coins at twice the free rate, and a cosmetic on
   every fifth tier. The final tier adds 200 tokens and a `season-finale` crate.
4. **Claims are idempotent and per track.** The key is
   `bp_<seasonId>_<userId>_<tier>_<free|premium>`; tokens go through
   `earnTokens`, coins through `mintCoins(..., "battle_pass_reward")`. Pressing
   Claim twice is a no-op, and "Claim all" takes everything owed in one request.
5. **Every fifth tier is a milestone** — bigger payouts on both tracks, and the
   premium track hands out a cosmetic that coins cannot buy.
6. **The premium track costs Focus Tokens, never money.** Tokens come from
   focusing, quests and the season itself.
7. **Seasons end, then there is a 3-day grace period.** Unclaimed tiers expire
   after the grace window; claimed rewards are already banked. Season XP resets.

## 2. One ladder, or the page lies

The tier a student sees and the tier the claim gate checks used to be computed by
**two different functions**:

* the battle-pass page rendered a 30-tier season from
  `battle_pass_rewards` (`500t + 250⌊t/5⌋`);
* `POST /battle-pass/claim`, `/retention/battle-pass` and loot-box tier-skips
  used a hand-written eight-tier array that stopped at 8 000 XP.

At 4 400 season XP the page drew *"Tier 8 — claimable"* and the gate answered
*"Tier not yet unlocked"*. Both now call `requiredXpForTierIndex` from
`artifacts/api-server/src/lib/battlePassSeasons.ts`
(`lib/battlePassTiers.ts` for the route helpers), pinned by
`src/lib/battlePass.test.ts` → *"is the same function the page and the claim gate
use"*.

Two clamps exist and are deliberately different:

* `MAX_TIERS = 50` — the most an admin may author, and the ceiling a season can
  progress to;
* `DEFAULT_TIERS = 30` — what `buildSeasonTiers()` ships when nobody says
  otherwise.

Progress is capped at the season's own length, so an authored 50-tier season is
fully claimable rather than truncated at 30.

### The second claim endpoint

`POST /retention/battle-pass/claim` is a legacy path (coins + XP into
`battle_pass_progress.claimed_tiers`) that no client calls. It now refuses a tier
already claimed through `/battle-pass/claim` and records its own payouts in
`battle_pass_claims`, so the same tier cannot be paid twice through two books.

## 3. Admin: introducing a season

**Admin → Battle pass → "Introduce a season"** (endpoints under `/api/admin/battle-pass`).

| step | what happens |
|---|---|
| **Preview tiers** | `POST /admin/battle-pass/preview` runs the generator and returns the tier table. It writes **nothing** — the same pure function, so the preview is what publishing stores. |
| **Create as draft** | `POST /admin/battle-pass` writes the season with `isActive: false` plus both reward rows per tier, in one transaction. |
| **Create and publish** | Same call with `activate: true`; deactivating the old season and activating the new one is a single statement, so two seasons can never both be live. |
| **Publish** | `POST /admin/battle-pass/:id/activate` — the season list shows Publish on every non-live row. Publishing an older season **is** the rollback: one code path, so rollback cannot rot. |
| **Delete** | `DELETE /admin/battle-pass/:id` — drafts only. The live season is refused with 409; publish another season first. |

Fields: `season` (`2026-10`, lowercase/digits/dashes, 3–40 chars, unique),
`title` (3–80 chars), `tierCount` (10–50, default 30), optional `startDate` /
`endDate` ISO timestamps (default: now → +30 days), `activate`.

Every write is guarded by `checkAdminAuth`, audited with the acting admin id, and
committed in a transaction. `routes/adminBattlePass.test.ts` asserts the guard on
every route, that preview never writes, that publishing leaves exactly one live
season, that the live season cannot be deleted, and that the router is actually
mounted in `routes/index.ts` (a router that is not mounted passes `tsc`, passes
its own tests and does nothing — that is how the voice feature went missing).

## 4. When no admin has published anything

`GET /api/battle-pass/current` falls back to the generated default season
(`buildSeasonTiers({ seed: seasonId })`) so the page is complete rather than
empty. The moment an admin publishes a season, that table is what students see.

## 5. Related files

* `artifacts/api-server/src/lib/battlePassSeasons.ts` — the generator, the
  payout mapping, `describeReward`.
* `artifacts/api-server/src/lib/battlePass.ts` — canonical ladder + legacy
  display shape (`BATTLE_PASS_TIERS`), season week math.
* `artifacts/api-server/src/lib/battlePassTiers.ts` — pure tier maths for the
  claims routes.
* `artifacts/api-server/src/routes/battlePassEnhanced.ts` — `/battle-pass/*`.
* `artifacts/api-server/src/routes/adminBattlePass.ts` — the builder.
* `artifacts/focusarx/src/pages/battle-pass.tsx` — the season page.
* `artifacts/focusarx/src/components/admin/AdminBattlePassBuilder.tsx` — the UI.
