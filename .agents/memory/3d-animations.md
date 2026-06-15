---
name: 3D animations system
description: Reusable 3D/motion components added for the FocusArx animation layer.
---

## Components

### TiltCard.tsx
- `TiltCard` — perspective 3D tilt on mouse move, `intensity` prop (default 12)
- `FloatCard` — continuous floating bob animation
- `StaggerContainer` — wraps a list; staggers children in with Framer Motion
- `StaggerItem` — child of StaggerContainer; slides up with fade

### FloatingParticles.tsx  
- `FloatingParticles` — CSS/Framer Motion ambient particle layer (count prop, default 18); fixed z-index 1; used globally in App.tsx
- `PageAmbientOrbs` — 3 large radial gradient orbs with breathe animation; use per-page for extra depth

### FocusMoodWidget.tsx
- Energy check-in before sessions: 5 mood states (1–5), tips per level
- `compact` prop for inline use; full mode renders in SidePanel
- POSTs to `/api/mood` (gracefully ignores 404 — endpoint optional)

## Where they are used
- `App.tsx` — `FloatingParticles count={14}` wired globally; `FocusMoodWidget` in SidePanel
- `dashboard.tsx`, `achievements.tsx`, `wallet.tsx`, `missions.tsx`, `leaderboard.tsx`, `habits.tsx`, `goals.tsx` — all use `TiltCard`/`StaggerContainer`/`StaggerItem` on stat cards and list items
- `AppShell.tsx` sidebar — three animated aurora orbs (purple/teal/indigo) positioned absolutely inside the aside

**Why:** The ThreeBackground R3F Canvas falls back to CSS in the sandbox (no GPU). The CSS particle and orb layers provide the same ambient depth without WebGL dependency.
