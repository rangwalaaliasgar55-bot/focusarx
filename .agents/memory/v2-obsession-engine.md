---
name: V2 Obsession Engine
description: Summary of all V2 features added — DB tables, routes, pages, and systems
---

## What was added

### DB Schema (lib/db/src/schema/focusarx.ts)
- `user_dreams` — user dream goals with progress tracking
- `user_pets` — pet companions with mood/XP/level
- `marketplace_items` — items for the focus marketplace
- `user_inventory` — purchased/equipped marketplace items
- `wrapped_snapshots` — cached monthly/yearly focus wrapped stats

### Backend routes (artifacts/api-server/src/routes/)
- `dreams.ts` — GET /api/dreams, POST /api/dreams, GET /api/dreams/types
- `pets.ts` — GET /api/pets, POST /api/pets, POST /api/pets/award-xp
- `marketplace.ts` — GET /api/marketplace, POST /api/marketplace/purchase, POST /api/marketplace/equip
- `wrapped.ts` — GET /api/wrapped/:period (monthly: YYYY-MM, yearly: YYYY)
- admin.ts extended — POST /api/admin/sql (SELECT-only via pool.query()), GET /api/admin/schema

**Note:** admin SQL uses `pool` from @workspace/db directly (NOT `db.$client` which doesn't exist in Drizzle node-postgres).

### Frontend pages (artifacts/focusarx/src/pages/)
- `dreams.tsx` — dream goal tracker with daily focus hours progress
- `pets.tsx` — pet companion system (3 pet types, mood/XP/level)
- `marketplace.tsx` — item shop with coin-based purchases
- `wrapped.tsx` — monthly/yearly focus recap (Spotify Wrapped style)
- `constellations.tsx` — star map visualization of focus sessions by hour/day

### Systems
- **Delight system** — Timer.tsx fires 33% chance after focus sessions complete; animated popup with 8 random reward messages + progress bar countdown
- **Rank badge** — AppShell sidebar shows rank emoji + name (via RankBadge component using getRank/getLevelFromXp from lib/ranks.ts)
- **Admin SQL editor** — Full tab in admin.tsx with schema explorer sidebar, textarea editor, quick-query buttons, results table, Cmd+Enter shortcut

### App wiring
- App.tsx: 5 new lazy routes for /dreams /pets /marketplace /wrapped /constellations
- AppShell.tsx: 5 new nav items in the "engage" group with Heart + ShoppingBag icons added
