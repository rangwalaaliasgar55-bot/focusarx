# PR #99, file by file — what was ported, and where it lives

[PR #99](https://github.com/rangwalaaliasgar55-bot/focusarx/pull/99) is five ZIP
attachments, not a diff: the pull request's own body is the empty template and
its "changes" are `.zip` files. So there is nothing to merge, and "the same code"
has to be accounted for file by file against what this repository already is.

This is that accounting. It exists because the request was *everything* from
those uploads, and "everything" is only checkable if each file is named.

Each ZIP is a **standalone Vite demo** with its own store, router, timer engine
and data layer. Its *designs* are what this workstream wanted; carrying its
plumbing across would have meant two of each of those. So the rule applied
throughout: **port the design and its content, reimplement the wiring against
this app's real surfaces and gates, and say so here where that happened.**

| Upload | What it is | Its distinct contribution |
| --- | --- | --- |
| `focusarx-frontend-and-pet-redesign.zip` | Dashboard/timer/tasks app with a 3D pet | `components/timer/Faces.tsx` (8 faces), `components/pet3d/*` (procedural bodies, scenes, effects), `lib/pets.ts`, `lib/battle.ts` |
| `redesign-focusarx-frontend-and-pet.zip` | Focus + companion + arena | `components/pet/*` (3D stage, arena scene, particles), `pages/Arena.tsx` (the six-cup ladder), `lib/battle.ts`, `lib/pets.ts` |
| `redesign-focusarx-frontend-and-pets.zip` | Focus/pets/missions with a care loop | `components/faces.tsx` (Aurora, Flip, Orbit, Hourglass, Trail, Segment, Garden), `lib/pets.ts` (arena ladder, types, moves, stats), `components/PetImg.tsx` |
| `redesign-focusarx-frontend-interface.zip` | Interface pass: layout, hooks, charts | `components/Layout.tsx` (shell), `hooks.ts` (mood/progress), `lib/audio.ts` (ambient layers), `components/charts.tsx` |
| `new-chat.zip` | Wider app sketch | `pages/Flashcards|Habits|Leaderboard|Rooms|Landing`, `components/Pet3D.tsx`, `lib/data.ts` |

## Timer faces

Both face files were read in full; every face in them exists here.

| Upload source | Faces | Here |
| --- | --- | --- |
| `focusarx-frontend-and-pet-redesign/src/components/timer/Faces.tsx` | Classic, Neon, Zen, Flip, Analog, Hourglass, Orbit, Segment | `analog`, `hourglass`, `orbit` in `components/timerfaces/TimerFacesStudio.tsx`; `segments` (id pluralised to match this app's registry) in `components/timerfaces/TimerFaces.tsx`; `classic`, `neon`, `zen`, `flip` kept this app's own renderers in `components/TimerDisplay.tsx`, whose blurbs were rewritten from the uploads' notes |
| `redesign-focusarx-frontend-and-pets/src/components/faces.tsx` | Aurora, Flip, Orbit, Hourglass, Trail, Segment, Garden | `aurora`, `orbit`, `hourglass`, `companion` (the uploads' "Trail"), `garden` — all in `components/timerfaces/TimerFacesStudio.tsx` |

The uploads' per-face one-liners ("Clean progress ring", "Falling sand",
"Mechanical split-flap cards", "Your pet walks to the finish flag" → Companion
trail) were read and then written into this app's blurb register in
`lib/timerTheme.ts` — same idea, the reader-facing voice this app already uses —
and
`analog` is the uploads' *wedge dial that empties*: a thick draining wedge, a
60-tick scale, twelve numerals and a sweeping hand — not a two-handed wall
clock. This app's own `bars`, `dots` and `rounds` remain alongside them; the
registers are asserted against each other in `lib/timerTheme.test.ts` and
`docs/TIMER_LAYOUTS.md`.

## Companion art

| Upload source | Here |
| --- | --- |
| `pet3d/bodies.tsx` (`BodyParams`, `ProceduralBody`, `SpriteBody`), `three/critter.ts`, `three/subject.ts` | `lib/petBodyParams.ts` (species → palette, ears, tail, beak, wings, body plan), `components/pets/AnimalGlyph.tsx` (2D), `components/pets/ProceduralWildPet.tsx` (3D) |
| `pet/Pet3D.tsx` ×3 variants, `new-chat/components/Pet3D.tsx`, `interface/components/Pet3D.tsx` | `components/Pet3D.tsx` with `modelKindFor(petType, design)`; the `wild3d` pack renders the procedural body, `sprite` the flat artwork, `classic` the existing rig |
| `pet/PetAvatar.tsx`, `PetImg.tsx`, `PetThumb.tsx` | `components/pets/PetSprite.tsx`, `PetStage2D.tsx` |
| Uploads' species (`emberfox`, `bubbo`, `sprout`, `zappy`, `drakeling`, `lunix`; `cat|fox|bunny|dragon|owl|slime|penguin|panda`) | **Not ported as a catalog.** This app has its own species and inventory; the uploads' art *system* is what was ported, so every species here — including ones the uploads never had — draws from the same parameters |

## Battles

| Upload source | Here |
| --- | --- |
| `lib/battle.ts` (`makeFighter`, `Battle`, `beginTurn`, `chooseEnemyMove`, `DIFFICULTIES`) | `lib/petBattle.ts` — same shape (fighters, energy, guards, crits, effectiveness, a deterministic opponent), rebalanced for this app's HP/level scale |
| Move names across `lib/pets.ts` (24 moves) | `MOVE_NAMES` per element: Inferno Comet, Tidal Crash, Solar Beam, Thunder Spark, Draco Meteor, Claw Swipe, Bubble Bonk, Zip Strike, Cinder Guard, Healing Mist, Charge Up, Photosynthesis, Void Veil, Comet Nudge, Starfall, Supernova |
| `ARENA: ArenaStage[]` + `pages/Arena.tsx` "The ladder" | `lib/arenaLadder.ts` — the same six cups, names and blurbs verbatim, on `/arena` (see `docs/DESIGN_PACKS.md`) |
| `pet/ArenaScene.tsx` + `Particles.tsx` (a `@react-three/fiber` + `drei` battle scene) | `components/MonsterBattleArena.tsx` — see "what was not ported" |
| `lib/sound.ts`, `lib/audio.ts` (hit/guard/crit cues) | Not ported; this app's audio layer is its own |

## Layouts and the shell

The uploads each hard-code **one** frame (a sidebar, a topbar, a mobile tab
bar) inside `Shell.tsx` / `Layout.tsx`; none of them ships a layout registry or
a layout setting. So "a new layout the admin can change for every user" has no
upload counterpart to copy, and was built as a pack of three workspace
arrangements — `quiet` (the existing page), `studio` (two-column, companion
beside the timer) and `compact` (rail and motivation folded away) — selectable
per account and assignable per user from the console. Where the uploads' shells
did contribute is the visual language: panel/chip/segmented-control treatment,
the stat row on the focus page, and the nav's active-pill behaviour.

## What was **not** ported, and why

| Item | Why not |
| --- | --- |
| The 3D battle scene (`pet/ArenaScene.tsx`, `pet/Particles.tsx`): framed with `@react-three/fiber` and `@react-three/drei` | This app's three.js bundle is already deferred and budgeted (`vendor-three`, 746 kB, never preloaded by the entry chunk). Adding a second renderer plus `drei` would ship it to every page for one screen. The board keeps the same information and the same three design packs, drawn in DOM/SVG, with the 3D pet still available on `/focus` and `/pets` |
| The uploads' stores, routers, timer engines, `localStorage` schemas | Each upload is a self-contained demo. This app already has all four, with accounts, a database and tests |
| Feature pages with no counterpart here: Shop, Rooms, Flashcards, Leaderboard, Habits, Missions, Landing, Start | Copying a page means copying the feature behind it (inventory, rooms, decks, rankings). Their *designs* — cards, chips, empty states, segmented controls, chart treatments — informed the components where these app's equivalents live. Adding the features themselves is a separate piece of work, not a design port |
| Seasonal/marketplace content in `lib/data.ts` (`DECKS`, `ROOMS`, `RIVALS` sample rows) | Sample data for those unported features |
| `charts.tsx` (BarChart, Heatmap, HourChart, Gauge, RingProgress) | This app's analytics already has its own chart components; the uploads' variants were read for treatment only |

## Where the ports are checked

* `lib/timerTheme.test.ts` — every face id has a renderer, a blurb, and a row in `docs/TIMER_LAYOUTS.md`.
* `lib/petBattle.test.ts` — 28 engine invariants, including the three faults the uploads' engine exposed (no energy regeneration, generic move names, no wind-up move) and their fixes.
* `lib/arenaLadder.test.ts` — the six cups, the two gates, and the reasons printed for each.
* `appearanceCatalog.test.ts` — the four id lists (database CHECKs, API catalog, client registry, timer registry) asserted against each other.
* `routes/appearance.integration.test.ts` — the pins, the 409 and the battle log, against a real database.
* `components/admin/AdminAppearancePanel.test.tsx` — the console's assignment write (including the pin) and its battle list, cup included.
