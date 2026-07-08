---
name: Profile Settings
description: User can edit display name, bio, and timezone from the profile page.
---

- API: `PATCH /api/auth/profile` in `artifacts/api-server/src/routes/auth.ts` — updates `name`, `bio`, `timezone` on `usersTable`
- `GET /api/auth/session` now returns `bio` and `timezone` fields so profile page can pre-populate the form
- UI: `EditProfileModal` component inline in `artifacts/focusarx/src/pages/profile.tsx`; opened by "Edit" button on user info card
- Fields: display name (60 char), bio (300 char, textarea), timezone (select from ~27 common zones)
- Bio and timezone show inline on profile card after save; success toast animation on save
- Note: `avatarEmoji` and `weeklyGoalMinutes` are NOT on `usersTable` — do not try to patch them

**Why:** Basic profile personalization was missing; bio/timezone are already columns on usersTable.
