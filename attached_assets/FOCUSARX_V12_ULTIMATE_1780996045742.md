# ╔══════════════════════════════════════════════════════════════╗
# ║     FOCUSARX — ULTIMATE MASTER PROMPT V12.0                 ║
# ║     "OBSESSION ENGINE" — BUILD THE WORLD'S MOST             ║
# ║     ADDICTIVE FOCUS + PRODUCTIVITY PLATFORM                 ║
# ╚══════════════════════════════════════════════════════════════╝

## WHO YOU ARE

You are an elite engineering + product team with full ownership of FocusArx. Your combined roles:

- **Principal Software Architect** — owns system design, data flow, scalability
- **Staff Frontend Engineer** — owns every pixel, every animation, every interaction
- **Staff Backend Engineer** — owns API design, performance, reliability
- **Principal UX Designer** — owns user journeys, delight, emotional design
- **Principal Gamification Engineer** — owns the reward loop, retention mechanics
- **Principal Retention Engineer** — owns every DAU/MAU lever
- **Principal Database Architect** — owns schema, indexing, query performance
- **Principal Growth Engineer** — owns virality, referrals, social sharing

You think like the founder, CTO, and head of design simultaneously. Your north star: **build the app users can't stop thinking about**.

Inspiration: Duolingo's daily habits × Discord's community × Notion's power × Strava's social proof × Spotify's identity (Wrapped) × Forest's emotional connection.

---

## ABSOLUTE CONSTRAINTS — READ BEFORE TOUCHING ANYTHING

```
DO NOT modify: Timer.tsx · usePomodoro.ts · useSessionPersistence.ts · auth.ts
DO NOT break existing working endpoints
DO NOT introduce any TypeScript `any` types
DO NOT leave TODO comments or stub implementations
DO run after schema changes: pnpm --filter @workspace/db run push
DO run after OpenAPI changes: pnpm --filter @workspace/api-spec run codegen
```

**Tech stack (do not deviate):**
- Frontend: React 19 · Vite · Tailwind CSS v4 · Framer Motion · TanStack Query · Radix UI · Wouter
- Backend: Express 5 · TypeScript strict · Drizzle ORM · Neon PostgreSQL · Pino logging
- AI: Groq Llama (coach) · Gemini 2.5 Flash (roadmap) — both with graceful fallbacks
- CSS theme: `--forge-violet: #7C3AED` · `--forge-teal: #06D6A0` · `--forge-gold: #FFB800` · `--background: #0A0F1E`

**Project paths:**
- Frontend: `artifacts/focusarx/src/`
- Backend: `artifacts/api-server/src/`
- DB schema: `lib/db/src/schema/`
- Routes registry: `artifacts/api-server/src/routes/index.ts`
- App router: `artifacts/focusarx/src/App.tsx`

---

## ═══════════════════════════════════════
## PHASE 0 — CRITICAL DATABASE SURGERY
## (Run first. Everything else depends on this.)
## ═══════════════════════════════════════

### 0.1 — Eliminate the Dual Auth Corruption

The DB has both `users` (custom JWT) and `user` (dead Better Auth remnant). This splits data and breaks joins.

```sql
-- Drop Better Auth ghost tables
DROP TABLE IF EXISTS "user" CASCADE;
DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "verification" CASCADE;
```

Confirm every FK in `lib/db/src/schema/` references `users` table. Fix any that reference the dead `user` table.

### 0.2 — Fix the NULL focus_score Plague

38 focus sessions exist with `focus_score = NULL`. Every leaderboard, DNA calculation, and productivity score is broken.

**Backfill:**
```sql
UPDATE focus_sessions 
SET focus_score = GREATEST(10, 
  100 - (COALESCE(distraction_count, 0) * 8) + 
  CASE WHEN duration_min >= 25 THEN 10 ELSE 0 END
)
WHERE focus_score IS NULL;
```

**Fix forward** in `artifacts/api-server/src/routes/sessions.ts` — on every `POST /api/sessions` (completion), calculate before INSERT:
```typescript
const focusScore = Math.max(10, Math.round(
  100
  - (distractionCount * 8)
  + (completionRate >= 1.0 ? 15 : completionRate >= 0.8 ? 5 : 0)
  + (durationMin >= 45 ? 5 : 0)
));
```

### 0.3 — Seed the Missions Table (Currently Empty)

`user_mission_progress` has 35 rows referencing missions that don't exist. The mission system is silently broken.

```sql
INSERT INTO missions (id, title, description, type, target, xp_reward, coin_reward, icon, period) VALUES
('m_first_session','First Step','Complete your first focus session','sessions_completed',1,100,50,'🎯','one_time'),
('m_5_sessions','Getting Momentum','Complete 5 focus sessions','sessions_completed',5,250,100,'⚡','weekly'),
('m_10_sessions','Focus Warrior','Complete 10 focus sessions','sessions_completed',10,500,200,'🔥','weekly'),
('m_25_sessions','Session Master','Complete 25 focus sessions','sessions_completed',25,1000,500,'👑','monthly'),
('m_50_sessions','Iron Will','Complete 50 focus sessions','sessions_completed',50,2500,1000,'💎','monthly'),
('m_1h_today','Hour of Power','Focus for 1 hour today','daily_minutes',60,150,75,'⏱','daily'),
('m_3h_today','Deep Work Day','Focus for 3 hours today','daily_minutes',180,350,150,'🧠','daily'),
('m_5h_week','Productive Week','Focus for 5 hours this week','weekly_minutes',300,500,200,'📈','weekly'),
('m_20h_month','Monthly Grind','Focus for 20 hours this month','monthly_minutes',1200,2000,800,'🏆','monthly'),
('m_3_streak','3-Day Streak','Study 3 days in a row','streak_days',3,200,100,'📅','weekly'),
('m_7_streak','Week Warrior','Study 7 days in a row','streak_days',7,500,250,'🗓','weekly'),
('m_30_streak','Monthly Legend','Study 30 days in a row','streak_days',30,2000,1000,'🌟','monthly'),
('m_first_habit','Habit Starter','Create your first habit','habits_created',1,100,50,'✅','one_time'),
('m_habit_7','Habit Week','Complete a habit 7 days in a row','habit_streak',7,300,150,'💪','weekly'),
('m_task_10','Task Crusher','Complete 10 tasks','tasks_completed',10,300,150,'📝','weekly'),
('m_task_50','Task Machine','Complete 50 tasks','tasks_completed',50,1500,600,'🤖','monthly'),
('m_social_post','Share Your Journey','Post to the social feed','posts_created',1,150,75,'📢','weekly'),
('m_make_friend','Friend Finder','Connect with a study buddy','friends_added',1,200,100,'🤝','one_time'),
('m_roadmap','Pathfinder','Generate an AI study roadmap','roadmaps_created',1,200,100,'🗺','one_time'),
('m_night_owl','Night Owl','Complete a session after 10 PM','night_sessions',1,300,150,'🦉','weekly'),
('m_early_bird','Early Bird','Complete a session before 7 AM','morning_sessions',1,300,150,'🐦','weekly'),
('m_perfect_week','Perfect Week','Focus every day for 7 days','perfect_week',1,1000,500,'⭐','weekly'),
('m_coin_hoard','Coin Collector','Earn 500 coins lifetime','coins_earned',500,250,0,'🪙','one_time'),
('m_group_join','Team Player','Join a study group','groups_joined',1,150,75,'👥','one_time'),
('m_deep_work','Deep Diver','Complete a 60+ min session','long_sessions',1,400,200,'🌊','weekly')
ON CONFLICT (id) DO NOTHING;
```

### 0.4 — Add All 17 Missing Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_coin_tx_user_created ON coin_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_habits_user_active ON habits(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_readiness_logs_user_date ON readiness_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_distraction_logs_user ON distraction_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_distraction_logs_session ON distraction_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_user ON roadmaps(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_break_free_streaks_user ON break_free_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_battle_pass_progress_user ON battle_pass_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mission_progress_user ON user_mission_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_date ON focus_sessions(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_level_rank ON users(level DESC, total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_streak ON users(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_id, due_date);
```

### 0.5 — Add Missing Columns to Existing Tables

```sql
-- Rank system on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS rank text DEFAULT 'beginner';
ALTER TABLE users ADD COLUMN IF NOT EXISTS rank_score integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_shields integer DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_status text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_status_emoji text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_expires_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamp DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS dream_type text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_focus_target_min integer DEFAULT 120;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country text;

-- Session mode on focus_sessions
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS mode text DEFAULT 'focus';
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS ai_insight text;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS coins_earned integer DEFAULT 0;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS loot_box_dropped boolean DEFAULT false;

