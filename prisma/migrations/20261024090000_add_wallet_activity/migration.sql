-- CreateTable
CREATE TABLE "wallet_activity" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "counterpart" TEXT,
    "incoming" BOOLEAN NOT NULL,
    "lamports" BIGINT NOT NULL,
    "fee" BIGINT NOT NULL DEFAULT 0,
    "isFaucet" BOOLEAN NOT NULL DEFAULT false,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "slot" BIGINT,
    "blockTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_activity_network_signature_address_key" ON "wallet_activity"("network", "signature", "address");

-- CreateIndex
CREATE INDEX "wallet_activity_address_network_blockTime_idx" ON "wallet_activity"("address", "network", "blockTime");
