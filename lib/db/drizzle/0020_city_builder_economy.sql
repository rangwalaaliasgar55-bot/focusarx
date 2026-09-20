-- Persistent placement and citizen-tax clock for the interactive Focus City.
ALTER TABLE IF EXISTS "focus_cities"
  ADD COLUMN IF NOT EXISTS "building_layout" jsonb DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS "focus_cities"
  ADD COLUMN IF NOT EXISTS "last_tax_at" timestamp DEFAULT now() NOT NULL;

-- A complete starter catalog makes the city playable on fresh deployments.
INSERT INTO "city_building_definitions"
  ("id", "slug", "name", "description", "district", "category", "unlock_level", "unlock_sessions", "coin_cost", "population_bonus", "xp_bonus_per_session", "coin_bonus_per_session", "icon", "tier", "sort_order")
VALUES
  ('city-study-nook', 'study-nook', 'Study Nook', 'A warm first home for focused citizens.', 'downtown', 'residential', 1, 0, 0, 12, 0, 0, '🏡', 'hamlet', 1),
  ('city-bookshop', 'bookshop', 'Corner Bookshop', 'Books, stationery, and jobs for curious minds.', 'downtown', 'commercial', 1, 1, 80, 18, 0, 2, '📚', 'hamlet', 2),
  ('city-park', 'focus-park', 'Focus Park', 'Green space improves the district for everyone.', 'downtown', 'nature', 2, 3, 140, 25, 1, 0, '🌳', 'village', 3),
  ('city-cafe', 'study-cafe', 'Study Café', 'A lively meeting place with dependable revenue.', 'downtown', 'commercial', 3, 5, 220, 32, 0, 4, '☕', 'village', 4),
  ('city-library', 'grand-library', 'Grand Library', 'A civic home for deep work and shared knowledge.', 'academy', 'education', 4, 10, 420, 55, 3, 3, '🏛️', 'town', 5),
  ('city-clinic', 'wellness-clinic', 'Wellness Clinic', 'Keeps citizens healthy through demanding seasons.', 'academy', 'service', 5, 15, 650, 75, 1, 2, '🏥', 'town', 6),
  ('city-lab', 'innovation-lab', 'Innovation Lab', 'Turns focused hours into new ideas and skilled jobs.', 'academy', 'education', 7, 25, 950, 110, 5, 5, '🔬', 'city', 7),
  ('city-transit', 'focus-transit', 'Focus Transit', 'Connects every district with clean transport.', 'downtown', 'infrastructure', 8, 35, 1250, 145, 2, 6, '🚉', 'city', 8),
  ('city-tower', 'knowledge-tower', 'Knowledge Tower', 'A landmark headquarters for ambitious citizens.', 'skyline', 'commercial', 10, 50, 1800, 210, 4, 10, '🏙️', 'metropolis', 9),
  ('city-solar', 'solar-campus', 'Solar Campus', 'Clean energy powers a growing academic capital.', 'skyline', 'utility', 12, 70, 2400, 260, 5, 9, '☀️', 'metropolis', 10),
  ('city-observatory', 'observatory', 'Starlight Observatory', 'A destination for discovery beyond the skyline.', 'skyline', 'landmark', 15, 100, 3400, 360, 8, 12, '🔭', 'civilization', 11),
  ('city-arcology', 'focus-arcology', 'Focus Arcology', 'A self-sustaining vertical district for master focusers.', 'skyline', 'landmark', 20, 175, 5000, 600, 12, 20, '🌆', 'civilization', 12)
ON CONFLICT ("slug") DO NOTHING;
