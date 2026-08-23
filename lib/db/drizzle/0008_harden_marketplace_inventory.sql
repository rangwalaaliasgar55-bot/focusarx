-- Remove duplicate inventory rows before enforcing one ownership row per item.
DELETE FROM "user_inventory" a
USING "user_inventory" b
WHERE a."user_id" = b."user_id"
  AND a."item_id" = b."item_id"
  AND a."id" > b."id";

CREATE UNIQUE INDEX IF NOT EXISTS "user_inventory_user_item_unique"
  ON "user_inventory" ("user_id", "item_id");
