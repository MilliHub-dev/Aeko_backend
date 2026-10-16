-- Multiple custodial wallets per user.
--
-- Addresses are derived (master seed + user id + index), never stored as
-- secrets. Index 0 is the address the account always had; rows are created
-- lazily the first time a user's wallets are listed, so no backfill here.
CREATE TABLE "user_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_wallets_address_key" ON "user_wallets"("address");
CREATE UNIQUE INDEX "user_wallets_userId_index_key" ON "user_wallets"("userId", "index");
CREATE INDEX "user_wallets_userId_idx" ON "user_wallets"("userId");

ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
