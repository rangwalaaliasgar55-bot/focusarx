---
name: Partial session save
description: Sessions stopped early (reset/lock exit) now save to DB if ≥60s elapsed
---

# Partial Session Save

**Rule:** When a user resets or exits the lock overlay during a focus session, save the session if `activeSeconds >= 60`.

**Why:** Users often stop mid-session (distraction, interruption). Their time should be recorded and count toward XP/streaks. Without this, any session that doesn't run to zero is lost.

**How to apply:** The `savePartialSessionIfNeeded` callback in `Timer.tsx` handles this. It calls `syncFocusSessionToCloud` with a partial Session object (no focusScore/quality metrics since those require completion). Toast shown: "Saved Xm of focus time".

Triggered from:
- `handleReset` (when status === "running" && mode === "focus")
- `handleLockExit`
