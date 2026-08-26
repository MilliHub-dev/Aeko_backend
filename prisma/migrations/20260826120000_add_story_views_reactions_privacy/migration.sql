-- Story/Status feature foundations.
--
-- Adds view tracking, normalised reactions, audience scoping, media descriptors and
-- highlights, plus the indexes the story feed query depends on. The "status" table had
-- no indexes at all before this migration; its main query filtered on unindexed
-- "userId"/"expiresAt".
--
-- Locking note: CREATE INDEX takes a SHARE lock that blocks writes to "status" for the
-- duration. The table is small (24h of rows), so this is expected to be brief. If it is
-- large in your environment, run the CreateIndex statements separately with
-- CREATE INDEX CONCURRENTLY, which cannot run inside Prisma's migration transaction.

-- gen_random_uuid() is built in on PostgreSQL 13+; the extension makes the backfill
-- below portable to older servers and is a no-op on 13+.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- AlterTable: audience, media descriptors and counters on status
ALTER TABLE "status"
  ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'FOLLOWERS',
  ADD COLUMN "hiddenFromUserIds" JSONB,
  ADD COLUMN "durationMs" INTEGER,
  ADD COLUMN "thumbnailUrl" TEXT,
  ADD COLUMN "mediaWidth" INTEGER,
  ADD COLUMN "mediaHeight" INTEGER,
  ADD COLUMN "cloudinaryPublicId" TEXT,
  ADD COLUMN "cloudinaryResourceType" TEXT,
  ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reactionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "replyCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "mentions" JSONB,
  ADD COLUMN "stickers" JSONB;

-- AlterTable: close friends list and per-viewer story muting on users
ALTER TABLE "users"
  ADD COLUMN "closeFriends" JSONB,
  ADD COLUMN "mutedStoryUserIds" JSONB;

-- CreateTable
CREATE TABLE "status_views" (
    "id" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_reactions" (
    "id" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_highlights" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_highlight_items" (
    "id" TEXT NOT NULL,
    "highlightId" TEXT NOT NULL,
    "statusId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_highlight_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "status_views_statusId_viewerId_key" ON "status_views"("statusId", "viewerId");
CREATE INDEX "status_views_statusId_viewedAt_idx" ON "status_views"("statusId", "viewedAt");
CREATE INDEX "status_views_viewerId_viewedAt_idx" ON "status_views"("viewerId", "viewedAt");

CREATE UNIQUE INDEX "status_reactions_statusId_userId_key" ON "status_reactions"("statusId", "userId");
CREATE INDEX "status_reactions_statusId_createdAt_idx" ON "status_reactions"("statusId", "createdAt");

CREATE INDEX "status_highlights_userId_position_idx" ON "status_highlights"("userId", "position");

CREATE UNIQUE INDEX "status_highlight_items_highlightId_statusId_key" ON "status_highlight_items"("highlightId", "statusId");
CREATE INDEX "status_highlight_items_highlightId_position_idx" ON "status_highlight_items"("highlightId", "position");

-- CreateIndex: the story feed query. Previously a full scan.
CREATE INDEX "status_userId_expiresAt_idx" ON "status"("userId", "expiresAt");
CREATE INDEX "status_expiresAt_idx" ON "status"("expiresAt");
CREATE INDEX "status_userId_createdAt_idx" ON "status"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "status_views" ADD CONSTRAINT "status_views_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "status"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "status_views" ADD CONSTRAINT "status_views_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "status_reactions" ADD CONSTRAINT "status_reactions_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "status"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "status_reactions" ADD CONSTRAINT "status_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "status_highlights" ADD CONSTRAINT "status_highlights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "status_highlight_items" ADD CONSTRAINT "status_highlight_items_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "status_highlights"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "status_highlight_items" ADD CONSTRAINT "status_highlight_items_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: legacy status.reactions JSON array -> status_reactions rows.
-- The legacy array was append-only, so one user could appear many times. Keep only the
-- most recent entry per (status, user) to satisfy the new unique constraint, and skip
-- entries whose userId no longer resolves to a real account.
INSERT INTO "status_reactions" ("id", "statusId", "userId", "emoji", "createdAt", "updatedAt")
SELECT DISTINCT ON (src."statusId", src."userId")
    gen_random_uuid()::text,
    src."statusId",
    src."userId",
    src."emoji",
    src."reactedAt",
    src."reactedAt"
FROM (
    SELECT
        s."id" AS "statusId",
        elem->>'userId' AS "userId",
        elem->>'emoji'  AS "emoji",
        COALESCE(
            NULLIF(elem->>'createdAt', '')::timestamp(3),
            s."createdAt"
        ) AS "reactedAt"
    FROM "status" s
    CROSS JOIN LATERAL jsonb_array_elements(s."reactions") AS elem
    WHERE jsonb_typeof(s."reactions") = 'array'
      AND COALESCE(elem->>'userId', '') <> ''
      AND COALESCE(elem->>'emoji', '')  <> ''
) src
WHERE EXISTS (SELECT 1 FROM "users" u WHERE u."id" = src."userId")
ORDER BY src."statusId", src."userId", src."reactedAt" DESC;

-- Backfill the denormalised reaction counter to match the rows just inserted.
UPDATE "status" s
SET "reactionCount" = c.n
FROM (
    SELECT "statusId", COUNT(*)::int AS n
    FROM "status_reactions"
    GROUP BY "statusId"
) c
WHERE c."statusId" = s."id";
