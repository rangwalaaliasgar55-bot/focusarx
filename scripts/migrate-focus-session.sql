-- Run if `npm run db:fix` fails (sqlite3 dev.db < scripts/migrate-focus-session.sql)
-- Safe to re-run: skips errors when column already exists.

ALTER TABLE FocusSession ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE FocusSession ADD COLUMN activeSeconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE FocusSession ADD COLUMN secondsLeft INTEGER;
ALTER TABLE FocusSession ADD COLUMN timerStatus TEXT;
ALTER TABLE FocusSession ADD COLUMN startedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE FocusSession ADD COLUMN focusQuality TEXT;
ALTER TABLE FocusSession ADD COLUMN focusState TEXT;
ALTER TABLE FocusSession ADD COLUMN distractionCount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE FocusSession ADD COLUMN lastSeenFaceAt DATETIME;
ALTER TABLE FocusSession ADD COLUMN focusTimeline TEXT;
ALTER TABLE FocusSession ADD COLUMN stabilityRating TEXT;
ALTER TABLE FocusSession ADD COLUMN sessionInsights TEXT;
ALTER TABLE FocusSession ADD COLUMN monitorEnabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE FocusSession ADD COLUMN focusScore INTEGER;
