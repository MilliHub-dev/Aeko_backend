-- Music on photo posts and stories.
--
-- A sound is a reusable mp3 on Cloudinary: a CC0 library track uploaded by an
-- admin, a track a user uploaded, or the audio extracted from a user's own
-- video post ("original sound"). Posts and stories reference it with a start
-- offset; the client plays it over the photo, nothing is re-encoded.
CREATE TABLE "sounds" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "durationMs" INTEGER NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "publicId" TEXT,
    "coverUrl" TEXT,
    "source" TEXT NOT NULL,
    "license" TEXT NOT NULL DEFAULT 'CC0',
    "category" TEXT,
    "tags" JSONB,
    "uploaderId" TEXT,
    "sourcePostId" TEXT,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sounds_pkey" PRIMARY KEY ("id")
);

-- One original sound per video post.
CREATE UNIQUE INDEX "sounds_sourcePostId_key" ON "sounds"("sourcePostId");
CREATE INDEX "sounds_isActive_useCount_idx" ON "sounds"("isActive", "useCount");
CREATE INDEX "sounds_isActive_createdAt_idx" ON "sounds"("isActive", "createdAt");
CREATE INDEX "sounds_uploaderId_idx" ON "sounds"("uploaderId");
CREATE INDEX "sounds_category_idx" ON "sounds"("category");

ALTER TABLE "sounds" ADD CONSTRAINT "sounds_uploaderId_fkey"
    FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sounds" ADD CONSTRAINT "sounds_sourcePostId_fkey"
    FOREIGN KEY ("sourcePostId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "posts" ADD COLUMN "soundId" TEXT;
ALTER TABLE "posts" ADD COLUMN "soundStartMs" INTEGER;
CREATE INDEX "posts_soundId_idx" ON "posts"("soundId");
ALTER TABLE "posts" ADD CONSTRAINT "posts_soundId_fkey"
    FOREIGN KEY ("soundId") REFERENCES "sounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "status" ADD COLUMN "soundId" TEXT;
ALTER TABLE "status" ADD COLUMN "soundStartMs" INTEGER;
CREATE INDEX "status_soundId_idx" ON "status"("soundId");
ALTER TABLE "status" ADD CONSTRAINT "status_soundId_fkey"
    FOREIGN KEY ("soundId") REFERENCES "sounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
