-- Blueprint P0 Hardening Migration
-- Compound indexes for query performance + new tables for FSRS flashcards
-- Safe: Uses IF NOT EXISTS, never drops or overwrites existing data

-- ═══════════════════════════════════════════════════════════════════
-- 1. COMPOUND INDEXES for common queries
-- ═══════════════════════════════════════════════════════════════════

-- Focus sessions: user + date range (daily/weekly summaries)
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_date
  ON focus_sessions (user_id, completed_at DESC);

-- Tasks: user + status + created date
CREATE INDEX IF NOT EXISTS idx_tasks_user_status_date
  ON tasks (user_id, status, created_at DESC);

-- Streaks: user + date (streak calculations)
CREATE INDEX IF NOT EXISTS idx_streaks_user_date
  ON streaks (user_id, last_session_date DESC);

-- Ghost data: user + category + date
CREATE INDEX IF NOT EXISTS idx_ghosts_user_category
  ON ghost_data (user_id, task_category, created_at DESC);

-- Habits: user + date + habit type
CREATE INDEX IF NOT EXISTS idx_habit_entries_user_date
  ON habit_entries (user_id, habit_id, entry_date DESC);

-- Quests: user + status
CREATE INDEX IF NOT EXISTS idx_quests_user_status
  ON user_quests (user_id, status);

-- Missions: user + mission_id (unique per user per day)
CREATE INDEX IF NOT EXISTS idx_missions_user_date
  ON user_missions (user_id, mission_date DESC);

-- Posts: community + created_at
CREATE INDEX IF NOT EXISTS idx_posts_community_date
  ON community_posts (community_id, created_at DESC);

-- Comments: post + created_at
CREATE INDEX IF NOT EXISTS idx_comments_post_date
  ON community_comments (post_id, created_at ASC);

-- Battle pass progress: user + season + week
CREATE INDEX IF NOT EXISTS idx_battle_pass_user_season
  ON battle_pass_progress (user_id, season_id, week_number);

-- Leaderboard entries: leaderboard + score + date
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_score
  ON leaderboard_entries (leaderboard_id, score DESC, created_at DESC);

-- XP history: user + date
CREATE INDEX IF NOT EXISTS idx_xp_history_user_date
  ON xp_history (user_id, earned_at DESC);

-- Session ghosts (for ghost racer): category + duration
CREATE INDEX IF NOT EXISTS idx_session_ghosts_category
  ON session_ghosts (user_id, task_category, duration_sec DESC);

-- Feedback: user + date
CREATE INDEX IF NOT EXISTS idx_feedback_user_date
  ON feedback (user_id, created_at DESC);

-- AI requests: user + date
CREATE INDEX IF NOT EXISTS idx_ai_requests_user_date
  ON ai_requests (user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- 2. FSRS FLASHCARD TABLES
-- ═══════════════════════════════════════════════════════════════════

-- Flashcard decks
CREATE TABLE IF NOT EXISTS flashcard_decks (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Deck',
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#7c3aed',
  card_count INTEGER DEFAULT 0,
  due_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flashcard cards with FSRS state
CREATE TABLE IF NOT EXISTS flashcard_cards (
  id SERIAL PRIMARY KEY,
  deck_id INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  -- FSRS state
  fsrs_difficulty REAL DEFAULT 0,
  fsrs_stability REAL DEFAULT 0,
  fsrs_reps INTEGER DEFAULT 0,
  fsrs_lapses INTEGER DEFAULT 0,
  fsrs_last_review TIMESTAMPTZ,
  fsrs_due_date TIMESTAMPTZ DEFAULT NOW(),
  fsrs_interval INTEGER DEFAULT 0,
  fsrs_state TEXT DEFAULT 'new' CHECK (fsrs_state IN ('new', 'learning', 'review', 'relearning')),
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flashcard review log
CREATE TABLE IF NOT EXISTS flashcard_reviews (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES flashcard_cards(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 4),
  interval_before INTEGER,
  interval_after INTEGER,
  stability_before REAL,
  stability_after REAL,
  elapsed_days REAL,
  review_duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for flashcard tables
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_user
  ON flashcard_decks (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_flashcard_cards_deck
  ON flashcard_cards (deck_id, fsrs_due_date ASC);

CREATE INDEX IF NOT EXISTS idx_flashcard_cards_user_due
  ON flashcard_cards (user_id, fsrs_due_date ASC)
  WHERE fsrs_state != 'new';

CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_card
  ON flashcard_reviews (card_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- 3. WALLET LOCK HELPER VIEW (for documentation)
-- ═══════════════════════════════════════════════════════════════════

-- This view documents the intended pattern for safe wallet updates:
-- Always use SELECT ... FOR UPDATE within a transaction for read-then-write
-- The application code in coinLedger.ts and tokenLedger.ts must follow this pattern

COMMENT ON TABLE user_wallets IS 'Use SELECT ... FOR UPDATE within db.transaction() for all read-modify-write operations. Never do bare UPDATE without transaction isolation.';
