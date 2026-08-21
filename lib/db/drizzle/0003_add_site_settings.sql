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
	"updated_at" timestamp DEFAULT now() NOT NULL
);
