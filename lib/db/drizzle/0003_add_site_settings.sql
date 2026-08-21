-- Site-wide admin settings: maintenance mode, announcements, branding.
CREATE TABLE IF NOT EXISTS "site_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"maintenance_message" text,
	"announcement_enabled" boolean DEFAULT false NOT NULL,
	"announcement_title" text,
	"announcement_text" text,
	"announcement_emoji" text,
	"branding_name" text DEFAULT 'FocusArx' NOT NULL,
	"branding_tagline" text,
	"hero_title" text,
	"hero_subtitle" text,
	"hero_cta_text" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "hero_title" text;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "hero_subtitle" text;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "hero_cta_text" text;
