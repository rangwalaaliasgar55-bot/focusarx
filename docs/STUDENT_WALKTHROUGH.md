# Walking FocusArx as a student

**What this is.** I went through every interface the way a real student arrives —
phone in hand, signed out, arriving from an Instagram bio or a shared link — and
wrote down what I saw, how it felt, what I expected instead, and what to do about
it. Every observation below is backed by something measured, not remembered: the
numbers come from `src/pages/student-walkthrough.test.tsx`, which mounts each
route in the real provider stack and reports what actually rendered (character
count of visible text, headings, console output, and whether the page threw).

**Measured 2026-09-24**, on the branch `arena/01a0d2f8-focusarx`, against a stubbed
API returning empty payloads — which is deliberate. An empty payload is the *new
account* case, and a new account is what a new student has.

---

## 1. The walkthrough, interface by interface

For each: **what I saw → how it felt → what I expected → what changed.**

### Landing page `/` — 5,738 characters, renders fine

**Saw.** "The AI focus timer that builds real deep work habits." Product, features,
study guides, pricing, sign in, start focusing. Study guides are one click away.

**Felt.** Genuinely good. This is the strongest screen in the product. It explains
itself in one line and the primary button is unmissable.

**Expected.** Nothing more. The problem is not this page — it is that everything
*after* it is emptier than this page promises.

**Do.** Keep it. Point the growth work at the screens this page sends people to.

### Focus timer `/focus?duration=25&src=ig` — 1,190 characters, **no heading at all**

**Saw.** "Good morning, there." A ring. Focus / Break / Long Break. Six face
options. Zen mode, ambient, rituals, a task list. No heading, no explanation,
no orientation.

**Felt.** For me as a student this is the money screen and it half-works. The
timer is beautiful and starts correctly — I verified it counting down. But the
first thing I read is a greeting to nobody ("Good morning, **there**"), and there
is no sentence anywhere telling me what this screen is or what to do first. If I
arrived from an Instagram bio with three seconds of patience, I would see a clock
and a lot of small chips.

**Expected.** One line of orientation for a first-time visitor, phrased for a
student, and a heading the page can be identified by.

**Changed.** Added the missing `<h1>` (visually hidden — this page *is* the timer
and a visible headline would push the ring off a phone screen; the prerendered
document keeps its own visible H1 for crawlers). Screen readers previously
announced a page with no title.

**Still open.** The greeting says "there" for guests. A first-run line — *"Pick a
length, press start, keep your phone face-down"* — belongs above the ring for
signed-out visitors.

### Dashboard `/dashboard` — **crashed: 0 characters**, now 1,259

**Saw.** A blank white page and an error boundary.

**Felt.** Broken. Not "empty" — broken. This is the screen a returning student
opens first, every day.

**Cause.** `stats.chartData.map(...)` on a payload that arrived without
`chartData`. The page *had* a guard (`isError || !stats`), but `{}` is truthy, so
a 200 with an unexpected body walked straight past it.

**Changed.** `readDashboardStats()` normalises every field the render touches.
A thin payload now draws a zeroed dashboard — the honest reading — and a real
failure still takes the error path. Same fix for the wallet chip.

### Analytics `/analytics` — **crashed: 0 characters**, now 545

**Saw.** Blank page.

**Felt.** Worse than blank, because analytics is where a student goes to decide
whether the method is working at all. A blank screen there is a reason to quit.

**Cause.** `data.personalBests.totalMinutes` on a payload without `personalBests`.

**Changed.** `readAnalytics()` normalises the whole shape. Zero sessions now
renders "Total hours 0h, Total sessions 0" and the heatmap frame — which is
correct, and which a new student needs to see (it shows what will fill in).

### Study rooms `/study-rooms` — **crashed: 0 characters**, now 184

**Saw.** Blank page. This route is **public** — a guest can reach it from the
landing page.

**Felt.** The most disappointing one, because body-doubling ("study with me") is
the single most searched student behaviour on the internet and this is our answer
to it. A blank page here doesn't read as "no rooms yet"; it reads as "this app is
broken".

**Cause.** `rooms.filter is not a function` — `fetchRooms()` returned a truthy
non-array, and the `= []` default only covers `undefined`.

**Changed.** Both guards now: `= []` for the first render, `asArray()` in the
`queryFn` for a bad shape. Verified: "0 open rooms · 0 live now … No open rooms
yet. Open one — the first person in a room sets its rhythm."

### Quests `/quests` — **crashed: 0 characters**, now 228

