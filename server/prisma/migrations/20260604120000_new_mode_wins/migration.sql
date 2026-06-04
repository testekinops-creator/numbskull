-- Add win counters for the new game modes (XOX, Math Battle, Sudoku).
-- /game/record only updates these User columns; the GameMode enum is untouched.
ALTER TABLE "users" ADD COLUMN "xoxWins"    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "mathWins"   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "sudokuWins" INTEGER NOT NULL DEFAULT 0;
