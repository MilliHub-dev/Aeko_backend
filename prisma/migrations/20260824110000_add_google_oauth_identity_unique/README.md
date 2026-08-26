# Google OAuth identity uniqueness preflight

This migration adds a unique PostgreSQL index for the provider and subject pair
used by Google sign-in. Apply it with the normal Prisma deployment command; do
not run it until the production data has passed this read-only preflight:

```sql
SELECT "oauthProvider", "oauthId", COUNT(*) AS "duplicateCount"
FROM "users"
WHERE "oauthProvider" IS NOT NULL
  AND "oauthId" IS NOT NULL
GROUP BY "oauthProvider", "oauthId"
HAVING COUNT(*) > 1;
```

If any rows are returned, resolve each legacy duplicate deliberately before
deployment. The migration is intentionally not data-destructive and the index
creation will fail rather than selecting an arbitrary account binding.

After the preflight returns no rows, deploy with:

```bash
npm run migrate:deploy
```
