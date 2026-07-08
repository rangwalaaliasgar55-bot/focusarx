---
name: XP level formula
description: The canonical level formula for FocusArx — must be used consistently everywhere
---

## The formula
```ts
const level = Math.floor(Math.sqrt(totalXp / 100)) + 1;
```

**Why:** The profile page uses this formula. CoinXPBar previously used a different formula, causing level mismatches between the bar and the profile. Fixed in CoinXPBar.tsx.

**How to apply:** Any component displaying "level" from XP must use this exact formula. Check both `artifacts/focusarx/src/components/CoinXPBar.tsx` and `artifacts/focusarx/src/pages/profile.tsx` if the formula ever needs to change.
