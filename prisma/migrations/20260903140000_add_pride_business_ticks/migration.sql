-- Verification ticks beyond blue and golden.
--
-- routes/subscriptionRoutes.js and routes/profile.js both select "prideTick"
-- and "businessTick", and aeko_web/types already declare them, but the columns
-- were never created. Any authenticated call to GET /api/subscription/status
-- therefore failed with Prisma P2022 (column does not exist), and the profile
-- endpoint returned undefined for both.
--
-- Nullable is avoided deliberately: the code treats these as booleans, so they
-- default to false like the two existing ticks.

ALTER TABLE "users"
  ADD COLUMN "prideTick" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "businessTick" BOOLEAN NOT NULL DEFAULT false;
