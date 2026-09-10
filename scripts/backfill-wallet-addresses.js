/**
 * Assigns a wallet address to every account that has none.
 *
 *   node scripts/backfill-wallet-addresses.js
 *
 * Run it where AEKO_CUSTODY_MASTER_SEED is the production value (for example a
 * Render shell). Addresses derived from any other seed would be ones the live
 * server cannot sign for. The server also runs this backfill on boot, so the
 * script is only needed to do it without a restart.
 */
import "dotenv/config";
import { prisma } from "../config/db.js";
import { backfillWalletAddresses } from "../services/walletProvisioning.js";

const result = await backfillWalletAddresses();
console.log(JSON.stringify(result));
await prisma.$disconnect();
process.exit(result.skipped ? 1 : 0);
