-- Site analytics tables — run in Neon SQL Editor if not auto-migrated on deploy

CREATE TABLE IF NOT EXISTS visitors (
  id text PRIMARY KEY,
  visitor_id text NOT NULL UNIQUE,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  first_seen timestamp NOT NULL DEFAULT now(),
  last_seen timestamp NOT NULL DEFAULT now(),
  visit_count integer NOT NULL DEFAULT 0,
  device_type text,
  browser text,
  os text,
  country text,
  city text,
  is_bot boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS visitors_last_seen_idx ON visitors(last_seen);
CREATE INDEX IF NOT EXISTS visitors_user_id_idx ON visitors(user_id);

CREATE TABLE IF NOT EXISTS analytics_sessions (
  id text PRIMARY KEY,
  visitor_id text NOT NULL,
  session_start timestamp NOT NULL DEFAULT now(),
  session_end timestamp,
  duration_sec integer NOT NULL DEFAULT 0,
  page_views integer NOT NULL DEFAULT 0,
  focus_sessions_started integer NOT NULL DEFAULT 0,
  tasks_created integer NOT NULL DEFAULT 0,
  roadmaps_generated integer NOT NULL DEFAULT 0,
  ai_features_used integer NOT NULL DEFAULT 0,
  last_activity_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_sessions_visitor_id_idx ON analytics_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS analytics_sessions_last_activity_idx ON analytics_sessions(last_activity_at);

CREATE TABLE IF NOT EXISTS page_views (
  id text PRIMARY KEY,
  visitor_id text NOT NULL,
  session_id text NOT NULL,
  page text NOT NULL,
  viewed_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_views_visitor_id_idx ON page_views(visitor_id);
CREATE INDEX IF NOT EXISTS page_views_session_id_idx ON page_views(session_id);
CREATE INDEX IF NOT EXISTS page_views_viewed_at_idx ON page_views(viewed_at);

CREATE TABLE IF NOT EXISTS analytics_events (
  id text PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  visitor_id text NOT NULL,
  session_id text,
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS analytics_events_visitor_id_idx ON analytics_events(visitor_id);
