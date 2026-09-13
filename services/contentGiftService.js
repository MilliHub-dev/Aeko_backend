import { v4 as uuidV4 } from "uuid";
import { prisma } from "../config/db.js";
import { getGiftById, HOST_COIN_SHARE } from "../config/giftCatalog.js";
import BlockingService from "./blockingService.js";
import { GiftError, transferGiftCoins } from "./giftLedger.js";
import { createNotification } from "./notificationService.js";
import PrivacyManager from "./privacyManager.js";

/**
 * Coin gifts outside live streams: to a post (feed posts, reels and community
 * posts are all rows in `posts`) or directly to a user's profile.
 *
 * Money moves through the same `transferGiftCoins` as live-stream gifts, so the
 * overdraft protection is shared. Recipients earn the same share as hosts.
 */

export const GIFT_TARGET_TYPES = ["POST", "USER"];
const MAX_QUANTITY = 100;
const MAX_MESSAGE_LENGTH = 200;

/**
 * Finds who a gift is for and whether the sender may send it.
 * Runs before the transaction: these are reads, and failing early spares a
 * transaction for a gift that cannot go through.
 */
const resolveRecipient = async (senderId, targetType, targetId, db) => {
  if (targetType === "USER") {
    const user = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, username: true, banned: true },
    });
    if (!user || user.banned) {
      throw new GiftError(404, "TARGET_NOT_FOUND", "User not found");
    }
    return { recipientId: user.id, communityId: null };
  }

  const post = await db.post.findUnique({
    where: { id: targetId },
    select: { id: true, userId: true, status: true, communityId: true },
  });
  if (!post || post.status !== "active") {
    throw new GiftError(404, "TARGET_NOT_FOUND", "Post not found");
  }
  return { recipientId: post.userId, communityId: post.communityId };
};

const assertAllowed = async (senderId, recipientId, targetType, communityId, db, deps) => {
  if (recipientId === senderId) {
    throw new GiftError(400, "CANNOT_GIFT_SELF", "You can't send a gift to yourself");
  }

  const canInteract = await deps.blocking.enforceBlockingRules(senderId, recipientId);
  if (!canInteract) {
    throw new GiftError(403, "NOT_ALLOWED", "You can't send a gift to this account");
  }

  if (targetType !== "POST") return;

  // A post you are not allowed to see is not one you can gift.
  const canView = await deps.privacy.canViewPosts(senderId, recipientId);
  if (!canView) {
    throw new GiftError(403, "NOT_ALLOWED", "You can't send a gift to this post");
  }

  if (communityId) {
    const community = await db.community.findUnique({
      where: { id: communityId },
      select: { isPrivate: true, ownerId: true },
    });
    if (community?.isPrivate && community.ownerId !== senderId) {
      const membership = await db.communityMember.findUnique({
        where: { communityId_userId: { communityId, userId: senderId } },
        select: { status: true },
      });
      if (membership?.status !== "active") {
        throw new GiftError(403, "NOT_ALLOWED", "Join this community to send gifts here");
      }
    }
  }
};

const defaultDeps = {
  blocking: BlockingService,
  privacy: PrivacyManager,
  notify: createNotification,
};

/**
 * @param {object} params
 * @param {object} [db] Prisma client; injectable for tests.
 * @param {object} [deps] blocking/privacy/notify; injectable so tests never
 *   touch the real database through these services.
 */
