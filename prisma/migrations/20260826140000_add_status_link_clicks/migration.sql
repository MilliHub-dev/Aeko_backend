-- Link stickers: a tappable destination placed on a story.
--
-- Clicks are recorded per viewer rather than only counted, because an arbitrary
-- tappable URL over a full-screen image is a phishing surface. A per-click record
-- makes abuse detectable (for example a link clicked far more often than the story
-- was viewed, or the same destination appearing across many accounts).

ALTER TABLE "status"
  ADD COLUMN "linkClickCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "status_link_clicks" (
    "id" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_link_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Deliberately not unique: a repeat click by the same viewer is legitimate.
CREATE INDEX "status_link_clicks_statusId_clickedAt_idx" ON "status_link_clicks"("statusId", "clickedAt");
CREATE INDEX "status_link_clicks_viewerId_clickedAt_idx" ON "status_link_clicks"("viewerId", "clickedAt");

-- AddForeignKey
ALTER TABLE "status_link_clicks" ADD CONSTRAINT "status_link_clicks_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "status"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "status_link_clicks" ADD CONSTRAINT "status_link_clicks_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
