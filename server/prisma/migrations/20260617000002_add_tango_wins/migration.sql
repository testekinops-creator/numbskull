-- Per-mode win counter for Tango (mirrors queensWins). Additive + safe.
ALTER TABLE "users" ADD COLUMN "tangoWins" INTEGER NOT NULL DEFAULT 0;
