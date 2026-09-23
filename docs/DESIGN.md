# Design system — "Quiet tools"

FocusArx is a focus timer. Whatever else the product does — gamification,
community, analytics, coaching — the interface in front of it has to be the
calmest thing on the screen. This document is the prose version of
`artifacts/focusarx/src/index.css`; when the two disagree, the CSS is right and
this file is stale.

The system is called **v5 "Quiet tools"**. It replaced v4 "Liquid Glass", whose
glass panels, aurora washes, gradient headlines, neon borders and emoji-shaped
iconography had accumulated into something that read as a template rather than
a tool.

---

## 1. The five rules

1. **One accent.** `--brand-500` is the only hue in the chrome. It marks the
   primary action, the active destination and the focus ring — nothing else.
   Because it is scarce, it still means "press this".
2. **Flat surfaces, hairline separation.** Depth is one tone step
   (`surface-0` → `surface-1` → `surface-2` → `surface-3`) plus a 1px border.
   No glow, no blur, no gradient-as-material.
3. **No decorative motion.** Colour that carries meaning (success, warning,
   danger, gold) is content. Colour used as atmosphere is not. The countdown
   is the only thing on screen allowed to move on its own.
4. **Motion is short.** 150–250 ms, transform/opacity only, and every
   animation has a `prefers-reduced-motion` escape.
5. **Type carries the design.** One family pair, one scale, tabular figures
   for anything that counts.

Anything that cannot be justified by these five rules does not ship.

---

## 2. Layers

`index.css` is organised in eight numbered layers, and reads top to bottom.
Components may only reach *up*: a component reads ②, never ①.

| Layer | Name | What lives there |
|---|---|---|
| ① | primitives | raw ramps (`--neutral-*`, `--brand-50…900`), scales (type, space, radius, z) |
| ② | semantics | the tokens components actually read, once per theme (`:root`, `html.light`) |
| ③ | base | reset, focus ring, scrollbars, selection, skip link |
| ④ | type | `.text-display`, `.text-h1`…`.text-caption`, `.font-metric`, `.tabular-nums` |
| ⑤ | materials | `.ui-panel`, `.glass*` (now flat), `.surface-1/2/3` |
| ⑥ | legacy | quiet redefinitions of pre-v5 class names — deprecated, see §5 |
| ⑦ | components | app chrome, navigation, page rhythm, tables, forms |
| ⑧ | motion | the keyframes that still earn their keep |

Two gates keep the layers honest:

- `src/design-tokens.contrast.test.ts` resolves the theme *out of the CSS* and
  requires WCAG AA (4.5:1) for `--foreground`, `--foreground-muted`,
  `--foreground-subtle` and `--muted-fg` on both the page and a card, in both
  themes — plus a ≥1:1 gap between muted and subtle so hierarchy cannot be
  flattened by a contrast fix.
- `src/styles.tokens.test.ts` requires every interactive `--duration-*` to stay
  inside 150–250 ms, a reduced-motion block to exist, `--ring` to be declared,
  and no bare `:focus` selector anywhere in the stylesheet.

---

## 3. Tokens you should use

Prefer these over literal colours or raw Tailwind greys. They exist in both
themes, so a component built from them is themed by construction.

| Purpose | Token |
|---|---|
| Page | `--background` (= `--surface-0`) |
| Card / panel | `--surface-1` |
| Raised row, popover | `--surface-2` |
| Modal, toast | `--surface-3` |
| Hover / active wash | `--surface-hover`, `--surface-active` |
| Separator | `--border-subtle`, `--border` |
| Interactive edge | `--border-strong` |
| Primary copy | `--foreground` |
| Secondary copy | `--foreground-muted` |
| Labels, meta | `--foreground-subtle`, `--muted-fg` |
| Accent fill | `--brand-600` (hover `--brand-700`) |
| Accent as text | `--brand-strong` (AA on both surfaces) |
| Accent identity | `--brand-500` (rings, rails, progress) |
| Status | `--success`, `--warning`, `--danger`, `--info` (+ `-soft`) |
| Elevation | `--shadow-xs` … `--shadow-xl` (all neutral) |
| Radii | `--radius-sm` 6 → `--radius-2xl` 20 |

### Choosing a radius

Small radii on purpose: 8 px for controls, 12–16 px for panels, 20 px maximum.
A 28 px card radius is a marketing tile, not an interface.

### Choosing an elevation

Most things get **no** shadow. A hairline border plus one tone step is enough
to separate a card from the page. Shadows are for things that genuinely float
above the flow: menus, modals, toasts, drag state. If you are adding a shadow
to make something look important, add weight or space instead.

---

## 4. Themes and the accent

- Dark is the default theme; `html.light` re-declares ② and nothing else.
- The accent is user-configurable (Settings → Appearance, twelve presets plus a
  colour picker). `src/lib/accent.ts` generates a ten-step ramp from the picked
  colour and writes it into `--brand-*`, `--ring`, `--card-border` and the
  legacy `--rgba-*` channel tokens.
- **The accent owns colour, never depth.** `buildAccentOverrides` deliberately
  does not emit `--glow-*` or `--shadow-violet-*`; those keep the flat values
  declared in the stylesheet, so picking a colour cannot light the interface
  up. `src/lib/accent.test.ts` pins that omission.
- `DEFAULT_ACCENT` must equal `--brand-500` in `index.css` and appear in
  `ACCENT_PRESETS`; `AppearanceSettings.test.tsx` reads the stylesheet and
  fails if the three drift apart.
