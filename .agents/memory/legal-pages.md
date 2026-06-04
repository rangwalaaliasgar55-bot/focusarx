---
name: Legal pages
description: What legal pages exist, where they live, and how they're wired up
---

## Pages created
All in `artifacts/focusarx/src/pages/`:
- `privacy.tsx` → `/privacy`
- `terms.tsx` → `/terms`
- `cookie-policy.tsx` → `/cookie-policy`
- `acceptable-use.tsx` → `/acceptable-use`
- `ai-policy.tsx` → `/ai-policy`
- `data-deletion.tsx` → `/data-deletion`
- `pricing.tsx` → `/pricing`

## Routing
All 7 are lazy-loaded in `App.tsx` and registered as public routes (no auth required).

## Footer
`AppShell.tsx` has a fixed bottom footer on the desktop sidebar (hidden on mobile) with links to Privacy, Terms, AI Policy, and Pricing.

## Shared pattern
Each legal page uses a `Section` component and a `LegalFooter` component defined locally in the file. They share the same visual style: `rounded-2xl border border-[rgba(124,58,237,0.1)] bg-[rgba(16,23,50,0.4)]`.

## AI Policy specifics
Documents both Groq (Coach) and Gemini (Roadmap) providers, webcam-local processing, rate limits, and fallback behaviour. Keep this updated whenever AI providers or limits change.
