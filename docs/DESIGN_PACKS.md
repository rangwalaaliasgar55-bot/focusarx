# Design packs — what each one is, who owns the choice, and where it renders

A **design pack** is a cosmetic choice about how FocusArx looks. There are four,
one per surface:

| Field | Values | What it changes |
| --- | --- | --- |
| `timerFace` | 14 faces — `classic`, `neon`, `zen`, `flip`, `segments`, `bars`, `dots`, `rounds`, `analog`, `aurora`, `orbit`, `hourglass`, `companion`, `garden` | Which face the countdown draws. See [TIMER_LAYOUTS.md](./TIMER_LAYOUTS.md) for every face and its rules. |
| `petDesign` | `classic`, `wild3d`, `sprite` | The companion's art: the posed rig, an animal built from the species' own parameters, or flat artwork with **no 3D at all**. |
| `battleDesign` | `duel`, `arena`, `retro` | The battle board. `duel` is the turn-based arena page, `arena` is the focus session itself (minutes are damage), `retro` is the same fight in a monospaced two-tone reading. |
| `layout` | `quiet`, `studio`, `compact` | The workspace arrangement: one column, two columns (companion beside the timer), or the smallest footprint (no rail, no motivational line). |

A pack changes what is **drawn**, never what is **true**. The countdown, the
pet's level, the battle maths and the rewards are identical in every pack, which
is why `battleDesign` and `layout` can be swapped mid-session without touching a
result — and why the admin console can move a whole cohort onto one board for an
experiment without changing anyone's data.

## The ids are a contract in four places

The lists cannot live in one file (the client does not import the server), so
they are written down four times and **asserted against each other**:

1. `artifacts/focusarx/src/lib/designPacks.ts` — the ids, and the admin-facing labels.
2. `artifacts/focusarx/src/lib/timerTheme.ts` — the timer faces, with their picker order and blurbs; `docs/TIMER_LAYOUTS.md` must document every one.
3. `artifacts/api-server/src/lib/appearanceCatalog.ts` — validation and labels, server-side.
4. `lib/db/src/schema/appearance.ts` — the `CHECK` constraints that make an unknown id impossible to store.

`src/lib/appearanceCatalog.test.ts` (api-server) fails if any pair drifts, and
`src/lib/timerTheme.test.ts` (client) fails if a registered face has no blurb,
no renderer, or no line in the doc. The failure mode this prevents is invisible
from either side alone: an id the API accepts but the client does not know
renders as an empty stage — reported as "my pet disappeared", never as a bad id.

## Who owns the choice

Two writers share one row (`user_appearance`), and the database says who wins:

- **The user** writes their own row through `GET/PUT/DELETE /api/appearance`,
  and the settings section on `/profile?tab=custom`.
- **An admin** writes anyone's row through the console's **Design packs** tab
  (`GET/PUT/DELETE /api/admin/appearance[/:userId]`, plus a bulk
  `POST /api/admin/appearance/bulk` with `all` and `dryRun`).

An admin can **pin** an account (`locked = true`). While it is pinned, the
user's own `PUT` is refused with **409 `{ code: "appearance_locked" }`** — the
settings section renders that as "managed by an admin", not as a failed save —
and unlocking is an explicit field in the admin's request, so "set the design
but leave them free to change it" (a legitimate A/B cohort) can never happen by
omission.

A user with no row at all is on the catalog defaults: no backfill, and adding a
field later needs no migration of existing accounts.

## Where each pack renders

| Pack | Surfaces |
| --- | --- |
| `timerFace` | `components/TimerDisplay.tsx` (the face, skin or not) — the picker in `Timer.tsx`, the settings section, the arena's board is not affected |
| `petDesign` | `/pets` (the showcase, and `sprite` removes the 3D toggle), `/focus` (the companion stage), the timer's `companion` face |
| `battleDesign` | `/focus` (the session board, via `MonsterBattleArena`'s `board` prop) and `/arena` (`retro` is the monospaced reading) |
| `layout` | `/focus` (the workspace: rail, two-column studio, compact) and `/arena` |

The client reads the assignment through one module store
(`src/lib/appearance.ts`): a `useSyncExternalStore` snapshot the query
hydrates, cached in `localStorage` so a cold start with no network still renders
the face the user last chose. A stale cached id is coerced back to the default
rather than rendered — `coerceAppearance` on both sides of the wire.

## Battles

The arena is a **client-side** simulation: it is animated, pausable, and never
touches another account. `lib/petBattle.ts` is the engine — pure, seeded and
bounded — and the server only stores the *result* (`pet_battles`), which is what
the admin console reads to answer "which board is actually being played, and is
anyone winning". No currency, XP or inventory is derived from that table.

## The arena ladder

The arena's six cups are the uploads' own (`ARENA` in their `lib/pets.ts`),
names and blurbs verbatim: Meadow, Lantern, Tidewall, Stormgate, Skyfall,
Mythic. Ported to `src/lib/arenaLadder.ts` and rendered on `/arena`, they are
gated twice — the previous cup must be won **and** the companion must be at the
cup's level — and the page says which of the two gates is holding a cup back
("Clear Cup 1 first" and "Needs level 9" are different pieces of advice).

Two deliberate departures from the uploads, both because the app around the
ladder is not the uploaded demo:

| Uploads | Here |
| --- | --- |
| Fixed foe species ids (`magikarp`, `hoot`…) that this catalog does not have | A cup sets the **level and difficulty band**; the opponent comes from the live pet catalog |
| "Arena energy" earned from focus minutes, coins and XP paid per cup | No arena economy. A second currency invented for a ladder would be the tail wagging the dog |

Progress is not a column of its own: `pet_battles.stage` records which cup a
fight was (null for a pick-up fight), and the ladder reads wins back out of that
same log — the record the admin console reads, so the two views cannot drift.
That is also what the console's "Recent battles" list prints, cup name included.
