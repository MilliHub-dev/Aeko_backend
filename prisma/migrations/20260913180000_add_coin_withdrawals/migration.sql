-- Coin withdrawals.
--
-- Only coins earned from gifts may be withdrawn, never coins bought with a
-- card (that would turn the app into a card-to-crypto cash-out route). Earned
-- coins were not tracked separately, so this adds a running earned balance and
-- backfills it from the gift ledger, capped at what each user still holds.
ALTER TABLE "users" ADD COLUMN "earnedCoinBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "users" AS u
SET "earnedCoinBalance" = LEAST(u."coinBalance", received.total)
FROM (
    SELECT "userId", SUM("amount") AS total
    FROM "coin_transactions"
    WHERE "type" = 'gift_received'
    GROUP BY "userId"
) AS received
WHERE u."id" = received."userId";

-- Requests wait for an admin, who pays out manually and records the tx hash,
-- or rejects and returns the coins. Amounts are integer US cents.
CREATE TABLE "coin_withdrawals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "network" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "grossUsdCents" INTEGER NOT NULL,
    "feeUsdCents" INTEGER NOT NULL,
    "payoutUsdCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "txHash" TEXT,
    "adminNote" TEXT,
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_withdrawals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coin_withdrawals_userId_idx" ON "coin_withdrawals"("userId");

CREATE INDEX "coin_withdrawals_status_createdAt_idx" ON "coin_withdrawals"("status", "createdAt");

-- One pending request per user, enforced by the database: a check in code alone
-- let two requests sent at the same moment both be accepted. Partial indexes
-- are not expressible in schema.prisma, so this one lives only here.
CREATE UNIQUE INDEX "coin_withdrawals_one_pending_per_user"
    ON "coin_withdrawals"("userId") WHERE "status" = 'pending';
