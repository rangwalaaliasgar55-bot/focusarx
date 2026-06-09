---
name: V12 Ultimate build
description: Summary of all V12 phases implemented — tables, routes, UI components, delight engine.
---

# V12 Ultimate Master Prompt — Implementation Summary

## Phase 0 — DB Schema
- Added columns: rank, streak_shields, dream_type, daily_focus_target_min on users
- Added subject/notes/ai_insight/coins_earned/loot_box_dropped on focus_sessions
- Added estimated_minutes/subject on tasks
- 17 performance indexes added; focus_score backfilled

## Phase 1 — New Tables
All pushed via `pnpm --filter @workspace/db run push`:
- focus_cities, city_building_definitions
- loot_box_types, user_loot_boxes
- quest_definitions, user_quest_progress
- seasonal_events, user_seasonal_progress
- marketplace_items (10 cols: id/name/description/type/rarity/emoji/cost_coins/data/is_active/created_at)
- user_inventory

## Phase 2 — Backend Routes
All registered in artifacts/api-server/src/routes/index.ts:
- /api/dreams — dreamsRouter
- /api/marketplace — marketplaceRouter
- /api/pets — petsRouter
- /api/wrapped — wrappedRouter
- sessions.ts: loot box drops every 10 sessions, city progress on completion, delightEngine check on focus sessions

## Phase 3 — Design System & UI Components
- Design tokens (rank/rarity/mode colors, glow vars) → artifacts/focusarx/src/index.css
- New components: RankBadge, StreakFlame, EmptyState, PetWidget, RewardToast (+Provider), AchievementModal, LevelUpScreen
- artifacts/api-server/src/lib/delightEngine.ts — random delight events (coin bonus, XP boost, loot box, motivational)
- artifacts/focusarx/src/components/LiveActivityTicker.tsx — socket-driven real-time activity feed

## Phase 4 — New Pages (all lazy-loaded and routed in App.tsx)
/pets, /city, /marketplace, /wrapped, /dreams, /lootboxes, /wallet, /dna, /quests, /focus-dna

## Phase 5 — Nav
All new nav items in AppShell: Quests, Focus City, Marketplace, Loot Boxes, Wallet & XP, Pet Companion, My Dreams, Wrapped, Focus DNA

## Phase 6 — Providers
- RewardToastProvider wired into App function (wraps ToastProvider)
- LiveActivityTicker rendered inside AppWithPalette
- QueryClient: staleTime=60000, refetchOnWindowFocus=true

**Why:** V12 adds gamification depth (city, pets, marketplace, delight engine) on top of V10 enterprise foundation.
**How to apply:** Check v12-build.md before adding new gamification features to avoid duplicate routes/tables.
