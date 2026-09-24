-- Audio-first ambient catalog, release workflow, and private admin insights.
-- Direct audio is the only supported source: there is intentionally no YouTube
-- URL column or player. Browser clients use a native Audio element instead.

CREATE TABLE IF NOT EXISTS "ambient_tracks" (
  "id" text PRIMARY KEY NOT NULL,
  "label" text NOT NULL,
  "emoji" text DEFAULT '🎵' NOT NULL,
  "audio_url" text NOT NULL,
  "credit" text DEFAULT '' NOT NULL,
  "source_url" text DEFAULT '' NOT NULL,
  "source_license" text DEFAULT '' NOT NULL,
  "looping" boolean DEFAULT true NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "created_by_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "published_at" timestamp,
  "archived_at" timestamp
);
CREATE INDEX IF NOT EXISTS "ambient_tracks_status_published_idx"
  ON "ambient_tracks" ("status", "published_at");
CREATE INDEX IF NOT EXISTS "ambient_tracks_created_by_idx"
  ON "ambient_tracks" ("created_by_id");

CREATE TABLE IF NOT EXISTS "ambient_track_listens" (
  "id" text PRIMARY KEY NOT NULL,
  "track_id" text NOT NULL REFERENCES "ambient_tracks"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "listened_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ambient_track_listens_track_date_idx"
  ON "ambient_track_listens" ("track_id", "listened_at");
CREATE INDEX IF NOT EXISTS "ambient_track_listens_user_date_idx"
  ON "ambient_track_listens" ("user_id", "listened_at");

-- The selected profile mark is a short, validated icon id, not an uploaded
-- image or a full font bundle. Existing profiles remain unchanged (NULL).
ALTER TABLE "user_profile_extras"
  ADD COLUMN IF NOT EXISTS "profile_icon" text;

-- Preserve prior direct-audio entries. Legacy YouTube entries are deliberately
-- excluded: extracting their audio is not supported by browser or platform
-- policy, and the new mixer never embeds a video.
INSERT INTO "ambient_tracks" (
  "id", "label", "emoji", "audio_url", "credit", "looping", "status", "created_at", "updated_at", "published_at"
)
SELECT
  COALESCE(NULLIF(track->>'id', ''), 'legacy-' || md5(track::text)),
  COALESCE(NULLIF(track->>'label', ''), 'Ambient audio'),
  COALESCE(NULLIF(track->>'emoji', ''), '🎵'),
  track->>'url',
  COALESCE(track->>'credit', ''),
  true,
  'published',
  now(), now(), now()
FROM "platform_meta", jsonb_array_elements(
  CASE WHEN jsonb_typeof("platform_meta"."value") = 'array'
    THEN "platform_meta"."value" ELSE '[]'::jsonb END
) AS tracks(track)
WHERE "platform_meta"."key" = 'ambient_custom_tracks_v1'
  AND COALESCE(track->>'url', '') <> ''
  AND COALESCE(track->>'url', '') !~* '(youtube\\.com|youtu\\.be)'
ON CONFLICT ("id") DO NOTHING;

-- Starter recordings are packaged with FocusArx under the upstream MIT terms.
-- They begin as drafts so an administrator explicitly reviews and releases
-- each one; a deploy never silently exposes a new recording.
INSERT INTO "ambient_tracks" (
  "id", "label", "emoji", "audio_url", "credit", "source_url", "source_license", "looping", "status"
) VALUES
  ('chillnsound-rain', 'Steady Rain', '🌧️', '/ambient/chillnsound/rain.mp3', 'Stefan Petrovic · Chill n'' Sound', 'https://github.com/petrovicstefanrs/chillnsound/tree/master/app/sounds', 'MIT', true, 'draft'),
  ('chillnsound-forest', 'Forest Air', '🌲', '/ambient/chillnsound/forest.mp3', 'Stefan Petrovic · Chill n'' Sound', 'https://github.com/petrovicstefanrs/chillnsound/tree/master/app/sounds', 'MIT', true, 'draft'),
  ('chillnsound-river', 'Flowing River', '🏞️', '/ambient/chillnsound/river.mp3', 'Stefan Petrovic · Chill n'' Sound', 'https://github.com/petrovicstefanrs/chillnsound/tree/master/app/sounds', 'MIT', true, 'draft'),
  ('chillnsound-beach', 'Quiet Shore', '🌊', '/ambient/chillnsound/beach.mp3', 'Stefan Petrovic · Chill n'' Sound', 'https://github.com/petrovicstefanrs/chillnsound/tree/master/app/sounds', 'MIT', true, 'draft'),
  ('chillnsound-fire', 'Hearth Fire', '🔥', '/ambient/chillnsound/fire.mp3', 'Stefan Petrovic · Chill n'' Sound', 'https://github.com/petrovicstefanrs/chillnsound/tree/master/app/sounds', 'MIT', true, 'draft'),
  ('chillnsound-birds', 'Morning Birds', '🐦', '/ambient/chillnsound/birds.mp3', 'Stefan Petrovic · Chill n'' Sound', 'https://github.com/petrovicstefanrs/chillnsound/tree/master/app/sounds', 'MIT', true, 'draft'),
  ('chillnsound-leaves', 'Rustling Leaves', '🍃', '/ambient/chillnsound/leaves.mp3', 'Stefan Petrovic · Chill n'' Sound', 'https://github.com/petrovicstefanrs/chillnsound/tree/master/app/sounds', 'MIT', true, 'draft'),
  ('chillnsound-windchimes', 'Soft Wind Chimes', '🎐', '/ambient/chillnsound/windchimes.mp3', 'Stefan Petrovic · Chill n'' Sound', 'https://github.com/petrovicstefanrs/chillnsound/tree/master/app/sounds', 'MIT', true, 'draft')
ON CONFLICT ("id") DO NOTHING;
