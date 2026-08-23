SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
SET default_tablespace = '';
SET default_table_access_method = heap;
CREATE TABLE public.active_sessions (
    id text NOT NULL,
    user_id text NOT NULL,
    mode text DEFAULT 'focus'::text NOT NULL,
    seconds_left integer DEFAULT 1500 NOT NULL,
    timer_status text DEFAULT 'paused'::text NOT NULL,
    active_seconds integer DEFAULT 0 NOT NULL,
    focus_score real,
    focus_quality text,
    focus_state text,
    distraction_count integer DEFAULT 0,
    last_seen_face_at text,
    focus_timeline text DEFAULT '[]'::text,
    monitor_enabled boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.analytics_events (
    id text NOT NULL,
    event_id text NOT NULL,
    visitor_id text NOT NULL,
    session_id text,
    event_type text NOT NULL,
    event_data jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.analytics_sessions (
    id text NOT NULL,
    visitor_id text NOT NULL,
    session_start timestamp without time zone DEFAULT now() NOT NULL,
    session_end timestamp without time zone,
    duration_sec integer DEFAULT 0 NOT NULL,
    page_views integer DEFAULT 0 NOT NULL,
    focus_sessions_started integer DEFAULT 0 NOT NULL,
    tasks_created integer DEFAULT 0 NOT NULL,
    roadmaps_generated integer DEFAULT 0 NOT NULL,
    ai_features_used integer DEFAULT 0 NOT NULL,
    last_activity_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.app_feedback (
    id text NOT NULL,
    user_id text,
    rating integer NOT NULL,
    message text,
    category text DEFAULT 'general'::text,
    session_count integer DEFAULT 0,
    user_level integer DEFAULT 1,
    device text,
    app_version text DEFAULT '1.0'::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.audit_logs (
    id text NOT NULL,
    user_id text,
    action text NOT NULL,
    details jsonb,
    ip text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.battle_pass_progress (
    id text NOT NULL,
    user_id text NOT NULL,
    season integer DEFAULT 1 NOT NULL,
    tier integer DEFAULT 0 NOT NULL,
    season_xp integer DEFAULT 0 NOT NULL,
    premium_unlocked boolean DEFAULT false NOT NULL,
    claimed_tiers jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.battle_pass_rewards (
    id text NOT NULL,
    battle_pass_id text NOT NULL,
    tier integer NOT NULL,
    type text NOT NULL,
    value jsonb,
    required_xp integer NOT NULL,
    is_premium boolean DEFAULT false NOT NULL
);
CREATE TABLE public.battle_passes (
    id text NOT NULL,
    season text NOT NULL,
    title text NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.break_free_moods (
    id text NOT NULL,
    user_id text NOT NULL,
    mood integer NOT NULL,
    date text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.break_free_pledges (
    id text NOT NULL,
    message text NOT NULL,
    posted_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.break_free_streaks (
    id text NOT NULL,
    user_id text NOT NULL,
    start_date text NOT NULL,
    current_streak integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    relapse_count integer DEFAULT 0 NOT NULL,
    last_relapse_date text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.buddy_requests (
    id text NOT NULL,
    sender_id text NOT NULL,
    receiver_id text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.city_building_definitions (
    id text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    district text NOT NULL,
    category text NOT NULL,
    unlock_level integer DEFAULT 1 NOT NULL,
    unlock_sessions integer DEFAULT 0 NOT NULL,
    coin_cost integer DEFAULT 0 NOT NULL,
    population_bonus integer DEFAULT 10 NOT NULL,
    xp_bonus_per_session integer DEFAULT 0 NOT NULL,
    coin_bonus_per_session integer DEFAULT 0 NOT NULL,
    icon text NOT NULL,
    tier text DEFAULT 'hamlet'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);
CREATE TABLE public.coin_transactions (
    id text NOT NULL,
    user_id text NOT NULL,
    type text NOT NULL,
    amount integer NOT NULL,
    reason text NOT NULL,
    description text NOT NULL,
    balance_after integer DEFAULT 0 NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.consequence_contracts (
    id text NOT NULL,
    user_id text NOT NULL,
    week_start text NOT NULL,
    contract_type text NOT NULL,
    target_minutes integer DEFAULT 0 NOT NULL,
    charity_name text,
    charity_amount integer,
    achieved boolean DEFAULT false NOT NULL,
    consequence_triggered boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.conversation_participants (
    id text NOT NULL,
    conversation_id text NOT NULL,
    user_id text NOT NULL,
    last_read_at timestamp without time zone,
    is_admin boolean DEFAULT false NOT NULL,
    joined_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.conversations (
    id text NOT NULL,
    type text DEFAULT 'direct'::text NOT NULL,
    name text,
    group_id text,
    last_message_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.distraction_logs (
    id text NOT NULL,
    user_id text NOT NULL,
    session_id text,
    reason text NOT NULL,
    worth_it boolean DEFAULT false NOT NULL,
    hour integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.email_logs (
    id text NOT NULL,
    recipient_id text,
    recipient_email text NOT NULL,
    template text NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    provider_id text,
    sent_at timestamp without time zone,
    opened_at timestamp without time zone,
    clicked_at timestamp without time zone,
    bounced boolean DEFAULT false,
    error text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.focus_cities (
    id text NOT NULL,
    user_id text NOT NULL,
    tier text DEFAULT 'hamlet'::text NOT NULL,
    tier_name text DEFAULT 'Study Hamlet'::text NOT NULL,
    population integer DEFAULT 5 NOT NULL,
    total_buildings integer DEFAULT 0 NOT NULL,
    total_sessions integer DEFAULT 0 NOT NULL,
    unlocked_districts jsonb DEFAULT '["downtown"]'::jsonb,
    buildings jsonb DEFAULT '{}'::jsonb,
    atmosphere text DEFAULT 'day'::text NOT NULL,
    weather text DEFAULT 'clear'::text NOT NULL,
    weather_updated_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.focus_dna (
    id text NOT NULL,
    user_id text NOT NULL,
    archetype text NOT NULL,
    description text NOT NULL,
    color_primary text NOT NULL,
    color_secondary text NOT NULL,
    icon text NOT NULL,
    top_focus_hour integer,
    avg_session_min integer,
    strongest_day text,
    biggest_weakness text,
    session_count_at_generation integer DEFAULT 0 NOT NULL,
    generated_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.focus_profiles (
    id text NOT NULL,
    user_id text NOT NULL,
    name text NOT NULL,
    ssid text,
    blocked_domains jsonb DEFAULT '[]'::jsonb,
    whitelist jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.focus_sessions (
    id text NOT NULL,
    user_id text NOT NULL,
    mode text DEFAULT 'focus'::text NOT NULL,
    duration_sec integer DEFAULT 0 NOT NULL,
    planned_duration_sec integer,
    completed_early boolean DEFAULT false,
    completion_percentage real,
    session_status text DEFAULT 'completed'::text,
    completed_at timestamp without time zone,
    focus_score real,
    focus_quality text,
    stability_rating text,
    focus_timeline text,
    session_insights text,
    category text DEFAULT 'General'::text,
    productivity_score real,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.follows (
    id text NOT NULL,
    follower_id text NOT NULL,
    following_id text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.freeze_tokens (
    id text NOT NULL,
    user_id text NOT NULL,
    tokens_available integer DEFAULT 0 NOT NULL,
    tokens_used integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.friendships (
    id text NOT NULL,
    requester_id text NOT NULL,
    addressee_id text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.goals (
    id text NOT NULL,
    user_id text NOT NULL,
    title text NOT NULL,
    description text,
    completed boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.group_audit_logs (
    id text NOT NULL,
    group_id text NOT NULL,
    actor_id text NOT NULL,
    action text NOT NULL,
    target_id text,
    details jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.group_challenge_progress (
    id text NOT NULL,
    challenge_id text NOT NULL,
    user_id text NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    completed_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.group_challenges (
    id text NOT NULL,
    group_id text NOT NULL,
    creator_id text NOT NULL,
    title text NOT NULL,
    description text,
    target_value integer DEFAULT 1 NOT NULL,
    unit text DEFAULT 'sessions'::text NOT NULL,
    xp_reward integer DEFAULT 500 NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.group_invitations (
    id text NOT NULL,
    group_id text NOT NULL,
    inviter_id text NOT NULL,
    invitee_email text,
    invitee_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.group_members (
    id text NOT NULL,
    group_id text NOT NULL,
    user_id text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    xp_contribution integer DEFAULT 0 NOT NULL,
    joined_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.habit_completions (
    id text NOT NULL,
    habit_id text NOT NULL,
    user_id text NOT NULL,
    date text NOT NULL,
    note text,
    completed_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.habits (
    id text NOT NULL,
    user_id text NOT NULL,
    name text NOT NULL,
    icon text DEFAULT '⭐'::text NOT NULL,
    color text DEFAULT '#7C3AED'::text NOT NULL,
    frequency text DEFAULT 'daily'::text NOT NULL,
    target_days jsonb DEFAULT '[0, 1, 2, 3, 4, 5, 6]'::jsonb,
    current_streak integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    total_completions integer DEFAULT 0 NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.leaderboard_snapshots (
    id text NOT NULL,
    period text NOT NULL,
    category text NOT NULL,
    scope text DEFAULT 'global'::text,
    group_id text,
    data jsonb NOT NULL,
    generated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.login_rewards (
    id text NOT NULL,
    user_id text NOT NULL,
    last_claimed_date text,
    claim_streak integer DEFAULT 0 NOT NULL,
    total_claimed integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.loot_box_types (
    id text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    rarity text NOT NULL,
    coin_cost integer DEFAULT 0 NOT NULL,
    sessions_required integer DEFAULT 0 NOT NULL,
    icon text NOT NULL,
    glow_color text DEFAULT '#7C3AED'::text NOT NULL,
    possible_rewards jsonb NOT NULL
);
CREATE TABLE public.marketplace_items (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    type text DEFAULT 'avatar'::text NOT NULL,
    cost_coins integer DEFAULT 100 NOT NULL,
    rarity text DEFAULT 'common'::text,
    emoji text DEFAULT '🎁'::text,
    data jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.message_reactions (
    id text NOT NULL,
    message_id text NOT NULL,
    user_id text NOT NULL,
    emoji text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.messages (
    id text NOT NULL,
    conversation_id text NOT NULL,
    sender_id text NOT NULL,
    content text NOT NULL,
    type text DEFAULT 'text'::text,
    reply_to_id text,
    is_edited boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.missions (
    id text NOT NULL,
    mission_key text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    type text DEFAULT 'daily'::text NOT NULL,
    category text DEFAULT 'focus'::text NOT NULL,
    xp_reward integer DEFAULT 100 NOT NULL,
    coin_reward integer DEFAULT 50 NOT NULL,
    target_value integer DEFAULT 1 NOT NULL,
    unit text DEFAULT 'sessions'::text NOT NULL,
    icon text DEFAULT '🎯'::text NOT NULL,
    difficulty text DEFAULT 'easy'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.notifications (
    id text NOT NULL,
    user_id text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    data jsonb,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.page_views (
    id text NOT NULL,
    visitor_id text NOT NULL,
    session_id text NOT NULL,
    page text NOT NULL,
    viewed_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.password_reset_tokens (
    id text NOT NULL,
    user_id text NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.post_comments (
    id text NOT NULL,
    post_id text NOT NULL,
    user_id text NOT NULL,
    parent_id text,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.post_likes (
    id text NOT NULL,
    post_id text NOT NULL,
    user_id text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.post_reactions (
    id text NOT NULL,
    post_id text NOT NULL,
    user_id text NOT NULL,
    reaction text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.post_saves (
    id text NOT NULL,
    post_id text NOT NULL,
    user_id text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.posts (
    id text NOT NULL,
    user_id text NOT NULL,
    content text NOT NULL,
    type text DEFAULT 'general'::text NOT NULL,
    image_urls jsonb DEFAULT '[]'::jsonb,
    achievement_data jsonb,
    study_log_data jsonb,
    is_public boolean DEFAULT true NOT NULL,
    group_id text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.premium_subscriptions (
    id text NOT NULL,
    user_id text NOT NULL,
    activated_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone,
    coins_cost integer DEFAULT 9000,
    benefits jsonb DEFAULT '["exclusive_pets", "premium_loot_boxes", "premium_themes", "xp_multiplier", "coin_multiplier", "premium_analytics", "profile_badge", "premium_battle_pass"]'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    granted_by_admin boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.productivity_logs (
    id text NOT NULL,
    user_id text NOT NULL,
    date text NOT NULL,
    focus_minutes integer DEFAULT 0 NOT NULL,
    sessions_completed integer DEFAULT 0 NOT NULL,
    tasks_completed integer DEFAULT 0 NOT NULL,
    avg_focus_score real,
    productivity_score real,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.push_subscriptions (
    id text NOT NULL,
    user_id text NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.quest_definitions (
    id text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    type text NOT NULL,
    difficulty text DEFAULT 'easy'::text NOT NULL,
    target integer NOT NULL,
    metric text NOT NULL,
    xp_reward integer DEFAULT 0 NOT NULL,
    coin_reward integer DEFAULT 0 NOT NULL,
    icon text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    rotation_weight integer DEFAULT 10 NOT NULL
);
CREATE TABLE public.readiness_logs (
    id text NOT NULL,
    user_id text NOT NULL,
    date text NOT NULL,
    sleep integer NOT NULL,
    stress integer NOT NULL,
    energy integer NOT NULL,
    score integer NOT NULL,
    session_length_rec integer NOT NULL,
    hrv integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.roadmaps (
    id text NOT NULL,
    user_id text NOT NULL,
    subject text NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.seasonal_events (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text NOT NULL,
    theme text NOT NULL,
    banner_color text DEFAULT '#7C3AED'::text NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    xp_multiplier real DEFAULT 1 NOT NULL,
    coin_multiplier real DEFAULT 1 NOT NULL,
    special_missions jsonb DEFAULT '[]'::jsonb,
    exclusive_rewards jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.session_ghosts (
    id text NOT NULL,
    user_id text NOT NULL,
    task_category text DEFAULT 'General'::text NOT NULL,
    best_duration_sec integer DEFAULT 0 NOT NULL,
    best_unbroken_sec integer DEFAULT 0 NOT NULL,
    session_id text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.shared_goals (
    id text NOT NULL,
    group_id text,
    creator_id text NOT NULL,
    title text NOT NULL,
    description text,
    target_value integer NOT NULL,
    current_value integer DEFAULT 0 NOT NULL,
    deadline timestamp without time zone,
    status text DEFAULT 'active'::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.social_posts (
    id text NOT NULL,
    user_id text NOT NULL,
    content text NOT NULL,
    type text DEFAULT 'general'::text NOT NULL,
    image_urls jsonb DEFAULT '[]'::jsonb,
    metadata jsonb,
    group_id text,
    is_public boolean DEFAULT true NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.study_buddies (
    id text NOT NULL,
    user_id text NOT NULL,
    buddy_id text NOT NULL,
    status text DEFAULT 'active'::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.study_groups (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    owner_id text NOT NULL,
    group_xp integer DEFAULT 0 NOT NULL,
    group_level integer DEFAULT 1 NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    invite_code text NOT NULL,
    max_members integer DEFAULT 20 NOT NULL,
    avatar_emoji text DEFAULT '🎯'::text NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.study_room_members (
    id text NOT NULL,
    room_id text NOT NULL,
    user_id text NOT NULL,
    joined_at timestamp without time zone DEFAULT now() NOT NULL,
    left_at timestamp without time zone,
    focus_minutes integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL
);
CREATE TABLE public.study_rooms (
    id text NOT NULL,
    name text NOT NULL,
    group_id text,
    host_id text NOT NULL,
    mode text DEFAULT 'silent'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    max_participants integer DEFAULT 50 NOT NULL,
    timer_duration integer DEFAULT 1500 NOT NULL,
    ambiance text DEFAULT 'silence'::text NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    invite_code text NOT NULL,
    scheduled_for timestamp without time zone,
    ended_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.study_streaks (
    id text NOT NULL,
    user_id text NOT NULL,
    current_streak integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    last_study_date text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.tasks (
    id text NOT NULL,
    user_id text NOT NULL,
    text text NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    "order" integer DEFAULT 0,
    estimated_minutes integer,
    category text DEFAULT 'General'::text,
    priority text DEFAULT 'medium'::text,
    tags jsonb DEFAULT '[]'::jsonb,
    due_date text,
    recurring text,
    completed_at timestamp without time zone,
    status text DEFAULT 'active'::text,
    missed_at timestamp without time zone,
    miss_count integer DEFAULT 0,
    archived_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_badges (
    id text NOT NULL,
    user_id text NOT NULL,
    badge_id text NOT NULL,
    unlocked_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_battle_pass_progress (
    id text NOT NULL,
    user_id text NOT NULL,
    battle_pass_id text NOT NULL,
    current_xp integer DEFAULT 0 NOT NULL,
    current_tier integer DEFAULT 0 NOT NULL,
    claimed_rewards jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_dreams (
    id text NOT NULL,
    user_id text NOT NULL,
    dream_type text DEFAULT 'custom'::text NOT NULL,
    custom_goal text,
    target_date text,
    daily_target_minutes integer DEFAULT 120,
    total_minutes_logged integer DEFAULT 0,
    start_date text,
    emoji text DEFAULT '🎯'::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_inventory (
    id text NOT NULL,
    user_id text NOT NULL,
    item_id text NOT NULL,
    acquired_at timestamp without time zone DEFAULT now() NOT NULL,
    equipped boolean DEFAULT false NOT NULL
);
CREATE TABLE public.user_loot_boxes (
    id text NOT NULL,
    user_id text NOT NULL,
    box_type_id text NOT NULL,
    status text DEFAULT 'unopened'::text NOT NULL,
    reward_type text,
    reward_value jsonb,
    earned_reason text,
    opened_at timestamp without time zone,
    earned_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_mission_progress (
    id text NOT NULL,
    user_id text NOT NULL,
    mission_key text NOT NULL,
    period_start text NOT NULL,
    current_value integer DEFAULT 0 NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp without time zone,
    reward_claimed boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_pets (
    id text NOT NULL,
    user_id text NOT NULL,
    pet_type text DEFAULT 'owl'::text NOT NULL,
    pet_name text,
    pet_level integer DEFAULT 1 NOT NULL,
    pet_xp integer DEFAULT 0 NOT NULL,
    evolution_stage integer DEFAULT 1 NOT NULL,
    mood text DEFAULT 'happy'::text,
    accessories jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_profile_extras (
    id text NOT NULL,
    user_id text NOT NULL,
    banner_url text,
    banner_gradient text,
    social_links jsonb DEFAULT '{}'::jsonb,
    featured_post_ids jsonb DEFAULT '[]'::jsonb,
    pinned_badge_ids jsonb DEFAULT '[]'::jsonb,
    is_private boolean DEFAULT false NOT NULL,
    custom_status text,
    status_emoji text,
    creator_tier text DEFAULT 'learner'::text NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_quest_progress (
    id text NOT NULL,
    user_id text NOT NULL,
    quest_id text NOT NULL,
    period text NOT NULL,
    current integer DEFAULT 0 NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    claimed_at timestamp without time zone,
    assigned_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_seasonal_progress (
    id text NOT NULL,
    user_id text NOT NULL,
    event_id text NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    completed_missions jsonb DEFAULT '[]'::jsonb,
    rewards_claimed jsonb DEFAULT '[]'::jsonb,
    rank integer
);
CREATE TABLE public.user_wallets (
    id text NOT NULL,
    user_id text NOT NULL,
    coins integer DEFAULT 0 NOT NULL,
    total_xp integer DEFAULT 0 NOT NULL,
    weekly_xp integer DEFAULT 0 NOT NULL,
    weekly_xp_reset_at timestamp without time zone DEFAULT now(),
    level integer DEFAULT 1 NOT NULL,
    prestige integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    name text,
    hashed_password text,
    guest_key text,
    is_guest boolean DEFAULT false NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    onboarding_completed boolean DEFAULT false NOT NULL,
    onboarding_data jsonb,
    bio text,
    timezone text DEFAULT 'UTC'::text,
    productivity_score real DEFAULT 0,
    total_focus_minutes integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.visitors (
    id text NOT NULL,
    visitor_id text NOT NULL,
    user_id text,
    first_seen timestamp without time zone DEFAULT now() NOT NULL,
    last_seen timestamp without time zone DEFAULT now() NOT NULL,
    visit_count integer DEFAULT 0 NOT NULL,
    device_type text,
    browser text,
    os text,
    country text,
    city text,
    is_bot boolean DEFAULT false NOT NULL
);
CREATE TABLE public.wrapped_snapshots (
    id text NOT NULL,
    user_id text NOT NULL,
    period text NOT NULL,
    period_type text DEFAULT 'monthly'::text NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.active_sessions
    ADD CONSTRAINT active_sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.analytics_sessions
    ADD CONSTRAINT analytics_sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.app_feedback
    ADD CONSTRAINT app_feedback_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.battle_pass_progress
    ADD CONSTRAINT battle_pass_progress_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.battle_pass_progress
    ADD CONSTRAINT battle_pass_progress_user_id_unique UNIQUE (user_id);
ALTER TABLE ONLY public.battle_pass_rewards
    ADD CONSTRAINT battle_pass_rewards_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.battle_passes
    ADD CONSTRAINT battle_passes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.battle_passes
    ADD CONSTRAINT battle_passes_season_unique UNIQUE (season);
ALTER TABLE ONLY public.break_free_moods
    ADD CONSTRAINT break_free_moods_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.break_free_pledges
    ADD CONSTRAINT break_free_pledges_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.break_free_streaks
    ADD CONSTRAINT break_free_streaks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.break_free_streaks
    ADD CONSTRAINT break_free_streaks_user_id_unique UNIQUE (user_id);
ALTER TABLE ONLY public.buddy_requests
    ADD CONSTRAINT buddy_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.city_building_definitions
    ADD CONSTRAINT city_building_definitions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.city_building_definitions
    ADD CONSTRAINT city_building_definitions_slug_unique UNIQUE (slug);
ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT coin_transactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.consequence_contracts
    ADD CONSTRAINT consequence_contracts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.distraction_logs
    ADD CONSTRAINT distraction_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.focus_cities
    ADD CONSTRAINT focus_cities_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.focus_cities
    ADD CONSTRAINT focus_cities_user_id_unique UNIQUE (user_id);
ALTER TABLE ONLY public.focus_dna
    ADD CONSTRAINT focus_dna_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.focus_dna
    ADD CONSTRAINT focus_dna_user_id_unique UNIQUE (user_id);
ALTER TABLE ONLY public.focus_profiles
    ADD CONSTRAINT focus_profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.focus_sessions
    ADD CONSTRAINT focus_sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.freeze_tokens
    ADD CONSTRAINT freeze_tokens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.freeze_tokens
    ADD CONSTRAINT freeze_tokens_user_id_unique UNIQUE (user_id);
ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.group_audit_logs
    ADD CONSTRAINT group_audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.group_challenge_progress
    ADD CONSTRAINT group_challenge_progress_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.group_challenges
    ADD CONSTRAINT group_challenges_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.group_invitations
    ADD CONSTRAINT group_invitations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.habit_completions
    ADD CONSTRAINT habit_completions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.habits
    ADD CONSTRAINT habits_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.leaderboard_snapshots
    ADD CONSTRAINT leaderboard_snapshots_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.login_rewards
    ADD CONSTRAINT login_rewards_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.login_rewards
    ADD CONSTRAINT login_rewards_user_id_unique UNIQUE (user_id);
ALTER TABLE ONLY public.loot_box_types
    ADD CONSTRAINT loot_box_types_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.marketplace_items
    ADD CONSTRAINT marketplace_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_mission_key_unique UNIQUE (mission_key);
ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.page_views
    ADD CONSTRAINT page_views_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_unique UNIQUE (token);
ALTER TABLE ONLY public.post_comments
    ADD CONSTRAINT post_comments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.post_reactions
    ADD CONSTRAINT post_reactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.post_saves
    ADD CONSTRAINT post_saves_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.premium_subscriptions
    ADD CONSTRAINT premium_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.premium_subscriptions
    ADD CONSTRAINT premium_subscriptions_user_id_unique UNIQUE (user_id);
ALTER TABLE ONLY public.productivity_logs
    ADD CONSTRAINT productivity_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.quest_definitions
    ADD CONSTRAINT quest_definitions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.readiness_logs
    ADD CONSTRAINT readiness_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.roadmaps
    ADD CONSTRAINT roadmaps_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.seasonal_events
    ADD CONSTRAINT seasonal_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.seasonal_events
    ADD CONSTRAINT seasonal_events_slug_unique UNIQUE (slug);
ALTER TABLE ONLY public.session_ghosts
    ADD CONSTRAINT session_ghosts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.shared_goals
    ADD CONSTRAINT shared_goals_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.study_buddies
    ADD CONSTRAINT study_buddies_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.study_groups
    ADD CONSTRAINT study_groups_invite_code_unique UNIQUE (invite_code);
ALTER TABLE ONLY public.study_groups
    ADD CONSTRAINT study_groups_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.study_room_members
    ADD CONSTRAINT study_room_members_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.study_rooms
    ADD CONSTRAINT study_rooms_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.study_streaks
    ADD CONSTRAINT study_streaks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.study_streaks
    ADD CONSTRAINT study_streaks_user_id_unique UNIQUE (user_id);
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_battle_pass_progress
    ADD CONSTRAINT user_battle_pass_progress_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_dreams
    ADD CONSTRAINT user_dreams_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_dreams
    ADD CONSTRAINT user_dreams_user_id_unique UNIQUE (user_id);
ALTER TABLE ONLY public.user_inventory
    ADD CONSTRAINT user_inventory_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_loot_boxes
    ADD CONSTRAINT user_loot_boxes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_mission_progress
    ADD CONSTRAINT user_mission_progress_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_pets
    ADD CONSTRAINT user_pets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_pets
    ADD CONSTRAINT user_pets_user_id_unique UNIQUE (user_id);
ALTER TABLE ONLY public.user_profile_extras
    ADD CONSTRAINT user_profile_extras_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_profile_extras
    ADD CONSTRAINT user_profile_extras_user_id_unique UNIQUE (user_id);
ALTER TABLE ONLY public.user_quest_progress
    ADD CONSTRAINT user_quest_progress_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_quest_progress
    ADD CONSTRAINT user_quest_progress_unique UNIQUE (user_id, quest_id, period);
ALTER TABLE ONLY public.user_seasonal_progress
    ADD CONSTRAINT user_seasonal_progress_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_seasonal_progress
    ADD CONSTRAINT user_seasonal_progress_unique UNIQUE (user_id, event_id);
ALTER TABLE ONLY public.user_wallets
    ADD CONSTRAINT user_wallets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_wallets
    ADD CONSTRAINT user_wallets_user_id_unique UNIQUE (user_id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_guest_key_unique UNIQUE (guest_key);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.visitors
    ADD CONSTRAINT visitors_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.wrapped_snapshots
    ADD CONSTRAINT wrapped_snapshots_pkey PRIMARY KEY (id);
CREATE INDEX analytics_events_created_at_idx ON public.analytics_events USING btree (created_at);
CREATE UNIQUE INDEX analytics_events_event_id_idx ON public.analytics_events USING btree (event_id);
CREATE INDEX analytics_events_visitor_id_idx ON public.analytics_events USING btree (visitor_id);
CREATE INDEX analytics_sessions_last_activity_idx ON public.analytics_sessions USING btree (last_activity_at);
CREATE INDEX analytics_sessions_visitor_id_idx ON public.analytics_sessions USING btree (visitor_id);
CREATE INDEX app_feedback_user_idx ON public.app_feedback USING btree (user_id);
CREATE INDEX audit_logs_user_idx ON public.audit_logs USING btree (user_id);
CREATE INDEX buddy_requests_receiver_idx ON public.buddy_requests USING btree (receiver_id);
CREATE INDEX city_building_slug_idx ON public.city_building_definitions USING btree (slug);
CREATE INDEX coin_tx_user_idx ON public.coin_transactions USING btree (user_id);
CREATE INDEX conv_participants_conv_user_idx ON public.conversation_participants USING btree (conversation_id, user_id);
CREATE INDEX conversations_group_idx ON public.conversations USING btree (group_id);
CREATE INDEX email_logs_created_at_idx ON public.email_logs USING btree (created_at);
CREATE INDEX email_logs_recipient_idx ON public.email_logs USING btree (recipient_id);
CREATE INDEX focus_cities_user_idx ON public.focus_cities USING btree (user_id);
CREATE INDEX focus_sessions_completed_at_idx ON public.focus_sessions USING btree (completed_at);
CREATE INDEX focus_sessions_user_id_idx ON public.focus_sessions USING btree (user_id);
CREATE INDEX follows_follower_idx ON public.follows USING btree (follower_id);
CREATE INDEX follows_following_idx ON public.follows USING btree (following_id);
CREATE INDEX friendships_addressee_idx ON public.friendships USING btree (addressee_id);
CREATE INDEX friendships_requester_idx ON public.friendships USING btree (requester_id);
CREATE INDEX group_audit_logs_group_idx ON public.group_audit_logs USING btree (group_id);
CREATE INDEX group_challenge_progress_chal_user_idx ON public.group_challenge_progress USING btree (challenge_id, user_id);
CREATE INDEX group_challenges_group_idx ON public.group_challenges USING btree (group_id);
CREATE INDEX group_invitations_group_idx ON public.group_invitations USING btree (group_id);
CREATE INDEX group_members_group_idx ON public.group_members USING btree (group_id);
CREATE INDEX group_members_user_idx ON public.group_members USING btree (user_id);
CREATE INDEX habit_completions_habit_idx ON public.habit_completions USING btree (habit_id);
CREATE INDEX habit_completions_user_date_idx ON public.habit_completions USING btree (user_id, date);
CREATE INDEX habits_user_idx ON public.habits USING btree (user_id);
CREATE INDEX leaderboard_snapshots_period_category_idx ON public.leaderboard_snapshots USING btree (period, category);
CREATE INDEX message_reactions_msg_user_idx ON public.message_reactions USING btree (message_id, user_id);
CREATE INDEX messages_conv_idx ON public.messages USING btree (conversation_id);
CREATE INDEX messages_created_at_idx ON public.messages USING btree (created_at);
CREATE INDEX mission_progress_user_period_idx ON public.user_mission_progress USING btree (user_id, period_start);
CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id);
CREATE INDEX page_views_session_id_idx ON public.page_views USING btree (session_id);
CREATE INDEX page_views_viewed_at_idx ON public.page_views USING btree (viewed_at);
CREATE INDEX page_views_visitor_id_idx ON public.page_views USING btree (visitor_id);
CREATE INDEX post_comments_post_idx ON public.post_comments USING btree (post_id);
CREATE INDEX post_likes_post_user_idx ON public.post_likes USING btree (post_id, user_id);
CREATE INDEX post_reactions_post_idx ON public.post_reactions USING btree (post_id);
CREATE INDEX post_saves_post_user_idx ON public.post_saves USING btree (post_id, user_id);
CREATE INDEX posts_created_at_idx ON public.posts USING btree (created_at);
CREATE INDEX posts_user_idx ON public.posts USING btree (user_id);
CREATE INDEX premium_subscriptions_user_idx ON public.premium_subscriptions USING btree (user_id);
CREATE INDEX productivity_logs_user_date_idx ON public.productivity_logs USING btree (user_id, date);
CREATE INDEX push_sub_user_idx ON public.push_subscriptions USING btree (user_id);
CREATE INDEX seasonal_events_slug_idx ON public.seasonal_events USING btree (slug);
CREATE INDEX shared_goals_group_idx ON public.shared_goals USING btree (group_id);
CREATE INDEX social_posts_created_at_idx ON public.social_posts USING btree (created_at);
CREATE INDEX social_posts_user_idx ON public.social_posts USING btree (user_id);
CREATE INDEX study_buddies_user_buddy_idx ON public.study_buddies USING btree (user_id, buddy_id);
CREATE INDEX study_room_members_room_idx ON public.study_room_members USING btree (room_id);
CREATE INDEX study_rooms_host_idx ON public.study_rooms USING btree (host_id);
CREATE INDEX study_rooms_status_idx ON public.study_rooms USING btree (status);
CREATE INDEX tasks_user_id_idx ON public.tasks USING btree (user_id);
CREATE INDEX user_battle_pass_user_pass_idx ON public.user_battle_pass_progress USING btree (user_id, battle_pass_id);
CREATE INDEX user_inventory_user_idx ON public.user_inventory USING btree (user_id);
CREATE INDEX user_loot_boxes_user_idx ON public.user_loot_boxes USING btree (user_id);
CREATE INDEX user_quest_progress_user_idx ON public.user_quest_progress USING btree (user_id);
CREATE INDEX user_seasonal_progress_user_idx ON public.user_seasonal_progress USING btree (user_id);
CREATE INDEX visitors_last_seen_idx ON public.visitors USING btree (last_seen);
CREATE INDEX visitors_user_id_idx ON public.visitors USING btree (user_id);
CREATE UNIQUE INDEX visitors_visitor_id_idx ON public.visitors USING btree (visitor_id);
CREATE INDEX wrapped_user_period_idx ON public.wrapped_snapshots USING btree (user_id, period);
ALTER TABLE ONLY public.active_sessions
    ADD CONSTRAINT active_sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.app_feedback
    ADD CONSTRAINT app_feedback_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.battle_pass_progress
    ADD CONSTRAINT battle_pass_progress_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.battle_pass_rewards
    ADD CONSTRAINT battle_pass_rewards_battle_pass_id_battle_passes_id_fk FOREIGN KEY (battle_pass_id) REFERENCES public.battle_passes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.break_free_moods
    ADD CONSTRAINT break_free_moods_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.break_free_streaks
    ADD CONSTRAINT break_free_streaks_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.buddy_requests
    ADD CONSTRAINT buddy_requests_receiver_id_users_id_fk FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.buddy_requests
    ADD CONSTRAINT buddy_requests_sender_id_users_id_fk FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT coin_transactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.consequence_contracts
    ADD CONSTRAINT consequence_contracts_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.distraction_logs
    ADD CONSTRAINT distraction_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_recipient_id_users_id_fk FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.focus_cities
    ADD CONSTRAINT focus_cities_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.focus_dna
    ADD CONSTRAINT focus_dna_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.focus_profiles
    ADD CONSTRAINT focus_profiles_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.focus_sessions
    ADD CONSTRAINT focus_sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_users_id_fk FOREIGN KEY (follower_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_following_id_users_id_fk FOREIGN KEY (following_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.freeze_tokens
    ADD CONSTRAINT freeze_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_addressee_id_users_id_fk FOREIGN KEY (addressee_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_requester_id_users_id_fk FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.group_audit_logs
    ADD CONSTRAINT group_audit_logs_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.group_challenge_progress
    ADD CONSTRAINT group_challenge_progress_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.group_challenges
    ADD CONSTRAINT group_challenges_creator_id_users_id_fk FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.group_invitations
    ADD CONSTRAINT group_invitations_invitee_id_users_id_fk FOREIGN KEY (invitee_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.group_invitations
    ADD CONSTRAINT group_invitations_inviter_id_users_id_fk FOREIGN KEY (inviter_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_study_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.study_groups(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.habit_completions
    ADD CONSTRAINT habit_completions_habit_id_habits_id_fk FOREIGN KEY (habit_id) REFERENCES public.habits(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.habit_completions
    ADD CONSTRAINT habit_completions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.habits
    ADD CONSTRAINT habits_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.login_rewards
    ADD CONSTRAINT login_rewards_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_users_id_fk FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.post_comments
    ADD CONSTRAINT post_comments_post_id_social_posts_id_fk FOREIGN KEY (post_id) REFERENCES public.social_posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.post_comments
    ADD CONSTRAINT post_comments_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.post_reactions
    ADD CONSTRAINT post_reactions_post_id_social_posts_id_fk FOREIGN KEY (post_id) REFERENCES public.social_posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.post_reactions
    ADD CONSTRAINT post_reactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.post_saves
    ADD CONSTRAINT post_saves_post_id_social_posts_id_fk FOREIGN KEY (post_id) REFERENCES public.social_posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.post_saves
    ADD CONSTRAINT post_saves_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.premium_subscriptions
    ADD CONSTRAINT premium_subscriptions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.productivity_logs
    ADD CONSTRAINT productivity_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.readiness_logs
    ADD CONSTRAINT readiness_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.roadmaps
    ADD CONSTRAINT roadmaps_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.session_ghosts
    ADD CONSTRAINT session_ghosts_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.shared_goals
    ADD CONSTRAINT shared_goals_creator_id_users_id_fk FOREIGN KEY (creator_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_group_id_study_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.study_groups(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.study_buddies
    ADD CONSTRAINT study_buddies_buddy_id_users_id_fk FOREIGN KEY (buddy_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.study_buddies
    ADD CONSTRAINT study_buddies_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.study_groups
    ADD CONSTRAINT study_groups_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.study_room_members
    ADD CONSTRAINT study_room_members_room_id_study_rooms_id_fk FOREIGN KEY (room_id) REFERENCES public.study_rooms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.study_room_members
    ADD CONSTRAINT study_room_members_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.study_rooms
    ADD CONSTRAINT study_rooms_group_id_study_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.study_groups(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.study_rooms
    ADD CONSTRAINT study_rooms_host_id_users_id_fk FOREIGN KEY (host_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.study_streaks
    ADD CONSTRAINT study_streaks_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_battle_pass_progress
    ADD CONSTRAINT user_battle_pass_progress_battle_pass_id_battle_passes_id_fk FOREIGN KEY (battle_pass_id) REFERENCES public.battle_passes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_battle_pass_progress
    ADD CONSTRAINT user_battle_pass_progress_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_dreams
    ADD CONSTRAINT user_dreams_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_inventory
    ADD CONSTRAINT user_inventory_item_id_marketplace_items_id_fk FOREIGN KEY (item_id) REFERENCES public.marketplace_items(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_inventory
    ADD CONSTRAINT user_inventory_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_loot_boxes
    ADD CONSTRAINT user_loot_boxes_box_type_id_loot_box_types_id_fk FOREIGN KEY (box_type_id) REFERENCES public.loot_box_types(id);
ALTER TABLE ONLY public.user_loot_boxes
    ADD CONSTRAINT user_loot_boxes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_mission_progress
    ADD CONSTRAINT user_mission_progress_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_pets
    ADD CONSTRAINT user_pets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_profile_extras
    ADD CONSTRAINT user_profile_extras_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_quest_progress
    ADD CONSTRAINT user_quest_progress_quest_id_quest_definitions_id_fk FOREIGN KEY (quest_id) REFERENCES public.quest_definitions(id);
ALTER TABLE ONLY public.user_quest_progress
    ADD CONSTRAINT user_quest_progress_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_seasonal_progress
    ADD CONSTRAINT user_seasonal_progress_event_id_seasonal_events_id_fk FOREIGN KEY (event_id) REFERENCES public.seasonal_events(id);
ALTER TABLE ONLY public.user_seasonal_progress
    ADD CONSTRAINT user_seasonal_progress_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_wallets
    ADD CONSTRAINT user_wallets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.visitors
    ADD CONSTRAINT visitors_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.wrapped_snapshots
    ADD CONSTRAINT wrapped_snapshots_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
