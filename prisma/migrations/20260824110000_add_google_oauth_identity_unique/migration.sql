-- A non-null Google provider/subject pair must identify exactly one Aeko user.
-- Before deploying, remediate any legacy duplicate pairs; PostgreSQL permits
-- multiple NULL values, so local/password-only users remain unaffected.
CREATE UNIQUE INDEX "users_oauthProvider_oauthId_key"
ON "users"("oauthProvider", "oauthId");
