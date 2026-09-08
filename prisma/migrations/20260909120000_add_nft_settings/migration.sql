-- Platform-wide post-to-NFT rules, editable from the admin panel.
CREATE TABLE "nft_settings" (
    "id" TEXT NOT NULL,
    "engagementThreshold" INTEGER NOT NULL DEFAULT 5,
    "likeWeight" INTEGER NOT NULL DEFAULT 1,
    "commentWeight" INTEGER NOT NULL DEFAULT 2,
    "viewsPerPoint" INTEGER NOT NULL DEFAULT 100,
    "mintingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxRoyaltyBps" INTEGER NOT NULL DEFAULT 1000,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "nft_settings_pkey" PRIMARY KEY ("id")
);
