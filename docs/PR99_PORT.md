# PR #99, file by file — where every upload file went

[PR #99](https://github.com/rangwalaaliasgar55-bot/focusarx/pull/99) is not a diff:
its body is the empty template and its changes are five `.zip` attachments
(`focusarx-frontend-and-pet-redesign`, `redesign-focusarx-frontend-and-pet`,
`redesign-focusarx-frontend-and-pets`, `redesign-focusarx-frontend-interface`,
`new-chat`). There is nothing to merge, so "copy everything from it" can only be
answered by naming every file and saying what happened to it.

The uploads are standalone Vite demos: each has its own `store`, router, timer
engine and sample data. Their **designs** — faces, bodies, boards, frames,
sounds, layouts — are what this app wanted; their **plumbing** would have meant
two of everything. So the rule applied throughout was *port the design, keep this
app's data layer*, and the table below records every file against that rule.

Decision vocabulary:

* **ported** — the file's content (geometry, constants, copy, behaviour) exists
  here, at the target named;
* **superseded** — this app already had the equivalent, and the upload's version
  was read for its treatment rather than copied;
* **not ported** — with the reason, named.

## `focusarx-frontend-and-pet-redesign.zip`

| Upload file | Decision |
| --- | --- |
| `components/timer/Faces.tsx` (588 lines, 8 faces) | **ported** → `timerfaces/TimerFacesStudio.tsx`: Analog, Hourglass and Orbit as new faces, and the upload's Segment readout as `seven` (its a–g geometry verbatim — the id `segments` was already this app's own sixty-segment dial, so the upload's display took a new one). Classic, Neon, Zen and Flip stay this app's renderers, with blurbs rewritten from the upload's notes. Row by row in `docs/TIMER_LAYOUTS.md` |
| `components/pet3d/bodies.tsx`, `pet3d/PetActor.tsx`, `pet3d/fx.tsx`, `pet3d/Scenes.tsx` | **ported** → `lib/petBodyParams.ts`, `components/pets/ProceduralWildPet.tsx`, `components/Pet3D.tsx` (the `wild3d` pack) |
| `lib/pets.ts` (species, moves, gradients) | **ported** (move names, body parameters, palettes) → `lib/petBattle.ts` `MOVE_NAMES`, `lib/petBodyParams.ts` |
| `lib/battle.ts` | **ported** → `lib/petBattle.ts`, with the three faults fixed rather than copied (no regeneration, generic move names, no wind-up) — see `docs/DESIGN_PACKS.md` |
| `pages/BattlePage.tsx` | **ported** as the board + `/arena` (`pages/arena.tsx`, `components/MonsterBattleArena.tsx`) |
| `pages/TimerPage.tsx` | **superseded** — this app's `/focus` and its timer layouts; the upload's arrangement informed the `studio`/`compact` packs |
| `pages/PetsPage.tsx`, `pages/MissionsPage.tsx`, `lib/missions.ts` | **superseded / not ported** — this app has `/pets` with its own catalog; missions have no counterpart, so the designs (cards, chips, progress rows) informed existing components instead |
| `components/Shell.tsx`, `components/ui.tsx`, `src/index.css` | **ported** as language → the `sidebar` frame, `components/ui/*`, the token sheet in `src/index.css` |
| `components/charts.tsx` | **superseded** — this app's charts already exist; read for treatment |
| `components/PetThumb.tsx` | **superseded** → `components/pets/PetSprite.tsx` |
| `pages/Dashboard.tsx`, `TasksPage.tsx`, `AnalyticsPage.tsx`, `SettingsPage.tsx` | **superseded** — each feature exists here (`/dashboard`, `/tasks`, `/analytics`, settings); the uploads' card/stat treatments were the takeaway |
| `lib/store.ts`, `lib/router.ts`, `lib/timer.ts`, `lib/toast.ts`, `App.tsx`, `main.tsx`, `utils/cn.ts` | **not ported** — the demo's own store, router, timer engine and entry point; this app has all of them, with tests |

## `redesign-focusarx-frontend-and-pet.zip`

| Upload file | Decision |
| --- | --- |
| `components/pet/Pet3D.tsx`, `pet/PetAvatar.tsx`, `pet/PetStage.tsx` | **ported** → `components/Pet3D.tsx` (rigs + stage), `components/pets/PetStage2D.tsx` |
| `components/pet/ArenaScene.tsx`, `pet/Particles.tsx` (`@react-three/fiber` + `drei`) | **ported** as the same stack — `@react-three/fiber` and `@react-three/drei` are dependencies here, and the arena scene was rebuilt on this app's geometry rather than pasted |
| `lib/battle.ts` | **ported** → `lib/petBattle.ts` (the richer variant of the two uploads' engines) |
| `lib/pets.ts`, `lib/stats.ts`, `lib/format.ts` | **ported / superseded** — arena ladder names and blurbs → `lib/arenaLadder.ts`; stat formatting already existed |
| `pages/Arena.tsx` | **ported** — the six-cup ladder, names and blurbs verbatim, on `/arena` |
| `pages/Companion.tsx` | **ported** — the care row and the `PetAnim` states → `pages/pets.tsx` + `components/pets/ProceduralWildPet.tsx` (`wave`, `eat`, `victory`, `guard`, `heal`, `boost`, `sad`) |
| `lib/sound.ts` (hit/guard/crit cues) | **not ported** — this app's battle board has its own cue set; `lib/petBattle.ts` exposes the same flags, so a second cue table would be a second opinion about one event |
| `pages/Focus.tsx`, `Dashboard.tsx`, `Tasks.tsx`, `Shop.tsx`, `Missions.tsx`, `Analytics.tsx` | **superseded / not ported** — Shop and Missions have no counterpart here; the rest are this app's own pages |
| `components/Shell.tsx`, `SettingsModal.tsx`, `TaskCheck.tsx`, `ui.tsx`, `index.css`, `lib/store.ts`, `lib/ui.ts`, `main.tsx`, `utils/cn.ts` | **superseded / not ported** — the `topbar` frame came from this shell; the rest is demo plumbing |

## `redesign-focusarx-frontend-and-pets.zip`

| Upload file | Decision |
| --- | --- |
| `components/faces.tsx` | **ported** → `timerfaces/TimerFacesStudio.tsx` (Aurora, Flip, Orbit, Hourglass, Trail→`companion`, Segment→`seven`, Garden) |
| `components/three/critter.ts`, `three/subject.ts`, `three/Pet3D.tsx` | **ported** → `lib/petBodyParams.ts` + `components/pets/ProceduralWildPet.tsx` (the parametric bodies: ears, tails, beaks, wings, plans) |
| `lib/pets.ts` (arena ladder, types, moves) | **ported** → `lib/arenaLadder.ts`, `lib/petBattle.ts` `MOVE_NAMES` |
| `lib/audio.ts` | **ported** → `lib/audioLayers.ts` + the Layer mixer in `components/AmbientSoundBar.tsx` (their four layers, their filters, `vol² × 0.55`, the 700 ms teardown) — and their `SOUNDS` ids (`rain`, `brown`, `ocean`, `wind`, `fire`, `white`) are a subset of `lib/ambientEngine.ts` |
| `pages/Arena.tsx` | **ported** — the ladder again; the two uploads' ladders were reconciled into one |
| `pages/Pets.tsx` | **ported** — care/progress treatment; the app's own catalog renders it |
| `pages/Focus.tsx`, `Dashboard.tsx`, `Landing.tsx`, `Tasks.tsx`, `Missions.tsx`, `Analytics.tsx`, `Settings.tsx`, `Start.tsx` | **superseded / not ported** — this app's pages; `Landing`'s CTA treatment informed the landing page, and its promise ("no signup") is now the one thing that could not be copied — see `docs/PR99_PORT.md` history and `src/App.tsx`'s `/focus` comment |
| `components/Layout.tsx`, `Modals.tsx`, `PetImg.tsx`, `ui.tsx`, `App.tsx`, `lib/store.ts`, `lib/router.ts`, `main.tsx`, `utils/cn.ts` | **superseded / not ported** — the `tabs` frame came from this layout; the rest is plumbing |

## `redesign-focusarx-frontend-interface.zip`

| Upload file | Decision |
| --- | --- |
| `lib/audio.ts` | **ported** → `lib/audioLayers.ts`, plus the completion chime wired into `pages/focus.tsx` and its switch in the mixer. This file is the one that gave the app a live four-fader layer mixer next to its scene presets |
| `components/Layout.tsx` | **ported** as the `shell` pack's `sidebar`/`topbar`/`tabs` — see `docs/DESIGN_PACKS.md` |
| `components/ui.tsx` | **ported / superseded** → `components/ui/*` already covers the same primitives; the upload's variants were read for treatment |
| `hooks.ts` | **ported / superseded** — mood and progress helpers; this app derives both from the API |
| `components/Pet3D.tsx` (697 lines) | **ported** — the third pet variant, reconciled into the single `components/Pet3D.tsx` with `modelKindFor()` |
| `components/charts.tsx`, `lib/pets.ts` | **superseded** — charts exist; the interface upload's `pets.ts` is only ids |
| `pages/Focus.tsx`, `Dashboard.tsx`, `Habits.tsx`, `Leaderboard.tsx`, `Rooms.tsx`, `Landing.tsx`, `Pets.tsx`, `Settings.tsx`, `Tasks.tsx`, `Analytics.tsx` | **superseded / not ported** — Habits, Leaderboard and Rooms have no counterpart here; the rest are this app's pages, and the interface pass is what informed their current panels and stat rows |
| `router.tsx`, `store.ts` (620 lines), `index.css`, `App.tsx`, `main.tsx`, `utils/cn.ts` | **superseded / not ported** — the demo's state layer; the token sheet's treatment informed `src/index.css` |

## `new-chat.zip`

| Upload file | Decision |
| --- | --- |
| `lib/audio.ts` | **ported** → `lib/audioLayers.ts`: `chime("done")` plays when a session completes, and the descending break cue and the 520 Hz click are ported and tested |
| `components/Pet3D.tsx` | **ported** — the fourth pet variant, reconciled into the same component |
| `pages/Landing.tsx`, `Flashcards.tsx`, `Habits.tsx`, `Leaderboard.tsx`, `Rooms.tsx`, `Missions.tsx`, `Pets.tsx`, `Tasks.tsx`, `Analytics.tsx`, `Dashboard.tsx`, `Focus.tsx` | **superseded / not ported** — feature pages with no counterpart (Flashcards, Habits, Leaderboard, Rooms, Missions) and this app's own pages for the rest |
| `lib/data.ts` (`DECKS`, `ROOMS`, `RIVALS` sample rows) | **not ported** — sample data for the unported features; copying rows would invent content |
| `components/charts.tsx`, `ui.tsx`, `Shell.tsx`, `lib/store.tsx`, `lib/missions.ts`, `lib/router.tsx`, `index.css`, `App.tsx`, `main.tsx`, `utils/cn.ts` | **superseded / not ported** — same reasoning as the other shells and stores |

## What the uploads asked for that could not be copied as-is

Two of their assumptions are incompatible with this app, and both are stated in
the code as well as here:

* **"No signup" / guest-first.** Every upload is a demo you can open and use
  anonymously; the timer here now requires a session, so the landing pages'
  promises were reworded rather than deleted (`src/App.tsx`'s `/focus` comment,
  `scripts/prerender-data.mjs`, the content corpus, `docs/PR99_PORT.md`).
* **A local coin/treat/hunger/joy economy.** Their care actions mutate a
  `localStorage` store; here bond XP is written by finished sessions on the
  server. The interactions were ported, the ledger was not — the copy under the
  care row says where XP comes from.

## Ours, not theirs (built here, labelled here)

Three things in this branch have no line to point at in any upload. They are
listed here so nobody goes looking for the source, and each one names the
request it answers.

* **Moveable workspace panels** (`lib/panelLayout.ts`, `components/MovablePanel.tsx`,
  `hooks/usePanelOrder.ts`) — "interface components should be movable like timer
  or other things". The only `draggable` attributes anywhere in the five ZIPs are
  `draggable={false}` on pet images; there is no reorder machinery to copy. The
  three `/focus` panels are placed with flex `order`, the move buttons come
  first and the drag second, and the arrangement is stored in this browser under
  `focusarx-panel-order`. See `docs/DESIGN_PACKS.md` for how it coexists with the
  admin-pinned `layout` pack.
* **The completion cue's dispatch** (`playCompletionCue`) — the uploads' two
  chimes were already ported, but their app plays them from a completion
  callback that knows which phase ended and this app's did not. The timers now
  pass the mode up, so a finished break stops ringing the "work is done"
  arpeggio. The chimes themselves are theirs; only the wiring is ours.
* **The phone's studying companion** (`components/pets/PetCompanionStage.tsx`) —
  the pet stage existed inline on `/focus`, which is why a phone never showed
  one: the desktop column drew it and `MobileFocusMode` — the screen a phone
  actually looks at while studying — did not. Extracted, then used in both. The
  art pack still decides what is drawn; the fallback to catalog artwork on a
  device without WebGL is the same rule `/pets` applies.

## Still open (tracked, not done)

* **A mobile-layout pass beyond the strips and the companion.** The phone
  contract is measured by the `w375` responsive suite (overflow, 44px targets,
  bottom-nav clearance) and the known offenders are fixed: the session-length
  and theme chip rows no longer wrap onto three lines, the control row can no
  longer outgrow 375px while a session runs, and the duplicate sound control is
  gone. What remains is taste rather than defect — spacing and density on the
  idle screen — and it needs a real device to judge.