-- Task improvements
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_minutes integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS xp_reward integer DEFAULT 25;
```

---

## ═══════════════════════════════════════
## PHASE 1 — NEW DATABASE TABLES
## ═══════════════════════════════════════

Create each as a separate file in `lib/db/src/schema/`. Export from `lib/db/src/schema/index.ts`. Run `pnpm --filter @workspace/db run push` once after all files are created.

### 1.1 `pets.ts`

```typescript
export const pets = pgTable('pets', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  species: text('species').notNull(), // 'owl'|'fox'|'dragon'|'robot'|'cat'|'phoenix'
  name: text('name').notNull().default('Buddy'),
  level: integer('level').notNull().default(1),
  xp: integer('xp').notNull().default(0),
  xpToNextLevel: integer('xp_to_next_level').notNull().default(100),
  evolution: integer('evolution').notNull().default(0), // 0=egg,1=baby,2=teen,3=adult,4=legendary
  mood: text('mood').notNull().default('happy'),
  hunger: integer('hunger').notNull().default(100), // 0-100, decreases over time
  happiness: integer('happiness').notNull().default(100),
  accessories: jsonb('accessories').$type<string[]>().default([]),
  specialtyBonus: text('specialty_bonus'), // e.g. 'late_night_xp_5pct'
  lastFedAt: timestamp('last_fed_at').defaultNow(),
  lastPlayedAt: timestamp('last_played_at'),
  totalSessionsWitnessed: integer('total_sessions_witnessed').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 1.2 `focus_city.ts`

```typescript
export const focusCities = pgTable('focus_cities', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  tier: text('tier').notNull().default('hamlet'), // 'hamlet'|'village'|'town'|'city'|'metropolis'|'civilization'
  tierName: text('tier_name').notNull().default('Study Hamlet'),
  population: integer('population').notNull().default(5),
  totalBuildings: integer('total_buildings').notNull().default(0),
  totalSessions: integer('total_sessions').notNull().default(0),
  unlockedDistricts: jsonb('unlocked_districts').$type<string[]>().default(['downtown']),
  buildings: jsonb('buildings').$type<Record<string, boolean>>().default({}),
  atmosphere: text('atmosphere').notNull().default('day'), // auto-set by server time
  weather: text('weather').notNull().default('clear'), // 'clear'|'cloudy'|'rain'|'snow'
  weatherUpdatedAt: timestamp('weather_updated_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cityBuildingDefinitions = pgTable('city_building_definitions', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  district: text('district').notNull(),
  category: text('category').notNull(),
  unlockLevel: integer('unlock_level').notNull().default(1),
  unlockSessions: integer('unlock_sessions').notNull().default(0),
  coinCost: integer('coin_cost').notNull().default(0),
  populationBonus: integer('population_bonus').notNull().default(10),
  xpBonusPerSession: integer('xp_bonus_per_session').notNull().default(0),
  coinBonusPerSession: integer('coin_bonus_per_session').notNull().default(0),
  icon: text('icon').notNull(),
  animationClass: text('animation_class').notNull().default('idle'),
  tier: text('tier').notNull().default('hamlet'),
  sortOrder: integer('sort_order').notNull().default(0),
});
```

### 1.3 `loot_boxes.ts`

```typescript
export const lootBoxTypes = pgTable('loot_box_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  rarity: text('rarity').notNull(), // 'common'|'rare'|'epic'|'legendary'
  coinCost: integer('coin_cost').notNull().default(0),
  sessionsRequired: integer('sessions_required').notNull().default(0),
  icon: text('icon').notNull(),
  glowColor: text('glow_color').notNull().default('#7C3AED'),
  possibleRewards: jsonb('possible_rewards').notNull().$type<LootBoxReward[]>(),
});

export const userLootBoxes = pgTable('user_loot_boxes', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  boxTypeId: text('box_type_id').notNull().references(() => lootBoxTypes.id),
  status: text('status').notNull().default('unopened'),
  rewardType: text('reward_type'),
  rewardValue: jsonb('reward_value'),
  earnedReason: text('earned_reason'), // 'session_10', 'mission_complete', 'daily_login'
  openedAt: timestamp('opened_at'),
  earnedAt: timestamp('earned_at').defaultNow().notNull(),
}, (t) => ({ userIdx: index('user_loot_boxes_user_idx').on(t.userId) }));
```

### 1.4 `seasonal_events.ts`

```typescript
export const seasonalEvents = pgTable('seasonal_events', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  theme: text('theme').notNull(),
  bannerColor: text('banner_color').notNull().default('#7C3AED'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  xpMultiplier: real('xp_multiplier').notNull().default(1.0),
  coinMultiplier: real('coin_multiplier').notNull().default(1.0),
  specialMissions: jsonb('special_missions').default([]),
  exclusiveRewards: jsonb('exclusive_rewards').default([]),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userSeasonalProgress = pgTable('user_seasonal_progress', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventId: text('event_id').notNull().references(() => seasonalEvents.id),
  points: integer('points').notNull().default(0),
  completedMissions: jsonb('completed_missions').$type<string[]>().default([]),
  rewardsClaimed: jsonb('rewards_claimed').$type<string[]>().default([]),
  rank: integer('rank'),
}, (t) => ({ unique: unique().on(t.userId, t.eventId) }));
```

### 1.5 `dreams.ts`

```typescript
export const userDreams = pgTable('user_dreams', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  dreamType: text('dream_type').notNull(),
  customDream: text('custom_dream'),
  targetDate: timestamp('target_date'),
  dailyHoursTarget: real('daily_hours_target').notNull().default(4.0),
  totalHoursLogged: real('total_hours_logged').notNull().default(0),
  totalHoursRequired: real('total_hours_required').notNull().default(1000),
  progressPercent: real('progress_percent').notNull().default(0),
  streakContribution: real('streak_contribution').notNull().default(0),
  milestones: jsonb('milestones').$type<DreamMilestone[]>().default([]),
  lastAiMessage: text('last_ai_message'),
  lastAiMessageAt: timestamp('last_ai_message_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 1.6 `focus_wrapped.ts`

```typescript
export const focusWrapped = pgTable('focus_wrapped', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  period: text('period').notNull(), // 'monthly'|'yearly'
  periodKey: text('period_key').notNull(), // '2025-06' or '2025'
  totalMinutes: integer('total_minutes').notNull().default(0),
  totalSessions: integer('total_sessions').notNull().default(0),
  tasksCompleted: integer('tasks_completed').notNull().default(0),
  xpGained: integer('xp_gained').notNull().default(0),
  coinsEarned: integer('coins_earned').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  bestDay: text('best_day'),
  bestDayMinutes: integer('best_day_minutes'),
  bestHour: integer('best_hour'),
  topSubject: text('top_subject'),
  topMode: text('top_mode'),
  badgesUnlocked: jsonb('badges_unlocked').$type<string[]>().default([]),
  levelsGained: integer('levels_gained').notNull().default(0),
  focusType: text('focus_type'),
  aiNarrative: text('ai_narrative'),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
}, (t) => ({ unique: uniqueIndex('wrapped_user_period_unique').on(t.userId, t.periodKey) }));
```

### 1.7 `marketplace.ts`

```typescript
export const marketplaceItems = pgTable('marketplace_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // 'avatar'|'pet_skin'|'city_skin'|'profile_frame'|'emote'|'effect'|'title_badge'|'theme'
  rarity: text('rarity').notNull().default('common'), // 'common'|'rare'|'epic'|'legendary'
  coinPrice: integer('coin_price').notNull().default(0),
  xpRequired: integer('xp_required').notNull().default(0),
  levelRequired: integer('level_required').notNull().default(1),
  icon: text('icon').notNull(),
  previewData: jsonb('preview_data'),
  tags: jsonb('tags').$type<string[]>().default([]),
  isLimited: boolean('is_limited').notNull().default(false),
  availableUntil: timestamp('available_until'),
  totalSupply: integer('total_supply'),
  soldCount: integer('sold_count').notNull().default(0),
  isNew: boolean('is_new').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userInventory = pgTable('user_inventory', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull().references(() => marketplaceItems.id),
  equipped: boolean('equipped').notNull().default(false),
  equippedSlot: text('equipped_slot'),
  purchasedAt: timestamp('purchased_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('inventory_user_idx').on(t.userId),
  unique: unique('inventory_unique_item').on(t.userId, t.itemId),
}));
```

### 1.8 `focus_dna.ts`

```typescript
export const focusDna = pgTable('focus_dna', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  deepFocusGene: integer('deep_focus_gene').notNull().default(0),      // % sessions >= 45min
  nightOwlGene: integer('night_owl_gene').notNull().default(0),        // % sessions after 9pm
  earlyRiserGene: integer('early_riser_gene').notNull().default(0),    // % sessions before 8am
  intensityGene: integer('intensity_gene').notNull().default(0),       // avg focus_score / 100
  consistencyGene: integer('consistency_gene').notNull().default(0),   // streak stability
  explorerGene: integer('explorer_gene').notNull().default(0),         // session mode variety
  focusType: text('focus_type'),     // e.g. "Night Intensity Scholar"
  dominantMode: text('dominant_mode'),
  dominantHour: integer('dominant_hour'),
  totalSessions: integer('total_sessions').notNull().default(0),
  lastEvolution: jsonb('last_evolution'), // diff from previous calculation
  calculatedAt: timestamp('calculated_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({ userIdx: index('focus_dna_user_idx').on(t.userId) }));
```

### 1.9 `daily_rewards.ts`

```typescript
export const dailyRewardClaims = pgTable('daily_reward_claims', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  claimedDate: text('claimed_date').notNull(), // YYYY-MM-DD
  dayNumber: integer('day_number').notNull(), // 1-7 in cycle
  coinsAwarded: integer('coins_awarded').notNull().default(0),
  xpAwarded: integer('xp_awarded').notNull().default(0),
  bonusReward: text('bonus_reward'),
  lootBoxAwarded: boolean('loot_box_awarded').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('daily_rewards_user_idx').on(t.userId),
  unique: unique('daily_rewards_unique_day').on(t.userId, t.claimedDate),
}));
```

### 1.10 `quests.ts`

```typescript
export const questDefinitions = pgTable('quest_definitions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  type: text('type').notNull(), // 'daily'|'weekly'|'monthly'
  difficulty: text('difficulty').notNull().default('easy'), // 'easy'|'medium'|'hard'
  target: integer('target').notNull(),
  metric: text('metric').notNull(),
  xpReward: integer('xp_reward').notNull().default(0),
  coinReward: integer('coin_reward').notNull().default(0),
  icon: text('icon').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  rotationWeight: integer('rotation_weight').notNull().default(10),
});

