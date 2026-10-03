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
| `focusarx-frontend-and-pet-redesign/src/components/timer/Faces.tsx` | Classic, Neon, Zen, Flip, Analog, Hourglass, Orbit, Segment | `analog`, `hourglass`, `orbit` in `components/timerfaces/TimerFacesStudio.tsx`; **Segment** ported as `seven` in the same file (its a–g geometry, the twenty-four block bar and the mode/percentage footer are the uploads'); `classic`, `neon`, `zen`, `flip` kept this app's own renderers in `components/TimerDisplay.tsx`, whose blurbs were rewritten from the uploads' notes |
| `redesign-focusarx-frontend-and-pets/src/components/faces.tsx` | Aurora, Flip, Orbit, Hourglass, Trail, Segment, Garden | `aurora`, `orbit`, `hourglass`, `companion` (the uploads' "Trail"), `garden` — all in `components/timerfaces/TimerFacesStudio.tsx`; `Segment` again as `seven` |

The uploads' `Segment` is **not** this app's `segments`. Theirs is an LED
readout — four seven-segment digits over a draining block bar — and this app's
is a sixty-segment dial that was already here under that id. Both are faces worth
having, so the upload's display was ported under the id `seven` rather than
replacing a face users had already chosen. An earlier revision of this document
said the upload's `Segment` was the dial; that was wrong, and `seven` is the
correction.

Two further faces exist that the uploads do not have: `wave` (a tide that sinks)
and `candle` (a candle burning down). They are written here in the uploads'
visual idiom, out of the two pictures those designs keep returning to — the
Water cup's tide and the Lantern cup's flame.

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
| `lib/sound.ts` (hit/guard/crit battle cues) | Not ported: this app's battle board reports a hit with its own cue set and `lib/petBattle.ts` exposes the same crit/guard/effectiveness flags, so a second cue table would be a second opinion about one event |
| `lib/audio.ts` ×3 (ambient layers, chime, click) | Ported — see **Audio** below |

## Layouts and the shell

The uploads each hard-code **one** frame — a sidebar, a topbar, a mobile tab bar
— inside `Shell.tsx` / `Layout.tsx`; none of them ships a frame registry or a
frame setting. Two things were built out of that:

* **The `layout` pack** — three workspace *arrangements*: `quiet` (the existing
  page), `studio` (two-column, companion beside the timer) and `compact` (rail
  and motivation folded away). Selectable per account, assignable per user from
  the console.
* **The `shell` pack** — the three frames the uploads actually contain, made
  into a choice: `sidebar` (this app's own frame, and the default),
  `topbar` (the uploads' desktop frame: no rail, a horizontal strip of
  destinations under the header, **More** opening the full list) and `tabs`
  (their phone frame at every width). `components/AppShell.tsx` branches on the
  id and `src/index.css` carries the layout rules; both are asserted per id by
  `src/lib/shellFrames.test.ts`, because a frame with no rule behind it looks
  like a product with fewer doors rather than like a bug.

Where the uploads' shells also contributed is the visual language: panel/chip/
segmented-control treatment, the stat row on the focus page, and the nav's
active-pill behaviour.

## Audio

The uploads ship **three different** audio modules, not three copies of one.
Each was read in full, and each asked a different question.

| Upload source | Here | What happened |
| --- | --- | --- |
| `redesign-focusarx-frontend-interface/src/lib/audio.ts` (212 lines: `LAYERS` rain/brown/ocean/wind, `setLayer`, `stopAll`, `getVolumes`, `subscribeAudio`, `playChime`, `playTick`) | `lib/audioLayers.ts` + a **Layer mixer** section in `components/AmbientSoundBar.tsx` | Ported as-is: the same noise colours, the same filter frequencies (rain: highpass 900 → peak 3.2 kHz +4 → lowpass 7.5 kHz; brown: lowpass 900; ocean: lowpass 1.1 kHz with a 0.09 Hz swell; wind: bandpass 520 Q 0.8 swept ±260 Hz), the same `vol² × 0.55` fader law, the same 120 ms glide, the same 700 ms teardown that is cancelled if the layer comes back, and the same four-fader interaction. The one structural change: it borrows this app's single AudioContext from `ambientEngine` (`shareEngineContext`) instead of opening a second one |
| `new-chat/src/lib/audio.ts` (`LayerId` rain/brown/waves/wind, `chime("done"\|"break")`, `click()`) | same file | The layers are the mixer above (`waves` is the table's `ocean`); `chime("done")`, the descending break cue and the 520 Hz click are ported as `playChime`/`playBreakChime`/`playClick` |
| `redesign-focusarx-frontend-and-pets/src/lib/audio.ts` (`SOUNDS`: off/rain/brown/ocean/wind/fire/white, `playAmbient(id, volume)`, `setVolume`, `stopAmbient`) | `lib/ambientEngine.ts` | Already a subset of this app's engine, which has all seven (`rain`, `brown`, `ocean`, `wind`, `fireplace` for their "fire", `white`, plus fifteen more) with per-sound volume and stop. Asserted in `lib/ambientEngine.test.ts`; re-implementing seven ids that already exist would have been a second mixer for the same sounds |

The chime is wired to a real moment: `pages/focus.tsx` plays it when a session
completes, and the mixer carries the switch ("Chime when a session ends",
`focusarx-completion-chime`, on by default as in the upload). The break cue and
the click are ported, exported and tested but not yet attached, because both
completion callbacks in this app are `() => void` — they do not say whether the
block that ended was work or a break, and inventing that plumbing to trigger a
sound would be the kind of invention this document exists to avoid.

## Pet care states (showcasing)

The uploads' companion pages are built around one list — `PetAnim`: `idle`,
`wave`, `eat`, `victory`, `guard`, `heal`, `boost`, `sad`, `sleep`, plus the
battle states — and one care row: **Feed**, **Play**, **Pet**, each of which
stages a state and, in their local store, nudges coins/treats/joy.

| Upload source | Here |
| --- | --- |
| `PetAnim` and the care row on `pages/Companion.tsx` | `WildAnim` in `components/pets/ProceduralWildPet.tsx` gained the seven action states; `components/Pet3D.tsx` takes an `anim` prop that outranks the server-derived mood and maps the states onto rig dynamics for the six hand-built species as well (`ACTIONS`, next to `MOODS`); the parametric body poses them properly |
| The three actions and their feedback | A care row on the active-pet card in `pages/pets.tsx` (Pet → wave, Feed → eat, Play → victory), with the same 900 ms floor between taps that their `play()` uses, and the 2D stage naming the action in its chip (`PetStage2D`'s `MOOD_LABEL`) so the flat artwork reacts too |
| Their coin/treat/hunger/joy economy (`feedPet`, `playWithPet`, `patPet` in `lib/store.ts`) | **Not copied.** It lives entirely in the upload's `localStorage` store; here bond XP is written by finished sessions on the server, and a button that minted XP would make the level on the card a lie. The interaction is copied, the ledger is not — the copy under the row says so |
| `lib/progress.ts` `GAMES`, `LEVELS`, `NEXT_UNLOCKS` | Rule tables for their local progression; this app's 20-level companion progression and unlock list already exist (`pages/pets.tsx`). The *states* were the port; the tables would have duplicated the ladder |

## The sign-in gate

Every upload is a guest-first demo: open it, use the timer, no account. The
timer here now requires a session — a guest who opens `/focus` is sent to
`/login?redirect=…` and comes back to the session they asked for, and `/login`
on its own goes to the dashboard. That is a deliberate break from the uploads'
assumption, so it is written down:

* `src/App.tsx` wraps the `/focus` route in `ProtectedRoute` (the marketing
  pages that *introduce* the timer stay public).
* Copy that promised otherwise was corrected across `focus.tsx`, the landing
  CTA and timer preview, `exam.tsx`, `guides.tsx`, `prerender-data.mjs` and the
  content corpus (`blog.mjs`, `locale-pages.mjs`, `minute-timers.mjs`,
  `seo-pages.mjs`, `exam/derive.mjs`) — twenty-odd claims, each reworded rather
  than deleted, so the pages still argue for the product.
* `tests/e2e/auth-gate.spec.ts` asserts the three properties that matter: a
  guest is redirected, the deep link (query string included) survives the trip,
  and a signed-in visitor gets the timer. `tests/e2e/session.ts` is the shared
  signed-in fixture; `timer-persistence`, `cross-tab-leader` and `responsive`
  now use it, because all three used to treat `/focus` as public.

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
* `components/admin/AdminAppearancePanel.test.tsx` — the console's assignment write (including the pin and the frame) and its battle list, cup included.
* `lib/shellFrames.test.ts` — every frame id has a branch or a stylesheet rule, the frame is published to the DOM, it is read from the assignment rather than hard-coded, and it is documented.
* `lib/designPacks.test.ts` — the coercion at the edges: a stale id falls back per field, a poisoned cache degrades to defaults, and every shipped id survives a round trip.
* `lib/audioLayers.test.ts` — the uploaded mixer's contracts: the four layers, the `vol² × 0.55` fader law, the 700 ms teardown and its cancellation, the four-note chime, the break cue and the click, and the chime switch.
* `tests/e2e/auth-gate.spec.ts` — the timer is not public: redirect, deep-link survival, and the signed-in path.