export const sendContentGift = async (
  { senderId, targetType, targetId, giftId, quantity = 1, message },
  db = prisma,
  deps = defaultDeps
) => {
  if (!giftId) throw new GiftError(400, "INVALID_GIFT", "giftId is required");
  const gift = getGiftById(giftId);
  if (!gift) throw new GiftError(400, "INVALID_GIFT", "Invalid gift");

  if (!GIFT_TARGET_TYPES.includes(targetType) || typeof targetId !== "string" || !targetId) {
    throw new GiftError(400, "INVALID_TARGET", "targetType must be POST or USER with a targetId");
  }

  const qty = Math.max(1, Math.min(parseInt(quantity, 10) || 1, MAX_QUANTITY));
  const totalCoins = gift.coinCost * qty;
  const recipientEarnings = Math.floor(totalCoins * HOST_COIN_SHARE);
  const cleanMessage =
    typeof message === "string"
      ? message.trim().slice(0, MAX_MESSAGE_LENGTH) || null
      : null;

  const { recipientId, communityId } = await resolveRecipient(senderId, targetType, targetId, db);
  await assertAllowed(senderId, recipientId, targetType, communityId, db, deps);

  const where = targetType === "POST" ? "on your post" : "on your profile";

  const result = await db.$transaction(async (tx) => {
    const { sender } = await transferGiftCoins(tx, {
      senderId,
      recipientId,
      totalCoins,
      recipientEarnings,
      sentDescription: `Sent ${qty}x ${gift.name}`,
      receivedDescription: `Received ${qty}x ${gift.name} ${where}`,
      sentMetadata: { targetType, targetId, giftId: gift.id, quantity: qty, recipientId },
      receivedMetadata: { targetType, targetId, giftId: gift.id, quantity: qty, senderId },
    });

    const record = await tx.contentGift.create({
      data: {
        id: uuidV4(),
        senderId,
        recipientId,
        targetType,
        targetId,
        giftId: gift.id,
        giftName: gift.name,
        coinCost: gift.coinCost,
        quantity: qty,
        totalCoins,
        message: cleanMessage,
      },
    });

    // Kept on the post's engagement JSON beside totalLikes/totalComments so the
    // feed can show it without another query. Incremented in SQL so concurrent
    // gifts cannot lose counts.
    let giftCount;
    if (targetType === "POST") {
      const rows = await tx.$queryRaw`
        UPDATE "posts"
        SET "engagement" = jsonb_set(
          CASE WHEN jsonb_typeof("engagement"::jsonb) = 'object'
               THEN "engagement"::jsonb ELSE '{}'::jsonb END,
          '{totalGifts}',
          to_jsonb(COALESCE(NULLIF("engagement"::jsonb->>'totalGifts', '')::int, 0) + ${qty}::int)
        )
        WHERE "id" = ${targetId}
        RETURNING ("engagement"::jsonb->>'totalGifts')::int AS "totalGifts"`;
      giftCount = rows?.[0]?.totalGifts;
    }

    return { gift, record, sender, quantity: qty, totalCoins, giftCount };
  },
  // Prisma's default 5s interactive-transaction limit is tight for ~7 round
  // trips to a pooled Neon database; a timeout rolls the gift back cleanly.
  { maxWait: 10000, timeout: 20000 });

  // Outside the transaction: a notification failure must not undo a paid gift.
  const who = result.sender.username ? `@${result.sender.username}` : "Someone";
  Promise.resolve(
    deps.notify({
    recipientId,
    senderId,
    type: "GIFT",
    title: "New gift",
    message: `${who} sent you ${gift.emoji} ×${qty}${targetType === "POST" ? " on your post" : ""}`,
    entityId: targetType === "POST" ? targetId : senderId,
    entityType: targetType === "POST" ? "POST" : "USER",
    metadata: {
      giftId: gift.id,
      emoji: gift.emoji,
      quantity: qty,
      totalCoins,
      targetType,
      senderId,
    },
  })
  ).catch((error) => console.error("Gift notification error:", error));

  return {
    record: result.record,
    newBalance: result.sender.coinBalance,
    coinsSpent: totalCoins,
    recipientId,
    targetType,
    targetId,
    giftCount: result.giftCount,
  };
};

/** Totals and top gifters for one post or one profile. */
export const getGiftSummary = async (targetType, targetId, db = prisma) => {
  if (!GIFT_TARGET_TYPES.includes(targetType) || !targetId) {
    throw new GiftError(400, "INVALID_TARGET", "targetType must be POST or USER with a targetId");
  }

  const where = { targetType, targetId };
  const [totals, top] = await Promise.all([
    db.contentGift.aggregate({ where, _sum: { quantity: true, totalCoins: true } }),
    db.contentGift.groupBy({
      by: ["senderId"],
      where,
      _sum: { totalCoins: true },
      orderBy: { _sum: { totalCoins: "desc" } },
      take: 5,
    }),
  ]);

  const users = await db.user.findMany({
    where: { id: { in: top.map((r) => r.senderId) } },
    select: { id: true, username: true, profilePicture: true },
  });
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));

  return {
    totalGifts: totals._sum.quantity ?? 0,
    totalCoins: totals._sum.totalCoins ?? 0,
    topGifters: top.map((r, i) => ({
      rank: i + 1,
      userId: r.senderId,
      username: byId[r.senderId]?.username || "Unknown",
      profilePicture: byId[r.senderId]?.profilePicture || null,
      totalCoins: r._sum.totalCoins,
    })),
  };
};

/**
 * Everything a user has been given: gifts on their posts, on their profile and
 * on their live streams. Profile screens show this as one "gifts received"
 * figure; counting only direct profile gifts would hide most of it.
 */
export const getReceivedGiftSummary = async (userId, db = prisma) => {
  if (!userId) {
    throw new GiftError(400, "INVALID_TARGET", "userId is required");
  }

  const [content, live, contentTop, liveTop] = await Promise.all([
    db.contentGift.aggregate({
      where: { recipientId: userId },
      _sum: { quantity: true, totalCoins: true },
    }),
    db.liveStreamGift.aggregate({
      where: { hostId: userId },
      _sum: { quantity: true, totalCoins: true },
    }),
    db.contentGift.groupBy({
      by: ["senderId"],
      where: { recipientId: userId },
      _sum: { totalCoins: true },
    }),
    db.liveStreamGift.groupBy({
      by: ["senderId"],
      where: { hostId: userId },
      _sum: { totalCoins: true },
    }),
  ]);

  // The two tables are ranked together, so the totals are merged per sender
  // before sorting rather than taking each table's top five.
  const bySender = new Map();
  for (const row of [...contentTop, ...liveTop]) {
    bySender.set(row.senderId, (bySender.get(row.senderId) ?? 0) + (row._sum.totalCoins ?? 0));
  }
  const ranked = [...bySender.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const users = await db.user.findMany({
    where: { id: { in: ranked.map(([id]) => id) } },
    select: { id: true, username: true, profilePicture: true },
  });
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));

  return {
    totalGifts: (content._sum.quantity ?? 0) + (live._sum.quantity ?? 0),
    totalCoins: (content._sum.totalCoins ?? 0) + (live._sum.totalCoins ?? 0),
    topGifters: ranked.map(([senderId, totalCoins], i) => ({
      rank: i + 1,
      userId: senderId,
      username: byId[senderId]?.username || "Unknown",
      profilePicture: byId[senderId]?.profilePicture || null,
      totalCoins,
    })),
  };
};
