-- Run this in Neon SQL Editor if Break Free shows "database may need updating"
-- https://console.neon.tech → your project → SQL Editor → paste → Run

CREATE TABLE IF NOT EXISTS break_free_streaks (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  start_date text NOT NULL,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  relapse_count integer NOT NULL DEFAULT 0,
  last_relapse_date text,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS break_free_moods (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mood integer NOT NULL,
  date text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS break_free_pledges (
  id text PRIMARY KEY,
  message text NOT NULL,
  posted_at timestamp NOT NULL DEFAULT now()
);

-- Verify (should return 3 rows):
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'break_free_%';
