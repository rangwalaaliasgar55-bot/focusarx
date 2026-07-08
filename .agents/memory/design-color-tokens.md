---
name: Design system color tokens
description: All hardcoded hex dark colors replaced with rgba CSS tokens; rules for future additions
---

# Design Color Token Rules

## What was replaced (June 2026)
All hardcoded dark hex colors across the entire frontend were replaced with rgba/CSS-variable equivalents:

| Old token | New token | Use |
|-----------|-----------|-----|
| `bg-[#111318]` | `bg-[rgba(255,255,255,0.025)]` | Card backgrounds |
| `border-[#1e2130]` | `border-[rgba(255,255,255,0.06)]` | Card/section borders |
| `bg-[#0a0c12]` | `forge-bg-glow` or `bg-[rgba(255,255,255,0.02)]` | Page backgrounds |
| `bg-[#1e2130]` | `bg-[rgba(255,255,255,0.06)]` | Progress bar tracks, hover states |
| `bg-[#080c1c]`, `bg-[#1a1d2e]` | `bg-[rgba(255,255,255,0.025)]` | Tab/section backgrounds |
| `text-[#4a4f62]`, `text-[#5a5f72]` | `text-[#4B5563]` | Muted labels |
| `text-[#e8eaf0]` | `text-[#E2E8F0]` | Primary text |

## Page background pattern
Inner pages use `forge-bg-glow` CSS class (defined in `index.css`) as their top-level wrapper instead of hardcoded `bg-[#0a0c12]`.

## Why
Hardcoded hex darks don't compose with the `forge-bg-glow` radial gradient system; rgba tokens layer on top correctly and remain consistent across theme changes.

## Rule
Never add new hardcoded hex dark colors. Use the rgba token system or `forge-bg-glow` class.
