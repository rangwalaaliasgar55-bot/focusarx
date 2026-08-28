#!/usr/bin/env node

/**
 * Safe seed script for development and preview environments.
 *
 * Creates non-sensitive test data:
 * - Demo user accounts
 * - Sample tasks and goals
 * - Sample focus sessions
 * - Study groups
 *
 * Usage:
 *   node lib/db/scripts/seed.mjs                    # Seed with default data
 *   node lib/db/scripts/seed.mjs --preview          # Minimal preview data
 *   node lib/db/scripts/seed.mjs --clear            # Clear seeded data first
 *
 * Safety:
 * - Never seeds production (checks VERCEL_ENV)
 * - Uses UPSERT to be idempotent
 * - Never creates sensitive data (no real emails or passwords)
 */

import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

// Safety: never run in production
if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
  console.error("ERROR: Seed script must not run against production.");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const isClear = process.argv.includes("--clear");
const isPreview = process.argv.includes("--preview");

async function clearData() {
  console.log("Clearing seeded data...");
  await pool.query("DELETE FROM user_mission_progress WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@seed.focusarx.dev')");
  await pool.query("DELETE FROM focus_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@seed.focusarx.dev')");
  await pool.query("DELETE FROM tasks WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@seed.focusarx.dev')");
  await pool.query("DELETE FROM goals WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@seed.focusarx.dev')");
  await pool.query("DELETE FROM study_streaks WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@seed.focusarx.dev')");
  await pool.query("DELETE FROM user_wallets WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@seed.focusarx.dev')");
  await pool.query("DELETE FROM users WHERE email LIKE '%@seed.focusarx.dev'");
  console.log("Seed data cleared.");
}

async function seedUsers() {
  console.log("Creating seed users...");
  const users = [
    { email: "demo@seed.focusarx.dev", name: "Demo User", role: "user" },
    { email: "power@seed.focusarx.dev", name: "Power Student", role: "user" },
    { email: "casual@seed.focusarx.dev", name: "Casual Learner", role: "user" },
  ];

  for (const u of users) {
    await pool.query(
      `INSERT INTO users (id, email, name, role, onboarding_completed, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, true, NOW())
       ON CONFLICT (email) DO NOTHING`,
      [u.email, u.name, u.role]
    );
  }
  console.log(`  Created ${users.length} seed users.`);
}

async function seedTasks() {
  console.log("Creating seed tasks...");
  const { rows: users } = await pool.query("SELECT id FROM users WHERE email = 'demo@seed.focusarx.dev'");
  if (users.length === 0) return;
  const userId = users[0].id;

  const tasks = [
    { text: "Review Chapter 5: Organic Chemistry", priority: "high", category: "Chemistry", estimated: 45 },
    { text: "Complete calculus problem set 7", priority: "medium", category: "Math", estimated: 60 },
    { text: "Read 30 pages of 'Deep Work'", priority: "low", category: "Reading", estimated: 30 },
    { text: "Practice Spanish vocabulary", priority: "medium", category: "Languages", estimated: 20 },
    { text: "Write essay outline for History class", priority: "high", category: "History", estimated: 40 },
  ];

  for (const t of tasks) {
    await pool.query(
      `INSERT INTO tasks (id, user_id, text, priority, category, estimated_minutes, completed, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, NOW())
       ON CONFLICT DO NOTHING`,
      [userId, t.text, t.priority, t.category, t.estimated]
    );
  }
  console.log(`  Created ${tasks.length} seed tasks.`);
}

async function seedGoals() {
  console.log("Creating seed goals...");
  const { rows: users } = await pool.query("SELECT id FROM users WHERE email = 'demo@seed.focusarx.dev'");
  if (users.length === 0) return;
  const userId = users[0].id;

  const goals = [
    { title: "Pass Calculus Final", description: "Score 85% or higher" },
    { title: "Read 12 books this semester", description: "Mix of textbooks and non-fiction" },
    { title: "Build a 30-day study streak", description: "Study at least 25 minutes every day" },
  ];

  for (const g of goals) {
    await pool.query(
      `INSERT INTO goals (id, user_id, title, description, completed, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, false, NOW())
       ON CONFLICT DO NOTHING`,
      [userId, g.title, g.description]
    );
  }
  console.log(`  Created ${goals.length} seed goals.`);
}

async function seedWallets() {
  console.log("Creating seed wallets...");
  const { rows: users } = await pool.query("SELECT id FROM users WHERE email LIKE '%@seed.focusarx.dev'");
  for (const u of users) {
    await pool.query(
      `INSERT INTO user_wallets (id, user_id, coins, total_xp, level, updated_at)
       VALUES (gen_random_uuid(), $1, 500, 2500, 5, NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [u.id]
    );
  }
  console.log(`  Created wallets for ${users.length} users.`);
}

async function seedStreaks() {
  console.log("Creating seed streaks...");
  const { rows: users } = await pool.query("SELECT id FROM users WHERE email LIKE '%@seed.focusarx.dev'");
  for (const u of users) {
    await pool.query(
      `INSERT INTO study_streaks (id, user_id, current_streak, longest_streak, last_study_date, updated_at)
       VALUES (gen_random_uuid(), $1, 5, 12, CURRENT_DATE::text, NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [u.id]
    );
  }
  console.log(`  Created streaks for ${users.length} users.`);
}

async function main() {
  try {
    if (isClear) {
      await clearData();
      if (process.argv.length <= 3) {
        console.log("Done (clear only).");
        await pool.end();
        return;
      }
    }

    await seedUsers();
    await seedTasks();
    await seedGoals();
    await seedWallets();
    await seedStreaks();

    if (!isPreview) {
      // Additional data for full development seed
      const { rows: users } = await pool.query("SELECT id FROM users WHERE email = 'power@seed.focusarx.dev'");
      if (users.length > 0) {
        console.log("Creating additional data for power user...");
        const userId = users[0].id;

        // Sample focus sessions for the past 7 days
        for (let day = 0; day < 7; day++) {
          const date = new Date();
          date.setDate(date.getDate() - day);
          const durationSec = 900 + Math.floor(Math.random() * 1200);
          await pool.query(
            `INSERT INTO focus_sessions (id, user_id, mode, duration_sec, session_status, focus_score, category, completed_at, created_at)
             VALUES (gen_random_uuid(), $1, 'focus', $2, 'completed', $3, 'General', $4, $4)`,
            [userId, durationSec, 60 + Math.floor(Math.random() * 35), date]
          );
        }
        console.log("  Created 7 days of focus sessions.");
      }
    }

    console.log("\n✅ Seed completed successfully.");
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
