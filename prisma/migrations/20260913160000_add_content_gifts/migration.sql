-- Coin gifts outside live streams.
--
-- Gifts could only be sent on live streams (livestream_gifts). This records
-- gifts to a post (feed posts, reels and community posts all live in `posts`)
-- or directly to a user's profile. The per-post count is also kept on
-- posts.engagement.totalGifts so feeds can show it without a join.
CREATE TABLE "content_gifts" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "giftName" TEXT NOT NULL,
    "coinCost" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalCoins" INTEGER NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_gifts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_gifts_targetType_targetId_idx"
    ON "content_gifts"("targetType", "targetId");

CREATE INDEX "content_gifts_recipientId_idx"
    ON "content_gifts"("recipientId");

CREATE INDEX "content_gifts_senderId_idx"
    ON "content_gifts"("senderId");
