import { prisma } from "../config/db.js";
import { getCustodialAddress, isCustodyConfigured } from "../chain/custodialKeypair.js";

/**
 * Gives every account its Aeko wallet address.
 *
 * Wallets are custodial and deterministic: a user's address is derived from
 * AEKO_CUSTODY_MASTER_SEED and their user id (see chain/custodialKeypair.js),
 * so "creating" a wallet means deriving that address and saving it on the
 * user. No chain transaction is needed — an address exists on chain as soon as
 * anything is sent to it.
 *
 * Previously no signup path did this. The address was only written the first
 * time the user opened the wallet screen, so until then marketplace routes read
 * a null `req.user.walletAddress`, and NFTs could not be matched back to their
 * owner's profile.
 */

/**
 * Assigns the user's custodial address if the account has none.
 *
 * Never throws: an account must not fail to be created because custody is
 * misconfigured. The wallet routes still assign the address lazily later.
 *
 * @param {string} userId
 * @returns {Promise<string|null>} the account's address, or null if none could be assigned
 */
export async function ensureUserWallet(userId) {
  if (!userId) return null;

  if (!isCustodyConfigured()) {
    console.warn(
      `wallet provisioning skipped for user ${userId}: AEKO_CUSTODY_MASTER_SEED is not set`,
    );
    return null;
  }

  try {
    const address = getCustodialAddress(userId);

    // Only fills an empty slot, so it never replaces an address already saved.
    const { count } = await prisma.user.updateMany({
      where: { id: userId, walletAddress: null },
      data: { walletAddress: address },
    });
    if (count > 0) return address;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });
    return user?.walletAddress ?? null;
  } catch (error) {
    // P2002: the derived address is already saved on another account, which
    // can only happen if it was claimed through POST /api/wallet/link.
    console.error(`wallet provisioning failed for user ${userId}:`, error);
    return null;
  }
}

/**
 * Assigns addresses to every existing account that has none. Safe to run
 * repeatedly; accounts that already have an address are not touched.
 *
 * Must run with the same AEKO_CUSTODY_MASTER_SEED as production, otherwise it
 * would save addresses the live server cannot sign for.
 */
export async function backfillWalletAddresses({ batchSize = 200 } = {}) {
  if (!isCustodyConfigured()) {
    console.warn("wallet backfill skipped: AEKO_CUSTODY_MASTER_SEED is not set");
    return { assigned: 0, failed: 0, skipped: true };
  }

  let assigned = 0;
  let failed = 0;
  let lastId;

  for (;;) {
    // Paged by id rather than a cursor, because assigned rows drop out of the
    // `walletAddress: null` filter as the loop runs.
    const users = await prisma.user.findMany({
      where: { walletAddress: null, ...(lastId ? { id: { gt: lastId } } : {}) },
      select: { id: true },
      orderBy: { id: "asc" },
      take: batchSize,
    });
    if (users.length === 0) break;

    for (const { id } of users) {
      if (await ensureUserWallet(id)) assigned++;
      else failed++;
    }

    lastId = users[users.length - 1].id;
    if (users.length < batchSize) break;
  }

  if (assigned || failed) {
    console.log(`wallet backfill: ${assigned} assigned, ${failed} failed`);
  }
  return { assigned, failed, skipped: false };
}

export default { ensureUserWallet, backfillWalletAddresses };
