-- Remove all guest accounts (inflated "total users" in admin before site analytics).
-- Run in Neon SQL Editor: Primary branch → neondb → paste → Run.
-- Related rows cascade-delete via foreign keys on users(id).

DELETE FROM users WHERE is_guest = true;

-- Verify:
SELECT
  count(*) FILTER (WHERE is_guest = true)  AS guests_remaining,
  count(*) FILTER (WHERE is_guest = false) AS registered_users
FROM users;
