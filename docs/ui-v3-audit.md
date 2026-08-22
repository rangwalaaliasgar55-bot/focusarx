# UI v3 — Phase 0 interface audit

_Audited 22 August 2026 against `main` (`5b3bb7b`). This is the traceability baseline for the interface overhaul; API behavior is out of scope._

## Route inventory

| Area | Routes |
| --- | --- |
| Focus core | `/`, `/dashboard`, `/analytics`, `/habits`, `/goals`, `/ai-insights`, `/onboarding` |
| Study | `/flashcards`, `/study-rooms`, `/virtual-study-room`, `/forge-room`, `/forge`, `/study-calculator`, `/study-method-quiz` |
| Progress | `/achievements`, `/missions`, `/quests`, `/leaderboard`, `/battle-pass`, `/focus-dna`, `/dna`, `/constellations`, `/consequences` |
| Community | `/social`, `/groups`, `/messages`, `/notifications`, `/u/:username`, `/referral` |
| Break Free / wellbeing | `/break-free`, `/breathe`, `/dreams` plus `MoodCheckin`, `PledgeWall`, `UrgeSurfing`, and `BreakFreeStreak` views |
| Rewards | `/wallet`, `/shop`, `/marketplace`, `/lootboxes`, `/pets`, `/city`, `/premium` |
| Account / access | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/profile`, `/welcome` |
| Marketing / resources | landing at `/`, `/pricing`, `/about`, `/contact`, `/support`, `/roadmap`, `/focus-guide`, `/deep-study-guide`, `/two-hour-study-method`, `/pomodoro-guide`, `/study-techniques`, `/science-of-deep-work`, `/feynman-technique` |
| Policy | `/privacy`, `/terms`, `/cookie-policy`, `/acceptable-use`, `/ai-policy`, `/data-deletion` |
| Operations | `/admin`, `/style-guide`, not-found fallback |

## Component inventory

- **Shell/navigation:** `AppShell`, `CommandPalette`, page transitions/backgrounds, announcements, mobile welcome, auth/session/recovery providers.
- **Focus workspace:** timer and controls/display, task timeline, camera, ambient sound, coach, session summary/recovery, readiness/daily goal.
- **Product modules:** dashboard cards/widgets, Break Free cards, flashcards, profile/XP/achievements, social/reward/city/garden experiences.
- **Admin:** `AdminShell`, `AdminGate`, analytics, timeline inspector, moderation views embedded in `admin.tsx`.
- **Primitives:** 62 files under `components/ui`, mixing upgraded token-aware components with mostly stock shadcn styles and many raw controls in product pages.

## Inconsistency map

1. **Tokens/colors:** `index.css` has a useful partial token layer, but the source still contains **2,676 hex occurrences across 125 files**, plus many direct `rgba`, Tailwind zinc/purple/emerald aliases, gradients, and inline colors. Light mode compensates with brittle selector overrides instead of being fully semantic-token driven.
2. **Spacing/type:** pages independently choose widths (`max-w-3xl` through `max-w-7xl`), paddings, tiny 9–11px labels, heading scales, radii, and vertical rhythm. `PageHeader` exists but is not the universal page pattern.
3. **Controls:** **339 raw `<button>`** and **88 raw `<input>`** instances bypass the shared primitives. Button heights, pressed/loading/disabled states, error rings, icon sizing, and touch targets vary. Modal implementations range from Radix dialogs to hand-built fixed overlays without reliable focus trapping/return.
4. **Navigation:** the sidebar is a long, weakly grouped list with duplicate destinations; mobile combines a drawer and bottom tabs but lacks the same information architecture. The existing command palette covers only a subset of routes and cannot yet create a task/start focus.
5. **Feedback/states:** two toast systems use different visuals and vocabularies; global toasts have no warning or undo action. Loading often means one-off pulsing blocks/spinners, empty states range from plain text to bespoke cards, and data errors are not consistently rendered inline. Route boundaries exist but the fallback itself is one-off styled.
6. **Key screens:** landing loads 3D in the hero, includes product-like numeric claims and inconsistent CTA styles; auth forms duplicate markup; dashboard focus hierarchy is diluted by many competing widgets; `/habits` is labeled Tasks in navigation but is a habit tracker without task segments/bulk affordances; flashcard study is constrained rather than truly fullscreen; profile/admin use bespoke stats/cards/tables.
7. **Motion/accessibility:** Framer Motion is present but spring values and durations vary widely. Several icon-only raw buttons have no accessible name; many visual controls are below 44px; custom overlays do not all trap focus. Reduced-motion CSS is global, but JS motion and auto-rotating content do not consistently consult it.
8. **Performance/responsiveness:** most product pages are route-lazy, but auth/admin and several shell-heavy components are eager. The hero 3D is code-lazy but mounted above fold. Inline layout/color styles (252 blocks) and large screen files (`admin.tsx`, dashboard, timer) make consistency and responsive verification difficult.

## UI v3 direction

Consolidate all visual decisions into semantic tokens; rebuild the shell and shared page/state patterns first; normalize Radix-backed primitives; then migrate the landing, auth, dashboard/tasks, Break Free, flashcards, profile, and admin surfaces without altering request paths, payloads, optimistic cache behavior, session recovery, moderation, or flashcard scheduling.
