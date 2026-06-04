---
name: lucide-react icon gaps
description: Icons that do NOT exist in the installed version of lucide-react
---

## Missing icons (confirmed absent)
- `Cookie` — not in installed version; use `Database` (for storage/cookies context) or `Shield` instead.

## How to verify before using a new icon
```bash
grep -c '"IconName"' node_modules/.pnpm/lucide-react*/node_modules/lucide-react/dist/lucide-react.esm.js
```
A result of `0` means the icon does not exist in this version.
