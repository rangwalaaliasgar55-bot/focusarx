# Changelog

All notable changes to FocusArx. Dates are UTC.

## [2026-09-24] — The AI answers, the pages arrive early, six more timer faces

Three complaints, three root causes. "Gemini doesn't do what I ask" was an
entitlement bug. "Loading time of each thing" was every page chunk being fetched
*after* the click. "The timer is still boring" was a gap in what the picker
offered.

### The AI was locked, not broken

- **`POST /coach/chat` was `requirePremium`.** A free student never reached a
  model: the server refused with 403 and the panel refused to send at all
  ("Do not load AI model for free users", `isLocked`), so the only text they
  could get was a canned reply or a lock screen. That is what "the AI does not do
  what I asked" was. The route now runs on a **daily allowance** —
  `COACH_DAILY_FREE = 10` messages (`COACH_DAILY_PREMIUM = 60`, and premium keeps
  its unlimited feel), counted from the AI call log. The per-IP cap, input
  sanitisation, prompt-injection detection and budget caps are unchanged.
- **The panel shows the allowance instead of a paywall**: "N of 10 messages left
  today" in the header, the chat for every signed-in student, a sign-in card for
  visitors (the endpoint needs an account), and the server's own sentence — with
  the reset time — on the one screen where an upgrade pitch is honest.
- **The offline coach now performs the task.** `builtinReply` was a keyword match
  over seven motivational lines, so "plan my thermodynamics revision" came back
  as a quote. It now returns the *shape* of the answer for plans, breakdowns,
  note-making and "what should I do first", names its assumption, and never asks
  a question back.
- **Gemini survives its own model churn.** The candidate list is a guess about a
  remote catalogue (1.5 retired 2025-09, 2.0 in 2026-06, 2.5 restricted
  2026-09). When every candidate is rejected as a model ID, the gateway now asks
  `models.list` what the key can actually reach, ranks the answer (newest
  generation, flash over pro, stable over preview, `-latest` aliases first) and
  uses it — so a retirement costs one extra call, not the whole integration.
  401/403 are now logged as an account problem instead of looking like silence.
- **Admin → AI has a "Run test" button** (`POST /admin/gemini/self-test`): one
  real 16-token request, reporting provider, model, latency, whether the model
  changed mid-call, and a plain-language diagnosis. Budgets and past latencies
  cannot answer "is it working right now" — a never-used key and a 404-ing model
  both read as zero calls.

### Pages arrive before the click

- **Route prefetching** (`src/lib/routePrefetch.ts` + generated
  `src/lib/routeChunks.ts`, 109 routes derived from `App.tsx`). Every page is a
  lazy chunk fetched *when the route renders*, so every navigation paid the
  download while the student watched a spinner. Chunks are now fetched on intent
  (`pointerover`, `focusin`, `touchstart`, `pointerdown` on same-origin links),
  for the three most likely next screens once the browser is idle, and on
  `popstate` — while `saveData`, `2g`/`slow-2g` and `/admin` are never
  prefetched. A `routeChunks.test.ts` assertion fails if a route is added to the
  router without a prefetch entry.
- **The prefetch layer is itself a lazy chunk** (19.8 kB) loaded on the first
  idle callback, because shipping the 109-entry map in the entry bundle pushed it
  over the 55 kB gzip budget — measured, not assumed.

### The timer, and how each layout works

- **Six faces → eight.** Two new layouts: **Block grid** (one dot per five
  minutes, five to a row; dots disappear as the session is used, so a two-hour
  block is 24 dots you can count) and **Pomodoro rounds** (the session counted in
  25-minute rounds — finished rounds fill in, the current round closes like a
  gauge — because "two more rounds" finishes sessions that "58 minutes left"
  abandons). `LAYOUT_FACES` in `TimerDisplay` is a single explicit set, and
  `timerTheme.test.ts` fails if a registered face has no renderer or no blurb.
- **`docs/TIMER_LAYOUTS.md`** explains all eight faces — what the picture is, how
  it works, what it is best for — plus the five rules every face follows
  (accessible name carries the state, one self-moving element, reduced-motion
  escapes, no blur/glow, tap-to-edit while idle) and how to add a ninth.
- **The timer now says what staying is worth** (`components/SessionWorth.tsx`):
  "this 45-minute block pays 900 XP and 90 coins", the "+50 coin bonus for a
  full 25 minutes", how far a short block is from it, and — past two hours — the
  75% taper, stated rather than hidden. While running it switches to what is
  banked and what finishing adds. The figures come from the shared reward maths
  (drift-tested against the server), so the number on the timer is the number
  that lands in the wallet; the old component-level formula was wrong by a third
  on a marathon.
- **The quick prompts became tasks**: "Motivation boost" and "I'm
  procrastinating" invite a pep talk, and a pep talk is indistinguishable from an
  AI that ignored you. They now name artefacts — "Plan my next 3 hours", "Break
  my assignment into steps", "What should I work on first", "Turn this topic into
  notes".

### First run, and empty states that teach

