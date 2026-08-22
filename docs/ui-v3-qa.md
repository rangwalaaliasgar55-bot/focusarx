# UI v3 acceptance QA

_Date: 2026-08-23_

## Browser matrix

A local Chromium acceptance harness exercised 13 public and authenticated route/viewport combinations with deterministic API fixtures:

- Landing: 360×800 and 1440×1000
- Login, signup, and Break Free: 360×800
- Dashboard: 360×800 and 1440×1000
- Tasks, flashcards, profile, focus chamber, and admin: 360×800
- Dashboard with reduced motion: 1440×1000

Final result across every audited combination:

- 0 uncaught page exceptions
- 0 horizontal-overflow failures
- 0 axe WCAG A/AA violations
- 0 interactive controls below the 44×44 CSS target
- Public routes produced no console errors
- Authenticated routes produced only expected Socket.IO handshake messages because the isolated fixture server did not provide a socket backend

The run also verified the mobile navigation drawer, light-theme switch, Ctrl+K command palette, profile-dialog open/keyboard-Escape behavior, and `prefers-reduced-motion` rendering.

## Lighthouse

Lighthouse 12.8.1 ran against the production build with deterministic API fixtures and a seeded authenticated dashboard session. Scores use Lighthouse's desktop acceptance profile.

| Route | Performance | Accessibility | Best practices | SEO | LCP | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Landing | 99 | 100 | 100 | 100 | 0.7 s | 0.009 |
| Dashboard | 97 | 100 | 96 | 100 | 1.1 s | 0 |

The dashboard best-practices deduction is the expected failed Socket.IO connection from the fixture environment; no browser-facing page exception was recorded.

## Findings closed

The final correction pass:

- raised muted text contrast in dark and light themes;
- added names to progress bars and compact icon controls;
- made dashboard overflow regions keyboard-focusable;
- expanded password, tabs, checkbox, timer, task, profile, and compact icon targets;
- corrected Break Free tab/panel ARIA references during loading;
- preserved keyboard dismissal for the profile dialog;
- removed duplicate admin chart keys;
- self-hosted the Geist/Manrope variable-font pair, eliminating third-party font failures and late font swaps.
