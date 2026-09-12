-- Chat stickers, created by users from a photo and shared with everyone.
-- `isHidden` is the moderation switch used from the admin panel.
CREATE TABLE "stickers" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stickers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stickers_creatorId_idx" ON "stickers"("creatorId");

-- The picker reads visible stickers newest first.
CREATE INDEX "stickers_isHidden_createdAt_idx" ON "stickers"("isHidden", "createdAt");

ALTER TABLE "stickers" ADD CONSTRAINT "stickers_creatorId_fkey"
    FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