- **`/focus` says what to do** for a genuine first run: three steps ("pick a
  length", "press start and put the phone face-down", "you will see exactly what
  it earned"), dismissible, remembered, and shown only to a signed-out visitor
  with no completed session.
- **Quests with nothing on them** get the one card that fills the board: what a
  quest is derived from, what a 25-minute block pays, and a link to start one —
  replacing "check back after your next session".
- **Achievements and the marketplace** now say how far away the nearest thing is
  in *sessions*, not units: "3 blocks of 25 minutes away", "earn it in a block"
  (`src/lib/progressCopy.ts`, built on the real `computeSessionRewards`).

### Verified

- Full suite green: **95 files / 821 tests** (frontend), **58 files / 656 tests**
  (api-server); `tsc` clean on both.
- Build PASS: 132 prerendered pages, `seo-validate` PASS, bundle budget PASS —
  entry 54.2 kB gzip (limit 55), initial JS 115.4 kB gzip (limit 140).
- New regression tests: `CoachPanel.access.test.tsx` (a free student's message
  reaches `/api/coach/chat` and the reply renders), `coachEntitlement.test.ts`
  (no premium wall on the coach routes; allowance is real; guardrails intact),
  `aiModelDiscovery.test.ts` (ranking/selection), `routePrefetch.test.ts`,
  `SessionWorth.test.tsx` (the projected payout equals the server's maths for every
  preset length), `timerTheme.test.ts` (every registered face has a renderer, a
  blurb and a row in the layouts doc).

## [2026-09-23] — Design system v5: "Quiet tools"

The interface had accumulated the visual vocabulary of a template: black-violet
gradients, aurora washes behind every hero, glow shadows under every card,
gradient headlines, neon borders, a cursor spotlight, a three.js atmosphere
panel, and roughly 600 lines of decorative CSS that nothing rendered. This
release replaces that with a system whose rules fit on one screen — and makes
the product look like what it is, a tool for focusing.

### The five rules (docs/DESIGN.md)

1. **One accent.** `--brand-500` marks the primary action, the active
   destination and the focus ring — nothing else. Scarcity is what keeps the
   accent meaning "press this".
2. **Flat surfaces, hairline separation.** Depth is one tone step plus a 1px
   border. No glow, no blur, no gradient-as-material.
3. **No decorative motion.** The countdown is the only thing allowed to move on
   its own.
4. **Short motion.** 150–250 ms, transform/opacity only, reduced-motion escapes
   everywhere (unchanged, and still enforced by the token gate).
5. **Type carries the design.** One family pair, one scale, tabular figures.

### Colours and surfaces

- **New neutral ramp.** Warm graphite (`#0B0B0C` → `#1D1E22`) in dark,
  paper-warm white in light. The blue-black page is gone, and with it the
  "AI dashboard" tint that came from it.
- **New default accent: indigo `#6366F1`.** The violet-on-black default was the
  house style of every AI product of the last two years, and it failed as text
  at the step the chrome used it. The brand mark keeps its violet → azure tile
  (`docs/BRAND.md`); `DEFAULT_ACCENT`, `ACCENT_PRESETS` and `--brand-500` are
  now asserted to agree by `AppearanceSettings.test.tsx`.
- **The accent no longer owns depth.** `buildAccentOverrides` stopped emitting
  `--glow-*` and `--shadow-violet-*`, so picking a colour grades the interface
  instead of lighting it up. Pinned by `src/lib/accent.test.ts`.
- **Radii came down** (6/8/12/16/20 instead of 8/12/16/22/28) and `rounded-3xl`
  was capped at `--radius-xl` in 37 places; `shadow-2xl` became `--shadow-lg`
  in 37 more.
- **The whole glass family is flat.** Translucent fills and 28 px backdrop blur
  lowered the contrast of everything sitting on them and cost a compositor
  layer per card. `.glass`, `.glass-card`, `.glass-strong`, `.glass-heavy` and
  `.glass-chrome` now resolve to a surface step and a hairline.
- **Hardcoded dark panels were themed.** The timer card, Zen overlay, coach
  panel, flashcards and missions had literal near-black palette values, so they
  stayed dark in the light theme. They read semantic tokens now.

### Structure

- **`index.css` is layered.** Eight numbered sections — primitives, semantics,
  base, type, materials, legacy, components, motion — with the rule that a
  component reads semantics and never primitives. `docs/DESIGN.md` is the prose
  version and names the gate that enforces each rule.
- **The stylesheet got shorter while documenting itself more.** `index.css`
  went from 2,661 lines to 2,194: the layer the app actually loads lost 324
  lines of unused keyframes (orbit, marquee, breathe, liquid-fill, sparkle,
  shimmer-sweep, scan, fire, float-orb), HUD reticles, grain and dot-grid
  textures, glow/gradient utilities, magnetic hover and perspective cards.
- **The pre-v5 vocabulary is gone from the components.** `text-gradient`,
  `glow-*`, `shadow-3d`, `forge-bg-glow`, `hud-*`, `logo-pulse`,
  `neon-border-pulse`, `texture-*`, `animate-sparkle|shimmer-sweep|fire|scan|
  float-orb|orbit|marquee|breathe|liquid-fill` and the rest of the atmosphere
  vocabulary have no call sites left; the rules that remain in the stylesheet
  are a stub for anything still rendering, and `src/quiet-interface.test.ts`
  fails the build the moment one comes back.
- **The MarketingNav, hero and footer were rebuilt**, and 18 decorative
  `blur-3xl` gradient blobs were removed across 13 pages.

### Swept the components

The stylesheet can only stay quiet if the class names in 300-odd components
agree with it, so the same rules were applied mechanically across the app
(admin console excluded — it is a dense tool with its own material):

- **103 backdrop blur utilities removed** across 65 files. Each one was a
  compositor layer, and the surfaces underneath were already opaque tokens.
- **76 glow shadows removed** — zero-blur glow shadows (`0 0 Npx` in an arbitrary value), accent-tinted shadows and
  `drop-shadow` halos. Depth is neutral or it is nothing.
- **69 decorative gradients flattened** to the token they were standing in for;
  gradients from a brand hue are now banned by test. Photo and headline scrims
  (`from-black/…`, `from-transparent`) are untouched.
- **31 hover scales removed**, 26 `forge-bg-glow` page wrappers dropped, nine
  nine `rounded-[32px]` and three `rounded-3xl` capped, five `shadow-3d*` mapped to
  neutral elevation, one gradient headline de-gradiented.
- **Eleven rarity styles were resolving to nothing.** `pages/lootboxes.tsx`
  referenced eleven `--rgba-*` tokens that were never declared, so a legendary
  reward looked exactly like a common one. The tiers read the status hues now.
- The timer's loading state no longer breathes at you while it waits, and the
  dashboard hero gave up its 176px conic-gradient ring: the countdown is set
  large in tabular figures with a 1px progress bar under it.

### Daylight actually works now

- **The white washes are re-inked.** The compatibility ramp is near-white at
  low alpha — a brush stroke on a black page, and nothing at all on a white
  one. Every hover fill, inset highlight and separator written against it
  vanished in light mode, which is why Daylight read as flat. `html.light`
  restates those alphas as ink.
- **`--surface-2` is a well in Daylight.** White-on-white has no tone step, so
  a hovered row or an interactive panel gave no feedback at all. A raised
  surface is now marginally darker than the card it sits on.
- `--palette-slate-400`, `--palette-sky-900`, `--neutral-*`, `--control-*`,
  `--radius-xs`, `--brand-pink` and `--brand-violet-light` were referenced but
  never declared — an undefined token invalidates the whole declaration, which
  is how a "white label on the accent" quietly became an inherited colour.
  They are declared again.

### The homepage

- **Hero is left-aligned and two-column**: the copy on one side, a running
  timer on the other. No sparkle badge, no aurora, no dot grid, no gradient
  headline, no cursor spotlight.
- **The three.js "focus atmosphere" panel is gone** (~890 kB behind an
  IntersectionObserver, rendering nothing the reader needed). In its place: a
  diagram of what a focused hour is actually made of.
- **Marketing type is now the product's type.** The Instrument Serif italic +
  DM Sans pairing is gone — the serif-italic hero is the signature of every
  generated landing page, and one voice everywhere is the point.
- Every section, claim, exam guide, comparison, ad slot and crawlable footer
  link is preserved; the page still prerenders and passes `seo-validate`.

### Also fixed

- **`RazorpayCheckoutCard` did not typecheck.** It tracked `checkout_started`
  and `checkout_completed`, which the `AnalyticsEventType` union never declared.
  The union now includes them (`pnpm typecheck` is green again), and the
  provider's checkout sheet inherits the live `--brand-600` instead of a
  hardcoded `#7c3aed`.
- `styles.tokens.test.ts` now resolves `var()` alias chains before running the
  contrast maths, so the token layer can be layered without weakening the gate.

### Verification

`pnpm typecheck` is green, all 780 unit tests pass — including the four gates
that pin this work (`design-tokens.contrast`, `styles.tokens`,
`quiet-interface`, and `AppearanceSettings` reading `--brand-500` out of the
stylesheet) — and the full production build passes: 132 prerendered pages,
`seo-validate`, and the bundle budget, with the entry chunk at 53.2 kB gzipped.

Full-repo `eslint .` still reports the ten errors that predate this change (an
unused `lazy`, an unused `useRef`, three `set-state-in-effect` sites, a
memoization the React Compiler cannot preserve, and one shared `Route` type);
`pnpm lint:changed` — the gate CI runs — is clean for every file touched here.

## [2026-09-19] — Your first day is no longer an empty dashboard

New accounts used to land on four empty states and a generic wizard. Onboarding
now *builds* something while you are still inside it.

### The generator

- **`POST /api/onboarding/personalize`** turns the answers everyone gives (what
  you are chasing, how much time you have, when you study) into a dream with its
  follow-along system, a seven-day kickoff week, three milestone goals and a
  starter flashcard deck — in one call, with a welcome notification naming the
  plan.
- **It works with zero AI keys.** `onboardingPlan.ts` holds the deterministic
  week and deck templates, shaped by the dream's own blocks and subjects, so
  Gemini's version is an upgrade rather than a dependency. A model reply is
  clamped (≤140 chars, 10–180 minutes, validated priority, 7 tasks max) and is
  only accepted if it clears four real tasks; otherwise the template wins.
- **Idempotent.** The plan is stored once under `onboarding_plan_<userId>`, so
  pressing *Generate* twice returns the plan you have instead of stacking a
  second week of tasks on top of the first.
- **Never destructive.** An account that already has tasks, goals or decks keeps
  them; the generator reports those areas as `skipped` instead of overwriting
  someone's real work.
- **`GET /onboarding/plan|status|dream-options`** feed the wizard, the dashboard
  kickoff card and the dream picker from one source of truth. `DREAM_TYPES` and
  `DREAM_SYSTEMS` moved to `lib/dreamSystems.ts` so both the dream page and the
  generator read the same definitions.

### The wizard, the dashboard and the screens around them

- The onboarding "plan" step (`/onboarding?step=plan`) is a dream picker, study
  window and optional target date, then a reveal card: counters, the first three
  tasks, the daily habit, the next milestone, what was skipped and where the
  plan came from. The dream list comes from the server, and says so when it
  falls back to the standard five.
- `OnboardingChecklist` now ends on "Generate your personal plan" and shows a
  kickoff card on an empty dashboard, so the generator is discoverable after the
  first visit too.
- **Plain single columns became layouts**: quests gained a claimable/coin/XP
  summary strip and side-by-side daily + weekly tracks; notifications gained
  filter chips with counts, day grouping (Today / Yesterday / Earlier this week)
  and relative timestamps; goals gained a completion strip and two-up cards;
  habits went two-up; the coin shop grew a third column, per-category counts and
  a hover lift.
- 14 unit tests pin the generator's templates and clamps, and a DB-gated
  integration test covers the full plan, the second-call no-op, and the
  never-overwrite rule.

## [2026-09-19] — Gemini as staff, purchases you can see, systems per dream

A pass over everything that was wired but inert: bought items that never
appeared, flags that gated nothing, "connect an app" buttons that could not
connect, and a mission list nobody raced.

### The marketplace stopped being a place where coins disappear

Buying an item equipped nothing and rendered nowhere. Now:

- **Equipping has slot semantics** (`frame`/`avatar`/`effect`/`decoration`
  replace their predecessor; pet accessories stack by pet slot), and the shop
  card grows a real Equip button that says "Wear frame", "Put on pet",
  "Use booster" — the verb matches the item.
- **`GET /marketplace/equipped`** and the profile header render what you are
  wearing: the frame becomes the avatar ring with its rarity glow, an avatar
  skin replaces the initials, the effect rides as a badge, and city decorations
  and pet accessories are listed under the name.
- **Curation**: `special-xp2` / `special-coin2` are retired (their `special-*`
  ids contradicted their own `booster` type and they undercut the whole rarity
  ladder), thirteen legacy items are repriced onto the ladder, and premium
  skins keep the prices their buyers agreed to. `ensureDefaultItems()` now
  updates code-owned items instead of only inserting new ones, so curation
  edits actually reach a seeded database.

### Gemini stopped summarising and started working

- **Marketplace steward** (`POST /admin/gemini/marketplace-steward`, also run
  daily): introduces up to three new items and retires up to three. Every guard
  rail is enforced server-side — prices clamp to the rarity ladder, premium
  items and bundle contents are never retired, and anything owned by more than
  25 learners is left alone.
- **Quest builder** (`POST /admin/gemini/quest-builder`, also run daily):
  writes new daily/weekly quests against the real metric set
  (`focus_minutes`, `session_count`, `coins_earned`, `xp_earned`,
  `streak_days`), clamped to target and reward bounds, namespaced with `gem-`
  ids and idempotent.
- **Mission of the day**: one Gemini-chosen mission for the whole platform,
  cached per IST day, with a one-line reason and a live count of how many
  learners already cleared it.
- Both steward jobs have seeded fallbacks, so they do real work with zero AI
  keys, and a failure there can never fail the briefing.

### Competition you can see

- **`GET /social/completions`** — the public "who just finished what" board,
  assembled live from the mission and quest progress tables (no shadow feed, so
  it cannot drift from reality). First name + surname initial only; bots are
  excluded because missions are the humans' race.
- The missions page leads with the completion feed and the featured mission.
- **AI rivals advertise their tier**: ~40% of the bot fleet carries a
  deterministic "Premium rival" badge on the leaderboard, alongside a plain
  "AI rival" tag — a display label on a synthetic competitor, never a
  fabricated subscription row.

### Flags, settings and connections that work

- **Feature flags have a consumer.** `useFeatureFlags()` fetches the flag map,
  **fails open** (a flag endpoint outage never turns features off) and gates the
  Leaderboard and Community nav entries plus the whole Loot Boxes page, which
  renders "switched off" instead of a broken screen. The admin panel can now
  delete flags (with `gemini_auto_publish` protected) and lists which keys are
  actually wired.
- **Custom site settings**: any key/value pair can be added, edited, marked
  public or deleted from the admin panel without a deploy. Only `public: true`
  entries leave the admin surface via `/api/site/custom-settings`.
- **Connections without an app registration.** Every provider now offers the
  credential-free door it actually has: a private iCal feed (fetched and
  validated as a real calendar before saving), an incoming webhook (proven with
  a test message at connect time), or an API key. Manual connections get a Test
  button, and when `INTEGRATION_ENCRYPTION_KEY` is absent the card says the
  credential is stored unencrypted instead of pretending otherwise.

### Learning systems

- **Auto-deck flashcards**: pick board (CBSE/ICSE/State/JEE/NEET/UPSC/CA),
  class, subject and topic — Gemini writes the whole deck, curriculum-anchored,
  reusing the deck when the same request is repeated.
- **Voice**: `POST /arx/voice` turns a spoken request into an answer *and* an
  action (create task, create goal), validated through a closed action enum.
  Arx answers out loud via speech synthesis, and a pattern-based parser handles
  "add task …" with no AI key at all.
- **Dreams carry systems, not labels**: each of the twelve dream types has its
  own subject split, daily block plan, milestones, daily habit and check-in
  question, scaled to the learner's daily target and rendered on the dreams
  page.
- **Loot box reveals** now run three beats — shake (harder for higher tiers),
  burst, reveal — with rarity colour, particle ring and a coin count-up; a
  duplicate is paid out in coins through the ledger, and an item reward offers
  "Equip now" so the win lands somewhere visible.

### Admin fixes

- **Registered-users count** is taken from the server's human-only total. The
  old `allUsers.length - botCount` went badly negative as soon as the bot fleet
  outgrew one page of results (the −17,986 in the screenshot).
- **Retention tab** opens with cohort health — DAU/WAU/MAU, stickiness,
  activation and returning rates, plus the at-risk and dormant counts that give
  an admin something to act on.

## [2026-09-19] — Community polish, admin powers, ambient tracks

Bug fixes from live screenshots and a round of community/admin upgrades:

- **Site Settings "Invalid settings" fix** — the admin panel sent empty optional
  fields as `null`, which the zod schema (`.optional()`, not `.nullable()`)
  rejects; the payload now omits falsy optional keys and the error display
  parses error objects instead of printing `[object Object]`.
- **Streak-endangerment dedup made idempotent** — replaced the fragile
  timestamp-window check with a `data->>'day'` JSONB key, so a learner gets
  exactly one nudge per in-zone day no matter how often the emitter runs.
- **Push-enable feedback** — the notifications page now explains each failure
  cause (denied → browser settings, unsupported, no service worker) instead of
  one alarming catch-all toast, and confirms success.
- **Study rooms talk back** — posting a room message now queues 1–2
  topic-matched bot replies (best-effort, settings-gated, seeded by message
  id), and the Collective Focus page gained a Discord-style room chat panel
  with bot badges, join-gated input and 6s polling.
- **Social like the big networks** — follower/following counters in the page
  header, follow buttons on feed posts, leaderboard rows and search results,
  and a Network tab with a followers list, "Top fan" highlight and
  follow-back.
- **Admin streak adjustment** — `POST /admin/users/:id/streak` (bounded 0–3650,
  updates longest streak, logged) with an inline ✎ editor in the admin user
  table. No native dialogs — editing is inline.
- **Admin-addable ambient tracks** — `GET /site/ambient-tracks` (public) and
  `PUT /admin/ambient-tracks` (admin, https-only, max 20) store curated
  streamed audio in `platform_meta`; the ambient mixer renders them under
  "Curated tracks" with per-track volume, and the Site Settings panel manages
  the list. The mixer panel also boots collapsed so it no longer eats a column.
- **Removed the YouTube focus companion** — it shipped placeholder/dead video
  ids and rendered a stray "Play @AJourneyR Videos" pill on the timer page.
- **Battle-pass banner hardening** — top clearance for the sticky topbar,
  responsive stacking, full-width progress column on mobile.
- **Gemini chief-of-staff upgrade** — daily briefing now ingests human/bot
  post share, new follows, room messages, premium and streak health; a
  server-side `detectAlerts` watch list works even with zero AI keys; and the
  prompt gives Gemini a senior-developer persona (Vitals / Watch / Next
  actions).

## [§1.6] — Webhooks and integrations

The last large unbuilt subsystem. Outbound webhooks with HMAC-signed deliveries,
a retrying delivery worker, and an OAuth integration layer for Google Calendar,
Google Fit, Slack, Discord and Apple Health.

### The delivery rule is an invariant, not a policy

A webhook is a promise that an event reaches someone. Three things would have
broken that promise in the obvious implementation, and each is a decision made
explicitly:

- **A retry must be safe to receive twice, so every delivery carries a stable
  `X-Focusarx-Delivery` id** and the table has a UNIQUE constraint on it. A
  receiver may see the same id twice — that is what a retry is — but must never
  see two different payloads under one id, because "ignore an id you have
  already seen" is the documented deduplication strategy.
- **The signature covers the timestamp.** `X-Focusarx-Signature: t=…,v1=…` is an
  HMAC over `${t}.${body}`, not over the body alone. Signing the body alone makes
  a captured request replayable forever; the receiver can now reject anything
  older than its tolerance window. `verifySignature` ships with the layer, so the
  construction is executable documentation and a change to it fails in our tests
  rather than in a customer's integration.
- **The body is serialised once and stored verbatim.** Re-serialising at delivery
  time would let the signed bytes differ from the sent bytes if a key order ever
  changed, and the receiver's stored signature check would fail on a redelivery
  that should have succeeded.

### A signing secret in plaintext makes the signature decorative

`INTEGRATION_ENCRYPTION_KEY` gates the whole feature, and every stored webhook
secret and OAuth token is **AES-256-GCM** ciphertext (`lib/secrets.ts`). The
reasoning: a plaintext webhook secret in a leaked backup lets an attacker forge
deliveries *into the user's own endpoint* and pass the verification the user
relies on. A plaintext refresh token is durable access to someone's calendar that
they never rotate.

Unset, the feature is off in a way that cannot be mistaken for working: creation
returns **503 `WEBHOOKS_NOT_CONFIGURED`**, every provider reports
`unavailableReason`, and the worker stays idle. The tempting alternative —
falling back to base64 or a hard-coded default — produces something that *looks*
encrypted in the table and is not.

The plaintext secret is returned **once**, from creation and rotation, and never
again; every later read shows an eight-character hint. Otherwise a stolen session
could be used to collect the signing keys of every endpoint the user owns, which
would make encrypting them at rest worth nothing.

### A user-supplied URL the server fetches is an SSRF primitive

`http://169.254.169.254/latest/meta-data/` returns cloud instance credentials to
whoever asks, and "POST to this URL for me" is exactly that feature.
`validateWebhookUrl` blocks the metadata range, RFC1918, CGNAT, IPv6
unique-local/link-local, and IPv4-mapped addresses — in every spelling a URL
parser accepts, including `127.1`, `0x7f.0.0.1`, `2130706433` and
`[::ffff:127.0.0.1]` (which `new URL()` rewrites to hex, defeating a dot-matching
regex). Redirects are not followed, because a 302 to a private address happens
*after* the check. In development only, loopback over http is permitted so a
receiver can run locally.

### Failures are visible or they are lies

- An endpoint is auto-disabled after 15 consecutive failures, and the reason is
  stored and displayed. Continuing to POST to a URL that has failed a hundred
  times is how an integration layer earns a reputation for abuse.
- A delivery's `responseBody` is kept (truncated to 2KB) because "HTTP 500" is
  not actionable and the receiver's own error string usually is.
- A row interrupted mid-delivery is reclaimed after ten minutes; without that it
  stays `sending` forever, invisible to both the user and the retry worker.
- Slack returns **HTTP 200 with `{"ok":false}`** on an OAuth failure, so a check
  on `res.ok` alone stores an undefined token and leaves a connection that shows
  as Connected and fails on first use. `exchangeToken` treats a missing access
  token as the failure signal.
- The provider's whole token response is redacted before being stored for
  debugging — keeping it would put an access token in plaintext JSONB *next to*
  the encrypted copy.

### Gating, so nobody approves access they cannot use

OAuth needs an app registration the deployer may have not done. Every provider is
env-gated, `GET /api/integrations` reports `configured`, and the UI **disables
Connect and shows the reason up front** — rather than sending the user through a
consent screen and telling them afterwards. Unconfigured providers name the
missing variable outside production and say nothing internal inside it.

Apple Health is modelled as a manual import, not a connection: Apple exposes
HealthKit only to a signed app on the device, and offering a Connect button that
cannot work is worse than offering none.

The OAuth `state` is a signed value carrying the user id, a nonce, and a
ten-minute expiry, with the PKCE verifier inside the MAC rather than in a
server-side session. The callback route cannot sit behind `authMiddleware` — the
browser arrives from Google with no bearer token — so **the state is the only
authentication on that route**, and `webhookSecurity.test.ts` asserts the user id
comes from it and that the state check precedes the code check.

### Tests

105 new tests across five files. Both source-level gates are negative-tested:
`webhookSecurity.test.ts` fails when a credential column is written unencrypted,
when the ciphertext is leaked through a response shape, or when a URL check is
removed; `webhookEvents.test.ts` fails when an event is added to the catalog with
no emitter and when a milestone event would fail on an ordinary day.

## [Unreleased] — launcher overlap fixed, three timer faces, geometry by media query

- **Quick Launch no longer overlaps anything.** The orb sat exactly at the
  top edge of the mobile bottom nav (both were `4.5rem + safe-area`) and the
  panel floated at a fixed 9rem with no height cap — on shorter phones it
  clipped under the header and kissed the nav border. Geometry now lives in
  index.css media queries (inline styles would outrank responsive classes):
  the orb clears the nav by a visible gap on mobile and anchors to the plain
  viewport corner on desktop where the nav is hidden; the panel is inset from
  both screen edges on phones, right-anchored beside the orb on desktop, and
  scrolls internally under a viewport-derived max-height. 1 new test pins the
  geometry hooks.
- **Three timer faces.** Classic (the existing ring), **Neon** (brand→pink
  gradient ring + brighter halo, focus mode only so break/long-break keep
  their rest colours), and **Zen** (8px ring, near-silent halo, softer
  shadow). A Face picker sits under the session dots; the choice persists in
  localStorage. Deliberately free-tier only: paid membership skins already
  restyle the ring as part of their value, so when a skin is active it wins
  and the picker stands down. 9 new tests (5 display cases, 4 persistence).

Gates: api-server 607 tests, frontend 767 tests, tsc + eslint clean (only
pre-existing warnings), build + SEO + prerender + bundle budget PASS.

## [Unreleased] — auto-publish goes live, and one circle opens the whole momentum layer

- **Gemini auto-publish is ON.** Approving an idea now ships it to the
  community feed in the same action — no second click. The switch is the
  `gemini_auto_publish` feature flag (default ON when absent; a stored row
  with `enabled: false` is the off switch), exposed as a toggle in the
  Gemini panel and in Feature Flags. Publish failures degrade to a plain
  approval — nothing is ever lost. The shared `publishIdea` core backs both
  auto-publish and the manual publish route; announcements still write the
  site banner store. Every auto-publish is audit-logged as
  `idea_auto_publish`.
- **Quick Launch orb.** Momentum features were sidebar-only, which mobile
  users never unfold. A floating circle now sits in the thumb corner of
  every app page (desktop included) and expands into a 10-tile launcher:
  Timer, Companions, Missions, Quests, Leaderboard, Community, Focus City,
  Break Free, Achievements, Rewards. Accessibility is the contract, not an
  afterthought: `aria-expanded`/`aria-controls` on the trigger, focus moves
  into the panel on open and returns to the orb on close, Escape and the
  scrim both dismiss, 44px+ touch targets, and reduced-motion users get the
  panel without pulse or stagger. The orb follows the bottom nav's
  visibility — an active focus session never gains a new distraction. 5 new
  tests.

Gates: api-server 607 tests, frontend 757 tests, tsc + eslint clean,
build + SEO + prerender + bundle budget PASS.

## [Unreleased] — admin audit: fixes for maintenance, flags, Gemini publishing, and pet discovery

A sweep of the admin surface, fixing the things that read as "broken" and
closing the gaps between deciding something and that thing going live.

- **Maintenance mode looked broken because it asked for two clicks and then
  hid its own effect.** The toggles only persisted on a separate Save click,
  and admins bypass the maintenance gate by design (they must be able to
  switch it off), so flipping it on appeared to do nothing. The toggles now
  autosave the moment they flip, and while maintenance is live the panel
  says exactly that — including that admins are exempt and to use an
  incognito window to see the visitor view. Server auth was audited in the
  same pass: the settings PATCH already resolves to `checkAdminAuth`.
- **Feature flags were display-only.** The API has always accepted upserts,
  but the panel rendered a static list with no controls — changing a flag
  required the SQL editor. Every flag now has a live ON/OFF switch and there
  is a "New flag" form, giving developers a first-class toggle for wiring
  unreleased work.
- **Gemini ideas used to dead-end at "approved".** Approving an idea changed
  a status field and nothing else — which reads as "Gemini does nothing".
  Approved ideas now have two human-triggered publish paths: **publish to
  the community feed** (posted as the publishing admin, which also triggers
  the bot fleet's guaranteed quick replies to admin posts — the visible
  reaction loop) or **set as the site announcement** (same store the Site
  Settings panel writes, cache invalidated immediately). Published ideas
  are marked `published` and every publish lands in the immutable AI action
  audit log. Auto-publish stays OFF by design; the human still pulls the
  trigger.
- **Companions were invisible.** `/pets` had no entry anywhere in the nav —
  users could only find it by searching. It now sits in the Momentum group
  ("Companions"), the same fix Focus City got when it was sheet-only.

Follow-up flagged, not built here: the Battle Pass admin panel is read-only
analytics with hardcoded season text; admin-authored seasons/rewards need a
schema change and its own workstream. Gates: api-server 607 tests, frontend
752 tests, tsc + eslint clean, build + SEO + prerender + bundle budget PASS.

## [Unreleased] — timer length stays changeable, pets move, and the resource designs' type

Three fixes that all come down to the same principle: once something is
chosen, choosing again must still be possible.

- **Timer: pause, then pick a different length.** The preset row (Pomodoro /
  Extended / Deep Work / Animedoro / Flowtime / Custom) rendered only while
  `status === "idle"` — the moment a block started, the controls vanished and
  the only way to change the length was abandoning the session. Now the row
  renders while paused too, `handleEditTime` accepts paused sessions, and
  `setCustomDuration` re-arms the clock whenever the session is not live
  (`status !== "running"`): while paused the ring refills at the new duration
  and the user resumes into the fresh block, with a toast saying exactly that.
  A running clock is still never rewritten mid-tick — that would corrupt the
  deadline math — and `usePomodoro.durationChange.test.tsx` pins all three
  states (idle pre-arm, running untouched, paused re-arm).
- **Pets animate when the catalog says so.** The admin pipeline writes a
  `thumbnailUrl` for every released staged pet; the pets page ignored it and
  rendered a paw. A new `PetSprite` (cards, inventory) and an `imageUrl` prop
  on `PetStage2D` (showcase, detail modal) show the animated sprite with a
  reserved box (`width`/`height` — no CLS) and fall back to the glyph on a
  missing or failed load; a broken image icon must never be what a pet looks
  like. Sprites are decorative (`aria-hidden`, empty alt) because the name is
  printed beside them, which is also what the image-hygiene gate requires.
- **The resource designs' typography, scoped to the marketing surface.**
  Adopted from the focusarx-resource "professional website" redesign: DM Sans
  body (`.landing-body`) with Instrument Serif display headlines
  (`.font-display-serif`) on the landing hero and section headings — an
  italic accent in the hero replaces the old faux-bold. Instrument Serif
  ships one weight drawn for large sizes, so those headings drop
  `font-semibold` rather than letting the browser synthesize bold serifs.
  Both arrive as unicode-range subsets in the single entry stylesheet; app
  pages never reference the families and never download the woff2 files, and
  the bundle budget still passes byte-for-byte rules (a first attempt at
  code-splitting the font CSS was rejected by the gate's single-entry rule —
  the global import is the repo convention for a reason).

Gates: frontend typecheck clean; eslint 0 errors; 752 tests pass (7 new:
3 PetSprite, 2 PetStage2D sprite cases, 3 duration-change — one file);
production build + SEO + prerender + bundle budget PASS.

## [Unreleased] — admin pet release pipeline: 1,738 staged candidates, gated by design

Three external pet sources were reviewed; the pipeline they feed is now a
first-class admin surface: candidates are staged in code, browsed in the
admin panel, and released into the live catalog deliberately — "we will
release as we get time," without a single candidate ever leaking live by
accident.

### What was imported, and what was refused

- **codex-pokepets** — all 1,738 entries imported as *metadata only*
  (`artifacts/api-server/scripts/generate-pet-staging.mjs` → generated
  `petStagingData.ts`): slug, name, description, sprite style (734 Gen 1–5
  pixel-art incl. 85 forms + 1,004 Gen 1–9 animated), generation, dex
  number, and the upstream license tag. Sprite binaries never enter the
  repo — the server derives preview URLs from the upstream conventions
  (PokeAPI Gen-5 animated for 2D species, Pokémon Showdown for forms and
  3D), so admins see the candidate without us redistributing assets.
- **facebookresearch/cop3d** — reviewed and rejected at the source: it is a
  322 GB research dataset of 4,200 real cat/dog videos, not characters.
  The verdict and reason are recorded in the panel so nobody re-reviews it.
- **bsawyer/tamagotchi** — one character (Bandai's IP), so no catalog
  entries; its action→mood→animation mapping (feed/play/sleep flipping an
  SVG rig's face and posture) is recorded as a mechanics reference for if
  pets ever gain care actions.

### The two gates

Every staged entry keeps its upstream license, and the release API treats
staging as *not* approval: a `fan-use` entry — every Pokémon among them,
© Nintendo / Game Freak / Creatures Inc. — returns 412 unless the request
carries `confirmIpReview: true`, and the panel makes that a per-release
checkbox with the warning inline. If FocusArx monetises pets, these need
legal sign-off or original creatures; the panel says so in permanent ink.
Release itself is idempotent (double-click returns the existing row), every
release and pull is audit-logged, and pull refuses with 409 once anyone has
adopted the pet — `user_pet_inventory` cascades from the catalog row, so an
unguarded pull would silently delete user companions.

Browsing is server-side filtered (search, gen, style, kind, released) and
paginated with a capped page size, so a bad query cannot dump all 1,738
rows; released-state comes from a `pet_catalog` lookup scoped to staged
slugs only. The panel lives in the existing admin Pets tab: source verdict
cards, the IP banner, the candidate table with sprite previews, and the
release/pull dialog following the accessible modal pattern.

## [Unreleased] — pets: a real companion on every device, and moods made visible

Two upgrades, both driven by the interface proposals in `focusarx-resource`
and both fixing the same underlying gap: the pets page treated the no-WebGL
path as an afterthought.

### The 2D path used to be a bare emoji

`Pet3D` covers capable devices, but the fallback — low-end Android, the
explicit 2D toggle, crash recovery, and reduced-motion users, since
`is3DCapable()` declines them — rendered `<div className="text-8xl">🦉</div>`.
A companion reduced to a glyph stops being a companion, and these are exactly
the devices the audit worries about. `PetStage2D` ports the proposal's
`PetStage` idea into the app's tokens: rarity-tinted halo and floor glow,
spring-smoothed pointer tilt, a tap ripple with a wiggle and a "noticed you"
reply, and a mood chip. Two things from the proposal were deliberately left
on the cutting-room floor: its orbiting ring, breathing halo and drifting
particulate are looping decorations, which the design audit bans, so every
movement in the stage is a *reaction* (hover, pointer, tap) and everything
collapses under `prefers-reduced-motion`; and its interaction never hints at
rewards, because bond XP is awarded only by the server for verified sessions
(`lib/petBond.ts` — the public `/bond` route is a 410 precisely because
clients farmed it). The stage says "tap to say hi", never "earn". It is used
in the active-pet showcase and in the catalog detail modal, where the pet is
now presented on a stage instead of as a flat emoji in the header.

### The server already derives a mood; the page ignored it

`GET /api/pets` computes a mood from the user's own behaviour — excited with
a recent session and a 3+ streak, happy with recent focus, sleepy after
three quiet days — and the page hardcoded `mood="happy"` for the 3D pet and
showed nothing in 2D. The showcase now fetches it best-effort alongside the
catalog and inventory (guests and failures fall back to neutral rather than
breaking), passes it to `Pet3D`, and renders it in the stage chip. A pet
that visibly gets sleepy when you disappear is the honest face of the streak
mechanic — the same idea the proposals built their marketing around, wired
to real data instead of invented copy. Species glyphs also gained a single
`emojiForPet()` helper keyed by catalog slug, so a new catalog entry can no
longer render as a blank disc.

## [Unreleased] — landing page: the timer itself, ported from the design proposals

The `focusarx-resource` repo holds four independent interface proposals for
FocusArx. They disagree about palette, layout and tone, but they all converge
on one judgment: the strongest landing hero is not a picture of the timer, it
is the timer — running, on the page, before any signup. The landing shipped a
static mockup (`25:00` painted into a fake dashboard); the product's most
convincing demo was therefore one click away at best. This change ports the
three best ideas from the proposals, rewired onto the real app's contracts.

### A working timer in the hero

`LandingTimerPreview` is a real countdown — Pomodoro / Deep work / Break
modes with a sliding chip highlight, ring, start/pause/reset — but it never
invents progress. No fake XP, coins or streaks: nothing in the preview is
saved, and the copy says so plainly, because a landing page that pretends to
award a streak teaches the visitor the wrong thing about what the product is.
The reward for finishing a block is the block itself plus a one-tap handoff:
"continue" deep-links to `/focus?duration=<minutes>&src=landing`, reusing the
existing deep-link contract (`lib/focusDeepLink.ts`) so the preview and the
product cannot disagree about what the button means, and the visit is
attributed end-to-end like the Instagram funnel already is. While the preview
runs, the tab title carries the live countdown — the same affordance the real
timer gives — and the page title is restored the moment it pauses, finishes
or unmounts, so the tab is never left wearing a stale `12:34 · Deep work`.

### A sticky mobile CTA that knows when to leave

From the premium proposal: on small screens, once the visitor scrolls past
the hero, a "Start focusing" bar rides the bottom edge so the next action is
always one thumb-tap away. Two collisions were designed out rather than
shipped: the bar hides again near the very bottom, where the page already has
its final CTA panel and the above-footer ad slot (a second CTA stacked over
an ad slot is exactly the accidental-click pattern AdSense rejects), and it
stays hidden entirely while the cookie-consent banner is still open — on a
narrow phone that banner stacks three buttons and can reach ~380px, so no
lifted offset clears it reliably, and the choice is a few seconds away and
made once.

### A cursor-tracked spotlight, double-gated

Also from the premium proposal: a soft brand glow that trails the pointer.
Decoration is the thing the design audit most objects to, so it ships with
both gates closed by default — it mounts only for fine pointers (nothing to
chase on a phone) and it bows out entirely under `prefers-reduced-motion`.
Movement is transform-only through motion values, so pointermove never
triggers layout.

What was *not* ported, and why: the proposals' infinite stat marquees clash
with the "never looping decoration" rule the audit pins; their XP/coin
counters on the landing would be fabricated numbers; and their app-shell
redesigns arrived as Next.js islands that assume a router, auth and store the
real `AppShell` already provides — the idea that mattered (an animated active
nav pill) is already live in the mobile bottom nav.

## [Unreleased] — interface rework: direction, legibility, and clutter

Three slices, all driven by research into what the best-regarded focus timers
and dashboards actually do rather than by taste.

### Every headline number now carries a direction

A dashboard that shows `42` without saying whether 42 is better or worse than
usual makes the reader do the analysis. `GET /api/stats` now returns a `trends`
block (minutes vs yesterday and vs the 7-day average, sessions vs yesterday,
weekly total/best-day/active-days, longest streak), computed by
`api-server/src/lib/trend.ts`.

The interesting part of that module is the cases where a percentage is a lie:

- `previous = 0` — a first session ever. The naive division ships `Infinity%`,
  `NaN%`, or, if guarded with `|| 1`, a confident and entirely fabricated
  `+2500%`. It returns `percent: null` and an absolute delta instead.
- `both = 0` — nothing either day. That is not "0% change"; rendering it as
  flat is how a dead account looks healthy. It returns `direction: "unknown"`.
- `previous` below a floor — 1 → 10 minutes is `+900%`, arithmetically true and
  useless. The absolute delta is the honest unit.

`TrendPill` renders the four states with an icon and words, never colour alone,
and `StatCard` makes a bare number unrepresentable — the value and its context
are one component, so a headline figure cannot ship without its baseline.

### The dashboard went from ~30 components to 5 sections

The hero and a separate "Today's Focus" card were both answering "what should I
do now?" and could disagree; the recommendation is now the hero's headline
alone. Secondary sections (streak freeze, recap, weekly review, community,
activity table) are preserved behind one informed disclosure rather than
competing at the same visual weight as "minutes focused today".

### The timer says when it ends

The face answered "how much is left" (the ring) and "how long exactly" (the
digits) but not "when can I stop" — the question that decides whether a block
is started at all, and the only one a time-blind user cannot derive from a
countdown. It now reads "In progress · ends 3:45 PM", and the accessible name
says the same without zero padding ("5 minutes remaining. Finishes at 3:45 PM",
not "05 minutes 00 seconds").

Backed by `useNow`, a shared 1 Hz clock on `useSyncExternalStore`: one interval
for the whole app, subscribed only while the timer runs. Reading the clock in
render is impure, and mirroring it through an effect costs a render pass per
tick and would add the first `set-state-in-effect` to a codebase that has none.

### 11px legibility floor enforced

All 40 remaining sub-11px font sizes raised (the audit's "23" was an
hand-written grep that undercounted; see `REMAINING.md`). `src/legibility.test.ts` scans the
source and fails on any future one, and separately on any CSS `--text-*` token
below the floor. It caught a site the pattern-based grep had missed within a
minute of existing — which is the argument for a gate over a grep.

### Navigation answers "where am I?" consistently

Active-route matching was implemented three different ways; two silent failure
modes followed (a deep link with a query string highlighted nothing, and a
nested route left its parent unlit). `lib/navActive.ts` owns the rule now,
including the `/` ↔ `/focus` alias, with the exception that keeps `/` exact.

### Also

- `TimerControls`: all three buttons gained a `focus-visible` ring — the
  product's primary control had no visible keyboard focus at all.
- `focus.tsx`: six secondary side-panel widgets (mood, daily goal,
  productivity, missions, assistant, camera) collapse behind two disclosures.
  Lower visual clutter is the benefit focus-timer reviewers cite most, and the
  widgets are lazy chunks, so their JS is no longer fetched during a session.

## [Unreleased] — wallet invariants enforced at the database level

`burnCoins` was already a correct compare-and-set (`UPDATE ... WHERE coins >=
amount RETURNING coins`, returning null instead of writing when the balance did
not cover it), so no known path can produce a negative balance. But that is a
property of the code that exists today. A CHECK constraint is the property of
the *data* — it also catches the paths that bypass the ledger: a raw UPDATE
added later, a bulk import, a one-off admin script, or a bug in a helper that
has not been written yet.

- `user_wallets` gains five constraints in the canonical Drizzle schema:
  `coins >= 0`, `total_xp >= 0`, `weekly_xp >= 0`, `level >= 1`,
  `prestige >= 0`.
- New migration `0016_wallet_balance_checks.sql` for databases that already
  exist, with a matching rollback in `drizzle/rollback/`. `CREATE TABLE IF NOT
  EXISTS` in `database/full_schema.sql` does not upgrade a live table, so
  without the migration fresh databases would get the constraint and production
  would silently not.
- The migration repairs before it constrains. A negative balance is corrupt by
  definition — only a writer that bypassed the ledger can produce one — and
  flooring it at zero is the only sensible repair, because the alternative is a
  migration that fails on production and blocks every deploy behind it. The
  counts are reported with `RAISE WARNING` so a replay leaves evidence rather
  than absorbing the problem. Both files are guarded on `pg_constraint`, so
  re-running either is a no-op.
- New `lib/db/scripts/wallet-constraints.test.mjs` (6 tests, negative-tested)
  cross-checks the four places that must agree: the Drizzle schema, the
  generated snapshot, the numbered migration, and the journal. The failure it
  guards is quiet and one-directional — edit the schema, `schema:export`
  regenerates the snapshot, `schema:check` passes, and the migration that would
  have upgraded existing databases never gets written. Nothing else in the gate
  suite compared those two files.
- Gates: typecheck 0, lint 0 errors, test:scripts 25, API 424, `schema:check`
  (snapshot in sync), `validate-migrations` 0 errors.
- **Not done, deliberately:** Argon2id (`auth.ts` still uses bcryptjs at cost
  12), TOTP 2FA, Apple sign-in, and OAuth PKCE are all absent — see the audit in
  REMAINING.md. Changing the password hash touches every existing credential and
  needs a rehash-on-login migration, which is a decision rather than a cleanup.

## [Unreleased] — comparison tables reach the crawler, and two prerender bugs

**The ten `/comparison/*` pages shipped with no table in their HTML.** The live
page (`src/pages/comparison.tsx`) draws a feature table from `COMPARISONS`; the
prerendered document carried only the two prose verdicts. A crawler that does not
run JavaScript therefore saw a different page than a visitor, and every row label
— the part that carries the comparison — was absent from the indexed HTML. That
is §18 #20, and nothing caught it: the document was well formed, self-canonical
and had valid JSON-LD.

- `COMPARISONS` stays the single source of truth. A new exported `cellText()`
  in `src/content/seo-pages.mjs` maps booleans to **Yes/No as text**, because a
  tick glyph is invisible to a text extractor and a screen reader announces the
  SVG rather than the capability.
- `prerender-data.mjs` now emits `table` (caption, column headers, rows) and
  `sections[].bullets` from that same entry — there is no second list to keep in
  step, so the two renderers cannot drift.
- `prerender.mjs` emits a real `<table>` with `<caption>`, `scope="col"` and
  `scope="row"` headers, dated with the review date, plus `<ul class="bullets">`
  for the two-sided checklists that were being flattened away.
- **Two prerender bugs found while verifying, both of the same class — the
  prerenderer was only correct on a fresh `vite build`:**
  - The body substitution matched an *empty* `<div id="root"></div>`. `TEMPLATE`
    is `dist/public/index.html` and `/` is itself a route, so a second
    consecutive `node scripts/prerender.mjs` read a template that already carried
    the homepage shell, the match failed silently, and **every route kept the
    homepage's body** — correct `<title>`, correct canonical, wrong page.
  - The per-route JSON-LD was appended rather than replaced, so a second run left
    two `BreadcrumbList`s and the first one won: every page then advertised the
    trail "Home" while the visible breadcrumb read "Home > Terms of service".
  Both are now idempotent; three consecutive runs are byte-stable and the
  validator passes on each.
- New gates in `seo-validate.mjs`:
  - **Content depth.** A page's own copy must reach 150 words with shell
    furniture stripped (nav, breadcrumb/TOC, byline, related, cluster, CTA,
    badge), so a page cannot pass on chrome every page carries. App surfaces
    (noindexed screens) are exempt at 5 words — the requirement there is only
    that the static shell is not empty. 17 pages below the floor are recorded in
    a **ratchet baseline**: they may not get thinner, and lowering an entry is an
    explicit, reviewable act.
  - **Table parity.** Every declared row label must appear as a scoped row
    header, every column header as `scope="col"`, every cell value in the HTML,
    and every boolean must be present as `Yes`/`No` **text** — counted, so a
    table with one text cell and nine icons still fails.
- Negative-tested, as this repo's gates are: removing the `<table>` fails;
  dropping one declared row label fails; replacing the Yes text with an
  icon-only `<td>` fails; thinning a ratcheted page fails. Restored, all pass.
- 67 new tests in `src/content/seo-pages.test.ts` guard the shape the parity gate
  assumes — unique slugs, three-column rows, no duplicate row labels (a duplicate
  would satisfy the gate while a row was missing), and `cellText` keeping `false`
  distinct from a missing value.
- Gates: typecheck 0, lint 0 errors (471 warnings, unchanged), frontend 443 →
  510, build PASS (119 pages, SEO validate PASS incl. the two new gates, bundle
  110.6 kb of 140 kb, prerendered docs avg 36.4 kb of 120 kb).
- **Recorded, not fixed — the real follow-up:** six of the ratcheted pages
  (`/terms` 15, `/privacy` 25, `/cookie-policy` 20, `/acceptable-use` 17,
  `/ai-policy` 23, `/contact` 23 words) hold a full document in React but declare
  `sections: []` in the manifest, so the crawler receives a heading and a
  one-line lead. That is §2.10's "prerendered ≠ hydrated" failure. The fix is to
  move each policy body into the manifest; the baseline exists so the gap is
  visible in the source and cannot grow.

## [Unreleased] — no native dialogs left, and the modal focus contract fixed

**Every `alert()` / `confirm()` / `prompt()` is gone from the app.** They were
not a style preference: `window.prompt` and `window.confirm` are silently
dropped inside in-app browsers (Instagram, Facebook, Gmail webview), so "Custom
duration" on the timer and "Gift" in the marketplace looked like dead buttons
with no error anywhere. They also cannot carry a label, an error message, a
focus outline, or a screen-reader announcement.

- New `components/ui/PromptDialog.tsx` — promise-based `usePrompt()`, mirroring
  `useConfirm()`. Resolves the trimmed value, or `null` on cancel/dismiss, so
  callers write `if (value === null) return;` with no try/catch. Validation runs
  **inside** the dialog: the old timer flow closed the prompt first and
  `parseInt`-ed the result, so "999" or "12abc" lost the user's typing and
  reported the problem afterwards.
- `ConfirmDialog` moved from a hand-rolled overlay onto Radix Dialog. It used to
  listen for Escape and focus its own confirm button, which is only part of what
  a modal owes a keyboard user: Tab walked out into the page behind it, the
  background was never `aria-hidden`, and focus was never returned.
- **Focus return was broken in a way that needed a real fix, not just a swap.**
  Radix closes a modal Content by running
  `event.preventDefault(); context.triggerRef.current?.focus()` — correct for a
  dialog opened by a `<Dialog.Trigger>`, and a no-op for these: they open from
  arbitrary code (a table row handler, a mutation callback), there is no Trigger
  to point at, and the generic FocusScope restore has already been cancelled by
  the `preventDefault()`. Focus landed on `<body>` after every confirmation.
  `lib/dialogFocus.ts` captures the active element at open time and hands Radix
  an `onCloseAutoFocus` that restores it, skipping `<body>` (meaningless) and
  nodes unmounted while the dialog was open (a row deleted by the action it just
  confirmed). Both dialogs now also set `aria-modal="true"` explicitly — Radix
  makes the background inert but does not declare modality itself, and screen
  readers on Windows and Android honour the attribute directly.
- `noValidate` on the prompt form. A `type="number"` input with `min`/`max`
  aborts implicit form submission **before** the submit handler runs, so the
  browser's native bubble fired instead of our message and the value was never
  announced. Validation belongs to `checkPromptValue` so the message is ours,
  styled, and read out.
- Call sites converted: the timer's custom duration (with the Premium gate moved
  into the prompt's validator so a rejected value stays editable),
  `marketplace.tsx` (gift / sell-back / buy-bundle, now `toast()` on success
  rather than a blocking alert), `study-rooms.tsx` (end room), `developer.tsx`,
  and the admin panels — `AdminUserPanel`, `AdminRivalsPanel`, `AdminDropsPanel`,
  `AdminBreakFreePanel`, `AdminQuestsPanel`, `AdminMarketplacePanel`,
  `AdminLootboxPanel`, `UserManagerDialog`.
- Tests: 22 new — the pure `checkPromptValue` bounds (including the "12abc" and
  "1e5" cases `parseInt` accepted), the promise contract for both dialogs
  (cancel is `null`/`false`, never a hang; a second request settles the first),
  in-place validation, `aria-modal` + `aria-labelledby` wiring, focus entering
  the dialog and returning to the trigger, and the new `useDialogFocusReturn`
  cases in isolation.
- Gates: typecheck 0, lint 0 errors (471 warnings, unchanged), frontend 421 →
  443, API 424, build PASS — 119 prerendered pages, SEO validate PASS,
  bundle budget PASS (entry 49.5 kb gzip, initial 110.6 kb). `vendor-radix` was
  already on the critical path in `index.html` before this change, so no
  critical-path regression: the entry grew 0.86 kb gzip.

## [Unreleased] — SEO: 11,978 profile URLs out of the sitemap, /u/ noindexed

**The sitemap is 89 URLs again, not 12,067.** `sitemap-profiles-1.xml` listed
one `/u/<name>` URL per non-guest account — 11,978 of them against 89 real
pages — and every one served the *homepage* document: the route is
client-rendered and absent from the prerender manifest, so the SPA fallback
answered with `index.html` (homepage title, homepage JSON-LD, canonical `/`).
Twelve thousand URLs canonicalising to one page is the "Discovered – currently
not indexed" backlog, and it spent the crawl budget the pages that can rank
need.

- Removed the dynamic profile shard from `sitemap.ts` (the `COUNT(*)` over
  `users`, the slug helper, the shard route and its index entries) and the
  `sitemap-profiles-1.xml` entry from the static fallback index. The retired
  shard still answers **200 with an empty `<urlset/>`** so Search Console
  retires it cleanly instead of reporting "Couldn't fetch".
- **Decision: profiles are noindexed, not merely unlisted.** Even rendered they
  are a default template (0 sessions, 0 badges, no bio) and their data comes
  from `/api/u/…`, which robots.txt disallows — a crawler cannot fetch it. The
  shard URLs were also mostly dead: it slugified names (`Varun Warrier` →
  `Varun-Warrier`) while `/api/u/:username` matches the raw name, so every
  multi-word name 404'd. `/u/:username` keeps working for humans — share links,
  Add Friend, per-user OG card.
- `X-Robots-Tag: noindex, nofollow` on `/u/…` in `vercel.json` (the only signal
  a non-JS crawler can act on) plus a matching meta robots tag in
  `user-profile.tsx`, restored on unmount so it cannot leak onto the next page.
  `/u/` stays **crawlable** in robots.txt on purpose — Google cannot honour a
  noindex on a page it is not allowed to fetch — with a comment there saying so.
- `seoContract.test.ts` gains 5 assertions pinning all of the above: no `/u/`
  URL in any segment, the emitted index advertises exactly the 9 static
  segments, the retired shard is empty rather than 404, robots.txt does not
  block `/u/`, and the edge header is present. Verified by re-introducing each
  defect.

Post-deploy: in Search Console the submitted sitemap should drop to 89
discovered URLs; the `/u/` URLs leave the index over the following crawls.

## [Unreleased] — SEO + analytics: www canonical, title dedupe, GA4 key events

**One canonical host, one brand mark per title, explicit GA4 identity.**
Driven by live Search Console data (53 "Discovered – currently not indexed",
cross-host duplicate flags) and GA4 (100% new users, 0 key events, all-direct
attribution):

- Canonical host is now **`https://www.focusarx.site`** everywhere — the site
  serves www, so the apex-canonical tags/sitemap/OG were pointing every page
  at a redirect. Apex → www 308 via a host-conditioned `redirects` entry in
  `vercel.json` (coexists with legacy `routes`) plus the Vercel primary-domain
  setting; `APP_URL`/`VITE_APP_URL` and all docs follow.
- `composeTitle` no longer appends `| FocusArx` to titles that already lead
  with the brand — the homepage used to render
  "FocusArx — AI Pomodoro Timer & Deep Work Tracker | FocusArx" on client nav
  (the double title in the GA4 page-title report). Mid-title brand mentions
  rewritten in `PAGE_SEO` and the prerender manifest; 8 truncated meta
  descriptions completed.
- Fixed four pages passing absolute URLs to `PageSEO canonical` (blog,
  exam funnel, two guides), which rendered `https://…https://…` canonicals;
  `PageSEO` now also accepts absolute URLs defensively. Removed the stray
  client-side `noindex` on `/search` (sitemap-listed) and the dead `noindex`
  on the `/focus` entry.
- GA4: explicit cookie config (`cookie_domain auto`, 2-year expiry,
  `SameSite=Lax;Secure`, `cookie_update`), new `first_session_complete` key
  event alongside the existing `sign_up` / `session_complete` (mark all three
  as Key events in GA4 Admin — UI-only toggle), and a documented decision to
  stay on direct gtag.js instead of GTM. Runtime SEO added to `/signup` and
  `/login` so SPA navigations report correct page titles.

Post-deploy checklist in the PR description: Vercel primary domain, `APP_URL`
secret/env, Search Console sitemap resubmit, GA4 key-event toggles.

## [Unreleased] — P0.3 cross-tab single timer

**Two tabs run one timer now.** The leader election (`navigator.locks`)
already existed; this finishes the contract:

- The leading tab broadcasts a 1 Hz heartbeat; every other tab mirrors the
  live session in a calm glass chip ("Running in another tab · Focus
  24:31") on both desktop and mobile, instead of a dead duplicate clock.
  Crashed leaders are detected by missed heartbeats (locks auto-release, so
  no resign ever arrives).
- Only the leader completes: a tab denied while a completion was already
  queued stands down silently instead of recording a phantom session. The
  server `clientNonce` idempotency remains the backstop.
- 9 new unit tests (protocol + two-tab hook contract) and a Playwright
  two-tab spec. Full-completion 2-tab e2e deliberately left out — deep
  links min out at 1 minute, so a completion race would be a 60 s+ flaky
  test; the guarantee is pinned at unit level instead.

## [Unreleased] — P0.2 user-local calendar completion

**Daily rewards and the streak nudge now follow the user's own day.** Two
surfaces were still on the legacy IST calendar while sessions, habits and
missions had already moved to per-user IANA zones:

- `GET/POST /daily-reward/status|claim` derive today/yesterday in
  `users.timezone` (legacy IST fallback until a real zone is adopted, so
  existing streaks never shift), with DST-safe string math — subtracting
  86,400,000 ms across a spring-forward lands on the wrong day, and there is
  now a test proving the old math wrong on 2026-03-09 in `America/New_York`.
- The lazy streak-endangerment nudge on `/api/streak` fires after 16:00
  **user-local** with a DST-safe local-day throttle window, and the copy no
  longer says "midnight IST" to someone in another hemisphere.

10 new unit tests (API 354 → 364). No schema change. Deliberately not done:
`streak_history` backfill for pre-table completions, and per-user zones for
the batch `/retention/reengage/run` cron (needs a per-candidate lookup).

## [Unreleased] — v2 design system pass

**Brand, rebuilt.** FocusArx has a new identity: an "iris tile" mark — a
liquid-glass squircle in a violet→azure gradient holding a calm focus reticle
(ring + luminous point). One authored SVG (`public/brand/focusarx-mark.svg`)
feeds the whole raster set through a committed generator
(`scripts/generate-brand-assets.sh`): favicon, apple-touch icon (now 180px,
previously pointed at the 192 app icon), PWA icons incl. a properly inset
maskable, the org logo, and a redesigned 1200×630 social card. The old Zap
glyph is gone from the app shell, marketing header/footer, auth layout and
admin/developer consoles; the JSON-LD, manifest, service-worker cache and OG
references were all verified against the new files.

**Design system v4 — Liquid Glass materials.** Theme-aware translucent
materials with real backdrop blur + saturation boost, specular hairline edges
and soft depth now back `.glass` panels, app chrome (sidebar, bottom nav) and
new `.glass-strong/.glass-chrome/.glass-chip` surfaces; `@supports` fallbacks
keep them opaque where backdrop-filter is unavailable and
`prefers-reduced-transparency` is honoured. Light mode's auth/settings glass
no longer renders as a dark slab, adaptive `--backdrop` values are glassier,
and brand tiles use the new continuous-corner iris gradient.

**Error paths hardened.** `ErrorBoundary` and `ErrorState` never surface raw
`Error.message` to visitors (SQL/tokens/paths can leak through them), show
offline-aware copy with queue reassurance, offer a support path, and only
expose technical details under the opt-in debug flag. Boundaries support
reset keys (tab retries) and a dark variant for the developer console.

**Admin console, rebuilt.** New "System Settings"-style shell: searchable
grouped navigation, brand lockup, calm neutral identity (the old danger-red
console chrome is gone), glass content header, mobile drawer parity, branded
skeleton loading, and an error boundary per section that recovers without a
full page reload. The developer console got the same treatment: a dark
native-tools material that works in both app themes, a crisp header with
session identity, and a segmented section bar replacing the amber "God Mode"
language.

The overview panel was rebuilt on design tokens (ui-panel surfaces that theme
correctly in light and dark, violet session bars with per-day counts, h/m
duration formatting, flame icon in place of the streak emoji, themed admin
chips), and section headers shed the danger-red eyebrow. The database layer
got a real fix: CI `schema:check` was red because `database/full_schema.sql`
had never been regenerated after the schema gained the
`follows(follower_id, following_id)` unique index; the snapshot is now
canonical again.

## [Unreleased] — fifth pass

Search results are copy, so copy got a budget, a generator, and a gate.

**Objective defects, measured first.** An audit of the 51 prerendered page
directories in `dist/public` — not a style opinion, a count:

- `public/robots.txt` shipped `Disallow: /adminDisallow: /onboarding` on **one
  line** (an edit had dropped the newline). That is not a syntax error to a lenient
  parser: it is one `Disallow` for a path no URL can ever match, so the admin
  console and onboarding were *not* disallowed for the general `User-agent: *`
  group while the file still looked fine. Split, and now machine-checked.
- **15 of 51 titles** and **9 of 51 descriptions** were outside the range a search
  result can display (Google clips a title near 580px ≈ 60 characters and a snippet
  near 160), worst cases 71 and 180 characters. Every one of those pages loses the
  end of its own sentence to an ellipsis. Now: 0 and 0, with the same rule enforced
  at build time.
- `robots.txt` disallows 48 paths, and **all 51 prerendered pages said
  `index, follow` in their HTML** — the two of them that are also prerendered
  (`/premium`, `/achievements`) included. A `Disallow` only stops fetching; a URL Google already knows
  keeps an entry with no description. `noindex` is the signal that removes it, and
  it only works on HTML the crawler can read — so the two must agree, not be 48
  pages apart.
- The prerender manifest held a **third copy** of the same titles and descriptions
  (`scripts/prerender-data.mjs` alongside `components/PageSEO.tsx`'s preset table),
  already stale: 7 routes' crawler-facing title differed from the title the page
  itself sets, so navigating to `/premium` in the browser showed a different
  `<title>` than a crawler or a social card received. The 7 are aligned to the
  page-authored copy; the rest were shortened.
- Any unknown URL answers 200 with the SPA shell (`vercel.json` rewrites
  `/(.*) → /index.html` after `handle: filesystem`), and `pages/not-found.tsx` set
  no metadata at all — so a mistyped link was indexed with the previous route's
  head, or the homepage's. It now declares itself `noindex`.

**One generator for both renderers.** `src/lib/seo-text.mjs` (new) owns the brand
mark and the text budgets. `components/PageSEO.tsx` (client) and
`scripts/prerender.mjs` (build) both call it, which fixes three things at once:
titles no longer author `| FocusArx` themselves (`title.includes("FocusArx")` used
to *skip* the suffix, so the brand had three spellings and an unpredictable length),
a page cannot emit an over-budget title at all, and programmatic copy that cannot
know its length ahead of time — the `/pomodoro-timer-for/:exam` funnels, built from
exam names between 8 and 63 characters — is clamped where it is composed, at a
clause boundary, instead of mid-parenthesis by Google. `clampText` refuses to emit a
19-character "sentence" just because it ends in a full stop; `MIN_SNIPPET` is the
same floor the gate fails the build on.

**`src/lib/robots-parse.mjs` (new)** is one strict robots.txt reader for the three
places that have to agree with it: the prerenderer (which now derives each page's
`robots` meta from the file, so the HTML and the directives cannot drift — 2 pages
changed, `noindex, nofollow`, and every future prerendered private page gets it for
free), `scripts/seo-validate.mjs`, and the API's own generated copy. It implements
prefix matching, `*`, and trailing `$` (`Disallow: /*.map$` blocks source maps,
`Disallow: /api/` does not block `/api`), and reports a merged or stray line as an
error rather than absorbing it. `sitemap.ts`'s `robots.txt` route now builds from an
exported `ROBOTS_PRIVATE_PATHS` list (15 paths → 48, matching the static file) via a
pure `buildRobotsTxt(base)`; the two copies used to disagree about 33 paths, which
is the part that actually hurts.

**Gates, and proof they bite.** `scripts/seo-validate.mjs` gained: title/description
budgets against the *unescaped* text as rendered, the same budgets applied to the
manifest **before** the clamp (so a long string is a build failure, not something
quietly shortened for you), robots.txt line-shape, and indexability parity in both
directions. 26 new unit tests in `src/lib/seo-text.test.ts` and
`src/lib/robots-parse.test.ts` — including the real shipped files, so a
newline-eating edit to `public/robots.txt` fails the frontend suite — plus 3
contract tests in `seoContract.test.ts` that read the frontend's parser rather than
reimplementing it. Falsified deliberately, then reverted: deleting `Disallow:
/premium` from the generated copy fails the parity test naming `/premium`; setting
`index, follow` on `/premium`'s HTML fails the gate.

**Incidental, in files this pass touched.** `pages/search.tsx` mirrored `?q=` into
state inside an effect, so the page mounted twice and the input rendered empty on
the first frame; the query is now read from the location with typed text as an
override. `pages/study-calculator.tsx` had three `<label>`s attached to no control —
two now point at their range input, and the third labels a button group, which a
`<label>` cannot own, so it is the group's `aria-labelledby` instead. Four unused
icon imports and an unused `renderBody(entry, url)` argument went out with them.
`lint-changed`: 0 errors (75 warnings, non-fatal), `tsc --noEmit` clean,
229 frontend tests and 325 API tests green, `pnpm run build` green through the
extended gate.

**Deliberately not done.** The manifest and `PageSEO.tsx`'s table remain two copies
of the same *strings* — the budgets are enforced on both, content equality is not,
because making one import the other means moving the preset table out of a `.tsx`
the API-side scripts can also read. Descriptions are aligned only where they were
already stale. A real `404` status for unknown routes would need an edge function in
front of every page view; `noindex` costs nothing instead. `AUDIT.md` item 9's
`~150 user-facing pages still on raw fetch` is untouched (the admin console's 55
were the ones with a broken data layer), as is the repo-wide `eslint` backlog of
1042 problems and the `Knip` failure (`RangeError` inside oxc-parser, upstream).

## [Unreleased] — fourth pass
