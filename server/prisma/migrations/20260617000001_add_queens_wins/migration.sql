-- Per-mode win counter for Queens (mirrors rummyWins). Additive + safe.
ALTER TABLE "users" ADD COLUMN "queensWins" INTEGER NOT NULL DEFAULT 0;
