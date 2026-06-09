CREATE TABLE "city_building_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"district" text NOT NULL,
	"category" text NOT NULL,
	"unlock_level" integer DEFAULT 1 NOT NULL,
	"unlock_sessions" integer DEFAULT 0 NOT NULL,
	"coin_cost" integer DEFAULT 0 NOT NULL,
	"population_bonus" integer DEFAULT 10 NOT NULL,
	"xp_bonus_per_session" integer DEFAULT 0 NOT NULL,
	"coin_bonus_per_session" integer DEFAULT 0 NOT NULL,
	"icon" text NOT NULL,
	"tier" text DEFAULT 'hamlet' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "city_building_definitions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "focus_cities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tier" text DEFAULT 'hamlet' NOT NULL,
	"tier_name" text DEFAULT 'Study Hamlet' NOT NULL,
	"population" integer DEFAULT 5 NOT NULL,
	"total_buildings" integer DEFAULT 0 NOT NULL,
	"total_sessions" integer DEFAULT 0 NOT NULL,
	"unlocked_districts" jsonb DEFAULT '["downtown"]'::jsonb,
	"buildings" jsonb DEFAULT '{}'::jsonb,
	"atmosphere" text DEFAULT 'day' NOT NULL,
	"weather" text DEFAULT 'clear' NOT NULL,
	"weather_updated_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "focus_cities_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "app_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"rating" integer NOT NULL,
	"message" text,
	"category" text DEFAULT 'general',
	"session_count" integer DEFAULT 0,
	"user_level" integer DEFAULT 1,
	"device" text,
	"app_version" text DEFAULT '1.0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_id" text,
	"recipient_email" text NOT NULL,
	"template" text NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_id" text,
	"sent_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"bounced" boolean DEFAULT false,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'avatar' NOT NULL,
	"cost_coins" integer DEFAULT 100 NOT NULL,
	"rarity" text DEFAULT 'common',
	"emoji" text DEFAULT '🎁',
	"data" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "premium_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"coins_cost" integer DEFAULT 9000,
	"benefits" jsonb DEFAULT '["exclusive_pets","premium_loot_boxes","premium_themes","xp_multiplier","coin_multiplier","premium_analytics","profile_badge","premium_battle_pass"]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"granted_by_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "premium_subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_dreams" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dream_type" text DEFAULT 'custom' NOT NULL,
	"custom_goal" text,
	"target_date" text,
	"daily_target_minutes" integer DEFAULT 120,
	"total_minutes_logged" integer DEFAULT 0,
	"start_date" text,
	"emoji" text DEFAULT '🎯',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_dreams_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"acquired_at" timestamp DEFAULT now() NOT NULL,
	"equipped" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_pets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"pet_type" text DEFAULT 'owl' NOT NULL,
	"pet_name" text,
	"pet_level" integer DEFAULT 1 NOT NULL,
	"pet_xp" integer DEFAULT 0 NOT NULL,
	"evolution_stage" integer DEFAULT 1 NOT NULL,
	"mood" text DEFAULT 'happy',
	"accessories" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_pets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "wrapped_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period" text NOT NULL,
	"period_type" text DEFAULT 'monthly' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loot_box_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"rarity" text NOT NULL,
	"coin_cost" integer DEFAULT 0 NOT NULL,
	"sessions_required" integer DEFAULT 0 NOT NULL,
	"icon" text NOT NULL,
	"glow_color" text DEFAULT '#7C3AED' NOT NULL,
	"possible_rewards" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_loot_boxes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"box_type_id" text NOT NULL,
	"status" text DEFAULT 'unopened' NOT NULL,
	"reward_type" text,
	"reward_value" jsonb,
	"earned_reason" text,
	"opened_at" timestamp,
	"earned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quest_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"difficulty" text DEFAULT 'easy' NOT NULL,
	"target" integer NOT NULL,
	"metric" text NOT NULL,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"coin_reward" integer DEFAULT 0 NOT NULL,
	"icon" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"rotation_weight" integer DEFAULT 10 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_quest_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"quest_id" text NOT NULL,
	"period" text NOT NULL,
	"current" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_quest_progress_unique" UNIQUE("user_id","quest_id","period")
);
--> statement-breakpoint
CREATE TABLE "seasonal_events" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"theme" text NOT NULL,
	"banner_color" text DEFAULT '#7C3AED' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"xp_multiplier" real DEFAULT 1 NOT NULL,
	"coin_multiplier" real DEFAULT 1 NOT NULL,
	"special_missions" jsonb DEFAULT '[]'::jsonb,
	"exclusive_rewards" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seasonal_events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_seasonal_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_id" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"completed_missions" jsonb DEFAULT '[]'::jsonb,
	"rewards_claimed" jsonb DEFAULT '[]'::jsonb,
	"rank" integer,
	CONSTRAINT "user_seasonal_progress_unique" UNIQUE("user_id","event_id")
);
--> statement-breakpoint
ALTER TABLE "focus_cities" ADD CONSTRAINT "focus_cities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_feedback" ADD CONSTRAINT "app_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premium_subscriptions" ADD CONSTRAINT "premium_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dreams" ADD CONSTRAINT "user_dreams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_item_id_marketplace_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."marketplace_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_pets" ADD CONSTRAINT "user_pets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wrapped_snapshots" ADD CONSTRAINT "wrapped_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_loot_boxes" ADD CONSTRAINT "user_loot_boxes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_loot_boxes" ADD CONSTRAINT "user_loot_boxes_box_type_id_loot_box_types_id_fk" FOREIGN KEY ("box_type_id") REFERENCES "public"."loot_box_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_quest_id_quest_definitions_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quest_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_seasonal_progress" ADD CONSTRAINT "user_seasonal_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_seasonal_progress" ADD CONSTRAINT "user_seasonal_progress_event_id_seasonal_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."seasonal_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "city_building_slug_idx" ON "city_building_definitions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "focus_cities_user_idx" ON "focus_cities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "app_feedback_user_idx" ON "app_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_logs_recipient_idx" ON "email_logs" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "email_logs_created_at_idx" ON "email_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "premium_subscriptions_user_idx" ON "premium_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_inventory_user_idx" ON "user_inventory" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wrapped_user_period_idx" ON "wrapped_snapshots" USING btree ("user_id","period");--> statement-breakpoint
CREATE INDEX "user_loot_boxes_user_idx" ON "user_loot_boxes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_quest_progress_user_idx" ON "user_quest_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "seasonal_events_slug_idx" ON "seasonal_events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "user_seasonal_progress_user_idx" ON "user_seasonal_progress" USING btree ("user_id");