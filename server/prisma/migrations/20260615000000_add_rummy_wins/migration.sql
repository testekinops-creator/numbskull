-- Add the win counter for Indian Rummy (multiplayer). /game/record updates this
-- User column on a win; the GameMode enum is untouched (match games don't use it).
ALTER TABLE "users" ADD COLUMN "rummyWins" INTEGER NOT NULL DEFAULT 0;
