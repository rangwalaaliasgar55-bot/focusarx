-- Rewrite existing bot bios that still carry "AI rival" watermark.
-- Safe, idempotent: only touches role='bot' rows whose bio matches old patterns.

BEGIN;

UPDATE users
SET bio = CASE
  WHEN lower(coalesce(onboarding_data->>'botVibe', '')) = 'grinder'
    THEN 'Grinding daily. Rank is a habit.'
  WHEN lower(coalesce(onboarding_data->>'botVibe', '')) = 'scholar'
    THEN 'Notes, mocks, revision loop. Quiet consistency.'
  WHEN lower(coalesce(onboarding_data->>'botVibe', '')) = 'sprinter'
    THEN 'Short bursts, hard sessions. Showing up.'
  WHEN lower(coalesce(onboarding_data->>'botVibe', '')) = 'chill'
    THEN 'Steady pace. One chapter at a time.'
  ELSE 'Showing up. One session at a time.'
END
WHERE role = 'bot'
  AND (
    bio ILIKE 'AI rival%'
    OR bio ILIKE '%AI rival%'
    OR bio ILIKE '%🤖%'
  );

UPDATE users
SET bio = replace(bio, '🤖', '')
WHERE role = 'bot' AND bio LIKE '%🤖%';

COMMIT;
