-- Down: 0018_data_integrity_checks
-- Drops every constraint added by 0018, and nothing else.
--
-- Guarded the same way as the up migration, so it is safe to run twice or on a
-- database where only some of the constraints were applied. Dropping a CHECK is
-- always safe: it removes a guarantee, never data.

DO $$ BEGIN
  ALTER TABLE focus_sessions DROP CONSTRAINT IF EXISTS focus_sessions_duration_non_negative;
  ALTER TABLE focus_sessions DROP CONSTRAINT IF EXISTS focus_sessions_planned_duration_non_negative;
  ALTER TABLE focus_sessions DROP CONSTRAINT IF EXISTS focus_sessions_completion_percentage_range;
END $$;

DO $$ BEGIN
  ALTER TABLE active_sessions DROP CONSTRAINT IF EXISTS active_sessions_seconds_left_non_negative;
  ALTER TABLE active_sessions DROP CONSTRAINT IF EXISTS active_sessions_active_seconds_non_negative;
END $$;

DO $$ BEGIN
  ALTER TABLE flashcards DROP CONSTRAINT IF EXISTS flashcards_box_at_least_one;
  ALTER TABLE flashcards DROP CONSTRAINT IF EXISTS flashcards_counters_non_negative;
  ALTER TABLE flashcards DROP CONSTRAINT IF EXISTS flashcards_fsrs_params_non_negative;
END $$;

DO $$ BEGIN
  ALTER TABLE flashcard_reviews DROP CONSTRAINT IF EXISTS flashcard_reviews_grade_in_range;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_sessions DROP CONSTRAINT IF EXISTS analytics_sessions_counters_non_negative;
END $$;

DO $$ BEGIN
  ALTER TABLE focus_cities DROP CONSTRAINT IF EXISTS focus_cities_counters_non_negative;
END $$;
