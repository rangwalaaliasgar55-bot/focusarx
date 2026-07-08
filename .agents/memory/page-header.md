---
name: PageHeader component
description: Reusable page header component — icon, badge, title, subtitle, breadcrumbs, actions
---

# PageHeader Component

Located at `artifacts/focusarx/src/components/PageHeader.tsx`.

## Props
- `icon` — React node rendered in a colored rounded square (uses badgeColor)
- `badge` — string label shown as a pill above the title (with animated dot)
- `badgeColor` — hex color for icon bg, badge tint, and pill border (default `#7C3AED`)
- `title` — h1 text (always rendered)
- `subtitle` — smaller muted text below title
- `breadcrumbs` — array of `{ label, href? }` shown as breadcrumb trail
- `actions` — React node rendered on the right side (buttons, pills, etc.)

## Usage pattern
```tsx
import PageHeader from "@/components/PageHeader";

<PageHeader
  icon={<Target size={18} className="text-[#A78BFA]" />}
  badgeColor="#7C3AED"
  title="Focus Goals"
  subtitle="Set ambitious goals and track your journey"
  actions={<button ...>New Goal</button>}
/>
```

## Adoption status (as of June 2026)
Applied to: Analytics, Goals, Habits, Social, AI Insights, Coin Shop, Missions.
Still uses old `<header>` pattern: Profile (has custom layout with Coin Shop link action).

**Why:** Consistent visual hierarchy across all inner pages — badge pill above title, icon + colored bg, subtitle — replacing ad-hoc per-page header patterns that used different font sizes and colors.
