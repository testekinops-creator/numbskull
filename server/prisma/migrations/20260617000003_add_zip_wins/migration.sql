-- Per-mode win counter for Zip (mirrors tangoWins). Additive + safe.
ALTER TABLE "users" ADD COLUMN "zipWins" INTEGER NOT NULL DEFAULT 0;
