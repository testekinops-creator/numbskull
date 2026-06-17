-- Durable social graph: friendships, pending friend requests, and blocks now
-- persist in Postgres instead of server memory, so they survive restarts and
-- deploys (previously every redeploy wiped everyone's friends). Plain id columns
-- (no FK) keep this additive and independent of the users table.

CREATE TABLE "friendships" (
    "id"        TEXT NOT NULL,
    "userAId"   TEXT NOT NULL,
    "userBId"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "friendships_userAId_userBId_key" ON "friendships"("userAId", "userBId");
CREATE INDEX "friendships_userAId_idx" ON "friendships"("userAId");
CREATE INDEX "friendships_userBId_idx" ON "friendships"("userBId");

CREATE TABLE "friend_requests" (
    "id"        TEXT NOT NULL,
    "fromId"    TEXT NOT NULL,
    "toId"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "friend_requests_fromId_toId_key" ON "friend_requests"("fromId", "toId");
CREATE INDEX "friend_requests_toId_idx" ON "friend_requests"("toId");

CREATE TABLE "user_blocks" (
    "id"        TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_blocks_blockerId_blockedId_key" ON "user_blocks"("blockerId", "blockedId");
CREATE INDEX "user_blocks_blockerId_idx" ON "user_blocks"("blockerId");
