import { prisma } from "../config/db.js";
import BlockingService from "./blockingService.js";
import { GiftError as RepostError } from "./giftLedger.js";
import { createNotification } from "./notificationService.js";
import PrivacyManager from "./privacyManager.js";

/**
 * Reposts.
 *
 * A repost is a row in `posts` owned by the reposter, pointing at the original
 * through `originalPostId`. The text and media are copied onto it so every
 * existing renderer keeps working, but feeds now also carry `repostOf` (the
 * original and its author), so a repost is shown as someone else's post that
 * was reposted rather than as the reposter's own content.
 *
 * The previous endpoint copied the content with no attribution in any feed,
 * allowed unlimited duplicates, skipped block and privacy checks, never counted
 * the share, and left the copies behind when the original was deleted.
 */

export { RepostError };

const authorSelect = {
  id: true,
  name: true,
  username: true,
  profilePicture: true,
  blueTick: true,
  goldenTick: true,
  prideTick: true,
  businessTick: true,
};

const repostablePostSelect = {
  id: true,
  userId: true,
  status: true,
  originalPostId: true,
  communityId: true,
  type: true,
  text: true,
  media: true,
};

const defaultDeps = {
  blocking: BlockingService,
  privacy: PrivacyManager,
  notify: createNotification,
};

/** Adjusts posts.engagement.totalShares in SQL, never below zero. */
const adjustShares = async (db, postId, delta) => {
  const rows = await db.$queryRaw`
    UPDATE "posts"
    SET "engagement" = jsonb_set(
      CASE WHEN jsonb_typeof("engagement"::jsonb) = 'object'
           THEN "engagement"::jsonb ELSE '{}'::jsonb END,
      '{totalShares}',
      to_jsonb(GREATEST(0, COALESCE(NULLIF("engagement"::jsonb->>'totalShares', '')::int, 0) + ${delta}::int))
    )
    WHERE "id" = ${postId}
    RETURNING ("engagement"::jsonb->>'totalShares')::int AS "totalShares"`;
  return rows?.[0]?.totalShares ?? 0;
};

/**
 * Adds `repostOf` and `repostedByMe` to post payloads, with two queries for the
 * whole page rather than per post.
 */
export const attachRepostData = async (posts, viewerId, db = prisma) => {
  if (!Array.isArray(posts) || posts.length === 0) return posts;

  const idOf = (p) => p?.id ?? p?._id;
  const originalIds = [...new Set(posts.map((p) => p?.originalPostId).filter(Boolean))];
  const rootIds = [...new Set(posts.map((p) => p?.originalPostId || idOf(p)).filter(Boolean))];

  const [originals, mine, bookmarked] = await Promise.all([
    originalIds.length
      ? db.post.findMany({
          where: { id: { in: originalIds } },
          select: {
            id: true,
            userId: true,
            text: true,
            type: true,
            media: true,
            createdAt: true,
            engagement: true,
            likes: true,
            views: true,
            _count: { select: { comments: true } },
            users_posts_userIdTouser: { select: authorSelect },
          },
        })
      : [],
    viewerId && rootIds.length
      ? db.post.findMany({
          where: { userId: viewerId, originalPostId: { in: rootIds } },
          select: { originalPostId: true },
        })
      : [],
    viewerId && originalIds.length
      ? db.bookmark.findMany({
          where: { userId: viewerId, postId: { in: originalIds } },
          select: { postId: true },
        })
      : [],
  ]);

  const byId = new Map(originals.map((o) => [o.id, o]));
  const repostedRoots = new Set(mine.map((m) => m.originalPostId));
  const bookmarkedIds = new Set(bookmarked.map((b) => b.postId));

  return posts.map((p) => {
    if (!p) return p;
    const root = p.originalPostId ? byId.get(p.originalPostId) : null;
    return {
      ...p,
      repostOf: root
        ? {
            postId: root.id,
            user: root.users_posts_userIdTouser ?? { id: root.userId },
            text: root.text ?? "",
            type: root.type,
            media: root.media ?? null,
            createdAt: root.createdAt,
            // The original's engagement: a repost row has none of its own, so
            // without these a repost card showed zero likes and comments.
            engagement: root.engagement ?? null,
            likesCount: Array.isArray(root.likes) ? root.likes.length : 0,
            commentsCount: root._count?.comments ?? 0,
            views: root.views ?? 0,
            isLiked: Array.isArray(root.likes) && !!viewerId && root.likes.includes(viewerId),
            isBookmarked: bookmarkedIds.has(root.id),
          }
        : null,
      repostedByMe: repostedRoots.has(p.originalPostId || idOf(p)),
    };
  });
};

