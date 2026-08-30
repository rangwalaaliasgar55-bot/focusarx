-- FocusArx Full Schema (Idempotent)
-- Generated from Drizzle ORM schema definitions.
-- Safe to run against an existing database — uses IF NOT EXISTS everywhere.
-- Never drops or overwrites existing data.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. CORE USERS & AUTH
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  hashed_password TEXT,
  guest_key TEXT UNIQUE,
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  role TEXT NOT NULL DEFAULT 'user',
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_data JSONB,
  bio TEXT,
  timezone TEXT DEFAULT 'UTC',
  productivity_score REAL DEFAULT 0,
  total_focus_minutes INTEGER DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by_user_id TEXT,
  referral_applied_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  family_id TEXT,
  expires_at TIMESTAMP NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx ON refresh_tokens(family_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. FOCUS SESSIONS & TIMER
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS focus_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'focus',
  duration_sec INTEGER NOT NULL DEFAULT 0,
  planned_duration_sec INTEGER,
  completed_early BOOLEAN DEFAULT FALSE,
  completion_percentage REAL,
  session_status TEXT DEFAULT 'completed',
  completed_at TIMESTAMP,
  focus_score REAL,
  focus_quality TEXT,
  stability_rating TEXT,
  focus_timeline TEXT,
  session_insights TEXT,
  category TEXT DEFAULT 'General',
  productivity_score REAL,
  client_nonce TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS focus_sessions_user_id_idx ON focus_sessions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS focus_sessions_user_nonce_unique ON focus_sessions(user_id, client_nonce);
CREATE INDEX IF NOT EXISTS focus_sessions_completed_at_idx ON focus_sessions(completed_at);
CREATE INDEX IF NOT EXISTS focus_sessions_user_started_idx ON focus_sessions(user_id, created_at);
CREATE INDEX IF NOT EXISTS focus_sessions_user_completed_idx ON focus_sessions(user_id, completed_at);
CREATE INDEX IF NOT EXISTS focus_sessions_user_status_idx ON focus_sessions(user_id, session_status);

CREATE TABLE IF NOT EXISTS active_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'focus',
  seconds_left INTEGER NOT NULL DEFAULT 1500,
  timer_status TEXT NOT NULL DEFAULT 'paused',
  active_seconds INTEGER NOT NULL DEFAULT 0,
  focus_score REAL,
  focus_quality TEXT,
  focus_state TEXT,
  distraction_count INTEGER DEFAULT 0,
  last_seen_face_at TEXT,
  focus_timeline TEXT DEFAULT '[]',
  monitor_enabled BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS active_session_per_user_idx ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS active_sessions_started_at_idx ON active_sessions(started_at);

CREATE TABLE IF NOT EXISTS session_ghosts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE,
  ghost_type TEXT NOT NULL DEFAULT 'personal_best',
  duration_sec INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. STUDY STREAKS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS study_streaks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_study_date TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS freeze_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_type TEXT NOT NULL DEFAULT 'streak_freeze',
  source TEXT NOT NULL DEFAULT 'shop',
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. TASKS & GOALS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  "order" INTEGER DEFAULT 0,
  estimated_minutes INTEGER,
  category TEXT DEFAULT 'General',
  priority TEXT DEFAULT 'medium',
  tags JSONB DEFAULT '[]',
  due_date TEXT,
  recurring TEXT,
  completed_at TIMESTAMP,
  status TEXT DEFAULT 'active',
  missed_at TIMESTAMP,
  miss_count INTEGER DEFAULT 0,
  archived_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily',
  icon TEXT DEFAULT '✅',
  color TEXT DEFAULT '#7C3AED',
  streak INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS habits_user_idx ON habits(user_id);

CREATE TABLE IF NOT EXISTS habit_completions (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_date TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS habit_completions_unique ON habit_completions(habit_id, completed_date);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. WALLET, ECONOMY & GAMIFICATION
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  coins INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  weekly_xp INTEGER NOT NULL DEFAULT 0,
  weekly_xp_reset_at TIMESTAMP DEFAULT NOW(),
  level INTEGER NOT NULL DEFAULT 1,
  prestige INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_wallets_weekly_xp_idx ON user_wallets(weekly_xp);
CREATE INDEX IF NOT EXISTS user_wallets_total_xp_idx ON user_wallets(total_xp);

CREATE TABLE IF NOT EXISTS user_badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  unlocked_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coin_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  balance_after INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS coin_tx_user_idx ON coin_transactions(user_id);

CREATE TABLE IF NOT EXISTS login_rewards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_key TEXT NOT NULL,
  coins_earned INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  streak_day INTEGER NOT NULL DEFAULT 1,
  claimed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS login_rewards_user_day_unique ON login_rewards(user_id, day_key);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  mission_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'daily',
  category TEXT NOT NULL DEFAULT 'focus',
  xp_reward INTEGER NOT NULL DEFAULT 100,
  coin_reward INTEGER NOT NULL DEFAULT 50,
  target_value INTEGER NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'sessions',
  icon TEXT NOT NULL DEFAULT '🎯',
  difficulty TEXT NOT NULL DEFAULT 'easy',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_mission_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_key TEXT NOT NULL,
  period_start TEXT NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP,
  reward_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mission_progress_user_period_idx ON user_mission_progress(user_id, period_start);

CREATE TABLE IF NOT EXISTS battle_pass_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season TEXT NOT NULL,
  season_xp INTEGER NOT NULL DEFAULT 0,
  tier INTEGER NOT NULL DEFAULT 0,
  premium_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_tiers JSONB DEFAULT '[]',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS battle_pass_user_season_unique ON battle_pass_progress(user_id, season);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. SOCIAL & COMMUNITY
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS friendships_requester_idx ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships(addressee_id);

CREATE TABLE IF NOT EXISTS follows (
  id TEXT PRIMARY KEY,
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS follows_unique ON follows(follower_id, following_id);

CREATE TABLE IF NOT EXISTS buddy_requests (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS buddy_requests_receiver_idx ON buddy_requests(receiver_id);

CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  image_urls JSONB DEFAULT '[]',
  metadata JSONB,
  group_id TEXT REFERENCES study_groups(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  view_count INTEGER NOT NULL DEFAULT 0,
  moderation_status TEXT NOT NULL DEFAULT 'approved',
  moderation_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS social_posts_user_idx ON social_posts(user_id);
CREATE INDEX IF NOT EXISTS social_posts_created_at_idx ON social_posts(created_at);
CREATE INDEX IF NOT EXISTS social_posts_moderation_idx ON social_posts(moderation_status);

CREATE TABLE IF NOT EXISTS post_reactions (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS post_reactions_post_idx ON post_reactions(post_id);

CREATE TABLE IF NOT EXISTS post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS post_comments_post_idx ON post_comments(post_id);

CREATE TABLE IF NOT EXISTS post_saves (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS post_saves_post_user_idx ON post_saves(post_id, user_id);

CREATE TABLE IF NOT EXISTS user_emotes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emote_id TEXT NOT NULL,
  equipped BOOLEAN NOT NULL DEFAULT FALSE,
  unlocked_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_emotes_user_emote_unique ON user_emotes(user_id, emote_id);
CREATE INDEX IF NOT EXISTS user_emotes_user_idx ON user_emotes(user_id);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  image_urls JSONB DEFAULT '[]',
  achievement_data JSONB,
  study_log_data JSONB,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  group_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS posts_user_idx ON posts(user_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at);

CREATE TABLE IF NOT EXISTS post_likes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS post_likes_post_user_idx ON post_likes(post_id, user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. STUDY GROUPS & ROOMS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS study_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  max_members INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS group_members_group_user_unique ON group_members(group_id, user_id);

CREATE TABLE IF NOT EXISTS study_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  max_members INTEGER NOT NULL DEFAULT 20,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS study_rooms_owner_idx ON study_rooms(owner_id);

CREATE TABLE IF NOT EXISTS study_room_members (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  left_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS study_room_members_room_idx ON study_room_members(room_id);
CREATE INDEX IF NOT EXISTS room_members_room_user_idx ON study_room_members(room_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS study_room_members_room_user_unique ON study_room_members(room_id, user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. PRODUCTIVITY & FOCUS TRACKING
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS productivity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  productivity_score INTEGER,
  focus_minutes INTEGER DEFAULT 0,
  sessions_completed INTEGER DEFAULT 0,
  avg_focus_score REAL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS productivity_logs_user_date_unique ON productivity_logs(user_id, date);

CREATE TABLE IF NOT EXISTS readiness_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 50,
  mood TEXT,
  sleep_hours REAL,
  energy_level INTEGER,
  stress_level INTEGER,
  notes TEXT,
  logged_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS distraction_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT,
  distraction_type TEXT NOT NULL DEFAULT 'phone',
  noted_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS focus_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  focus_type TEXT,
  peak_hours JSONB,
  avg_session_minutes INTEGER,
  best_streak_days INTEGER,
  total_focus_hours REAL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS focus_dna (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  traits JSONB,
  archetype TEXT,
  computed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 9. BREAK-FREE (ADDICTION RECOVERY)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS break_free_streaks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_type TEXT NOT NULL DEFAULT 'phone',
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_check_in TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS break_free_moods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mood TEXT NOT NULL,
  intensity INTEGER,
  logged_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS break_free_pledges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pledge_type TEXT NOT NULL,
  message TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 10. CONSEQUENCES & CONTRACTS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consequence_contracts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  consequence_type TEXT NOT NULL DEFAULT 'coin_loss',
  stake_amount INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 11. ROADMAPS & DREAMS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roadmaps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_dreams (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  is_achieved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 12. NOTIFICATIONS & COMMUNICATION
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id, read);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  priority_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sound TEXT NOT NULL DEFAULT 'default',
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_sub_user_idx ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  recipient_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  template TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_id TEXT,
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  bounced BOOLEAN DEFAULT FALSE,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_logs_recipient_idx ON email_logs(recipient_id);
CREATE INDEX IF NOT EXISTS email_logs_created_at_idx ON email_logs(created_at);

-- ────────────────────────────────────────────────────────────────────────────
-- 13. CHAT / MESSAGING
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'direct',
  name TEXT,
  group_id TEXT,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conversations_group_idx ON conversations(group_id);

CREATE TABLE IF NOT EXISTS conversation_participants (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conv_participants_conv_user_idx ON conversation_participants(conversation_id, user_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  reply_to_id TEXT,
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);

CREATE TABLE IF NOT EXISTS message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS message_reactions_msg_user_idx ON message_reactions(message_id, user_id);
CREATE INDEX IF NOT EXISTS message_reactions_msg_idx ON message_reactions(message_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 14. CITY / FORGE / PETS / MARKETPLACE
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS focus_cities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'hamlet',
  tier_name TEXT NOT NULL DEFAULT 'Study Hamlet',
  population INTEGER NOT NULL DEFAULT 5,
  total_buildings INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  unlocked_districts JSONB DEFAULT '["downtown"]',
  buildings JSONB DEFAULT '{}',
  atmosphere TEXT NOT NULL DEFAULT 'day',
  selected_skin TEXT NOT NULL DEFAULT 'classic',
  weather TEXT NOT NULL DEFAULT 'clear',
  weather_updated_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS focus_cities_user_idx ON focus_cities(user_id);

CREATE TABLE IF NOT EXISTS city_building_definitions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  district TEXT NOT NULL,
  category TEXT NOT NULL,
  unlock_level INTEGER NOT NULL DEFAULT 1,
  unlock_sessions INTEGER NOT NULL DEFAULT 0,
  coin_cost INTEGER NOT NULL DEFAULT 0,
  population_bonus INTEGER NOT NULL DEFAULT 10,
  xp_bonus_per_session INTEGER NOT NULL DEFAULT 0,
  coin_bonus_per_session INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'hamlet',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_pets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_type TEXT NOT NULL,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  mood TEXT NOT NULL DEFAULT 'happy',
  equipped BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_pets_user_idx ON user_pets(user_id);

CREATE TABLE IF NOT EXISTS marketplace_items (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  is_sold BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS marketplace_items_seller_idx ON marketplace_items(seller_id);

CREATE TABLE IF NOT EXISTS user_inventory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  acquired_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_inventory_user_idx ON user_inventory(user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 15. LOOT BOXES & QUESTS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loot_box_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  rarity TEXT NOT NULL,
  coin_cost INTEGER NOT NULL DEFAULT 0,
  sessions_required INTEGER NOT NULL DEFAULT 0,
  premium_only BOOLEAN NOT NULL DEFAULT FALSE,
  icon TEXT NOT NULL,
  glow_color TEXT NOT NULL DEFAULT '#7C3AED',
  possible_rewards JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS user_loot_boxes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  box_type_id TEXT NOT NULL REFERENCES loot_box_types(id),
  status TEXT NOT NULL DEFAULT 'unopened',
  reward_type TEXT,
  reward_value JSONB,
  earned_reason TEXT,
  opened_at TIMESTAMP,
  earned_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_loot_boxes_user_idx ON user_loot_boxes(user_id);

CREATE TABLE IF NOT EXISTS quest_definitions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'easy',
  target INTEGER NOT NULL,
  metric TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  coin_reward INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  rotation_weight INTEGER NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS user_quest_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL REFERENCES quest_definitions(id),
  period TEXT NOT NULL,
  current INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_at TIMESTAMP,
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_quest_progress_user_idx ON user_quest_progress(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_quest_progress_unique ON user_quest_progress(user_id, quest_id, period);

-- ────────────────────────────────────────────────────────────────────────────
-- 16. SEASONAL EVENTS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seasonal_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  theme TEXT NOT NULL,
  banner_color TEXT NOT NULL DEFAULT '#7C3AED',
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  xp_multiplier REAL NOT NULL DEFAULT 1.0,
  coin_multiplier REAL NOT NULL DEFAULT 1.0,
  special_missions JSONB DEFAULT '[]',
  exclusive_rewards JSONB DEFAULT '[]',
  premium_only BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_seasonal_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES seasonal_events(id),
  points INTEGER NOT NULL DEFAULT 0,
  completed_missions JSONB DEFAULT '[]',
  rewards_claimed JSONB DEFAULT '[]',
  rank INTEGER
);
CREATE INDEX IF NOT EXISTS user_seasonal_progress_user_idx ON user_seasonal_progress(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_seasonal_progress_unique ON user_seasonal_progress(user_id, event_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 17. FLASHCARDS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS flashcard_decks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'General',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS flashcard_decks_user_idx ON flashcard_decks(user_id);

CREATE TABLE IF NOT EXISTS flashcards (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  box INTEGER NOT NULL DEFAULT 1,
  next_review_at TIMESTAMP NOT NULL DEFAULT NOW(),
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS flashcards_deck_idx ON flashcards(deck_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 18. PREMIUM ECONOMY (TOKENS, PLANS, ENTITLEMENTS)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS token_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  source TEXT NOT NULL,
  related_entity_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  balance_after INTEGER NOT NULL,
  admin_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS token_ledger_user_idx ON token_ledger(user_id);
CREATE INDEX IF NOT EXISTS token_ledger_user_created_idx ON token_ledger(user_id, created_at);
CREATE INDEX IF NOT EXISTS token_ledger_source_idx ON token_ledger(source);
CREATE INDEX IF NOT EXISTS token_ledger_type_idx ON token_ledger(transaction_type);

CREATE TABLE IF NOT EXISTS premium_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  activated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  coins_cost INTEGER DEFAULT 9000,
  benefits JSONB DEFAULT '["exclusive_pets","premium_loot_boxes","premium_themes","xp_multiplier","coin_multiplier","premium_analytics","profile_badge","premium_battle_pass"]',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS premium_subscriptions_user_idx ON premium_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS premium_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  duration_days INTEGER NOT NULL,
  token_cost INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  benefits JSONB DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS premium_entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT REFERENCES premium_plans(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMP NOT NULL,
  token_cost INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL UNIQUE,
  granted_by_admin_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  admin_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS premium_entitlements_user_idx ON premium_entitlements(user_id);
CREATE INDEX IF NOT EXISTS premium_entitlements_user_status_idx ON premium_entitlements(user_id, status);
CREATE INDEX IF NOT EXISTS premium_entitlements_ends_idx ON premium_entitlements(ends_at);

-- ────────────────────────────────────────────────────────────────────────────
-- 19. PREMIUM TOKEN ECONOMY TABLES
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pet_catalog (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'common',
  category TEXT NOT NULL DEFAULT 'starter',
  thumbnail_url TEXT,
  model_url TEXT,
  fallback_image_url TEXT,
  animations JSONB DEFAULT '{}',
  unlock_source TEXT NOT NULL DEFAULT 'starter',
  token_cost INTEGER DEFAULT 0,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  is_seasonal BOOLEAN NOT NULL DEFAULT FALSE,
  seasonal_event_id TEXT,
  available_from TIMESTAMP,
  available_until TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  max_level INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pet_catalog_rarity_idx ON pet_catalog(rarity);
CREATE INDEX IF NOT EXISTS pet_catalog_category_idx ON pet_catalog(category);
CREATE INDEX IF NOT EXISTS pet_catalog_active_idx ON pet_catalog(is_active);

CREATE TABLE IF NOT EXISTS user_pet_inventory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_id TEXT NOT NULL REFERENCES pet_catalog(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  bond_xp INTEGER NOT NULL DEFAULT 0,
  nickname TEXT,
  mood TEXT NOT NULL DEFAULT 'happy',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  acquired_from TEXT NOT NULL DEFAULT 'starter',
  accessories JSONB DEFAULT '[]',
  color_variant TEXT DEFAULT 'default',
  acquired_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_pet_inventory_user_idx ON user_pet_inventory(user_id);
CREATE INDEX IF NOT EXISTS user_pet_inventory_user_active_idx ON user_pet_inventory(user_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS user_pet_inventory_user_pet_unique ON user_pet_inventory(user_id, pet_id);

CREATE TABLE IF NOT EXISTS battle_pass_claims (
  id TEXT PRIMARY KEY,
  battle_pass_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier INTEGER NOT NULL,
  reward_id TEXT NOT NULL,
  is_premium_reward BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS battle_pass_claims_user_idx ON battle_pass_claims(user_id);
CREATE INDEX IF NOT EXISTS battle_pass_claims_pass_idx ON battle_pass_claims(battle_pass_id);
CREATE UNIQUE INDEX IF NOT EXISTS battle_pass_claims_unique ON battle_pass_claims(battle_pass_id, user_id, tier, reward_id);

CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  rollout_percentage INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS feature_flags_enabled_idx ON feature_flags(enabled);

CREATE TABLE IF NOT EXISTS cosmetic_inventory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cosmetic_id TEXT NOT NULL,
  type TEXT NOT NULL,
  equipped BOOLEAN NOT NULL DEFAULT FALSE,
  acquired_from TEXT NOT NULL DEFAULT 'starter',
  acquired_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cosmetic_inventory_user_idx ON cosmetic_inventory(user_id);
CREATE INDEX IF NOT EXISTS cosmetic_inventory_user_type_idx ON cosmetic_inventory(user_id, type);

CREATE TABLE IF NOT EXISTS quest_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  target INTEGER NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  claimed BOOLEAN NOT NULL DEFAULT FALSE,
  period TEXT NOT NULL,
  claimed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quest_progress_user_idx ON quest_progress(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS quest_progress_unique ON quest_progress(user_id, quest_id, period);

CREATE TABLE IF NOT EXISTS token_earning_rules (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  daily_limit INTEGER,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_catalog (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  fallback_url TEXT,
  size_bytes INTEGER,
  mime_type TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS asset_catalog_type_idx ON asset_catalog(type);

-- ────────────────────────────────────────────────────────────────────────────
-- 20. USER PROFILE EXTRAS & WRAPPED
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profile_extras (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  banner_url TEXT,
  banner_gradient TEXT,
  social_links JSONB DEFAULT '{}',
  featured_post_ids JSONB DEFAULT '[]',
  pinned_badge_ids JSONB DEFAULT '[]',
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  custom_status TEXT,
  status_emoji TEXT,
  creator_tier TEXT NOT NULL DEFAULT 'learner',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wrapped_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS wrapped_user_year_unique ON wrapped_snapshots(user_id, year);

CREATE TABLE IF NOT EXISTS app_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL,
  message TEXT,
  category TEXT DEFAULT 'general',
  session_count INTEGER DEFAULT 0,
  user_level INTEGER DEFAULT 1,
  device TEXT,
  app_version TEXT DEFAULT '1.0',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS app_feedback_user_idx ON app_feedback(user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 21. SITE SETTINGS & PLATFORM META
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message TEXT,
  announcement_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  announcement_title TEXT,
  announcement_text TEXT,
  announcement_emoji TEXT,
  branding_name TEXT NOT NULL DEFAULT 'FocusArx',
  branding_tagline TEXT,
  hero_title TEXT,
  hero_subtitle TEXT,
  hero_cta_text TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_meta (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 22. ANALYTICS (WEB)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  visit_count INTEGER NOT NULL DEFAULT 0,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX IF NOT EXISTS visitors_visitor_id_idx ON visitors(visitor_id);
CREATE INDEX IF NOT EXISTS visitors_last_seen_idx ON visitors(last_seen);
CREATE INDEX IF NOT EXISTS visitors_user_id_idx ON visitors(user_id);

CREATE TABLE IF NOT EXISTS analytics_sessions (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_start TIMESTAMP NOT NULL DEFAULT NOW(),
  session_end TIMESTAMP,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  page_views INTEGER NOT NULL DEFAULT 0,
  focus_sessions_started INTEGER NOT NULL DEFAULT 0,
  tasks_created INTEGER NOT NULL DEFAULT 0,
  roadmaps_generated INTEGER NOT NULL DEFAULT 0,
  ai_features_used INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS analytics_sessions_visitor_id_idx ON analytics_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS analytics_sessions_last_activity_idx ON analytics_sessions(last_activity_at);

CREATE TABLE IF NOT EXISTS page_views (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  page TEXT NOT NULL,
  viewed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS page_views_visitor_id_idx ON page_views(visitor_id);
CREATE INDEX IF NOT EXISTS page_views_session_id_idx ON page_views(session_id);
CREATE INDEX IF NOT EXISTS page_views_viewed_at_idx ON page_views(viewed_at);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_event_id_idx ON analytics_events(event_id);
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS analytics_events_visitor_id_idx ON analytics_events(visitor_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 23. PLATFORM TABLES (AI, DROPS, SQL LOG, BOTS)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bot_pending_replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  bot_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id TEXT,
  due_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS bot_pending_replies_due_idx ON bot_pending_replies(status, due_at);
CREATE INDEX IF NOT EXISTS bot_pending_replies_post_idx ON bot_pending_replies(post_id);

CREATE TABLE IF NOT EXISTS admin_drops (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  payload JSONB,
  pool_total INTEGER NOT NULL DEFAULT 0,
  pool_claimed INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_via TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP,
  cancelled_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS admin_drops_window_idx ON admin_drops(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS admin_drops_active_idx ON admin_drops(is_active);

CREATE TABLE IF NOT EXISTS admin_drop_claims (
  id TEXT PRIMARY KEY,
  drop_id TEXT NOT NULL REFERENCES admin_drops(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_coins INTEGER NOT NULL DEFAULT 0,
  reward_xp INTEGER NOT NULL DEFAULT 0,
  item_granted TEXT,
  claimed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_drop_claims_drop_user_unique ON admin_drop_claims(drop_id, user_id);
CREATE INDEX IF NOT EXISTS admin_drop_claims_drop_idx ON admin_drop_claims(drop_id);
CREATE INDEX IF NOT EXISTS admin_drop_claims_user_idx ON admin_drop_claims(user_id);

CREATE TABLE IF NOT EXISTS admin_sql_log (
  id TEXT PRIMARY KEY,
  admin_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  sql TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'write',
  rows_affected INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT,
  branch_name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_sql_log_created_idx ON admin_sql_log(created_at);

CREATE TABLE IF NOT EXISTS ai_call_log (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  purpose TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_call_log_created_idx ON ai_call_log(created_at);
CREATE INDEX IF NOT EXISTS ai_call_log_purpose_idx ON ai_call_log(purpose, created_at);
CREATE INDEX IF NOT EXISTS ai_call_log_user_purpose_idx ON ai_call_log(user_id, purpose, created_at);

CREATE TABLE IF NOT EXISTS ai_budget_state (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'gemini',
  day TEXT NOT NULL,
  calls_used INTEGER NOT NULL DEFAULT 0,
  cap INTEGER NOT NULL DEFAULT 1500,
  cool_until TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_budget_state_provider_day_unique ON ai_budget_state(provider, day);

CREATE TABLE IF NOT EXISTS ai_ideas (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'growth',
  effort TEXT NOT NULL DEFAULT 'medium',
  impact TEXT NOT NULL DEFAULT 'medium',
  source TEXT NOT NULL DEFAULT 'gemini',
  status TEXT NOT NULL DEFAULT 'backlog',
  promoted_to_task TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_ideas_status_idx ON ai_ideas(status, created_at);

CREATE TABLE IF NOT EXISTS ai_briefings (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'daily',
  data JSONB NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  emailed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_briefings_day_kind_unique ON ai_briefings(day, kind);

CREATE TABLE IF NOT EXISTS ai_action_audit (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  actor_role TEXT NOT NULL DEFAULT 'system',
  model TEXT,
  action TEXT NOT NULL,
  payload JSONB,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  outcome TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_action_audit_created_idx ON ai_action_audit(created_at);
CREATE INDEX IF NOT EXISTS ai_action_audit_action_idx ON ai_action_audit(action);

-- ────────────────────────────────────────────────────────────────────────────
-- 24. GAMIFICATION EXTENSIONS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS battle_passes (
  id TEXT PRIMARY KEY,
  season TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS battle_pass_rewards (
  id TEXT PRIMARY KEY,
  battle_pass_id TEXT NOT NULL REFERENCES battle_passes(id) ON DELETE CASCADE,
  tier INTEGER NOT NULL,
  type TEXT NOT NULL,
  value JSONB,
  required_xp INTEGER NOT NULL,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS user_battle_pass_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  battle_pass_id TEXT NOT NULL REFERENCES battle_passes(id) ON DELETE CASCADE,
  current_xp INTEGER NOT NULL DEFAULT 0,
  current_tier INTEGER NOT NULL DEFAULT 0,
  claimed_rewards JSONB DEFAULT '[]',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_battle_pass_user_pass_idx ON user_battle_pass_progress(user_id, battle_pass_id);

CREATE TABLE IF NOT EXISTS study_buddies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buddy_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS study_buddies_user_buddy_idx ON study_buddies(user_id, buddy_id);

CREATE TABLE IF NOT EXISTS shared_goals (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  creator_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  target_value INTEGER NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  deadline TIMESTAMP,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shared_goals_group_idx ON shared_goals(group_id);

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  category TEXT NOT NULL,
  scope TEXT DEFAULT 'global',
  group_id TEXT,
  data JSONB NOT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS leaderboard_snapshots_period_category_idx ON leaderboard_snapshots(period, category);

-- ────────────────────────────────────────────────────────────────────────────
-- 25. GROUP EXTENSIONS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_invitations (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  inviter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email TEXT,
  invitee_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS group_invitations_group_idx ON group_invitations(group_id);

CREATE TABLE IF NOT EXISTS group_audit_logs (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS group_audit_logs_group_idx ON group_audit_logs(group_id);

CREATE TABLE IF NOT EXISTS group_challenges (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_value INTEGER NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'sessions',
  xp_reward INTEGER NOT NULL DEFAULT 500,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS group_challenges_group_idx ON group_challenges(group_id);

CREATE TABLE IF NOT EXISTS group_challenge_progress (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS group_challenge_progress_chal_user_idx ON group_challenge_progress(challenge_id, user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 26. AUDIT LOG (ADMIN)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
