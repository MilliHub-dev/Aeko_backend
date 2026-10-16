import { prisma } from "../config/db.js";
import { getCustodialKeypair } from "../chain/custodialKeypair.js";

/**
 * A user's custodial wallets.
 *
 * Wallet 0 is the address every account has had since custody shipped; it is
 * also `User.walletAddress`, which NFTs, gifts and the marketplace key off.
 * Extra wallets are new derivations (same seed, user id + index), created on
 * demand up to MAX_WALLETS. Nothing here holds key material: an address can
 * always be re-derived, and a signer is only built for a wallet the caller
 * owns.
 */

export const MAX_WALLETS = 10;
const MAX_LABEL = 40;

export class WalletError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "WalletError";
    this.status = status;
    this.code = code;
  }
}

const WALLET_SELECT = { id: true, userId: true, index: true, label: true, address: true, isDefault: true, createdAt: true };

const cleanLabel = (label, fallback) => {
  const t = String(label ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_LABEL);
  return t || fallback;
};

/** Makes sure wallet 0 exists as a row, so every user has at least one. */
async function ensurePrimary(userId) {
  const address = getCustodialKeypair(userId, 0).publicKey;
  const existing = await prisma.userWallet.findUnique({ where: { userId_index: { userId, index: 0 } }, select: WALLET_SELECT });
  if (existing) return existing;
  const hasDefault = await prisma.userWallet.count({ where: { userId, isDefault: true } });
  try {
    return await prisma.userWallet.create({
      data: { userId, index: 0, label: "Main wallet", address, isDefault: hasDefault === 0 },
      select: WALLET_SELECT,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return prisma.userWallet.findUnique({ where: { userId_index: { userId, index: 0 } }, select: WALLET_SELECT });
    }
    throw error;
  }
}

/** All of a user's wallets, primary first. */
export async function listUserWallets(userId) {
  await ensurePrimary(userId);
  return prisma.userWallet.findMany({ where: { userId }, orderBy: { index: "asc" }, select: WALLET_SELECT });
}

export async function createUserWallet(userId, label) {
  const wallets = await listUserWallets(userId);
  if (wallets.length >= MAX_WALLETS) {
    throw new WalletError(400, "WALLET_LIMIT", `You can have up to ${MAX_WALLETS} wallets.`);
  }
  // Indexes are never reused, so a deleted (future) wallet's address stays unique.
  const index = Math.max(...wallets.map((w) => w.index)) + 1;
  const address = getCustodialKeypair(userId, index).publicKey;
  return prisma.userWallet.create({
    data: { userId, index, label: cleanLabel(label, `Wallet ${wallets.length + 1}`), address },
    select: WALLET_SELECT,
  });
}

export async function renameUserWallet(userId, address, label) {
  const wallet = await findOwnedWallet(userId, address);
  return prisma.userWallet.update({
    where: { id: wallet.id },
    data: { label: cleanLabel(label, wallet.label) },
    select: WALLET_SELECT,
  });
}

export async function setDefaultUserWallet(userId, address) {
  const wallet = await findOwnedWallet(userId, address);
  await prisma.$transaction([
    prisma.userWallet.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
    prisma.userWallet.update({ where: { id: wallet.id }, data: { isDefault: true } }),
  ]);
  return { ...wallet, isDefault: true };
}

async function findOwnedWallet(userId, address) {
  await ensurePrimary(userId);
  const wallet = await prisma.userWallet.findUnique({ where: { address: String(address ?? "") }, select: WALLET_SELECT });
  if (!wallet || wallet.userId !== userId) throw new WalletError(404, "WALLET_NOT_FOUND", "That wallet isn't yours.");
  return wallet;
}

/**
 * The wallet a request means: `ref` is an address (or wallet id) the user
 * owns; with no ref, their default wallet. Returns the row plus a signer.
 */
export async function resolveUserWallet(userId, ref) {
  const wallets = await listUserWallets(userId);
  let wallet;
  if (ref) {
    wallet = wallets.find((w) => w.address === ref || w.id === ref);
    if (!wallet) throw new WalletError(404, "WALLET_NOT_FOUND", "That wallet isn't yours.");
  } else {
    wallet = wallets.find((w) => w.isDefault) ?? wallets[0];
  }
  return { wallet, wallets, signer: getCustodialKeypair(userId, wallet.index) };
}

export default { listUserWallets, createUserWallet, renameUserWallet, setDefaultUserWallet, resolveUserWallet, MAX_WALLETS };
