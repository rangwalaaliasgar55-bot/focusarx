import { pgTable, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { usersTable as users } from './focusarx';

export const focusCitiesTable = pgTable('focus_cities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  tier: text('tier').notNull().default('hamlet'),
  tierName: text('tier_name').notNull().default('Study Hamlet'),
  population: integer('population').notNull().default(5),
  totalBuildings: integer('total_buildings').notNull().default(0),
  totalSessions: integer('total_sessions').notNull().default(0),
  unlockedDistricts: jsonb('unlocked_districts').$type<string[]>().default(['downtown']),
  buildings: jsonb('buildings').$type<Record<string, boolean>>().default({}),
  atmosphere: text('atmosphere').notNull().default('day'),
  selectedSkin: text('selected_skin').notNull().default('classic'),
  weather: text('weather').notNull().default('clear'),
  weatherUpdatedAt: timestamp('weather_updated_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('focus_cities_user_idx').on(t.userId)]);

export type FocusCity = typeof focusCitiesTable.$inferSelect;

export const cityBuildingDefinitionsTable = pgTable('city_building_definitions', {
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
  tier: text('tier').notNull().default('hamlet'),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [index('city_building_slug_idx').on(t.slug)]);

export type CityBuildingDefinition = typeof cityBuildingDefinitionsTable.$inferSelect;
