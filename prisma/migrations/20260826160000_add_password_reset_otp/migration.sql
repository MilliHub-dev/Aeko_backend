-- Mobile password resets exchange a 6-digit code for a reset token instead of
-- following an emailed link. The code is stored only as a keyed HMAC-SHA256
-- digest with its own expiry -- a bare hash of a 6-digit code is reversible
-- offline -- and a failed-attempt counter caps brute-force guessing of a
-- keyspace far smaller than the link token's.

ALTER TABLE "users"
  ADD COLUMN "passwordResetOtpHash" TEXT,
  ADD COLUMN "passwordResetOtpExpiresAt" TIMESTAMP(3),
  ADD COLUMN "passwordResetOtpAttempts" INTEGER NOT NULL DEFAULT 0;
