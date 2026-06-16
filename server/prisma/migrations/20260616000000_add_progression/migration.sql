-- Progression economy: lifetime XP (level is derived), soft-currency coins, and
-- the player's equipped cosmetic frame/title. Cosmetic OWNERSHIP reuses the
-- existing feature_unlocks table (feature = cosmetic id). Additive + safe.
ALTER TABLE "users" ADD COLUMN "xp"            INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "coins"         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "equippedFrame" TEXT;
ALTER TABLE "users" ADD COLUMN "equippedTitle" TEXT;
