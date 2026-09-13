import { v4 as uuidV4 } from "uuid";

/**
 * The money movement shared by every kind of coin gift (live streams, posts,
 * profiles), so the overdraft protection exists in exactly one place.
 */

export class GiftError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = "GiftError";
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/**
 * Debits the sender, credits the recipient and writes both ledger rows.
 *
 * Must run inside a transaction. The debit is a conditional decrement
 * (`coinBalance >= total`), so checking the balance and taking the coins are a
 * single statement: of two gifts racing on the same balance, the second sees
 * the reduced balance and is refused rather than overdrawing the account.
 *
 * @throws {GiftError} INSUFFICIENT_COINS
 */
export const transferGiftCoins = async (
  tx,
  {
    senderId,
    recipientId,
    totalCoins,
    recipientEarnings,
    sentDescription,
    receivedDescription,
    sentMetadata = {},
    receivedMetadata = {},
  }
) => {
  const debited = await tx.user.updateMany({
    where: { id: senderId, coinBalance: { gte: totalCoins } },
    data: { coinBalance: { decrement: totalCoins } },
  });
  if (debited.count === 0) {
    const current = await tx.user.findUnique({
      where: { id: senderId },
      select: { coinBalance: true },
    });
    throw new GiftError(400, "INSUFFICIENT_COINS", "Not enough coins", {
      balance: current?.coinBalance ?? 0,
      required: totalCoins,
    });
  }

  const sender = await tx.user.findUnique({
    where: { id: senderId },
    select: { id: true, username: true, profilePicture: true, coinBalance: true },
  });

  const recipient = await tx.user.update({
    where: { id: recipientId },
    data: { coinBalance: { increment: recipientEarnings } },
    select: { coinBalance: true },
  });

  await tx.coinTransaction.create({
    data: {
      id: uuidV4(),
      userId: senderId,
      type: "gift_sent",
      amount: -totalCoins,
      balanceAfter: sender.coinBalance,
      description: sentDescription,
      metadata: sentMetadata,
    },
  });

  await tx.coinTransaction.create({
    data: {
      id: uuidV4(),
      userId: recipientId,
      type: "gift_received",
      amount: recipientEarnings,
      balanceAfter: recipient.coinBalance,
      description: receivedDescription,
      metadata: receivedMetadata,
    },
  });

  return { sender, recipientBalance: recipient.coinBalance };
};
