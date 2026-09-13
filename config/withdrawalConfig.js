/**
 * Coin withdrawals: users convert EARNED coins (gifts received) into crypto,
 * paid out manually by an admin.
 *
 * Money is handled in integer cents throughout so no amount is ever rounded
 * twice. The env overrides exist so the rate or fee can change without a
 * deploy; the defaults are the launch values.
 */

const intFromEnv = (name, fallback) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

/** US cents paid out per 100 coins. 50 = $0.50 per 100 coins. */
export const WITHDRAW_CENTS_PER_100_COINS = intFromEnv("WITHDRAW_CENTS_PER_100_COINS", 50);

/** Flat fee deducted from every payout, in cents. 150 = $1.50. */
export const WITHDRAW_FEE_CENTS = intFromEnv("WITHDRAW_FEE_CENTS", 150);

/** Smallest gross withdrawal, in cents, before the fee. 1000 = $10. */
export const WITHDRAW_MIN_CENTS = intFromEnv("WITHDRAW_MIN_CENTS", 1000);

export const WITHDRAW_NETWORKS = [
  {
    id: "AEKO",
    label: "AEKO",
    addressHint: "Your AEKO wallet address",
  },
  {
    id: "USDT_TRC20",
    label: "USDT (TRC20)",
    addressHint: "A Tron address starting with T",
  },
  {
    id: "SOL",
    label: "Solana (SOL)",
    addressHint: "Your Solana wallet address",
  },
];

/** Gross value of a coin amount, rounded down to the cent. */
export const coinsToCents = (coins) =>
  Math.floor((coins * WITHDRAW_CENTS_PER_100_COINS) / 100);

/** Fewest whole coins whose gross value reaches the minimum. */
export const minWithdrawCoins = () =>
  Math.ceil((WITHDRAW_MIN_CENTS * 100) / Math.max(1, WITHDRAW_CENTS_PER_100_COINS));
