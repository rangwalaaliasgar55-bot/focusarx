---
name: Coin Shop
description: Shop system where users spend coins on boosts, cosmetics, themes, and titles.
---

- Route file: `artifacts/api-server/src/routes/shop.ts`; registered via `shopRouter` in `routes/index.ts`
- Frontend: `artifacts/focusarx/src/pages/shop.tsx`; lazy-loaded at `/shop`; nav item in AppShell (ShoppingBag icon, "engage" group)
- Items list is static (`SHOP_ITEMS` const in shop.ts) — 15 items across 4 categories: boost, theme, title, cosmetic
- Purchase flow: deducts coins via `sql` expression, grants XP for `xp_bonus_*` items, inserts a notification for the user
- Profile page has a "Coin Shop" link button in its header pointing to `/shop`
- Wallet coins/balance shown on shop page header; items greyed out if not affordable

**Why:** Coin economy needs a spend-side to stay meaningful; shop closes the loop between earning and spending.