**Cause.** `[...quests.daily, ...quests.weekly]` when either bucket was missing.
**Changed.** Both buckets normalised. Empty now reads "No daily quests right now
— check back after your next session."

### Leaderboard `/leaderboard` — 193 characters

**Saw.** "No one's on the board yet. Complete a focus session to earn XP and claim
a rank — **the AI rivals are waiting for you**." A large grey box with two lines.

**Felt.** Dead end, and slightly dishonest: the row badges that called rivals
*"🤖 AI rival"* had already been removed for exactly this reason, and the copy
still promised them.

**Expected.** If the board is empty, teach me the game. A student who opens a
leaderboard and finds nothing learns nothing — not how ranking works, not what one
session is worth, not whether anyone else is here.

**Changed.** The empty state now explains the mechanic it invites you into: XP is
20/minute so 25 minutes is 500 XP, the board ranks that plus your streak, streaks
compound, the board resets weekly so a bad week doesn't haunt you — with three
small cards and one button that *changes* the situation ("Start a 25-minute
block"). The rival promise is gone.

### Achievements `/achievements` — 174 characters in the probe, 23 badges server-side

**Saw.** "0/0 unlocked" — because the probe has no session, not because the
server is empty. `BADGE_DEFS` in `artifacts/api-server/src/routes/gamification.ts`
ships **23 badges** across time, streak and task tracks, with per-badge
`unlockRate` social proof already computed.

**Felt.** Relieved on inspection, worried on first glance: at a glance "0/0" reads
as "this game has no goals".

**Do.** The catalogue is good. The *entry* to it is weak — a new student should
see "nearest badge, N minutes away" as soon as the page opens, not a 0/0 header.

### Marketplace `/marketplace` — 305 characters

**Saw.** "Everything earned through effort. No pay-to-win. 0 Focus Coins."

**Felt.** Honest, and a wall. Nothing is purchasable at zero coins, so the page is
a shop with an empty wallet and no path shown from here to a first purchase.

**Do.** Show the cheapest item and how many sessions away it is ("≈1 session to
your first frame"). That single sentence converts a locked shop into a goal.

### Profile `/profile` — **crashed: 0 characters**, now 2,396

**Saw.** Blank page with no styling at all — exactly "no style or nothing gets
applied".

**Felt.** The one the user flagged, and they were right to. Every link to it from
the nav led to nothing.

**Cause.** `IntegrationSettings.tsx` did `setProviders(integrations.providers)`
from an unvalidated payload. `undefined` slips past the `providers === null`
render guard and reaches `providers.map(...)` — thrown during the profile page's
own render, so the whole route died.

**Changed.** Both payloads validated. Now renders 42 controls, 4 tabs
(Achievements / Activity / Wallet / Style), 32 token-styled nodes, clean console.

### Pricing `/pricing` — 2,418 characters. Fine.

**Saw.** "Simple, honest pricing." Free forever, Premium unlocked with earned
coins, ₹0, no card.

**Felt.** This is a *strength*. "No card, ever" is the single most persuasive
thing we can say to an Indian student who has watched every other study app ask
for ₹499/month. It is under-used everywhere else in the product.

### Onboarding `/onboarding` — 143 characters

**Saw.** "System Calibration 0% … Initialize Your Focus DNA."

**Felt.** Cold. The vocabulary is machine-facing ("calibration", "initialize")
at the exact moment a student is deciding whether to trust us with their time.

**Do.** Rename in the student's language: *"Three questions. Then your first
session."*

### Support / Changelog — 524 / 954 characters. Fine, and the changelog is a
genuine trust asset ("Short sentences. No hype.").

---

## 2. The pattern behind the crashes

Four separate interfaces rendered **nothing at all**, and all four were the same
bug wearing different clothes:

> `apiJson<T>` and `useQuery<T>` are **casts, not checks**. A 200 carrying `{}` —
> a proxy, an error envelope, an older API than this build, a cold start that
> answered before the database woke up — sails through as `T` and throws inside
> render, where it takes the whole route down to the error boundary.

It has now shipped five times: `/focus` (wallet), `/profile` (integrations),
`/dashboard` (stats), `/analytics` (personal bests), `/study-rooms` (rooms).

**The fix is architectural, not per-page.** `src/lib/api.ts` now exports
`asArray` / `asRecord` / `asNumber` / `asString`, and the rule is: *a screen that
renders numbers and lists must be able to render zeros and an empty list.* A
malformed payload degrades to an empty state; a genuinely failed request still
takes the error path. `UsageExample`:

```ts
const rooms = asArray<Room>(await apiJson("/api/study-rooms"));
const minutes = asNumber(asRecord(payload).totalMinutes);
```

This matters for the 100-user goal more than any feature: a blank screen is the
loudest possible "don't come back" signal, and a student who hits one has no way
to know whether it was them or us.

---

## 3. What a student actually wants (and where we fall short)

Straight answers to "what would make more students come".

**They want to know it works before they invest.** A student's first question is
not "what features do you have", it is "will this make me study". → The
**first-run line on `/focus`**, and a first session that ends by showing what it
was worth. Half done.

**They want to see progress in the first five minutes.** Our rewards are real and
correctly computed (20 XP/min, taper, streak bonuses — and the timer face now
shows the *true* figure instead of the old inflated one). But the walls come early:
marketplace empty until you have coins, achievements header at 0/0, leaderboard
empty. → Show **the nearest goal** on every one of these screens. Started
(leaderboard).

**They study next to someone.** Body-doubling is the strongest organic growth
loop we have and the weakest link in the funnel: study rooms, forge room, and
"study with me" are three separate routes, and a guest who opens `/study-rooms`
until today got a blank page. → Fix done; **the onboarding line into a room**
("join a room, work quietly beside someone") is not.

**They trust "no card" more than they trust any feature list.** → Say it on the
timer screen, not only on `/pricing`.

**They arrive on a phone, from a link, with one hand.** Every funnel measurement
should be the mobile path.

Concrete levers, in order of expected effect on getting to 100 users:

1. **First-run orientation on `/focus`** — the screen every shared link lands on.
2. **Join a room from the timer** — turns a solo tool into a social one at the
   moment of intent.
3. **Nearest-goal lines** on achievements / marketplace / quests.
4. **A shareable session result** — one card, one image, after a block ends. The
   only loop that brings students in without us paying for it.
5. **Fix the entry vocabulary** (onboarding, greeting) — cheap, and it is the
   first impression.

---

## 4. What was actually changed

| Change | File | Verified |
| --- | --- | --- |
| Shared shape validators (`asArray`/`asRecord`/`asNumber`/`asString`) + the rule written down | `src/lib/api.ts` | `tsc` clean |
| Dashboard no longer crashes on a thin payload | `src/pages/dashboard.tsx` | renders, 1,259 chars |
| Analytics no longer crashes on a thin payload | `src/pages/analytics.tsx` | renders, 545 chars |
| Study rooms no longer crashes (public route) | `src/pages/study-rooms.tsx` | renders, 184 chars |
| Quests no longer crashes on a missing bucket | `src/pages/quests.tsx` | renders, 228 chars |
| Timer face shows the reward the server actually pays | `src/lib/sessionRewards.ts` + `TimerDisplay.tsx` | drift-tested against the api-server source |
| Two new timer layouts, all six faces available to every tier, blurb shown in the UI | `src/components/timerfaces/TimerFaces.tsx`, `src/lib/timerTheme.ts`, `src/components/Timer.tsx` | 42 tests green |
| Profile crash (the page the user reported) | `src/components/settings/IntegrationSettings.tsx` | renders, 42 controls, 4 tabs |
| Admin is never locked out by maintenance mode | `src/components/MaintenanceGate.tsx` | bypass no longer needs a live session |
| Recovery when the browser fails to load the app at all | `index.html` + `src/main.tsx` | guard present in `dist` |
| No bot/AI tags on user-facing surfaces; coach is a Premium surface | `leaderboard.tsx`, `AppShell.tsx`, `FeatureCompassModal.tsx` | build PASS |
| Leaderboard empty state teaches the game, with a CTA | `src/pages/leaderboard.tsx` | build PASS |
| The funnel page has a heading at last | `src/pages/focus.tsx` | build PASS |

**Method.** `src/pages/student-walkthrough.test.tsx` is kept as the instrument:
it mounts all fourteen interfaces and reports what rendered, so the next person
can re-run the walkthrough instead of re-deriving it.

## 5. Still on the list

- First-run line + greeting for signed-out visitors on `/focus`.
- Nearest-goal framing on achievements, marketplace, quests.
- Onboarding vocabulary ("Initialize Your Focus DNA" → a student's sentence).
- Shareable session result card (the growth loop).
- Study-room / forge-room / study-with-me consolidation into one discoverable door.
- The remaining thin SEO pages, and the `/contact` body.
- Leaderboard visual work (`TiltCard`, `AVATAR_GRADIENTS` are in place; the podium
  and rows still look like a table).
