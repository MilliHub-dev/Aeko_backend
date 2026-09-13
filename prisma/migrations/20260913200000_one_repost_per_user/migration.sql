-- One repost per user per original post.
--
-- The repost endpoint allowed the same post to be reposted any number of
-- times. A code check alone lets two taps sent together both pass, so the rule
-- is enforced here. Partial indexes are not expressible in schema.prisma, so
-- this one lives only in this migration.
CREATE UNIQUE INDEX "posts_one_repost_per_user"
    ON "posts"("userId", "originalPostId") WHERE "originalPostId" IS NOT NULL;
