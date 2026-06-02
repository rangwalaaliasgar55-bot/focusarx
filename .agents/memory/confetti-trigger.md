---
name: Confetti celebration trigger in Timer
description: How and when confetti fires after a focus session completes
---

## Implementation
`ConfettiCelebration` is a canvas-based component at `artifacts/focusarx/src/components/ConfettiCelebration.tsx`. It renders a `<canvas>` fixed over the viewport and animates particles using `requestAnimationFrame`.

**Trigger logic (Timer.tsx):**
```ts
setShowConfetti(true);
setTimeout(() => setShowConfetti(false), 3500);
```
This runs alongside `setShowSummary(true)` in the `onSessionComplete` callback, but ONLY for focus sessions (`session.mode === "focus"` and `session.durationSeconds > 0`).

**Why canvas, not a library:** Keeps the bundle lean — no external confetti dependency needed.

**How to apply:** If adding confetti to other events (badge unlock, streak milestone), reuse `<ConfettiCelebration active={...} count={...} duration={...} />` with `active` driven by a boolean state + setTimeout reset.
