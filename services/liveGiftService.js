import { v4 as uuidV4 } from "uuid";
import { prisma } from "../config/db.js";
import { getGiftById, HOST_COIN_SHARE } from "../config/giftCatalog.js";
import { getIO } from "../utils/socketRegistry.js";
import { GiftError, transferGiftCoins } from "./giftLedger.js";

export { GiftError };

/**
 * Coin gifts on live streams.
 *
 * The REST route and the socket handler each carried their own copy of this
 * logic, and both had the same money bugs:
 *   - the balance was read, checked, then overwritten with a precomputed total,
 *     so two gifts sent together both passed the check and the sender paid for
 *     one while sending two — and a coin purchase landing in between was erased;
 *   - the REST route accepted gifts on streams that had ended;
 *   - the stream's monetization totals were read-modify-written JSON, so
 *     concurrent gifts lost counts.
 * Both callers now go through here.
 */

const MAX_QUANTITY = 100;
const MAX_MESSAGE_LENGTH = 200;
const LEADERBOARD_SIZE = 5;


/**
 * Debits the sender, credits the host and records the gift in one transaction.
 *
 * The debit is a conditional decrement (`coinBalance >= total`), so the check
 * and the write are a single statement: whichever concurrent gift runs second
 * sees the reduced balance and is refused instead of overdrawing.
 *
 * @param {object} params
 * @param {object} [db] Prisma client; injectable for tests.
 */
export const sendStreamGift = async (
  { senderId, streamId, giftId, quantity = 1, message },
  db = prisma
) => {
  if (!giftId) throw new GiftError(400, "INVALID_GIFT", "giftId is required");

  const gift = getGiftById(giftId);
  if (!gift) throw new GiftError(400, "INVALID_GIFT", "Invalid gift");

  const qty = Math.max(1, Math.min(parseInt(quantity, 10) || 1, MAX_QUANTITY));
  const totalCoins = gift.coinCost * qty;
  const hostEarnings = Math.floor(totalCoins * HOST_COIN_SHARE);
  const cleanMessage =
    typeof message === "string"
      ? message.trim().slice(0, MAX_MESSAGE_LENGTH) || null
      : null;

  return db.$transaction(async (tx) => {
    const stream = await tx.liveStream.findUnique({
      where: { id: streamId },
      select: { id: true, hostId: true, status: true },
    });
    if (!stream) throw new GiftError(404, "STREAM_NOT_FOUND", "Stream not found");
    if (stream.status !== "live") {
      throw new GiftError(400, "STREAM_NOT_LIVE", "This stream is not live");
    }
    // Gifting yourself would only convert 30% of your coins into nothing.
    if (stream.hostId === senderId) {
      throw new GiftError(400, "CANNOT_GIFT_OWN_STREAM", "You can't send gifts to your own stream");
    }

    const { sender } = await transferGiftCoins(tx, {
      senderId,
      recipientId: stream.hostId,
      totalCoins,
      recipientEarnings: hostEarnings,
      sentDescription: `Sent ${qty}x ${gift.name} on stream`,
      receivedDescription: `Received ${qty}x ${gift.name} gift`,
      sentMetadata: { streamId, giftId: gift.id, quantity: qty },
      receivedMetadata: { streamId, giftId: gift.id, senderId, quantity: qty },
    });

    const record = await tx.liveStreamGift.create({
      data: {
        id: uuidV4(),
        streamId,
        senderId,
        hostId: stream.hostId,
        giftId: gift.id,
        giftName: gift.name,
        coinCost: gift.coinCost,
        quantity: qty,
        totalCoins,
        message: cleanMessage,
      },
    });

    // Incremented in SQL: a JSON read-modify-write here lost counts whenever
    // two gifts arrived together.
    await tx.$executeRaw`
      UPDATE "live_streams"
      SET "monetization" = jsonb_set(
        jsonb_set(
          CASE WHEN jsonb_typeof("monetization"::jsonb) = 'object'
               THEN "monetization"::jsonb ELSE '{}'::jsonb END,
          '{totalCoinsReceived}',
          to_jsonb(COALESCE(NULLIF("monetization"::jsonb->>'totalCoinsReceived', '')::numeric, 0) + ${totalCoins}::numeric)
        ),
        '{totalGifts}',
        to_jsonb(COALESCE(NULLIF("monetization"::jsonb->>'totalGifts', '')::numeric, 0) + ${qty}::numeric)
      )
      WHERE "id" = ${streamId}`;

    return {
      gift,
      record,
      quantity: qty,
      totalCoins,
      hostEarnings,
      hostId: stream.hostId,
      sender,
      message: cleanMessage,
      newBalance: sender.coinBalance,
    };
  },
  // Prisma's default 5s interactive-transaction limit is tight for ~7 round
  // trips to a pooled Neon database; a timeout rolls the gift back cleanly.
  { maxWait: 10000, timeout: 20000 });
};

/** Top gifters for a stream, shaped like the existing leaderboard responses. */
export const getStreamLeaderboard = async (streamId, limit = LEADERBOARD_SIZE, db = prisma) => {
  const top = await db.liveStreamGift.groupBy({
    by: ["senderId"],
    where: { streamId },
    _sum: { totalCoins: true },
    orderBy: { _sum: { totalCoins: "desc" } },
    take: limit,
  });

  const users = await db.user.findMany({
    where: { id: { in: top.map((r) => r.senderId) } },
    select: { id: true, username: true, profilePicture: true },
  });
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));

  return top.map((r, i) => ({
    rank: i + 1,
    userId: r.senderId,
    username: byId[r.senderId]?.username || "Unknown",
    profilePicture: byId[r.senderId]?.profilePicture || null,
    totalCoins: r._sum.totalCoins,
  }));
};

/**
 * Announces a completed gift: animation for the room, an earnings alert for the
 * host (every socket joins a room named after its user id), and the updated
 * leaderboard. Only the socket path used to broadcast, so a gift sent over
 * REST was invisible to everyone watching.
 */
export const broadcastStreamGift = async (streamId, result) => {
  const io = getIO();
  if (!io) return;

  const payload = {
    streamId,
    gift: { ...result.gift, quantity: result.quantity, totalCoins: result.totalCoins },
    sender: {
      userId: result.sender.id,
      username: result.sender.username,
      profilePicture: result.sender.profilePicture,
    },
    message: result.message,
    timestamp: new Date(),
  };

  io.to(streamId).emit("stream_gift_received", payload);
  io.to(result.hostId).emit("gift_alert", { ...payload, coinsEarned: result.hostEarnings });

  try {
    const leaderboard = await getStreamLeaderboard(streamId);
    io.to(streamId).emit("leaderboard_update", { streamId, leaderboard });
  } catch (error) {
    console.error("Leaderboard broadcast error:", error);
  }
};