const assertCanRepost = async (userId, root, db, deps) => {
  if (root.userId === userId) {
    throw new RepostError(400, "CANNOT_REPOST_OWN", "You can't repost your own post");
  }
  const canInteract = await deps.blocking.enforceBlockingRules(userId, root.userId);
  if (!canInteract) {
    throw new RepostError(403, "NOT_ALLOWED", "You can't repost this post");
  }
  const canView = await deps.privacy.canViewPosts(userId, root.userId);
  if (!canView) {
    throw new RepostError(403, "NOT_ALLOWED", "You can't repost this post");
  }
  if (root.communityId) {
    const community = await db.community.findUnique({
      where: { id: root.communityId },
      select: { isPrivate: true },
    });
    // A private community's posts are for its members; reposting would publish them.
    if (community?.isPrivate) {
      throw new RepostError(403, "NOT_ALLOWED", "Posts from private communities can't be reposted");
    }
  }
};

/**
 * @param {object} [db] Prisma client; injectable for tests.
 * @param {object} [deps] blocking/privacy/notify; injectable for tests.
 */
export const repostPost = async ({ userId, postId }, db = prisma, deps = defaultDeps) => {
  const target = await db.post.findUnique({ where: { id: postId }, select: repostablePostSelect });
  if (!target || target.status !== "active") {
    throw new RepostError(404, "POST_NOT_FOUND", "Post not found");
  }

  // Reposting a repost reposts the original, so chains never form.
  const root = target.originalPostId
    ? await db.post.findUnique({ where: { id: target.originalPostId }, select: repostablePostSelect })
    : target;
  if (!root || root.status !== "active") {
    throw new RepostError(404, "POST_NOT_FOUND", "Post not found");
  }

  await assertCanRepost(userId, root, db, deps);

  const existing = await db.post.findFirst({
    where: { userId, originalPostId: root.id },
    select: { id: true },
  });
  if (existing) {
    throw new RepostError(409, "ALREADY_REPOSTED", "You've already reposted this", {
      repostId: existing.id,
      originalPostId: root.id,
    });
  }

  const { repost, totalShares } = await db.$transaction(
    async (tx) => {
      const created = await tx.post
        .create({
          data: {
            userId,
            originalPostId: root.id,
            originalOwnerId: root.userId,
            type: root.type,
            text: root.text || "",
            media: root.media ?? "",
          },
          include: { users_posts_userIdTouser: { select: authorSelect } },
        })
        .catch((error) => {
          // The one-repost-per-user index: a second tap that raced the check above.
          if (error?.code === "P2002") {
            throw new RepostError(409, "ALREADY_REPOSTED", "You've already reposted this", {
              originalPostId: root.id,
            });
          }
          throw error;
        });
      const shares = await adjustShares(tx, root.id, 1);
      return { repost: created, totalShares: shares };
    },
    { maxWait: 10000, timeout: 20000 }
  );

  Promise.resolve(
    deps.notify({
      recipientId: root.userId,
      senderId: userId,
      type: "REPOST",
      title: "New repost",
      message: `${repost.users_posts_userIdTouser?.username ? `@${repost.users_posts_userIdTouser.username}` : "Someone"} reposted your post`,
      entityId: root.id,
      entityType: "POST",
    })
  ).catch((error) => console.error("Repost notification error:", error));

  const { users_posts_userIdTouser: author, ...rest } = repost;
  // Returned with `repostOf` so the app can add it to the feed straight away,
  // shown under the original author like any other repost.
  const [withRepost] = await attachRepostData([{ ...rest, _id: rest.id, user: author }], userId, db);
  return {
    repost: withRepost,
    originalPostId: root.id,
    totalShares,
  };
};

/** Removes the caller's repost. `postId` may be the original or the repost itself. */
export const undoRepost = async ({ userId, postId }, db = prisma) => {
  const target = await db.post.findUnique({
    where: { id: postId },
    select: { id: true, userId: true, originalPostId: true },
  });

  const repost =
    target?.originalPostId && target.userId === userId
      ? target
      : await db.post.findFirst({
          where: { userId, originalPostId: postId },
          select: { id: true, originalPostId: true },
        });
  if (!repost) {
    throw new RepostError(404, "NOT_REPOSTED", "You haven't reposted this");
  }

  const totalShares = await db.$transaction(
    async (tx) => {
      await tx.post.delete({ where: { id: repost.id } });
      return adjustShares(tx, repost.originalPostId, -1);
    },
    { maxWait: 10000, timeout: 20000 }
  );

  return { originalPostId: repost.originalPostId, totalShares };
};

/**
 * Called before a post is deleted. Its reposts go with it (they are copies of
 * its content, and would otherwise read as the reposters' own posts), and a
 * deleted repost gives its share back.
 */
export const cleanUpRepostsForDeletedPost = async (post, db = prisma) => {
  await db.post.deleteMany({ where: { originalPostId: post.id } });
  if (post.originalPostId) {
    await adjustShares(db, post.originalPostId, -1);
  }
};
