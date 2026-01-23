-- Migration: Create OTPs table
-- Run this SQL manually if migrations can't be run via ace command

CREATE TABLE IF NOT EXISTS "otps" (
  "id" SERIAL PRIMARY KEY,
  "email" VARCHAR(254) NOT NULL,
  "code" VARCHAR(6) NOT NULL,
  "verified" BOOLEAN DEFAULT false,
  "expires_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "otps_email_index" ON "otps" ("email");
CREATE INDEX IF NOT EXISTS "otps_email_verified_index" ON "otps" ("email", "verified");
