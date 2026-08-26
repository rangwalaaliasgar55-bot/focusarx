# UI token cleanup codemod map

Prefer CSS variables from `src/index.css` over raw hex / rgba in TSX.

## High-frequency replacements

| Old (common) | Prefer |
|---|---|
| `#7C3AED` / `#7c3aed` | `var(--brand-violet)` |
| `#A78BFA` | `var(--brand-violet-light)` |
| `#06D6A0` | `var(--brand-teal)` |
| `#FFB800` | `var(--brand-gold)` |
| `#030308` | `var(--background)` / `var(--brand-navy)` |
| `rgba(124, 58, 237, 0.1)` | `var(--token-violet-10)` |
| `rgba(124, 58, 237, 0.15)` | `var(--token-violet-15)` |
| `rgba(124, 58, 237, 0.25)` | `var(--token-violet-25)` |
| `rgba(255, 255, 255, 0.05)` | `var(--token-white-05)` |
| `rgba(255, 255, 255, 0.07)` | `var(--token-white-07)` / `var(--border)` |

Do not mass-replace inside `index.css` itself (source of truth).
