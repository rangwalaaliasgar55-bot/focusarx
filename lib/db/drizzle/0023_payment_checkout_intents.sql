-- Bind hosted payment orders to users before accepting signed callbacks.
CREATE TABLE IF NOT EXISTS "payment_checkout_intents" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "provider_order_id" text NOT NULL,
  "interval" text NOT NULL,
  "amount_minor" integer NOT NULL,
  "currency" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "provider_payment_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "payment_checkout_intents_provider_order_uidx"
  ON "payment_checkout_intents" ("provider", "provider_order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_checkout_intents_provider_payment_uidx"
  ON "payment_checkout_intents" ("provider", "provider_payment_id");
CREATE INDEX IF NOT EXISTS "payment_checkout_intents_user_created_idx"
  ON "payment_checkout_intents" ("user_id", "created_at");
