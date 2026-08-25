# V4 Master Upgrade — Execution Log

Baseline verified: typecheck ✓, tests ✓ (13/13), route contract ✓.

| WS | Title | Status | Notes |
|----|-------|--------|-------|
| A  | Living community 12k AI rivals (Indian names, social sim) | ✅ | personas.ts (injective XP tiers), botTemplates.ts (150+ lines), botEngine v2 (batched tick, serverless claim, staggered replies, follow graph), SQL leaderboard <300ms, 60/40 feed mix + cursor, community pulse (fabricated "50k learners" removed), admin dial, room banter. 8/8 integration tests vs real PG. |
| B  | Admin Drops (hype events) | ✅ | 6 drop types (coin rain atomic pool, double-XP, board shake-up, flash quest, streak-freeze, item flash sale). Atomic pool (no oversell) + one-claim/user (DB-enforced). Server-side XP multiplier hook in session reward path. Fan-out: notification+push+socket+optional email. Admin tab (create/monitor/end/cancel/repeat + sparkline). Public /drops + DropBanner countdown chip on focus+community. 5/5 integration tests vs real PG. |
| C  | Marketplace & currency 2.0 | ✅ | 27 new items on the rarity ladder (common 100–300 … legendary 8,000–15,000), gifting +5% tax, 50% sell-back, 3 bundles (85% of full price), lib/coinLedger single gate — every mint/burn now writes coin_transactions (daily reward, habits, missions, city, quests, retention×3, admin grant/set, marketplace, drops, shop, sessions). Admin "Economy" tab: supply (humans vs bots split), 14-day mint/burn chart, top movers, inflation alert (>5% supply/7d). 6/6 integration tests incl. ledger-invariant audit. |
| D  | Ambient sound v3 | ✅ | 12 new procedural scenes (monsoon roof, waterfall, night train, library, city night, dawn chorus, chai stall, temple bells, river side, rain tent, wind chimes), binaural theta focus (190L/200R), 4 EQ presets (lowshelf+highshelf+lowpass chain), reactive breathing mode (mutes when hidden), 4-layer cap (was 3), 12-bar canvas visualizer (reduced-motion aware). 5/5 catalogue tests. |
| E  | SEO growth engine (India-first) | ✅ | **/exam cluster**: 14 India-first exam guides (JEE Main/Advanced, NEET, GATE, CAT, UPSC, SSC CGL, NDA, CTET, IBPS PO, CBSE 10+12, exam anxiety, last-minute revision) — each 1,500+ words (26.5k total), Article + FAQPage + BreadcrumbList JSON-LD, factbox, FAQ accordion, related links; /exam hub page; prerendered static HTML for all 15 routes (36→51 pages); **OG automation**: serverless /api/og SVG card generator (1200×630, per-page og:image on all exam routes); sitemap +15, robots Allow, /guides hub collection, /search index +15. City cluster deferred (optional per spec). |
| F  | Neon SQL console (write mode) | ⬜ | unlock flow, guardrails, admin_sql_log, branch helpers |
| G  | Gemini AI chief-of-staff | ✅ | **aiBudget** central budget manager (per-provider daily caps gemini 1500/groq 3000, 429 exponential backoff, immutable ai_call_log, usage/cost views — 4 PG integration + 9 unit tests); **Arx companion** (POST /arx/chat, 30 LLM replies/day per user, never-negative sanitizer, zero-key template mode); **Admin → Gemini** tab (budget status, 7-day cost, bot fleet + bot-ops suggestions, 24h purpose usage, SEO idea backlog w/ one-click approve, briefings); **daily IST briefing** + **SEO officer** (idempotent serverless ticks, auto-publish OFF); zero-key = full template mode. |
| H  | Focus timer v2 (240 min) | ✅ | 180→240 cap, 🏔️ Marathon 4h chip + quick presets (25/50/90/120), >2h micro-confirm modal (with "cap at 2h" option), server-side sub-linear rewards (75% XP/coins beyond 2h — lib/sessionRewards, 12 unit tests), hourly break nudges, heartbeat pulse (reduced-motion aware), badges Deep Runner (2h) + Marathoner (4h). |
| I  | 3D pets | ⬜ | R3F procedural pets, lifecycle, economy tie-in, 2D fallback |
| J  | Mobile excellence | ⬜ | 360px pass, PWA, haptics, reduced motion |
| K  | Agent upgrades (seasons, share cards, re-engagement) | ⬜ | season resets, OG share cards, streak-endangerment push |

Owner decision (Aug 24, 2026): visible 🤖/AI badges removed from bots on all end-user surfaces (leaderboard, feed, DMs, study rooms) — bots now blend in. Internal `role="bot"` flag kept; admin analytics still separate humans/bots. CommunityPulse public counter still says "incl. AI rivals" (say the word to change that too).

Rules being enforced throughout:
- No bare db.select() on auth/critical paths; explicit projections.
- Import tables from "@workspace/db" only.
- New columns nullable-or-defaulted; drizzle push clean.
- AI accounts always role="bot"; honest counts only. (Per owner decision Aug 24, visible badges removed from end-user surfaces — see note above.)
- AI actions audit-logged; admin approves powerful actions; auto-publish OFF.
- No cron; lazy idempotent throttled ticks.
- Zero-AI-key fallback for every AI feature.
