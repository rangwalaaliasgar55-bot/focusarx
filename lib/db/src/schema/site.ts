import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Admin-controlled site configuration (key-value store).
 * Keys:
 *   - maintenance_mode    ("true" | "false")
 *   - maintenance_message (shown to visitors during maintenance)
 *   - announcement_enabled ("true" | "false")
 *   - announcement_title / announcement_text / announcement_emoji
 *   - branding_name / branding_tagline
 *
 * A single row approach keeps reads trivial; admins edit via the Site Settings tab.
 */
export const siteSettingsTable = pgTable("site_settings", {
  id: text("id").primaryKey().$defaultFn(() => "default"),
  maintenanceMode: boolean("maintenance_mode").default(false).notNull(),
  maintenanceMessage: text("maintenance_message"),
  announcementEnabled: boolean("announcement_enabled").default(false).notNull(),
  announcementTitle: text("announcement_title"),
  announcementText: text("announcement_text"),
  announcementEmoji: text("announcement_emoji"),
  brandingName: text("branding_name").default("FocusArx").notNull(),
  brandingTagline: text("branding_tagline"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SiteSettings = typeof siteSettingsTable.$inferSelect;
