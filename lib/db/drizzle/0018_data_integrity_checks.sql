-- Database-level invariants beyond the wallet, in the same spirit as 0016.
--
-- Each constraint here encodes something that is *arithmetically* true rather
-- than a policy choice: a duration cannot be negative, a Leitner box cannot be
-- zero, a 4-point grade cannot be 7, a completion number that the server clamps
-- to 100 cannot be 140. None of them reject a legitimate value, which is what
-- makes them safe to add to a live database.
--
-- Why bother, when the application already produces correct values?
--
--   * A CHECK protects the writers that do NOT go through the validation layer:
--     a repair script, a bulk import, a raw UPDATE during an incident, or a
--     helper nobody has written yet.
--   * Negative counters are unrecoverable in a way that is easy to miss. A
--     `correct_count` of -1 is not a visible error; it is a wrong number on a
--     progress screen forever, and there is no way to know what it should have
--     been.
--   * The alternative — "the code is careful" — is a property of the code that
--     exists today, not of the data. Constraints buy the second one.
--
-- Repair first, then constrain. Every repair below is lossless in the only
-- direction available: a negative counter becomes 0, an out-of-range grade is
-- pulled to the nearest legal grade, and the original value is reported by
-- RAISE NOTICE so a replay leaves evidence in the log. Failing the migration
-- instead would block every deploy behind one bad row.
--
-- Rollback: lib/db/drizzle/rollback/0018_data_integrity_checks.down.sql
-- Idempotent: every block guards on pg_constraint, so a re-run is a no-op.

DO $$
DECLARE
  n bigint;
BEGIN
  -- ── focus_sessions ────────────────────────────────────────────────────
  SELECT count(*) INTO n FROM focus_sessions WHERE duration_sec < 0;
  IF n > 0 THEN
    RAISE NOTICE 'focus_sessions.duration_sec: clamping % negative value(s) to 0', n;
    UPDATE focus_sessions SET duration_sec = 0 WHERE duration_sec < 0;
  END IF;

  SELECT count(*) INTO n FROM focus_sessions WHERE planned_duration_sec < 0;
  IF n > 0 THEN
    RAISE NOTICE 'focus_sessions.planned_duration_sec: nulling % negative value(s)', n;
    -- NULL, not 0: the column means "no plan was recorded", and 0 would claim
    -- a plan of zero seconds existed.
    UPDATE focus_sessions SET planned_duration_sec = NULL WHERE planned_duration_sec < 0;
  END IF;

  SELECT count(*) INTO n FROM focus_sessions
    WHERE completion_percentage IS NOT NULL
      AND (completion_percentage < 0 OR completion_percentage > 100);
  IF n > 0 THEN
    RAISE NOTICE 'focus_sessions.completion_percentage: clamping % out-of-range value(s)', n;
    UPDATE focus_sessions
      SET completion_percentage = GREATEST(0, LEAST(100, completion_percentage))
      WHERE completion_percentage IS NOT NULL
        AND (completion_percentage < 0 OR completion_percentage > 100);
  END IF;

  -- ── active_sessions ───────────────────────────────────────────────────
  SELECT count(*) INTO n FROM active_sessions WHERE seconds_left < 0;
  IF n > 0 THEN
    RAISE NOTICE 'active_sessions.seconds_left: clamping % negative value(s) to 0', n;
    UPDATE active_sessions SET seconds_left = 0 WHERE seconds_left < 0;
  END IF;

  SELECT count(*) INTO n FROM active_sessions WHERE active_seconds < 0;
  IF n > 0 THEN
    RAISE NOTICE 'active_sessions.active_seconds: clamping % negative value(s) to 0', n;
    UPDATE active_sessions SET active_seconds = 0 WHERE active_seconds < 0;
  END IF;

  -- ── flashcards ────────────────────────────────────────────────────────
  -- The Leitner system's boxes are 1-based; 0 is not a box, it is a sentinel
  -- that would make the card invisible to every review query.
  SELECT count(*) INTO n FROM flashcards WHERE box < 1;
  IF n > 0 THEN
    RAISE NOTICE 'flashcards.box: raising % value(s) below 1', n;
    UPDATE flashcards SET box = 1 WHERE box < 1;
  END IF;

  SELECT count(*) INTO n FROM flashcards
    WHERE correct_count < 0 OR incorrect_count < 0 OR fsrs_reps < 0
       OR fsrs_lapses < 0 OR fsrs_interval < 0;
  IF n > 0 THEN
    RAISE NOTICE 'flashcards: clamping % negative counter value(s) to 0', n;
    UPDATE flashcards
      SET correct_count = GREATEST(0, correct_count),
          incorrect_count = GREATEST(0, incorrect_count),
          fsrs_reps = GREATEST(0, fsrs_reps),
          fsrs_lapses = GREATEST(0, fsrs_lapses),
          fsrs_interval = GREATEST(0, fsrs_interval)
      WHERE correct_count < 0 OR incorrect_count < 0 OR fsrs_reps < 0
         OR fsrs_lapses < 0 OR fsrs_interval < 0;
  END IF;

  -- FSRS derives intervals from stability and difficulty. A negative either way
  -- produces a due date in the past, so the card re-appears immediately and
  -- forever — a silent scheduling loop rather than an error.
  SELECT count(*) INTO n FROM flashcards
    WHERE fsrs_stability < 0 OR fsrs_difficulty < 0;
  IF n > 0 THEN
    RAISE NOTICE 'flashcards: clamping % negative FSRS parameter(s) to 0', n;
    UPDATE flashcards
      SET fsrs_stability = GREATEST(0, fsrs_stability),
          fsrs_difficulty = GREATEST(0, fsrs_difficulty)
      WHERE fsrs_stability < 0 OR fsrs_difficulty < 0;
  END IF;

  -- ── flashcard_reviews ─────────────────────────────────────────────────
  -- Documented as 1=Again, 2=Hard, 3=Good, 4=Easy.
  SELECT count(*) INTO n FROM flashcard_reviews WHERE grade NOT BETWEEN 1 AND 4;
  IF n > 0 THEN
    RAISE NOTICE 'flashcard_reviews.grade: clamping % out-of-range value(s) to 1..4', n;
    UPDATE flashcard_reviews SET grade = GREATEST(1, LEAST(4, grade))
      WHERE grade NOT BETWEEN 1 AND 4;
  END IF;

  -- ── analytics_sessions ────────────────────────────────────────────────
  SELECT count(*) INTO n FROM analytics_sessions
    WHERE duration_sec < 0 OR page_views < 0 OR focus_sessions_started < 0
       OR tasks_created < 0 OR roadmaps_generated < 0 OR ai_features_used < 0;
  IF n > 0 THEN
    RAISE NOTICE 'analytics_sessions: clamping % negative counter value(s) to 0', n;
    UPDATE analytics_sessions
      SET duration_sec = GREATEST(0, duration_sec),
          page_views = GREATEST(0, page_views),
          focus_sessions_started = GREATEST(0, focus_sessions_started),
          tasks_created = GREATEST(0, tasks_created),
          roadmaps_generated = GREATEST(0, roadmaps_generated),
          ai_features_used = GREATEST(0, ai_features_used)
      WHERE duration_sec < 0 OR page_views < 0 OR focus_sessions_started < 0
         OR tasks_created < 0 OR roadmaps_generated < 0 OR ai_features_used < 0;
  END IF;

  -- ── focus_cities ──────────────────────────────────────────────────────
  SELECT count(*) INTO n FROM focus_cities
    WHERE population < 0 OR total_buildings < 0 OR total_sessions < 0;
  IF n > 0 THEN
    RAISE NOTICE 'focus_cities: clamping % negative counter value(s) to 0', n;
    UPDATE focus_cities
      SET population = GREATEST(0, population),
          total_buildings = GREATEST(0, total_buildings),
          total_sessions = GREATEST(0, total_sessions)
      WHERE population < 0 OR total_buildings < 0 OR total_sessions < 0;
  END IF;
