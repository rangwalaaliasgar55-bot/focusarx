# Timer layouts — what each one is and how it works

The timer has eight faces. They are not eight colours of the same dial: four of
them (`segments`, `bars`, `dots`, `rounds`) are **layouts**, which means the
geometry itself carries the information and the countdown is read a different
way in each.

Pick one from the face row under the ring (the picker shows the selected face's
explanation under it, and the choice is remembered per device). Nothing about a
layout changes the session: same seconds, same rewards, same saved history.

## The four layout faces

| Layout | What the picture is | How it works | Best for |
| --- | --- | --- | --- |
| **Segments** | A dial of 60 marks, one per minute | A mark is lit while its minute is still ahead. A segment goes out each minute, so the dial is a *count* you read at a glance, not an arc you estimate. The segment on the current minute pulses once a second — that pulse is the only moving part, and it marks where "now" is. | Sessions 25–60 min, where "eleven minutes left" is easier to feel than "10:47". |
| **Minute bars** | A row of bars, one per minute | Each bar's height is how much of that minute is left, so the face answers "how long is left" and "how big is a minute here" at once. The draining bar shrinks in real time; finished minutes collapse to a flat rule. Above 12 minutes, each bar carries an equal share of the session so a 90-minute block still reads. | Anyone who wants to *watch* progress rather than read it. |
| **Block grid** | Five-minute blocks as dots, five per row | A dot is printed only while that block is still ahead of you. Ten minutes is two dots; two hours is 24 dots. Above two hours each dot carries more than five minutes (the caption says how many), so a four-hour block is still a grid. The dot for the block in progress breathes slowly while running. | Long sessions, tired days — the pile of work left, in a unit that still feels achievable. |
| **Pomodoro rounds** | A closed ring for the round you are in, plus a pip per round | The session is split into 25-minute rounds. Finished rounds are filled pips, the current round is a ring that closes as the round progresses, and the rounds still to come are outlined. A session under 25 minutes is a single round; the ring is drawn with `stroke-dashoffset`, so only the ring and the clock move. | Thinking in rounds instead of minutes: "two more rounds" finishes sessions that "58 minutes left" abandons. |

## The four ring faces

| Face | How it works |
| --- | --- |
| **Classic** | The original gradient arc with a head node and 60 bezel ticks. A continuous sweep is the most familiar reading of a countdown; the tick at twelve is 60 minutes. |
| **Neon** | The same dial with a brighter stroke and a wider head node, using the higher-saturation step of the accent. No blur, no glow halo. |
| **Zen** | A flat 8 px line with no ticks and no head. The digits carry everything; the line only says roughly how far in you are. |
| **Flip Clock** | A rolling split-flap clock: the digits physically roll over when they change. The countdown reads as time passing rather than as a gauge. |

Paid membership skins (`plus` / `pro` / `elite`, see `src/lib/membershipSkin.ts`)
dress the ring faces. A skin and a layout can both be on: the layout owns the
geometry, the skin supplies the accent colour it is drawn in.

## Rules every face follows

1. **The accessible name carries the state.** Each face exposes
   `"N minutes M seconds remaining"` plus `"Finishes at HH:MM"` on one button, so
   the countdown is announced the same way whichever layout is on screen. The
   pictures are `aria-hidden`.
2. **The clock is the only self-moving element** on the page (plus, while
   running, the single "where am I" marker: the current segment, the draining
   bar, the live dot or the closing round ring).
3. **`prefers-reduced-motion` is honoured**: every face takes `useReducedMotion()`
   and skips the pulse/scale animations, leaving the numeric change.
4. **No blur, no glow halos, no decorative gradients** — enforced by
   `src/quiet-interface.test.ts` for all of `src/`.
5. **Tapping the time edits the duration** when the timer is idle; every face
   disables that affordance while running.

## Adding a ninth face

1. Add the id to `TimerTheme` and an entry (label + `blurb`) to `TIMER_THEMES` in
   `src/lib/timerTheme.ts`. The stored-choice reader validates against the
   registry, so an existing device keeps its own face and falls back safely.
2. Export the component from `src/components/timerfaces/TimerFaces.tsx`, taking
   `TimerFaceProps` (`secondsLeft`, `mode`, `isRunning`, `progress`,
   `onEditClick`, `sessionType`, `accent`, `accentSoft`).
3. Add the id to `LAYOUT_FACES` in `TimerDisplay.tsx` and render it in the
   delegated branch. Layout faces take the whole face, skin or not.
4. `src/lib/timerTheme.test.ts` fails if a registered face has no blurb or no
   renderer, so the three lists cannot drift apart.