- **Daylight is not a filter over dark.** The v4 compatibility ramp (`--rgba-*`)
  is near-white at low alpha — a brush stroke on a black page, and nothing at
  all on a white one. `html.light` restates those alphas as ink, and
  `--surface-2` is a *well* (marginally darker than the card it sits on) rather
  than a second white, so hover fills and raised rows exist in light mode.
  `quiet-interface.test.ts` holds both.

---

## 5. The legacy vocabulary (mostly gone)

Layer ⑥ is a stub now. The v4 class names — `text-gradient`, `gradient-violet`,
`glow-violet`, `glow-aurora`, `shadow-3d`, `texture-grain`, `neon-border-pulse`,
`logo-pulse`, `magnetic-hover`, `perspective-card`, `forge-bg-glow`, `hud-*`,
`glass-heavy`, and the `.animate-sparkle` / `-shimmer-sweep` / `-fire` /
`-scan` / `-float-orb` family — no longer have any call sites in the app, and
`src/quiet-interface.test.ts` fails the build if one comes back.

What remains in ⑥ is the compatibility surface with a live call site:

- the `.glass*` names, which now resolve to a surface step and a hairline (13
  call sites in shared chrome);
- the three Tailwind-zinc platform fixes, which remap `bg-zinc-950` and friends
  onto the token surfaces for components that still use the literal ramp.

Delete the rule when its last call site goes. Do not add new usages, and do not
extend the layer to cover a new class name: if a review comment says "this
needs a glow", the answer is the design rules in §1, not a new exception.

### Already removed in v5

- `.glass*` — translucent fills and 28 px backdrop blur. Blur on a dark page
  lowered the contrast of everything sitting on it and cost a compositor layer
  per card. The names survive as flat panels.
- The accent's glow layer (see §4).
- **103 backdrop blur utilities** across 65 components, and 76 glow shadows —
  one 40px glow shadow puts the whole light rig back, so the sweep and the
  gate both exist.
- **69 decorative gradients** flattened to the token they stood in for, and 31
  hover scales. Gradients from a brand hue are banned by test; scrims over
  photos and headlines are allowed.
- The timer's breathing loading dial, and the dashboard hero's 176 px conic
  gradient ring — the loudest element on the page, spent on a progress arc the
  countdown already states.
- 18 decorative `blur-3xl` gradient blobs across 13 files.
- `LandingCursorGlow` — a spotlight that trailed the pointer on the homepage.
- The landing page's three.js "focus atmosphere" panel, replaced by a diagram
  of what a focused hour is made of (`SessionAnatomy` in `pages/landing.tsx`).
- 37 `shadow-2xl` spreads → `--shadow-lg`; 37 `rounded-3xl` radii →
  `--radius-xl`.
- `Card pulsing` (infinite border animation) and `Card elevation="glow"` (violet
  shadow). `glow` remains as an alias of `elevated`.

---

## 6. Typography

- **Display / UI:** Manrope Variable. **Body / numerics:** Geist Variable. Both
  self-hosted, so the interface is identical on every platform instead of
  inheriting whatever the OS calls a sans-serif.
- Marketing pages use the *same* pair. v5 dropped the separate
  Instrument Serif + DM Sans pairing: one voice everywhere is the point, and
  the serif italic headline had become the visual signature of every
  AI-generated landing page.
- Display sizes take negative tracking (`-0.02em` → `-0.035em`); labels take
  positive tracking (`0.08em` → `0.14em`). Both are utilities —
  `.tracking-display`, `.tracking-label`.
- `.font-metric` / `.tabular-nums` on anything that changes in place: a
  countdown that reflows its own digits is a bug you can see.
- 11 px is the floor for on-screen text, enforced by `src/legibility.test.ts`.

---

## 7. Adding a surface

1. Pick the container: `.ui-panel` for a group of related things, `.page-container`
   for a page, `.data-table-shell` for a table.
2. Fill with a `--surface-*` step, separate with `--border-subtle`.
3. Text: `--foreground` for the primary line, `--foreground-muted` for the
   explanation, `--foreground-subtle` for meta. Never go below that ladder.
4. One accent element per view, maximum. If a section has two competing accent
   elements, one of them is decoration.
5. Interactive controls need a `:focus-visible` ring (`--brand-500`) and a
   44 px touch target on mobile.
6. Check both themes. The light theme is not an afterthought; it is half the
   product.

---

## 8. Where the rules are enforced

| Rule | Gate |
|---|---|
| Text contrast, both themes | `src/design-tokens.contrast.test.ts` |
| Accent readable under a white label | `src/lib/accent.contrast.test.ts` |
| Motion budget, reduced motion, focus-visible | `src/styles.tokens.test.ts` |
| 11 px legibility floor | `src/legibility.test.ts` |
| No emoji as UI in the chrome | `src/emoji-ui.test.ts` |
| Admin console labels legible | `src/palette-contrast.test.ts` |
| Accent default ↔ CSS ↔ presets | `src/components/settings/AppearanceSettings.test.tsx` |
| No glow/shadow tokens from the accent | `src/lib/accent.test.ts` |
| No blur, glow, decorative gradient or pre-v5 vocabulary in components | `src/quiet-interface.test.ts` |

If a change to the design system makes one of these fail, the gate is right.
Fix the design, not the assertion.