export const userQuestProgress = pgTable('user_quest_progress', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  questId: text('quest_id').notNull().references(() => questDefinitions.id),
  period: text('period').notNull(), // '2025-06-09' for daily, '2025-W23' for weekly
  current: integer('current').notNull().default(0),
  completed: boolean('completed').notNull().default(false),
  claimedAt: timestamp('claimed_at'),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
}, (t) => ({
  userPeriodIdx: index('quest_progress_user_period_idx').on(t.userId, t.period),
  unique: unique('quest_progress_unique').on(t.userId, t.questId, t.period),
}));
```

### 1.11 `streak_shields.ts`

```typescript
export const streakShieldUsage = pgTable('streak_shield_usage', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  usedDate: text('used_date').notNull(), // YYYY-MM-DD (the day that was protected)
  source: text('source').notNull(), // 'earned'|'purchased'|'gifted'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

---

## ═══════════════════════════════════════
## PHASE 2 — BACKEND: NEW ROUTES & SERVICES
## ═══════════════════════════════════════

Create each file. Register all in `artifacts/api-server/src/routes/index.ts`.

### 2.1 Session System 2.0 (`sessions.ts` — extend existing, don't rewrite)

**Session modes with XP multipliers:**
```typescript
export const SESSION_MODES = {
  focus:     { label: 'Deep Focus',    xpMult: 1.0, defaultMin: 25,  coinMult: 1.0 },
  deep_work: { label: 'Deep Work',     xpMult: 1.5, defaultMin: 90,  coinMult: 1.5 },
  sprint:    { label: 'Study Sprint',  xpMult: 1.2, defaultMin: 15,  coinMult: 1.0 },
  exam:      { label: 'Exam Mode',     xpMult: 2.0, defaultMin: 60,  coinMult: 2.0 },
  flow:      { label: 'Flow State',    xpMult: 1.8, defaultMin: 45,  coinMult: 1.5 },
  reading:   { label: 'Reading',       xpMult: 0.8, defaultMin: 30,  coinMult: 0.8 },
  coding:    { label: 'Coding',        xpMult: 1.3, defaultMin: 50,  coinMult: 1.2 },
  revision:  { label: 'Revision',      xpMult: 1.1, defaultMin: 20,  coinMult: 1.0 },
  custom:    { label: 'Custom',        xpMult: 1.0, defaultMin: 25,  coinMult: 1.0 },
} as const;
```

**On session complete, award (in order):**
1. XP = `Math.round(durationMin * 4 * modeXpMult * streakMult * eventMult)`
2. Coins = `Math.floor(durationMin / 5) * modeCoinMult`
3. Check rank advancement → emit `rank:upgrade` if changed
4. Pet XP += `Math.floor(durationMin * 0.5)`; check pet level up
5. Dream hours += `durationMin / 60`; recalculate dream progress %
6. City: `totalSessions++`; check tier advancement; check new building unlocks
7. Check loot box drop (every 10 sessions = common box, every 25 = rare box)
8. Update all relevant quest progress
9. Update all relevant mission progress
10. Generate AI insight (Groq) — non-blocking, fire and forget, store in session record
11. Run delight engine check (random bonus events)
12. Return full reward summary:

```typescript
type SessionRewardSummary = {
  xpEarned: number;
  coinsEarned: number;
  focusScore: number;
  levelUp: boolean | null; // { newLevel, newRank }
  badgesUnlocked: Badge[];
  missionProgress: { missionId: string; newValue: number; completed: boolean }[];
  questProgress: { questId: string; newValue: number; completed: boolean }[];
  lootBoxDropped: LootBox | null;
  petLevelUp: boolean;
  cityUpgrade: boolean;
  dreamProgress: { percent: number; message: string } | null;
  delightReward: DelightReward | null;
  aiInsight: string | null;
};
```

### 2.2 `routes/pets.ts`

```
GET    /api/pets              → get user's pet (or null if not chosen)
POST   /api/pets              → choose pet species (one-time)
PATCH  /api/pets/:id/name     → rename pet
POST   /api/pets/:id/feed     → feed pet (costs 10 coins, +15 happiness, +5 hunger)
POST   /api/pets/:id/play     → play with pet (cooldown: 1h, +20 happiness, +5 xp)
POST   /api/pets/:id/equip    → equip accessory from inventory
GET    /api/pets/:id/history  → pet evolution history
```

**Pet XP thresholds per level (level 1–50):** `xpRequired = level * 100`
**Evolution triggers:** Level 5 → Baby, Level 15 → Teen, Level 30 → Adult, Level 50 → Legendary

### 2.3 `routes/city.ts`

```
GET    /api/city              → get user's city + unlocked buildings
POST   /api/city/build/:slug  → purchase and build a building (costs coins)
GET    /api/city/buildings    → all building definitions with lock status
GET    /api/city/leaderboard  → top cities by population
```

**City tier thresholds (by total sessions):**
- Hamlet: 0 sessions · Village: 10 · Town: 25 · City: 50 · Metropolis: 100 · Civilization: 250

### 2.4 `routes/dreams.ts`

```
GET    /api/dreams            → get user's dream
POST   /api/dreams            → set dream (creates or replaces)
PATCH  /api/dreams            → update daily target, custom dream text
GET    /api/dreams/ai-message → get today's AI motivational message
GET    /api/dreams/milestones → list milestones with completion status
```

AI message prompt (Groq, cached daily per user):
```
You are a personal study coach for FocusArx.
User's dream: [dreamType]. Progress: [percent]%.
Daily target: [targetHours]h/day. Today so far: [todayHours]h.
Days until target date: [daysLeft].
Write ONE motivating message in 20 words or less. 
Be personal, specific to their dream. No generic advice.
```

### 2.5 `routes/daily-reward.ts`

```
GET    /api/daily-reward        → today's reward + claim status + 7-day calendar
POST   /api/daily-reward/claim  → claim today's reward (idempotent per day)
```

7-day reward cycle:
```typescript
const DAILY_REWARDS = [
  { day: 1, coins: 10,  xp: 25,  label: 'Day 1' },
  { day: 2, coins: 15,  xp: 30,  label: 'Day 2' },
  { day: 3, coins: 20,  xp: 50,  label: 'Day 3' },
  { day: 4, coins: 30,  xp: 50,  label: 'Day 4' },
  { day: 5, coins: 40,  xp: 75,  label: 'Day 5' },
  { day: 6, coins: 60,  xp: 100, label: 'Day 6' },
  { day: 7, coins: 100, xp: 200, label: 'Day 7 🎉', lootBox: 'common' },
];
```

On claim: award coins + XP, if day 7 drop a common loot box, reset cycle if user missed yesterday.

### 2.6 `routes/lootboxes.ts`

```
GET    /api/lootboxes           → user's unopened loot boxes + box type catalog
POST   /api/lootboxes/open/:id  → open a loot box (animated, returns reward)
POST   /api/lootboxes/purchase  → buy a loot box with coins
```

Reward tables by rarity:
```typescript
const REWARD_TABLES = {
  common: [
    { type: 'coins', value: 20, weight: 40 },
    { type: 'coins', value: 50, weight: 25 },
    { type: 'xp',    value: 100, weight: 25 },
    { type: 'streak_shield', value: 1, weight: 10 },
  ],
  rare: [
    { type: 'coins', value: 100, weight: 35 },
    { type: 'xp',    value: 300, weight: 30 },
    { type: 'streak_shield', value: 1, weight: 20 },
    { type: 'marketplace_item', category: 'emote', weight: 15 },
  ],
  epic: [
    { type: 'coins', value: 300, weight: 25 },
    { type: 'xp',    value: 750, weight: 25 },
    { type: 'xp_boost_2x_30min', value: 1, weight: 25 },
    { type: 'marketplace_item', category: 'profile_frame', weight: 15 },
    { type: 'marketplace_item', category: 'pet_skin', weight: 10 },
  ],
  legendary: [
    { type: 'coins', value: 1000, weight: 20 },
    { type: 'xp',    value: 2000, weight: 20 },
    { type: 'marketplace_item', category: 'avatar', rarity: 'legendary', weight: 30 },
    { type: 'streak_shield', value: 3, weight: 20 },
    { type: 'battle_pass_tiers', value: 5, weight: 10 },
  ],
};
```

### 2.7 `routes/marketplace.ts`

```
GET    /api/marketplace         → all items with user's ownership status
GET    /api/marketplace/:id     → item detail
POST   /api/marketplace/buy     → purchase item (deduct coins, add to inventory)
POST   /api/marketplace/equip   → equip item from inventory
GET    /api/inventory           → user's owned items
```

### 2.8 `routes/dna.ts`

```
GET    /api/dna                    → current user's DNA
GET    /api/dna/:userId            → public DNA (for profile page)
POST   /api/dna/recalculate        → trigger DNA recalculation (auto-called after sessions)
GET    /api/dna/matches            → find users with similar DNA (study buddy suggestions)
```

DNA calculation in `artifacts/api-server/src/lib/dnaEngine.ts`:
```typescript
export async function calculateFocusDNA(userId: string): Promise<FocusDNA> {
  const sessions = await db.select().from(focusSessions)
    .where(eq(focusSessions.userId, userId))
    .orderBy(desc(focusSessions.completedAt));

  if (sessions.length === 0) return null;

  const total = sessions.length;

  const deepFocusGene = Math.round(
    sessions.filter(s => s.durationMin >= 45).length / total * 100
  );
  const nightOwlGene = Math.round(
    sessions.filter(s => new Date(s.completedAt!).getHours() >= 21).length / total * 100
  );
  const earlyRiserGene = Math.round(
    sessions.filter(s => new Date(s.completedAt!).getHours() <= 8).length / total * 100
  );
  const avgScore = sessions.reduce((a, s) => a + (s.focusScore ?? 70), 0) / total;
  const intensityGene = Math.round(avgScore);
  const consistencyGene = Math.round(calculateConsistencyScore(sessions) * 100);
  const modesUsed = new Set(sessions.map(s => s.mode ?? 'focus')).size;
  const explorerGene = Math.round(Math.min(modesUsed / 9, 1) * 100);

  const focusType = deriveFocusType({
    deepFocusGene, nightOwlGene, earlyRiserGene,
    intensityGene, consistencyGene, explorerGene
  });

  const hours = sessions.reduce((s, r) => {
    const h = new Date(r.completedAt!).getHours();
    s[h] = (s[h] ?? 0) + 1;
    return s;
  }, {} as Record<number, number>);
  const dominantHour = +Object.entries(hours).sort((a,b) => b[1]-a[1])[0]?.[0];

  return { deepFocusGene, nightOwlGene, earlyRiserGene, intensityGene,
           consistencyGene, explorerGene, focusType, dominantHour,
           totalSessions: total, dominantMode: getMostUsedMode(sessions) };
}

function deriveFocusType(genes: DNAGenes): string {
  const types: string[] = [];
  if (genes.nightOwlGene > 40) types.push('Night');
  else if (genes.earlyRiserGene > 30) types.push('Dawn');
  if (genes.deepFocusGene > 50) types.push('Deep');
  else if (genes.explorerGene > 60) types.push('Versatile');
  if (genes.intensityGene > 80) types.push('High-Intensity');
  else if (genes.consistencyGene > 75) types.push('Consistent');
  if (types.length === 0) types.push('Balanced');
  types.push('Scholar');
  return types.join(' ');
}
```

### 2.9 `routes/wrapped.ts`

```
GET    /api/wrapped/:period      → get wrapped for 'monthly' or 'yearly'
POST   /api/wrapped/generate     → generate/regenerate wrapped for current period
GET    /api/wrapped/history      → list all past wrapped periods
```

AI narrative generation (Gemini, cached per period):
```
Generate a 2-sentence personal "year/month in review" for a focus app user.
Their stats: [totalHours] hours focused, [sessions] sessions, [streak] day streak,
best subject: [subject], level reached: [level], achievements unlocked: [count].
Be inspiring and personal. Reference specific numbers. Max 40 words total.
```

### 2.10 `routes/quests.ts`

```
GET    /api/quests              → today's + this week's quests with progress
POST   /api/quests/:id/claim    → claim completed quest reward
```

Quest rotation: Assign 3 daily quests per user by seeding with `userId + date`. Same user always gets the same quests for a given day (deterministic, no DB write until claimed).

### 2.11 `routes/delight.ts` (internal service, no public route)

Create `artifacts/api-server/src/lib/delightEngine.ts`:

```typescript
type DelightReward =
  | { type: 'coin_bonus'; amount: number; message: string }
  | { type: 'xp_boost'; multiplier: number; durationMin: number; message: string }
  | { type: 'loot_box'; rarity: string; message: string }
  | { type: 'motivational'; message: string };

const DELIGHT_EVENTS: { chance: number; fn: () => DelightReward }[] = [
  { chance: 0.03, fn: () => ({ type: 'coin_bonus', amount: 50, message: '🎉 Lucky Find! +50 bonus coins!' }) },
  { chance: 0.02, fn: () => ({ type: 'xp_boost', multiplier: 2, durationMin: 30, message: '⚡ 2× XP activated for 30 minutes!' }) },
  { chance: 0.015, fn: () => ({ type: 'loot_box', rarity: 'rare', message: '📦 A Rare Box just dropped for you!' }) },
  { chance: 0.001, fn: () => ({ type: 'loot_box', rarity: 'legendary', message: '👑 LEGENDARY DROP — You are unstoppable!' }) },
  { chance: 0.12, fn: () => ({ type: 'motivational', message: randomMotivationalMessage() }) },
];

export function runDelightCheck(sessionData: SessionData): DelightReward | null {
  for (const event of DELIGHT_EVENTS) {
    if (Math.random() < event.chance) return event.fn();
  }
  return null;
}
```

### 2.12 `routes/referrals.ts`

```
GET    /api/referrals           → user's referral code + link + stats
GET    /api/referrals/stats     → referred count, pending rewards, earned rewards
POST   /api/referrals/apply     → apply a referral code at registration
```

On successful referral (referred user completes first session):
- Referrer: +500 XP, +100 coins, notification
- Referred: +250 XP, +50 coins, "Welcome bonus" notification

Generate referral codes on user creation: `Math.random().toString(36).substring(2, 8).toUpperCase()`

### 2.13 `routes/presence.ts`

```
POST   /api/presence/online     → mark user online (called on app focus)
POST   /api/presence/offline    → mark user offline (called on app blur)
POST   /api/presence/status     → set custom status text + emoji
GET    /api/presence/friends    → friends' online status
```

---

## ═══════════════════════════════════════
## PHASE 3 — FRONTEND: DESIGN SYSTEM
## ═══════════════════════════════════════

### 3.1 Animation Library

Create `artifacts/focusarx/src/lib/animations.ts`:

```typescript
import { Variants } from 'framer-motion';

export const PAGE: Variants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -12, transition: { duration: 0.18 } },
};

export const CARD: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
};

export const STAGGER: Variants = {
  animate: { transition: { staggerChildren: 0.07 } },
};

export const SLIDE_UP: Variants = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export const POP: Variants = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 500, damping: 22 } },
};

export const SHAKE: Variants = {
  animate: { x: [0, -8, 8, -6, 6, -3, 3, 0], transition: { duration: 0.5 } },
};

export const FLOAT = {
  animate: {
    y: [0, -8, 0],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
};

export const GLOW_PULSE = {
  animate: {
    boxShadow: [
      '0 0 0px rgba(124,58,237,0)',
      '0 0 20px rgba(124,58,237,0.6)',
      '0 0 0px rgba(124,58,237,0)',
    ],
    transition: { duration: 2, repeat: Infinity },
  },
};
```

### 3.2 Design Tokens (add to Tailwind config)

Add to CSS variables in `artifacts/focusarx/src/index.css`:

```css
:root {
  /* Rank colors */
  --rank-beginner: #6B7280;
  --rank-apprentice: #3B82F6;
  --rank-scholar: #8B5CF6;
  --rank-expert: #F59E0B;
  --rank-master: #EF4444;
  --rank-grandmaster: #EC4899;
  --rank-legend: #FFD700;

  /* Rarity colors */
  --rarity-common: #9CA3AF;
  --rarity-rare: #3B82F6;
  --rarity-epic: #8B5CF6;
  --rarity-legendary: #F59E0B;

  /* Session mode colors */
  --mode-focus: #7C3AED;
  --mode-deep_work: #1E40AF;
  --mode-sprint: #DC2626;
  --mode-exam: #D97706;
  --mode-flow: #059669;
  --mode-reading: #7C3AED;
  --mode-coding: #2563EB;
  --mode-revision: #9333EA;

  /* Glow effects */
  --glow-violet: 0 0 20px rgba(124, 58, 237, 0.4);
  --glow-teal: 0 0 20px rgba(6, 214, 160, 0.4);
  --glow-gold: 0 0 20px rgba(255, 184, 0, 0.4);
}
```

### 3.3 Reusable Components to Build

Create each in `artifacts/focusarx/src/components/ui/`:

**`XPBar.tsx`** — animated XP bar with level badge, fills on XP gain:
```tsx
// Props: currentXP, maxXP, level, animated?: boolean
// Shows: level badge left, progress bar center, "X XP to next level" right
// On XP gain: bar fills with shimmer animation, then settles
```

**`CoinCounter.tsx`** — coin balance display:
```tsx
// Props: amount, size?: 'sm'|'md'|'lg', animated?: boolean
// Shows: 🪙 icon + formatted number
// On increase: number counts up with golden flash
// On spend: number counts down with red flash
```

**`RankBadge.tsx`** — user rank display:
```tsx
// Props: rank, showLabel?: boolean, size?: 'sm'|'md'|'lg'
// Shows: rank icon + label, colored by rank
// On rank up: springs in with GLOW_PULSE animation
```

**`StreakFlame.tsx`** — streak display:
```tsx
// Props: streak, size?: 'sm'|'md'|'lg'
// Shows: 🔥 + number
// On increment: flame grows 1.5× then settles with spring
// At 7+ days: golden glow
// At 30+ days: rainbow glow
```

**`SessionModeSelector.tsx`** — pill buttons for session mode:
```tsx
// Props: selected, onChange, disabled?
// Shows: 3×3 grid of mode pills with mode color accent
// Selected mode: filled bg, scale 1.05
// Hover: subtle glow in mode color
```

**`Skeleton.tsx`** — loading skeletons:
```tsx
export const Skeleton = ({ className }) => (
  <div className={cn('animate-pulse rounded-xl bg-white/5', className)} />
);
export const StatCardSkeleton = () => (/* 4-column grid of stat card skeletons */);
export const SessionCardSkeleton = () => (/* session history card skeleton */);
export const ProfileSkeleton = () => (/* full profile page skeleton */);
export const LeaderboardRowSkeleton = () => (/* leaderboard row skeleton */);
export const MissionCardSkeleton = () => (/* mission card skeleton */);
```

**`EmptyState.tsx`** — empty state component:
```tsx
// Props: icon, title, description, action?: { label, onClick }
// Centered layout, subtle icon, title, description, optional CTA button
// Uses SLIDE_UP animation on mount
```

**`RewardToast.tsx`** — floating reward notification:
```tsx
// Appears bottom-center on: XP gain, coin earn, badge unlock, delight reward
// Types: xp (purple flash), coins (gold), badge (rainbow), delight (special)
// Floats up from bottom, auto-dismisses after 3s
// Multiple rewards queue and stagger
```

**`AchievementModal.tsx`** — full-screen achievement unlock:
```tsx
// Triggered by: badge unlocks, level ups, rank advancements
// Background blurs + darkens
// Badge/icon zooms in with POP spring animation
// Particle burst: 16 particles radiate outward (CSS keyframes)
// Title types in character by character
// "Share" + "Continue" buttons
// Auto-dismisses after 6s or on click
```

**`LevelUpScreen.tsx`** — dramatic level up overlay:
```tsx
// Full-screen takeover on level change
// New level number drops from top (physics spring)
// "LEVEL UP" text glows in forge-violet
// 50 confetti pieces (CSS, varied colors and sizes)
// New perks/unlocks listed below with stagger animation
// Rank change section (if applicable)
// "Awesome!" dismiss button
```

**`PetWidget.tsx`** — pet companion mini widget (for dashboard):
```tsx
// Shows pet emoji/icon with idle animation (FLOAT)
// Mood indicator under pet
// On hover: shows pet name + level
// On click: navigate to /pets
// Size: 80×80px, floats in dashboard hero corner
```

---

## ═══════════════════════════════════════
## PHASE 4 — FRONTEND: ALL NEW PAGES
## ═══════════════════════════════════════

### 4.1 Dashboard Redesign (`/` — artifacts/focusarx/src/pages/dashboard.tsx)

**Complete redesign. Not a patch — a full rewrite.**

```
Layout (desktop: 3 columns, mobile: single column):

ROW 1 — HERO (full width)
┌──────────────────────────────────────────────┐
│ "Good [morning/afternoon/evening], [Name] 👋" │
│ Dream progress bar (if dream set)             │
│ "You're X% closer to [Dream]"                │
│ Today's stats row:                           │
│   [🕐 Xh Xm] [🔥 X day] [⚡ X XP today]      │
│                              [Pet widget →]  │
└──────────────────────────────────────────────┘

ROW 2 — STATS (4 cards)
[Sessions Today] [Weekly XP] [Streak] [Rank]

ROW 3 — MAIN CONTENT (2/3) + SIDEBAR (1/3)
Main:                         Sidebar:
- Active Quests               - Daily Reward (claim)
- Recent Sessions             - Friends Online
- Mission Progress            - AI Insight of Day
- Activity Heatmap            - Top Leaderboard
```

Every section wrapped in `<motion.div {...PAGE}>`. Cards in stagger grid.

**Time-based greeting:**
```typescript
const hour = new Date().getHours();
const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
const emoji = hour < 7 ? '🌙' : hour < 12 ? '☀️' : hour < 18 ? '🌤️' : '🌙';
```

**Daily reward banner:** If not claimed today, show pulsing "🎁 Claim your daily reward!" CTA at top of dashboard. On claim, opens mini modal with animation.

### 4.2 `/pets` — Pet Companion Page

**Structure:**
```
[Pet display — animated center stage]
[Name + level + evolution badge]
[XP bar to next level]
[Mood bar + hunger bar]
[Action buttons: Feed | Play | Train]

If no pet chosen:
[Species selector grid — 6 cards]
[Each card: emoji, species name, specialty bonus description]
[Hover: card lifts + glow]
[Select: card pops in, confetti, navigate to pet page]

Evolution path (visual timeline):
Egg → Baby → Teen → Adult → Legendary
[Current stage glows, future dimmed]

Accessories section:
[Grid of owned accessories]
[Equip on click — pet updates visually]
[Locked accessories: padlock + unlock requirement]

Stats panel:
[Total sessions witnessed]
[XP to next level]
[Bond level (based on interactions)]
```

**Pet animation:** Each species has a unique CSS keyframe animation:
- Owl: head rotation + blink every 4s
- Fox: tail wag every 3s
- Dragon: wing flap every 5s
- Robot: LED pulse every 2s
- Cat: ear twitch every 6s
- Phoenix: flame flicker every 1.5s

### 4.3 `/city` — Focus City Page

**Structure:**
```
[Full-width cityscape SVG — animated]
[City name + tier badge]
[Day/night gradient background (auto-changes by real time)]

Cityscape elements (all CSS animated):
- Buildings at different heights (z-index layers)
- Smoke particles from chimneys (CSS @keyframes, floatUp)
- Birds crossing sky every 30s (CSS transform: translateX)
- Clouds drifting left (CSS animation: infinite linear)
- Stars twinkling at night (CSS opacity pulse)
- Moon/sun rising (CSS transform: based on time)

[Progress bar: X sessions → next tier]
["Your city grows with every study session"]

Buildings grid below:
[Unlocked buildings: colored cards with building info + bonuses]
[Locked buildings: greyed out with requirement text]
[Each building has population bonus + XP bonus tag]

City stats:
Population · Total Buildings · Sessions Invested · Tier
```

**City tiers and what changes:**
- Hamlet: 3 buildings visible, small town aesthetic
- Village: 6 buildings, more NPC activity
- Town: 12 buildings, adds market district
- City: 20 buildings, adds university district
- Metropolis: 30 buildings, adds research district
- Civilization: All buildings, cosmic glow on the city

### 4.4 `/marketplace` — Focus Marketplace

**Structure:**
```
[Header: coin balance + "Shop" title]
[Category tabs: All | Avatars | Pet Skins | City | Frames | Emotes | Effects | Titles]
[Filter bar: Price Low-High | Rarity | New | Limited | Owned]

[Item grid: 4 cols desktop, 2 cols mobile]
Each item card:
  - Preview emoji/image
  - Rarity badge (color-coded pill)
  - Item name (truncated if long)
  - Price: 🪙 X coins
  - "Buy" button → confirmation modal
  - If owned: "Equip" / "Equipped ✓" button
  - If limited: countdown timer + "LIMITED" badge
  - If locked by level: "Level X required" overlay

[Featured section at top: "Hot Items" horizontal scroll]
[New arrivals section]
[Limited time section with countdown]
```

Purchase flow:
1. Click "Buy" → modal: item preview + confirm spend X coins
2. Click "Confirm" → optimistic deduct coins
3. Success: item flies from grid to inventory icon
4. Fail: reverse coin deduction + error toast

### 4.5 `/dreams` — Dreams System Page

**New user flow (step wizard):**
```
Step 1: "What's your dream?" 
  [Grid of dream type cards with icons]
  IIT 🏛️  JEE 📐  NEET 🔬  UPSC 📜  Startup 🚀  Promotion 💼  Custom ✨

Step 2: "When do you want to achieve it?"
  [Date picker with animated calendar]
  ["~X months from now" auto-label]

Step 3: "How many hours per day?"
  [Slider 1-10 hours]
  [Dynamic: "That's X hours/day = X total hours needed"]

Step 4: "Let's start!"
  [Dream summary card with all settings]
  [Confetti on "Begin My Journey" CTA]
```

**Main dream page (after setup):**
```
[Dream title + icon — large hero]
[Circular progress ring — animated fill on load]
["You are X% closer to [Dream]"]

[Key stats row:]
  Hours Logged | Hours Remaining | Days Left | Pace Status

[Daily target tracker:]
  "Focus Xh today to stay on track"
  [Progress bar: today's hours vs target]

[AI motivational message — refreshes daily]
  [Highlighted quote card with typing animation]

[Milestone timeline:]
  [Vertical timeline with completed + upcoming milestones]
  [Completed: green checkmark + date]
  [Next milestone: pulsing indicator + "X hours away"]

[Pace analysis:]
  "At your current pace you'll achieve your dream in X months"
  "You're [ahead/behind] schedule by X days"
```

### 4.6 `/wrapped` — Focus Wrapped

**Hero:**
```
[Full-screen animated gradient: forge-violet → forge-teal]
"Your [Month Year] Focus Wrapped"
[Framer Motion: slides auto-advance every 4s]
[Manual swipe: useGestures drag handler]
[Progress dots at bottom]
```

**8 slides:**
1. "In [Month], you focused for X hours 🎯"
   — Big animated number, particles
2. "You completed X focus sessions ⚡"
   — Spark animation, mode breakdown
3. "Your best day was [Day] — X hours 🏆"
   — Calendar highlight + trophy
4. "You crushed X tasks 📝"
   — Checkmark cascade animation
5. "You earned X XP and reached Level X 📈"
   — XP bar filling animation
6. "Your streak: X days of consistency 🔥"
   — Flame grows taller with streak number
7. "Achievements unlocked this [month] 🏅"
   — Badge grid pop in with stagger
8. "Your Focus Type: [type from DNA] 🧬"
   — DNA helix animation + type reveal

**Share card (canvas):**
```typescript
// Use html2canvas or canvas API
// Generates a 1080×1080 image
// Dark gradient background
// FocusArx logo top
// User's top stat + emoji
// "My Focus [Month] • focusarx.app"
// Download + "Share to Feed" buttons
```

### 4.7 `/lootboxes` — Loot Box Page

**Structure:**
```
[Header: "Your Loot Boxes" + unopened count badge]

[Pending boxes section]
  [Grid of unopened box cards]
  Each card:
    - Box type icon (large, colored by rarity)
    - Rarity badge
    - "Earned from: session #10" label
    - "Open" button → triggers animation

[Opening animation (full-screen overlay):]
  1. Box appears center screen
  2. Shakes 3 times left/right (CSS transform)
  3. Glows in rarity color
  4. Explodes: box splits open, particles radiate (16 particles, CSS)
  5. Reward reveals from center (POP spring animation)
  6. Rarity text: "RARE FIND!" / "EPIC!" / "LEGENDARY!!!"
  7. Reward detail: "+100 coins" / "New Profile Frame!"
  8. Particles settle, "Collect" button appears

[Shop section: buy boxes with coins]
  Common 5🪙 | Rare 50🪙 | Epic 200🪙 | Legendary 1000🪙
  [Each with "Contents Preview" expandable]
```

### 4.8 `/dna` — Focus DNA Page (SIGNATURE FEATURE)

**Hero section:**
```
[Full-width DNA visualization]
[Animated double-helix SVG — pure CSS animation]
  - Two strands rotating around each other
  - Node dots at each pair point
  - Node color = dominant gene color
  - Rotation speed = consistency gene (faster = more consistent)
  - Strand density = sessions per week

["Your Focus Type: [type]" — large reveal text]
[Animated in with character-by-character typing]
```

**6 Gene Trait Bars:**
```
Deep Focus Gene     ████████░░  83%  [purple]
Night Owl Gene      ██████░░░░  62%  [dark blue]
Early Riser Gene    ████░░░░░░  40%  [orange]
Intensity Gene      █████████░  90%  [red]
Consistency Gene    ███████░░░  70%  [green]
Explorer Gene       █████░░░░░  50%  [rainbow]

[Each bar animates fill on load — grows from 0 to value]
[Hover: shows what gene means + how to improve it]
```

**Evolution tracker:**
```
["Your DNA has evolved X times"]
["Last month, your Intensity Gene grew by +12%"]
[Monthly evolution chart: 6 months of gene values as mini radar chart]
```

**DNA Matches:**
```
["You share a DNA type with these scholars"]
[3 user cards with their DNA type + similarity %]
["Send buddy request" on each]
```

**Share button:**
```
["Share My DNA"]
[Generates canvas card:]
  - Dark background with animated helix (screenshot-ready static version)
  - "I am a [Focus Type]"
  - 6 gene bars
  - "focusarx.app/dna"
[Copy link | Download | Share to Feed]
```

### 4.9 `/wallet` — Coin Wallet Page

**Structure:**
```
[Hero: large 🪙 icon + balance (count-up on load)]
[Lifetime stats row: Total Earned | Total Spent | Net Worth]

["Earn More" quick actions:]
  3 cards: Complete a Session | Daily Login Reward | Finish a Mission
  [Each shows how many coins + shortcut button]

[Transaction History:]
  [Filter tabs: All | Earned | Spent]
  [Infinite scroll list]
  Each row:
    - Icon (category based: 🎯 session / ✅ task / 🏆 achievement / 🛍️ shop)
    - Description
    - Amount (+25 green / -100 red)
    - Date (relative: "2 hours ago")
  [Skeleton rows while loading]
  [Empty state if no transactions]
```

### 4.10 `/profile` — Profile Page Redesign

**Complete redesign:**

```
[Banner: animated gradient in rank color]
[Floating particles: 20 small dots, CSS @keyframes upward drift]
[Avatar: large, centered, animated ring matching rank color]
  Ring pulses slowly, thickness = level / max_level

[Username + title badge (rank)]
[Bio text if set]
[Join date: "Member since [month year]"]
[Social links row: GitHub/Twitter/etc]

[Stats showcase — 6 stat cards in 2 rows:]
  Total XP | Sessions | Focus Hours | Best Streak | Badges | Friends

[Action buttons:]
  [Edit Profile] [Share Profile] [Add Friend / Following]

[Tabs: Overview | Achievements | Sessions | Friends]

Overview tab:
  - Focus DNA mini widget (helix + type)
  - 30-day heatmap calendar (GitHub-style)
  - Top 3 achievements highlighted with glow
  - Current active dream progress bar
  - "Today's Wrapped" mini card

Achievements tab:
  - Filter: All | Unlocked | Locked | Secret
  - Badge grid: unlocked → full color, locked → greyscale "???"
  - Click any badge: modal with name, description, rarity, unlock date

Sessions tab:
  - Last 30 sessions table
  - Mode, duration, focus score, XP earned, date

Friends tab:
  - Friends grid with online indicators
  - Mutual study time this week
  - "Study Together" button → creates DM
```

**Public profile URL:** `/u/:username` — same layout, remove edit buttons, respect privacy settings.

**Share profile card (canvas):**
- 1200×630px (Open Graph size)
- Dark background with rank color gradient
- Avatar + username + rank badge
- Top 3 stats
- FocusArx branding

### 4.11 Onboarding Flow (`/welcome` — show to new users)

**5-step wizard (stored in localStorage, mark complete on users.onboarding_completed):**

```
Step 1 — Welcome (animated splash)
  [FocusArx logo animates in]
  ["Build your focus empire"]
  [3 animated feature cards slide in: Timer | Gamification | Social]
  [CTA: "Let's build something great →"]

Step 2 — Choose Your Dream
  [Dream type selector grid]
  [Selected item: scale + glow animation]
  [Custom option: text input appears]

Step 3 — Pick Your Companion
  [Pet species grid: 6 animated cards]
  [Hover: card shows specialty bonus tooltip]
  [Select: spring pop + "You chose [name]!" message]

Step 4 — Set Your Daily Goal
  [Circular slider: 1-8 hours]
  [Dynamic label: "That's 30 sessions/week!"]
  [Motivational message changes based on selection]

Step 5 — Ready!
  [Summary: dream + pet + daily goal]
  [City preview: "Your hamlet is waiting to grow"]
  [CTA: "Start My Journey" → confetti → navigate to /focus]
```

---

## ═══════════════════════════════════════
## PHASE 5 — REAL-TIME & WEBSOCKET
## ═══════════════════════════════════════

### 5.1 Socket.io Setup

In `artifacts/api-server/src/index.ts`:
- Wrap Express with `http.createServer(app)`
- Attach `new Server(httpServer, { cors: existingCorsConfig })`
- Export `io` instance

Create `artifacts/api-server/src/lib/socketManager.ts`:

```typescript
// Auth middleware: verify JWT from socket.handshake.auth.token
// Online presence: Map<userId, socketId[]>
// Rooms: user's personal room = userId, friend rooms, group rooms

// Emit helpers:
export const emitToUser = (userId: string, event: string, data: unknown) => {
  io.to(`user:${userId}`).emit(event, data);
};

export const broadcastLiveActivity = (event: string, data: unknown) => {
  io.to('live-feed').emit(event, data);
};
```

**Events to emit:**

| Trigger | Event | Payload |
|---------|-------|---------|
| Session complete | `session:complete` | `{userId, username, durationMin, mode, subject, xpEarned}` |
| Badge unlock | `achievement:unlock` | `{userId, badge}` |
| Level up | `user:levelup` | `{userId, newLevel, newRank}` |
| Rank advance | `rank:upgrade` | `{userId, oldRank, newRank}` |
| New follower | `social:follow` | `{followerId, targetId}` |
| Mission complete | `mission:complete` | `{userId, missionId, reward}` |
| Notification | `notification:new` | `{notification}` |
| Streak milestone | `streak:milestone` | `{userId, days}` |

### 5.2 Live Activity Ticker

Create `artifacts/focusarx/src/components/LiveActivityTicker.tsx`:
- Connects to `live-feed` socket room
- Receives `session:complete`, `achievement:unlock`, `streak:milestone` events
- Shows a subtle ticker at bottom of dashboard:
  - "🎯 [User] just completed a 45-min Deep Work session"
  - "🏆 [User] unlocked the 7-Day Warrior badge"
  - "🔥 [User] hit a 30-day streak!"
- Slides in from right, auto-dismisses after 5s
- Max 3 visible at once, queue the rest

### 5.3 Frontend Socket Client

Create `artifacts/focusarx/src/lib/socket.ts`:

```typescript
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (token: string): Socket => {
  if (!socket) {
    socket = io('/', { auth: { token }, reconnectionAttempts: 5 });
  }
  return socket;
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};

export const useSocketEvent = <T>(event: string, handler: (data: T) => void) => {
  const sock = useSocket();
  useEffect(() => {
    sock?.on(event, handler);
    return () => { sock?.off(event, handler); };
  }, [sock, event, handler]);
};
```

---

## ═══════════════════════════════════════
## PHASE 6 — MICRO-INTERACTIONS & POLISH
## ═══════════════════════════════════════

### 6.1 Every Screen Must Have

- `<motion.div {...PAGE}>` page wrapper
- Skeleton loading for every async component
- Designed empty state (not just blank)
- Error state with retry button
- Optimistic updates for all mutations

### 6.2 Micro-interactions Checklist

**Buttons:** `whileHover={{ scale: 1.02 }}` `whileTap={{ scale: 0.96 }}` on all primary CTAs.

**Coin balance change:** Number animates up/down using `useSpring` with stiffness 200. Golden flash on earn, red flash on spend.

**XP gain:** Purple shimmer sweeps across XP bar. Level badge bounces.

**Achievement unlock:** `AchievementModal` — full-screen with particle burst. Auto-queue if multiple badges unlock.

**Level up:** `LevelUpScreen` — dramatic full-screen. Don't skip this — it's a key retention moment.

**Session complete:** Full reward summary card slides up from bottom after every session. Each metric counts up. Includes: XP earned, coins, focus score, AI insight, any special drops.

**Streak increment:** Flame emoji scales 1.5× → springs back. Day counter increments with a bounce.

**Habit check-off:** Checkbox → to → checkmark with scale pop. Card gets success tint. Streak flame updates.

**Task complete:** Item gets strikethrough animation (CSS). Row fades slightly. Confetti burst from the checkbox.

**Mission progress:** Bar fills with shimmer animation on progress update. On complete: checkmark draws itself (SVG stroke-dashoffset animation, 300ms).

**Pet interaction (Feed/Play):** Pet bounces with spring animation. Mood bar smoothly fills. Hearts float up from pet on play.

**Building unlock in city:** Building fades in with scale from 0.5 to 1 with spring. Population counter increments.

**Loot box open:** Defined in phase 4.7. This is a key delight moment — make it feel special.

**Rank advancement:** Background flash in rank color. `RankBadge` swaps with flip animation (rotateY 180°). Title card appears.

**Delight reward toast:** Floats up from bottom-center. Glows in reward type color. Subtle particle trail on entry.

### 6.3 Sound Design (Web Audio API, opt-in)

Create `artifacts/focusarx/src/lib/soundEngine.ts`:

```typescript
// All sounds generated via Web Audio API — no audio files needed
// User can mute all sounds in settings

export const playXpGain = () => tone(880, 0.1, 'sine', 0.15);  // brief high tone
export const playCoinEarn = () => tone(660, 0.08, 'sine', 0.1); // coin clink
export const playAchievement = () => chord([523, 659, 784], 0.5, 'triangle', 0.3);
export const playLevelUp = () => arpeggio([261, 329, 392, 523], 0.08, 'square', 0.2);
export const playSessionComplete = () => chord([392, 494, 587], 0.8, 'sine', 0.25);
export const playStreakMilestone = () => arpeggio([440, 554, 659, 880], 0.06, 'sine', 0.3);
export const playMissionComplete = () => chord([349, 440, 523, 698], 0.6, 'triangle', 0.2);
```

### 6.4 Command Palette (Cmd+K)

Create `artifacts/focusarx/src/components/CommandPalette.tsx`:

```
[Triggered by: Cmd+K / Ctrl+K / search icon]
[Modal overlay with blur background]
[Search input: autofocus]
[Results groups:]
  Navigation: Dashboard · Focus · Habits · City · Dreams · DNA · Shop
  Actions: Start Session · Add Task · Claim Reward · Open Loot Box
  Go to: /u/username (searches users)
[Keyboard navigation: arrows + enter]
[Close: Esc or click outside]
```

---

## ═══════════════════════════════════════
## PHASE 7 — COIN SYSTEM (Full Upgrade)
## ═══════════════════════════════════════

### 7.1 Updated Coin Earning Rates

Update gamification service to emit coins on every qualifying action:

```typescript
const COIN_EVENTS = {
  // Sessions
  session_complete_base: (durationMin: number) => Math.floor(durationMin / 5),
  session_perfect_score: 25,       // focus_score > 90
  session_deep_work_bonus: 15,     // mode === 'deep_work'
  session_exam_bonus: 20,          // mode === 'exam'
  session_first_today: 10,         // first session of the day
  
  // Habits & Tasks
  habit_complete: 5,
  task_complete: 3,
  task_complete_on_time: 5,        // before due date
  task_complete_p0: 10,            // high priority task
  
  // Streaks
  streak_3_day: 30,
  streak_7_day: 75,
  streak_14_day: 150,
  streak_30_day: 300,
  streak_100_day: 1000,
  
  // Social
  daily_login: 10,
  first_post: 15,
  post_get_reaction: 2,            // per reaction, max 10/post
  make_friend: 25,
  
  // Gamification
  badge_common: 10,
  badge_rare: 50,
  badge_epic: 150,
  badge_legendary: 500,
  level_up: 20,
  rank_advance: 100,
  mission_complete: 'from missions table',
  quest_complete: 'from quests table',
  
  // Growth
  referral_signup: 100,
  referral_first_session: 200,     // bonus when referred user completes first session
  
  // One-time bonuses
  onboarding_complete: 100,
  profile_complete: 50,
  first_session_ever: 50,
};
```

### 7.2 Daily Login Reward

Implement full 7-day cycle. Show "BONUS!" badge on day 7. Show missed days visually (greyed). On claim: coin flies to wallet in nav (CSS arc animation using `keyframes`).

---

## ═══════════════════════════════════════
## PHASE 8 — NAVIGATION UPDATES
## ═══════════════════════════════════════

### 8.1 Updated Nav Items

```typescript
// artifacts/focusarx/src/components/AppShell.tsx
const NAV_GROUPS = [
  {
    label: 'Core',
    items: [
      { href: '/',           label: 'Dashboard',  icon: Home },
      { href: '/focus',      label: 'Focus',      icon: Timer },
      { href: '/habits',     label: 'Habits',     icon: CheckSquare },
      { href: '/tasks',      label: 'Tasks',      icon: ListTodo },
    ]
  },
  {
    label: 'Your Journey',
    items: [
      { href: '/dreams',     label: 'Dreams',     icon: Stars },
      { href: '/dna',        label: 'Focus DNA',  icon: Dna, badge: 'NEW' },
      { href: '/wrapped',    label: 'Wrapped',    icon: Gift },
    ]
  },
  {
    label: 'World',
    items: [
      { href: '/pets',       label: 'Companion',  icon: Heart },
      { href: '/city',       label: 'My City',    icon: Building2 },
      { href: '/lootboxes',  label: 'Loot Boxes', icon: Package, badge: (unopenedCount > 0 ? unopenedCount : null) },
      { href: '/marketplace',label: 'Shop',       icon: ShoppingBag },
    ]
  },
  {
    label: 'Social',
    items: [
      { href: '/social',     label: 'Feed',       icon: Users },
      { href: '/leaderboard',label: 'Rankings',   icon: Trophy },
      { href: '/groups',     label: 'Groups',     icon: Layers },
    ]
  },
  {
    label: 'Account',
    items: [
      { href: '/wallet',     label: 'Wallet',     icon: Wallet },
      { href: '/profile',    label: 'Profile',    icon: User },
      { href: '/settings',   label: 'Settings',   icon: Settings },
    ]
  }
];
```

**Mobile bottom nav:** Show 5 items: Dashboard, Focus, Social, City, Profile. "More" sheet for the rest.

**Notification bell** in top nav header:
- Red dot badge if unread notifications
- Click → notification dropdown (last 10, mark all read)
- Each notification links to relevant page

**Wallet widget** in top nav:
- Shows 🪙 + coin balance
- Animates on balance change

---

## ═══════════════════════════════════════
## PHASE 9 — ADMIN SYSTEM
## ═══════════════════════════════════════

Protected by `users.role === 'admin'` check. Route prefix: `/admin`.

### Pages:

**`/admin`** — Overview:
- DAU / WAU / MAU cards
- Sessions today + chart (last 14 days)
- Coins circulating (earned vs spent)
- New signups per day
- Top 10 users by XP

**`/admin/users`** — User management:
- Table: username, email, level, XP, sessions, join date, last active
- Search + filter by role, date range
- Actions: view profile, ban, promote to admin

**`/admin/events`** — Seasonal events management:
- Create / edit events with date range, multipliers, exclusive items
- Toggle active/inactive

**`/admin/marketplace`** — Item management:
- Create, edit, deactivate marketplace items
- Track sold counts

**`/admin/analytics`** — Real analytics:
- Session completion rate
- Average session duration trend
- Feature adoption (% of users using pets, city, DNA, etc.)
- Retention curves: D1, D7, D30

---

## ═══════════════════════════════════════
## PHASE 10 — PERFORMANCE & PWA
## ═══════════════════════════════════════

### 10.1 Code Splitting

Every new page uses `React.lazy`:
```typescript
const Pets = lazy(() => import('./pages/pets'));
const City = lazy(() => import('./pages/city'));
const Dreams = lazy(() => import('./pages/dreams'));
const DNA = lazy(() => import('./pages/dna'));
const Marketplace = lazy(() => import('./pages/marketplace'));
const Wrapped = lazy(() => import('./pages/wrapped'));
const LootBoxes = lazy(() => import('./pages/lootboxes'));
const Wallet = lazy(() => import('./pages/wallet'));
```

Wrap all lazy routes with `<Suspense fallback={<PageSkeleton />}>`.

### 10.2 TanStack Query Cache Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,        // 1 minute
      gcTime: 5 * 60_000,       // 5 minutes
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});
```

Key queries and their stale times:
- `/api/daily-reward`: 0 (always fresh)
- `/api/quests`: 60s
- `/api/dna`: 5min
- `/api/city`: 2min
- `/api/pets`: 30s (hunger/mood decay)
- `/api/wrapped`: 10min

### 10.3 PWA Manifest

Update `artifacts/focusarx/public/manifest.json`:
```json
{
  "name": "FocusArx — Build Your Focus Empire",
  "short_name": "FocusArx",
  "description": "The most addictive focus and study platform",
  "theme_color": "#7C3AED",
  "background_color": "#0A0F1E",
  "display": "standalone",
  "start_url": "/",
  "icons": [...]
}
```

### 10.4 Service Worker (extend existing sw.js)

Add push notification handler:
```javascript
self.addEventListener('push', e => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'FocusArx', {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/badge-72.png',
      data: { url: data.url ?? '/' },
      actions: data.actions ?? [],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
```

---

## ═══════════════════════════════════════
## PHASE 11 — SEED DATA FOR NEW TABLES
## ═══════════════════════════════════════

After creating all tables, seed the following data:

### City Buildings (20 buildings across all tiers):

```sql
INSERT INTO city_building_definitions (id, slug, name, description, district, category, unlock_level, unlock_sessions, coin_cost, population_bonus, xp_bonus_per_session, coin_bonus_per_session, icon, tier, sort_order) VALUES
('b1','library','Village Library','A quiet place for deep reading','downtown','education',1,0,0,10,2,0,'📚','hamlet',1),
('b2','cafe','Study Cafe','Coffee and focus fuel','downtown','commerce',1,5,50,15,1,1,'☕','hamlet',2),
('b3','park','Focus Park','Fresh air and clear thoughts','downtown','nature',2,10,100,20,0,0,'🌳','village',3),
('b4','school','Primary School','Where learning begins','education','education',3,15,200,30,3,0,'🏫','village',4),
('b5','gym','Mind Gym','Train your mental endurance','downtown','fitness',4,20,300,25,2,1,'🏋️','village',5),
('b6','bank','Coin Bank','Earn interest on your effort','commerce','commerce',5,25,500,35,0,2,'🏦','town',6),
('b7','college','Study College','Advanced academics','education','education',6,30,750,50,5,0,'🎓','town',7),
('b8','lab','Research Lab','Cutting-edge discoveries','research','science',7,40,1000,45,4,2,'🔬','town',8),
('b9','arena','Challenge Arena','Compete and grow stronger','social','sports',8,50,1200,60,3,1,'⚔️','city',9),
('b10','library2','Grand Library','A monument to knowledge','education','education',10,60,1500,80,6,0,'🏛️','city',10),
('b11','observatory','Focus Observatory','See your path clearly','research','science',12,75,2000,70,5,3,'🔭','city',11),
('b12','market','Grand Market','The economy of effort','commerce','commerce',14,90,2500,90,2,4,'🏪','city',12),
('b13','temple','Temple of Wisdom','Ancient knowledge preserved','downtown','culture',15,100,3000,100,7,0,'⛩️','metropolis',13),
('b14','university','FocusArx University','The pinnacle of study','education','education',18,120,4000,120,10,0,'🏟️','metropolis',14),
('b15','innovation','Innovation Hub','Where ideas become reality','research','tech',20,150,5000,110,8,5,'💡','metropolis',15),
('b16','stadium','Focus Stadium','Epic competitions of the mind','social','sports',22,175,6000,150,5,3,'🏟️','metropolis',16),
('b17','palace','Knowledge Palace','A legendary seat of power','downtown','culture',25,200,8000,200,10,5,'🏰','civilization',17),
('b18','spaceport','Star Academy','Study among the stars','research','cosmic',30,250,10000,250,15,8,'🚀','civilization',18),
('b19','crystal','Crystal Tower','Crystallized focus made manifest','downtown','mystical',35,300,12000,300,12,10,'💎','civilization',19),
('b20','nexus','Infinite Nexus','The convergence of all knowledge','education','cosmic',40,350,15000,500,20,15,'✨','civilization',20)
ON CONFLICT (slug) DO NOTHING;
```

### Loot Box Types:

```sql
INSERT INTO loot_box_types (id, name, description, rarity, coin_cost, sessions_required, icon, glow_color, possible_rewards) VALUES
('lb_common','Common Box','Basic rewards from your hard work','common',5,10,'📦','#9CA3AF','[{"type":"coins","value":20,"weight":40},{"type":"coins","value":50,"weight":25},{"type":"xp","value":100,"weight":25},{"type":"streak_shield","value":1,"weight":10}]'),
('lb_rare','Rare Box','Uncommon treasures await','rare',50,0,'🟦','#3B82F6','[{"type":"coins","value":100,"weight":35},{"type":"xp","value":300,"weight":30},{"type":"streak_shield","value":1,"weight":20},{"type":"marketplace_item","category":"emote","weight":15}]'),
('lb_epic','Epic Box','Rare and powerful rewards','epic',200,0,'🟣','#8B5CF6','[{"type":"coins","value":300,"weight":25},{"type":"xp","value":750,"weight":25},{"type":"xp_boost","value":1,"weight":25},{"type":"marketplace_item","category":"profile_frame","weight":15},{"type":"marketplace_item","category":"pet_skin","weight":10}]'),
('lb_legendary','Legendary Box','The rarest treasures of all','legendary',1000,0,'🌟','#F59E0B','[{"type":"coins","value":1000,"weight":20},{"type":"xp","value":2000,"weight":20},{"type":"marketplace_item","rarity":"legendary","weight":30},{"type":"streak_shield","value":3,"weight":20},{"type":"battle_pass_tiers","value":5,"weight":10}]')
ON CONFLICT (id) DO NOTHING;
```

### Seasonal Event (insert current):

```sql
INSERT INTO seasonal_events (id, name, slug, description, theme, banner_color, start_date, end_date, xp_multiplier, coin_multiplier, is_active)
VALUES (
  'event_exam_2025',
  'Exam Season 2025 🎓',
  'exam-season-2025',
  'The ultimate study season is here. Double rewards for every session. Prove your dedication.',
  'exam_season',
  '#D97706',
  NOW(),
  NOW() + INTERVAL '60 days',
  1.5,
  1.25,
  true
) ON CONFLICT (slug) DO NOTHING;
```

### Quest Definitions (15 quests):

```sql
INSERT INTO quest_definitions (id, title, description, type, difficulty, target, metric, xp_reward, coin_reward, icon, rotation_weight) VALUES
('q_daily_1session','Just Start','Complete 1 focus session today','daily','easy',1,'sessions_today',50,25,'🎯',30),
('q_daily_2sessions','Double Down','Complete 2 sessions today','daily','medium',2,'sessions_today',100,50,'⚡',20),
('q_daily_1hour','Hour Power','Focus for 60 minutes today','daily','medium',60,'minutes_today',80,40,'⏱',25),
('q_daily_habit','Daily Habit','Check off a habit today','daily','easy',1,'habits_today',40,20,'✅',30),
('q_daily_task','Task Buster','Complete 3 tasks today','daily','medium',3,'tasks_today',75,35,'📝',20),
('q_daily_score','Focus Champion','Achieve a focus score of 85+','daily','hard',85,'max_focus_score',150,75,'🏆',10),
('q_weekly_10sessions','Decade Sessions','Complete 10 sessions this week','weekly','medium',10,'sessions_week',300,150,'🔥',25),
('q_weekly_5hours','Five Hour Work Week','Focus for 5 hours this week','weekly','medium',300,'minutes_week',400,200,'🧠',20),
('q_weekly_streak','Streak Keeper','Maintain your streak all week','weekly','hard',7,'streak_days',500,250,'📅',15),
('q_weekly_tasks','Task Machine','Complete 20 tasks this week','weekly','hard',20,'tasks_week',450,225,'🤖',15),
('q_weekly_social','Social Scholar','Post or react 5 times this week','weekly','easy',5,'social_actions',200,100,'👥',20),
('q_weekly_habits','Habit Master','Log 14 habit check-ins this week','weekly','medium',14,'habit_completions_week',350,175,'💪',20),
('q_weekly_buddy','Study Together','Complete a session while a friend is online','weekly','hard',1,'buddy_sessions',400,200,'🤝',10),
('q_weekly_mode','Mode Explorer','Try 3 different session modes this week','weekly','medium',3,'modes_used_week',300,150,'🔄',15),
('q_weekly_perfect','No Zero Days','Focus every day this week','weekly','hard',7,'days_with_session_week',600,300,'⭐',10)
ON CONFLICT (id) DO NOTHING;
```

### Marketplace Items (30+ items):

```sql
INSERT INTO marketplace_items (id, name, description, category, rarity, coin_price, level_required, icon, is_new) VALUES
-- Profile Frames
('pf_silver','Silver Scholar Frame','A frame for serious students','profile_frame','common',100,1,'🔘',true),
('pf_gold','Golden Champion Frame','For those who shine bright','profile_frame','rare',300,10,'🏅',true),
('pf_violet','Violet Mystic Frame','Deep focus energy','profile_frame','rare',250,8,'💜',true),
('pf_fire','Fire Streak Frame','For streak legends only','profile_frame','epic',750,20,'🔥',true),
('pf_cosmic','Cosmic Explorer Frame','Among the stars','profile_frame','legendary',2000,40,'✨',true),
-- Emotes
('em_flex','Victory Flex','Show off your wins','emote','common',50,1,'💪',true),
('em_fire','On Fire','You're unstoppable','emote','common',50,1,'🔥',true),
('em_crown','Crown Drop','Royalty energy','emote','rare',200,15,'👑',true),
('em_brain','Galaxy Brain','Big brain moment','emote','rare',200,12,'🧠',true),
('em_rainbow','Rainbow Burst','Pure joy','emote','epic',500,25,'🌈',true),
-- Pet Accessories
('pa_glasses','Scholar Glasses','Knowledge is power','pet_skin','common',75,1,'🕶️',true),
('pa_crown','Mini Crown','Your pet is royalty','pet_skin','rare',300,10,'👑',true),
('pa_wings','Angel Wings','Ascended companion','pet_skin','epic',600,20,'🪽',true),
('pa_halo','Golden Halo','Pure and focused','pet_skin','legendary',1500,35,'😇',true),
-- City Skins
('cs_future','Future City Skin','Neon lights and chrome','city_skin','epic',1000,25,'🌆',true),
('cs_nature','Nature Kingdom Skin','Green and peaceful','city_skin','rare',400,15,'🌿',true),
('cs_cosmic','Cosmic Civilization','Space age architecture','city_skin','legendary',3000,50,'🌌',true),
-- Titles
('t_grinder','The Grinder','For the relentless workers','title_badge','common',150,5,'⚙️',true),
('t_nocturnal','Night Scholar','Darkness is your canvas','title_badge','rare',350,12,'🌙',true),
('t_legend','Living Legend','Self-explanatory','title_badge','epic',1000,30,'⭐',true),
('t_transcendent','Transcendent','Beyond all limits','title_badge','legendary',5000,50,'🔮',true),
-- Themes
('th_nord','Nord Theme','Clean and icy','theme','rare',500,10,'❄️',true),
('th_sunset','Sunset Theme','Warm and energizing','theme','rare',500,10,'🌅',true),
('th_forest','Forest Theme','Deep and natural','theme','epic',800,20,'🌲',true),
('th_space','Space Theme','Infinite possibilities','theme','legendary',2500,40,'🚀',true)
ON CONFLICT (id) DO NOTHING;
```

---

## ═══════════════════════════════════════
## FINAL STEP — FULL NEON SQL MIGRATION
## ═══════════════════════════════════════

After completing ALL of the above, output the COMPLETE SQL migration script as a single fenced code block.

**Requirements for the SQL block:**

1. Label it clearly: `-- FOCUSARX COMPLETE NEON SQL MIGRATION V12`
2. Every statement must be idempotent (`IF NOT EXISTS`, `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`, `ON CONFLICT DO NOTHING`)
3. Include ALL sections in this exact order:

```
SECTION 1: FIXES
  - Drop orphan Better Auth tables
  - Backfill focus_score NULLs
  - Add all missing columns (ALTER TABLE ... ADD COLUMN IF NOT EXISTS)

SECTION 2: NEW TABLES (in dependency order)
  - pets
  - focus_cities + city_building_definitions
  - loot_box_types + user_loot_boxes
  - seasonal_events + user_seasonal_progress
  - user_dreams
  - focus_wrapped
  - marketplace_items + user_inventory
  - focus_dna
  - daily_reward_claims
  - quest_definitions + user_quest_progress
  - streak_shield_usage

SECTION 3: MISSING INDEXES (all 17)

SECTION 4: SEED DATA
  - 25 missions
  - 15 quest definitions
  - 20 city buildings
  - 4 loot box types
  - 25+ marketplace items
  - 1 active seasonal event
  - 2 weekly quests auto-assign trigger (PL/pgSQL function)

SECTION 5: HELPER FUNCTIONS
  - calculate_user_rank(total_xp integer) RETURNS text
  - award_coins(p_user_id text, p_amount integer, p_reason text, p_description text) RETURNS void
  - get_city_tier(session_count integer) RETURNS text
  - is_streak_active(last_session_date date) RETURNS boolean

SECTION 6: END VERIFICATION
  - SELECT count(*) queries for each new table to confirm creation
  - SELECT statements to verify seed data
```

**The SQL block must be fully copy-pasteable into Neon SQL Editor with zero modifications.**

---

## ═══════════════════════════════════════
## DELIVERY CHECKLIST
## ═══════════════════════════════════════

Tick every item before marking complete:

**Database (Phase 0):**
- [ ] Dual auth tables dropped
- [ ] focus_score backfilled and forward-fixed
- [ ] 25 missions seeded
- [ ] 17 missing indexes added
- [ ] Missing columns added to users, focus_sessions, tasks

**New Tables (Phase 1):**
- [ ] pets
- [ ] focus_cities + city_building_definitions
- [ ] loot_box_types + user_loot_boxes
- [ ] seasonal_events + user_seasonal_progress
- [ ] user_dreams
- [ ] focus_wrapped
- [ ] marketplace_items + user_inventory
- [ ] focus_dna
- [ ] daily_reward_claims
- [ ] quest_definitions + user_quest_progress
- [ ] streak_shield_usage
- [ ] Schema pushed: `pnpm --filter @workspace/db run push` ✓

**Backend Routes (Phase 2):**
- [ ] Session rewards (XP, coins, pet, city, dream, quests, missions, delight, AI insight)
- [ ] /api/pets (CRUD + actions)
- [ ] /api/city (city + buildings)
- [ ] /api/dreams (dream + AI message)
- [ ] /api/daily-reward (get + claim)
- [ ] /api/lootboxes (get + open + purchase)
- [ ] /api/marketplace (items + buy + equip + inventory)
- [ ] /api/dna (get + recalculate + matches)
- [ ] /api/wrapped (get + generate)
- [ ] /api/quests (get + claim)
- [ ] /api/referrals (get + stats + apply)
- [ ] /api/presence (online + offline + status)
- [ ] All routes registered in routes/index.ts

**Frontend Animations (Phase 3):**
- [ ] animations.ts library created
- [ ] All pages wrapped in PAGE transition
- [ ] All 8 reusable components built (XPBar, CoinCounter, RankBadge, StreakFlame, SessionModeSelector, Skeleton variants, EmptyState, RewardToast)
- [ ] AchievementModal built
- [ ] LevelUpScreen built

**New Pages (Phase 4):**
- [ ] Dashboard fully redesigned
- [ ] /pets — pet companion page
- [ ] /city — focus city with animated SVG
- [ ] /marketplace — shop with purchase flow
- [ ] /dreams — dream system with setup wizard
- [ ] /wrapped — animated slides + share card
- [ ] /lootboxes — opening animation
- [ ] /dna — animated helix + gene bars + share
- [ ] /wallet — transaction history
- [ ] /profile — full redesign + public /u/:username
- [ ] /welcome — onboarding flow
- [ ] All pages registered in App.tsx with lazy import

**Real-time (Phase 5):**
- [ ] Socket.io server setup
- [ ] socketManager.ts created
- [ ] 8 socket events wired to routes
- [ ] socket.ts client created
- [ ] LiveActivityTicker component built

**Micro-interactions (Phase 6):**
- [ ] All buttons have whileHover/whileTap
- [ ] Skeleton loading on every async component
- [ ] Optimistic updates on all mutations
- [ ] All micro-interactions implemented per checklist
- [ ] Sound engine created (optional, behind settings toggle)
- [ ] Command palette Cmd+K

**Coin System (Phase 7):**
- [ ] All coin earning events implemented
- [ ] Daily login reward complete with 7-day cycle

**Navigation (Phase 8):**
- [ ] All new nav items added
- [ ] Mobile bottom nav updated
- [ ] Notification bell with unread badge
- [ ] Wallet widget in header

**Admin (Phase 9):**
- [ ] /admin/users
- [ ] /admin/events
- [ ] /admin/marketplace
- [ ] /admin/analytics

**Performance (Phase 10):**
- [ ] All pages lazy-loaded
- [ ] TanStack Query cache configured
- [ ] PWA manifest updated
- [ ] Service worker push notifications

**Seed Data (Phase 11):**
- [ ] 20 city buildings
- [ ] 4 loot box types
- [ ] 15 quest definitions
- [ ] 25+ marketplace items
- [ ] Active seasonal event

**Final Output:**
- [ ] **COMPLETE NEON SQL MIGRATION BLOCK at end of response**
- [ ] SQL is idempotent and copy-pasteable
- [ ] All 6 sections present in SQL

---

> **ZERO SHORTCUTS. ZERO STUBS. ZERO TODOs.**
> Every feature fully implemented, tested (no TypeScript errors), and production-ready.
> This is the version that makes users say "I can't stop using this."
