-- Client display preferences (theme, font size, language, region).
--
-- These were held only in the mobile Zustand store, which has no persistence,
-- so a user's choices were lost on restart and could not follow them to another
-- device. GET/PUT /api/settings read and write this column.
--
-- Nullable with no default: absent means "use the client defaults", which keeps
-- existing rows untouched and avoids a table rewrite on a large users table.

ALTER TABLE "users"
  ADD COLUMN "preferences" JSONB;