END $$;

-- ── Constrain ───────────────────────────────────────────────────────────
-- One DO block per table. The guard is the same shape as 0016's so a partially
-- applied migration can be re-run safely.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'focus_sessions'::regclass AND conname = 'focus_sessions_duration_non_negative') THEN
    ALTER TABLE focus_sessions ADD CONSTRAINT focus_sessions_duration_non_negative CHECK (duration_sec >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'focus_sessions'::regclass AND conname = 'focus_sessions_planned_duration_non_negative') THEN
    ALTER TABLE focus_sessions ADD CONSTRAINT focus_sessions_planned_duration_non_negative CHECK (planned_duration_sec IS NULL OR planned_duration_sec >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'focus_sessions'::regclass AND conname = 'focus_sessions_completion_percentage_range') THEN
    ALTER TABLE focus_sessions ADD CONSTRAINT focus_sessions_completion_percentage_range CHECK (completion_percentage IS NULL OR (completion_percentage >= 0 AND completion_percentage <= 100));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'active_sessions'::regclass AND conname = 'active_sessions_seconds_left_non_negative') THEN
    ALTER TABLE active_sessions ADD CONSTRAINT active_sessions_seconds_left_non_negative CHECK (seconds_left >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'active_sessions'::regclass AND conname = 'active_sessions_active_seconds_non_negative') THEN
    ALTER TABLE active_sessions ADD CONSTRAINT active_sessions_active_seconds_non_negative CHECK (active_seconds >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'flashcards'::regclass AND conname = 'flashcards_box_at_least_one') THEN
    ALTER TABLE flashcards ADD CONSTRAINT flashcards_box_at_least_one CHECK (box >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'flashcards'::regclass AND conname = 'flashcards_counters_non_negative') THEN
    ALTER TABLE flashcards ADD CONSTRAINT flashcards_counters_non_negative CHECK (
      correct_count >= 0 AND incorrect_count >= 0
      AND fsrs_reps >= 0 AND fsrs_lapses >= 0 AND fsrs_interval >= 0
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'flashcards'::regclass AND conname = 'flashcards_fsrs_params_non_negative') THEN
    ALTER TABLE flashcards ADD CONSTRAINT flashcards_fsrs_params_non_negative CHECK (
      (fsrs_stability IS NULL OR fsrs_stability >= 0)
      AND (fsrs_difficulty IS NULL OR fsrs_difficulty >= 0)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'flashcard_reviews'::regclass AND conname = 'flashcard_reviews_grade_in_range') THEN
    ALTER TABLE flashcard_reviews ADD CONSTRAINT flashcard_reviews_grade_in_range CHECK (grade BETWEEN 1 AND 4);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'analytics_sessions'::regclass AND conname = 'analytics_sessions_counters_non_negative') THEN
    ALTER TABLE analytics_sessions ADD CONSTRAINT analytics_sessions_counters_non_negative CHECK (
      duration_sec >= 0 AND page_views >= 0 AND focus_sessions_started >= 0
      AND tasks_created >= 0 AND roadmaps_generated >= 0 AND ai_features_used >= 0
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'focus_cities'::regclass AND conname = 'focus_cities_counters_non_negative') THEN
    ALTER TABLE focus_cities ADD CONSTRAINT focus_cities_counters_non_negative CHECK (
      population >= 0 AND total_buildings >= 0 AND total_sessions >= 0
    );
  END IF;
END $$;
